import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Award,
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Gauge,
  Landmark,
  PieChart as PieIcon,
  PiggyBank,
  Plus,
  Receipt,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

// Visual Card Components
import { CreditCardVisual } from "../components/cards/CreditCardVisual";
import { ObligationCard } from "../components/cards/ObligationCard";
import { CardRecommendationWidget } from "../components/cards/CardRecommendationWidget";
import { NetWorthHeroWidget } from "../components/cards/NetWorthHeroWidget";

// Chart Components
import { MonthlySpendingBarChart } from "../components/charts/MonthlySpendingBarChart";
import { SpendingDonutChart } from "../components/charts/SpendingDonutChart";

// Modal Components
import { CreateAccountModal } from "../components/accounts/CreateAccountModal";
import { SmartCreateTransactionModal } from "../components/transactions/SmartCreateTransactionModal";

// Dashboard Specialized Widgets
import { RecentTransactionsWidget } from "../components/dashboard/RecentTransactionsWidget";
import { CashFlowSavingsWidget } from "../components/dashboard/CashFlowSavingsWidget";
import { ActiveLoansSummaryWidget } from "../components/dashboard/ActiveLoansSummaryWidget";
import { RewardsCashbackWidget } from "../components/dashboard/RewardsCashbackWidget";
import { BudgetPaceWidget } from "../components/dashboard/BudgetPaceWidget";

// Common UI
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import {
  useAccountLiveBalances,
  useDashboardOverview,
  useMonthlySpending,
  useUpcomingObligations,
} from "../hooks/useFinanceQueries";
import { AccountLiveBalance } from "../types/account";
import { MonthlyCategorySpending, UpcomingObligation } from "../types/analytics";
import { formatCurrency } from "../utils/formatters";

