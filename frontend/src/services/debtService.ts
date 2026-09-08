import api from "./api";
import {
  Debt,
  DebtCreatePayload,
  DebtRepaymentPayload,
  DebtSummaryKPIs,
  DebtType,
  DebtStatus,
  DebtUpdatePayload,
} from "../types/debt";

export const debtService = {
  /**
   * Fetch all personal debts with optional filters.
   */
  getAll: async (params?: {
    debt_type?: DebtType;
    status?: DebtStatus;
    search?: string;
  }): Promise<Debt[]> => {
    const response = await api.get<Debt[]>("/debts", { params });
    return response.data;
  },

  /**
   * Fetch single debt detail with repayment history.
   */
  getById: async (id: string): Promise<Debt> => {
    const response = await api.get<Debt>(`/debts/${id}`);
    return response.data;
  },

  /**
   * Fetch aggregate summary KPIs for personal borrowing and lending.
   */
  getKPIs: async (): Promise<DebtSummaryKPIs> => {
    const response = await api.get<DebtSummaryKPIs>("/debts/kpis");
    return response.data;
  },

  /**
   * Create a new personal loan/debt record.
   */
  create: async (payload: DebtCreatePayload): Promise<Debt> => {
    const response = await api.post<Debt>("/debts", payload);
    return response.data;
  },

  /**
   * Update debt metadata.
   */
  update: async (id: string, payload: DebtUpdatePayload): Promise<Debt> => {
    const response = await api.put<Debt>(`/debts/${id}`, payload);
    return response.data;
  },

  /**
   * Record a partial or full repayment with optional appreciation tip.
   */
  repay: async (debtId: string, payload: DebtRepaymentPayload): Promise<Debt> => {
    const response = await api.post<Debt>(`/debts/${debtId}/repay`, payload);
    return response.data;
  },

  /**
   * Delete a debt record.
   */
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/debts/${id}`);
    return response.data;
  },
};
