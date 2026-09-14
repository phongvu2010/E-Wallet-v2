import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountService } from "../services/accountService";
import { categoryService } from "../services/categoryService";
import { debtService } from "../services/debtService";
import { installmentService } from "../services/installmentService";
import { loanService } from "../services/loanService";
import { notificationService } from "../services/notificationService";
import { recommendationService } from "../services/recommendationService";
import { transactionService } from "../services/transactionService";
import {
  AccountCreatePayload,
  AccountStatus,
  AccountUpdatePayload,
} from "../types/account";
import { CardRecommendationRequest } from "../types/cardRecommendation";
import {
  CategoryCreatePayload,
  CategoryUpdatePayload,
} from "../types/category";
import {
  DebtCreatePayload,
  DebtRepaymentPayload,
  DebtUpdatePayload,
} from "../types/debt";
import { EarlySettlePayload } from "../types/installment";
import {
  AdjustLoanRatePayload,
  EarlySettleLoanPayload,
  LoanCreatePayload,
  LoanUpdatePayload,
  PayLoanPeriodPayload,
} from "../types/loan";
import { NotificationSettingsUpdate } from "../types/notification";
import {
  TransactionCreatePayload,
  TransactionUpdatePayload,
} from "../types/transaction";
import { queryKeys } from "../utils/queryKeys";

// ====================================================================
// DOMAIN INVALIDATION HELPERS (CASCADE INVALITADION MATRIX)
// ====================================================================

/**
 * Invalidate all transaction and ledger queries, as well as downstream analytics,
 * accounts, live balances, and statements.
 */
function invalidateTransactionsAndLedger(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.statements.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.installments.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.debts.kpis() });
  queryClient.invalidateQueries({ queryKey: queryKeys.loans.kpis() });
}

/**
 * Invalidate account lists, live balances, card benefits, and dependent analytics.
 */
function invalidateAccountCascade(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
}

/**
 * Invalidate loan domain and connected transactions/accounts/analytics.
 */
function invalidateLoanCascade(queryClient: QueryClient, loanId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.loans.all });
  if (loanId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.loans.detail(loanId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/**
 * Invalidate debt domain and connected transactions/accounts/analytics.
 */
function invalidateDebtCascade(queryClient: QueryClient, debtId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
  if (debtId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.debts.detail(debtId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
}

/**
 * Invalidate category lists, tree hierarchy, and affected transaction/spending views.
 */
function invalidateCategoryCascade(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.analytics.monthlySpending() });
}

// ====================================================================
// 1. TRANSACTIONS MUTATIONS
// ====================================================================

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransactionCreatePayload) =>
      transactionService.create(payload),
    onSuccess: () => {
      invalidateTransactionsAndLedger(queryClient);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: TransactionUpdatePayload;
    }) => transactionService.update(id, payload),
    onSuccess: () => {
      invalidateTransactionsAndLedger(queryClient);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: () => {
      invalidateTransactionsAndLedger(queryClient);
    },
  });
}

// ====================================================================
// 2. INSTALLMENT MUTATIONS
// ====================================================================

export function useEarlySettleInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      payload,
    }: {
      planId: string;
      payload: EarlySettlePayload;
    }) => installmentService.earlySettle(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.installments.all });
      invalidateTransactionsAndLedger(queryClient);
    },
  });
}

// ====================================================================
// 3. ACCOUNT MUTATIONS
// ====================================================================

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountCreatePayload) => accountService.create(payload),
    onSuccess: () => {
      invalidateAccountCascade(queryClient);
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AccountUpdatePayload;
    }) => accountService.update(id, payload),
    onSuccess: () => {
      invalidateAccountCascade(queryClient);
    },
  });
}

export function useUpdateAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: AccountStatus;
    }) => accountService.updateStatus(id, status),
    onSuccess: () => {
      invalidateAccountCascade(queryClient);
    },
  });
}

export function useToggleAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountService.toggleStatus(id),
    onSuccess: () => {
      invalidateAccountCascade(queryClient);
    },
  });
}

// ====================================================================
// 4. NOTIFICATION MUTATIONS
// ====================================================================

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useScanAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.scanAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotificationSettingsUpdate) =>
      notificationService.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.settings(),
      });
    },
  });
}

export function useTestTelegram() {
  return useMutation({
    mutationFn: (payload?: {
      bot_token?: string;
      chat_id?: string;
      custom_message?: string;
    }) => notificationService.testTelegram(payload),
  });
}

export function useCardRecommendation() {
  return useMutation({
    mutationFn: (payload: CardRecommendationRequest) =>
      recommendationService.getBestCard(payload),
  });
}

// ====================================================================
// 5. CATEGORY MUTATIONS
// ====================================================================

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryCreatePayload) => categoryService.create(payload),
    onSuccess: () => {
      invalidateCategoryCascade(queryClient);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: CategoryUpdatePayload;
    }) => categoryService.update(id, payload),
    onSuccess: () => {
      invalidateCategoryCascade(queryClient);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryService.delete(id),
    onSuccess: () => {
      invalidateCategoryCascade(queryClient);
    },
  });
}

// ====================================================================
// 6. FINANCIAL LOANS MUTATIONS
// ====================================================================

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoanCreatePayload) => loanService.create(payload),
    onSuccess: () => {
      invalidateLoanCascade(queryClient);
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: LoanUpdatePayload;
    }) => loanService.update(id, payload),
    onSuccess: (_, { id }) => {
      invalidateLoanCascade(queryClient, id);
    },
  });
}

export function useAdjustLoanRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AdjustLoanRatePayload;
    }) => loanService.adjustRate(id, payload),
    onSuccess: (_, { id }) => {
      invalidateLoanCascade(queryClient, id);
    },
  });
}

export function usePayLoanPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: PayLoanPeriodPayload;
    }) => loanService.payPeriod(id, payload),
    onSuccess: (_, { id }) => {
      invalidateLoanCascade(queryClient, id);
    },
  });
}

export function useEarlySettleLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: EarlySettleLoanPayload;
    }) => loanService.earlySettle(id, payload),
    onSuccess: (_, { id }) => {
      invalidateLoanCascade(queryClient, id);
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => loanService.delete(id),
    onSuccess: () => {
      invalidateLoanCascade(queryClient);
    },
  });
}

// ====================================================================
// 7. PERSONAL DEBTS & P2P LENDING MUTATIONS
// ====================================================================

export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DebtCreatePayload) => debtService.create(payload),
    onSuccess: () => {
      invalidateDebtCascade(queryClient);
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: DebtUpdatePayload;
    }) => debtService.update(id, payload),
    onSuccess: (_, { id }) => {
      invalidateDebtCascade(queryClient, id);
    },
  });
}

export function useRepayDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: DebtRepaymentPayload;
    }) => debtService.repay(id, payload),
    onSuccess: (_, { id }) => {
      invalidateDebtCascade(queryClient, id);
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => debtService.delete(id),
    onSuccess: () => {
      invalidateDebtCascade(queryClient);
    },
  });
}
