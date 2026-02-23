"""Pydantic schemas for requests and responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """User registration payload."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    """User login payload."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    """Public user profile."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class FinancialInput(BaseModel):
    """Base financial input for model calculation."""

    q: float
    price: float
    vc_percent: float
    fc: float
    interest: float
    tax_rate: float
    fx: Optional[float] = None
    vc_import: Optional[float] = None


class ScenarioInput(BaseModel):
    """Scenario type and parameters."""

    type: Literal["fx_growth", "demand_drop", "raw_material_growth", "custom"]
    params: Dict[str, float] = Field(default_factory=dict)


class FinancialResult(BaseModel):
    """Output of financial formulas."""

    revenue: float
    vc: float
    gp: float
    ebitda: float
    pbt: float
    tax: float
    net_profit: float
    ocf: float


class MetricDelta(BaseModel):
    """Comparison information for a metric."""

    base: float
    scenario: float
    delta_abs: float
    delta_percent: float
    risk: Literal["green", "yellow", "red"]


class ScenarioRunResult(BaseModel):
    """Scenario execution output with comparisons."""

    base_result: FinancialResult
    scenario_result: FinancialResult
    delta: Dict[str, MetricDelta]


class UploadResponse(BaseModel):
    """Upload endpoint response."""

    id: int
    filename: str
    uploaded_at: datetime
    parsed_json: FinancialInput


class ScenarioRunRequest(BaseModel):
    """Run scenario request payload."""

    upload_id: int
    name: str = Field(min_length=1, max_length=255)
    scenario: ScenarioInput


class ScenarioRunResponse(BaseModel):
    """Run scenario response payload."""

    scenario_id: int
    result_id: int
    result: ScenarioRunResult
    computed_at: datetime


class ScenarioResultResponse(BaseModel):
    """Stored scenario with result details."""

    scenario_id: int
    name: str
    parameters_json: Dict[str, Any]
    created_at: datetime
    result_id: int
    result: ScenarioRunResult
    computed_at: datetime


class ScenarioListItem(BaseModel):
    """Scenario list record."""

    scenario_id: int
    name: str
    created_at: datetime
    result_id: Optional[int] = None


class ScenarioListResponse(BaseModel):
    """Scenario list payload."""

    items: list[ScenarioListItem]
