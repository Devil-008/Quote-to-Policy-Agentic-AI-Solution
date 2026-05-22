import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.security import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from backend.app.repositories.user_repository import UserRepository

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class RegisterRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str
    role:     str
    phone:    str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")

    payload = {"sub": user.id, "role": user.role.value if hasattr(user.role, 'value') else user.role}
    return {
        "access_token":  create_access_token(payload),
        "refresh_token": create_refresh_token(payload),
        "token_type":    "bearer",
        "user": {
            "id":    user.id,
            "name":  user.name,
            "email": user.email,
            "role":  user.role.value if hasattr(user.role, 'value') else user.role,
        },
    }


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    if await repo.get_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = await repo.create_user({
        "id":            str(uuid.uuid4()),
        "name":          body.name,
        "email":         body.email,
        "password_hash": get_password_hash(body.password),
        "role":          body.role,
        "phone":         body.phone,
    })
    return {"message": "Registered successfully", "user_id": user.id}


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    new_payload = {"sub": payload["sub"], "role": payload["role"]}
    return {
        "access_token":  create_access_token(new_payload),
        "refresh_token": create_refresh_token(new_payload),
        "token_type":    "bearer",
    }


@router.post("/logout")
async def logout():
    # Stateless JWT — client drops the token
    return {"message": "Logged out"}
