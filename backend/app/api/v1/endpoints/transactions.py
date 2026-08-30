from typing import Optional
from uuid import UUID
from math import ceil
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.transaction import TransactionTypeEnum
from app.schemas.transaction import (
    TransactionRead,
    TransactionCreate,
    TransactionUpdate,
    TransactionFilterParams,
    TransactionSummaryRead,
)
from app.schemas.common import PaginationParams, PaginatedResponse
from app.services.transaction_service import TransactionService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[TransactionRead], summary="List and filter transactions with pagination")
async def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    account_id: Optional[UUID] = None,
    statement_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    merchant_id: Optional[UUID] = None,
    transaction_type: Optional[TransactionTypeEnum] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    is_installment: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    filter_params = TransactionFilterParams(
        account_id=account_id,
        statement_id=statement_id,
        category_id=category_id,
        merchant_id=merchant_id,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date,
        min_amount=min_amount,
        max_amount=max_amount,
        is_installment=is_installment,
        search=search,
    )
    pagination = PaginationParams(page=page, page_size=page_size)
    items, total_count = await TransactionService.get_filtered(db, filter_params, pagination)

    total_pages = ceil(total_count / page_size) if page_size > 0 else 1

    return PaginatedResponse[TransactionRead](
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@router.get("/summary", response_model=TransactionSummaryRead, summary="Get summary of transactions (spending, repayments, fees)")
async def get_transactions_summary(
    account_id: Optional[UUID] = None,
    statement_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    return await TransactionService.get_summary(db, account_id, statement_id)


@router.get("/{transaction_id}", response_model=TransactionRead, summary="Get transaction by ID")
async def get_transaction(transaction_id: UUID, db: AsyncSession = Depends(get_db)):
    return await TransactionService.get_by_id(db, transaction_id)


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED, summary="Create a new transaction")
async def create_transaction(payload: TransactionCreate, db: AsyncSession = Depends(get_db)):
    return await TransactionService.create(db, payload)


@router.put("/{transaction_id}", response_model=TransactionRead, summary="Update transaction details")
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await TransactionService.update(db, transaction_id, payload)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete transaction")
async def delete_transaction(transaction_id: UUID, db: AsyncSession = Depends(get_db)):
    await TransactionService.delete(db, transaction_id)
    return None
