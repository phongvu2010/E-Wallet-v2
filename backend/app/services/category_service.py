from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.category import Category, CategoryTypeEnum
from app.schemas.category import CategoryCreate


class CategoryService:
    """Service layer managing the 2-Tier Hierarchical Category Tree for transaction classification."""

    @staticmethod
    async def get_all(
        db: AsyncSession,
        category_type: Optional[CategoryTypeEnum] = None,
    ) -> List[Category]:
        """Fetch all categories as a flat list, optionally filtered by CategoryType (EXPENSE/INCOME/TRANSFER).

        Args:
            db (AsyncSession): Active asynchronous database session.
            category_type (Optional[CategoryTypeEnum]): Optional category type filter.

        Returns:
            List[Category]: Flat list of categories sorted alphabetically.
        """
        query = select(Category)
        if category_type:
            query = query.where(Category.category_type == category_type)
        query = query.order_by(Category.name.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_tree(db: AsyncSession) -> List[Category]:
        """Retrieve the 2-tier hierarchical category tree.

        Queries root categories (parent_id IS NULL) and eager-loads their child subcategories.

        Args:
            db (AsyncSession): Active asynchronous database session.

        Returns:
            List[Category]: List of root Category ORM instances with populated `children` collections.
        """
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
        """Fetch a single category with its children loaded.

        Args:
            db (AsyncSession): Active asynchronous database session.
            category_id (UUID): Primary category identifier.

        Returns:
            Category: Category instance.

        Raises:
            HTTPException: 404 Not Found if category does not exist.
        """
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
        """Create a new root category or child subcategory.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (CategoryCreate): Validated category payload.

        Returns:
            Category: The newly created Category instance.

        Raises:
            HTTPException: 400 Bad Request on integrity or insertion error.
        """
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
