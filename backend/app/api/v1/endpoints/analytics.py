from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.analytics import (
    MonthlyCategorySpendingRead,
    CreditUtilizationRead,
    UpcomingObligationRead,
    DashboardOverviewRead,
)
from backend.app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("/overview", response_model=DashboardOverviewRead, summary="Get full dashboard financial overview")
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    return await AnalyticsService.get_dashboard_overview(db)


@router.get("/monthly-spending", response_model=List[MonthlyCategorySpendingRead], summary="Get monthly spending grouped by category")
async def get_monthly_spending(
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService.get_monthly_spending(db, limit=limit)


@router.get("/credit-utilization", response_model=List[CreditUtilizationRead], summary="Get credit limit utilization and risk assessment")
async def get_credit_utilization(db: AsyncSession = Depends(get_db)):
    return await AnalyticsService.get_credit_utilization(db)


@router.get("/upcoming-obligations", response_model=List[UpcomingObligationRead], summary="Get upcoming payment obligations (Statements + Installments)")
async def get_upcoming_obligations(
    days_ahead: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    return await AnalyticsService.get_upcoming_obligations(db, days_ahead=days_ahead)
