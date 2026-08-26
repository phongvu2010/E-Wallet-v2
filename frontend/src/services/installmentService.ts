import { api } from "./api";
import {
  InstallmentPlan,
  InstallmentForecast,
  EarlySettlePayload,
  EarlySettleResult,
} from "../types/installment";

export const installmentService = {
  getAll: async (accountId?: string, status?: string): Promise<InstallmentPlan[]> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (status) params.status = status;
    const res = await api.get<InstallmentPlan[]>("/installments", { params });
    return res.data;
  },

  getForecast: async (): Promise<InstallmentForecast[]> => {
    const res = await api.get<InstallmentForecast[]>("/installments/forecast");
    return res.data;
  },

  getById: async (id: string): Promise<InstallmentPlan> => {
    const res = await api.get<InstallmentPlan>(`/installments/${id}`);
    return res.data;
  },

  create: async (payload: any): Promise<InstallmentPlan> => {
    const res = await api.post<InstallmentPlan>("/installments", payload);
    return res.data;
  },

  earlySettle: async (id: string, payload: EarlySettlePayload): Promise<EarlySettleResult> => {
    const res = await api.post<EarlySettleResult>(`/installments/${id}/early-settle`, payload);
    return res.data;
  },
};
