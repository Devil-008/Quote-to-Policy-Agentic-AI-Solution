import uuid, random, hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.all_models import OTPRecord, ConsentRecord, Case, User
from smtp.smtp_service import smtp_service
from configs.base import settings

router = APIRouter(prefix="/otp", tags=["otp"])


class SendOTPRequest(BaseModel):
    case_id: str


class VerifyOTPRequest(BaseModel):
    case_id:  str
    otp_code: str


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


@router.post("/send")
async def send_otp(
    body: SendOTPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Invalidate previous OTPs
    await db.execute(
        update(OTPRecord).where(
            OTPRecord.case_id == body.case_id,
            OTPRecord.status == "PENDING",
        ).values(status="INVALIDATED")
    )

    otp_code = f"{random.randint(100000, 999999)}"
    otp_hash = _hash_otp(otp_code)
    expires  = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    otp = OTPRecord(
        id=str(uuid.uuid4()),
        case_id=body.case_id,
        customer_id=str(current_user.id),
        otp_hash=otp_hash,
        expires_at=expires,
    )
    db.add(otp)
    await db.commit()

    # Get case number for email
    r = await db.execute(select(Case).where(Case.id == body.case_id))
    case = r.scalar_one_or_none()
    case_number = case.case_number if case else body.case_id

    await smtp_service.send_otp(current_user.email, otp_code, case_number)
    return {"message": "OTP sent", "expires_in_minutes": settings.OTP_EXPIRY_MINUTES}


@router.post("/verify")
async def verify_otp(
    body: VerifyOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(
        select(OTPRecord).where(
            OTPRecord.case_id == body.case_id,
            OTPRecord.customer_id == str(current_user.id),
            OTPRecord.status == "PENDING",
        ).order_by(OTPRecord.created_at.desc())
    )
    otp_record = r.scalars().first()
    if not otp_record:
        raise HTTPException(400, "No pending OTP found")

    if datetime.utcnow() > otp_record.expires_at:
        await db.execute(update(OTPRecord).where(OTPRecord.id == otp_record.id).values(status="EXPIRED"))
        await db.commit()
        raise HTTPException(400, "OTP has expired")

    if otp_record.retry_count >= settings.OTP_MAX_RETRY:
        await db.execute(update(OTPRecord).where(OTPRecord.id == otp_record.id).values(status="INVALIDATED"))
        await db.commit()
        raise HTTPException(400, "Maximum retry attempts exceeded")

    if _hash_otp(body.otp_code) != otp_record.otp_hash:
        await db.execute(update(OTPRecord).where(OTPRecord.id == otp_record.id).values(
            retry_count=otp_record.retry_count + 1
        ))
        await db.commit()
        raise HTTPException(400, f"Invalid OTP. {settings.OTP_MAX_RETRY - otp_record.retry_count - 1} attempts left")

    # OTP verified
    await db.execute(update(OTPRecord).where(OTPRecord.id == otp_record.id).values(
        status="VERIFIED", verified_at=datetime.utcnow()
    ))

    # Create consent record
    consent = ConsentRecord(
        id=str(uuid.uuid4()),
        case_id=body.case_id,
        customer_id=str(current_user.id),
        otp_record_id=otp_record.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(consent)

    # Advance case stage
    await db.execute(update(Case).where(Case.id == body.case_id).values(
        consent_given=1,
        consent_given_at=datetime.utcnow(),
        current_stage="PROPOSAL_GENERATION",
    ))
    await db.commit()
    return {"message": "OTP verified. Consent recorded.", "next_stage": "PROPOSAL_GENERATION"}
