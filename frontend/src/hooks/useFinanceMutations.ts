import { useMutation, useQueryClient } from "../providers/QueryProvider";
import { transactionService } from "../services/transactionService";
import { installmentService } from "../services/installmentService";
import { accountService } from "../services/accountService";
import { TransactionCreatePayload, TransactionUpdatePayload } from "../types/transaction";
import { EarlySettlePayload } from "../types/installment";
import { AccountUpdatePayload, AccountStatus } from "../types/account";

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation(
    (payload: TransactionCreatePayload) => transactionService.create(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["transactions"]);
        queryClient.invalidateQueries(["transaction-summary"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
        queryClient.invalidateQueries(["monthly-spending"]);
      },
    }
  );
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, payload }: { id: string; payload: TransactionUpdatePayload }) =>
      transactionService.update(id, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["transactions"]);
        queryClient.invalidateQueries(["transaction-summary"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
      },
    }
  );
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: string) => transactionService.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["transactions"]);
        queryClient.invalidateQueries(["transaction-summary"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
      },
    }
  );
}

export function useEarlySettleInstallment() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ planId, payload }: { planId: string; payload: EarlySettlePayload }) =>
      installmentService.earlySettle(planId, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["installments"]);
        queryClient.invalidateQueries(["installment-forecast"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
        queryClient.invalidateQueries(["transactions"]);
      },
    }
  );
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, payload }: { id: string; payload: AccountUpdatePayload }) =>
      accountService.update(id, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["accounts"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
        queryClient.invalidateQueries(["credit-utilization"]);
      },
    }
  );
}

export function useUpdateAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, status }: { id: string; status: AccountStatus }) =>
      accountService.updateStatus(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["accounts"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
        queryClient.invalidateQueries(["credit-utilization"]);
      },
    }
  );
}

export function useToggleAccountStatus() {
  const queryClient = useQueryClient();
  return useMutation(
    (id: string) => accountService.toggleStatus(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["accounts"]);
        queryClient.invalidateQueries(["accounts-live"]);
        queryClient.invalidateQueries(["dashboard-overview"]);
        queryClient.invalidateQueries(["credit-utilization"]);
      },
    }
  );
}
