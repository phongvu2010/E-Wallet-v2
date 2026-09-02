from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.merchant import (
    MerchantAliasCreate,
    MerchantAliasRead,
    MerchantCreate,
    MerchantRead,
    MerchantSuggestionRead,
)
from app.services.merchant_service import MerchantService

router = APIRouter()


@router.get(
    "/suggestions",
    response_model=List[MerchantSuggestionRead],
    summary="Get merchant suggestions for autocomplete",
)
async def get_merchant_suggestions(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve simplified list of merchants with category mappings and aliases for smart autocomplete."""
    return await MerchantService.get_suggestions(db, limit=limit)


@router.get("", response_model=List[MerchantRead], summary="List all merchants")
async def list_merchants(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all merchants and aliases, optionally searching by merchant name."""
    return await MerchantService.get_all(db, search=search)


@router.get("/{merchant_id}", response_model=MerchantRead, summary="Get merchant by ID")
async def get_merchant(merchant_id: UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve details and raw match patterns for a single merchant."""
    return await MerchantService.get_by_id(db, merchant_id=merchant_id)


@router.post(
    "",
    response_model=MerchantRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create merchant",
)
async def create_merchant(payload: MerchantCreate, db: AsyncSession = Depends(get_db)):
    """Register a new normalized merchant name."""
    return await MerchantService.create(db, payload=payload)


@router.post(
    "/aliases",
    response_model=MerchantAliasRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add alias mapping for merchant",
)
async def create_alias(
    payload: MerchantAliasCreate, db: AsyncSession = Depends(get_db)
):
    """Register a raw transaction descriptor alias pattern for automatic merchant matching."""
    return await MerchantService.create_alias(db, payload=payload)
