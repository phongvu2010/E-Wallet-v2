from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.account import Account, AccountStatusEnum
from app.schemas.account import (
    AccountCreate,
    AccountLiveBalanceRead,
    AccountOverviewRead,
    AccountUpdate,
)


class AccountService:
    """Service layer managing Credit Card Accounts and live balance calculations.

    Provides CRUD operations, status management (Active/Locked/Closed/Replaced),
    and real-time live balance audit queries mapped from database views.
    """

    @staticmethod
    async def get_all(
        db: AsyncSession,
        status_filter: Optional[AccountStatusEnum] = None,
    ) -> List[Account]:
        """Retrieve all credit accounts, optionally filtered by operational status.

        Args:
            db (AsyncSession): Active asynchronous database session.
            status_filter (Optional[AccountStatusEnum]): Optional status filter (ACTIVE, LOCKED, etc.).

        Returns:
            List[Account]: List of Account ORM instances eager-loaded with institution data.
        """
        query = select(Account).options(selectinload(Account.institution))
        if status_filter:
            query = query.where(Account.status == status_filter)
        query = query.order_by(Account.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, account_id: UUID) -> Account:
        """Retrieve a single credit card account by its primary UUID.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (UUID): Unique account identifier.

        Returns:
            Account: Account instance with associated institution.

        Raises:
            HTTPException: 404 Not Found if account doesn't exist.
        """
        query = (
            select(Account)
            .options(selectinload(Account.institution))
            .where(Account.id == account_id)
        )
        result = await db.execute(query)
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account with ID {account_id} not found",
            )
        return account

    @staticmethod
    async def create(db: AsyncSession, payload: AccountCreate) -> Account:
        """Register a new credit card account in the system.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (AccountCreate): Validated account creation parameters.

        Returns:
            Account: The newly persisted Account instance.

        Raises:
            HTTPException: 400 Bad Request on integrity violation or commit failure.
        """
        account = Account(**payload.model_dump())
        db.add(account)
        try:
            await db.commit()
            return await AccountService.get_by_id(db, account.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create account: {str(e)}",
            )

    @staticmethod
    async def update(
        db: AsyncSession, account_id: UUID, payload: AccountUpdate
    ) -> Account:
        """Update credit account parameters (e.g. credit limit, note, card name).

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (UUID): Identifier of account to update.
            payload (AccountUpdate): Field update set (excluding unset fields).

        Returns:
            Account: The updated Account instance.

        Raises:
            HTTPException: 400 Bad Request if update or commit fails.
        """
        account = await AccountService.get_by_id(db, account_id)
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(account, key, value)
        try:
            await db.commit()
            return await AccountService.get_by_id(db, account.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to update account: {str(e)}",
            )

    @staticmethod
    async def update_status(
        db: AsyncSession,
        account_id: UUID,
        new_status: AccountStatusEnum,
    ) -> Account:
        """Explicitly change the operational status of a credit card account.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (UUID): Identifier of target account.
            new_status (AccountStatusEnum): Target status (ACTIVE, LOCKED, CLOSED, REPLACED).

        Returns:
            Account: The account instance with modified status.

        Raises:
            HTTPException: 400 Bad Request on commit failure.
        """
        account = await AccountService.get_by_id(db, account_id)
        account.status = new_status
        try:
            await db.commit()
            return await AccountService.get_by_id(db, account.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to update account status: {str(e)}",
            )

    @staticmethod
    async def toggle_status(db: AsyncSession, account_id: UUID) -> Account:
        """Toggle account status between ACTIVE and LOCKED.

        Useful for quick temporary freeze/unfreeze actions from the dashboard.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (UUID): Identifier of target account.

        Returns:
            Account: The updated Account instance.

        Raises:
            HTTPException: 400 Bad Request if card is in non-toggleable state (CLOSED or REPLACED).
        """
        account = await AccountService.get_by_id(db, account_id)
        if account.status == AccountStatusEnum.ACTIVE:
            account.status = AccountStatusEnum.LOCKED
        elif account.status == AccountStatusEnum.LOCKED:
            account.status = AccountStatusEnum.ACTIVE
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot toggle status of card with status {account.status}",
            )
        try:
            await db.commit()
            return await AccountService.get_by_id(db, account.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to toggle account status: {str(e)}",
            )

    @staticmethod
    async def get_live_balances(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
    ) -> List[AccountLiveBalanceRead]:
        """Fetch real-time live balances and available limits from view `v_account_live_balance`.

        Formula:
            live_current_balance = latest_statement_balance
                                   + unbilled_spending
                                   - unbilled_payments
            live_available_limit = credit_limit - live_current_balance

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter for a single account.

        Returns:
            List[AccountLiveBalanceRead]: Real-time live balance breakdown for cards.
        """
        sql = "SELECT * FROM v_account_live_balance"
        params = {}
        if account_id:
            sql += " WHERE account_id = :account_id"
            params["account_id"] = str(account_id)
        sql += " ORDER BY status ASC, live_current_balance DESC"

        result = await db.execute(text(sql), params)
        rows = result.mappings().all()
        return [AccountLiveBalanceRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_overview(db: AsyncSession) -> List[AccountOverviewRead]:
        """Query account overview from `v_account_overview` including latest statement info.

        Args:
            db (AsyncSession): Active asynchronous database session.

        Returns:
            List[AccountOverviewRead]: Overview records with billed balance and cycle info.
        """
        sql = "SELECT * FROM v_account_overview ORDER BY account_name ASC"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [AccountOverviewRead(**dict(row)) for row in rows]
