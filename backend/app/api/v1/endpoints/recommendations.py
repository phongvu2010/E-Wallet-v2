from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.card_recommendation import (
    CardBenefitCreate,
    CardBenefitRead,
    CardRecommendationRequest,
    CardRecommendationResponse,
)
from app.services.card_recommendation_service import CardRecommendationService

router = APIRouter()


@router.post(
    "/best-card",
    response_model=CardRecommendationResponse,
    summary="Recommend the optimal credit card for an upcoming transaction",
)
async def recommend_card(
    payload: CardRecommendationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Evaluate all active cards and recommend the highest reward & lowest risk card for a given purchase."""
    return await CardRecommendationService.recommend_best_card(db, payload)


@router.get(
    "/benefits",
    response_model=List[CardBenefitRead],
    summary="List all card benefit rules and cashback matrices",
)
async def list_card_benefits(
    account_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Fetch reward policies and category/merchant cashback rates across all cards."""
    return await CardRecommendationService.get_all_benefits(db, account_id)


@router.post(
    "/benefits",
    response_model=CardBenefitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new card benefit rule",
)
async def create_card_benefit(
    payload: CardBenefitCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new reward/cashback rule for a card."""
    created = await CardRecommendationService.create_benefit(db, payload)
    return CardBenefitRead.model_validate(created)
