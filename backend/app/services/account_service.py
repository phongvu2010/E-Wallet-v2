from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import text
from fastapi import HTTPException, status

from app.models.account import Account, AccountStatusEnum
from app.schemas.account import (
    AccountCreate,
    AccountUpdate,
    AccountLiveBalanceRead,
    AccountOverviewRead,
)


class AccountService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        status_filter: Optional[AccountStatusEnum] = None,
    ) -> List[Account]:
        query = select(Account).options(selectinload(Account.institution))
        if status_filter:
            query = query.where(Account.status == status_filter)
        query = query.order_by(Account.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, account_id: UUID) -> Account:
        query = select(Account).options(selectinload(Account.institution)).where(Account.id == account_id)
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
    async def update(db: AsyncSession, account_id: UUID, payload: AccountUpdate) -> Account:
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
        sql = "SELECT * FROM v_account_overview ORDER BY account_name ASC"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [AccountOverviewRead(**dict(row)) for row in rows]
