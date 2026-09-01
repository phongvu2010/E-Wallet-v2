from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.reward import RewardLedger, RewardTypeEnum
from app.schemas.reward import RewardLedgerCreate


class RewardService:
    """Service layer managing Reward Ledgers (Shinhan Reward Points, Cashback, and Miles)."""

    @staticmethod
    async def get_all(
        db: AsyncSession,
        account_id: Optional[UUID] = None,
        statement_id: Optional[UUID] = None,
        reward_type: Optional[RewardTypeEnum] = None,
    ) -> List[RewardLedger]:
        """Fetch reward ledger entries filtered by account, statement, or reward type.

        Tracks earned points/cashback, used amounts, available balances, and expiring amounts.

        Args:
            db (AsyncSession): Active asynchronous database session.
            account_id (Optional[UUID]): Optional filter by credit card account.
            statement_id (Optional[UUID]): Optional filter by statement cycle.
            reward_type (Optional[RewardTypeEnum]): Filter for POINT, CASHBACK, or MILE.

        Returns:
            List[RewardLedger]: List of reward ledger entries ordered by creation date descending.
        """
        query = select(RewardLedger)
        if account_id:
            query = query.where(RewardLedger.account_id == account_id)
        if statement_id:
            query = query.where(RewardLedger.statement_id == statement_id)
        if reward_type:
            query = query.where(RewardLedger.reward_type == reward_type)
        query = query.order_by(RewardLedger.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, reward_id: UUID) -> RewardLedger:
        """Fetch a single reward ledger entry by UUID.

        Args:
            db (AsyncSession): Active asynchronous database session.
            reward_id (UUID): Primary reward entry identifier.

        Returns:
            RewardLedger: Reward ledger instance.

        Raises:
            HTTPException: 404 Not Found if record does not exist.
        """
        result = await db.execute(
            select(RewardLedger).where(RewardLedger.id == reward_id)
        )
        rw = result.scalar_one_or_none()
        if not rw:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reward ledger with ID {reward_id} not found",
            )
        return rw

    @staticmethod
    async def create(db: AsyncSession, payload: RewardLedgerCreate) -> RewardLedger:
        """Create a new reward ledger snapshot for a card's statement cycle.

        Args:
            db (AsyncSession): Active asynchronous database session.
            payload (RewardLedgerCreate): Validated reward ledger payload.

        Returns:
            RewardLedger: The newly created RewardLedger instance.

        Raises:
            HTTPException: 400 Bad Request on integrity or insertion error.
        """
        rw = RewardLedger(**payload.model_dump())
        db.add(rw)
        try:
            await db.commit()
            await db.refresh(rw)
            return rw
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating reward entry: {str(e)}",
            )
