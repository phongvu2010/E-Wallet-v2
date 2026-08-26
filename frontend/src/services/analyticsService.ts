import { api } from "./api";
import {
  DashboardOverview,
  MonthlyCategorySpending,
  CreditUtilization,
  UpcomingObligation,
} from "../types/analytics";

export const analyticsService = {
  getOverview: async (): Promise<DashboardOverview> => {
    const res = await api.get<DashboardOverview>("/analytics/overview");
    return res.data;
  },

  getMonthlySpending: async (limit: number = 50): Promise<MonthlyCategorySpending[]> => {
    const res = await api.get<MonthlyCategorySpending[]>("/analytics/monthly-spending", {
      params: { limit },
    });
    return res.data;
  },

  getCreditUtilization: async (): Promise<CreditUtilization[]> => {
    const res = await api.get<CreditUtilization[]>("/analytics/credit-utilization");
    return res.data;
  },

  getUpcomingObligations: async (daysAhead: number = 30): Promise<UpcomingObligation[]> => {
    const res = await api.get<UpcomingObligation[]>("/analytics/upcoming-obligations", {
      params: { days_ahead: daysAhead },
    });
    return res.data;
  },
};