export const DashboardPage: React.FC = () => {
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: accounts = [] } = useAccountLiveBalances();
  const { data: obligations = [] } = useUpcomingObligations(30);
  const { data: monthlySpending = [] } = useMonthlySpending(200);

  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isCreateTxOpen, setIsCreateTxOpen] = useState(false);

  // Generate full monthly spending data for the latest year (year-to-date)
  const annualSpendingData = useMemo(() => {
    if (monthlySpending.length === 0) return [];

    // Map month string (YYYY-MM) -> total spending
    const monthlyTotalsMap: Record<string, number> = {};
    monthlySpending.forEach((item: MonthlyCategorySpending) => {
      if (!item.month) return;
      const mStr = item.month.substring(0, 7); // "YYYY-MM"
      monthlyTotalsMap[mStr] = (monthlyTotalsMap[mStr] || 0) + Number(item.total_spending);
    });

    // Determine latest year from data (or fallback to current year)
    const recordedYears = Object.keys(monthlyTotalsMap)
      .map((mStr) => parseInt(mStr.substring(0, 4), 10))
      .filter((y) => !isNaN(y));
    const latestYear =
      recordedYears.length > 0
        ? Math.max(...recordedYears)
        : new Date().getFullYear();

    // Determine max month in that latest year
    const monthsInLatestYear = Object.keys(monthlyTotalsMap)
      .filter((mStr) => mStr.startsWith(`${latestYear}-`))
      .map((mStr) => parseInt(mStr.substring(5, 7), 10))
      .filter((m) => !isNaN(m));

    const currentCalendarMonth = new Date().getMonth() + 1;
    const maxMonth =
      monthsInLatestYear.length > 0
        ? Math.max(
            Math.max(...monthsInLatestYear),
            latestYear === new Date().getFullYear() ? currentCalendarMonth : 1
          )
        : latestYear === new Date().getFullYear()
        ? currentCalendarMonth
        : 12;

    // Generate timeline for all months from Month 1 to maxMonth in latestYear
    const result: { month: string; total_spending: number }[] = [];
    for (let m = 1; m <= maxMonth; m++) {
      const monthKey = `${latestYear}-${String(m).padStart(2, "0")}`;
      result.push({
        month: `${monthKey}-01`,
        total_spending: Math.max(0, monthlyTotalsMap[monthKey] ?? 0),
      });
    }
    return result;
  }, [monthlySpending]);

  if ((overviewLoading && !overview) || !overview) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải dữ liệu tài chính...</p>
      </div>
    );
  }

  // Group asset accounts (bank, cash, e-wallet, savings) vs credit cards
  const assetAccounts = accounts.filter(
    (acc: AccountLiveBalance) =>
      acc.is_asset || acc.account_type !== "CREDIT_CARD"
  );
  const creditCards = accounts.filter(
    (acc: AccountLiveBalance) =>
      !acc.is_asset && (acc.account_type === "CREDIT_CARD" || !acc.account_type)
  );

  // Group latest month category spending for donut chart
  const latestMonth = monthlySpending.length > 0 ? monthlySpending[0].month : null;
  const currentMonthCategories = monthlySpending
    .filter((item: MonthlyCategorySpending) => !latestMonth || item.month === latestMonth)
    .slice(0, 7)
    .map((item: MonthlyCategorySpending) => ({
      name: item.category_name,
      value: Number(item.total_spending),
      color: "",
    }));

  const currentMonthTotal = currentMonthCategories.reduce(
    (acc: number, curr: { value: number }) => acc + curr.value,
    0
  );

  return (
    <div className="space-y-8 pb-12">
      {/* ==================================================================== */}
      {/* KHỐI 1: VỊ THẾ TÀI SẢN & HÀNH ĐỘNG NHANH                             */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        {/* Hero Net Worth Banner */}
        <NetWorthHeroWidget />

        {/* Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              Trung tâm Quản lý Tài chính (Ngân hàng, Tiền mặt, Thẻ tín dụng, Khoản vay & Ưu đãi)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateAccountOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Thêm Tài Khoản / Ví</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateTxOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Giao Dịch Mới</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* KHỐI 2: DÒNG TIỀN & NHỊP ĐỘ CHI TIÊU THÁNG HIỆN TẠI                  */}
      {/* ==================================================================== */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7">
            <CashFlowSavingsWidget />
          </div>
          <div className="lg:col-span-5">
            <BudgetPaceWidget />
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* KHỐI 3: TỔNG QUAN DANH MỤC TÀI SẢN & NGHĨA VỤ NỢ                     */}
      {/* ==================================================================== */}
      <section className="space-y-6">
        {/* 3.1. Tài khoản thanh toán & Ví tiền */}
        {assetAccounts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" />
                <span>Tài Khoản Thanh Toán & Ví Tiền ({assetAccounts.length})</span>
              </h3>
              <Link
                to="/accounts"
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
              >
                Quản lý tài khoản →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assetAccounts.map((acc: AccountLiveBalance) => (
                <div
                  key={acc.account_id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: acc.color_hex || "#0284c7" }}
                      >
                        {acc.account_type === "CASH" ? (
                          <Banknote className="w-5 h-5" />
                        ) : acc.account_type === "E_WALLET" ? (
                          <Smartphone className="w-5 h-5" />
                        ) : acc.account_type === "SAVINGS" ? (
                          <PiggyBank className="w-5 h-5" />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-100 truncate">{acc.account_name}</h4>
                        <p className="text-xs text-slate-400 truncate">{acc.bank_name || acc.card_number_masked}</p>
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700 shrink-0">
                      {acc.account_type === "CASH"
                        ? "Tiền mặt"
                        : acc.account_type === "E_WALLET"
                        ? "Ví điện tử"
                        : acc.account_type === "SAVINGS"
                        ? "Tiết kiệm"
                        : "Ngân hàng"}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Số dư hiện tại</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {formatCurrency(acc.live_current_balance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3.2. Danh sách Thẻ tín dụng */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <span>
                Thẻ Tín Dụng ({creditCards.filter((acc: AccountLiveBalance) => acc.status !== "CLOSED" && acc.status !== "REPLACED").length})
              </span>
            </h3>
            <Link
              to="/accounts"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Xem chi tiết hạn mức →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creditCards
              .filter((acc: AccountLiveBalance) => acc.status !== "CLOSED" && acc.status !== "REPLACED")
              .map((acc: AccountLiveBalance) => (
                <CreditCardVisual key={acc.account_id} account={acc} />
              ))}
          </div>
        </div>

        {/* 3.3. Khoản Vay Dài Hạn & Ví Điểm Thưởng */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-6">
            <ActiveLoansSummaryWidget />
          </div>
          <div className="lg:col-span-6">
            <RewardsCashbackWidget />
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* KHỐI 4: HÀNH ĐỘNG THÔNG MINH & NGHĨA VỤ THANH TOÁN                   */}
      {/* ==================================================================== */}
      <section className="space-y-6">
        {/* Widget Đề Xuất Thẻ Quẹt Tối Ưu */}
        <CardRecommendationWidget />

        {/* Giao Dịch Gần Đây & Lịch Nghĩa Vụ Thanh Toán 30 Ngày */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Recent Transactions Feed (7 Cols) */}
          <div className="lg:col-span-7">
            <RecentTransactionsWidget onOpenCreateTx={() => setIsCreateTxOpen(true)} />
          </div>

          {/* Right Column: Upcoming Payment Obligations (5 Cols) */}
          <div className="lg:col-span-5">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <span>Nghĩa Vụ Thanh Toán Sắp Tới (30 ngày)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tổng số tiền cần chuẩn bị:{" "}
                    <span className="text-slate-200 font-bold font-mono">
                      {formatCurrency(overview.total_upcoming_due_30d)}
                    </span>
                  </p>
                </div>
                <Link
                  to="/statements"
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                >
                  Lịch sao kê →
                </Link>
              </div>

              {obligations.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                  Không có khoản nợ sao kê hoặc trả góp nào đến hạn trong 30 ngày tới
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1 flex-1">
                  {obligations.slice(0, 4).map((ob: UpcomingObligation, idx: number) => (
                    <ObligationCard key={idx} obligation={ob} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* KHỐI 5: BÁO CÁO PHÂN TÍCH & XU HƯỚNG CHI TIÊU                        */}
      {/* ==================================================================== */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Donut Chart: Cơ Cấu Chi Tiêu Nhóm Danh Mục Tháng Này (4 Cols) */}
          <div className="lg:col-span-4">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-400" />
                  <span>Cơ Cấu Chi Tiêu Tháng Này</span>
                </h3>
                <Link
                  to="/analytics"
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Chi tiết
                </Link>
              </div>

              <SpendingDonutChart
                data={currentMonthCategories}
                totalAmount={currentMonthTotal}
              />
            </Card>
          </div>

          {/* Bar Chart: Xu Hướng Chi Tiêu Hàng Tháng Lịch Sử (8 Cols) */}
          <div className="lg:col-span-8">
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    <span>Xu Hướng Chi Tiêu Hàng Tháng</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Đã tự động bù trừ các khoản hoàn tiền, giảm phí và hủy giao dịch
                  </p>
                </div>
                <Link
                  to="/analytics"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Báo cáo chi tiết →
                </Link>
              </div>

              <MonthlySpendingBarChart data={annualSpendingData} />
            </Card>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* MODALS TƯƠNG TÁC NHANH                                               */}
      {/* ==================================================================== */}
      <CreateAccountModal
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
      />

      <SmartCreateTransactionModal
        isOpen={isCreateTxOpen}
        onClose={() => setIsCreateTxOpen(false)}
      />
    </div>
  );
};
