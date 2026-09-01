import {
  CardBenefit,
  CardRecommendationRequest,
  CardRecommendationResponse,
} from "../types/cardRecommendation";
import api from "./api";

export const recommendationService = {
  getBestCard: async (
    payload: CardRecommendationRequest
  ): Promise<CardRecommendationResponse> => {
    const res = await api.post<CardRecommendationResponse>(
      "/recommendations/best-card",
      payload
    );
    return res.data;
  },

  getBenefits: async (accountId?: string): Promise<CardBenefit[]> => {
    const res = await api.get<CardBenefit[]>("/recommendations/benefits", {
      params: { account_id: accountId },
    });
    return res.data;
  },

  createBenefit: async (payload: Partial<CardBenefit>): Promise<CardBenefit> => {
    const res = await api.post<CardBenefit>("/recommendations/benefits", payload);
    return res.data;
  },
};
