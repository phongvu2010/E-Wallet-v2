import { api } from "./api";
import {
  Transaction,
  TransactionFilterParams,
  TransactionSummary,
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from "../types/transaction";
import { PaginatedResponse } from "../types/common";

/**
 * Frontend API client for Transactions Ledger.
 */
export const transactionService = {
  /**
   * Query transactions with multi-criteria filtering and pagination.
   */
  getFiltered: async (params: TransactionFilterParams = {}): Promise<PaginatedResponse<Transaction>> => {
    const res = await api.get<PaginatedResponse<Transaction>>("/transactions", { params });
    return res.data;
  },

  /**
   * Compute aggregated statistics (spending, repayments, fees) for a card or cycle.
   */
  getSummary: async (accountId?: string, statementId?: string): Promise<TransactionSummary> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (statementId) params.statement_id = statementId;
    const res = await api.get<TransactionSummary>("/transactions/summary", { params });
    return res.data;
  },

  /**
   * Fetch transaction details by UUID.
   */
  getById: async (id: string): Promise<Transaction> => {
    const res = await api.get<Transaction>(`/transactions/${id}`);
    return res.data;
  },

  /**
   * Create a new manual transaction.
   */
  create: async (payload: TransactionCreatePayload): Promise<Transaction> => {
    const res = await api.post<Transaction>("/transactions", payload);
    return res.data;
  },

  /**
   * Update fields of an existing transaction.
   */
  update: async (id: string, payload: TransactionUpdatePayload): Promise<Transaction> => {
    const res = await api.put<Transaction>(`/transactions/${id}`, payload);
    return res.data;
  },

  /**
   * Permanently delete a transaction.
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },
};
