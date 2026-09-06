import { api } from "./api";
import {
  AdjustLoanRatePayload,
  EarlySettleLoanPayload,
  Loan,
  LoanCreatePayload,
  LoanSummaryKPIs,
  LoanUpdatePayload,
  PayLoanPeriodPayload,
} from "../types/loan";

/**
 * Frontend API client for Financial Loans and Floating Interest Rate Management.
 */
export const loanService = {
  /**
   * Fetch all financial loans, optionally filtered by status or institution.
   */
  getAll: async (status?: string, institutionId?: string): Promise<Loan[]> => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (institutionId) params.institution_id = institutionId;
    const res = await api.get<Loan[]>("/loans", { params });
    return res.data;
  },

  /**
   * Fetch overall high-level summary KPIs.
   */
  getSummaryKPIs: async (): Promise<LoanSummaryKPIs> => {
    const res = await api.get<LoanSummaryKPIs>("/loans/summary/kpis");
    return res.data;
  },

  /**
   * Fetch single loan details with complete amortization schedule and rate history.
   */
  getById: async (id: string): Promise<Loan> => {
    const res = await api.get<Loan>(`/loans/${id}`);
    return res.data;
  },

  /**
   * Create a new loan package.
   */
  create: async (payload: LoanCreatePayload): Promise<Loan> => {
    const res = await api.post<Loan>("/loans", payload);
    return res.data;
  },

  /**
   * Update loan metadata.
   */
  update: async (id: string, payload: LoanUpdatePayload): Promise<Loan> => {
    const res = await api.put<Loan>(`/loans/${id}`, payload);
    return res.data;
  },

  /**
   * Adjust floating interest rate for remaining unpaid periods.
   */
  adjustRate: async (id: string, payload: AdjustLoanRatePayload): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/adjust-rate`, payload);
    return res.data;
  },

  /**
   * Pay a single installment period.
   */
  payPeriod: async (id: string, payload: PayLoanPeriodPayload): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/pay-period`, payload);
    return res.data;
  },

  /**
   * Early settle the entire loan.
   */
  earlySettle: async (id: string, payload: EarlySettleLoanPayload): Promise<Loan> => {
    const res = await api.post<Loan>(`/loans/${id}/early-settle`, payload);
    return res.data;
  },

  /**
   * Delete a loan package.
   */
  delete: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/loans/${id}`);
    return res.data;
  },
};
