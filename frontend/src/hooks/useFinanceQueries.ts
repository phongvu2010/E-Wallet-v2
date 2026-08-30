import { useQuery } from "../providers/QueryProvider";
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
  return useQuery(["accounts"], () => accountService.getAll());
}

export function useAccountLiveBalances(accountId?: string) {
  return useQuery(["accounts-live", accountId || "all"], () =>
    accountService.getLiveBalances(accountId)
  );
}

export function useTransactions(params: TransactionFilterParams) {
  return useQuery(["transactions", params], () =>
    transactionService.getFiltered(params)
  );
}

export function useTransactionSummary(accountId?: string, statementId?: string) {
  return useQuery(["transaction-summary", accountId || "all", statementId || "all"], () =>
    transactionService.getSummary(accountId, statementId)
  );
}

export function useStatements(accountId?: string, year?: number) {
  return useQuery(["statements", accountId || "all", year || "all"], () =>
    statementService.getAll(accountId, year)
  );
}

export function useStatementReconciliation(accountId?: string) {
  return useQuery(["statement-reconciliation", accountId || "all"], () =>
    statementService.getReconciliation(accountId)
  );
}

export function useStatementPaymentStatus(accountId?: string) {
  return useQuery(["statement-payment-status", accountId || "all"], () =>
    statementService.getPaymentStatus(accountId)
  );
}

export function useInstallments(accountId?: string, status?: InstallmentStatus) {
  return useQuery(["installments", accountId || "all", status || "all"], () =>
    installmentService.getAll(accountId, status)
  );
}

export function useInstallmentForecast() {
  return useQuery(["installment-forecast"], () =>
    installmentService.getForecast()
  );
}

export function useRewards(accountId?: string) {
  return useQuery(["rewards", accountId || "all"], () =>
    rewardService.getAll(accountId)
  );
}

export function useDashboardOverview() {
  return useQuery(["dashboard-overview"], () =>
    analyticsService.getOverview()
  );
}

export function useMonthlySpending(limit = 20) {
  return useQuery(["monthly-spending", limit], () =>
    analyticsService.getMonthlySpending(limit)
  );
}

export function useCreditUtilization() {
  return useQuery(["credit-utilization"], () =>
    analyticsService.getCreditUtilization()
  );
}

export function useCategories() {
  return useQuery(["categories"], () => categoryService.getAll());
}

export function useCategoryTree() {
  return useQuery(["category-tree"], () => categoryService.getTree());
}
