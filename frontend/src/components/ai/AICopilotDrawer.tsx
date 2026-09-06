import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  CornerDownLeft,
  CreditCard,
  Edit3,
  MessageSquare,
  PlusCircle,
  Receipt,
  Send,
  Sparkles,
  Store,
  Tag,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { aiService } from "../../services/aiService";
import { AIChatMessage, AITransactionDraft } from "../../types/ai";
import { useCreateTransaction } from "../../hooks/useFinanceMutations";
import { useToast } from "../../context/ToastContext";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { SmartCreateTransactionModal } from "../transactions/SmartCreateTransactionModal";
import { TransactionCreatePayload, TransactionType } from "../../types/transaction";

export const AICopilotDrawer: React.FC = () => {
  const { toast } = useToast();
  const createTxMutation = useCreateTransaction();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "assistant",
      content:
        "Xin chào! Tôi là **AI Financial Advisor & Copilot** của Credit Wallet 2.0.\n\nTôi có thể giúp bạn:\n• ✍️ **Thêm giao dịch tức thì qua câu lệnh chat** *(VD: 'Ăn trưa 45k tiền mặt', 'Mua cafe 50k bằng thẻ Techcombank', 'Chuyển 2tr từ VCB sang MoMo')*\n• 💳 **Kiểm tra dư nợ live & hạn mức khả dụng**\n• ⏰ **Theo dõi lịch thanh toán sao kê & trả góp**\n• 📊 **Phân tích cơ cấu chi tiêu & sức khỏe tài chính**\n\nBạn muốn ghi chép giao dịch hay tra cứu thông tin gì hôm nay?",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingIdx, setConfirmingIdx] = useState<number | null>(null);

  // Modal edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Partial<TransactionCreatePayload> | undefined>(undefined);

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "☕ Chi 45k cafe Highland bằng Techcombank",
    "🍜 Ăn trưa 120k tiền mặt",
    "💸 Chuyển 2tr từ VCB sang MoMo",
    "💰 Nhận lương 25tr vào Vietcombank",
    "Dư nợ và hạn mức khả dụng hiện tại?",
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    const userMsg: AIChatMessage = { role: "user", content: text.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await aiService.chat({
        message: text.trim(),
        history: newHistory,
        include_financial_context: true,
      });

      const assistantMsg: AIChatMessage = {
        role: "assistant",
        content: res.reply,
        action: res.action,
        transaction_draft: res.transaction_draft,
        draft_status: res.transaction_draft ? "pending" : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.suggested_followups && res.suggested_followups.length > 0) {
        setSuggestedQuestions(res.suggested_followups);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Xin lỗi, đã có lỗi xảy ra khi xử lý phản hồi: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDraft = async (msgIndex: number, draft: AITransactionDraft) => {
    setConfirmingIdx(msgIndex);
    try {
      const baseAmount = Number(draft.amount) || 0;
      const feeAmount = Number(draft.fee || 0);

      const payload: TransactionCreatePayload = {
        account_id: draft.account_id || "",
        transaction_date: draft.transaction_date,
        post_date: draft.post_date || draft.transaction_date,
        amount: baseAmount,
        fee: feeAmount,
        total_amount: baseAmount + feeAmount,
        transaction_type: draft.transaction_type,
        category_id: draft.category_id || undefined,
        merchant_name: draft.merchant_name || undefined,
        raw_description: draft.raw_description || undefined,
        note: draft.note || undefined,
        transfer_to_account_id: draft.transfer_to_account_id || undefined,
      };

      await createTxMutation.mutateAsync(payload);

      // Update message draft status
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, draft_status: "confirmed" } : m))
      );

      toast.success("Đã ghi nhận giao dịch vào sổ cái thành công!");

      // Add a polite confirmation assistant reply
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ **Đã ghi sổ thành công!**\nGiao dịch **${formatCurrency(baseAmount)}** đã được cập nhật vào tài khoản **${draft.account_name || "của bạn"}**. Số dư và hạn mức live balance đã được tự động tính toán lại.`,
        },
      ]);
    } catch (err: any) {
      toast.error(`Lỗi khi lưu giao dịch: ${err.message}`);
    } finally {
      setConfirmingIdx(null);
    }
  };

  const handleOpenEditDraft = (draft: AITransactionDraft) => {
    const baseAmount = Number(draft.amount) || 0;
    const feeAmount = Number(draft.fee || 0);

    setModalInitialData({
      account_id: draft.account_id,
      transaction_date: draft.transaction_date,
      post_date: draft.post_date || draft.transaction_date,
      amount: baseAmount,
      fee: feeAmount,
      total_amount: baseAmount + feeAmount,
      transaction_type: draft.transaction_type,
      category_id: draft.category_id,
      merchant_name: draft.merchant_name,
      raw_description: draft.raw_description,
      note: draft.note,
      transfer_to_account_id: draft.transfer_to_account_id,
    });
    setIsEditModalOpen(true);
  };

  const handleCancelDraft = (msgIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, draft_status: "cancelled" } : m))
    );
    toast.info("Đã bỏ qua giao dịch nháp.");
  };

  const getTypeBadgeInfo = (type: TransactionType) => {
    switch (type) {
      case "PURCHASE":
        return { label: "Chi tiêu", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" };
      case "INCOME":
        return { label: "Thu nhập", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
      case "TRANSFER":
        return { label: "Chuyển tiền", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" };
      case "REPAYMENT":
        return { label: "Thanh toán nợ", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      case "FEE":
        return { label: "Phí dịch vụ", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
      case "INTEREST":
        return { label: "Lãi suất", color: "bg-red-500/20 text-red-300 border-red-500/30" };
      case "CASHBACK_CREDIT":
        return { label: "Hoàn tiền", color: "bg-teal-500/20 text-teal-300 border-teal-500/30" };
      case "REFUND":
        return { label: "Hủy đơn / Hoàn tiền", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
      default:
        return { label: type, color: "bg-slate-700/50 text-slate-300 border-slate-600" };
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold shadow-2xl shadow-emerald-950/80 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 group"
          title="Trợ lý AI Tài chính"
        >
          <Sparkles className="w-5 h-5 text-slate-950 animate-pulse" />
          <span className="text-xs font-extrabold tracking-wide hidden sm:inline">
            AI Copilot
          </span>
        </button>
      )}

      {/* Drawer Dialog */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 sm:right-6 sm:bottom-6 sm:top-auto sm:h-[40rem] w-full sm:w-[28rem] bg-slate-900 border border-slate-800 rounded-none sm:rounded-3xl shadow-2xl shadow-slate-950 z-50 flex flex-col overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <span>AI Financial Advisor</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                    Live Copilot
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">Ghi chép giao dịch & Cố vấn tài chính</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 h-fit mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="flex flex-col gap-2 max-w-[90%]">
                  {/* Content bubble */}
                  <div
                    className={`p-3.5 rounded-2xl leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-500 text-slate-950 font-medium rounded-tr-sm self-end"
                        : "bg-slate-950/90 text-slate-200 border border-slate-800 rounded-tl-sm whitespace-pre-wrap font-sans"
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* Interactive Transaction Confirmation Card */}
                  {m.transaction_draft && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/95 p-3.5 space-y-3 shadow-xl backdrop-blur-sm">
                      {/* Top status header */}
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            getTypeBadgeInfo(m.transaction_draft.transaction_type).color
                          }`}
                        >
                          {getTypeBadgeInfo(m.transaction_draft.transaction_type).label}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-black text-emerald-400 tracking-tight">
                            {formatCurrency(m.transaction_draft.amount)}
                          </div>
                          {Number(m.transaction_draft.fee || 0) > 0 && (
                            <div className="text-[10px] text-slate-400">
                              + Phí: {formatCurrency(m.transaction_draft.fee || 0)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Detail attributes grid */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="space-y-0.5">
                          <span className="text-slate-500 flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-400" /> Tài khoản nguồn:
                          </span>
                          <span className="font-semibold text-slate-200 block truncate">
                            {m.transaction_draft.account_name || "Mặc định"}
                          </span>
                        </div>

                        {m.transaction_draft.transaction_type === "TRANSFER" && (
                          <div className="space-y-0.5">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Wallet className="w-3 h-3 text-cyan-400" /> Tài khoản đích:
                            </span>
                            <span className="font-semibold text-cyan-300 block truncate">
                              {m.transaction_draft.transfer_to_account_name || "Chưa chọn"}
                            </span>
                          </div>
                        )}

                        <div className="space-y-0.5">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Tag className="w-3 h-3 text-slate-400" /> Danh mục:
                          </span>
                          <span className="font-semibold text-slate-300 block truncate">
                            {m.transaction_draft.parent_category_name
                              ? `${m.transaction_draft.parent_category_name} > ${m.transaction_draft.category_name}`
                              : m.transaction_draft.category_name || "Chung"}
                          </span>
                        </div>

                        {m.transaction_draft.merchant_name && (
                          <div className="space-y-0.5">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Store className="w-3 h-3 text-slate-400" /> Đơn vị (Merchant):
                            </span>
                            <span className="font-semibold text-slate-200 block truncate">
                              {m.transaction_draft.merchant_name}
                            </span>
                          </div>
                        )}

                        <div className="space-y-0.5">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" /> Ngày giao dịch:
                          </span>
                          <span className="font-semibold text-slate-300">
                            {m.transaction_draft.transaction_date}
                          </span>
                        </div>

                        <div className="col-span-2 space-y-0.5">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Receipt className="w-3 h-3 text-slate-400" /> Mô tả:
                          </span>
                          <span className="text-slate-300 block italic">
                            "{m.transaction_draft.raw_description}"
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      {m.draft_status === "confirmed" ? (
                        <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center justify-center gap-1.5 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Đã lưu vào sổ cái thành công</span>
                        </div>
                      ) : m.draft_status === "cancelled" ? (
                        <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 font-medium flex items-center justify-center gap-1.5 text-xs">
                          <X className="w-3.5 h-3.5" />
                          <span>Đã hủy bỏ giao dịch nháp</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleConfirmDraft(idx, m.transaction_draft!)}
                            disabled={confirmingIdx === idx}
                            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-emerald-950/60 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{confirmingIdx === idx ? "Đang lưu..." : "Xác nhận Ghi Sổ"}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditDraft(m.transaction_draft!)}
                            className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 text-xs"
                            title="Chỉnh sửa chi tiết"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-300" />
                            <span className="hidden sm:inline">Sửa</span>
                          </button>

                          <button
                            onClick={() => handleCancelDraft(idx)}
                            className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-rose-300 transition-colors"
                            title="Bỏ qua"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 shrink-0 h-fit mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Bot className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>AI đang phân tích câu lệnh và xử lý sổ cái...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Questions & Commands */}
          {suggestedQuestions.length > 0 && !isLoading && (
            <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {suggestedQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(sq)}
                  className="px-2.5 py-1 rounded-full bg-slate-800/60 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-300 border border-slate-700 text-[11px] whitespace-nowrap transition-colors flex items-center gap-1"
                >
                  {sq}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Nhập: 'Ăn trưa 50k tiền mặt', 'Cafe 45k thẻ TCB'..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Embedded SmartCreateTransactionModal for editing drafts */}
      {isEditModalOpen && (
        <SmartCreateTransactionModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setModalInitialData(undefined);
          }}
          initialData={modalInitialData}
        />
      )}
    </>
  );
};
