from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.institution import Institution
from app.schemas.institution import InstitutionCreate


class InstitutionService:
    """Service layer managing Financial Institutions and Card Issuing Banks."""

    @staticmethod
    async def get_all(db: AsyncSession) -> List[Institution]:
        """Fetch all financial institutions ordered by name alphabetically.

        Args:
            db (AsyncSession): Active asynchronous database session.

        Returns:
            List[Institution]: List of Institution instances.
        """
        result = await db.execute(select(Institution).order_by(Institution.name.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, institution_id: UUID) -> Institution:
        """Fetch an institution by primary UUID.

        Args:
            db (AsyncSession): Active asynchronous database session.
            institution_id (UUID): Unique institution identifier.

        Returns:
            Institution: Institution instance.

        Raises:
            HTTPException: 404 Not Found if institution does not exist.
        """
        result = await db.execute(
            select(Institution).where(Institution.id == institution_id)
        )
        inst = result.scalar_one_or_none()
        if not inst:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Institution with ID {institution_id} not found",
            )
        return inst

    @staticmethod
    async def create(db: AsyncSession, payload: InstitutionCreate) -> Institution:
        """Register a new financial institution / card issuer.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (InstitutionCreate): Validated institution payload (code, name, swift_code).

        Returns:
            Institution: The newly created Institution instance.

        Raises:
            HTTPException: 400 Bad Request on uniqueness violation or commit error.
        """
        inst = Institution(**payload.model_dump())
        db.add(inst)
        try:
            await db.commit()
            await db.refresh(inst)
            return inst
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating institution: {str(e)}",
            )
