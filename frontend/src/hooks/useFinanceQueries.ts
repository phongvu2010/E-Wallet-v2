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

/**
 * Query hook to fetch all credit card accounts.
 */
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAll(),
  });
}

/**
 * Query hook to fetch real-time live balances and remaining limits.
 */
export function useAccountLiveBalances(accountId?: string) {
  return useQuery({
    queryKey: ["accounts-live", accountId || "all"],
    queryFn: () => accountService.getLiveBalances(accountId),
  });
}

/**
 * Query hook to fetch filtered and paginated transactions.
 */
export function useTransactions(params: TransactionFilterParams) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => transactionService.getFiltered(params),
    placeholderData: (previousData: any) => previousData,
  });
}

/**
 * Query hook to fetch transaction statistical summary.
 */
export function useTransactionSummary(accountId?: string, statementId?: string) {
  return useQuery({
    queryKey: ["transaction-summary", accountId || "all", statementId || "all"],
    queryFn: () => transactionService.getSummary(accountId, statementId),
  });
}

/**
 * Query hook to fetch credit card statements.
 */
export function useStatements(accountId?: string, year?: number) {
  return useQuery({
    queryKey: ["statements", accountId || "all", year || "all"],
    queryFn: () => statementService.getAll(accountId, year),
  });
}

/**
 * Query hook to fetch 3-way statement reconciliation audit results.
 */
export function useStatementReconciliation(accountId?: string) {
  return useQuery({
    queryKey: ["statement-reconciliation", accountId || "all"],
    queryFn: () => statementService.getReconciliation(accountId),
  });
}

/**
 * Query hook to fetch statement payment progress and overdue tracking.
 */
export function useStatementPaymentStatus(accountId?: string) {
  return useQuery({
    queryKey: ["statement-payment-status", accountId || "all"],
    queryFn: () => statementService.getPaymentStatus(accountId),
  });
}

/**
 * Query hook to fetch installment plans.
 */
export function useInstallments(accountId?: string, status?: InstallmentStatus) {
  return useQuery({
    queryKey: ["installments", accountId || "all", status || "all"],
    queryFn: () => installmentService.getAll(accountId, status),
  });
}

/**
 * Query hook to fetch future installment cash flow obligations forecast.
 */
export function useInstallmentForecast() {
  return useQuery({
    queryKey: ["installment-forecast"],
    queryFn: () => installmentService.getForecast(),
  });
}

/**
 * Query hook to fetch reward points and cashback ledgers.
 */
export function useRewards(accountId?: string) {
  return useQuery({
    queryKey: ["rewards", accountId || "all"],
    queryFn: () => rewardService.getAll(accountId),
  });
}

/**
 * Query hook to fetch consolidated portfolio overview KPIs for dashboard.
 */
export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => analyticsService.getOverview(),
  });
}

/**
 * Query hook to fetch monthly spending by category.
 */
export function useMonthlySpending(limit = 20) {
  return useQuery({
    queryKey: ["monthly-spending", limit],
    queryFn: () => analyticsService.getMonthlySpending(limit),
  });
}

/**
 * Query hook to fetch upcoming payment deadlines (30 days window).
 */
export function useUpcomingObligations(daysAhead = 30) {
  return useQuery({
    queryKey: ["upcoming-obligations", daysAhead],
    queryFn: () => analyticsService.getUpcomingObligations(daysAhead),
  });
}

/**
 * Query hook to fetch credit limit utilization and risk assessment.
 */
export function useCreditUtilization() {
  return useQuery({
    queryKey: ["credit-utilization"],
    queryFn: () => analyticsService.getCreditUtilization(),
  });
}

import { notificationService } from "../services/notificationService";
import { recommendationService } from "../services/recommendationService";
import { merchantService } from "../services/merchantService";

/**
 * Query hook to fetch all categories as flat list.
 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.getAll(),
  });
}

/**
 * Query hook to fetch 2-tier parent-child category tree.
 */
export function useCategoryTree() {
  return useQuery({
    queryKey: ["category-tree"],
    queryFn: () => categoryService.getTree(),
  });
}

/**
 * Query hook to fetch notification summary & unread count (auto-refreshed every 30s).
 */
export function useNotificationSummary() {
  return useQuery({
    queryKey: ["notification-summary"],
    queryFn: () => notificationService.getSummary(),
    refetchInterval: 30000,
  });
}

/**
 * Query hook to fetch notifications list.
 */
export function useNotifications(limit = 50, unreadOnly = false) {
  return useQuery({
    queryKey: ["notifications", limit, unreadOnly],
    queryFn: () => notificationService.getAll(limit, unreadOnly),
  });
}

/**
 * Query hook to fetch notification & Telegram settings.
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => notificationService.getSettings(),
  });
}

/**
 * Query hook to fetch card benefits matrix.
 */
export function useCardBenefits(accountId?: string) {
  return useQuery({
    queryKey: ["card-benefits", accountId || "all"],
    queryFn: () => recommendationService.getBenefits(accountId),
  });
}

/**
 * Query hook to fetch merchant suggestions for smart autocomplete.
 */
export function useMerchantSuggestions() {
  return useQuery({
    queryKey: ["merchant-suggestions"],
    queryFn: () => merchantService.getSuggestions(100),
    staleTime: 5 * 60 * 1000,
  });
}
