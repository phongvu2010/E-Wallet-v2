import { api } from "./api";
import {
  DashboardOverview,
  MonthlyCategorySpending,
  CreditUtilization,
  UpcomingObligation,
  NetWorthOverview,
  MonthlyCashFlow,
} from "../types/analytics";

/**
 * Frontend API client for Financial Analytics & Risk KPIs.
 */
export const analyticsService = {
  /**
   * Fetch portfolio-wide high-level dashboard metrics (Total limit, live balance, utilization %, 30d obligations).
   */
  getOverview: async (): Promise<DashboardOverview> => {
    const res = await api.get<DashboardOverview>("/analytics/overview");
    return res.data;
  },

  /**
   * Fetch consolidated Net Worth and wealth allocation metrics.
   */
  getNetWorth: async (): Promise<NetWorthOverview> => {
    const res = await api.get<NetWorthOverview>("/analytics/net-worth");
    return res.data;
  },

  /**
   * Fetch monthly cash flow (Income vs Expense vs Savings).
   */
  getCashFlow: async (limit: number = 12): Promise<MonthlyCashFlow[]> => {
    const res = await api.get<MonthlyCashFlow[]>("/analytics/cash-flow", {
      params: { limit },
    });
    return res.data;
  },

  /**
   * Fetch monthly spending distribution grouped by category.
   */
  getMonthlySpending: async (limit: number = 50): Promise<MonthlyCategorySpending[]> => {
    const res = await api.get<MonthlyCategorySpending[]>("/analytics/monthly-spending", {
      params: { limit },
    });
    return res.data;
  },

  /**
   * Fetch credit utilization percentages and risk assessment grades per card.
   */
  getCreditUtilization: async (): Promise<CreditUtilization[]> => {
    const res = await api.get<CreditUtilization[]>("/analytics/credit-utilization");
    return res.data;
  },

  /**
   * Fetch upcoming payment obligations (Statements + Installments) within the specified days window.
   */
  getUpcomingObligations: async (daysAhead: number = 30): Promise<UpcomingObligation[]> => {
    const res = await api.get<UpcomingObligation[]>("/analytics/upcoming-obligations", {
      params: { days_ahead: daysAhead },
    });
    return res.data;
  },
};
