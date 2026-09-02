import { api } from "./api";
import { Merchant, MerchantSuggestion } from "../types/merchant";

/**
 * Frontend API client for Merchants and Brand metadata.
 */
export const merchantService = {
  /**
   * Fetch all normalized merchants, optionally filtered by keyword search.
   */
  getAll: async (search?: string): Promise<Merchant[]> => {
    const params = search ? { search } : {};
    const res = await api.get<Merchant[]>("/merchants", { params });
    return res.data;
  },

  /**
   * Fetch simplified merchant suggestions for smart autocomplete.
   */
  getSuggestions: async (limit: number = 100): Promise<MerchantSuggestion[]> => {
    const res = await api.get<MerchantSuggestion[]>("/merchants/suggestions", {
      params: { limit },
    });
    return res.data;
  },
};
