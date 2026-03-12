"""File upload and parsing service layer."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.calculations.engine import validate_financial_input
from app.models.db import Upload
from app.models.schemas import FinancialInput


class UploadService:
    """Handles upload parsing and persistence."""

    REQUIRED_COLUMNS = ("q", "price", "vc_percent", "fc", "interest", "tax_rate")
    COLUMN_LABELS = {
        "q": "q (объем продаж)",
        "price": "price (цена)",
        "vc_percent": "vc_percent (доля переменных затрат)",
        "fc": "fc (постоянные затраты)",
        "interest": "interest (процентные расходы)",
        "tax_rate": "tax_rate (ставка налога)",
    }

    def __init__(self, db: Session) -> None:
        self.db = db

    def _parse_file(self, filename: str, content: bytes) -> FinancialInput:
        """Parse CSV/JSON and map first row to FinancialInput."""

        suffix = Path(filename).suffix.lower()
        if suffix not in {".csv", ".json"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Поддерживаются только файлы CSV и JSON.",
            )

        if suffix == ".csv":
            frame = pd.read_csv(BytesIO(content))
        else:
            frame = pd.read_json(BytesIO(content))

        if frame.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Загруженный файл не содержит строк с данными.",
            )

        frame.columns = [str(col).strip().lower() for col in frame.columns]
        first = frame.iloc[0].to_dict()

        missing = [col for col in self.REQUIRED_COLUMNS if col not in first]
        if missing:
            missing_labels = [self.COLUMN_LABELS.get(col, col) for col in missing]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "В файле отсутствуют обязательные колонки: "
                    f"{', '.join(missing_labels)}. "
                    "Проверьте заголовки в первой строке файла."
                ),
            )

        payload = FinancialInput(
            q=float(first["q"]),
            price=float(first["price"]),
            vc_percent=float(first["vc_percent"]),
            fc=float(first["fc"]),
            interest=float(first["interest"]),
            tax_rate=float(first["tax_rate"]),
            fx=float(first["fx"]) if "fx" in first and pd.notna(first["fx"]) else None,
            vc_import=float(first["vc_import"]) if "vc_import" in first and pd.notna(first["vc_import"]) else None,
        )
        validate_financial_input(payload)
        return payload

    def upload(self, user_id: int, filename: str, content: bytes) -> Upload:
        """Persist upload record after successful parsing."""

        parsed = self._parse_file(filename=filename, content=content)
        upload = Upload(user_id=user_id, filename=filename, parsed_json=parsed.model_dump())
        self.db.add(upload)
        self.db.commit()
        self.db.refresh(upload)
        return upload
