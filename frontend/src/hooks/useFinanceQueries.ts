import { useQuery } from "@tanstack/react-query";
import { accountService } from "../services/accountService";
import { transactionService } from "../services/transactionService";
import { statementService } from "../services/statementService";
import { installmentService } from "../services/installmentService";
import { rewardService } from "../services/rewardService";
import { analyticsService } from "../services/analyticsService";
import { categoryService } from "../services/categoryService";
import { notificationService } from "../services/notificationService";
import { telegramService } from "../services/telegramService";
import { recommendationService } from "../services/recommendationService";
import { merchantService } from "../services/merchantService";
import { institutionService } from "../services/institutionService";
import { loanService } from "../services/loanService";
import { TransactionFilterParams } from "../types/transaction";
import { InstallmentStatus } from "../types/installment";

// ====================================================================
// 1. ACCOUNTS & LIVE BALANCES
// ====================================================================

/**
 * Query hook to fetch all credit card accounts (cached for 10 mins).
 */
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => accountService.getAll(),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query hook to fetch real-time live balances and remaining limits (refreshed every 30s).
 */
export function useAccountLiveBalances(accountId?: string) {
  return useQuery({
    queryKey: ["accounts-live", accountId || "all"],
    queryFn: () => accountService.getLiveBalances(accountId),
    staleTime: 30 * 1000,
  });
}

// ====================================================================
// 2. TRANSACTIONS & LEDGER
// ====================================================================

/**
 * Query hook to fetch filtered and paginated transactions.
 */
export function useTransactions(params: TransactionFilterParams) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => transactionService.getFiltered(params),
    placeholderData: (previousData: any) => previousData,
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch transaction statistical summary.
 */
export function useTransactionSummary(accountId?: string, statementId?: string) {
  return useQuery({
    queryKey: ["transaction-summary", accountId || "all", statementId || "all"],
    queryFn: () => transactionService.getSummary(accountId, statementId),
    staleTime: 30 * 1000,
  });
}

// ====================================================================
// 3. STATEMENTS & RECONCILIATION
// ====================================================================

/**
 * Query hook to fetch credit card statements (cached 2 mins).
 */
