from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import text
from fastapi import HTTPException, status

from backend.app.models.account import Account, AccountStatusEnum
from backend.app.schemas.account import (
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
        await db.commit()
        await db.refresh(account)
        return await AccountService.get_by_id(db, account.id)

    @staticmethod
    async def update(db: AsyncSession, account_id: UUID, payload: AccountUpdate) -> Account:
        account = await AccountService.get_by_id(db, account_id)
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(account, key, value)
        await db.commit()
        await db.refresh(account)
        return await AccountService.get_by_id(db, account.id)

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
