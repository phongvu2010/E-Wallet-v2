from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.reward import RewardLedger, RewardTypeEnum
from app.schemas.reward import RewardLedgerRead, RewardLedgerCreate

router = APIRouter()


@router.get("", response_model=List[RewardLedgerRead], summary="List reward ledgers (Points, Cashback, Miles)")
async def list_rewards(
    account_id: Optional[UUID] = None,
    statement_id: Optional[UUID] = None,
    reward_type: Optional[RewardTypeEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(RewardLedger)
    if account_id:
        query = query.where(RewardLedger.account_id == account_id)
    if statement_id:
        query = query.where(RewardLedger.statement_id == statement_id)
    if reward_type:
        query = query.where(RewardLedger.reward_type == reward_type)
    query = query.order_by(RewardLedger.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{reward_id}", response_model=RewardLedgerRead, summary="Get reward ledger by ID")
async def get_reward(reward_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RewardLedger).where(RewardLedger.id == reward_id))
    rw = result.scalar_one_or_none()
    if not rw:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reward ledger with ID {reward_id} not found",
        )
    return rw


@router.post("", response_model=RewardLedgerRead, status_code=status.HTTP_201_CREATED, summary="Create reward ledger entry")
async def create_reward(payload: RewardLedgerCreate, db: AsyncSession = Depends(get_db)):
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
