import React, { useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  History,
  Percent,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Spinner } from "../common/Spinner";
import { useToast } from "../../context/ToastContext";
import { useEarlySettleLoan, usePayLoanPeriod } from "../../hooks/useFinanceMutations";
import { useAccounts, useLoan } from "../../hooks/useFinanceQueries";
import { Loan, LoanSchedule } from "../../types/loan";
import { formatCurrency, formatDate, formatRate } from "../../utils/formatters";

interface LoanDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string | null;
  onOpenAdjustRate?: (loan: Loan) => void;
}

export const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  isOpen,
  onClose,
  loanId,
  onOpenAdjustRate,
}) => {
  const { toast } = useToast();
  const { data: loan, isLoading } = useLoan(loanId || "");
  const { data: accounts = [] } = useAccounts();

  const [activeTab, setActiveTab] = useState<"schedules" | "history">("schedules");

  // Pay Period Modal State
  const [payingSchedule, setPayingSchedule] = useState<LoanSchedule | null>(null);
  const [paidAmount, setPaidAmount] = useState<number | string>("");
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payNote, setPayNote] = useState<string>("");

  // Early Settlement Modal State
  const [isEarlySettleOpen, setIsEarlySettleOpen] = useState<boolean>(false);
  const [settleFeePercent, setSettleFeePercent] = useState<string>("2.0");
  const [settleCustomFee, setSettleCustomFee] = useState<string>("");
  const [settleAccountId, setSettleAccountId] = useState<string>("");
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const payPeriodMutation = usePayLoanPeriod();
  const earlySettleMutation = useEarlySettleLoan();

  if (!isOpen) return null;

  const handleOpenPayPeriod = (schedule: LoanSchedule) => {
    setPayingSchedule(schedule);
    setPaidAmount(schedule.total_payment);
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayNote(`Thanh toán kỳ ${schedule.period_index}/${loan?.term_months} khoản vay ${loan?.loan_name}`);
    if (accounts.length > 0 && !paymentAccountId) {
      setPaymentAccountId(accounts[0].id);
    }
  };

  const handleConfirmPayPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !payingSchedule) return;

    const actualAmount = paidAmount !== "" && !isNaN(Number(paidAmount))
      ? Number(paidAmount)
      : payingSchedule.total_payment;

    try {
      await payPeriodMutation.mutateAsync({
        id: loan.id,
        payload: {
          period_index: payingSchedule.period_index,
          payment_account_id: paymentAccountId || undefined,
          paid_amount: actualAmount,
          paid_date: payDate,
          note: payNote.trim() || undefined,
        },
      });

      toast.success(`Đã ghi nhận thanh toán kỳ ${payingSchedule.period_index} thành công!`);
      setPayingSchedule(null);
    } catch (err: any) {
      toast.error(`Lỗi thanh toán kỳ: ${err?.message}`);
    }
  };

  const handleConfirmEarlySettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;

    const feePct = parseFloat(settleFeePercent);
    if (isNaN(feePct) || feePct < 0 || feePct > 100) {
      toast.error("Phí phạt tất toán (%) phải từ 0% đến 100%");
      return;
    }

    try {
      await earlySettleMutation.mutateAsync({
        id: loan.id,
        payload: {
          settlement_account_id: settleAccountId || undefined,
          fee_percent: feePct,
          custom_fee: settleCustomFee ? parseFloat(settleCustomFee) : undefined,
          settlement_date: settleDate,
        },
      });

      toast.success(`Đã tất toán toàn bộ dư nợ khoản vay "${loan.loan_name}"!`);
      setIsEarlySettleOpen(false);
    } catch (err: any) {
      toast.error(`Lỗi tất toán khoản vay: ${err?.message}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chi Tiết Khoản Vay & Lịch Trả Nợ"
      maxWidth="4xl"
    >
      {isLoading || !loan ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs text-slate-400">Đang tải chi tiết khoản vay...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header & Quick Stats */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-100">{loan.loan_name}</span>
                  {loan.loan_code && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {loan.loan_code}
                    </span>
                  )}
                  <Badge
                    variant={
                      loan.status === "ACTIVE"
                        ? "info"
                        : loan.status === "PAID_OFF"
                        ? "success"
                        : "warning"
                    }
                  >
                    {loan.status === "ACTIVE"
                      ? "Đang vay"
                      : loan.status === "PAID_OFF"
                      ? "Đã tất toán"
                      : loan.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {loan.institution?.name ? `Tổ chức: ${loan.institution.name} • ` : ""}
                  Kỳ hạn: <span className="font-semibold text-slate-300">{loan.term_months} tháng</span> • 
                  Bắt đầu: <span className="font-semibold text-slate-300">{formatDate(loan.start_date)}</span> •
                  Ngày chốt kỳ: Ngày <span className="font-semibold text-slate-300">{loan.billing_day_of_month}</span> hàng tháng
                  {Number(loan.monthly_fee) > 0 && (
                    <> • Phí DV: <span className="font-semibold text-slate-300 font-mono">{formatCurrency(loan.monthly_fee || 0)}/tháng</span></>
                  )}
                </p>
              </div>

              {/* Action Buttons */}
              {loan.status === "ACTIVE" && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenAdjustRate && onOpenAdjustRate(loan)}
                    leftIcon={<Percent className="w-3.5 h-3.5 text-amber-400" />}
                  >
                    Đổi Lãi Suất / Phí
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setIsEarlySettleOpen(true);
                      if (accounts.length > 0 && !settleAccountId) {
                        setSettleAccountId(accounts[0].id);
                      }
                    }}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Tất Toán Sớm
                  </Button>
                </div>
              )}
            </div>

            {/* Financial Numbers Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Số tiền vay ban đầu</span>
                <span className="font-bold text-slate-100 font-mono text-sm">
                  {formatCurrency(loan.principal_amount)}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Dư nợ gốc còn lại</span>
                <span className="font-bold text-rose-400 font-mono text-sm">
                  {formatCurrency(loan.remaining_principal)}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Lãi suất hiện hành</span>
                <span className="font-bold text-amber-400 font-mono text-sm">
                  {formatRate(loan.current_interest_rate)} / năm
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Tổng lãi đã trả / Dự kiến</span>
                <span className="font-bold text-purple-400 font-mono text-xs">
                  {formatCurrency(loan.total_paid_interest)} / {formatCurrency(loan.total_projected_interest)}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("schedules")}
              className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "schedules"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Lịch Biểu Trả Nợ ({loan.schedules?.length || 0} kỳ)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 px-3 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "history"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Lịch Sử Đổi Lãi Suất ({loan.rate_histories?.length || 0})</span>
            </button>
          </div>

          {/* Tab 1: Amortization Schedule Table */}
          {activeTab === "schedules" && (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Kỳ</th>
                      <th className="py-2.5 px-3">Hạn thanh toán</th>
                      <th className="py-2.5 px-3 text-right">Dư nợ đầu kỳ</th>
                      <th className="py-2.5 px-3 text-right">Tiền Gốc</th>
                      <th className="py-2.5 px-3 text-right">Lãi suất</th>
                      <th className="py-2.5 px-3 text-right">Tiền Lãi</th>
                      <th className="py-2.5 px-3 text-right">Tổng kỳ</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      <th className="py-2.5 px-3 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {loan.schedules?.map((item) => (
                      <tr
                        key={item.id || item.period_index}
                        className={`hover:bg-slate-800/30 transition-colors ${
                          item.status === "PAID" ? "opacity-75 bg-emerald-950/10" : ""
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-slate-300">
                          #{item.period_index}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {formatDate(item.due_date)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">
                          {formatCurrency(item.beginning_balance)}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200 font-semibold">
                          {formatCurrency(item.principal_amount)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-300 font-mono">
                          {formatRate(item.applied_interest_rate)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-400 font-mono font-medium">
                          {formatCurrency(item.interest_amount)}
                        </td>
                        <td className="py-2 px-3 text-right text-purple-400 font-bold">
                          {formatCurrency(item.total_payment)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.status === "PAID" ? (
                            <Badge variant="success" size="sm">
                              Đã trả {item.paid_date ? `(${formatDate(item.paid_date)})` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="sm">
                              Chưa trả
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-sans">
                          {item.status === "UNPAID" && loan.status === "ACTIVE" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPayPeriod(item)}
                              className="text-[11px] py-1 px-2 h-auto"
                            >
                              Thanh toán
                            </Button>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Rate History Timeline */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {loan.rate_histories && loan.rate_histories.length > 0 ? (
                <div className="space-y-3">
                  {loan.rate_histories.map((hist, idx) => {
                    const diff = Number(hist.new_rate) - Number(hist.old_rate);
                    const feeDiff = (hist.new_monthly_fee ?? 0) - (hist.old_monthly_fee ?? 0);
                    return (
                      <div
                        key={hist.id || idx}
                        className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-200">
                              Lãi suất: {formatRate(hist.old_rate)} → {formatRate(hist.new_rate)} / năm
                            </span>
                            <span
                              className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                                diff > 0
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : diff < 0
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {diff > 0 ? `+${formatRate(diff)}` : formatRate(diff)}
                            </span>
                            {(hist.old_monthly_fee !== undefined || hist.new_monthly_fee !== undefined) && (
                              <span className="text-slate-400 font-mono text-[11px]">
                                • Phí DV: {formatCurrency(hist.old_monthly_fee || 0)} → {formatCurrency(hist.new_monthly_fee || 0)}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400">
                            Hiệu lực từ: <span className="font-semibold text-slate-300">Kỳ {hist.effective_from_period}</span> ({formatDate(hist.effective_date)})
                          </p>
                          {hist.reason && (
                            <p className="text-slate-400 italic">Ghi chú: {hist.reason}</p>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-500 shrink-0">
                          {hist.created_at ? formatDate(hist.created_at) : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                  Chưa có lịch sử thay đổi lãi suất nào được ghi nhận.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Internal Modal: Pay Period Form */}
      {payingSchedule && (
        <Modal
          isOpen={!!payingSchedule}
          onClose={() => setPayingSchedule(null)}
          title={`Thanh Toán Kỳ #${payingSchedule.period_index}`}
        >
          <form onSubmit={handleConfirmPayPeriod} className="space-y-4">
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Khoản vay:</span>
                <span className="font-bold text-slate-200">{loan?.loan_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hạn thanh toán:</span>
                <span className="font-mono text-slate-300">{formatDate(payingSchedule.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tiền Gốc:</span>
                <span className="font-mono text-slate-300">{formatCurrency(payingSchedule.principal_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tiền Lãi ({formatRate(payingSchedule.applied_interest_rate)}):</span>
                <span className="font-mono text-amber-400">{formatCurrency(payingSchedule.interest_amount)}</span>
              </div>
              {Number(payingSchedule.monthly_fee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Phí Dịch Vụ:</span>
                  <span className="font-mono text-slate-300">{formatCurrency(payingSchedule.monthly_fee || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-800 font-semibold text-xs">
                <span className="text-slate-400">Tổng nghĩa vụ theo lịch:</span>
                <span className="text-slate-200 font-mono">{formatCurrency(payingSchedule.total_payment)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>
                  Tổng thanh toán thực tế (VNĐ) <span className="text-rose-400">*</span>
                </span>
                {paidAmount !== "" && Number(paidAmount) < payingSchedule.total_payment && (
                  <span className="text-[11px] font-mono font-semibold text-emerald-400">
                    Tiết kiệm / Khuyến mãi: -{formatCurrency(payingSchedule.total_payment - Number(paidAmount))}
                  </span>
                )}
                {paidAmount !== "" && Number(paidAmount) > payingSchedule.total_payment && (
                  <span className="text-[11px] font-mono font-semibold text-amber-400">
                    Phát sinh thêm: +{formatCurrency(Number(paidAmount) - payingSchedule.total_payment)}
                  </span>
                )}
              </label>
              <CurrencyInput
                value={paidAmount}
                onChange={(val) => setPaidAmount(val)}
                placeholder={String(payingSchedule.total_payment)}
                className="font-bold text-emerald-400 focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Số tiền thực tế bị trừ từ tài khoản (có thể chỉnh sửa nếu app có voucher khuyến mãi / giảm giá).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tài khoản trích tiền thanh toán
              </label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Không trích tài khoản (chỉ đánh dấu) --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.institution?.name ? `${acc.institution.name}: ` : ""}{acc.account_name} ({acc.card_number_masked})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Ngày thực trả"
              type="date"
              required
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />

            <Input
              label="Ghi chú giao dịch"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="VD: Trích tiền tự động từ VCB..."
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setPayingSchedule(null)}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={payPeriodMutation.isPending}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Xác Nhận Thanh Toán
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Internal Modal: Early Settle Form */}
      {isEarlySettleOpen && loan && (
        <Modal
          isOpen={isEarlySettleOpen}
          onClose={() => setIsEarlySettleOpen(false)}
          title="Tất Toán Khoản Vay Trước Hạn"
        >
          <form onSubmit={handleConfirmEarlySettle} className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
              <p className="font-semibold mb-1">Xác nhận tất toán toàn bộ dư nợ:</p>
              <p>
                Hệ thống sẽ cập nhật trạng thái khoản vay thành <b>PAID_OFF</b>, tất toán toàn bộ gốc còn lại{" "}
                <b>{formatCurrency(loan.remaining_principal)}</b>, miễn toàn bộ tiền lãi của các kỳ trong tương lai và ghi nhận phí phạt tất toán (nếu có).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phí phạt tất toán (%)"
                type="number"
                step="0.1"
                value={settleFeePercent}
                onChange={(e) => setSettleFeePercent(e.target.value)}
                placeholder="VD: 2.0"
              />
              <CurrencyInput
                label="Hoặc Phí cố định (VNĐ)"
                value={settleCustomFee}
                onValueChange={(val) => setSettleCustomFee(val ? String(val) : "")}
                onChangeRaw={(raw) => setSettleCustomFee(raw)}
                placeholder="Để trống nếu tính %"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tài khoản trích tiền tất toán
              </label>
              <select
                value={settleAccountId}
                onChange={(e) => setSettleAccountId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Không trích tài khoản (chỉ đánh dấu) --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.institution?.name ? `${acc.institution.name}: ` : ""}{acc.account_name} ({acc.card_number_masked})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Ngày tất toán"
              type="date"
              required
              value={settleDate}
              onChange={(e) => setSettleDate(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsEarlySettleOpen(false)}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="danger"
                isLoading={earlySettleMutation.isPending}
              >
                Xác Nhận Tất Toán Toàn Bộ
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
};
