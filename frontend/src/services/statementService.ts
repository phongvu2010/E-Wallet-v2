import { api } from "./api";
import {
  Statement,
  StatementReconciliation,
  StatementPaymentStatus,
} from "../types/statement";

/**
 * Frontend API client for Bank Statements and 3-Way Reconciliation.
 */
export const statementService = {
  /**
   * Fetch all closed statements, filtered by account or calendar year.
   */
  getAll: async (accountId?: string, year?: number): Promise<Statement[]> => {
    const params: Record<string, any> = {};
    if (accountId) params.account_id = accountId;
    if (year) params.year = year;
    const res = await api.get<Statement[]>("/statements", { params });
    return res.data;
  },

  /**
   * Fetch 3-way reconciliation audit between billed statements and actual transactions.
   */
  getReconciliation: async (accountId?: string): Promise<StatementReconciliation[]> => {
    const params = accountId ? { account_id: accountId } : {};
    const res = await api.get<StatementReconciliation[]>("/statements/reconciliation", { params });
    return res.data;
  },

  /**
   * Fetch statement repayment tracking (paid amounts, remaining balance, overdue flags).
   */
  getPaymentStatus: async (accountId?: string): Promise<StatementPaymentStatus[]> => {
    const params = accountId ? { account_id: accountId } : {};
    const res = await api.get<StatementPaymentStatus[]>("/statements/payment-status", { params });
    return res.data;
  },

  /**
   * Fetch statement metadata by UUID.
   */
  getById: async (id: string): Promise<Statement> => {
    const res = await api.get<Statement>(`/statements/${id}`);
    return res.data;
  },
};
