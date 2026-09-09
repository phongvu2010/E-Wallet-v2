import React, { useState } from "react";
import {
  AlertCircle,
  Award,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Edit2,
  Lock,
  PiggyBank,
  Plus,
  Smartphone,
  Sparkles,
  Unlock,
  Wallet,
} from "lucide-react";
import { CreateAccountModal } from "../components/accounts/CreateAccountModal";
import { CreditCardVisual } from "../components/cards/CreditCardVisual";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { CurrencyInput } from "../components/common/CurrencyInput";
import { Input } from "../components/common/Input";
import { Modal } from "../components/common/Modal";
import { Select } from "../components/common/Select";
import { Spinner } from "../components/common/Spinner";
import { useToast } from "../context/ToastContext";
import { useUpdateAccount, useUpdateAccountStatus } from "../hooks/useFinanceMutations";
import { useAccountLiveBalances, useAccounts, useCardBenefits } from "../hooks/useFinanceQueries";
import { Account, AccountLiveBalance, AccountStatus, AccountType } from "../types/account";
import { CardBenefit } from "../types/cardRecommendation";
import { formatCurrency, getRiskLevelColor } from "../utils/formatters";

export const AccountsPage: React.FC = () => {
  const { data: accounts = [] } = useAccounts();
  const { data: liveBalances = [], isLoading: liveBalancesLoading } = useAccountLiveBalances();
  const { data: benefits = [] } = useCardBenefits();
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);

  const { toast } = useToast();
  const updateMutation = useUpdateAccount();
  const statusMutation = useUpdateAccountStatus();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filter States
  const [typeFilter, setTypeFilter] = useState<"ALL" | "BANK" | "CASH_WALLET" | "CREDIT_CARD">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "LOCKED" | "OTHER">("ALL");

  // Edit Modal State & Validation
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState<string>("");
  const [editLimit, setEditLimit] = useState<string>("");
  const [editInitialBalance, setEditInitialBalance] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editStatus, setEditStatus] = useState<AccountStatus>("ACTIVE");
  const [editAccountType, setEditAccountType] = useState<AccountType>("CREDIT_CARD");
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Toggle / Confirm Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [targetAccount, setTargetAccount] = useState<Account | null>(null);
  const [targetNewStatus, setTargetNewStatus] = useState<AccountStatus>("LOCKED");

  const activeBalances = liveBalances.filter(
    (acc: AccountLiveBalance) => acc.status !== "CLOSED" && acc.status !== "REPLACED"
  );

  const selectedAcc =
    liveBalances.find((acc: AccountLiveBalance) => acc.account_id === selectedAccId) ||
    (activeBalances.length > 0 ? activeBalances[0] : null);

  const handleOpenEdit = (acc: Account) => {
    setEditAccountId(acc.id);
    setEditAccountName(acc.account_name);
    setEditLimit(String(acc.credit_limit || 0));
    setEditInitialBalance(String(acc.initial_balance || 0));
    setEditNote(acc.note || "");
    setEditStatus(acc.status);
    setEditAccountType(acc.account_type);
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccountId) return;

    const parsedLimit = parseFloat(editLimit) || 0;
    const parsedInitial = parseFloat(editInitialBalance) || 0;

    try {
      await updateMutation.mutateAsync({
        id: editAccountId,
        payload: {
          account_name: editAccountName.trim(),
          credit_limit: editAccountType === "CREDIT_CARD" ? parsedLimit : 0,
          initial_balance: editAccountType !== "CREDIT_CARD" ? parsedInitial : 0,
          note: editNote.trim() ? editNote.trim() : null,
          status: editStatus,
        },
      });
      toast.success("Cập nhật thông tin tài khoản thành công!");
      setIsEditOpen(false);
    } catch (err: any) {
      toast.error(`Lỗi cập nhật tài khoản: ${err.message}`);
    }
  };

  const handleOpenConfirmStatus = (acc: Account, newStatus: AccountStatus) => {
    setTargetAccount(acc);
    setTargetNewStatus(newStatus);
    setIsConfirmOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!targetAccount) return;
    try {
      await statusMutation.mutateAsync({
        id: targetAccount.id,
        status: targetNewStatus,
      });
      toast.success(
        targetNewStatus === "LOCKED"
          ? `Đã khóa tài khoản "${targetAccount.account_name}"`
          : `Đã mở khóa tài khoản "${targetAccount.account_name}"`
      );
      setIsConfirmOpen(false);
      setTargetAccount(null);
    } catch (err: any) {
      toast.error(`Lỗi đổi trạng thái: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return { variant: "success" as const, label: "HOẠT ĐỘNG" };
      case "LOCKED":
        return { variant: "danger" as const, label: "ĐÃ KHÓA" };
      case "CLOSED":
        return { variant: "neutral" as const, label: "ĐÃ ĐÓNG" };
      case "EXPIRED":
        return { variant: "neutral" as const, label: "HẾT HẠN" };
      case "REPLACED":
        return { variant: "warning" as const, label: "ĐÃ ĐỔI THẺ" };
      default:
        return { variant: "neutral" as const, label: status };
    }
  };

  const filteredBalances = liveBalances.filter((acc: AccountLiveBalance) => {
    // 1. Filter by Type
    if (typeFilter === "BANK") {
      if (acc.account_type !== "BANK_ACCOUNT" && acc.account_type !== "SAVINGS") return false;
    } else if (typeFilter === "CASH_WALLET") {
      if (acc.account_type !== "CASH" && acc.account_type !== "E_WALLET") return false;
    } else if (typeFilter === "CREDIT_CARD") {
      if (acc.account_type !== "CREDIT_CARD" && acc.is_asset) return false;
    }

    // 2. Filter by Status
    if (statusFilter === "ACTIVE") return acc.status === "ACTIVE";
    if (statusFilter === "LOCKED") return acc.status === "LOCKED";
    if (statusFilter === "OTHER") return acc.status !== "ACTIVE" && acc.status !== "LOCKED";
    return true;
  });

  const activeCount = liveBalances.filter((a: AccountLiveBalance) => a.status === "ACTIVE").length;
  const lockedCount = liveBalances.filter((a: AccountLiveBalance) => a.status === "LOCKED").length;

  const bankCount = liveBalances.filter((a: AccountLiveBalance) => a.account_type === "BANK_ACCOUNT" || a.account_type === "SAVINGS").length;
  const cashCount = liveBalances.filter((a: AccountLiveBalance) => a.account_type === "CASH" || a.account_type === "E_WALLET").length;
  const cardCount = liveBalances.filter((a: AccountLiveBalance) => a.account_type === "CREDIT_CARD" || (!a.is_asset && !a.account_type)).length;

  if (liveBalancesLoading && accounts.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải danh sách tài khoản & thẻ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Quản Lý Tài Khoản Ngân Hàng, Ví Tiền & Thẻ Tín Dụng</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi số dư tức thời, tiền mặt, tài khoản thanh toán và hạn mức thẻ tín dụng
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Tài Khoản / Ví Mới</span>
        </button>
      </div>

      {/* 2. Type Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setTypeFilter("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            typeFilter === "ALL"
              ? "bg-slate-800 text-white shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Tất cả tài khoản ({liveBalances.length})
        </button>

        <button
          onClick={() => setTypeFilter("BANK")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            typeFilter === "BANK"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4 text-sky-400" />
          <span>Ngân hàng ({bankCount})</span>
        </button>

        <button
          onClick={() => setTypeFilter("CASH_WALLET")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            typeFilter === "CASH_WALLET"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Banknote className="w-4 h-4 text-emerald-400" />
          <span>Tiền mặt & Ví điện tử ({cashCount})</span>
        </button>

        <button
          onClick={() => setTypeFilter("CREDIT_CARD")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            typeFilter === "CREDIT_CARD"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <CreditCard className="w-4 h-4 text-amber-400" />
          <span>Thẻ tín dụng ({cardCount})</span>
        </button>
      </div>

      {/* 3. Visual Card Showcase for Credit Cards (if in ALL or CREDIT_CARD filter) */}
      {(typeFilter === "ALL" || typeFilter === "CREDIT_CARD") && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            <span>Thẻ Tín Dụng & Dư Nợ</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveBalances
              .filter(
                (acc: AccountLiveBalance) =>
                  !acc.is_asset && (acc.account_type === "CREDIT_CARD" || !acc.account_type) &&
                  acc.status !== "CLOSED" && acc.status !== "REPLACED"
              )
              .map((acc: AccountLiveBalance) => (
                <CreditCardVisual
                  key={acc.account_id}
                  account={acc}
                  isSelected={selectedAcc?.account_id === acc.account_id}
                  onClick={() => setSelectedAccId(acc.account_id)}
                />
              ))}
          </div>
        </div>
      )}

      {/* 4. Detailed Account Audit & Breakdown Table */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Chi Tiết Số Dư & Dư Nợ Tức Thời (Real-time Live Balance)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống tự động đồng bộ dòng tiền thu/chi, thanh toán nợ và biến động số dư theo thời gian thực
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "ALL"
                  ? "bg-slate-800 text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "ACTIVE"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Hoạt động ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("LOCKED")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "LOCKED"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Đã khóa ({lockedCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tài Khoản / Ví</th>
                <th className="py-3 px-4">Loại Tài Khoản</th>
                <th className="py-3 px-4">Số Tài Khoản / Thẻ</th>
                <th className="py-3 px-4 text-right">Hạn Mức / Số Dư Ban Đầu</th>
                <th className="py-3 px-4 text-right font-bold text-slate-200">Số Dư / Dư Nợ Thực Tế</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Không có tài khoản nào phù hợp với bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((acc: AccountLiveBalance) => {
                  const rawAcc = accounts.find((a: Account) => a.id === acc.account_id);
                  const badgeInfo = getStatusBadge(acc.status);
                  const isLocked = acc.status === "LOCKED";
                  const isAsset = acc.is_asset;

                  return (
                    <tr
                      key={acc.account_id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isLocked ? "bg-rose-950/10" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          {acc.account_name}
                          {isLocked && (
                            <span title="Tài khoản bị khóa">
                              <Lock className="w-3.5 h-3.5 text-rose-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{acc.bank_name}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                          acc.account_type === "BANK_ACCOUNT"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : acc.account_type === "CASH"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : acc.account_type === "E_WALLET"
                            ? "bg-pink-500/10 text-pink-400 border-pink-500/20"
                            : acc.account_type === "SAVINGS"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {acc.account_type === "BANK_ACCOUNT"
                            ? "Ngân hàng"
                            : acc.account_type === "CASH"
                            ? "Tiền mặt"
                            : acc.account_type === "E_WALLET"
                            ? "Ví điện tử"
                            : acc.account_type === "SAVINGS"
                            ? "Tiết kiệm"
                            : "Thẻ tín dụng"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {acc.card_number_masked || "—"}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {isAsset
                          ? formatCurrency(rawAcc?.initial_balance || 0)
                          : formatCurrency(acc.credit_limit)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={isAsset ? "text-emerald-400" : "text-rose-400"}>
                          {formatCurrency(acc.live_current_balance)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={badgeInfo.variant} size="sm">
                          {badgeInfo.label}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {rawAcc && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(rawAcc)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Chỉnh sửa tài khoản"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {rawAcc && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenConfirmStatus(
                                  rawAcc,
                                  isLocked ? "ACTIVE" : "LOCKED"
                                )
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                isLocked
                                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                              }`}
                              title={isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                            >
                              {isLocked ? (
                                <Unlock className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <CreateAccountModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Edit Account Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Chỉnh Sửa Thông Tin Tài Khoản"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              {editError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tên tài khoản / Ví
            </label>
            <Input
              value={editAccountName}
              onChange={(e) => setEditAccountName(e.target.value)}
              required
            />
          </div>

          {editAccountType === "CREDIT_CARD" ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Hạn Mức Tín Dụng (VNĐ)
              </label>
              <CurrencyInput
                value={editLimit}
                onChange={setEditLimit}
                placeholder="0"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Số Dư Ban Đầu (VNĐ)
              </label>
              <CurrencyInput
                value={editInitialBalance}
                onChange={setEditInitialBalance}
                placeholder="0"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Trạng thái tài khoản
            </label>
            <Select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
              options={[
                { value: "ACTIVE", label: "Đang hoạt động (ACTIVE)" },
                { value: "LOCKED", label: "Đã khóa (LOCKED)" },
                { value: "CLOSED", label: "Đã đóng vĩnh viễn (CLOSED)" },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Ghi chú
            </label>
            <Input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Ghi chú thêm..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Lock / Unlock Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={targetNewStatus === "LOCKED" ? "Khóa Tài Khoản" : "Mở Khóa Tài Khoản"}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Bạn có chắc chắn muốn{" "}
            <strong className="text-white">
              {targetNewStatus === "LOCKED" ? "khóa" : "mở khóa"}
            </strong>{" "}
            tài khoản <strong className="text-emerald-400">{targetAccount?.account_name}</strong> không?
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsConfirmOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant={targetNewStatus === "LOCKED" ? "danger" : "primary"}
              onClick={handleConfirmStatusChange}
              isLoading={statusMutation.isPending}
            >
              Xác Nhận
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
