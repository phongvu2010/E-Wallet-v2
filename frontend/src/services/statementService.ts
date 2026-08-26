import { api } from "./api";
import {
  Statement,
  StatementReconciliation,
  StatementPaymentStatus,
} from "../types/statement";

export const statementService = {
  getAll: async (accountId?: string, year?: number): Promise<Statement[]> => {
    const params: Record<string, any> = {};
    if (accountId) params.account_id = accountId;
    if (year) params.year = year;
    const res = await api.get<Statement[]>("/statements", { params });
    return res.data;
  },

  getReconciliation: async (accountId?: string): Promise<StatementReconciliation[]> => {
    const params = accountId ? { account_id: accountId } : {};
    const res = await api.get<StatementReconciliation[]>("/statements/reconciliation", { params });
    return res.data;
  },

  getPaymentStatus: async (accountId?: string): Promise<StatementPaymentStatus[]> => {
    const params = accountId ? { account_id: accountId } : {};
    const res = await api.get<StatementPaymentStatus[]>("/statements/payment-status", { params });
    return res.data;
  },

  getById: async (id: string): Promise<Statement> => {
    const res = await api.get<Statement>(`/statements/${id}`);
    return res.data;
  },
};
