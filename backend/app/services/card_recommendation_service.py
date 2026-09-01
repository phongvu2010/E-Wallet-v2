from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.card_benefit import CardBenefit
from app.models.reward import RewardTypeEnum
from app.schemas.card_recommendation import (
    CardBenefitCreate,
    CardBenefitRead,
    CardRecommendationItem,
    CardRecommendationRequest,
    CardRecommendationResponse,
)


class CardRecommendationService:
    """Intelligent Card Recommendation Engine.

    Evaluates live card balances, reward structures, merchant/category mappings,
    and credit risk impact to recommend the optimal credit card for any upcoming purchase.
    """

    @staticmethod
    async def get_all_benefits(
        db: AsyncSession, account_id: Optional[UUID] = None
    ) -> List[CardBenefitRead]:
        """Fetch all card benefit policies with relational metadata."""
        query = select(CardBenefit).options(
            selectinload(CardBenefit.account),
            selectinload(CardBenefit.category),
        )
        if account_id:
            query = query.where(CardBenefit.account_id == account_id)
        query = query.order_by(
            CardBenefit.reward_rate_percent.desc(), CardBenefit.created_at.desc()
        )
        result = await db.execute(query)
        benefits = result.scalars().all()

        output = []
        for b in benefits:
            output.append(
                CardBenefitRead(
                    id=b.id,
                    account_id=b.account_id,
                    account_name=b.account.account_name if b.account else None,
                    bank_name=(
                        b.account.institution.name
                        if b.account and b.account.institution
                        else None
                    ),
                    category_id=b.category_id,
                    category_name=b.category.name if b.category else None,
                    category_keyword=b.category_keyword,
                    merchant_pattern=b.merchant_pattern,
                    reward_type=b.reward_type,
                    reward_rate_percent=b.reward_rate_percent,
                    point_multiplier=b.point_multiplier,
                    min_spend_per_txn=b.min_spend_per_txn,
                    max_reward_monthly=b.max_reward_monthly,
                    description=b.description,
                    is_active=b.is_active,
                )
            )
        return output

    @staticmethod
    async def create_benefit(
        db: AsyncSession, payload: CardBenefitCreate
    ) -> CardBenefit:
        """Register a new card benefit rule."""
        benefit = CardBenefit(**payload.model_dump())
        db.add(benefit)
        try:
            await db.commit()
            await db.refresh(benefit)
            return benefit
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create card benefit: {str(e)}",
            )

    @staticmethod
    async def recommend_best_card(
        db: AsyncSession,
        payload: CardRecommendationRequest,
    ) -> CardRecommendationResponse:
        """Evaluate all active cards and recommend the highest reward & lowest risk card."""
        amount = payload.amount
        cat_id = payload.category_id
        cat_name_input = payload.category_name or ""
        merch_input = payload.merchant_name or ""

        # 1. Fetch live card balances
        sql_live = """
        SELECT
            a.id AS account_id,
            a.account_name,
            i.name AS bank_name,
            a.card_number_masked,
            a.color_hex,
            a.status,
            a.credit_limit,
            COALESCE(lb.live_current_balance, 0.00) AS live_current_balance,
            COALESCE(lb.live_available_limit, a.credit_limit) AS live_available_limit,
            COALESCE(lb.live_utilization_percentage, 0.00) AS live_utilization_percentage
        FROM accounts a
        JOIN institutions i ON a.institution_id = i.id
        LEFT JOIN v_account_live_balance lb ON a.id = lb.account_id
        WHERE a.status = 'ACTIVE'
        ORDER BY a.credit_limit DESC;
        """
        res_live = await db.execute(text(sql_live))
        active_cards = res_live.mappings().all()

        # 2. Fetch all active benefits
        benefit_stmt = select(CardBenefit).where(CardBenefit.is_active == True)  # noqa: E712
        res_ben = await db.execute(benefit_stmt)
        all_benefits = res_ben.scalars().all()

        # 3. Resolve category name if ID provided
        detected_category_label = cat_name_input or "Chi tiêu thông thường"
        if cat_id:
            sql_cat = "SELECT name FROM categories WHERE id = :cid;"
            cat_res = await db.execute(text(sql_cat), {"cid": str(cat_id)})
            c_name = cat_res.scalar_one_or_none()
            if c_name:
                detected_category_label = c_name

        evaluated_items: List[CardRecommendationItem] = []

        for card in active_cards:
            acc_id = card["account_id"]
            acc_name = card["account_name"]
            bank_name = card["bank_name"]
            card_masked = card["card_number_masked"]
            color_hex = card["color_hex"] or "#3b82f6"
            limit = Decimal(str(card["credit_limit"]))
            avail_limit = Decimal(str(card["live_available_limit"]))
            curr_balance = Decimal(str(card["live_current_balance"]))
            curr_util_pct = Decimal(str(card["live_utilization_percentage"]))

            # Match benefits for this card
            card_bens = [b for b in all_benefits if b.account_id == acc_id]

            # Priority 1: Match by Merchant Pattern
            matched_benefit: Optional[CardBenefit] = None
            if merch_input:
                for b in card_bens:
                    if b.merchant_pattern:
                        pat = b.merchant_pattern.replace("%", "").lower()
                        if pat in merch_input.lower():
                            matched_benefit = b
                            break

            # Priority 2: Match by Category ID or Keyword
            if not matched_benefit and (cat_id or cat_name_input):
                for b in card_bens:
                    if cat_id and b.category_id == cat_id:
                        matched_benefit = b
                        break
                    if b.category_keyword and detected_category_label:
                        kw = b.category_keyword.lower()
                        if any(
                            k in kw or kw in k
                            for k in detected_category_label.lower().split()
                        ):
                            matched_benefit = b
                            break

            # Priority 3: Fallback to General / Base Benefit for this card
            if not matched_benefit:
                general_bens = [
                    b
                    for b in card_bens
                    if not b.category_id
                    and (
                        not b.category_keyword
                        or "thông thường" in b.category_keyword.lower()
                    )
                ]
                if general_bens:
                    matched_benefit = general_bens[0]
                elif card_bens:
                    # Lowest reward rate as baseline
                    card_bens_sorted = sorted(
                        card_bens, key=lambda x: x.reward_rate_percent
                    )
                    matched_benefit = card_bens_sorted[0]

            # Calculate Reward values
            reward_type = (
                matched_benefit.reward_type
                if matched_benefit
                else RewardTypeEnum.CASHBACK
            )
            reward_rate = (
                Decimal(str(matched_benefit.reward_rate_percent))
                if matched_benefit
                else Decimal("0.00")
            )
            point_mult = (
                Decimal(str(matched_benefit.point_multiplier))
                if matched_benefit
                else Decimal("1.00")
            )
            desc = (
                matched_benefit.description
                if matched_benefit
                else "Ưu đãi chi tiêu cơ bản theo chính sách ngân hàng"
            )

            # Estimate reward amount (VND equivalence)
            if reward_type == RewardTypeEnum.CASHBACK:
                estimated_reward = round(amount * (reward_rate / Decimal("100.0")), 2)
                estimated_points = Decimal("0.00")
            else:
                # Point or Mile: 1 Point is worth approximately 1 VND or Shinhan conversion
                estimated_points = round(amount * (reward_rate / Decimal("100.0")), 0)
                estimated_reward = estimated_points

            # Cap reward if monthly limit configured
            if matched_benefit and matched_benefit.max_reward_monthly:
                max_m = Decimal(str(matched_benefit.max_reward_monthly))
                if estimated_reward > max_m:
                    estimated_reward = max_m

            # Check Limit Headroom & Risk Impact
            is_sufficient = avail_limit >= amount
            projected_balance = curr_balance + amount
            projected_util_pct = (
                round((projected_balance / limit) * Decimal("100.0"), 2)
                if limit > 0
                else Decimal("0.00")
            )

            if limit == 0:
                projected_risk = "NO_LIMIT"
            elif projected_util_pct > 70:
                projected_risk = "CRITICAL (>70%)"
            elif projected_util_pct > 50:
                projected_risk = "HIGH (>50%)"
            elif projected_util_pct > 30:
                projected_risk = "MODERATE (>30%)"
            else:
                projected_risk = "OPTIMAL (<30%)"

            # Compute Composite Recommendation Score
            score = float(reward_rate) * 10.0  # Reward weight
            if not is_sufficient:
                score -= 1000.0  # Cannot afford
            else:
                # Bonus for headroom & penalize excessive utilization
                if projected_util_pct > 70:
                    score -= 40.0
                elif projected_util_pct > 50:
                    score -= 15.0
                else:
                    score += 20.0

            # Generate Reasons
            reasons = []
            if not is_sufficient:
                reasons.append(
                    f"⚠️ Hạn mức khả dụng ({avail_limit:,.0f}đ) không đủ để chi trả {amount:,.0f}đ"
                )
            else:
                if reward_rate > Decimal("3.0"):
                    reasons.append(
                        f"🔥 Tỷ lệ hoàn tiền/tích điểm cực cao: {reward_rate}% (nhận ~{estimated_reward:,.0f} VNĐ)"
                    )
                elif reward_rate > Decimal("0.0"):
                    reasons.append(
                        f"✨ Nhận ưu đãi {reward_rate}% ({estimated_reward:,.0f} VNĐ)"
                    )
                else:
                    reasons.append("Chi tiêu tích lũy điểm tiêu chuẩn")

                if projected_util_pct <= 30:
                    reasons.append(
                        f"🛡️ Rất an toàn: Tỷ lệ sử dụng sau quẹt chỉ {projected_util_pct:.1f}% (tối ưu điểm CIC)"
                    )
                elif projected_util_pct <= 50:
                    reasons.append(
                        f"Tỷ lệ sử dụng hạn mức sau giao dịch: {projected_util_pct:.1f}%"
                    )
                else:
                    reasons.append(
                        f"⚠️ Lưu ý: Tỷ lệ sử dụng sau quẹt sẽ lên {projected_util_pct:.1f}% (>50%)"
                    )

                reasons.append(
                    f"Hạn mức khả dụng còn lại sau giao dịch: {(avail_limit - amount):,.0f} VNĐ"
                )

            evaluated_items.append(
                CardRecommendationItem(
                    account_id=acc_id,
                    account_name=acc_name,
                    bank_name=bank_name,
                    card_number_masked=card_masked,
                    card_color_hex=color_hex,
                    status=card["status"],
                    credit_limit=limit,
                    live_available_limit=avail_limit,
                    current_utilization_percent=curr_util_pct,
                    projected_utilization_percent=projected_util_pct,
                    projected_risk_level=projected_risk,
                    is_sufficient_limit=is_sufficient,
                    reward_type=reward_type,
                    reward_rate_percent=reward_rate,
                    point_multiplier=point_mult,
                    estimated_reward_amount=estimated_reward,
                    estimated_points_earned=estimated_points,
                    benefit_description=desc,
                    rank=0,
                    is_best_choice=False,
                    recommendation_score=score,
                    reasons=reasons,
                )
            )

        # Sort items by recommendation_score descending
        evaluated_items.sort(key=lambda x: x.recommendation_score, reverse=True)

        for idx, item in enumerate(evaluated_items):
            item.rank = idx + 1
            if idx == 0 and item.is_sufficient_limit:
                item.is_best_choice = True

        best_item = (
            evaluated_items[0]
            if evaluated_items and evaluated_items[0].is_sufficient_limit
            else None
        )

        return CardRecommendationResponse(
            requested_amount=amount,
            detected_category=detected_category_label,
            detected_merchant=merch_input or None,
            best_choice=best_item,
            recommendations=evaluated_items,
            total_evaluated_cards=len(evaluated_items),
        )
