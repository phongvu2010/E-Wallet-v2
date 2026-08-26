import React, { useEffect, useState } from "react";
import { transactionService } from "../services/transactionService";
import { accountService } from "../services/accountService";
import { categoryService } from "../services/categoryService";
import {
  Transaction,
  TransactionFilterParams,
  TransactionSummary,
  TransactionType,
} from "../types/transaction";
import { Account } from "../types/account";
import { Category } from "../types/category";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { Select } from "../components/common/Select";
import { Modal } from "../components/common/Modal";
import { Pagination } from "../components/common/Pagination";
import { Spinner } from "../components/common/Spinner";
import {
  formatCurrency,
  formatDate,
  getTransactionTypeLabel,
} from "../utils/formatters";
import {
  Receipt,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  TrendingDown,
  TrendingUp,
  Percent,
  RefreshCw,
} from "lucide-react";

export const TransactionsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);

  // Reference lists
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filter state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<TransactionType>("PURCHASE");
  const [newAmount, setNewAmount] = useState("");
  const [newFee, setNewFee] = useState("0");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialRefs();
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [page, selectedAccountId, selectedType, startDate, endDate]);

  const fetchInitialRefs = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        accountService.getAll(),
        categoryService.getAll(),
      ]);
      setAccounts(accRes);
      setCategories(catRes);
      if (accRes.length > 0) {
        setNewAccountId(accRes[0].id);
      }
    } catch (err) {
      console.error("Error loading references", err);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params: TransactionFilterParams = {
        page,
        page_size: pageSize,
        account_id: selectedAccountId || undefined,
        transaction_type: (selectedType as TransactionType) || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: search || undefined,
      };
      const res = await transactionService.getFiltered(params);
      setTransactions(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error("Error fetching transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await transactionService.getSummary(
        selectedAccountId || undefined
      );
      setSummary(res);
    } catch (err) {
      console.error("Error fetching summary", err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedAccountId("");
    setSelectedType("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedAmount = parseFloat(newAmount) || 0;
      const parsedFee = parseFloat(newFee) || 0;

      await transactionService.create({
        account_id: newAccountId,
        transaction_date: newDate,
        raw_description: newDesc,
        transaction_type: newType,
        amount: parsedAmount,
        fee: parsedFee,
        total_amount: parsedAmount + parsedFee,
        category_id: newCategoryId || undefined,
        note: newNote || undefined,
      });

      setIsCreateOpen(false);
      // Reset form
      setNewDesc("");
      setNewAmount("");
      setNewFee("0");
      setNewNote("");
      // Reload list
      fetchTransactions();
      fetchSummary();
    } catch (err) {
      console.error("Error creating transaction", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) return;
    try {
      await transactionService.delete(id);
      fetchTransactions();
      fetchSummary();
    } catch (err) {
      console.error("Error deleting transaction", err);
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
                  ...accounts.map((a) => ({
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
                {transactions.map((tx) => {
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
              label="Tài Khoản / Thẻ"
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.account_name} (${a.card_number_last4})`,
              }))}
              required
            />

            <Input
              label="Ngày Giao Dịch"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Nội Dung / Đơn Vị Chấp Nhận Thẻ"
            placeholder="VD: STARBUCKS NGUYEN THI MINH KHAI"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Loại Giao Dịch"
              value={newType}
              onChange={(e) => setNewType(e.target.value as TransactionType)}
              options={[
                { value: "PURCHASE", label: "Chi tiêu mua sắm" },
                { value: "REPAYMENT", label: "Thanh toán nợ thẻ" },
                { value: "INSTALLMENT_MONTHLY", label: "Trả góp kỳ" },
                { value: "FEE", label: "Phí thường niên / Phí khác" },
                { value: "INTEREST", label: "Lãi suất" },
                { value: "REFUND", label: "Hoàn tiền" },
                { value: "CASHBACK_CREDIT", label: "Cashback" },
              ]}
            />

            <Select
              label="Danh Mục"
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              options={[
                { value: "", label: "-- Chọn danh mục --" },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Số Tiền (VNĐ)"
              type="number"
              placeholder="VD: 150000"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              required
            />
            <Input
              label="Phí Đi Kèm (VNĐ)"
              type="number"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
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
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Tạo Giao Dịch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
