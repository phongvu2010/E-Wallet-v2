import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Gift,
  HandCoins,
  Landmark,
  Percent,
  Phone,
  Plus,
  TrendingDown,
  TrendingUp,
  User,
  Users,
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
import { CreateDebtModal } from "../components/debts/CreateDebtModal";
import { DebtDetailModal } from "../components/debts/DebtDetailModal";
import { RepayDebtModal } from "../components/debts/RepayDebtModal";
import { AdjustLoanRateModal } from "../components/loans/AdjustLoanRateModal";
import { CreateLoanModal } from "../components/loans/CreateLoanModal";
import { LoanDetailModal } from "../components/loans/LoanDetailModal";
import { useToast } from "../context/ToastContext";
import { useEarlySettleInstallment } from "../hooks/useFinanceMutations";
import {
  useDebtKPIs,
  useDebts,
  useInstallmentForecast,
  useInstallments,
  useLoanKPIs,
  useLoans,
} from "../hooks/useFinanceQueries";
import { Debt, DebtType } from "../types/debt";
import { InstallmentPlan } from "../types/installment";
import { Loan } from "../types/loan";
import { formatCurrency, formatDate } from "../utils/formatters";

export const InstallmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"debts" | "loans" | "installments">("debts");

  // --- 1. Personal Debts Data & State ---
  const { data: debts = [], isLoading: debtsLoading } = useDebts();
  const { data: debtKPIs } = useDebtKPIs();
  const [debtTypeFilter, setDebtTypeFilter] = useState<"ALL" | "BORROW" | "LEND">("ALL");
  const [isCreateDebtOpen, setIsCreateDebtOpen] = useState(false);
  const [selectedDetailDebtId, setSelectedDetailDebtId] = useState<string | null>(null);
  const [repayDebtTarget, setRepayDebtTarget] = useState<Debt | null>(null);
  const [createDebtDefaultType, setCreateDebtDefaultType] = useState<DebtType>("BORROW");

  // --- 2. Bank Loans Data & State ---
  const { data: loans = [], isLoading: loansLoading } = useLoans();
  const { data: loanKPIs } = useLoanKPIs();
  const [isCreateLoanOpen, setIsCreateLoanOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [isDetailLoanOpen, setIsDetailLoanOpen] = useState(false);
  const [adjustRateLoan, setAdjustRateLoan] = useState<Loan | null>(null);
  const [isAdjustRateOpen, setIsAdjustRateOpen] = useState(false);

  // --- 3. Installments Data & State ---
  const { data: plans = [], isLoading: plansLoading } = useInstallments();
  const { data: forecast = [] } = useInstallmentForecast();
  const earlySettlePlanMutation = useEarlySettleInstallment();
  const [isEarlySettleOpen, setIsEarlySettleOpen] = useState(false);
  const [settlePlanId, setSettlePlanId] = useState<string | null>(null);
  const [settlePlanName, setSettlePlanName] = useState<string>("");
  const [settleFeePercent, setSettleFeePercent] = useState<string>("2.0");
  const [settleCustomFee, setSettleCustomFee] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const { toast } = useToast();

  // Filtered Debts
  const filteredDebts = useMemo(() => {
    if (debtTypeFilter === "ALL") return debts;
    return debts.filter((d: Debt) => d.debt_type === debtTypeFilter);
  }, [debts, debtTypeFilter]);

  const borrowDebts = useMemo(() => debts.filter((d: Debt) => d.debt_type === "BORROW"), [debts]);
  const lendDebts = useMemo(() => debts.filter((d: Debt) => d.debt_type === "LEND"), [debts]);

  // Installment Early Settle Handlers
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

  // Loan Handlers
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
    <div className="space-y-8 pb-12">
      {/* 1. Page Header & Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Quản Lý Sổ Nợ, Vay Vốn & Trả Góp</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Theo dõi tập trung Sổ nợ dân sự bạn bè 0%, Khoản vay ngân hàng lãi suất thả nổi & Trả góp thẻ tín dụng
          </p>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("debts")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "debts"
                ? "bg-blue-600 text-white shadow-md font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Sổ Nợ Dân Sự ({debts.length})</span>
          </button>
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
            <span>Vay Ngân Hàng ({loans.length})</span>
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
            <span>Trả Góp Thẻ ({plans.length})</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: SỔ NỢ DÂN SỰ & VAY MƯỢN BẠN BÈ (PERSONAL DEBTS)                */}
      {/* ==================================================================== */}
      {activeTab === "debts" && (
        <div className="space-y-6">
          {/* Debt Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Tôi đang vay (Nợ phải trả)</span>
                <ArrowDownLeft className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400">
                {formatCurrency(debtKPIs?.total_borrow_remaining ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {debtKPIs?.total_borrow_count ?? borrowDebts.length} khoản vay bạn bè / người thân
              </p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Tôi cho vay (Nợ phải thu)</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {formatCurrency(debtKPIs?.total_lend_remaining ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {debtKPIs?.total_lend_count ?? lendDebts.length} khoản cho người khác mượn
              </p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Gốc đã thanh toán</span>
                <Check className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-xl font-bold font-mono text-sky-400">
                {formatCurrency(debtKPIs?.total_borrow_paid ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Lũy kế tiền gốc đã trả</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span className="text-amber-300">Tiền bồi dưỡng / Cảm ơn</span>
                <Gift className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400">
                {formatCurrency(debtKPIs?.total_borrow_extra_paid ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Đã tính vào Chi tiêu thực tế</p>
            </Card>
          </div>

          {/* Controls Bar & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDebtTypeFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  debtTypeFilter === "ALL"
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tất cả ({debts.length})
              </button>
              <button
                type="button"
                onClick={() => setDebtTypeFilter("BORROW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  debtTypeFilter === "BORROW"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Tôi Đi Vay ({borrowDebts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDebtTypeFilter("LEND")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  debtTypeFilter === "LEND"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Tôi Cho Vay ({lendDebts.length})</span>
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateDebtDefaultType("LEND");
                  setIsCreateDebtOpen(true);
                }}
                className="text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                leftIcon={<ArrowUpRight className="w-4 h-4" />}
              >
                Cho Vay Mới
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreateDebtDefaultType("BORROW");
                  setIsCreateDebtOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Ghi Nhận Đi Vay
              </Button>
            </div>
          </div>

          {/* Debts Grid List */}
          {debtsLoading && debts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-xs text-slate-400">Đang tải danh sách sổ nợ...</p>
            </div>
          ) : filteredDebts.length === 0 ? (
            <Card className="p-10 text-center space-y-3 bg-slate-950/40 border-dashed border-slate-800">
              <HandCoins className="w-10 h-10 text-slate-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-200">Chưa có khoản vay mượn nào</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Ghi chép các khoản vay bạn bè, người thân 0% lãi suất với cơ chế trả nợ nhiều lần và bồi dưỡng cảm ơn.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreateDebtDefaultType("BORROW");
                  setIsCreateDebtOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Ghi nhận khoản vay đầu tiên
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDebts.map((debt: Debt) => {
                const isBorrow = debt.debt_type === "BORROW";
                const progressPercent = Math.min(
                  100,
                  Math.round((debt.total_paid_principal / debt.principal_amount) * 100)
                );

                return (
                  <Card
                    key={debt.id}
                    hover
                    className="p-5 flex flex-col justify-between space-y-4 border-slate-800 bg-slate-900/80"
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                              isBorrow
                                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                : "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                            }`}
                          >
                            {isBorrow ? (
                              <ArrowDownLeft className="w-5 h-5" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{debt.counterparty_name}</span>
                            </h4>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(debt.start_date)}
                              {debt.due_date && (
                                <span className="text-amber-400 ml-1">
                                  • Hạn: {formatDate(debt.due_date)}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={debt.status === "PAID_OFF" ? "success" : "neutral"}>
                            {debt.status === "PAID_OFF" ? "Đã Tất Toán" : "Đang Nợ"}
                          </Badge>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isBorrow
                                ? "bg-blue-500/10 text-blue-300"
                                : "bg-indigo-500/10 text-indigo-300"
                            }`}
                          >
                            {isBorrow ? "Tôi Đi Vay" : "Tôi Cho Vay"}
                          </span>
                        </div>
                      </div>

                      {/* Financial Numbers Grid */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 my-3 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Dư nợ còn lại</span>
                          <span className="font-extrabold text-amber-400 text-sm mt-0.5 block">
                            {formatCurrency(debt.remaining_amount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">Gốc ban đầu</span>
                          <span className="font-bold text-slate-200 mt-0.5 block">
                            {formatCurrency(debt.principal_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Extra Tip Badge if present */}
                      {debt.total_extra_amount > 0 && (
                        <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 mb-3">
                          <span className="flex items-center gap-1 font-medium">
                            <Gift className="w-3.5 h-3.5" />
                            <span>Đã bồi dưỡng cảm ơn:</span>
                          </span>
                          <span className="font-bold">{formatCurrency(debt.total_extra_amount)}</span>
                        </div>
                      )}

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Đã trả gốc ({formatCurrency(debt.total_paid_principal)})</span>
                          <span className="font-semibold text-emerald-400">{progressPercent}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailDebtId(debt.id)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Xem Lịch Sử ({debt.repayments?.length || 0})
                      </button>

                      {debt.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          onClick={() => setRepayDebtTarget(debt)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isBorrow ? "Trả Nợ" : "Thu Nợ"}</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: KHOẢN VAY NGÂN HÀNG & LÃI THẢ NỔI (BANK LOANS)                 */}
      {/* ==================================================================== */}
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
                              : "neutral"
                          }
                        >
                          {loan.status === "ACTIVE" ? "Đang Trả Nợ" : "Đã Tất Toán"}
                        </Badge>
                      </div>

                      {/* Title & Bank */}
                      <div className="mt-3">
                        <h4 className="font-bold text-slate-100 text-sm">{loan.loan_name}</h4>
                        <p className="text-xs text-slate-400">
                          {loan.institution?.name || "Ngân hàng"} {loan.loan_code ? `• ${loan.loan_code}` : ""}
                        </p>
                      </div>

                      {/* Main Financial Values */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 my-3">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Dư nợ gốc còn lại</span>
                          <span className="font-bold text-rose-400 text-sm mt-0.5 block">
                            {formatCurrency(loan.remaining_principal)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">Lãi suất hiện tại</span>
                          <span className="font-bold text-purple-400 text-sm mt-0.5 block">
                            {loan.current_interest_rate}% / năm
                          </span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>
                            Tiến độ: {paidCount}/{totalCount} kỳ
                          </span>
                          <span className="font-semibold text-slate-300">
                            {progressPercent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAdjustRate(loan)}
                        leftIcon={<Percent className="w-3.5 h-3.5" />}
                      >
                        Đổi Lãi Suất
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenLoanDetail(loan.id)}
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

      {/* ==================================================================== */}
      {/* TAB 3: TRẢ GÓP THẺ TÍN DỤNG 0% (INSTALLMENTS)                         */}
      {/* ==================================================================== */}
      {activeTab === "installments" && (
        <div className="space-y-6">
          {/* Installment KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Gói trả góp đang chạy</span>
                <CreditCard className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {activePlans.length} gói
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Lãi suất 0% ưu đãi</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Dư nợ trả góp còn lại</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400">
                {formatCurrency(totalRemainingBalance)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Chiếm dụng hạn mức thẻ</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Dự phóng tháng tới</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400">
                {formatCurrency(forecast[0]?.total_monthly_payment ?? 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Nghĩa vụ trả góp tháng tới</p>
            </Card>

            <Card className="p-4 bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Tổng gói đã hoàn thành</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {plans.filter((p: InstallmentPlan) => p.status === "COMPLETED" || p.status === "EARLY_SETTLED").length} gói
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Đã giải phóng hạn mức</p>
            </Card>
          </div>

          {/* Forecast Chart Component */}
          {forecast.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-3">
                Biểu Đồ Dự Phóng Dòng Tiền Trả Góp Các Tháng Tới
              </h3>
              <InstallmentForecastChart data={forecast} />
            </div>
          )}

          {/* Installment Plans List */}
          <div>
            <h3 className="text-base font-bold text-slate-100 mb-4">
              Danh Sách Gói Trả Góp ({plans.length})
            </h3>

            {plansLoading && plans.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-3">
                <Spinner size="lg" />
                <p className="text-xs text-slate-400">Đang tải danh sách trả góp...</p>
              </div>
            ) : plans.length === 0 ? (
              <Card className="p-8 text-center text-xs text-slate-400 border-dashed border-slate-800">
                Chưa có gói trả góp nào được ghi nhận.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan: InstallmentPlan) => {
                  const billedCount = plan.schedules?.filter((s) => s.is_billed).length || 0;
                  const totalCount = plan.term_months || 1;
                  const progressPercent = Math.min(100, (billedCount / totalCount) * 100);

                  return (
                    <Card
                      key={plan.id}
                      hover
                      className="p-5 flex flex-col justify-between space-y-4 border-slate-800"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {plan.product_name}
                          </span>
                          <Badge
                            variant={
                              plan.status === "ACTIVE"
                                ? "info"
                                : plan.status === "EARLY_SETTLED"
                                ? "warning"
                                : "success"
                            }
                          >
                            {plan.status === "ACTIVE"
                              ? "Đang Trả"
                              : plan.status === "EARLY_SETTLED"
                              ? "Tất Toán Sớm"
                              : "Hoàn Thành"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 my-3 text-xs">
                          <div>
                            <span className="text-[11px] text-slate-400 block">Dư nợ còn lại</span>
                            <span className="font-bold text-rose-400 text-sm mt-0.5 block">
                              {formatCurrency(plan.remaining_balance)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 block">Mỗi tháng</span>
                            <span className="font-bold text-purple-400 text-sm mt-0.5 block">
                              {formatCurrency(plan.monthly_payment)}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>
                              Kỳ: {billedCount}/{totalCount} tháng
                            </span>
                            <span className="font-semibold text-slate-300">
                              {progressPercent.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-purple-500 h-full rounded-full"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
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
            )}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      {/* 1. Create Debt Modal */}
      <CreateDebtModal
        isOpen={isCreateDebtOpen}
        onClose={() => setIsCreateDebtOpen(false)}
        defaultType={createDebtDefaultType}
      />

      {/* 2. Repay Debt Modal */}
      <RepayDebtModal
        isOpen={!!repayDebtTarget}
        onClose={() => setRepayDebtTarget(null)}
        debt={repayDebtTarget}
      />

      {/* 3. Debt Detail Modal */}
      <DebtDetailModal
        isOpen={!!selectedDetailDebtId}
        onClose={() => setSelectedDetailDebtId(null)}
        debtId={selectedDetailDebtId}
        onOpenRepay={(debt) => {
          setSelectedDetailDebtId(null);
          setRepayDebtTarget(debt);
        }}
      />

      {/* 4. Create Loan Modal */}
      <CreateLoanModal
        isOpen={isCreateLoanOpen}
        onClose={() => setIsCreateLoanOpen(false)}
      />

      {/* 5. Loan Detail Modal */}
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

      {/* 6. Adjust Floating Rate Modal */}
      <AdjustLoanRateModal
        isOpen={isAdjustRateOpen}
        onClose={() => {
          setIsAdjustRateOpen(false);
          setAdjustRateLoan(null);
        }}
        loan={adjustRateLoan}
      />

      {/* 7. Installment Early Settle Modal */}
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
              onChange={(val) => setSettleCustomFee(val ? String(val) : "")}
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
