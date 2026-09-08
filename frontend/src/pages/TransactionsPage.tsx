import React, { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Eye,
  Filter,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Pagination } from "../components/common/Pagination";
import { Select } from "../components/common/Select";
import { Spinner } from "../components/common/Spinner";
import { SmartCreateTransactionModal } from "../components/transactions/SmartCreateTransactionModal";
import { TransactionDetailModal } from "../components/transactions/TransactionDetailModal";
import { useToast } from "../context/ToastContext";
import { useDeleteTransaction } from "../hooks/useFinanceMutations";
import {
  useAccounts,
  useCategoryTree,
  useTransactions,
  useTransactionSummary,
} from "../hooks/useFinanceQueries";
import { Account } from "../types/account";
import {
  Transaction,
  TransactionFilterParams,
  TransactionType,
} from "../types/transaction";
import {
  formatAccountLabel,
  formatCurrency,
  formatDate,
  getTransactionTypeLabel,
} from "../utils/formatters";
import { formatCategoryTreeToGroups } from "../utils/categoryHelpers";

const TRANSACTION_TYPES: { value: TransactionType; label: string; defaultKeywords: string[] }[] = [
  { value: "PURCHASE", label: "Chi tiêu mua sắm thông thường", defaultKeywords: ["Nhà hàng", "Ăn uống", "Cửa hàng", "Chi tiêu"] },
  { value: "INCOME", label: "Khoản thu nhập (Lương, Thưởng, Lãi...)", defaultKeywords: ["Lương & Thu nhập", "Thu nhập", "Lương", "Thưởng"] },
  { value: "TRANSFER", label: "Chuyển tiền giữa các tài khoản / ví", defaultKeywords: ["Chuyển khoản", "Chuyển tiền"] },
  { value: "REPAYMENT", label: "Thanh toán dư nợ / Nạp tiền", defaultKeywords: ["Thanh toán dư nợ", "Thanh toán", "Nạp tiền"] },
  { value: "INSTALLMENT_MONTHLY", label: "Trả góp định kỳ hàng tháng", defaultKeywords: ["Trả góp", "Tất toán trả góp"] },
  { value: "INSTALLMENT_PRINCIPAL", label: "Ghi có chuyển đổi trả góp", defaultKeywords: ["Chuyển đổi sang trả góp", "Trả góp"] },
  { value: "FEE", label: "Phí dịch vụ / Phí thường niên / Phí SMS", defaultKeywords: ["Phí thường niên", "Phí SMS", "Phí chuyển đổi", "Phí & Lãi"] },
  { value: "INTEREST", label: "Lãi suất phát sinh", defaultKeywords: ["Lãi suất", "Phí & Lãi"] },
  { value: "REFUND", label: "Hoàn tiền đơn hàng hủy", defaultKeywords: ["Hủy giao dịch", "Điều chỉnh / Hủy"] },
  { value: "CASH_ADVANCE", label: "Ứng tiền mặt qua thẻ", defaultKeywords: ["Chi tiêu khác", "Chi tiêu"] },
  { value: "ADJUSTMENT", label: "Điều chỉnh giao dịch", defaultKeywords: ["Điều chỉnh / Hủy", "Chi tiêu khác"] },
  { value: "DEBT_BORROW", label: "Nhận tiền vay bạn bè / người thân", defaultKeywords: ["Vay tiền", "Mượn tiền"] },
  { value: "DEBT_REPAY", label: "Trả nợ gốc cho bạn bè / người thân", defaultKeywords: ["Trả nợ", "Thanh toán nợ"] },
  { value: "DEBT_LEND", label: "Xuất tiền cho bạn bè mượn", defaultKeywords: ["Cho vay", "Cho mượn"] },
  { value: "DEBT_COLLECT", label: "Thu hồi nợ gốc đã cho mượn", defaultKeywords: ["Thu nợ", "Nhận tiền trả"] },
];

