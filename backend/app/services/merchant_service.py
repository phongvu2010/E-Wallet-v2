from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.merchant import Merchant, MerchantAlias
from app.schemas.merchant import (
    MerchantCreate,
    MerchantAliasCreate,
)


class MerchantService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        search: Optional[str] = None,
    ) -> List[Merchant]:
        query = select(Merchant).options(selectinload(Merchant.aliases))
        if search:
            query = query.where(Merchant.cleaned_name.ilike(f"%{search}%"))
        query = query.order_by(Merchant.cleaned_name.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, merchant_id: UUID) -> Merchant:
        query = select(Merchant).options(selectinload(Merchant.aliases)).where(Merchant.id == merchant_id)
        result = await db.execute(query)
        m = result.scalar_one_or_none()
        if not m:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Merchant with ID {merchant_id} not found",
            )
        return m

    @staticmethod
    async def create(db: AsyncSession, payload: MerchantCreate) -> Merchant:
        m = Merchant(**payload.model_dump())
        db.add(m)
        try:
            await db.commit()
            await db.refresh(m)
            return await MerchantService.get_by_id(db, m.id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating merchant: {str(e)}",
            )

    @staticmethod
    async def create_alias(db: AsyncSession, payload: MerchantAliasCreate) -> MerchantAlias:
        alias = MerchantAlias(**payload.model_dump())
        db.add(alias)
        try:
            await db.commit()
            await db.refresh(alias)
            return alias
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating alias: {str(e)}",
            )
