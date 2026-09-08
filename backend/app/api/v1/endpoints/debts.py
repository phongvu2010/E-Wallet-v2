from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.debt import DebtStatusEnum, DebtTypeEnum
from app.schemas.debt import (
    DebtCreate,
    DebtRead,
    DebtRepaymentCreate,
    DebtSummaryKPIs,
    DebtUpdate,
)
from app.services.debt_service import DebtService

router = APIRouter()


@router.get(
    "/kpis",
    response_model=DebtSummaryKPIs,
    summary="Get summary KPIs for personal borrowing and lending",
)
async def get_debt_summary_kpis(db: AsyncSession = Depends(get_db)):
    """Retrieve aggregate KPIs for personal debts: total borrowed, total lent, remaining balances, extra amounts paid/received."""
    return await DebtService.get_kpis(db)


@router.get(
    "",
    response_model=List[DebtRead],
    summary="List all personal debts",
)
async def get_all_debts(
    debt_type: Optional[DebtTypeEnum] = Query(default=None, description="Lọc theo loại: BORROW (Tôi đi vay) | LEND (Tôi cho vay)"),
    status: Optional[DebtStatusEnum] = Query(default=None, description="Lọc theo trạng thái: ACTIVE | PAID_OFF | CANCELLED"),
    search: Optional[str] = Query(default=None, description="Tìm kiếm theo tên người vay/cho vay"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all personal debts with full repayment history."""
    return await DebtService.get_all(db, debt_type=debt_type, status_filter=status, search=search)


@router.get(
    "/{debt_id}",
    response_model=DebtRead,
    summary="Get single debt details",
)
async def get_debt_by_id(
    debt_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetch details of a specific personal debt including all repayment records."""
    return await DebtService.get_by_id(db, debt_id=debt_id)


@router.post(
    "",
    response_model=DebtRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new personal debt / loan",
)
async def create_debt(
    payload: DebtCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new peer-to-peer loan (Borrowing or Lending), automatically recording the initial inflow/outflow transaction."""
    return await DebtService.create(db, payload=payload)


@router.put(
    "/{debt_id}",
    response_model=DebtRead,
    summary="Update debt metadata",
)
async def update_debt(
    debt_id: UUID,
    payload: DebtUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update metadata (counterparty name, due date, status, notes) of an existing debt."""
    return await DebtService.update(db, debt_id=debt_id, payload=payload)


@router.post(
    "/{debt_id}/repay",
    response_model=DebtRead,
    summary="Record a repayment or collection with optional appreciation tip",
)
async def record_debt_repayment(
    debt_id: UUID,
    payload: DebtRepaymentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record a partial or full repayment for a personal debt, cleanly isolating principal debt deduction from extra appreciation/tip expenses."""
    return await DebtService.record_repayment(db, debt_id=debt_id, payload=payload)


@router.delete(
    "/{debt_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a personal debt",
)
async def delete_debt(
    debt_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a personal debt and its associated repayment logs."""
    await DebtService.delete(db, debt_id=debt_id)
    return {"success": True, "message": "Khoản nợ đã được xóa thành công"}
