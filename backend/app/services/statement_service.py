from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from fastapi import HTTPException, status

from app.models.statement import Statement
from app.schemas.statement import (
    StatementCreate,
    StatementReconciliationRead,
    StatementPaymentStatusRead,
)


class StatementService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
        year: Optional[int] = None,
    ) -> List[Statement]:
        query = select(Statement)
        if account_id:
            query = query.where(Statement.account_id == account_id)
        if year:
            query = query.where(text("EXTRACT(YEAR FROM statement_date) = :year")).params(year=year)
        query = query.order_by(Statement.statement_date.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, statement_id: UUID) -> Statement:
        result = await db.execute(select(Statement).where(Statement.id == statement_id))
        stmt = result.scalar_one_or_none()
        if not stmt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement with ID {statement_id} not found",
            )
        return stmt

    @staticmethod
    async def get_reconciliation(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
    ) -> List[StatementReconciliationRead]:
        sql = "SELECT * FROM v_statement_reconciliation"
        params = {}
        if account_id:
            sql += " WHERE statement_id IN (SELECT id FROM statements WHERE account_id = :account_id)"
            params["account_id"] = str(account_id)
        sql += " ORDER BY statement_date DESC;"

        result = await db.execute(text(sql), params)
        rows = result.mappings().all()
        return [StatementReconciliationRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_payment_status(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
    ) -> List[StatementPaymentStatusRead]:
        sql = "SELECT * FROM v_statement_payment_status"
        params = {}
        if account_id:
            sql += " WHERE account_id = :account_id"
            params["account_id"] = str(account_id)
        sql += " ORDER BY statement_date DESC;"

        result = await db.execute(text(sql), params)
        rows = result.mappings().all()
        return [StatementPaymentStatusRead(**dict(row)) for row in rows]

    @staticmethod
    async def create(db: AsyncSession, payload: StatementCreate) -> Statement:
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
