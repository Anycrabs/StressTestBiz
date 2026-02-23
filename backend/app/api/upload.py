"""Upload API route."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.db import User
from app.models.schemas import FinancialInput, UploadResponse
from app.services.upload_service import UploadService

router = APIRouter(tags=["upload"])


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    """Upload and parse financial input file."""

    content = await file.read()
    upload = UploadService(db).upload(
        user_id=current_user.id,
        filename=file.filename or "uploaded_file",
        content=content,
    )

    return UploadResponse(
        id=upload.id,
        filename=upload.filename,
        uploaded_at=upload.uploaded_at,
        parsed_json=FinancialInput.model_validate(upload.parsed_json),
    )
