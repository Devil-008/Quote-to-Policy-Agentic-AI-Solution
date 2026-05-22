import uuid, os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_roles
from backend.app.models.all_models import MedicalRequest, MedicalDocument, User
from configs.base import settings

router = APIRouter(prefix="/medical", tags=["medical"])


class CreateMedicalReqBody(BaseModel):
    case_id: str; customer_id: str; requirements: List[str]


@router.post("/")
async def create_medical_req(body: CreateMedicalReqBody, db: AsyncSession = Depends(get_db),
                              current_user=Depends(require_roles("OPS_ADMIN", "SUPER_ADMIN"))):
    req = MedicalRequest(id=str(uuid.uuid4()), case_id=body.case_id,
                          customer_id=body.customer_id, requirements=body.requirements)
    db.add(req); await db.commit(); await db.refresh(req)
    return {"id": req.id, "message": "Medical request created"}


@router.get("/queue")
async def medical_queue(db: AsyncSession = Depends(get_db),
                         current_user=Depends(require_roles("OPS_ADMIN", "SUPER_ADMIN"))):
    r = await db.execute(select(MedicalRequest).where(MedicalRequest.status == "PENDING").order_by(MedicalRequest.created_at))
    reqs = r.scalars().all()
    return {"queue": [{"id": q.id, "case_id": q.case_id, "requirements": q.requirements,
                        "created_at": q.created_at.isoformat() if q.created_at else None} for q in reqs]}


@router.post("/upload")
async def upload_medical_doc(
    file: UploadFile = File(...),
    medical_request_id: str = Form(...),
    document_type: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    os.makedirs(settings.FILE_UPLOAD_PATH, exist_ok=True)
    doc_id    = str(uuid.uuid4())
    save_path = os.path.join(settings.FILE_UPLOAD_PATH, f"med_{doc_id}_{file.filename}")
    content   = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    doc = MedicalDocument(
        id=doc_id, medical_request_id=medical_request_id, customer_id=str(current_user.id),
        document_type=document_type, file_name=file.filename, file_path=save_path,
        file_size=len(content), mime_type=file.content_type,
    )
    db.add(doc); await db.commit()
    return {"message": "Document uploaded", "doc_id": doc_id}


@router.patch("/{req_id}/complete")
async def complete_medical(req_id: str, db: AsyncSession = Depends(get_db),
                            current_user=Depends(require_roles("OPS_ADMIN", "SUPER_ADMIN"))):
    await db.execute(update(MedicalRequest).where(MedicalRequest.id == req_id).values(
        status="COMPLETED", reviewed_by=str(current_user.id), reviewed_at=datetime.utcnow()
    ))
    await db.commit()
    return {"message": "Medical request completed"}
