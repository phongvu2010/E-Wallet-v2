import { api } from "./api";
import {
  Account,
  AccountOverview,
  AccountLiveBalance,
  AccountCreatePayload,
  AccountUpdatePayload,
} from "../types/account";

export const accountService = {
  getAll: async (status?: string): Promise<Account[]> => {
    const params = status ? { status } : {};
    const res = await api.get<Account[]>("/accounts", { params });
    return res.data;
  },

  getOverview: async (): Promise<AccountOverview[]> => {
    const res = await api.get<AccountOverview[]>("/accounts/overview");
    return res.data;
  },

  getLiveBalances: async (accountId?: string): Promise<AccountLiveBalance[]> => {
    const url = accountId ? `/accounts/${accountId}/live-balance` : "/accounts/live-balance";
    const res = await api.get<AccountLiveBalance[] | AccountLiveBalance>(url);
    return Array.isArray(res.data) ? res.data : [res.data];
  },

  getById: async (id: string): Promise<Account> => {
    const res = await api.get<Account>(`/accounts/${id}`);
    return res.data;
  },

  create: async (payload: AccountCreatePayload): Promise<Account> => {
    const res = await api.post<Account>("/accounts", payload);
    return res.data;
  },

  update: async (id: string, payload: AccountUpdatePayload): Promise<Account> => {
    const res = await api.put<Account>(`/accounts/${id}`, payload);
    return res.data;
  },
};
