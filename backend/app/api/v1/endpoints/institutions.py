from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.institution import Institution
from app.schemas.institution import InstitutionRead, InstitutionCreate

router = APIRouter()


@router.get("", response_model=List[InstitutionRead], summary="List all financial institutions")
async def list_institutions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Institution).order_by(Institution.name.asc()))
    return result.scalars().all()


@router.get("/{institution_id}", response_model=InstitutionRead, summary="Get institution by ID")
async def get_institution(institution_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Institution).where(Institution.id == institution_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found",
        )
    return inst


@router.post("", response_model=InstitutionRead, status_code=status.HTTP_201_CREATED, summary="Create institution")
async def create_institution(payload: InstitutionCreate, db: AsyncSession = Depends(get_db)):
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
