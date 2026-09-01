import React, { useEffect, useState } from "react";
import {
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
import { CurrencyInput } from "../components/common/CurrencyInput";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { Pagination } from "../components/common/Pagination";
import { Select } from "../components/common/Select";
import { Spinner } from "../components/common/Spinner";
import { useToast } from "../context/ToastContext";
import {
  useCreateTransaction,
  useDeleteTransaction,
} from "../hooks/useFinanceMutations";
import {
  useAccounts,
  useCategories,
  useCategoryTree,
  useTransactions,
  useTransactionSummary,
} from "../hooks/useFinanceQueries";
import { Account } from "../types/account";
import { Category, CategoryTreeNode } from "../types/category";
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
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Cached Queries
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: categoryTree = [] } = useCategoryTree();

  // Only ACTIVE accounts are selectable for creating new transactions
  const activeAccounts = accounts.filter((a: Account) => a.status === "ACTIVE");

  const filterParams: TransactionFilterParams = {
    page,
    page_size: pageSize,
    account_id: selectedAccountId || undefined,
    transaction_type: (selectedType as TransactionType) || undefined,
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
  const createMutation = useCreateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Create Modal State & Validation
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<TransactionType>("PURCHASE");
  const [newAmount, setNewAmount] = useState("");
  const [newFee, setNewFee] = useState("0");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Helper to match category from DB based on transaction type
  const findDefaultCategoryId = (type: TransactionType): string => {
    const typeConfig = TRANSACTION_TYPES.find((t) => t.value === type);
    if (!typeConfig || categories.length === 0) return "";

    for (const kw of typeConfig.defaultKeywords) {
      const found = categories.find((c: Category) => c.name.toLowerCase().includes(kw.toLowerCase()));
      if (found) return found.id;
    }
    return categories[0]?.id || "";
  };

  const handleTypeChange = (type: TransactionType) => {
    setNewType(type);
    const matchedId = findDefaultCategoryId(type);
    if (matchedId) {
      setNewCategoryId(matchedId);
    }
  };

  // Ensure default active account selected when activeAccounts load
  useEffect(() => {
    if (activeAccounts.length > 0) {
      if (!newAccountId || !activeAccounts.some((a: Account) => a.id === newAccountId)) {
        setNewAccountId(activeAccounts[0].id);
      }
    }
  }, [activeAccounts, newAccountId]);

  // Ensure default category selected when categories load
  useEffect(() => {
    if (categories.length > 0 && !newCategoryId) {
      const matchedId = findDefaultCategoryId(newType);
      if (matchedId) {
        setNewCategoryId(matchedId);
      }
    }
  }, [categories, newCategoryId, newType]);

  // Build grouped options from categoryTree in Database
  const categoryGroups = categoryTree.map((parent: CategoryTreeNode) => ({
    label: parent.name,
    options: [
      ...(parent.children && parent.children.length > 0
        ? parent.children.map((child: Category) => ({
            value: child.id,
            label: child.name,
          }))
        : [{ value: parent.id, label: `${parent.name} (Chung)` }]),
    ],
  }));


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetchTransactions();
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedAccountId("");
    setSelectedType("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    if (!newAccountId) {
      errors.account_id = "Vui lòng chọn tài khoản / thẻ tín dụng";
    }
    if (!newDate) {
      errors.transaction_date = "Vui lòng chọn ngày giao dịch";
    }
    if (!newDesc.trim()) {
      errors.raw_description = "Vui lòng nhập nội dung / tên đơn vị chấp nhận thẻ";
    }
    const amt = parseFloat(newAmount);
    if (!newAmount || isNaN(amt) || amt <= 0) {
      errors.amount = "Số tiền giao dịch phải lớn hơn 0 VNĐ";
    }
    const fee = parseFloat(newFee);
    if (newFee && (isNaN(fee) || fee < 0)) {
      errors.fee = "Phí giao dịch không thể là số âm";
    }
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

    try {
      const parsedAmount = parseFloat(newAmount) || 0;
      const parsedFee = parseFloat(newFee) || 0;

      await createMutation.mutateAsync({
        account_id: newAccountId,
        transaction_date: newDate,
        raw_description: newDesc.trim(),
        transaction_type: newType,
        amount: parsedAmount,
        fee: parsedFee,
        total_amount: parsedAmount + parsedFee,
        category_id: newCategoryId || undefined,
        note: newNote ? newNote.trim() : undefined,
      });

      toast.success("Tạo giao dịch mới thành công!");
      setIsCreateOpen(false);
      // Reset form
      setNewDesc("");
      setNewAmount("");
      setNewFee("0");
      setNewNote("");
      setCreateErrors({});
    } catch (err: any) {
      toast.error(`Lỗi tạo giao dịch: ${err.message}`);
    }
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                  { value: "PURCHASE", label: "Chi tiêu mua sắm" },
                  { value: "REPAYMENT", label: "Thanh toán nợ" },
                  { value: "INSTALLMENT_MONTHLY", label: "Trả góp định kỳ" },
                  { value: "FEE", label: "Phí dịch vụ" },
                  { value: "INTEREST", label: "Lãi suất" },
                  { value: "REFUND", label: "Hoàn tiền" },
                  { value: "CASHBACK_CREDIT", label: "Cashback" },
                ]}
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
                  <th className="py-3 px-4 text-right">Nguyên Tệ / Tỷ Giá</th>
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
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-100 truncate" title={tx.raw_description}>
                          {tx.raw_description}
                        </div>
                        {tx.note && (
                          <div className="text-[11px] text-slate-400 truncate italic">
                            {tx.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300">
                          {tx.category?.name || "Chưa phân loại"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeMeta.color}`}>
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        {tx.original_currency && tx.original_currency !== "VND" ? (
                          <div>
                            <span className="text-slate-200">
                              {Number(tx.original_amount).toFixed(2)} {tx.original_currency}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Tỷ giá: {Number(tx.exchange_rate).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isCredit ? "text-emerald-400" : "text-rose-400"}>
                          {isCredit ? "" : "+"}
                          {formatCurrency(Number(tx.total_amount))}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="Xóa giao dịch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* 5. Create Transaction Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Thêm Giao Dịch Mới Thủ Công"
      >
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tài Khoản / Thẻ (Đang hoạt động)"
              value={newAccountId}
              onChange={(e) => {
                setNewAccountId(e.target.value);
                if (createErrors.account_id) setCreateErrors((prev) => ({ ...prev, account_id: "" }));
              }}
              error={createErrors.account_id}
              options={
                activeAccounts.length > 0
                  ? activeAccounts.map((a: Account) => ({
                      value: a.id,
                      label: `${a.account_name} (•••• ${a.card_number_last4})`,
                    }))
                  : [{ value: "", label: "Không có thẻ đang hoạt động", disabled: true }]
              }
              required
            />

            <Input
              label="Ngày Giao Dịch"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                if (createErrors.transaction_date) setCreateErrors((prev) => ({ ...prev, transaction_date: "" }));
              }}
              error={createErrors.transaction_date}
              required
            />
          </div>

          <Input
            label="Nội Dung / Đơn Vị Chấp Nhận Thẻ"
            placeholder="VD: STARBUCKS NGUYEN THI MINH KHAI"
            value={newDesc}
            onChange={(e) => {
              setNewDesc(e.target.value);
              if (createErrors.raw_description) setCreateErrors((prev) => ({ ...prev, raw_description: "" }));
            }}
            error={createErrors.raw_description}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Loại Giao Dịch"
              value={newType}
              onChange={(e) => handleTypeChange(e.target.value as TransactionType)}
              options={TRANSACTION_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />

            <Select
              label="Danh Mục (Cơ sở dữ liệu)"
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              options={[{ value: "", label: "-- Chọn danh mục --" }]}
              groups={categoryGroups}
            />
          </div>


          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Số Tiền (VNĐ)"
              placeholder="VD: 150,000"
              value={newAmount}
              onValueChange={(val) => {
                setNewAmount(String(val));
                if (createErrors.amount) setCreateErrors((prev) => ({ ...prev, amount: "" }));
              }}
              onChangeRaw={(raw) => setNewAmount(raw)}
              error={createErrors.amount}
              required
            />
            <CurrencyInput
              label="Phí Đi Kèm (VNĐ)"
              placeholder="0"
              value={newFee}
              onValueChange={(val) => {
                setNewFee(String(val));
                if (createErrors.fee) setCreateErrors((prev) => ({ ...prev, fee: "" }));
              }}
              onChangeRaw={(raw) => setNewFee(raw)}
              error={createErrors.fee}
            />
          </div>


          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Ghi Chú Cá Nhân
            </label>
            <textarea
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              rows={2}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Ghi chú chi tiêu..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
            >
              Tạo Giao Dịch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
