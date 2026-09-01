from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.reward import RewardTypeEnum


class CardBenefitBase(BaseModel):
    account_id: UUID
    category_id: Optional[UUID] = None
    category_keyword: Optional[str] = None
    merchant_pattern: Optional[str] = None
    reward_type: RewardTypeEnum = RewardTypeEnum.CASHBACK
    reward_rate_percent: Decimal = Decimal("0.00")
    point_multiplier: Decimal = Decimal("1.00")
    min_spend_per_txn: Decimal = Decimal("0.00")
    max_reward_monthly: Optional[Decimal] = None
    description: Optional[str] = None
    is_active: bool = True


class CardBenefitCreate(CardBenefitBase):
    pass


class CardBenefitRead(CardBenefitBase):
    id: UUID
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    category_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CardRecommendationRequest(BaseModel):
    amount: Decimal = Field(
        ..., gt=0, description="Số tiền dự kiến chi tiêu / quẹt thẻ (VNĐ)"
    )
    category_id: Optional[UUID] = Field(
        None, description="Danh mục chi tiêu (Cấp 1 hoặc Cấp 2)"
    )
    category_name: Optional[str] = Field(
        None, description="Tên danh mục chi tiêu (VD: 'Ăn uống', 'Online')"
    )
    merchant_name: Optional[str] = Field(
        None, description="Tên cửa hàng / merchant (VD: 'Shopee', 'Starbucks')"
    )


class CardRecommendationItem(BaseModel):
    account_id: UUID
    account_name: str
    bank_name: str
    card_number_masked: str
    card_color_hex: Optional[str] = "#3b82f6"
    status: str

    # Live balance & limit details
    credit_limit: Decimal
    live_available_limit: Decimal
    current_utilization_percent: Decimal
    projected_utilization_percent: Decimal
    projected_risk_level: str
    is_sufficient_limit: bool

    # Reward & benefit details
    reward_type: RewardTypeEnum
    reward_rate_percent: Decimal
    point_multiplier: Decimal
    estimated_reward_amount: (
        Decimal  # Số tiền hoàn (VNĐ) hoặc số điểm quy đổi tương đương
    )
    estimated_points_earned: Decimal  # Số điểm thưởng tích lũy (nếu là POINT)
    benefit_description: str

    # Scoring & ranking
    rank: int
    is_best_choice: bool
    recommendation_score: float  # Điểm tổng hợp dựa trên reward rate, limit headroom, và risk
    reasons: List[str]  # Các lý do gợi ý


class CardRecommendationResponse(BaseModel):
    requested_amount: Decimal
    detected_category: str
    detected_merchant: Optional[str] = None
    best_choice: Optional[CardRecommendationItem] = None
    recommendations: List[CardRecommendationItem] = []
    total_evaluated_cards: int
