import { api } from "./api";
import { RewardLedger } from "../types/reward";

/**
 * Frontend API client for Reward Points & Cashback Ledger.
 */
export const rewardService = {
  /**
   * Fetch reward ledger history, filtered by card account or statement cycle.
   */
  getAll: async (accountId?: string, statementId?: string): Promise<RewardLedger[]> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (statementId) params.statement_id = statementId;
    const res = await api.get<RewardLedger[]>("/rewards", { params });
    return res.data;
  },

  /**
   * Fetch reward entry details by UUID.
   */
  getById: async (id: string): Promise<RewardLedger> => {
    const res = await api.get<RewardLedger>(`/rewards/${id}`);
    return res.data;
  },
};
