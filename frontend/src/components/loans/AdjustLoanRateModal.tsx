import React, { useState, useEffect } from "react";
import { AlertCircle, ArrowRight, Percent, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { useToast } from "../../context/ToastContext";
import { useAdjustLoanRate } from "../../hooks/useFinanceMutations";
import { Loan } from "../../types/loan";
import { formatCurrency, formatDate } from "../../utils/formatters";

interface AdjustLoanRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
}

export const AdjustLoanRateModal: React.FC<AdjustLoanRateModalProps> = ({
  isOpen,
  onClose,
  loan,
}) => {
  const { toast } = useToast();
  const adjustRateMutation = useAdjustLoanRate();

  const [newRate, setNewRate] = useState<string>("");
  const [newMonthlyFee, setNewMonthlyFee] = useState<number | string>(0);
  const [effectivePeriod, setEffectivePeriod] = useState<number>(1);
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Unpaid periods
  const unpaidSchedules = (loan?.schedules || []).filter((s) => s.status === "UNPAID");
  const firstUnpaidPeriod = unpaidSchedules[0]?.period_index || 1;

  useEffect(() => {
    if (loan) {
      setNewRate(String(loan.current_interest_rate));
      setNewMonthlyFee(loan.monthly_fee || 0);
      setEffectivePeriod(firstUnpaidPeriod);
      setReason("");
      setError(null);
    }
  }, [loan, isOpen, firstUnpaidPeriod]);

  if (!loan) return null;

  const currentRate = Number(loan.current_interest_rate);
  const currentMonthlyFee = Number(loan.monthly_fee || 0);

  const parsedNewRate = parseFloat(newRate);
  const parsedNewFee = Number(newMonthlyFee) || 0;

  const isRateValid = !isNaN(parsedNewRate) && parsedNewRate >= 0 && parsedNewRate <= 100;
  const isFeeValid = parsedNewFee >= 0;

  const rateDiff = isRateValid ? parsedNewRate - currentRate : 0;
  const feeDiff = isFeeValid ? parsedNewFee - currentMonthlyFee : 0;

  // Simple quick simulation for remaining unpaid periods
  const affectedSchedules = (loan.schedules || []).filter(
    (s) => s.period_index >= effectivePeriod && s.status === "UNPAID"
  );
  
  // Estimate interest difference
  let estimatedOldInterest = 0;
  let estimatedNewInterest = 0;
  if (isRateValid && affectedSchedules.length > 0) {
    affectedSchedules.forEach((s) => {
      estimatedOldInterest += s.interest_amount;
      const simInterest = Math.round((s.beginning_balance * (parsedNewRate / 100)) / 12);
      estimatedNewInterest += simInterest;
    });
  }
  const interestDiff = estimatedNewInterest - estimatedOldInterest;
  const totalFeeDiff = feeDiff * affectedSchedules.length;
  const totalPaymentDiff = interestDiff + totalFeeDiff;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRateValid) {
      setError("Lãi suất mới phải từ 0% đến 100%/năm.");
      return;
    }

    if (parsedNewRate === currentRate && parsedNewFee === currentMonthlyFee) {
      setError("Lãi suất và phí dịch vụ mới không có thay đổi so với hiện tại.");
      return;
    }

    try {
      await adjustRateMutation.mutateAsync({
        id: loan.id,
        payload: {
          new_interest_rate: parsedNewRate,
          new_monthly_fee: parsedNewFee,
          effective_from_period: effectivePeriod,
          reason: reason.trim() || undefined,
        },
      });

      toast.success(
        `Đã cập nhật thông số thả nổi khoản vay "${loan.loan_name}" thành công!`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || "Đã xảy ra lỗi khi điều chỉnh lãi suất.");
      toast.error(`Lỗi cập nhật: ${err?.message}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Điều Chỉnh Lãi Suất Thả Nổi & Phí Dịch Vụ"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-200">Khoản vay: {loan.loan_name}</p>
            <p className="text-slate-400 mt-0.5">
              Thay đổi chỉ áp dụng cho các kỳ chưa thanh toán từ kỳ hiệu lực được chọn.
              Toàn bộ lịch sử các kỳ đã thanh toán trước đây được bảo lưu nguyên vẹn 100%.
            </p>
          </div>
        </div>

        {/* Current vs New Rate Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-xs text-slate-400">Lãi suất & Phí hiện tại</span>
            <div className="text-lg font-bold font-mono text-slate-100 flex items-center gap-1.5">
              <span>{currentRate}%</span>
              <span className="text-xs font-normal text-slate-400">/ năm</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Phí DV hàng tháng: <span className="font-mono font-medium text-slate-300">{formatCurrency(currentMonthlyFee)}</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Dư nợ còn lại: <span className="font-mono font-medium text-slate-300">{formatCurrency(loan.remaining_principal)}</span>
            </p>
          </div>

          <div className="space-y-3">
            <Input
              label="Lãi suất mới (%/năm)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              value={newRate}
              onChange={(e) => {
                setNewRate(e.target.value);
                setError(null);
              }}
              placeholder="VD: 9.5"
            />

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Phí dịch vụ hàng tháng mới (VNĐ)
              </label>
              <CurrencyInput
                value={newMonthlyFee}
                onChange={(val) => {
                  setNewMonthlyFee(val);
                  setError(null);
                }}
                placeholder="VD: 12,000"
              />
            </div>
          </div>
        </div>

        {/* Effective From Period Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Áp dụng từ kỳ thanh toán
          </label>
          <select
            value={effectivePeriod}
            onChange={(e) => setEffectivePeriod(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            {unpaidSchedules.map((s) => (
              <option key={s.period_index} value={s.period_index}>
                Kỳ {s.period_index}/{loan.term_months} - Hạn: {formatDate(s.due_date)} (Gốc còn: {formatCurrency(s.beginning_balance)})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            Số kỳ còn lại chịu tác động: <span className="font-semibold text-slate-300">{affectedSchedules.length} kỳ</span>
          </p>
        </div>

        {/* Reason / Note */}
        <div>
          <Input
            label="Lý do điều chỉnh / Ghi chú"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Ngân hàng điều chỉnh biên độ định kỳ Q4/2026..."
          />
        </div>

        {/* Live Simulation Impact */}
        {isRateValid && (rateDiff !== 0 || feeDiff !== 0) && (
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                Dự báo chênh lệch thanh toán ({affectedSchedules.length} kỳ)
              </span>
              <span
                className={`flex items-center gap-1 font-mono ${
                  rateDiff > 0 ? "text-rose-400" : rateDiff < 0 ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {rateDiff > 0 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5" /> +{rateDiff.toFixed(2)}%
                  </>
                ) : rateDiff < 0 ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" /> {rateDiff.toFixed(2)}%
                  </>
                ) : (
                  <span>Lãi suất không đổi</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-0.5">Tổng lãi cũ dự kiến</span>
                <span className="font-mono text-slate-300 font-semibold">
                  {formatCurrency(estimatedOldInterest)}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-0.5">Tổng lãi mới ước tính</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatCurrency(estimatedNewInterest)}
                </span>
              </div>
            </div>

            {feeDiff !== 0 && (
              <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-800/80">
                <span className="text-slate-400">Chênh lệch phí DV ({affectedSchedules.length} kỳ):</span>
                <span
                  className={`font-mono font-bold ${
                    feeDiff > 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {totalFeeDiff > 0 ? `+${formatCurrency(totalFeeDiff)}` : formatCurrency(totalFeeDiff)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-800/80">
              <span className="text-slate-400">Tổng chênh lệch nghĩa vụ trả:</span>
              <span
                className={`font-mono font-bold ${
                  totalPaymentDiff > 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {totalPaymentDiff > 0 ? `+${formatCurrency(totalPaymentDiff)}` : formatCurrency(totalPaymentDiff)}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={adjustRateMutation.isPending}
            leftIcon={<Percent className="w-4 h-4" />}
          >
            Lưu & Tính Lại Lịch Trả
          </Button>
        </div>
      </form>
    </Modal>
  );
};
