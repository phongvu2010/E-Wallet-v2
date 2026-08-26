import { api } from "./api";
import { RewardLedger } from "../types/reward";

export const rewardService = {
  getAll: async (accountId?: string, statementId?: string): Promise<RewardLedger[]> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (statementId) params.statement_id = statementId;
    const res = await api.get<RewardLedger[]>("/rewards", { params });
    return res.data;
  },

  getById: async (id: string): Promise<RewardLedger> => {
    const res = await api.get<RewardLedger>(`/rewards/${id}`);
    return res.data;
  },
};
