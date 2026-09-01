import React, { useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  CreditCard,
  Edit2,
  Lock,
  Sparkles,
  Unlock,
} from "lucide-react";
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
import { Account, AccountLiveBalance, AccountStatus } from "../types/account";
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

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "LOCKED" | "OTHER">("ALL");

  // Edit Modal State & Validation
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editStatus, setEditStatus] = useState<AccountStatus>("ACTIVE");
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
    setEditLimit(String(acc.credit_limit));
    setEditNote(acc.note || "");
    setEditStatus(acc.status);
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccountId) return;

    const parsedLimit = parseFloat(editLimit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      setEditError("Hạn mức tín dụng phải là số không âm");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editAccountId,
        payload: {
          credit_limit: parsedLimit,
          note: editNote.trim(),
          status: editStatus,
        },
      });
      toast.success("Cập nhật thông tin thẻ thành công!");
      setIsEditOpen(false);
    } catch (err: any) {
      toast.error(`Lỗi cập nhật thẻ: ${err.message}`);
    }
  };

  const handleOpenConfirmStatus = (acc: Account, newStatus: AccountStatus) => {
    setTargetAccount(acc);
    setTargetNewStatus(newStatus);
    setIsConfirmOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!targetAccount) return;
    try {
      await statusMutation.mutateAsync({
        id: targetAccount.id,
        status: targetNewStatus,
      });
      toast.success(
        targetNewStatus === "ACTIVE"
          ? `Đã mở khóa thẻ "${targetAccount.account_name}" thành công!`
          : `Đã khóa thẻ "${targetAccount.account_name}"!`
      );
      setIsConfirmOpen(false);
      setTargetAccount(null);
    } catch (err: any) {
      toast.error(`Lỗi đổi trạng thái thẻ: ${err.message}`);
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
    if (statusFilter === "ACTIVE") return acc.status === "ACTIVE";
    if (statusFilter === "LOCKED") return acc.status === "LOCKED";
    if (statusFilter === "OTHER") return acc.status !== "ACTIVE" && acc.status !== "LOCKED";
    return true;
  });

  const activeCount = liveBalances.filter((a: AccountLiveBalance) => a.status === "ACTIVE").length;
  const lockedCount = liveBalances.filter((a: AccountLiveBalance) => a.status === "LOCKED").length;
  const otherCount = liveBalances.filter((a: AccountLiveBalance) => a.status !== "ACTIVE" && a.status !== "LOCKED").length;

  if (liveBalancesLoading && accounts.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 font-medium">Đang tải danh sách thẻ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Danh Mục Thẻ & Hạn Mức Tín Dụng</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Theo dõi chi tiết dư nợ sao kê, các giao dịch phát sinh chưa chốt và hạn mức khả dụng
          </p>
        </div>
      </div>

      {/* 2. Visual Card Showcase */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Thẻ Đang Hoạt Động (Nhấn để chọn đối soát)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveBalances
            .filter((acc: AccountLiveBalance) => acc.status !== "CLOSED" && acc.status !== "REPLACED")
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

      {/* 3. Detailed Account Audit & Breakdown Table */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Chi Tiết Dư Nợ & Hạn Mức Khả Dụng Thực Tế (Live Breakdown)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Công thức: Dư nợ sao kê gần nhất + Chi tiêu chưa sao kê - Thanh toán chưa sao kê = Dư nợ thực tế
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
              Tất cả ({liveBalances.length})
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
            {otherCount > 0 && (
              <button
                onClick={() => setStatusFilter("OTHER")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  statusFilter === "OTHER"
                    ? "bg-slate-800 text-slate-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Khác ({otherCount})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tên Thẻ / Ngân Hàng</th>
                <th className="py-3 px-4">Số Thẻ</th>
                <th className="py-3 px-4 text-right">Hạn Mức</th>
                <th className="py-3 px-4 text-right">Dư Nợ Sao Kê</th>
                <th className="py-3 px-4 text-right">Chưa Lên Sao Kê (Net)</th>
                <th className="py-3 px-4 text-right font-bold text-slate-200">Dư Nợ Tức Thời</th>
                <th className="py-3 px-4 text-right text-emerald-400 font-bold">Khả Dụng</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không có thẻ nào phù hợp với bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((acc: AccountLiveBalance) => {
                  const rawAcc = accounts.find((a: Account) => a.id === acc.account_id);
                  const badgeInfo = getStatusBadge(acc.status);
                  const isLocked = acc.status === "LOCKED";

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
                            <span title="Thẻ bị khóa/vô hiệu hóa">
                              <Lock className="w-3.5 h-3.5 text-rose-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{acc.bank_name}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {acc.card_number_masked}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrency(acc.credit_limit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrency(acc.latest_statement_balance)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <div className={Number(acc.unbilled_net_amount) > 0 ? "text-rose-400" : "text-emerald-400"}>
                          {Number(acc.unbilled_net_amount) > 0 ? "+" : ""}
                          {formatCurrency(acc.unbilled_net_amount)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {acc.unbilled_transaction_count} giao dịch
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                        {formatCurrency(acc.live_current_balance)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(acc.live_available_limit)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={badgeInfo.variant}>
                          {badgeInfo.label}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {rawAcc && rawAcc.status === "ACTIVE" && (
                            <button
                              onClick={() => handleOpenConfirmStatus(rawAcc, "LOCKED")}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Vô hiệu hóa / Khóa thẻ"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                          {rawAcc && rawAcc.status === "LOCKED" && (
                            <button
                              onClick={() => handleOpenConfirmStatus(rawAcc, "ACTIVE")}
                              className="p-1.5 text-amber-400 hover:text-emerald-400 hover:bg-emerald-950/40 rounded-lg transition-colors"
                              title="Mở khóa / Kích hoạt lại thẻ"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}
                          {rawAcc && (
                            <button
                              onClick={() => handleOpenEdit(rawAcc)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Chỉnh sửa thông tin thẻ"
                            >
                              <Edit2 className="w-4 h-4" />
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

      {/* 4. Card Benefits & Cashback Policy Matrix */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <span>Chính Sách Ưu Đãi & Hoàn Tiền Thẻ (Card Benefits Matrix)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ma trận đặc quyền tích lũy điểm thưởng Shinhan Points và hoàn tiền Cashback HSBC/Sacombank
            </p>
          </div>
        </div>

        {benefits.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-slate-500 text-xs">
            Chưa có chính sách ưu đãi nào được cấu hình
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((b: CardBenefit) => (
              <div
                key={b.id}
                className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{b.account_name}</span>
                    <Badge variant={b.reward_type === "CASHBACK" ? "success" : "warning"}>
                      {b.reward_type === "CASHBACK" ? "Hoàn Tiền" : "Tích Điểm"}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                    {b.category_keyword || b.category_name || "Mọi chi tiêu"}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {b.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Tỷ lệ ưu đãi:</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {Number(b.reward_rate_percent)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>


      {/* 4. Edit Account Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Cập Nhật Thông Tin Thẻ Tín Dụng"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <CurrencyInput
              label="Hạn Mức Tín Dụng (VNĐ)"
              value={editLimit}
              placeholder="VD: 50,000,000"
              onValueChange={(val) => {
                setEditLimit(String(val));
                if (editError) setEditError(null);
              }}
              onChangeRaw={(raw) => setEditLimit(raw)}
              error={editError || undefined}
              required
            />
          </div>


          <Select
            label="Trạng Thái Thẻ"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
            options={[
              { value: "ACTIVE", label: "ACTIVE - Đang hoạt động" },
              { value: "LOCKED", label: "LOCKED - Đã khóa / Vô hiệu hóa" },
              { value: "CLOSED", label: "CLOSED - Đã đóng thẻ" },
              { value: "EXPIRED", label: "EXPIRED - Hết hạn" },
              { value: "REPLACED", label: "REPLACED - Đã thay thế" },
            ]}
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Ghi Chú Cá Nhân
            </label>
            <textarea
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              rows={3}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="VD: Thẻ dùng cho chi tiêu ăn uống tích điểm 5x..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Quick Confirm Status Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => !statusMutation.isPending && setIsConfirmOpen(false)}
        title={targetNewStatus === "LOCKED" ? "Xác Nhận Khóa Thẻ" : "Xác Nhận Mở Khóa Thẻ"}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            {targetNewStatus === "LOCKED" ? (
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-sm text-slate-100">
                {targetNewStatus === "LOCKED"
                  ? `Vô hiệu hóa thẻ "${targetAccount?.account_name}"?`
                  : `Kích hoạt lại thẻ "${targetAccount?.account_name}"?`}
              </p>
              <p className="text-slate-400">
                {targetNewStatus === "LOCKED"
                  ? "Thẻ sẽ được chuyển sang trạng thái ĐÃ KHÓA (LOCKED). Bạn sẽ tạm ngưng chi tiêu mới trên thẻ này cho đến khi mở khóa lại."
                  : "Thẻ sẽ được chuyển về trạng thái HOẠT ĐỘNG (ACTIVE) và sẵn sàng tiếp tục sử dụng."}
              </p>
              <div className="pt-2 font-mono text-[11px] text-slate-400">
                Số thẻ: <span className="text-slate-200">{targetAccount?.card_number_masked}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={statusMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant={targetNewStatus === "LOCKED" ? "danger" : "primary"}
              onClick={handleConfirmToggleStatus}
              isLoading={statusMutation.isPending}
            >
              {targetNewStatus === "LOCKED" ? "Khóa thẻ ngay" : "Kích hoạt lại thẻ"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
