from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.reward import RewardTypeEnum
from app.schemas.reward import RewardLedgerCreate, RewardLedgerRead
from app.services.reward_service import RewardService

router = APIRouter()


@router.get(
    "",
    response_model=List[RewardLedgerRead],
    summary="List reward ledgers (Points, Cashback, Miles)",
)
async def list_rewards(
    account_id: Optional[UUID] = None,
    statement_id: Optional[UUID] = None,
    reward_type: Optional[RewardTypeEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve loyalty points, cashback, and miles earned/redeemed across accounts and cycles."""
    return await RewardService.get_all(
        db,
        account_id=account_id,
        statement_id=statement_id,
        reward_type=reward_type,
    )


@router.get(
    "/{reward_id}", response_model=RewardLedgerRead, summary="Get reward ledger by ID"
)
async def get_reward(reward_id: UUID, db: AsyncSession = Depends(get_db)):
    """Fetch reward ledger entry by UUID."""
    return await RewardService.get_by_id(db, reward_id=reward_id)


@router.post(
    "",
    response_model=RewardLedgerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create reward ledger entry",
)
async def create_reward(
    payload: RewardLedgerCreate, db: AsyncSession = Depends(get_db)
):
    """Record a newly earned or redeemed reward points / cashback snapshot."""
    return await RewardService.create(db, payload=payload)
