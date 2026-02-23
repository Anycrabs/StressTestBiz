"""Scenario API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.db import User
from app.models.schemas import ScenarioListItem, ScenarioListResponse, ScenarioResultResponse, ScenarioRunRequest, ScenarioRunResponse, ScenarioRunResult
from app.services.scenario_service import ScenarioService

router = APIRouter(prefix="/scenario", tags=["scenario"])


@router.post("/run", response_model=ScenarioRunResponse)
def run_scenario_route(
    payload: ScenarioRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScenarioRunResponse:
    """Run a scenario synchronously and store result."""

    scenario, result, scenario_result = ScenarioService(db).run(user_id=current_user.id, payload=payload)
    return ScenarioRunResponse(
        scenario_id=scenario.id,
        result_id=result.id,
        result=scenario_result,
        computed_at=result.computed_at,
    )


@router.get("/result/{scenario_id}", response_model=ScenarioResultResponse)
def scenario_result(
    scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScenarioResultResponse:
    """Get stored scenario result by scenario id."""

    scenario, result = ScenarioService(db).get_result(user_id=current_user.id, scenario_id=scenario_id)
    return ScenarioResultResponse(
        scenario_id=scenario.id,
        name=scenario.name,
        parameters_json=scenario.parameters_json,
        created_at=scenario.created_at,
        result_id=result.id,
        result=ScenarioRunResult.model_validate(result.result_json),
        computed_at=result.computed_at,
    )


@router.get("/list", response_model=ScenarioListResponse)
def scenario_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScenarioListResponse:
    """List scenarios for current user."""

    scenarios = ScenarioService(db).list_scenarios(user_id=current_user.id)
    items = [
        ScenarioListItem(
            scenario_id=scenario.id,
            name=scenario.name,
            created_at=scenario.created_at,
            result_id=scenario.result.id if scenario.result else None,
        )
        for scenario in scenarios
    ]
    return ScenarioListResponse(items=items)
