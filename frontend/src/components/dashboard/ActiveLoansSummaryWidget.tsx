import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { useLoanKPIs, useLoans } from "../../hooks/useFinanceQueries";
import { Loan } from "../../types/loan";
import { formatCurrency } from "../../utils/formatters";
import { Card } from "../common/Card";
import { Spinner } from "../common/Spinner";

export const ActiveLoansSummaryWidget: React.FC = () => {
  const { data: kpis, isLoading: kpisLoading } = useLoanKPIs();
  const { data: loans = [], isLoading: loansLoading } = useLoans("ACTIVE");

  if (kpisLoading || loansLoading) {
    return (
      <Card className="h-44 flex items-center justify-center">
        <Spinner size="md" />
      </Card>
    );
  }

  const activeLoans = loans.filter((l: Loan) => l.status === "ACTIVE");
  const totalRemaining = kpis ? Number(kpis.total_remaining_principal) : 0;
  const dueThisMonth = kpis ? Number(kpis.due_this_month_amount) : 0;
  const dueCount = kpis ? kpis.due_this_month_count : 0;

  if (activeLoans.length === 0 && totalRemaining === 0) {
    return (
      <Card className="p-5 bg-slate-900/60 border-slate-800 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Landmark className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Khoản Vay & Thế Chấp</h3>
          </div>
          <Link
            to="/installments"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Quản lý vay →
          </Link>
        </div>

        <div className="py-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Không có dư nợ vay dài hạn</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Bạn không có hợp đồng vay mua nhà, mua xe hay vay tiêu dùng nào đang hoạt động.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/20 border-indigo-500/20 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Khoản Vay & Thế Chấp</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {activeLoans.length} gói vay active
              </span>
            </h3>
          </div>
        </div>

        <Link
          to="/installments"
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 group"
        >
          <span>Chi tiết lịch trả</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Top 2 KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">
            Tổng Dư Nợ Gốc Còn Lại
          </span>
          <span className="text-base sm:text-lg font-bold font-mono text-indigo-300">
            {formatCurrency(totalRemaining)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-amber-400" />
            <span>Gốc + Lãi Đến Hạn Tháng Này</span>
          </span>
          <span className="text-base sm:text-lg font-bold font-mono text-amber-400">
            {formatCurrency(dueThisMonth)}
          </span>
          {dueCount > 0 && (
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ({dueCount} kỳ đến hạn thanh toán)
            </span>
          )}
        </div>
      </div>

      {/* Mini Loan List */}
      <div className="space-y-2">
        {activeLoans.slice(0, 2).map((loan: Loan) => (
          <div
            key={loan.id}
            className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-3 text-xs"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-200 truncate">{loan.loan_name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{loan.institution?.short_name || loan.institution?.name || "Ngân hàng"}</span>
                <span>•</span>
                <span className="text-indigo-400 font-mono">
                  Lãi suất {Number(loan.current_interest_rate).toFixed(2)}%/năm
                </span>
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="font-bold font-mono text-slate-200">
                {formatCurrency(loan.remaining_principal)}
              </span>
              <span className="text-[10px] text-slate-400 block">Dư nợ còn lại</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
