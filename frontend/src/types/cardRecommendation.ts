import { RewardType } from "./reward";

export interface CardBenefit {
  id: string;
  account_id: string;
  account_name?: string;
  bank_name?: string;
  category_id?: string;
  category_name?: string;
  category_keyword?: string;
  merchant_pattern?: string;
  reward_type: RewardType;
  reward_rate_percent: number;
  point_multiplier: number;
  min_spend_per_txn: number;
  max_reward_monthly?: number;
  description?: string;
  is_active: boolean;
}

export interface CardRecommendationRequest {
  amount: number;
  category_id?: string;
  category_name?: string;
  merchant_name?: string;
}

export interface CardRecommendationItem {
  account_id: string;
  account_name: string;
  bank_name: string;
  card_number_masked: string;
  card_color_hex?: string;
  status: string;

  credit_limit: number;
  live_available_limit: number;
  current_utilization_percent: number;
  projected_utilization_percent: number;
  projected_risk_level: string;
  is_sufficient_limit: boolean;

  reward_type: RewardType;
  reward_rate_percent: number;
  point_multiplier: number;
  estimated_reward_amount: number;
  estimated_points_earned: number;
  benefit_description: string;

  rank: number;
  is_best_choice: boolean;
  recommendation_score: number;
  reasons: string[];
}

export interface CardRecommendationResponse {
  requested_amount: number;
  detected_category: string;
  detected_merchant?: string;
  best_choice?: CardRecommendationItem;
  recommendations: CardRecommendationItem[];
  total_evaluated_cards: number;
}
