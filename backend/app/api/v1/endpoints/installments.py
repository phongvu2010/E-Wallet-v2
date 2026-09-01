from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.installment import InstallmentStatusEnum
from app.schemas.installment import (
    EarlySettleRequest,
    EarlySettleResponse,
    InstallmentForecastRead,
    InstallmentPlanCreate,
    InstallmentPlanRead,
)
from app.services.installment_service import InstallmentService

router = APIRouter()


@router.get(
    "", response_model=List[InstallmentPlanRead], summary="List installment plans"
)
async def list_installment_plans(
    account_id: Optional[UUID] = None,
    status: Optional[InstallmentStatusEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all installment plans with their schedules and merchant metadata, filtered by card or status."""
    return await InstallmentService.get_all(
        db, account_id=account_id, status_filter=status
    )


@router.get(
    "/forecast",
    response_model=List[InstallmentForecastRead],
    summary="Get installment monthly cash flow forecast",
)
async def get_installment_forecast(db: AsyncSession = Depends(get_db)):
    """Fetch future month-by-month cashflow forecast for installment principal and recurring fees."""
    return await InstallmentService.get_forecast(db)


@router.get(
    "/{plan_id}",
    response_model=InstallmentPlanRead,
    summary="Get installment plan details and schedules",
)
async def get_installment_plan(plan_id: UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve full details of a specific installment plan and all periodic amortization schedules."""
    return await InstallmentService.get_by_id(db, plan_id)


@router.post(
    "",
    response_model=InstallmentPlanRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new installment plan",
)
async def create_installment_plan(
    payload: InstallmentPlanCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register an installment conversion and automatically generate its monthly repayment schedules."""
    return await InstallmentService.create(db, payload)


@router.post(
    "/{plan_id}/early-settle",
    response_model=EarlySettleResponse,
    summary="Early settle an installment plan (execute DB function)",
)
async def early_settle_plan(
    plan_id: UUID,
    payload: EarlySettleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute automated early settlement by calling PostgreSQL stored function `fn_early_settle_installment_plan`."""
    return await InstallmentService.early_settle(db, plan_id, payload)
