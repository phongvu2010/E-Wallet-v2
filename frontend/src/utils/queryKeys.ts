import { DebtStatus, DebtType } from "../types/debt";
import { InstallmentStatus } from "../types/installment";
import { TransactionFilterParams } from "../types/transaction";

/**
 * Type-Safe Query Key Factory for TanStack Query v5.
 * 
 * Provides hierarchical, structured query keys to enable targeted queries
 * as well as cascading prefix-based cache invalidation.
 */
export const queryKeys = {
  // ------------------------------------------------------------------
  // 1. ACCOUNTS & LIVE BALANCES
  // ------------------------------------------------------------------
  accounts: {
    all: ["accounts"] as const,
    lists: () => [...queryKeys.accounts.all, "list"] as const,
    live: (accountId?: string) =>
      [...queryKeys.accounts.all, "live", accountId || "all"] as const,
    benefits: (accountId?: string) =>
      [...queryKeys.accounts.all, "benefits", accountId || "all"] as const,
  },

  // ------------------------------------------------------------------
  // 2. TRANSACTIONS & LEDGER
  // ------------------------------------------------------------------
  transactions: {
    all: ["transactions"] as const,
    lists: () => [...queryKeys.transactions.all, "list"] as const,
    list: (params?: TransactionFilterParams) =>
      [...queryKeys.transactions.lists(), params ?? {}] as const,
    summary: (accountId?: string, statementId?: string) =>
      [
        ...queryKeys.transactions.all,
        "summary",
        accountId || "all",
        statementId || "all",
      ] as const,
  },

  // ------------------------------------------------------------------
  // 3. STATEMENTS & RECONCILIATION
  // ------------------------------------------------------------------
  statements: {
    all: ["statements"] as const,
    list: (accountId?: string, year?: number) =>
      [
        ...queryKeys.statements.all,
        "list",
        accountId || "all",
        year || "all",
      ] as const,
    reconciliation: (accountId?: string) =>
      [
        ...queryKeys.statements.all,
        "reconciliation",
        accountId || "all",
      ] as const,
    paymentStatus: (accountId?: string) =>
      [
        ...queryKeys.statements.all,
        "paymentStatus",
        accountId || "all",
      ] as const,
  },

  // ------------------------------------------------------------------
  // 4. INSTALLMENTS & REWARDS
  // ------------------------------------------------------------------
  installments: {
    all: ["installments"] as const,
    list: (accountId?: string, status?: InstallmentStatus) =>
      [
        ...queryKeys.installments.all,
        "list",
        accountId || "all",
        status || "all",
      ] as const,
    forecast: () => [...queryKeys.installments.all, "forecast"] as const,
  },

  rewards: {
    all: ["rewards"] as const,
    list: (accountId?: string) =>
      [...queryKeys.rewards.all, "list", accountId || "all"] as const,
  },

  // ------------------------------------------------------------------
  // 5. ANALYTICS & DASHBOARD KPIS
  // ------------------------------------------------------------------
  analytics: {
    all: ["analytics"] as const,
    dashboardOverview: () =>
      [...queryKeys.analytics.all, "dashboardOverview"] as const,
    netWorth: () => [...queryKeys.analytics.all, "netWorth"] as const,
    cashFlow: (limit = 24) =>
      [...queryKeys.analytics.all, "cashFlow", limit] as const,
    monthlySpending: (limit = 200) =>
      [...queryKeys.analytics.all, "monthlySpending", limit] as const,
    upcomingObligations: (daysAhead = 30) =>
      [...queryKeys.analytics.all, "upcomingObligations", daysAhead] as const,
    creditUtilization: () =>
      [...queryKeys.analytics.all, "creditUtilization"] as const,
  },

  // ------------------------------------------------------------------
  // 6. CATEGORIES, MERCHANTS & BENEFITS
  // ------------------------------------------------------------------
  categories: {
    all: ["categories"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
    tree: () => [...queryKeys.categories.all, "tree"] as const,
  },

  merchants: {
    all: ["merchants"] as const,
    suggestions: (limit = 100) =>
      [...queryKeys.merchants.all, "suggestions", limit] as const,
  },

  institutions: {
    all: ["institutions"] as const,
    list: () => [...queryKeys.institutions.all, "list"] as const,
  },

  // ------------------------------------------------------------------
  // 7. FINANCIAL LOANS & FLOATING INTEREST RATE
  // ------------------------------------------------------------------
  loans: {
    all: ["loans"] as const,
    lists: (status?: string, institutionId?: string) =>
      [
        ...queryKeys.loans.all,
        "list",
        status || "all",
        institutionId || "all",
      ] as const,
    kpis: () => [...queryKeys.loans.all, "kpis"] as const,
    detail: (id?: string) => [...queryKeys.loans.all, "detail", id || ""] as const,
  },

  // ------------------------------------------------------------------
  // 8. PERSONAL DEBTS & P2P LENDING
  // ------------------------------------------------------------------
  debts: {
    all: ["debts"] as const,
    lists: (params?: {
      debt_type?: DebtType;
      status?: DebtStatus;
      search?: string;
    }) => [...queryKeys.debts.all, "list", params ?? {}] as const,
    kpis: () => [...queryKeys.debts.all, "kpis"] as const,
    detail: (id?: string) => [...queryKeys.debts.all, "detail", id || ""] as const,
  },

  // ------------------------------------------------------------------
  // 9. NOTIFICATIONS & TELEGRAM SYSTEM
  // ------------------------------------------------------------------
  notifications: {
    all: ["notifications"] as const,
    summary: () => [...queryKeys.notifications.all, "summary"] as const,
    list: (limit = 50, unreadOnly = false) =>
      [...queryKeys.notifications.all, "list", limit, unreadOnly] as const,
    settings: () => [...queryKeys.notifications.all, "settings"] as const,
    schedulerStatus: () =>
      [...queryKeys.notifications.all, "schedulerStatus"] as const,
  },

  telegram: {
    all: ["telegram"] as const,
    status: () => [...queryKeys.telegram.all, "status"] as const,
  },
};
