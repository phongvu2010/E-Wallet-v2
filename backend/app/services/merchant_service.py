from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.merchant import Merchant, MerchantAlias
from app.schemas.merchant import (
    MerchantAliasCreate,
    MerchantCreate,
)


class MerchantService:
    """Service layer managing Normalized Merchants and Alias Pattern Mapping for raw transaction matching."""

    @staticmethod
    async def get_all(
        db: AsyncSession,
        search: Optional[str] = None,
    ) -> List[Merchant]:
        """Fetch all recognized merchants with their aliases, optionally matching a search term.

        Args:
            db (AsyncSession): Active asynchronous database session.
            search (Optional[str]): Optional keyword filter for merchant cleaned name.

        Returns:
            List[Merchant]: List of Merchant instances ordered by name.
        """
        query = select(Merchant).options(selectinload(Merchant.aliases))
        if search:
            query = query.where(Merchant.cleaned_name.ilike(f"%{search}%"))
        query = query.order_by(Merchant.cleaned_name.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, merchant_id: UUID) -> Merchant:
        """Retrieve a single merchant entity by UUID.

        Args:
            db (AsyncSession): Active asynchronous database session.
            merchant_id (UUID): Primary merchant identifier.

        Returns:
            Merchant: Merchant entity with loaded aliases.

        Raises:
            HTTPException: 404 Not Found if merchant does not exist.
        """
        query = (
            select(Merchant)
            .options(selectinload(Merchant.aliases))
            .where(Merchant.id == merchant_id)
        )
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
        """Register a new cleaned merchant entity.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (MerchantCreate): Validated merchant creation payload.

        Returns:
            Merchant: The newly created Merchant instance.

        Raises:
            HTTPException: 400 Bad Request on integrity violation.
        """
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
    async def create_alias(
        db: AsyncSession, payload: MerchantAliasCreate
    ) -> MerchantAlias:
        """Map a raw string pattern / alias to a normalized merchant entity.

        Used by transaction ingestion pipelines to automatically associate raw POS/Statement
        descriptions with a standardized merchant.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (MerchantAliasCreate): Alias mapping configuration.

        Returns:
            MerchantAlias: The newly created MerchantAlias instance.

        Raises:
            HTTPException: 400 Bad Request on error.
        """
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
