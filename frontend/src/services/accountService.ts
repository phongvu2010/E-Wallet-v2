import { api } from "./api";
import {
  Account,
  AccountStatus,
  AccountOverview,
  AccountLiveBalance,
  AccountCreatePayload,
  AccountUpdatePayload,
} from "../types/account";

/**
 * Frontend API client for Credit Card Accounts.
 */
export const accountService = {
  /**
   * Fetch all accounts, optionally filtered by status.
   */
  getAll: async (status?: string): Promise<Account[]> => {
    const params = status ? { status } : {};
    const res = await api.get<Account[]>("/accounts", { params });
    return res.data;
  },

  /**
   * Fetch high-level accounts overview with latest statement balances.
   */
  getOverview: async (): Promise<AccountOverview[]> => {
    const res = await api.get<AccountOverview[]>("/accounts/overview");
    return res.data;
  },

  /**
   * Fetch real-time live balances and available credit limits for all cards or a specific card.
   */
  getLiveBalances: async (accountId?: string): Promise<AccountLiveBalance[]> => {
    const url = accountId ? `/accounts/${accountId}/live-balance` : "/accounts/live-balance";
    const res = await api.get<AccountLiveBalance[] | AccountLiveBalance>(url);
    return Array.isArray(res.data) ? res.data : [res.data];
  },

  /**
   * Fetch a single card by its UUID.
   */
  getById: async (id: string): Promise<Account> => {
    const res = await api.get<Account>(`/accounts/${id}`);
    return res.data;
  },

  /**
   * Create a new card account.
   */
  create: async (payload: AccountCreatePayload): Promise<Account> => {
    const res = await api.post<Account>("/accounts", payload);
    return res.data;
  },

  /**
   * Update details of an existing card account.
   */
  update: async (id: string, payload: AccountUpdatePayload): Promise<Account> => {
    const res = await api.put<Account>(`/accounts/${id}`, payload);
    return res.data;
  },

  /**
   * Explicitly change the operational status of an account.
   */
  updateStatus: async (id: string, status: AccountStatus): Promise<Account> => {
    const res = await api.patch<Account>(`/accounts/${id}/status`, { status });
    return res.data;
  },

  /**
   * Lock/freeze a card account.
   */
  disable: async (id: string): Promise<Account> => {
    const res = await api.patch<Account>(`/accounts/${id}/disable`);
    return res.data;
  },

  /**
   * Unlock/enable a locked card account.
   */
  enable: async (id: string): Promise<Account> => {
    const res = await api.patch<Account>(`/accounts/${id}/enable`);
    return res.data;
  },

  /**
   * Toggle account operational status between ACTIVE and LOCKED.
   */
  toggleStatus: async (id: string): Promise<Account> => {
    const res = await api.patch<Account>(`/accounts/${id}/toggle-status`);
    return res.data;
  },
};

