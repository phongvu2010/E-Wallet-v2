import React, { useEffect, useState } from "react";
import { installmentService } from "../services/installmentService";
import { InstallmentPlan, InstallmentForecast } from "../types/installment";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Input } from "../components/common/Input";
import { Spinner } from "../components/common/Spinner";
import { InstallmentForecastChart } from "../components/charts/InstallmentForecastChart";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingDown,
  Percent,
  Check,
} from "lucide-react";
import { useInstallments, useInstallmentForecast } from "../hooks/useFinanceQueries";
import { useEarlySettleInstallment } from "../hooks/useFinanceMutations";
import { useToast } from "../context/ToastContext";

export const InstallmentsPage: React.FC = () => {
  const { data: plans = [], isLoading: plansLoading } = useInstallments();
  const { data: forecast = [] } = useInstallmentForecast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { toast } = useToast();
  const earlySettleMutation = useEarlySettleInstallment();

  // Early Settle Modal State & Validation
  const [isEarlySettleOpen, setIsEarlySettleOpen] = useState(false);
  const [settlePlanId, setSettlePlanId] = useState<string | null>(null);
  const [settlePlanName, setSettlePlanName] = useState<string>("");
  const [settleFeePercent, setSettleFeePercent] = useState<string>("2.0");
  const [settleCustomFee, setSettleCustomFee] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) || (plans.length > 0 ? plans[0] : null);

  const handleOpenEarlySettle = (plan: InstallmentPlan) => {
    setSettlePlanId(plan.id);
    setSettlePlanName(plan.product_name);
    setSettleFeePercent("2.0");
    setSettleCustomFee("");
    setFormError(null);
    setIsEarlySettleOpen(true);
  };

  const handleExecuteEarlySettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlePlanId) return;

    // Validate fee inputs
    const feePct = parseFloat(settleFeePercent);
    if (isNaN(feePct) || feePct < 0 || feePct > 100) {
      setFormError("Phí phạt tất toán (%) phải từ 0% đến 100%");
      return;
    }
    if (settleCustomFee) {
      const customFeeNum = parseFloat(settleCustomFee);
      if (isNaN(customFeeNum) || customFeeNum < 0) {
        setFormError("Phí tùy chỉnh không thể là số âm");
        return;
      }
    }

    setFormError(null);
    try {
      await earlySettleMutation.mutateAsync({
        planId: settlePlanId,
        payload: {
          fee_percent: feePct,
          custom_fee: settleCustomFee ? parseFloat(settleCustomFee) : undefined,
        },
      });
      toast.success(`Đã tất toán thành công gói trả góp "${settlePlanName}"!`);
      setIsEarlySettleOpen(false);
    } catch (err: any) {
      toast.error(`Lỗi khi tất toán: ${err.message}`);
    }
  };

  if (plansLoading && plans.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải danh sách trả góp...</p>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.status === "ACTIVE");
  const totalRemainingBalance = activePlans.reduce(
    (sum, p) => sum + Number(p.remaining_balance),
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Header & Quick KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Quản Lý Gói Trả Góp & Dự Phóng Dòng Tiền</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Lịch biểu chi tiết từng kỳ trả góp và tính năng tất toán trước hạn tự động
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="purple" size="md">
            {activePlans.length} Gói Đang Trả Góp
          </Badge>
          <Badge variant="info" size="md">
            Dư Nợ Còn Lại: {formatCurrency(totalRemainingBalance)}
          </Badge>
        </div>
      </div>

      {/* 2. Forecast Chart Section */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-400" />
              <span>Dự Phóng Dòng Tiền Trả Góp Các Tháng Tới</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Số tiền gốc và phí cố định phải thanh toán trong từng kỳ tương lai
            </p>
          </div>
        </div>

        <InstallmentForecastChart data={forecast} />
      </Card>

      {/* 3. Installment Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const billedCount = plan.schedules?.filter((s) => s.is_billed).length || 0;
          const progressPercent = Math.min(
            100,
            (billedCount / (plan.term_months || 1)) * 100
          );

          return (
            <Card
              key={plan.id}
              hover
              className="p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 font-mono">
                    Kỳ hạn: {plan.term_months} Tháng
                  </span>
                  <Badge
                    variant={
                      plan.status === "ACTIVE"
                        ? "success"
                        : plan.status === "COMPLETED"
                        ? "neutral"
                        : "warning"
                    }
                  >
                    {plan.status}
                  </Badge>
                </div>

                <h4 className="text-base font-bold text-slate-100 mt-2 line-clamp-1">
                  {plan.product_name}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Bắt đầu: {formatDate(plan.start_date)}
                </p>
              </div>

              {/* Amount Details */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tổng gói:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    {formatCurrency(Number(plan.total_amount))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Mỗi tháng:</span>
                  <span className="font-bold text-purple-400 font-mono">
                    {formatCurrency(Number(plan.monthly_payment))}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Dư nợ còn lại:</span>
                  <span className="font-bold text-rose-400 font-mono">
                    {formatCurrency(Number(plan.remaining_balance))}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span>Tiến độ thanh toán:</span>
                  <span className="font-mono">
                    {billedCount}/{plan.term_months} kỳ ({progressPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              {plan.status === "ACTIVE" && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEarlySettle(plan)}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Tất toán trước hạn
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 4. Early Settle Modal */}
      <Modal
        isOpen={isEarlySettleOpen}
        onClose={() => setIsEarlySettleOpen(false)}
        title="Tất Toán Gói Trả Góp Trước Hạn"
      >
        <form onSubmit={handleExecuteEarlySettle} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <p className="font-semibold mb-1">Xác nhận tất toán:</p>
            <p>
              Hệ thống sẽ cập nhật trạng thái gói thành <b>EARLY_SETTLED</b>, đưa dư nợ gốc còn lại về 0, và tự động tạo bút toán ghi nợ vào sổ cái transactions.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Gói sản phẩm
            </label>
            <div className="font-bold text-slate-200 text-sm">{settlePlanName}</div>
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
            <Input
              label="Hoặc Phí tùy chỉnh (VNĐ)"
              type="number"
              value={settleCustomFee}
              onChange={(e) => setSettleCustomFee(e.target.value)}
              placeholder="Để trống nếu tính theo %"
            />
          </div>

          {formError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEarlySettleOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={earlySettleMutation.isLoading}
            >
              Xác nhận Tất Toán
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
