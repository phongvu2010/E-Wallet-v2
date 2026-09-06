import React, { useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Landmark,
  Percent,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { InstallmentForecastChart } from "../components/charts/InstallmentForecastChart";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { CurrencyInput } from "../components/common/CurrencyInput";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { Spinner } from "../components/common/Spinner";
import { AdjustLoanRateModal } from "../components/loans/AdjustLoanRateModal";
import { CreateLoanModal } from "../components/loans/CreateLoanModal";
import { LoanDetailModal } from "../components/loans/LoanDetailModal";
import { useToast } from "../context/ToastContext";
import { useEarlySettleInstallment } from "../hooks/useFinanceMutations";
import {
  useInstallmentForecast,
  useInstallments,
  useLoanKPIs,
  useLoans,
} from "../hooks/useFinanceQueries";
import { InstallmentPlan } from "../types/installment";
import { Loan } from "../types/loan";
import { formatCurrency, formatDate } from "../utils/formatters";

export const InstallmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"installments" | "loans">("loans");

  // --- Installments Data & State ---
  const { data: plans = [], isLoading: plansLoading } = useInstallments();
  const { data: forecast = [] } = useInstallmentForecast();
  const earlySettlePlanMutation = useEarlySettleInstallment();

  const [isEarlySettleOpen, setIsEarlySettleOpen] = useState(false);
  const [settlePlanId, setSettlePlanId] = useState<string | null>(null);
  const [settlePlanName, setSettlePlanName] = useState<string>("");
  const [settleFeePercent, setSettleFeePercent] = useState<string>("2.0");
  const [settleCustomFee, setSettleCustomFee] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // --- Loans Data & State ---
  const { data: loans = [], isLoading: loansLoading } = useLoans();
  const { data: loanKPIs } = useLoanKPIs();

  const [isCreateLoanOpen, setIsCreateLoanOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [isDetailLoanOpen, setIsDetailLoanOpen] = useState(false);
  const [adjustRateLoan, setAdjustRateLoan] = useState<Loan | null>(null);
  const [isAdjustRateOpen, setIsAdjustRateOpen] = useState(false);

  const { toast } = useToast();

  // Handle Installment Early Settle
  const handleOpenEarlySettlePlan = (plan: InstallmentPlan) => {
    setSettlePlanId(plan.id);
    setSettlePlanName(plan.product_name);
    setSettleFeePercent("2.0");
    setSettleCustomFee("");
    setFormError(null);
    setIsEarlySettleOpen(true);
  };

  const handleExecuteEarlySettlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlePlanId) return;

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
      await earlySettlePlanMutation.mutateAsync({
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

  // Loans Handlers
  const handleOpenLoanDetail = (loanId: string) => {
    setSelectedLoanId(loanId);
    setIsDetailLoanOpen(true);
  };

  const handleOpenAdjustRate = (loan: Loan) => {
    setAdjustRateLoan(loan);
    setIsAdjustRateOpen(true);
  };

  const activePlans = plans.filter((p: InstallmentPlan) => p.status === "ACTIVE");
  const totalRemainingBalance = activePlans.reduce(
    (sum: number, p: InstallmentPlan) => sum + Number(p.remaining_balance),
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Page Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Quản Lý Trả Góp & Khoản Vay Tài Chính</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quản lý tập trung các gói trả góp thẻ tín dụng 0% và gói vay ngân hàng với cơ chế điều chỉnh lãi suất thả nổi
          </p>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("loans")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "loans"
                ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Khoản Vay Lãi Suất Thả Nổi ({loans.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("installments")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "installments"
                ? "bg-purple-500 text-white shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Trả Góp Thẻ Tín Dụng ({plans.length})</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: FLOATING RATE LOANS ================= */}
      {activeTab === "loans" && (
        <div className="space-y-6">
          {/* Loan KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Khoản vay đang mở</span>
                <Landmark className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {loanKPIs?.total_active_loans ?? loans.filter((l) => l.status === "ACTIVE").length} gói
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Đang thực hiện trả lãi & gốc</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Tổng dư nợ gốc còn lại</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400">
                {formatCurrency(loanKPIs?.total_remaining_principal ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cần thanh toán các kỳ tới</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Đến hạn tháng này</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400">
                {formatCurrency(loanKPIs?.due_this_month_amount ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {loanKPIs?.due_this_month_count ?? 0} kỳ cần thanh toán trong tháng
              </p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Tổng tiền lãi đã trả</span>
                <Percent className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold font-mono text-purple-400">
                {formatCurrency(loanKPIs?.total_paid_interest ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Lũy kế lãi vay thực tế</p>
            </Card>
          </div>

          {/* Section Title & Add Loan Button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Danh Sách Gói Vay Ngân Hàng & Lãi Thả Nổi</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mỗi khi ngân hàng đổi lãi suất, click "Đổi Lãi Suất" để hệ thống tự động tính lại toàn bộ kỳ tương lai
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateLoanOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Thêm Gói Vay Mới
            </Button>
          </div>

          {/* Loans Grid */}
          {loansLoading && loans.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-xs text-slate-400">Đang tải danh sách khoản vay...</p>
            </div>
          ) : loans.length === 0 ? (
            <Card className="p-10 text-center space-y-3 bg-slate-950/40 border-dashed border-slate-800">
              <Landmark className="w-10 h-10 text-slate-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-200">Chưa có gói vay nào</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Bạn có thể tạo gói vay mua nhà, mua xe, tiêu dùng với lãi suất cơ sở và biên độ thả nổi linh hoạt.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateLoanOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Tạo khoản vay đầu tiên
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loans.map((loan) => {
                const paidCount = loan.schedules?.filter((s) => s.status === "PAID").length || 0;
                const totalCount = loan.term_months || loan.schedules?.length || 1;
                const progressPercent = Math.min(100, (paidCount / totalCount) * 100);

                const typeLabels: Record<string, string> = {
                  MORTGAGE: "Vay Thế chấp / BĐS",
                  CONSUMER: "Vay Tiêu dùng",
                  AUTO: "Vay Mua xe",
                  BUSINESS: "Vay Kinh doanh",
                  OVERDRAFT: "Thấu chi",
                  OTHER: "Khoản vay khác",
                };

                return (
                  <Card
                    key={loan.id}
                    hover
                    className="p-5 flex flex-col justify-between space-y-4 border-slate-800"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                          {typeLabels[loan.loan_type] || loan.loan_type}
                        </span>
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

                      {/* Loan title & institution */}
                      <h4 className="text-base font-bold text-slate-100 mt-2 line-clamp-1">
                        {loan.loan_name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        {loan.institution?.name && (
                          <span className="text-slate-300 font-medium">{loan.institution.name} • </span>
                        )}
                        <span>Bắt đầu: {formatDate(loan.start_date)}</span>
                      </p>
                    </div>

                    {/* Financial details box */}
                    <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Số tiền vay:</span>
                        <span className="font-bold text-slate-200 font-mono">
                          {formatCurrency(loan.principal_amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Lãi suất hiện hành:</span>
                        <span className="font-bold text-amber-400 font-mono flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {loan.current_interest_rate}% / năm
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Dư nợ gốc còn lại:</span>
                        <span className="font-bold text-rose-400 font-mono">
                          {formatCurrency(loan.remaining_principal)}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>Tiến độ thanh toán:</span>
                        <span className="font-mono">
                          {paidCount}/{totalCount} kỳ ({progressPercent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      {loan.status === "ACTIVE" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAdjustRate(loan)}
                          className="text-amber-400 hover:text-amber-300 text-xs px-2"
                          leftIcon={<Percent className="w-3.5 h-3.5" />}
                        >
                          Đổi Lãi Suất
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenLoanDetail(loan.id)}
                        className="text-xs ml-auto"
                        rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                      >
                        Chi Tiết Lịch Trả
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: 0% INSTALLMENT PLANS ================= */}
      {activeTab === "installments" && (
        <div className="space-y-6">
          {/* Quick KPIs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="purple" size="md">
                {activePlans.length} Gói Đang Trả Góp
              </Badge>
              <Badge variant="info" size="md">
                Dư Nợ Còn Lại: {formatCurrency(totalRemainingBalance)}
              </Badge>
            </div>
          </div>

          {/* Forecast Chart Section */}
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

          {/* Installment Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan: InstallmentPlan) => {
              const billedCount = plan.schedules?.filter((s: any) => s.is_billed).length || 0;
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
                        onClick={() => handleOpenEarlySettlePlan(plan)}
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
        </div>
      )}

      {/* ================= MODALS ================= */}
      {/* 1. Create Loan Modal */}
      <CreateLoanModal
        isOpen={isCreateLoanOpen}
        onClose={() => setIsCreateLoanOpen(false)}
      />

      {/* 2. Loan Detail Modal */}
      <LoanDetailModal
        isOpen={isDetailLoanOpen}
        onClose={() => {
          setIsDetailLoanOpen(false);
          setSelectedLoanId(null);
        }}
        loanId={selectedLoanId}
        onOpenAdjustRate={(loan) => {
          setIsDetailLoanOpen(false);
          handleOpenAdjustRate(loan);
        }}
      />

      {/* 3. Adjust Floating Rate Modal */}
      <AdjustLoanRateModal
        isOpen={isAdjustRateOpen}
        onClose={() => {
          setIsAdjustRateOpen(false);
          setAdjustRateLoan(null);
        }}
        loan={adjustRateLoan}
      />

      {/* 4. Installment Early Settle Modal */}
      <Modal
        isOpen={isEarlySettleOpen}
        onClose={() => setIsEarlySettleOpen(false)}
        title="Tất Toán Gói Trả Góp Trước Hạn"
      >
        <form onSubmit={handleExecuteEarlySettlePlan} className="space-y-4">
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
            <CurrencyInput
              label="Hoặc Phí tùy chỉnh (VNĐ)"
              value={settleCustomFee}
              onValueChange={(val) => setSettleCustomFee(val ? String(val) : "")}
              onChangeRaw={(raw) => setSettleCustomFee(raw)}
              placeholder="Để trống nếu tính %"
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
              isLoading={earlySettlePlanMutation.isPending}
            >
              Xác nhận Tất Toán
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
