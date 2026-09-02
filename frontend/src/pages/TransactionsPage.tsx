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
  formatCurrency,
  formatDate,
  getTransactionTypeLabel,
} from "../utils/formatters";
import { formatCategoryTreeToGroups } from "../utils/categoryHelpers";

const TRANSACTION_TYPES: { value: TransactionType; label: string; defaultKeywords: string[] }[] = [
  { value: "PURCHASE", label: "Chi tiêu mua sắm thông thường", defaultKeywords: ["Nhà hàng", "Ăn uống", "Cửa hàng", "Chi tiêu"] },
  { value: "REPAYMENT", label: "Thanh toán dư nợ / Nạp tiền", defaultKeywords: ["Thanh toán dư nợ", "Thanh toán", "Nạp tiền"] },
  { value: "INSTALLMENT_MONTHLY", label: "Trả góp định kỳ hàng tháng", defaultKeywords: ["Trả góp", "Tất toán trả góp"] },
  { value: "INSTALLMENT_PRINCIPAL", label: "Ghi có chuyển đổi trả góp", defaultKeywords: ["Chuyển đổi sang trả góp", "Trả góp"] },
  { value: "FEE", label: "Phí dịch vụ / Phí thường niên / Phí SMS", defaultKeywords: ["Phí thường niên", "Phí SMS", "Phí chuyển đổi", "Phí & Lãi"] },
  { value: "INTEREST", label: "Lãi suất phát sinh", defaultKeywords: ["Lãi suất", "Phí & Lãi"] },
  { value: "REFUND", label: "Hoàn tiền đơn hàng hủy", defaultKeywords: ["Hủy giao dịch", "Điều chỉnh / Hủy"] },
  { value: "CASHBACK_CREDIT", label: "Tiền hoàn Cashback ghi có", defaultKeywords: ["Hoàn tiền Cashback", "Hoàn tiền"] },
  { value: "CASH_ADVANCE", label: "Ứng tiền mặt qua thẻ", defaultKeywords: ["Chi tiêu khác", "Chi tiêu"] },
  { value: "ADJUSTMENT", label: "Điều chỉnh giao dịch", defaultKeywords: ["Điều chỉnh / Hủy", "Chi tiêu khác"] },
  { value: "TRANSFER", label: "Chuyển tiền nội bộ", defaultKeywords: ["Thanh toán", "Chuyển khoản"] },
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

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<Transaction | null>(null);

  // Cached Queries
  const { data: accounts = [] } = useAccounts();
  const { data: categoryTree = [] } = useCategoryTree();

  const categoryFilterGroups = useMemo(() => {
    return formatCategoryTreeToGroups(categoryTree);
  }, [categoryTree]);

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

  const transactions = txData?.items || [];
  const totalCount = txData?.total || 0;
  const totalPages = txData?.total_pages || 1;

  // Mutations
  const deleteMutation = useDeleteTransaction();

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

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span>Sổ Cái Giao Dịch Thẻ Tín Dụng</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Theo dõi dòng tiền mua sắm, trả góp, thanh toán dư nợ và phí thường niên
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Thêm Giao Dịch
        </Button>
      </div>

      {/* 2. Top Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Tổng Chi Tiêu & Trả Góp</p>
              <p className="text-lg font-bold text-rose-400 font-mono">
                {formatCurrency(summary.total_spending)}
              </p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Tổng Tiền Đã Thanh Toán</p>
              <p className="text-lg font-bold text-emerald-400 font-mono">
                {formatCurrency(summary.total_repayments)}
              </p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Tổng Phí & Lãi Thẻ</p>
              <p className="text-lg font-bold text-amber-400 font-mono">
                {formatCurrency(summary.total_fees_interest)}
              </p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Tổng Số Bản Ghi</p>
              <p className="text-lg font-bold text-slate-100 font-mono">
                {summary.total_transactions} giao dịch
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* 3. Filter Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <Input
                placeholder="Tìm nội dung, đơn vị, ghi chú..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Account Select */}
            <div>
              <Select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "Tất cả các thẻ" },
                  ...accounts.map((a: Account) => ({
                    value: a.id,
                    label: `${a.account_name} (${a.card_number_last4})`,
                  })),
                ]}
              />
            </div>

            {/* Type Select */}
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

          <div className="flex items-center justify-between pt-2">
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

      {/* 4. Transactions Table */}
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
          <div className="overflow-x-auto">
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
                          title={tx.raw_description}
                        >
                          {tx.raw_description}
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
                        <span className={isCredit ? "text-emerald-400" : "text-rose-400"}>
                          {isCredit ? "" : "+"}
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
