import React, { useEffect, useState } from "react";
import { statementService } from "../services/statementService";
import { accountService } from "../services/accountService";
import {
  Statement,
  StatementReconciliation,
  StatementPaymentStatus,
} from "../types/statement";
import { Account } from "../types/account";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Select } from "../components/common/Select";
import { Spinner } from "../components/common/Spinner";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
} from "lucide-react";
import { clsx } from "clsx";

export const StatementsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"payment" | "reconciliation">("payment");
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const [paymentStatuses, setPaymentStatuses] = useState<StatementPaymentStatus[]>([]);
  const [reconciliations, setReconciliations] = useState<StatementReconciliation[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchStatementsData();
  }, [selectedAccountId, activeTab]);

  const fetchAccounts = async () => {
    try {
      const res = await accountService.getAll();
      setAccounts(res);
    } catch (err) {
      console.error("Error loading accounts", err);
    }
  };

  const fetchStatementsData = async () => {
    setLoading(true);
    try {
      if (activeTab === "payment") {
        const res = await statementService.getPaymentStatus(selectedAccountId || undefined);
        setPaymentStatuses(res);
      } else {
        const res = await statementService.getReconciliation(selectedAccountId || undefined);
        setReconciliations(res);
      }
    } catch (err) {
      console.error("Error fetching statements data", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>Sao Kê Thẻ & Đối Soát Dư Nợ</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Đối chiếu số dư sao kê ngân hàng và theo dõi dòng tiền thanh toán nợ
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={[
              { value: "", label: "Tất cả các thẻ" },
              ...accounts.map((a) => ({
                value: a.id,
                label: `${a.account_name} (${a.card_number_last4})`,
              })),
            ]}
          />
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("payment")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2",
            activeTab === "payment"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          )}
        >
          <Clock className="w-4 h-4" />
          <span>Tiến Độ Thanh Toán Sao Kê ({paymentStatuses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={clsx(
            "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2",
            activeTab === "reconciliation"
              ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Báo Cáo Đối Soát Dư Nợ ({reconciliations.length})</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <Spinner />
            <p className="text-xs text-slate-400">Đang tải dữ liệu sao kê...</p>
          </div>
        ) : activeTab === "payment" ? (
          /* Payment Status Tab */
          paymentStatuses.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              Không có dữ liệu tiến độ thanh toán
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tên Thẻ</th>
                    <th className="py-3 px-4">Ngày Chốt Sao Kê</th>
                    <th className="py-3 px-4">Hạn Thanh Toán</th>
                    <th className="py-3 px-4 text-right">Dư Nợ Cần Trả</th>
                    <th className="py-3 px-4 text-right">Đã Thanh Toán</th>
                    <th className="py-3 px-4 text-right font-bold">Còn Lại Phải Trả</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {paymentStatuses.map((st) => (
                    <tr key={st.statement_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {st.account_name} ({st.card_number_masked.slice(-4)})
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatDate(st.statement_date)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatDate(st.payment_due_date)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrency(st.billed_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                        {formatCurrency(st.total_paid_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={st.remaining_balance_to_pay > 0 ? "text-rose-400" : "text-slate-400"}>
                          {formatCurrency(st.remaining_balance_to_pay)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant={
                            st.payment_status === "PAID"
                              ? "success"
                              : st.payment_status === "PARTIALLY_PAID"
                              ? "warning"
                              : st.payment_status === "OVERDUE"
                              ? "danger"
                              : "info"
                          }
                        >
                          {st.payment_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Reconciliation Tab */
          reconciliations.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              Không có dữ liệu đối soát sao kê
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tên Thẻ</th>
                    <th className="py-3 px-4">Ngày Sao Kê</th>
                    <th className="py-3 px-4 text-right">Dư Nợ Kỳ Trước</th>
                    <th className="py-3 px-4 text-right">Mua Sắm / Trả Góp</th>
                    <th className="py-3 px-4 text-right">Thanh Toán Vào Thẻ</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-200">Sao Kê Thực Tế</th>
                    <th className="py-3 px-4 text-right font-bold text-sky-400">Dự Tính Sổ Cái</th>
                    <th className="py-3 px-4 text-center">Đối Soát</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {reconciliations.map((rec) => (
                    <tr key={rec.statement_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {rec.account_name} ({rec.card_number_masked.slice(-4)})
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatDate(rec.statement_date)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        {formatCurrency(rec.previous_balance)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrency(Number(rec.purchases_amount) + Number(rec.installments_amount))}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                        {formatCurrency(rec.payments_received)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                        {formatCurrency(rec.billed_statement_balance)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-400">
                        {formatCurrency(rec.expected_statement_balance)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant={rec.reconciliation_status === "MATCHED" ? "success" : "danger"}
                        >
                          {rec.reconciliation_status === "MATCHED" ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> MATCHED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> LỆCH TIỀN
                            </span>
                          )}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>
    </div>
  );
};
