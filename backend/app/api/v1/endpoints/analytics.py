from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.analytics import (
    CreditUtilizationRead,
    DashboardOverviewRead,
    MonthlyCashFlowRead,
    MonthlyCategorySpendingRead,
    NetWorthOverviewRead,
    UpcomingObligationRead,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get(
    "/overview",
    response_model=DashboardOverviewRead,
    summary="Get full dashboard financial overview",
)
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    """Fetch high-level portfolio overview: total limits, live balances, utilization %, risk grade, and upcoming dues."""
    return await AnalyticsService.get_dashboard_overview(db)


@router.get(
    "/net-worth",
    response_model=NetWorthOverviewRead,
    summary="Get net worth and wealth breakdown",
)
async def get_net_worth_overview(db: AsyncSession = Depends(get_db)):
    """Fetch total liquid assets, credit liabilities, and net worth wealth distribution."""
    return await AnalyticsService.get_net_worth_overview(db)


@router.get(
    "/cash-flow",
    response_model=List[MonthlyCashFlowRead],
    summary="Get monthly cash flow (Income vs Expenses vs Savings)",
)
async def get_monthly_cash_flow(
    limit: int = Query(default=12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve monthly historical cash flow comparing income, expenses, and savings rate."""
    return await AnalyticsService.get_monthly_cash_flow(db, limit=limit)


@router.get(
    "/monthly-spending",
    response_model=List[MonthlyCategorySpendingRead],
    summary="Get monthly spending grouped by category",
)
async def get_monthly_spending(
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve historical category spending trends with refund and fee adjustments applied."""
    return await AnalyticsService.get_monthly_spending(db, limit=limit)


@router.get(
    "/credit-utilization",
    response_model=List[CreditUtilizationRead],
    summary="Get credit limit utilization and risk assessment",
)
async def get_credit_utilization(db: AsyncSession = Depends(get_db)):
    """Fetch credit limit utilization percentages across all cards and evaluate risk level against standard thresholds."""
    return await AnalyticsService.get_credit_utilization(db)


@router.get(
    "/upcoming-obligations",
    response_model=List[UpcomingObligationRead],
    summary="Get upcoming payment obligations (Statements + Installments)",
)
async def get_upcoming_obligations(
    days_ahead: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    """Fetch upcoming payment deadlines across billed statements and installment schedules within a specified days window."""
    return await AnalyticsService.get_upcoming_obligations(db, days_ahead=days_ahead)
