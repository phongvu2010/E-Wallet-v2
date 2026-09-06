import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Clock,
  CreditCard,
  Receipt,
  Sparkles,
  Tag,
} from "lucide-react";
import { useAccountLiveBalances, useTransactions } from "../../hooks/useFinanceQueries";
import { Transaction } from "../../types/transaction";
import { AccountLiveBalance } from "../../types/account";
import { Card } from "../common/Card";
import { Spinner } from "../common/Spinner";
import { formatCurrency, formatDate, getTransactionTypeLabel } from "../../utils/formatters";

interface RecentTransactionsWidgetProps {
  onOpenCreateTx?: () => void;
}

export const RecentTransactionsWidget: React.FC<RecentTransactionsWidgetProps> = ({
  onOpenCreateTx,
}) => {
  const { data: txData, isLoading } = useTransactions({ page: 1, page_size: 6 });
  const { data: accounts = [] } = useAccountLiveBalances();

  const transactions = txData?.items || [];

  // Lookup map: account_id -> AccountLiveBalance
  const accountMap = React.useMemo(() => {
    const map = new Map<string, AccountLiveBalance>();
    accounts.forEach((acc) => map.set(acc.account_id, acc));
    return map;
  }, [accounts]);

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Giao Dịch Gần Đây</span>
              {transactions.length > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {transactions.length} mới nhất
                </span>
              )}
            </h3>
          </div>
        </div>

        <Link
          to="/transactions"
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 group"
        >
          <span>Xem sổ cái</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-center p-4">
          <Receipt className="w-10 h-10 text-slate-600 mb-2" />
          <p className="text-sm text-slate-400 font-medium">Chưa có giao dịch nào được ghi nhận</p>
          {onOpenCreateTx && (
            <button
              type="button"
              onClick={onOpenCreateTx}
              className="mt-3 text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ghi nhận giao dịch đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60 -mx-1">
          {transactions.map((tx: Transaction) => {
            const acc = accountMap.get(tx.account_id);
            const typeInfo = getTransactionTypeLabel(tx.transaction_type);
            const isPositive =
              tx.transaction_type === "INCOME" ||
              tx.transaction_type === "REFUND" ||
              tx.transaction_type === "CASHBACK_CREDIT";

            const rawAmt = Math.abs(tx.total_amount);

            return (
              <div
                key={tx.id}
                className="py-3 px-2 rounded-xl hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 group"
              >
                {/* Left: Type icon & Description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isPositive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-slate-800 text-slate-300 border-slate-700/80"
                    }`}
                  >
                    {isPositive ? (
                      <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-rose-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                      {tx.raw_description || tx.merchant?.cleaned_name || "Giao dịch tài chính"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                      <span className="text-slate-400 font-mono">
                        {formatDate(tx.transaction_date)}
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[120px] sm:max-w-[180px] text-slate-300">
                        {acc?.account_name || "Tài khoản"}
                      </span>
                      {tx.category && (
                        <>
                          <span>•</span>
                          <span className="truncate text-slate-400 hidden sm:inline">
                            {tx.category.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Badge */}
                <div className="text-right shrink-0">
                  <p
                    className={`text-xs sm:text-sm font-bold font-mono ${
                      isPositive ? "text-emerald-400" : "text-slate-100"
                    }`}
                  >
                    {isPositive ? "+" : "-"}
                    {formatCurrency(rawAmt)}
                  </p>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium border mt-0.5 ${typeInfo.color}`}
                  >
                    {typeInfo.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