export function useStatements(accountId?: string, year?: number) {
  return useQuery({
    queryKey: ["statements", accountId || "all", year || "all"],
    queryFn: () => statementService.getAll(accountId, year),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch 3-way statement reconciliation audit results (cached 2 mins).
 */
export function useStatementReconciliation(accountId?: string) {
  return useQuery({
    queryKey: ["statement-reconciliation", accountId || "all"],
    queryFn: () => statementService.getReconciliation(accountId),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch statement payment progress and overdue tracking (cached 1 min).
 */
export function useStatementPaymentStatus(accountId?: string) {
  return useQuery({
    queryKey: ["statement-payment-status", accountId || "all"],
    queryFn: () => statementService.getPaymentStatus(accountId),
    staleTime: 60 * 1000,
  });
}

// ====================================================================
// 4. INSTALLMENTS & REWARDS
// ====================================================================

/**
 * Query hook to fetch installment plans (cached 2 mins).
 */
export function useInstallments(accountId?: string, status?: InstallmentStatus) {
  return useQuery({
    queryKey: ["installments", accountId || "all", status || "all"],
    queryFn: () => installmentService.getAll(accountId, status),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch future installment cash flow obligations forecast (cached 2 mins).
 */
export function useInstallmentForecast() {
  return useQuery({
    queryKey: ["installment-forecast"],
    queryFn: () => installmentService.getForecast(),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch reward points and cashback ledgers (cached 2 mins).
 */
export function useRewards(accountId?: string) {
  return useQuery({
    queryKey: ["rewards", accountId || "all"],
    queryFn: () => rewardService.getAll(accountId),
    staleTime: 2 * 60 * 1000,
  });
}

// ====================================================================
// 5. ANALYTICS & DASHBOARD KPIS
// ====================================================================

/**
 * Query hook to fetch consolidated portfolio overview KPIs for dashboard.
 */
export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => analyticsService.getOverview(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch full Net Worth overview & asset breakdown.
 */
export function useNetWorth() {
  return useQuery({
    queryKey: ["net-worth"],
    queryFn: () => analyticsService.getNetWorth(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch monthly cash flow (Income vs Expense vs Savings).
 */
export function useCashFlow(limit = 24) {
  return useQuery({
    queryKey: ["cash-flow", limit],
    queryFn: () => analyticsService.getCashFlow(limit),
    staleTime: 60 * 1000,
  });
}

/**
 * Query hook to fetch monthly spending by category (cached 2 mins).
 */
export function useMonthlySpending(limit = 200) {
  return useQuery({
    queryKey: ["monthly-spending", limit],
    queryFn: () => analyticsService.getMonthlySpending(limit),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch upcoming payment deadlines (30 days window).
 */
export function useUpcomingObligations(daysAhead = 30) {
  return useQuery({
    queryKey: ["upcoming-obligations", daysAhead],
    queryFn: () => analyticsService.getUpcomingObligations(daysAhead),
    staleTime: 60 * 1000,
  });
}

/**
 * Query hook to fetch credit limit utilization and risk assessment.
 */
export function useCreditUtilization() {
  return useQuery({
    queryKey: ["credit-utilization"],
    queryFn: () => analyticsService.getCreditUtilization(),
    staleTime: 60 * 1000,
  });
}

// ====================================================================
// 6. CATEGORIES, MERCHANTS & BENEFITS
// ====================================================================

/**
 * Query hook to fetch all categories as flat list (cached 15 mins).
 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.getAll(),
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Query hook to fetch 2-tier parent-child category tree (cached 15 mins).
 */
export function useCategoryTree() {
  return useQuery({
    queryKey: ["category-tree"],
    queryFn: () => categoryService.getTree(),
    staleTime: 15 * 60 * 1000,
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
    staleTime: 20 * 1000,
  });
}

/**
 * Query hook to fetch notifications list.
 */
export function useNotifications(limit = 50, unreadOnly = false) {
  return useQuery({
    queryKey: ["notifications", limit, unreadOnly],
    queryFn: () => notificationService.getAll(limit, unreadOnly),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch notification & Telegram settings (cached 5 mins).
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => notificationService.getSettings(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Query hook to fetch card benefits matrix (cached 10 mins).
 */
export function useCardBenefits(accountId?: string) {
  return useQuery({
    queryKey: ["card-benefits", accountId || "all"],
    queryFn: () => recommendationService.getBenefits(accountId),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query hook to fetch merchant suggestions for smart autocomplete (cached 10 mins).
 */
export function useMerchantSuggestions() {
  return useQuery({
    queryKey: ["merchant-suggestions"],
    queryFn: () => merchantService.getSuggestions(100),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query hook to fetch all banking & e-wallet institutions.
 */
export function useInstitutions() {
  return useQuery({
    queryKey: ["institutions"],
    queryFn: () => institutionService.getAll(),
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Query hook to fetch background alert scheduler diagnostics.
 */
export function useSchedulerStatus() {
  return useQuery({
    queryKey: ["scheduler-status"],
    queryFn: () => notificationService.getSchedulerStatus(),
    refetchInterval: 30000,
    staleTime: 15 * 1000,
  });
}

/**
 * Query hook to fetch Telegram Bot 2-way polling status & diagnostic metrics.
 */
export function useTelegramBotStatus() {
  return useQuery({
    queryKey: ["telegram-bot-status"],
    queryFn: () => telegramService.getStatus(),
    refetchInterval: 15000,
    staleTime: 10 * 1000,
  });
}

// ====================================================================
// 7. FINANCIAL LOANS & FLOATING INTEREST RATE
// ====================================================================

/**
 * Query hook to fetch all financial loans.
 */
export function useLoans(status?: string, institutionId?: string) {
  return useQuery({
    queryKey: ["loans", status, institutionId],
    queryFn: () => loanService.getAll(status, institutionId),
    staleTime: 60 * 1000,
  });
}

/**
 * Query hook to fetch overall high-level loans KPIs.
 */
export function useLoanKPIs() {
  return useQuery({
    queryKey: ["loans-kpis"],
    queryFn: () => loanService.getSummaryKPIs(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch single loan details with amortization schedule and rate history.
 */
export function useLoan(id?: string) {
  return useQuery({
    queryKey: ["loan", id],
    queryFn: () => (id ? loanService.getById(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

