"""
quotes.py
"""

import uuid, asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_roles
from backend.app.models.all_models import Case, Quote, User
from agents.insurer_agents import fetch_all_quotes
from llm.llm_service import LLMService
from llm.prompt_manager import PromptManager
from llm.response_parser import ResponseParser
from backend.app.services.notification_service import (
    queue_and_send_email,
    stage_message,
)

router = APIRouter(prefix="/quotes", tags=["quotes"])
llm, pm, rp = LLMService(), PromptManager(), ResponseParser()


@router.post("/case/{case_id}/fetch")
async def fetch_quotes(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("BANKER", "SUPER_ADMIN")),
):
    r = await db.execute(select(Case).where(Case.id == case_id))
    case = r.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "Case not found")

    raw_quotes = await fetch_all_quotes(
        {
            "sum_assured": case.sum_assured or 1_000_000,
            "premium_budget": case.premium_budget or 50_000,
            "policy_tenure": case.policy_tenure or 20,
            "customer_profile": case.customer_profile or {},
        }
    )

    prompt = pm.quote_comparison(raw_quotes, case.needs_analysis or {})
    llm_res = await llm.complete(prompt)
    ai_text = llm_res["response"]

    saved = []
    for i, q in enumerate(raw_quotes):
        obj = Quote(
            id=str(uuid.uuid4()),
            case_id=case_id,
            insurer_code=q["insurer_code"],
            insurer_name=q["insurer_name"],
            product_name=q["product_name"],
            product_code=q["product_code"],
            annual_premium=q["annual_premium"],
            sum_assured=q["sum_assured"],
            policy_tenure=q["policy_tenure"],
            premium_frequency=q["premium_frequency"],
            coverage_details=q.get("coverage_details"),
            riders=q.get("riders"),
            exclusions=q.get("exclusions"),
            underwriting_requirements=q.get("underwriting_requirements"),
            ai_rank=i + 1,
            ai_score=q.get("score", 0.0),
            ai_recommendation_text=ai_text if i == 0 else None,
            raw_response=q["raw_response"],
        )
        db.add(obj)
        saved.append(obj)

    await db.execute(
        update(Case).where(Case.id == case_id).values(current_stage="QUOTE_COMPARISON")
    )
    await db.commit()

    banker = await db.get(User, case.banker_id)
    if banker:
        subject, body = stage_message(
            case.case_number,
            "QUOTE_COMPARISON",
            "Quotes are ready for review and comparison.",
        )
        await queue_and_send_email(
            db,
            banker.email,
            subject,
            body,
            recipient_id=banker.id,
            reference_type="CASE",
            reference_id=case_id,
        )
    return {
        "message": "Quotes fetched",
        "count": len(saved),
        "quotes": [
            {
                "id": q.id,
                "insurer_name": q.insurer_name,
                "annual_premium": q.annual_premium,
                "ai_rank": q.ai_rank,
            }
            for q in saved
        ],
    }


@router.get("/case/{case_id}")
async def list_quotes(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(Quote).where(Quote.case_id == case_id).order_by(Quote.ai_rank)
    )
    quotes = r.scalars().all()
    return {
        "quotes": [
            {
                "id": q.id,
                "insurer_name": q.insurer_name,
                "product_name": q.product_name,
                "annual_premium": q.annual_premium,
                "sum_assured": q.sum_assured,
                "policy_tenure": q.policy_tenure,
                "ai_rank": q.ai_rank,
                "ai_score": q.ai_score,
                "coverage_details": q.coverage_details,
                "riders": q.riders,
                "ai_recommendation_text": q.ai_recommendation_text,
            }
            for q in quotes
        ]
    }
