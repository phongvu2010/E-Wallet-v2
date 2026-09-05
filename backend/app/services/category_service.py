from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.category import Category, CategoryTypeEnum
from app.schemas.category import CategoryCreate, CategoryUpdate


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
        data = payload.model_dump()
        if data.get("parent_id"):
            parent = await db.get(Category, data["parent_id"])
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parent category {data['parent_id']} not found",
                )
            # Inherit category_type from parent if not explicitly set
            data["category_type"] = parent.category_type

        cat = Category(**data)
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

    @staticmethod
    async def update(
        db: AsyncSession, category_id: UUID, payload: CategoryUpdate
    ) -> Category:
        """Update fields of an existing category.

        Args:
            db (AsyncSession): Active asynchronous database session.
            category_id (UUID): Category UUID.
            payload (CategoryUpdate): Partial update payload.

        Returns:
            Category: Updated Category instance.

        Raises:
            HTTPException: 400 Bad Request on validation or commit failure.
        """
        cat = await CategoryService.get_by_id(db, category_id)
        update_data = payload.model_dump(exclude_unset=True)

        if "parent_id" in update_data:
            new_parent_id = update_data["parent_id"]
            if new_parent_id is not None:
                if str(new_parent_id) == str(category_id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Danh mục không thể làm cha của chính nó.",
                    )
                parent = await db.get(Category, new_parent_id)
                if not parent:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Parent category {new_parent_id} not found.",
                    )
                if parent.parent_id is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Chỉ hỗ trợ cấu trúc cây danh mục 2 cấp (Không thể chọn danh mục con làm cha).",
                    )
                # Auto align category_type with parent
                update_data["category_type"] = parent.category_type

        for key, value in update_data.items():
            setattr(cat, key, value)

        # If parent category changes its category_type, cascade update to its children
        if "category_type" in update_data and cat.parent_id is None and cat.children:
            for child in cat.children:
                child.category_type = update_data["category_type"]

        try:
            await db.commit()
            return await CategoryService.get_by_id(db, category_id)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error updating category: {str(e)}",
            )

    @staticmethod
    async def delete(db: AsyncSession, category_id: UUID) -> bool:
        """Delete a category. If it is a parent category, its children will be cascade-deleted.

        Args:
            db (AsyncSession): Active asynchronous database session.
            category_id (UUID): Category UUID.

        Returns:
            bool: True if deleted successfully.

        Raises:
            HTTPException: 404 Not Found if category does not exist, or 400 on error.
        """
        cat = await CategoryService.get_by_id(db, category_id)
        try:
            await db.delete(cat)
            await db.commit()
            return True
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error deleting category: {str(e)}",
            )
