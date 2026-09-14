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
import { debtService } from "../services/debtService";
import { TransactionFilterParams } from "../types/transaction";
import { InstallmentStatus } from "../types/installment";
import { DebtStatus, DebtType } from "../types/debt";
import { queryKeys } from "../utils/queryKeys";

// ====================================================================
// 1. ACCOUNTS & LIVE BALANCES
// ====================================================================

/**
 * Query hook to fetch all credit card accounts (cached for 10 mins).
 */
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.lists(),
    queryFn: () => accountService.getAll(),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query hook to fetch real-time live balances and remaining limits (refreshed every 30s).
 */
export function useAccountLiveBalances(accountId?: string) {
  return useQuery({
    queryKey: queryKeys.accounts.live(accountId),
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
    queryKey: queryKeys.transactions.list(params),
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
    queryKey: queryKeys.transactions.summary(accountId, statementId),
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
    queryKey: queryKeys.statements.list(accountId, year),
    queryFn: () => statementService.getAll(accountId, year),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch 3-way statement reconciliation audit results (cached 2 mins).
 */
export function useStatementReconciliation(accountId?: string) {
  return useQuery({
    queryKey: queryKeys.statements.reconciliation(accountId),
    queryFn: () => statementService.getReconciliation(accountId),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch statement payment progress and overdue tracking (cached 1 min).
 */
export function useStatementPaymentStatus(accountId?: string) {
  return useQuery({
    queryKey: queryKeys.statements.paymentStatus(accountId),
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
    queryKey: queryKeys.installments.list(accountId, status),
    queryFn: () => installmentService.getAll(accountId, status),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch future installment cash flow obligations forecast (cached 2 mins).
 */
export function useInstallmentForecast() {
  return useQuery({
    queryKey: queryKeys.installments.forecast(),
    queryFn: () => installmentService.getForecast(),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch reward points and cashback ledgers (cached 2 mins).
 */
export function useRewards(accountId?: string) {
  return useQuery({
    queryKey: queryKeys.rewards.list(accountId),
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
    queryKey: queryKeys.analytics.dashboardOverview(),
    queryFn: () => analyticsService.getOverview(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch full Net Worth overview & asset breakdown.
 */
export function useNetWorth() {
  return useQuery({
    queryKey: queryKeys.analytics.netWorth(),
    queryFn: () => analyticsService.getNetWorth(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch monthly cash flow (Income vs Expense vs Savings).
 */
export function useCashFlow(limit = 24) {
  return useQuery({
    queryKey: queryKeys.analytics.cashFlow(limit),
    queryFn: () => analyticsService.getCashFlow(limit),
    staleTime: 60 * 1000,
  });
}

/**
 * Query hook to fetch monthly spending by category (cached 2 mins).
 */
export function useMonthlySpending(limit = 200) {
  return useQuery({
    queryKey: queryKeys.analytics.monthlySpending(limit),
    queryFn: () => analyticsService.getMonthlySpending(limit),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Query hook to fetch upcoming payment deadlines (30 days window).
 */
export function useUpcomingObligations(daysAhead = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.upcomingObligations(daysAhead),
    queryFn: () => analyticsService.getUpcomingObligations(daysAhead),
    staleTime: 60 * 1000,
  });
}

/**
 * Query hook to fetch credit limit utilization and risk assessment.
 */
export function useCreditUtilization() {
  return useQuery({
    queryKey: queryKeys.analytics.creditUtilization(),
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
    queryKey: queryKeys.categories.list(),
    queryFn: () => categoryService.getAll(),
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Query hook to fetch 2-tier parent-child category tree (cached 15 mins).
 */
export function useCategoryTree() {
  return useQuery({
    queryKey: queryKeys.categories.tree(),
    queryFn: () => categoryService.getTree(),
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Query hook to fetch notification summary & unread count (auto-refreshed every 30s).
 */
export function useNotificationSummary() {
  return useQuery({
    queryKey: queryKeys.notifications.summary(),
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
    queryKey: queryKeys.notifications.list(limit, unreadOnly),
    queryFn: () => notificationService.getAll(limit, unreadOnly),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch notification & Telegram settings (cached 5 mins).
 */
export function useNotificationSettings() {
  return useQuery({
    queryKey: queryKeys.notifications.settings(),
    queryFn: () => notificationService.getSettings(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Query hook to fetch card benefits matrix (cached 10 mins).
 */
export function useCardBenefits(accountId?: string) {
  return useQuery({
    queryKey: queryKeys.accounts.benefits(accountId),
    queryFn: () => recommendationService.getBenefits(accountId),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query hook to fetch merchant suggestions for smart autocomplete (cached 10 mins).
 */
export function useMerchantSuggestions() {
  return useQuery({
    queryKey: queryKeys.merchants.suggestions(100),
    queryFn: () => merchantService.getSuggestions(100),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Query hook to fetch all banking & e-wallet institutions.
 */
export function useInstitutions() {
  return useQuery({
    queryKey: queryKeys.institutions.list(),
    queryFn: () => institutionService.getAll(),
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Query hook to fetch background alert scheduler diagnostics.
 */
export function useSchedulerStatus() {
  return useQuery({
    queryKey: queryKeys.notifications.schedulerStatus(),
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
    queryKey: queryKeys.telegram.status(),
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
    queryKey: queryKeys.loans.lists(status, institutionId),
    queryFn: () => loanService.getAll(status, institutionId),
    staleTime: 60 * 1000,
  });
}

/**
 * Query hook to fetch overall high-level loans KPIs.
 */
export function useLoanKPIs() {
  return useQuery({
    queryKey: queryKeys.loans.kpis(),
    queryFn: () => loanService.getSummaryKPIs(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch single loan details with amortization schedule and rate history.
 */
export function useLoan(id?: string) {
  return useQuery({
    queryKey: queryKeys.loans.detail(id),
    queryFn: () => (id ? loanService.getById(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// ====================================================================
// 8. PERSONAL DEBTS & P2P LENDING
// ====================================================================

/**
 * Query hook to fetch all personal debts.
 */
export function useDebts(params?: {
  debt_type?: DebtType;
  status?: DebtStatus;
  search?: string;
}) {
  return useQuery({
    queryKey: queryKeys.debts.lists(params),
    queryFn: () => debtService.getAll(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch summary KPIs for personal borrowing and lending.
 */
export function useDebtKPIs() {
  return useQuery({
    queryKey: queryKeys.debts.kpis(),
    queryFn: () => debtService.getKPIs(),
    staleTime: 30 * 1000,
  });
}

/**
 * Query hook to fetch single debt detail with all repayments.
 */
export function useDebt(id?: string) {
  return useQuery({
    queryKey: queryKeys.debts.detail(id),
    queryFn: () => (id ? debtService.getById(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
