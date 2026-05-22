"""Banker intake endpoints for customer CSV import and manual onboarding."""

from __future__ import annotations

import asyncio
import csv
import io
import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import AsyncSessionLocal, get_db
from backend.app.core.security import get_password_hash, require_roles
from backend.app.models.all_models import CustomerIntakeRecord, User, UserRole
from backend.app.repositories.user_repository import UserRepository
from backend.app.services.notification_service import (
    customer_invite_message,
    queue_and_send_email,
)
from llm.llm_service import LLMService
from llm.prompt_manager import PromptManager
from llm.response_parser import ResponseParser

router = APIRouter(prefix="/banker", tags=["banker"])

llm = LLMService()
pm = PromptManager()
rp = ResponseParser()


class ManualCustomerRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    annual_income: Optional[float] = None
    dependents: Optional[int] = None
    risk_appetite: Optional[str] = None
    kyc_status: Optional[str] = None
    financial_goals: Optional[list[str]] = None
    notes: Optional[str] = None


def _canonical_payload(raw: dict, normalized: Optional[dict] = None) -> dict:
    merged = normalized or {}
    financial_goals = merged.get("financial_goals") or raw.get("financial_goals") or []
    if isinstance(financial_goals, str):
        financial_goals = [x.strip() for x in financial_goals.split(";") if x.strip()]
    return {
        "name": merged.get("name")
        or raw.get("name")
        or raw.get("customer_name")
        or raw.get("full_name"),
        "email": merged.get("email") or raw.get("email") or raw.get("customer_email"),
        "phone": merged.get("phone") or raw.get("phone") or raw.get("customer_phone"),
        "date_of_birth": merged.get("date_of_birth")
        or raw.get("date_of_birth")
        or raw.get("dob")
        or raw.get("customer_dob"),
        "annual_income": merged.get("annual_income") or raw.get("annual_income"),
        "dependents": merged.get("dependents") or raw.get("dependents"),
        "risk_appetite": merged.get("risk_appetite") or raw.get("risk_appetite"),
        "kyc_status": merged.get("kyc_status")
        or raw.get("kyc_status")
        or raw.get("kyc"),
        "financial_goals": financial_goals,
        "notes": merged.get("notes") or raw.get("notes"),
    }


def _heuristic_normalize(raw_row: dict) -> dict:
    payload = _canonical_payload(raw_row)
    return {k: v for k, v in payload.items() if v not in (None, "", [])}


async def _normalize_with_llm(raw_row: dict) -> dict:
    try:
        result = await asyncio.wait_for(
            llm.complete(pm.customer_intake_normalization(raw_row)),
            timeout=5,
        )
        parsed = rp.parse_json(result["response"])
        if isinstance(parsed, dict) and not parsed.get("parse_error"):
            return parsed
    except Exception:
        pass
    return _heuristic_normalize(raw_row)


async def _create_or_update_customer(
    db: AsyncSession,
    banker: User,
    raw_payload: dict,
    normalized_payload: Optional[dict] = None,
    *,
    source_type: str,
    source_filename: Optional[str] = None,
) -> dict:
    payload = _canonical_payload(raw_payload, normalized_payload)
    if not payload["name"] or not payload["email"]:
        raise HTTPException(
            status_code=400, detail="Each customer row needs at least name and email"
        )

    repo = UserRepository(db)
    existing = await repo.get_by_email(payload["email"])
    temp_password = None
    if existing:
        customer = existing
        customer.name = payload["name"] or customer.name
        customer.phone = payload["phone"] or customer.phone
        if customer.role != UserRole.CUSTOMER:
            customer.role = UserRole.CUSTOMER
    else:
        temp_password = secrets.token_urlsafe(8)
        customer = User(
            id=str(uuid.uuid4()),
            name=payload["name"],
            email=payload["email"],
            password_hash=get_password_hash(temp_password),
            role=UserRole.CUSTOMER,
            phone=payload["phone"],
        )
        db.add(customer)

    intake = CustomerIntakeRecord(
        id=str(uuid.uuid4()),
        banker_id=str(banker.id),
        user_id=str(customer.id),
        source_type=source_type,
        source_filename=source_filename,
        raw_payload=raw_payload,
        normalized_payload=payload,
        status="ACTIVE",
        notes=payload.get("notes"),
    )
    db.add(intake)
    await db.commit()
    await db.refresh(customer)
    await db.refresh(intake)

    if temp_password:
        subject, body = customer_invite_message(
            customer.name, customer.email, temp_password
        )
        await queue_and_send_email(
            db,
            customer.email,
            subject,
            body,
            recipient_id=customer.id,
            reference_type="CUSTOMER_INTAKE",
            reference_id=intake.id,
        )

    banker_subject = f"Customer intake recorded for {customer.name}"
    banker_body = f"<p>Customer <strong>{customer.name}</strong> ({customer.email}) was added via {source_type}.</p>"
    await queue_and_send_email(
        db,
        banker.email,
        banker_subject,
        banker_body,
        recipient_id=str(banker.id),
        reference_type="CUSTOMER_INTAKE",
        reference_id=intake.id,
    )

    return {
        "user_id": customer.id,
        "intake_id": intake.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "source_type": intake.source_type,
        "temporary_password": temp_password,
    }


async def _process_csv_import(file_bytes: bytes, filename: str, banker_id: str) -> None:
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return

    async with AsyncSessionLocal() as db:
        banker_repo = UserRepository(db)
        banker = await banker_repo.get_by_id(banker_id)
        if not banker:
            return

        for row in rows:
            normalized = await _normalize_with_llm(row)
            try:
                await _create_or_update_customer(
                    db,
                    banker,
                    row,
                    normalized_payload=normalized,
                    source_type="CSV",
                    source_filename=filename,
                )
            except Exception:
                continue


@router.post("/customers/manual")
async def create_customer_manual(
    body: ManualCustomerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("BANKER", "SUPER_ADMIN")),
):
    return await _create_or_update_customer(
        db,
        current_user,
        body.model_dump(),
        source_type="MANUAL",
    )


@router.post("/customers/import")
async def import_customers_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("BANKER", "SUPER_ADMIN")),
):
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    background_tasks.add_task(
        _process_csv_import,
        content,
        file.filename or "customers.csv",
        str(current_user.id),
    )

    return {
        "message": "Customer import queued",
        "processed": len(rows),
        "status": "QUEUED",
    }


@router.get("/customers")
async def list_customers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("BANKER", "SUPER_ADMIN")),
):
    q = select(CustomerIntakeRecord).order_by(CustomerIntakeRecord.created_at.desc())
    if current_user.role != UserRole.SUPER_ADMIN:
        q = q.where(CustomerIntakeRecord.banker_id == str(current_user.id))

    result = await db.execute(q)
    items = []
    user_repo = UserRepository(db)
    for intake in result.scalars().all():
        user = await user_repo.get_by_id(intake.user_id)
        if not user:
            continue
        items.append(
            {
                "intake_id": intake.id,
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role.value if hasattr(user.role, "value") else user.role,
                "source_type": intake.source_type,
                "status": intake.status,
                "source_filename": intake.source_filename,
                "normalized_payload": intake.normalized_payload,
                "created_at": (
                    intake.created_at.isoformat() if intake.created_at else None
                ),
            }
        )
    return {"customers": items}
