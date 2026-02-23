"""Authentication service layer."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.db import User
from app.models.schemas import TokenResponse, UserCreate, UserLogin


class AuthService:
    """Encapsulates auth use-cases."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def register(self, payload: UserCreate) -> User:
        """Register a new user account."""

        existing = self.db.query(User).filter(User.email == payload.email).first()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

        user = User(email=payload.email, password_hash=hash_password(payload.password))
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, payload: UserLogin) -> TokenResponse:
        """Authenticate user and return JWT token."""

        user = self.db.query(User).filter(User.email == payload.email).first()
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        token = create_access_token(subject=str(user.id))
        return TokenResponse(access_token=token)
