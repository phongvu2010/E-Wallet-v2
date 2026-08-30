from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status

from app.models.institution import Institution
from app.schemas.institution import InstitutionCreate


class InstitutionService:
    @staticmethod
    async def get_all(db: AsyncSession) -> List[Institution]:
        result = await db.execute(select(Institution).order_by(Institution.name.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, institution_id: UUID) -> Institution:
        result = await db.execute(select(Institution).where(Institution.id == institution_id))
        inst = result.scalar_one_or_none()
        if not inst:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Institution with ID {institution_id} not found",
            )
        return inst

    @staticmethod
    async def create(db: AsyncSession, payload: InstitutionCreate) -> Institution:
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
