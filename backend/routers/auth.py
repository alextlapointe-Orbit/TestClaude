from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserResponse)
async def register(payload: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await auth_utils.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=auth_utils.get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=schemas.TokenResponse)
async def login(payload: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_utils.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token = auth_utils.create_access_token({"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user


@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_admin),
):
    result = await db.execute(select(models.User).order_by(models.User.created_at.desc()))
    return result.scalars().all()
