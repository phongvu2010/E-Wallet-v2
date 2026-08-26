from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from backend.app.core.database import get_db
from backend.app.models.statement import Statement
from backend.app.schemas.statement import (
    StatementRead,
    StatementCreate,
    StatementReconciliationRead,
    StatementPaymentStatusRead,
)

router = APIRouter()


@router.get("", response_model=List[StatementRead], summary="List credit card statements")
async def list_statements(
    account_id: Optional[UUID] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Statement)
    if account_id:
        query = query.where(Statement.account_id == account_id)
    if year:
        query = query.where(text("EXTRACT(YEAR FROM statement_date) = :year")).params(year=year)
    query = query.order_by(Statement.statement_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/reconciliation", response_model=List[StatementReconciliationRead], summary="Get statement reconciliation report vs actual transactions")
async def get_reconciliation_report(
    account_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    sql = "SELECT * FROM v_statement_reconciliation"
    params = {}
    if account_id:
        sql += " WHERE statement_id IN (SELECT id FROM statements WHERE account_id = :account_id)"
        params["account_id"] = str(account_id)
    sql += " ORDER BY statement_date DESC;"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [StatementReconciliationRead(**dict(row)) for row in rows]


@router.get("/payment-status", response_model=List[StatementPaymentStatusRead], summary="Get statement payment progress and overdue tracking")
async def get_payment_status(
    account_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    sql = "SELECT * FROM v_statement_payment_status"
    params = {}
    if account_id:
        sql += " WHERE account_id = :account_id"
        params["account_id"] = str(account_id)
    sql += " ORDER BY statement_date DESC;"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [StatementPaymentStatusRead(**dict(row)) for row in rows]


@router.get("/{statement_id}", response_model=StatementRead, summary="Get statement by ID")
async def get_statement(statement_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Statement).where(Statement.id == statement_id))
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Statement with ID {statement_id} not found",
        )
    return stmt


@router.post("", response_model=StatementRead, status_code=status.HTTP_201_CREATED, summary="Create statement record")
async def create_statement(payload: StatementCreate, db: AsyncSession = Depends(get_db)):
    stmt = Statement(**payload.model_dump())
    db.add(stmt)
    try:
        await db.commit()
        await db.refresh(stmt)
        return stmt
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating statement: {str(e)}",
        )
