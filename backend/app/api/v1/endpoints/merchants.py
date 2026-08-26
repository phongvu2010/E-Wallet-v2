from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db
from backend.app.models.merchant import Merchant, MerchantAlias
from backend.app.schemas.merchant import (
    MerchantRead,
    MerchantCreate,
    MerchantAliasRead,
    MerchantAliasCreate,
)

router = APIRouter()


@router.get("", response_model=List[MerchantRead], summary="List all merchants")
async def list_merchants(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Merchant).options(selectinload(Merchant.aliases))
    if search:
        query = query.where(Merchant.cleaned_name.ilike(f"%{search}%"))
    query = query.order_by(Merchant.cleaned_name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{merchant_id}", response_model=MerchantRead, summary="Get merchant by ID")
async def get_merchant(merchant_id: UUID, db: AsyncSession = Depends(get_db)):
    query = select(Merchant).options(selectinload(Merchant.aliases)).where(Merchant.id == merchant_id)
    result = await db.execute(query)
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Merchant with ID {merchant_id} not found",
        )
    return m


@router.post("", response_model=MerchantRead, status_code=status.HTTP_201_CREATED, summary="Create merchant")
async def create_merchant(payload: MerchantCreate, db: AsyncSession = Depends(get_db)):
    m = Merchant(**payload.model_dump())
    db.add(m)
    try:
        await db.commit()
        await db.refresh(m)
        return await get_merchant(m.id, db)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating merchant: {str(e)}",
        )


@router.post("/aliases", response_model=MerchantAliasRead, status_code=status.HTTP_201_CREATED, summary="Add alias mapping for merchant")
async def create_alias(payload: MerchantAliasCreate, db: AsyncSession = Depends(get_db)):
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
