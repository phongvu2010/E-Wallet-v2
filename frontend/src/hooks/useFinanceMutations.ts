import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionService } from "../services/transactionService";
import { installmentService } from "../services/installmentService";
import { accountService } from "../services/accountService";
import { notificationService } from "../services/notificationService";
import { recommendationService } from "../services/recommendationService";
import { categoryService } from "../services/categoryService";
import { loanService } from "../services/loanService";
import { TransactionCreatePayload, TransactionUpdatePayload } from "../types/transaction";
import { EarlySettlePayload } from "../types/installment";
import { AccountCreatePayload, AccountUpdatePayload, AccountStatus } from "../types/account";
import { NotificationSettingsUpdate } from "../types/notification";
import { CardRecommendationRequest } from "../types/cardRecommendation";
import { CategoryCreatePayload, CategoryUpdatePayload } from "../types/category";
import {
  AdjustLoanRatePayload,
  EarlySettleLoanPayload,
  LoanCreatePayload,
  LoanUpdatePayload,
  PayLoanPeriodPayload,
} from "../types/loan";

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransactionCreatePayload) => transactionService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-spending"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TransactionUpdatePayload }) =>
      transactionService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
    },
  });
}

export function useEarlySettleInstallment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: EarlySettlePayload }) =>
      installmentService.earlySettle(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["installment-forecast"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountCreatePayload) => accountService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["credit-utilization"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AccountUpdatePayload }) =>
      accountService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["credit-utilization"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });
}

export function useUpdateAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      accountService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["credit-utilization"] });
    },
  });
}

export function useToggleAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountService.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["credit-utilization"] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-summary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-summary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useScanAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.scanAlerts(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-summary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotificationSettingsUpdate) =>
      notificationService.updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
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

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryCreatePayload) => categoryService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tree"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-spending"] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryUpdatePayload }) =>
      categoryService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tree"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-spending"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tree"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-spending"] });
    },
  });
}

// ====================================================================
// FINANCIAL LOANS & FLOATING INTEREST RATE MUTATIONS
// ====================================================================

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoanCreatePayload) => loanService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loans-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LoanUpdatePayload }) =>
      loanService.update(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      queryClient.invalidateQueries({ queryKey: ["loans-kpis"] });
    },
  });
}

export function useAdjustLoanRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdjustLoanRatePayload }) =>
      loanService.adjustRate(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      queryClient.invalidateQueries({ queryKey: ["loans-kpis"] });
    },
  });
}

export function usePayLoanPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayLoanPeriodPayload }) =>
      loanService.payPeriod(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      queryClient.invalidateQueries({ queryKey: ["loans-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });
}

export function useEarlySettleLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EarlySettleLoanPayload }) =>
      loanService.earlySettle(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan", id] });
      queryClient.invalidateQueries({ queryKey: ["loans-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-live"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => loanService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loans-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth"] });
    },
  });
}