export const TransactionsPage: React.FC = () => {
  const { toast } = useToast();

  // Filter state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);

  // Cached Queries
  const { data: accounts = [] } = useAccounts();
  const { data: categoryTree = [] } = useCategoryTree();

  const categoryFilterGroups = useMemo(() => {
    return formatCategoryTreeToGroups(categoryTree);
  }, [categoryTree]);

  const accountMap = useMemo(() => {
    return new Map(accounts.map((a: Account) => [a.id, a]));
  }, [accounts]);

  const filterParams: TransactionFilterParams = {
    page,
    page_size: pageSize,
    account_id: selectedAccountId || undefined,
    transaction_type: (selectedType as TransactionType) || undefined,
    category_id: selectedCategoryId || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    search: search || undefined,
  };

  const {
    data: txData,
    isLoading: loading,
    refetch: refetchTransactions,
  } = useTransactions(filterParams);

  const { data: summary } = useTransactionSummary(selectedAccountId || undefined);
  const deleteMutation = useDeleteTransaction();

  const transactions = txData?.items || [];
  const totalCount = txData?.total || 0;
  const totalPages = txData?.total_pages || 1;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetchTransactions();
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedAccountId("");
    setSelectedType("");
    setSelectedCategoryId("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Đã xóa giao dịch thành công!");
    } catch (err: any) {
      toast.error(`Lỗi khi xóa giao dịch: ${err.message}`);
    }
  };

  const hasActiveFilters = Boolean(
    selectedAccountId || selectedType || selectedCategoryId || startDate || endDate
  );

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span>Sổ Cái Giao Dịch Tài Chính</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Theo dõi thu nhập, chi tiêu, trả góp và biến động số dư các tài khoản
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="w-full sm:w-auto justify-center"
        >
          Thêm Giao Dịch
        </Button>
      </div>

      {/* 2. Top Summary KPI Cards (Responsive 2 cols on mobile) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Thu Nhập</p>
              <p className="text-sm sm:text-base font-bold text-emerald-400 font-mono truncate">
                {formatCurrency(summary.total_income || 0)}
              </p>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex-shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Chi Tiêu</p>
              <p className="text-sm sm:text-base font-bold text-rose-400 font-mono truncate">
                {formatCurrency(summary.total_spending)}
              </p>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex-shrink-0">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Đã Trả / Nạp</p>
              <p className="text-sm sm:text-base font-bold text-teal-400 font-mono truncate">
                {formatCurrency(summary.total_repayments)}
              </p>
            </div>
          </Card>

          <Card className="p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">
              <Percent className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Phí & Lãi</p>
              <p className="text-sm sm:text-base font-bold text-amber-400 font-mono truncate">
                {formatCurrency(summary.total_fees_interest)}
              </p>
            </div>
          </Card>

          <Card className="col-span-2 sm:col-span-1 p-3 sm:p-4 flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex-shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Tổng Giao Dịch</p>
              <p className="text-sm sm:text-base font-bold text-slate-100 font-mono truncate">
                {summary.total_transactions} GD
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* 3. Filter Bar (With Mobile Collapsible Accordion) */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          {/* Quick search & Mobile filter toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="Tìm nội dung, đơn vị, ghi chú..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 md:hidden transition-colors ${
                showMobileFilters || hasActiveFilters
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/80 border-slate-700 text-slate-300"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{showMobileFilters ? "Ẩn lọc" : "Bộ lọc"}</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>

          {/* Collapsible filter options (always visible on md+, toggle on mobile) */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1 ${
              showMobileFilters ? "block" : "hidden md:grid"
            }`}
          >
            {/* Account Select */}
            <div>
              <Select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả các tài khoản / thẻ" },
                  ...accounts.map((a: Account) => ({
                    value: a.id,
                    label: formatAccountLabel(a),
                  })),
                ]}
              />
            </div>

            {/* Transaction Type Select */}
            <div>
              <Select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả loại giao dịch" },
                  { value: "PURCHASE", label: "Chi tiêu mua sắm (+)" },
                  { value: "INCOME", label: "Thu nhập (+)" },
                  { value: "TRANSFER", label: "Chuyển khoản nội bộ" },
                  { value: "REPAYMENT", label: "Thanh toán nợ (-)" },
                  { value: "INSTALLMENT_MONTHLY", label: "Trả góp định kỳ (+)" },
                  { value: "FEE", label: "Phí dịch vụ (+)" },
                  { value: "INTEREST", label: "Lãi suất (+)" },
                  { value: "REFUND", label: "Hoàn tiền (-)" },
                  { value: "CASHBACK_CREDIT", label: "Cashback (-)" },
                  { value: "CASH_ADVANCE", label: "Ứng tiền mặt (+)" },
                ]}
              />
            </div>

            {/* Category Select */}
            <div>
              <Select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setPage(1);
                }}
                options={[{ value: "", label: "Tất cả danh mục" }]}
                groups={categoryFilterGroups}
              />
            </div>

            {/* Date Filters */}
            <div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div
            className={`items-center justify-between pt-2 ${
              showMobileFilters ? "flex" : "hidden md:flex"
            }`}
          >
            <Button type="submit" variant="secondary" size="sm" leftIcon={<Filter className="w-3.5 h-3.5" />}>
              Áp dụng lọc
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Đặt lại
            </Button>
          </div>
        </form>
      </Card>

      {/* 4. Transactions List (Responsive Mobile Cards + Desktop Table) */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <Spinner />
            <p className="text-xs text-slate-400">Đang tải danh sách giao dịch...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
            Không tìm thấy giao dịch nào phù hợp với bộ lọc
          </div>
        ) : (
          <>
            {/* A. MOBILE CARD VIEW (Visible on < md screens) */}
            <div className="block md:hidden divide-y divide-slate-800/60">
              {transactions.map((tx: Transaction) => {
                const typeMeta = getTransactionTypeLabel(tx.transaction_type);
                const isCredit = Number(tx.total_amount) < 0;
                const isIncome = tx.transaction_type === "INCOME";
                const txAcc = accountMap.get(tx.account_id);

                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedDetailTx(tx)}
                    className="p-3.5 hover:bg-slate-800/40 active:bg-slate-800/60 transition-colors cursor-pointer space-y-2"
                  >
                    {/* Top Row: Date, Account, and Type badge */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-slate-400 font-medium">
                          {formatDate(tx.transaction_date)}
                        </span>
                        {txAcc && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono truncate max-w-[120px]">
                            {txAcc.account_name}
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0 ${typeMeta.color}`}
                      >
                        {typeMeta.label}
                      </span>
                    </div>

                    {/* Middle Row: Description & Notes */}
                    <div>
                      <div className="font-semibold text-slate-100 text-sm line-clamp-2">
                        {tx.raw_description || tx.category?.name || tx.note || "Giao dịch chi tiêu"}
                      </div>
                      {tx.note && (
                        <div className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">
                          {tx.note}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Category, Amount & Action button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800 truncate max-w-[150px]">
                        {tx.transaction_type === "INSTALLMENT_MONTHLY" && tx.installment_plan?.product_name
                          ? tx.installment_plan.product_name
                          : tx.category?.name || "Chưa phân loại"}
                      </span>

                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-sm font-bold ${
                            isIncome
                              ? "text-teal-400"
                              : isCredit
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {isCredit || isIncome ? "" : "+"}
                          {formatCurrency(Number(tx.total_amount))}
                        </span>

                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDetailTx(tx)}
                            aria-label="Edit transaction"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 active:bg-slate-800 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(tx.id)}
                            aria-label="Delete transaction"
                            className="p-1.5 text-slate-400 hover:text-rose-400 active:bg-slate-800 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* B. DESKTOP TABLE VIEW (Visible on >= md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ngày GD</th>
                    <th className="py-3 px-4">Nội Dung Chi Tiết</th>
                    <th className="py-3 px-4">Danh Mục</th>
                    <th className="py-3 px-4">Loại GD</th>
                    <th className="py-3 px-4 text-right font-bold">Số Tiền (VNĐ)</th>
                    <th className="py-3 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {transactions.map((tx: Transaction) => {
                    const typeMeta = getTransactionTypeLabel(tx.transaction_type);
                    const isCredit = Number(tx.total_amount) < 0;
                    const isIncome = tx.transaction_type === "INCOME";

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedDetailTx(tx)}
                        className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {formatDate(tx.transaction_date)}
                        </td>
                        <td className="py-3.5 px-4 max-w-sm">
                          <div
                            className="font-semibold text-slate-100 truncate group-hover:text-emerald-400 transition-colors"
                            title={tx.raw_description || tx.category?.name || "Giao dịch"}
                          >
                            {tx.raw_description || tx.category?.name || tx.note || "Giao dịch chi tiêu"}
                          </div>
                          {tx.note && (
                            <div className="text-[11px] text-slate-400 truncate italic">
                              {tx.note}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-slate-300 font-medium">
                            {tx.transaction_type === "INSTALLMENT_MONTHLY" && tx.installment_plan?.product_name
                              ? tx.installment_plan.product_name
                              : tx.category?.name || "Chưa phân loại"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${typeMeta.color}`}
                          >
                            {typeMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              isIncome
                                ? "text-teal-400"
                                : isCredit
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {isCredit || isIncome ? "" : "+"}
                            {formatCurrency(Number(tx.total_amount))}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div
                            className="flex items-center justify-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setSelectedDetailTx(tx)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Xem chi tiết & Chỉnh sửa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Xóa giao dịch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </Card>

      {/* 5. Smart Create Transaction Modal */}
      <SmartCreateTransactionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultAccountId={selectedAccountId}
      />

      {/* 6. Transaction Detail & Edit Modal */}
      <TransactionDetailModal
        isOpen={Boolean(selectedDetailTx)}
        onClose={() => setSelectedDetailTx(null)}
        transaction={selectedDetailTx}
      />
    </div>
  );
};
