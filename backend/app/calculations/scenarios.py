"""Scenario input transformation logic."""

from __future__ import annotations

from app.core.exceptions import ValidationErrorException
from app.models.schemas import FinancialInput, FinancialResult, ScenarioInput


def apply_scenario(base_input: FinancialInput, base_result: FinancialResult, scenario: ScenarioInput) -> FinancialInput:
    """Apply scenario changes to base input without mutating source."""

    scenario_input = base_input.model_copy(deep=True)
    params = scenario.params

    if scenario.type == "fx_growth":
        scenario_fx = float(params.get("scenario_fx", scenario_input.fx or 0.0))
        base_fx = float(scenario_input.fx or 0.0)
        vc_import = float(scenario_input.vc_import or 0.0)
        if base_fx <= 0:
            raise ValidationErrorException("fx", "Base FX must be greater than 0 for FX Growth scenario")

        vc_scenario = base_result.vc * ((1.0 - vc_import) + vc_import * scenario_fx / base_fx)
        scenario_input.vc_percent = (vc_scenario / base_result.revenue) * 100.0 if base_result.revenue != 0 else 0.0
        scenario_input.fx = scenario_fx

    elif scenario.type == "demand_drop":
        scenario_input.q = float(params.get("q", scenario_input.q))

    elif scenario.type == "raw_material_growth":
        scenario_input.vc_percent = float(params.get("vc_percent", scenario_input.vc_percent))

    elif scenario.type == "custom":
        allowed = ("q", "price", "vc_percent", "fx", "fc")
        for key in allowed:
            if key in params:
                setattr(scenario_input, key, float(params[key]))

    return scenario_input
