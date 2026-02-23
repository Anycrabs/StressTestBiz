"""Scenario engine orchestration and validation."""

from __future__ import annotations

from app.calculations.formulas import calculate_financials
from app.calculations.scenarios import apply_scenario
from app.core.exceptions import ValidationErrorException
from app.models.schemas import FinancialInput, FinancialResult, MetricDelta, ScenarioInput, ScenarioRunResult


def _risk_color(base_value: float, scenario_value: float, delta_percent: float) -> str:
    """Compute risk color by threshold rules."""

    if scenario_value < 0 or (base_value >= 0 > scenario_value):
        return "red"
    absolute = abs(delta_percent)
    if absolute <= 5.0:
        return "green"
    if absolute <= 15.0:
        return "yellow"
    return "red"


def validate_financial_input(fin_input: FinancialInput) -> None:
    """Validate financial constraints from specification."""

    revenue = fin_input.q * fin_input.price
    if revenue < 0:
        raise ValidationErrorException("revenue", "Revenue must be non-negative")
    if fin_input.vc_percent > 100:
        raise ValidationErrorException("vc_percent", "VC% cannot exceed 100")
    if fin_input.tax_rate > 100:
        raise ValidationErrorException("tax_rate", "TaxRate cannot exceed 100")
    if fin_input.vc_import is not None and not (0.0 <= fin_input.vc_import <= 1.0):
        raise ValidationErrorException("vc_import", "VCImport must be in [0,1]")


def _compare(base: FinancialResult, scenario: FinancialResult) -> dict[str, MetricDelta]:
    """Create metric-level comparison map."""

    result: dict[str, MetricDelta] = {}
    for metric_name in base.model_dump().keys():
        base_value = float(getattr(base, metric_name))
        scenario_value = float(getattr(scenario, metric_name))
        delta_abs = scenario_value - base_value
        delta_percent = (delta_abs / base_value) * 100.0 if base_value != 0 else 0.0
        result[metric_name] = MetricDelta(
            base=base_value,
            scenario=scenario_value,
            delta_abs=delta_abs,
            delta_percent=delta_percent,
            risk=_risk_color(base_value, scenario_value, delta_percent),
        )
    return result


def run_scenario(base: FinancialInput, scenario: ScenarioInput) -> ScenarioRunResult:
    """Run scenario pipeline.

    Algorithm:
    validate(input)
    base = calculate(input)
    scenario_input = apply_scenario(input, scenario)
    result = calculate(scenario_input)
    delta = compare(base, result)
    return response
    """

    base_input = base.model_copy(deep=True)
    validate_financial_input(base_input)

    base_result = calculate_financials(base_input)
    scenario_input = apply_scenario(base_input, base_result, scenario)
    validate_financial_input(scenario_input)
    scenario_result = calculate_financials(scenario_input)

    return ScenarioRunResult(
        base_result=base_result,
        scenario_result=scenario_result,
        delta=_compare(base_result, scenario_result),
    )
