from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.statement import Statement
from app.schemas.statement import (
    StatementCreate,
    StatementPaymentStatusRead,
    StatementReconciliationRead,
)


class StatementService:
    """Service layer managing Bank Statements, Payment Tracking, and 3-Way Reconciliation.

    Coordinates with database views:
    - `v_statement_payment_status`: Tracks repayments settled against billed statements.
    - `v_statement_reconciliation`: Performs 3-way audit between bank billed balances and ledger math.
    """

    @staticmethod
    async def get_all(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
        year: Optional[int] = None,
    ) -> List[Statement]:
        """Retrieve all credit card statements, optionally filtered by card or statement year.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter for a specific card account.
            year (Optional[int]): Optional calendar year filter.

        Returns:
            List[Statement]: List of Statement ORM instances ordered by statement date descending.
        """
        query = select(Statement)
        if account_id:
            query = query.where(Statement.account_id == account_id)
        if year:
            query = query.where(
                text("EXTRACT(YEAR FROM statement_date) = :year")
            ).params(year=year)
        query = query.order_by(Statement.statement_date.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, statement_id: UUID) -> Statement:
        """Fetch a single statement by primary identifier.

        Args:
            db (AsyncSession): Active asynchronous database session.
            statement_id (UUID): Unique statement identifier.

        Returns:
            Statement: The requested Statement instance.

        Raises:
            HTTPException: 404 Not Found if statement is missing.
        """
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
        """Audit 3-way statement reconciliation using database view `v_statement_reconciliation`.

        Formula:
            expected_statement_balance = previous_balance
                                         + (purchases_amount + installments_amount)
                                         - payments_received
            discrepancy = billed_statement_balance - expected_statement_balance
            status = 'MATCHED' if discrepancy == 0 else 'DISCREPANCY'

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter by account.

        Returns:
            List[StatementReconciliationRead]: Statement reconciliation audit records.
        """
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
        """Fetch statement repayment progress and overdue status from `v_statement_payment_status`.

        Calculates:
        - total_paid_amount: Total repayments made before the payment due date.
        - remaining_balance_to_pay: billed_amount - total_paid_amount.
        - payment_status: UNPAID, PARTIALLY_PAID, PAID, or OVERDUE.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter by account.

        Returns:
            List[StatementPaymentStatusRead]: Payment statuses ordered by statement date descending.
        """
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
        """Persist a newly closed bank statement record.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (StatementCreate): Validated statement payload.

        Returns:
            Statement: The newly created Statement instance.

        Raises:
            HTTPException: 400 Bad Request on database conflict or error.
        """
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
