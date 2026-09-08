import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Phone,
  Plus,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { Spinner } from "../common/Spinner";
import { useToast } from "../../context/ToastContext";
import { useDeleteDebt } from "../../hooks/useFinanceMutations";
import { useDebt } from "../../hooks/useFinanceQueries";
import { Debt, DebtRepayment } from "../../types/debt";
import { formatCurrency, formatDate } from "../../utils/formatters";

interface DebtDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtId: string | null;
  onOpenRepay: (debt: Debt) => void;
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  isOpen,
  onClose,
  debtId,
  onOpenRepay,
}) => {
  const { data: debt, isLoading } = useDebt(debtId || undefined);
  const deleteDebtMutation = useDeleteDebt();
  const { toast } = useToast();

  if (!debtId || !isOpen) return null;

  const handleDelete = async () => {
    if (!debt) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa khoản nợ đối với "${debt.counterparty_name}" không?`
      )
    ) {
      return;
    }

    try {
      await deleteDebtMutation.mutateAsync(debt.id);
      toast.success("Đã xóa khoản nợ thành công");
      onClose();
    } catch {
      toast.error("Không thể xóa khoản nợ. Vui lòng thử lại.");
    }
  };

  const isBorrow = debt?.debt_type === "BORROW";
  const progressPercent = debt
    ? Math.min(100, Math.round((debt.total_paid_principal / debt.principal_amount) * 100))
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chi Tiết Sổ Nợ Dân Sự"
      maxWidth="2xl"
    >
      {isLoading || !debt ? (
        <div className="h-60 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs text-slate-400">Đang tải chi tiết khoản nợ...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Header Profile Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                    isBorrow ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                  }`}
                >
                  {isBorrow ? (
                    <ArrowDownLeft className="w-6 h-6" />
                  ) : (
                    <ArrowUpRight className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">
                      {debt.counterparty_name}
                    </h3>
                    <Badge variant={isBorrow ? "warning" : "info"}>
                      {isBorrow ? "Tôi Đi Vay (Nợ Phải Trả)" : "Tôi Cho Vay (Nợ Phải Thu)"}
                    </Badge>
                    <Badge variant={debt.status === "PAID_OFF" ? "success" : "neutral"}>
                      {debt.status === "PAID_OFF" ? "Đã Tất Toán" : "Đang Hoạt Động"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    {debt.counterparty_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {debt.counterparty_phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Ngày vay: {formatDate(debt.start_date)}
                    </span>
                    {debt.due_date && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        Hẹn trả: {formatDate(debt.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {debt.status === "ACTIVE" && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenRepay(debt);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isBorrow ? "Trả Nợ Đợt Này" : "Thu Hồi Nợ"}</span>
                </Button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">Tiến độ thanh toán gốc</span>
                <span className="text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 block">Tổng gốc ban đầu</span>
                <span className="text-sm font-bold text-slate-100 mt-0.5 block">
                  {formatCurrency(debt.principal_amount)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 block">Đã trả gốc</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {formatCurrency(debt.total_paid_principal)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-400 block">Dư nợ còn lại</span>
                <span className="text-sm font-extrabold text-amber-400 mt-0.5 block">
                  {formatCurrency(debt.remaining_amount)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[11px] font-semibold text-amber-300/90 flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  <span>Tiền bồi dưỡng</span>
                </span>
                <span className="text-sm font-bold text-amber-400 mt-0.5 block">
                  {formatCurrency(debt.total_extra_amount)}
                </span>
              </div>
            </div>

            {debt.note && (
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-300">
                <span className="font-semibold text-slate-400">Ghi chú: </span>
                {debt.note}
              </div>
            )}
          </div>

          {/* Repayment Timeline History */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Lịch Sử Các Lần Trả Nợ / Thu Nợ ({debt.repayments.length})</span>
            </h4>

            {debt.repayments.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                Chưa có đợt thanh toán nào được ghi nhận cho khoản nợ này.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {debt.repayments.map((r: DebtRepayment, idx: number) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                        #{debt.repayments.length - idx}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200 flex items-center gap-2">
                          <span>{formatDate(r.repayment_date)}</span>
                          {r.account_name && (
                            <span className="text-[11px] font-normal text-slate-400 flex items-center gap-1">
                              <Wallet className="w-3 h-3" />
                              {r.account_name}
                            </span>
                          )}
                        </div>
                        {r.note && <p className="text-[11px] text-slate-400 mt-0.5">{r.note}</p>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-slate-100">
                        Gốc: <span className="text-emerald-400">{formatCurrency(r.principal_paid)}</span>
                      </div>
                      {r.extra_amount > 0 && (
                        <div className="text-[11px] text-amber-400 font-medium flex items-center justify-end gap-1">
                          <Gift className="w-3 h-3" />
                          <span>Bồi dưỡng: +{formatCurrency(r.extra_amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={deleteDebtMutation.isPending}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Khoản Nợ</span>
            </Button>

            <Button type="button" variant="ghost" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
