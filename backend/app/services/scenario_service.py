"""Scenario execution and result retrieval service layer."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.calculations.engine import run_scenario
from app.models.db import Result, Scenario, Upload
from app.models.schemas import FinancialInput, ScenarioInput, ScenarioRunRequest, ScenarioRunResult


class ScenarioService:
    """Handles scenario run/list/result use-cases."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def run(self, user_id: int, payload: ScenarioRunRequest) -> tuple[Scenario, Result, ScenarioRunResult]:
        """Run scenario from uploaded base input and persist result."""

        upload = self.db.query(Upload).filter(Upload.id == payload.upload_id, Upload.user_id == user_id).first()
        if upload is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")

        base_input = FinancialInput.model_validate(upload.parsed_json)
        scenario_input = ScenarioInput.model_validate(payload.scenario.model_dump())
        scenario_result = run_scenario(base=base_input, scenario=scenario_input)

        scenario = Scenario(
            user_id=user_id,
            name=payload.name,
            parameters_json=scenario_input.model_dump(),
        )
        self.db.add(scenario)
        self.db.flush()

        result = Result(
            scenario_id=scenario.id,
            result_json=scenario_result.model_dump(),
        )
        self.db.add(result)
        self.db.commit()
        self.db.refresh(scenario)
        self.db.refresh(result)

        return scenario, result, scenario_result

    def get_result(self, user_id: int, scenario_id: int) -> tuple[Scenario, Result]:
        """Retrieve single scenario result by scenario id."""

        scenario = self.db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.user_id == user_id).first()
        if scenario is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")

        result = self.db.query(Result).filter(Result.scenario_id == scenario.id).first()
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")

        return scenario, result

    def list_scenarios(self, user_id: int) -> list[Scenario]:
        """List user scenarios newest first."""

        return (
            self.db.query(Scenario)
            .filter(Scenario.user_id == user_id)
            .order_by(Scenario.created_at.desc())
            .all()
        )
