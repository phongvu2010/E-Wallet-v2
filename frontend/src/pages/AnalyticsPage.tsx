import React from "react";
import {
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  PieChart,
  PiggyBank,
  ShieldAlert,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { SpendingDonutChart } from "../components/charts/SpendingDonutChart";
import { Badge } from "../components/common/Badge";
import { Card } from "../components/common/Card";
import { Spinner } from "../components/common/Spinner";
import {
  useCashFlow,
  useCreditUtilization,
  useMonthlySpending,
  useNetWorth,
} from "../hooks/useFinanceQueries";
import {
  CreditUtilization,
  MonthlyCashFlow,
  MonthlyCategorySpending,
} from "../types/analytics";
import { formatCurrency, formatDate, getRiskLevelColor } from "../utils/formatters";

export const AnalyticsPage: React.FC = () => {
  const { data: nw, isLoading: nwLoading } = useNetWorth();
  const { data: cashFlow = [], isLoading: cfLoading } = useCashFlow(24);
  const {
    data: monthlySpending = [],
    isLoading: spendingLoading,
  } = useMonthlySpending(200);
  const {
    data: utilization = [],
    isLoading: utLoading,
  } = useCreditUtilization();

  if (
    (spendingLoading || utLoading || nwLoading || cfLoading) &&
    monthlySpending.length === 0 &&
    utilization.length === 0
  ) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải báo cáo tài chính...</p>
      </div>
    );
  }

  // Aggregate by Parent Category
  const parentCategoryMap: Record<string, number> = {};
  monthlySpending.forEach((item: MonthlyCategorySpending) => {
    const parentName = item.parent_category_name || item.category_name;
    parentCategoryMap[parentName] =
      (parentCategoryMap[parentName] || 0) + Number(item.total_spending);
  });

  const parentCategoryChartData = Object.entries(parentCategoryMap).map(
    ([name, value]) => ({
      name,
      value,
      color: "",
    })
  );

  const totalSpendingSum = Object.values(parentCategoryMap).reduce(
    (a: number, b: number) => a + b,
    0
  );

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <span>Báo Cáo Phân Tích Dòng Tiền, Tài Sản Ròng & Rủi Ro Tín Dụng</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tổng hợp dòng tiền thu nhập - chi tiêu (Cash Flow), cơ cấu tài sản (Net Worth) và tỷ lệ sử dụng hạn mức
        </p>
      </div>

      {/* 2. Credit Utilization Matrix */}
      {(() => {
        const creditCardsUtilization = utilization.filter(
          (card: CreditUtilization) => Number(card.credit_limit) > 0
        );

        return (
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Ma Trận Tỷ Lệ Sử Dụng Hạn Mức Thẻ (Credit Utilization Matrix)</span>
                  </h3>
                  <Badge variant="info" size="sm">
                    {creditCardsUtilization.length} Thẻ Tín Dụng
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Khuyến nghị chuẩn quốc tế: Duy trì tỷ lệ &lt; 30% để tối ưu điểm tín dụng CIC
                </p>
              </div>
            </div>

            {creditCardsUtilization.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-500 text-xs">
                <span>Chưa có thẻ tín dụng nào được thiết lập hạn mức</span>
              </div>
            ) : (
              <div
                className={`grid ${
                  creditCardsUtilization.length === 1
                    ? "grid-cols-1"
                    : creditCardsUtilization.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : creditCardsUtilization.length === 3
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                } gap-4`}
              >
                {creditCardsUtilization.map((card: CreditUtilization) => {
                  const risk = getRiskLevelColor(card.risk_level);
                  return (
                    <div
                      key={card.account_id}
                      className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 flex flex-col justify-between h-full min-h-[148px] hover:border-slate-700 transition-all shadow-sm"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="text-xs font-bold text-slate-200 line-clamp-2"
                          title={card.account_name}
                        >
                          {card.account_name}
                        </span>
                        <Badge variant={risk.badge as any} size="sm" className="shrink-0 font-bold">
                          {card.risk_level}
                        </Badge>
                      </div>

                      {/* Card Metric: % on Row 1, Amount used on Row 2 */}
                      <div className="space-y-1 my-2">
                        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-100">
                          {Number(card.utilization_percentage).toFixed(1)}%
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between gap-1 flex-wrap">
                          <span className="text-slate-500">Đã dùng:</span>
                          <span className="text-slate-200 font-semibold truncate">
                            {formatCurrency(card.current_balance)} / {formatCurrency(card.credit_limit)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar Fixed at Bottom */}
                      <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden mt-auto">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${risk.bg}`}
                          style={{
                            width: `${Math.min(100, Math.max(0, Number(card.utilization_percentage)))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })()}

      {/* 3. Category Spending Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 flex flex-col h-full">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>Phân Bổ Theo Nhóm Danh Mục</span>
          </h3>
          <SpendingDonutChart
            data={parentCategoryChartData}
            totalAmount={totalSpendingSum}
          />
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span>Chi Tiết Chi Tiêu Theo Tháng & Hạng Mục</span>
          </h3>

          <div className="overflow-x-auto max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Tháng</th>
                  <th className="py-2.5 px-3">Hạng Mục Chi Tiêu</th>
                  <th className="py-2.5 px-3">Nhóm Cha</th>
                  <th className="py-2.5 px-3 text-center">Số GD</th>
                  <th className="py-2.5 px-3 text-right font-bold">Tổng Chi Tiêu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {monthlySpending.map((item: MonthlyCategorySpending, idx: number) => {
                  const spending = Number(item.total_spending);
                  return (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono text-slate-300">
                        {formatDate(item.month, "MM/yyyy")}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-200">
                        {item.category_name}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {item.parent_category_name}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-400">
                        {item.transaction_count}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold ${
                          spending < 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {formatCurrency(spending)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 4. Monthly Cash Flow (Thu Nhập vs Chi Tiêu vs Tích Lũy) - Đã đưa xuống dưới */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Báo Cáo Dòng Tiền Thu - Chi Hàng Tháng (Cash Flow)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              So sánh Thu nhập (Income), Chi tiêu thực tế (Expense) và Tỷ lệ tích lũy/tiết kiệm (Savings Rate)
            </p>
          </div>
        </div>

        {cashFlow.length === 0 ? (
          <div className="h-36 flex items-center justify-center text-slate-500 text-sm">
            Chưa có đủ dữ liệu dòng tiền theo tháng
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Tháng</th>
                  <th className="py-3 px-4 text-right text-emerald-400 font-bold">Tổng Thu Nhập</th>
                  <th className="py-3 px-4 text-right text-rose-400 font-bold">Tổng Chi Tiêu</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-200">Tiền Tích Lũy (Net)</th>
                  <th className="py-3 px-4 text-center">Tỷ Lệ Tiết Kiệm</th>
                  <th className="py-3 px-4 text-center">Số GD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {cashFlow.map((cf: MonthlyCashFlow, idx: number) => {
                  const isPositive = Number(cf.net_savings) >= 0;
                  const savingsRate = Number(cf.savings_rate_percent || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {formatDate(cf.month, "MM/yyyy")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-semibold">
                        +{formatCurrency(cf.total_income)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-rose-400 font-semibold">
                        -{formatCurrency(cf.total_expense)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
                          {isPositive ? "+" : ""}{formatCurrency(cf.net_savings)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            savingsRate >= 30
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : savingsRate >= 10
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {savingsRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                        {cf.total_transactions_count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
