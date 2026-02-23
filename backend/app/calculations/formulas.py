"""Pure formula calculations module."""

from __future__ import annotations

from app.models.schemas import FinancialInput, FinancialResult


def calculate_financials(fin_input: FinancialInput) -> FinancialResult:
    """Calculate metrics in strict top-down order.

    Order:
    Revenue -> VC -> GP -> EBITDA -> PBT -> Tax -> NP -> OCF
    """

    revenue = fin_input.q * fin_input.price
    vc = revenue * (fin_input.vc_percent / 100.0)
    gp = revenue - vc
    ebitda = gp - fin_input.fc
    pbt = ebitda - fin_input.interest
    tax = max(pbt, 0.0) * (fin_input.tax_rate / 100.0)
    net_profit = pbt - tax
    ocf = net_profit

    return FinancialResult(
        revenue=revenue,
        vc=vc,
        gp=gp,
        ebitda=ebitda,
        pbt=pbt,
        tax=tax,
        net_profit=net_profit,
        ocf=ocf,
    )
