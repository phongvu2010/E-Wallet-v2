import { api } from "./api";
import {
  InstallmentPlan,
  InstallmentForecast,
  EarlySettlePayload,
  EarlySettleResult,
} from "../types/installment";

/**
 * Frontend API client for 0% and Fee-based Installment Plans.
 */
export const installmentService = {
  /**
   * Fetch all installment plans, optionally filtered by card account or status.
   */
  getAll: async (accountId?: string, status?: string): Promise<InstallmentPlan[]> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (status) params.status = status;
    const res = await api.get<InstallmentPlan[]>("/installments", { params });
    return res.data;
  },

  /**
   * Fetch monthly cash flow forecast for upcoming installment schedules.
   */
  getForecast: async (): Promise<InstallmentForecast[]> => {
    const res = await api.get<InstallmentForecast[]>("/installments/forecast");
    return res.data;
  },

  /**
   * Fetch full details and repayment schedules of an installment plan by UUID.
   */
  getById: async (id: string): Promise<InstallmentPlan> => {
    const res = await api.get<InstallmentPlan>(`/installments/${id}`);
    return res.data;
  },

  /**
   * Create a new installment plan.
   */
  create: async (payload: any): Promise<InstallmentPlan> => {
    const res = await api.post<InstallmentPlan>("/installments", payload);
    return res.data;
  },

  /**
   * Early settle an active installment plan via PostgreSQL stored procedure.
   */
  earlySettle: async (id: string, payload: EarlySettlePayload): Promise<EarlySettleResult> => {
    const res = await api.post<EarlySettleResult>(`/installments/${id}/early-settle`, payload);
    return res.data;
  },
};
