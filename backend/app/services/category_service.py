from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.category import Category, CategoryTypeEnum
from app.schemas.category import CategoryCreate


class CategoryService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        category_type: Optional[CategoryTypeEnum] = None,
    ) -> List[Category]:
        query = select(Category)
        if category_type:
            query = query.where(Category.category_type == category_type)
        query = query.order_by(Category.name.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_tree(db: AsyncSession) -> List[Category]:
        # Fetch root categories (parent_id IS NULL) with their children preloaded
        query = (
            select(Category)
            .options(selectinload(Category.children))
            .where(Category.parent_id.is_(None))
            .order_by(Category.name.asc())
        )
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, category_id: UUID) -> Category:
        result = await db.execute(
            select(Category)
            .options(selectinload(Category.children))
            .where(Category.id == category_id)
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with ID {category_id} not found",
            )
        return cat

    @staticmethod
    async def create(db: AsyncSession, payload: CategoryCreate) -> Category:
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
