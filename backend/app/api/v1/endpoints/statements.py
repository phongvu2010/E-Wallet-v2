from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.statement import (
    StatementRead,
    StatementCreate,
    StatementReconciliationRead,
    StatementPaymentStatusRead,
)
from app.services.statement_service import StatementService

router = APIRouter()


@router.get("", response_model=List[StatementRead], summary="List credit card statements")
async def list_statements(
    account_id: Optional[UUID] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    return await StatementService.get_all(db, account_id=account_id, year=year)


@router.get("/reconciliation", response_model=List[StatementReconciliationRead], summary="Get statement reconciliation report vs actual transactions")
async def get_reconciliation_report(
    account_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    return await StatementService.get_reconciliation(db, account_id=account_id)


@router.get("/payment-status", response_model=List[StatementPaymentStatusRead], summary="Get statement payment progress and overdue tracking")
async def get_payment_status(
    account_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    return await StatementService.get_payment_status(db, account_id=account_id)


@router.get("/{statement_id}", response_model=StatementRead, summary="Get statement by ID")
async def get_statement(statement_id: UUID, db: AsyncSession = Depends(get_db)):
    return await StatementService.get_by_id(db, statement_id=statement_id)


@router.post("", response_model=StatementRead, status_code=status.HTTP_201_CREATED, summary="Create statement record")
async def create_statement(payload: StatementCreate, db: AsyncSession = Depends(get_db)):
    return await StatementService.create(db, payload=payload)
