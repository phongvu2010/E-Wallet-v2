import { api } from "./api";
import {
  Transaction,
  TransactionFilterParams,
  TransactionSummary,
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from "../types/transaction";
import { PaginatedResponse } from "../types/common";

export const transactionService = {
  getFiltered: async (params: TransactionFilterParams = {}): Promise<PaginatedResponse<Transaction>> => {
    const res = await api.get<PaginatedResponse<Transaction>>("/transactions", { params });
    return res.data;
  },

  getSummary: async (accountId?: string, statementId?: string): Promise<TransactionSummary> => {
    const params: Record<string, string> = {};
    if (accountId) params.account_id = accountId;
    if (statementId) params.statement_id = statementId;
    const res = await api.get<TransactionSummary>("/transactions/summary", { params });
    return res.data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const res = await api.get<Transaction>(`/transactions/${id}`);
    return res.data;
  },

  create: async (payload: TransactionCreatePayload): Promise<Transaction> => {
    const res = await api.post<Transaction>("/transactions", payload);
    return res.data;
  },

  update: async (id: string, payload: TransactionUpdatePayload): Promise<Transaction> => {
    const res = await api.put<Transaction>(`/transactions/${id}`, payload);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/transactions/${id}`);
  },
};
