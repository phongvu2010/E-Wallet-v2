from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.category import CategoryTypeEnum
from app.schemas.category import CategoryRead, CategoryCreate, CategoryTreeNode
from app.services.category_service import CategoryService

router = APIRouter()


@router.get("", response_model=List[CategoryRead], summary="List all categories (flat)")
async def list_categories(
    category_type: Optional[CategoryTypeEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    return await CategoryService.get_all(db, category_type=category_type)


@router.get("/tree", response_model=List[CategoryTreeNode], summary="Get hierarchical category tree (Parent - Child)")
async def get_category_tree(db: AsyncSession = Depends(get_db)):
    return await CategoryService.get_tree(db)


@router.get("/{category_id}", response_model=CategoryRead, summary="Get category by ID")
async def get_category(category_id: UUID, db: AsyncSession = Depends(get_db)):
    return await CategoryService.get_by_id(db, category_id=category_id)


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED, summary="Create a custom category")
async def create_category(payload: CategoryCreate, db: AsyncSession = Depends(get_db)):
    return await CategoryService.create(db, payload=payload)
