import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  HandCoins,
  Landmark,
  ShieldCheck,
  TrendingDown,
  Users,
} from "lucide-react";
import { useDebtKPIs, useLoanKPIs, useLoans } from "../../hooks/useFinanceQueries";
import { Loan } from "../../types/loan";
import { formatCurrency } from "../../utils/formatters";
import { Card } from "../common/Card";
import { Spinner } from "../common/Spinner";

export const ActiveLoansSummaryWidget: React.FC = () => {
  const { data: loanKPIs, isLoading: loanKPIsLoading } = useLoanKPIs();
  const { data: loans = [], isLoading: loansLoading } = useLoans("ACTIVE");
  const { data: debtKPIs, isLoading: debtKPIsLoading } = useDebtKPIs();

  if (loanKPIsLoading || loansLoading || debtKPIsLoading) {
    return (
      <Card className="h-44 flex items-center justify-center">
        <Spinner size="md" />
      </Card>
    );
  }

  const activeLoans = loans.filter((l: Loan) => l.status === "ACTIVE");
  const totalLoanRemaining = loanKPIs ? Number(loanKPIs.total_remaining_principal) : 0;
  const dueThisMonth = loanKPIs ? Number(loanKPIs.due_this_month_amount) : 0;

  const totalPersonalBorrow = debtKPIs ? Number(debtKPIs.total_borrow_remaining) : 0;
  const totalPersonalLend = debtKPIs ? Number(debtKPIs.total_lend_remaining) : 0;

  const hasAnyLiabilities =
    activeLoans.length > 0 || totalPersonalBorrow > 0 || totalPersonalLend > 0;

  if (!hasAnyLiabilities) {
    return (
      <Card className="p-5 bg-slate-900/60 border-slate-800 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Landmark className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Khoản Vay & Sổ Nợ Cá Nhân</h3>
          </div>
          <Link
            to="/installments"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Quản lý nợ & vay →
          </Link>
        </div>

        <div className="py-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Không có nợ vay nào đang mở</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Bạn không có hợp đồng vay ngân hàng hay khoản nợ bạn bè nào đang tồn đọng.
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
            <HandCoins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Khoản Vay & Sổ Nợ Dân Sự</span>
            </h3>
          </div>
        </div>

        <Link
          to="/installments"
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 group"
        >
          <span>Xem chi tiết sổ nợ</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {totalLoanRemaining > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 block mb-1">
              Vay Ngân Hàng ({activeLoans.length})
            </span>
            <span className="text-base font-bold font-mono text-purple-400 block">
              {formatCurrency(totalLoanRemaining)}
            </span>
            {dueThisMonth > 0 && (
              <span className="text-[10px] text-amber-400 block mt-0.5">
                Hạn tháng này: {formatCurrency(dueThisMonth)}
              </span>
            )}
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1 flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3 text-rose-400" />
            <span>Nợ Bạn Bè (Đi Vay)</span>
          </span>
          <span className="text-base font-bold font-mono text-rose-400 block">
            {formatCurrency(totalPersonalBorrow)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {debtKPIs?.total_borrow_count || 0} khoản nợ bạn bè
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block mb-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            <span>Bạn Bè Nợ (Cho Vay)</span>
          </span>
          <span className="text-base font-bold font-mono text-emerald-400 block">
            {formatCurrency(totalPersonalLend)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {debtKPIs?.total_lend_count || 0} khoản cho mượn
          </span>
        </div>
      </div>

      {/* Mini Loan List if loans exist */}
      {activeLoans.length > 0 && (
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
      )}
    </Card>
  );
};
