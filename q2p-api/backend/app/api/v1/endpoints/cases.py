"""cases.py — Case management endpoint"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_roles
from backend.app.models.all_models import Case, CaseStage, CaseStatus, User, UserRole

router = APIRouter(prefix="/cases", tags=["cases"])


class CreateCaseRequest(BaseModel):
    customer_id:      str
    customer_profile: dict
    sum_assured:      float
    premium_budget:   float
    policy_tenure:    int
    needs_analysis:   Optional[dict] = None


class BankerApproveRequest(BaseModel):
    remarks: Optional[str] = None


@router.post("/")
async def create_case(
    body: CreateCaseRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("BANKER", "SUPER_ADMIN")),
):
    case = Case(
        id=str(uuid.uuid4()),
        case_number=f"CASE-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        customer_id=body.customer_id,
        banker_id=str(current_user.id),
        customer_profile=body.customer_profile,
        sum_assured=body.sum_assured,
        premium_budget=body.premium_budget,
        policy_tenure=body.policy_tenure,
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return {"case_id": case.id, "case_number": case.case_number, "stage": case.current_stage}


@router.get("/")
async def list_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = current_user.role.value if hasattr(current_user.role, 'value') else current_user.role
    q = select(Case)
    if role == "BANKER":
        q = q.where(Case.banker_id == str(current_user.id))
    elif role == "CUSTOMER":
        q = q.where(Case.customer_id == str(current_user.id))
    result = await db.execute(q.order_by(Case.created_at.desc()))
    cases = result.scalars().all()
    return {"cases": [_s(c) for c in cases]}


@router.get("/{case_id}")
async def get_case(case_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = await db.execute(select(Case).where(Case.id == case_id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Case not found")
    return _s(c)


@router.post("/{case_id}/banker-approve")
async def banker_approve(
    case_id: str,
    body: BankerApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("BANKER", "SUPER_ADMIN")),
):
    await db.execute(update(Case).where(Case.id == case_id).values(
        banker_approved=1,
        banker_remarks=body.remarks,
        banker_approved_at=datetime.utcnow(),
        current_stage=CaseStage.OTP_CONSENT,
    ))
    await db.commit()
    return {"message": "Case approved", "next_stage": "OTP_CONSENT"}


def _s(c: Case) -> dict:
    return {
        "id": c.id, "case_number": c.case_number,
        "current_stage": c.current_stage.value if hasattr(c.current_stage, 'value') else c.current_stage,
        "status": c.status.value if hasattr(c.status, 'value') else c.status,
        "sum_assured": c.sum_assured, "premium_budget": c.premium_budget,
        "banker_approved": bool(c.banker_approved), "consent_given": bool(c.consent_given),
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "last_activity_at": c.last_activity_at.isoformat() if c.last_activity_at else None,
    }
