import { api } from "./api";
import { Merchant } from "../types/merchant";

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
};
