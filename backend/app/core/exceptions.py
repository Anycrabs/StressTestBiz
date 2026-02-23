"""Domain exceptions and FastAPI exception handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ValidationErrorException(Exception):
    """Custom validation exception for financial input rules."""

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        self.message = message
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach project-level exception handlers to FastAPI app."""

    @app.exception_handler(ValidationErrorException)
    async def validation_exception_handler(_: Request, exc: ValidationErrorException) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": "ValidationError",
                "field": exc.field,
                "message": exc.message,
            },
        )
