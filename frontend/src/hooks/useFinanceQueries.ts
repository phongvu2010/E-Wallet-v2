import { useQuery } from "@tanstack/react-query";
import { accountService } from "../services/accountService";
import { transactionService } from "../services/transactionService";
import { statementService } from "../services/statementService";
import { installmentService } from "../services/installmentService";
import { rewardService } from "../services/rewardService";
import { analyticsService } from "../services/analyticsService";
import { categoryService } from "../services/categoryService";
import { TransactionFilterParams } from "../types/transaction";
import { InstallmentStatus } from "../types/installment";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAll(),
  });
}

export function useAccountLiveBalances(accountId?: string) {
  return useQuery({
    queryKey: ["accounts-live", accountId || "all"],
    queryFn: () => accountService.getLiveBalances(accountId),
  });
}

export function useTransactions(params: TransactionFilterParams) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => transactionService.getFiltered(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useTransactionSummary(accountId?: string, statementId?: string) {
  return useQuery({
    queryKey: ["transaction-summary", accountId || "all", statementId || "all"],
    queryFn: () => transactionService.getSummary(accountId, statementId),
  });
}

export function useStatements(accountId?: string, year?: number) {
  return useQuery({
    queryKey: ["statements", accountId || "all", year || "all"],
    queryFn: () => statementService.getAll(accountId, year),
  });
}

export function useStatementReconciliation(accountId?: string) {
  return useQuery({
    queryKey: ["statement-reconciliation", accountId || "all"],
    queryFn: () => statementService.getReconciliation(accountId),
  });
}

export function useStatementPaymentStatus(accountId?: string) {
  return useQuery({
    queryKey: ["statement-payment-status", accountId || "all"],
    queryFn: () => statementService.getPaymentStatus(accountId),
  });
}

export function useInstallments(accountId?: string, status?: InstallmentStatus) {
  return useQuery({
    queryKey: ["installments", accountId || "all", status || "all"],
    queryFn: () => installmentService.getAll(accountId, status),
  });
}

export function useInstallmentForecast() {
  return useQuery({
    queryKey: ["installment-forecast"],
    queryFn: () => installmentService.getForecast(),
  });
}

export function useRewards(accountId?: string) {
  return useQuery({
    queryKey: ["rewards", accountId || "all"],
    queryFn: () => rewardService.getAll(accountId),
  });
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => analyticsService.getOverview(),
  });
}

export function useMonthlySpending(limit = 20) {
  return useQuery({
    queryKey: ["monthly-spending", limit],
    queryFn: () => analyticsService.getMonthlySpending(limit),
  });
}

export function useUpcomingObligations(daysAhead = 30) {
  return useQuery({
    queryKey: ["upcoming-obligations", daysAhead],
    queryFn: () => analyticsService.getUpcomingObligations(daysAhead),
  });
}

export function useCreditUtilization() {
  return useQuery({
    queryKey: ["credit-utilization"],
    queryFn: () => analyticsService.getCreditUtilization(),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.getAll(),
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ["category-tree"],
    queryFn: () => categoryService.getTree(),
  });
}

