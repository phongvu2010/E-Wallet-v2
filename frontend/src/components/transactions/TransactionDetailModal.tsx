import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CreditCard,
  Edit3,
  Fingerprint,
  Percent,
  Receipt,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import { useToast } from "../../context/ToastContext";
import {
  useDeleteTransaction,
  useUpdateTransaction,
} from "../../hooks/useFinanceMutations";
import {
  useAccounts,
  useCategories,
  useCategoryTree,
  useInstallments,
  useMerchantSuggestions,
  useStatementPaymentStatus,
} from "../../hooks/useFinanceQueries";
import { Account } from "../../types/account";
import { Category, CategoryTreeNode } from "../../types/category";
import { InstallmentPlan } from "../../types/installment";
import { MerchantSuggestion } from "../../types/merchant";
import { StatementPaymentStatus } from "../../types/statement";
import { Transaction, TransactionType } from "../../types/transaction";
import {
  formatCurrency,
  formatDate,
  getTransactionTypeLabel,
} from "../../utils/formatters";
import {
  inferTransactionTypeFromCategory,
  resolveCategoryHierarchy,
} from "../../utils/categoryHelpers";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "PURCHASE", label: "Chi tiêu thẻ (Purchase)" },
  { value: "REPAYMENT", label: "Thanh toán dư nợ (Repayment)" },
  { value: "INSTALLMENT_MONTHLY", label: "Trả góp kỳ (Installment Period)" },
  { value: "INSTALLMENT_PRINCIPAL", label: "Chuyển đổi trả góp gốc" },
  { value: "CASHBACK_CREDIT", label: "Hoàn tiền Cashback" },
  { value: "REFUND", label: "Hoàn tiền / Hủy GD (Refund)" },
  { value: "FEE", label: "Phí dịch vụ / Phí thường niên" },
  { value: "INTEREST", label: "Lãi suất phát sinh" },
  { value: "CASH_ADVANCE", label: "Rút tiền mặt" },
  { value: "ADJUSTMENT", label: "Điều chỉnh kế toán" },
];

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const { toast } = useToast();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: categoryTree = [] } = useCategoryTree();
  const { data: merchantSuggestions = [] } = useMerchantSuggestions();
  const { data: pendingStatements = [] } = useStatementPaymentStatus();
  const { data: accountInstallments = [] } = useInstallments(
    transaction?.account_id
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);

  // Form State for Edit Mode
  const [rawDescription, setRawDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [postDate, setPostDate] = useState("");
  const [transactionType, setTransactionType] = useState<TransactionType>("PURCHASE");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [showAdvancedTxType, setShowAdvancedTxType] = useState(false);
  const [selectedMerchantName, setSelectedMerchantName] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [amountVND, setAmountVND] = useState("");
  const [feeVND, setFeeVND] = useState("0");
  const [note, setNote] = useState("");
  const [settlesStatementId, setSettlesStatementId] = useState("");
  const [installmentPlanId, setInstallmentPlanId] = useState("");

  // Foreign Currency FX state
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [foreignAmount, setForeignAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("VND");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [foreignFeePercent, setForeignFeePercent] = useState(2.5);

  // Merchant autocomplete
  const [isSearchingMerchant, setIsSearchingMerchant] = useState(false);
  const merchantDropdownRef = useRef<HTMLDivElement>(null);

  const effectiveCategoryId = useMemo(() => {
    return subCategoryId || parentCategoryId || "";
  }, [subCategoryId, parentCategoryId]);

  const selectedParent = useMemo(() => {
    return categoryTree.find((p: CategoryTreeNode) => p.id === parentCategoryId);
  }, [categoryTree, parentCategoryId]);

  const currentCategory = useMemo(() => {
    if (!effectiveCategoryId) return null;
    return categories.find((c: Category) => c.id === effectiveCategoryId) || null;
  }, [effectiveCategoryId, categories]);

  // Sync state when transaction prop changes
  useEffect(() => {
    if (transaction) {
      setIsEditing(false);
      setIsConfirmDelete(false);
      setRawDescription(transaction.raw_description || "");
      setTransactionDate(transaction.transaction_date || "");
      setPostDate(transaction.post_date || "");
      setTransactionType(transaction.transaction_type || "PURCHASE");

      if (transaction.category_id) {
        const hierarchy = resolveCategoryHierarchy(
          transaction.category_id,
          categories,
          categoryTree
        );
        setParentCategoryId(hierarchy.parentId);
        setSubCategoryId(hierarchy.subId);
      } else {
        setParentCategoryId("");
        setSubCategoryId("");
      }
      setShowAdvancedTxType(false);

      setSelectedMerchantId(transaction.merchant_id || "");
      setSelectedMerchantName(
        transaction.merchant?.cleaned_name ||
          (transaction.merchant as any)?.name ||
          ""
      );
      setAmountVND(String(Math.abs(Number(transaction.amount || 0))));
      setFeeVND(String(Number(transaction.fee || 0)));
      setNote(transaction.note || "");
      setSettlesStatementId(transaction.settles_statement_id || "");
      setInstallmentPlanId(transaction.installment_plan_id || "");

      const isFX =
        Boolean(transaction.original_currency) &&
        transaction.original_currency !== "VND";
      setIsForeignCurrency(isFX);
      if (isFX) {
        setCurrencyCode(transaction.original_currency || "USD");
        setForeignAmount(String(Math.abs(Number(transaction.original_amount || 0))));
        setExchangeRate(Number(transaction.exchange_rate || 25450));
        const rate = Number(transaction.exchange_rate || 25450);
        const fFee = Number(transaction.foreign_fee || 0);
        const origAmt = Math.abs(Number(transaction.original_amount || 0));
        if (origAmt > 0 && rate > 0) {
          setForeignFeePercent(
            parseFloat(((fFee / (origAmt * rate)) * 100).toFixed(2)) || 2.5
          );
        }
      }
    }
  }, [transaction, isOpen, categories, categoryTree]);

  // Click outside merchant autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        merchantDropdownRef.current &&
        !merchantDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSearchingMerchant(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parent Category Change Handler (Cấp 1)
  const handleParentCategoryChange = (newParentId: string) => {
    setParentCategoryId(newParentId);
    setSubCategoryId("");

    if (!newParentId) return;

    const parentNode = categoryTree.find(
      (p: CategoryTreeNode) => p.id === newParentId
    );
    if (parentNode) {
      const inferred = inferTransactionTypeFromCategory(parentNode);
      setTransactionType(inferred);
    }
  };

  // Subcategory Change Handler (Cấp 2)
  const handleSubCategoryChange = (newSubId: string) => {
    setSubCategoryId(newSubId);

    const targetId = newSubId || parentCategoryId;
    if (!targetId) return;

    const targetCat = categories.find((c: Category) => c.id === targetId);
    if (targetCat) {
      const inferred = inferTransactionTypeFromCategory(targetCat);
      setTransactionType(inferred);
    }
  };

  // Explicit transaction type change handler
  const handleTransactionTypeChange = (newType: TransactionType) => {
    setTransactionType(newType);
  };

  // Filtered merchant suggestions
  const filteredMerchants = useMemo(() => {
    if (!rawDescription.trim()) return [];
    const query = rawDescription.toLowerCase().trim();
    return merchantSuggestions
      .filter((m: MerchantSuggestion) => {
        const matchName = m.cleaned_name.toLowerCase().includes(query);
        const matchAlias = m.aliases.some((a) =>
          a.toLowerCase().includes(query)
        );
        return matchName || matchAlias;
      })
      .slice(0, 8);
  }, [rawDescription, merchantSuggestions]);

  // Find linked Account
  const linkedAccount = useMemo(() => {
    if (!transaction) return null;
    return accounts.find((a: Account) => a.id === transaction.account_id);
  }, [accounts, transaction]);

  if (!isOpen || !transaction) return null;

  const typeMeta = getTransactionTypeLabel(transaction.transaction_type);
  const isCredit = Number(transaction.total_amount) < 0;

  // Handle Save Update
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedAmt = parseFloat(amountVND) || 0;
      const parsedFee = parseFloat(feeVND) || 0;

      await updateMutation.mutateAsync({
        id: transaction.id,
        payload: {
          raw_description: rawDescription.trim() || undefined,
          transaction_date: transactionDate,
          post_date: postDate ? postDate : null,
          transaction_type: transactionType,
          category_id: effectiveCategoryId ? effectiveCategoryId : null,
          merchant_id: selectedMerchantId ? selectedMerchantId : null,
          merchant_name: selectedMerchantName.trim()
            ? selectedMerchantName.trim()
            : null,
          installment_plan_id: installmentPlanId ? installmentPlanId : null,
          is_installment: Boolean(
            installmentPlanId || transactionType === "INSTALLMENT_MONTHLY"
          ),
          amount: parsedAmt,
          fee: parsedFee,
          total_amount: parsedAmt + parsedFee,
          original_amount: isForeignCurrency
            ? parseFloat(foreignAmount) || parsedAmt
            : null,
          original_currency: isForeignCurrency ? currencyCode : "VND",
          exchange_rate: isForeignCurrency ? exchangeRate : 1.0,
          foreign_fee: isForeignCurrency ? parsedFee : 0,
          note: note.trim() ? note.trim() : null,
          settles_statement_id: settlesStatementId ? settlesStatementId : null,
        },
      });

      toast.success("Cập nhật giao dịch thành công!");
      setIsEditing(false);
    } catch (err: any) {
      toast.error(`Lỗi cập nhật: ${err.message}`);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(transaction.id);
      toast.success("Đã xóa giao dịch thành công!");
      setIsConfirmDelete(false);
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi khi xóa: ${err.message}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Chỉnh Sửa Giao Dịch" : "Chi Tiết Giao Dịch"}
      maxWidth="4xl"
    >
      {/* View Mode vs Edit Mode Container */}
      {!isEditing ? (
        /* ================= VIEW MODE ================= */
        <div className="space-y-6">
          {/* Header Summary Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-3 rounded-2xl border shrink-0 ${
                  isCredit
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-extrabold text-slate-100">
                  {transaction.raw_description}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                  <span>{linkedAccount?.account_name || "Thẻ tín dụng"}</span>
                  <span>•</span>
                  <span className="font-mono">
                    •••• {linkedAccount?.card_number_last4 || "----"}
                  </span>
                  <span>•</span>
                  <Badge variant="neutral">{typeMeta.label}</Badge>
                  {transaction.is_installment && (
                    <Badge variant="info">Trả góp 0%</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Total Amount Badge */}
            <div className="text-left sm:text-right">
              <div className="text-xs text-slate-400 font-medium">
                {isCredit ? "Khoản ghi có / Thanh toán" : "Khoản ghi nợ / Chi tiêu"}
              </div>
              <div
                className={`text-xl sm:text-2xl font-mono font-black ${
                  isCredit ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {isCredit ? "" : "+"}
                {formatCurrency(Number(transaction.total_amount))}
              </div>
            </div>
          </div>

          {/* 2-Column Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Column: Transaction Core Data */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Thời Gian & Định Danh</span>
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Ngày Giao Dịch:</span>
                  <strong className="text-slate-200 font-mono">
                    {formatDate(transaction.transaction_date)}
                  </strong>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Ngày Bút Toán (Post Date):</span>
                  <strong className="text-slate-200 font-mono">
                    {transaction.post_date
                      ? formatDate(transaction.post_date)
                      : "Chưa lên sao kê (Tạm tính)"}
                  </strong>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Đơn Vị (Merchant):</span>
                  <strong className="text-slate-200">
                    {transaction.merchant?.cleaned_name ||
                      transaction.raw_description}
                  </strong>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Danh Mục Chi Tiêu:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                    {transaction.category?.name || "Chưa phân loại"}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-400">Loại Giao Dịch:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md font-semibold border ${typeMeta.color}`}
                  >
                    {typeMeta.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Financial Breakdown & Settlement */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Chi Tiết Số Tiền & Sao Kê</span>
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Số Tiền Gốc (VNĐ):</span>
                  <strong className="text-slate-200 font-mono">
                    {formatCurrency(Math.abs(Number(transaction.amount)))}
                  </strong>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Phí Phát Sinh (VNĐ):</span>
                  <strong className="text-slate-300 font-mono">
                    {formatCurrency(Number(transaction.fee || 0))}
                  </strong>
                </div>

                {transaction.original_currency &&
                  transaction.original_currency !== "VND" && (
                    <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-purple-300">
                        <span>Nguyên Tệ Gốc:</span>
                        <strong className="font-mono">
                          {Number(transaction.original_amount).toFixed(2)}{" "}
                          {transaction.original_currency}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Tỷ Giá Quy Đổi:</span>
                        <span className="font-mono">
                          {Number(transaction.exchange_rate).toLocaleString()} VNĐ
                        </span>
                      </div>
                    </div>
                  )}

                <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Kỳ Sao Kê (Statement):</span>
                  <span className="text-slate-300">
                    {transaction.statement_id
                      ? "Đã vào kỳ sao kê chính thức"
                      : "Chưa chốt sao kê (Unbilled)"}
                  </span>
                </div>

                {(transaction.installment_plan_id ||
                  transaction.installment_plan) && (
                  <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5" />
                        <span>Gói Trả Góp Liên Kết</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-300 border border-sky-700 font-medium">
                        {transaction.installment_plan?.status === "ACTIVE"
                          ? "Đang Trả Góp"
                          : transaction.installment_plan?.status || "Trả Góp 0%"}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-100">
                      {transaction.installment_plan?.product_name ||
                        transaction.raw_description}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          Hàng tháng:
                        </span>
                        <strong className="text-sky-400">
                          {formatCurrency(
                            Number(
                              transaction.installment_plan?.monthly_payment ||
                                transaction.amount
                            )
                          )}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          Dư nợ gói:
                        </span>
                        <strong className="text-slate-200">
                          {formatCurrency(
                            Number(
                              transaction.installment_plan?.remaining_balance ||
                                0
                            )
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-1">
                  <span className="text-slate-400 block mb-1">Ghi Chú Cá Nhân:</span>
                  <p className="text-slate-200 italic bg-slate-900/80 p-2 rounded-xl border border-slate-800/80">
                    {transaction.note || "Không có ghi chú"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit & Idempotency Fingerprint Box */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/60 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <Fingerprint className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                SHA-256 Fingerprint:{" "}
                <code className="text-slate-400 font-mono">
                  {transaction.tx_fingerprint || "None"}
                </code>
              </span>
            </div>
            <div className="shrink-0 text-slate-500">
              ID: <code className="font-mono">{transaction.id.slice(0, 8)}...</code>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setIsConfirmDelete(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Xóa Giao Dịch
            </Button>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Đóng
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setIsEditing(true)}
                leftIcon={<Edit3 className="w-4 h-4" />}
              >
                Chỉnh Sửa
              </Button>
            </div>
          </div>

          {/* Confirm Delete Submodal */}
          {isConfirmDelete && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <span>Xác nhận xóa giao dịch này khỏi sổ cái?</span>
              </div>
              <p className="text-xs text-rose-200/80">
                Hành động này sẽ xóa vĩnh viễn giao dịch và tự động cập nhật lại
                dư nợ trực tiếp của tài khoản.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfirmDelete(false)}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={deleteMutation.isPending}
                  onClick={handleDelete}
                >
                  Xác Nhận Xóa
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= EDIT MODE ================= */
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Dates Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Ngày Giao Dịch"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setTransactionDate(newDate);
                    if (!postDate || postDate === transactionDate) {
                      setPostDate(newDate);
                    }
                  }}
                  required
                />
                <Input
                  label="Ngày Bút Toán (Post Date)"
                  type="date"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                />
              </div>

              {/* Merchant / Description Autocomplete Input (Optional) */}
              <div className="relative" ref={merchantDropdownRef}>
                <Input
                  label="Nội Dung / Đơn Vị Chấp Nhận Thẻ (Tùy chọn)"
                  placeholder="Tùy chọn: STARBUCKS, Cafe vỉa hè, Tiền chợ..."
                  value={rawDescription}
                  onChange={(e) => {
                    setRawDescription(e.target.value);
                    setSelectedMerchantName(e.target.value);
                    setIsSearchingMerchant(true);
                  }}
                  onFocus={() => setIsSearchingMerchant(true)}
                  leftIcon={<Search className="w-4 h-4 text-emerald-400" />}
                />

                {isSearchingMerchant && filteredMerchants.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-800/60">
                    {filteredMerchants.map((m: MerchantSuggestion) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMerchantId(m.id);
                          setSelectedMerchantName(m.cleaned_name);
                          setRawDescription(m.cleaned_name);
                          if (m.default_category_id) {
                            const hierarchy = resolveCategoryHierarchy(
                              m.default_category_id,
                              categories,
                              categoryTree
                            );
                            setParentCategoryId(hierarchy.parentId);
                            setSubCategoryId(hierarchy.subId);
                            const targetCat = categories.find(
                              (c: Category) => c.id === m.default_category_id
                            );
                            if (targetCat) {
                              const inferred = inferTransactionTypeFromCategory(targetCat);
                              setTransactionType(inferred);
                            }
                          }
                          setIsSearchingMerchant(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-slate-100">
                          {m.cleaned_name}
                        </span>
                        {m.default_category_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            {m.default_category_name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2-Tier Hierarchical Category Picker (Nhóm Cha Cấp 1 & Danh Mục Con Cấp 2) */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Select
                      label="Nhóm Danh Mục Cha (Cấp 1)"
                      value={parentCategoryId}
                      onChange={(e) => handleParentCategoryChange(e.target.value)}
                      options={[
                        { value: "", label: "-- Chọn Nhóm Danh Mục Cha --" },
                        ...categoryTree.map((p: CategoryTreeNode) => ({
                          value: p.id,
                          label: p.name,
                        })),
                      ]}
                      required
                    />
                  </div>

                  <div>
                    <Select
                      label="Danh Mục Con (Cấp 2)"
                      value={subCategoryId}
                      onChange={(e) => handleSubCategoryChange(e.target.value)}
                      options={[
                        {
                          value: "",
                          label:
                            selectedParent && selectedParent.children && selectedParent.children.length > 0
                              ? "-- Chọn danh mục con (Cấp 2) --"
                              : selectedParent
                              ? `-- Dùng nhóm cha: ${selectedParent.name} --`
                              : "-- Vui lòng chọn nhóm cha trước --",
                        },
                        ...((selectedParent?.children || []).map((c: Category) => ({
                          value: c.id,
                          label: c.name,
                        }))),
                      ]}
                      disabled={!parentCategoryId}
                    />
                  </div>
                </div>

                {/* Category Status & Inferred Transaction Type Info Badge */}
                {currentCategory && (
                  <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{
                          backgroundColor:
                            currentCategory.color || selectedParent?.color || "#10b981",
                        }}
                      />
                      <span className="truncate">
                        Đã chọn: <strong className="text-slate-100">{currentCategory.name}</strong>
                      </span>
                      <span className="text-slate-600 hidden sm:inline">•</span>
                      <span className="text-emerald-400 font-medium hidden sm:inline">
                        Nghiệp vụ: {TRANSACTION_TYPES.find((t) => t.value === transactionType)?.label.split(" (")[0] || transactionType}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedTxType(!showAdvancedTxType)}
                      className="text-[10px] text-slate-400 hover:text-emerald-300 underline shrink-0 ml-2"
                    >
                      {showAdvancedTxType ? "Ẩn nâng cao" : "Tuỳ chỉnh nâng cao"}
                    </button>
                  </div>
                )}

                {/* Advanced Override for Transaction Type */}
                {showAdvancedTxType && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <Select
                      label="Tuỳ chỉnh Loại Giao Dịch Hệ Thống (Nâng cao)"
                      value={transactionType}
                      onChange={(e) =>
                        handleTransactionTypeChange(e.target.value as TransactionType)
                      }
                      options={TRANSACTION_TYPES}
                    />
                    <p className="text-[10px] text-slate-500 italic">
                      💡 Mặc định hệ thống tự động nhận diện loại giao dịch từ danh mục bạn chọn. Bạn chỉ cần can thiệp nếu cần ghi nhận trường hợp đặc biệt.
                    </p>
                  </div>
                )}
              </div>

              {/* Amounts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CurrencyInput
                  label="Số Tiền (VNĐ)"
                  value={amountVND}
                  onValueChange={(val) => setAmountVND(String(val))}
                  onChangeRaw={(raw) => setAmountVND(raw)}
                  required
                />
                <CurrencyInput
                  label="Phí Đi Kèm (VNĐ)"
                  value={feeVND}
                  onValueChange={(val) => setFeeVND(String(val))}
                  onChangeRaw={(raw) => setFeeVND(raw)}
                />
              </div>
            </div>

            {/* Right Column (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Statement Repayment Settlement Selector if REPAYMENT */}
              {transactionType === "REPAYMENT" && (
                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2">
                  <label className="block text-xs font-bold text-teal-300 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4" />
                    <span>Gạch Nợ Cho Kỳ Sao Kê</span>
                  </label>
                  <Select
                    value={settlesStatementId}
                    onChange={(e) => setSettlesStatementId(e.target.value)}
                    options={[
                      { value: "", label: "-- Khớp tự động theo ngày --" },
                      ...pendingStatements.map((st: StatementPaymentStatus) => ({
                        value: st.statement_id,
                        label: `Kỳ ${formatDate(st.statement_date)} (Nợ ${formatCurrency(st.remaining_balance_to_pay)})`,
                      })),
                    ]}
                  />
                </div>
              )}

              {/* Installment Plan Selector if INSTALLMENT_MONTHLY or is_installment */}
              {(transactionType === "INSTALLMENT_MONTHLY" ||
                Boolean(installmentPlanId)) && (
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-2 animate-fadeIn">
                  <label className="block text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <Percent className="w-4 h-4" />
                    <span>Liên Kết Gói Trả Góp</span>
                  </label>
                  <Select
                    value={installmentPlanId}
                    onChange={(e) => {
                      const planId = e.target.value;
                      setInstallmentPlanId(planId);
                      const found = accountInstallments.find(
                        (p: InstallmentPlan) => p.id === planId
                      );
                      if (found) {
                        setAmountVND(String(found.monthly_payment));
                        if (
                          !rawDescription.trim() ||
                          rawDescription === "Trả góp định kỳ hàng tháng"
                        ) {
                          setRawDescription(`Trả góp: ${found.product_name}`);
                        }
                      }
                    }}
                    options={[
                      { value: "", label: "-- Không liên kết gói trả góp --" },
                      ...accountInstallments.map((p: InstallmentPlan) => ({
                        value: p.id,
                        label: `${p.product_name} • ${formatCurrency(p.monthly_payment)}/kỳ ${p.status === "ACTIVE" ? "(Đang chạy)" : "(Đã xong)"}`,
                      })),
                    ]}
                  />
                  <p className="text-[10px] text-sky-200/80">
                    Chọn gói trả góp để liên kết kỳ trả góp này và quản lý số dư tự động.
                  </p>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Ghi Chú Cá Nhân
                </label>
                <textarea
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú chi tiêu, mục đích..."
                />
              </div>

              {/* FX Foreign currency toggle */}
              {isForeignCurrency && (
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-purple-300 font-bold">
                    <span>Ngoại Tệ ({currencyCode})</span>
                    <span>Tỷ giá: {exchangeRate}</span>
                  </div>
                  <Input
                    label="Số Tiền Nguyên Tệ"
                    type="number"
                    value={foreignAmount}
                    onChange={(e) => setForeignAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Edit Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
            >
              Hủy Chỉnh Sửa
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
