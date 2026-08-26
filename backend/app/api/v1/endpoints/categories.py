from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db
from backend.app.models.category import Category, CategoryTypeEnum
from backend.app.schemas.category import CategoryRead, CategoryCreate, CategoryTreeNode

router = APIRouter()


@router.get("", response_model=List[CategoryRead], summary="List all categories (flat)")
async def list_categories(
    category_type: Optional[CategoryTypeEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Category)
    if category_type:
        query = query.where(Category.category_type == category_type)
    query = query.order_by(Category.name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/tree", response_model=List[CategoryTreeNode], summary="Get hierarchical category tree (Parent - Child)")
async def get_category_tree(db: AsyncSession = Depends(get_db)):
    # Fetch root categories (parent_id IS NULL) with their children preloaded
    query = (
        select(Category)
        .options(selectinload(Category.children))
        .where(Category.parent_id.is_(None))
        .order_by(Category.name.asc())
    )
    result = await db.execute(query)
    root_categories = result.scalars().all()
    return root_categories


@router.get("/{category_id}", response_model=CategoryRead, summary="Get category by ID")
async def get_category(category_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} not found",
        )
    return cat


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED, summary="Create a custom category")
async def create_category(payload: CategoryCreate, db: AsyncSession = Depends(get_db)):
    cat = Category(**payload.model_dump())
    db.add(cat)
    try:
        await db.commit()
        await db.refresh(cat)
        return cat
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating category: {str(e)}",
        )
