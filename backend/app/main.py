"""FastAPI application bootstrap."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

from app.api.auth import router as auth_router
from app.api.scenario import router as scenario_router
from app.api.upload import router as upload_router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.exceptions import register_exception_handlers


def create_app() -> FastAPI:
    """Create and configure FastAPI app."""

    app = FastAPI(title=settings.app_name, version="1.0.0")

    if settings.https_redirect:
        app.add_middleware(HTTPSRedirectMiddleware)

    origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.on_event("startup")
    def startup() -> None:
        Base.metadata.create_all(bind=engine)

    app.include_router(auth_router)
    app.include_router(upload_router)
    app.include_router(scenario_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        """Container health endpoint."""

        return {"status": "ok"}

    return app


app = create_app()
