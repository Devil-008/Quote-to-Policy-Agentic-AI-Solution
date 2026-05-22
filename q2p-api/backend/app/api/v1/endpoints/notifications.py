"""
Notifications endpoint — list and manage notification logs.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.security import require_roles
from ..models.user import User, UserRole
from ..repositories.quote_policy_otp_repository import NotificationRepository

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/pending")
async def pending_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN)),
):
    repo = NotificationRepository(db)
    items = await repo.list_pending()
    return {"notifications": [_serialize(n) for n in items]}


@router.post("/{notification_id}/mark-sent")
async def mark_sent(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
):
    repo = NotificationRepository(db)
    await repo.mark_sent(notification_id)
    return {"message": "Notification marked as sent"}


def _serialize(n) -> dict:
    return {
        "id": n.id,
        "recipient_email": n.recipient_email,
        "subject": n.subject,
        "notification_type": n.notification_type,
        "reference_type": n.reference_type,
        "reference_id": n.reference_id,
        "status": n.status,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "sent_at": n.sent_at.isoformat() if n.sent_at else None,
    }
