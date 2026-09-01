import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  CornerDownLeft,
  MessageSquare,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { aiService } from "../../services/aiService";
import { AIChatMessage } from "../../types/ai";

export const AICopilotDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "assistant",
      content:
        "Xin chào! Tôi là **AI Financial Advisor** của Credit Wallet. Tôi có thể giúp bạn kiểm tra dư nợ live, theo dõi lịch thanh toán sao kê, phân tích chi tiêu hoặc tư vấn chọn thẻ quẹt tối ưu nhất. Bạn cần hỗ trợ gì hôm nay?",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "Dư nợ và hạn mức khả dụng hiện tại?",
    "Các khoản nợ cần trả trong 30 ngày tới?",
    "Nên quẹt thẻ nào để ăn uống được hoàn tiền cao nhất?",
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

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply },
      ]);

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
            AI Financial Advisor
          </span>
        </button>
      )}

      {/* Drawer Dialog */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 sm:right-6 sm:bottom-6 sm:top-auto sm:h-[38rem] w-full sm:w-[26rem] bg-slate-900 border border-slate-800 rounded-none sm:rounded-3xl shadow-2xl shadow-slate-950 z-50 flex flex-col overflow-hidden animate-slideUp">
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
                <p className="text-[11px] text-slate-400">Trợ lý tài chính cá nhân & thẻ tín dụng</p>
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

                <div
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-emerald-500 text-slate-950 font-medium rounded-tr-sm"
                      : "bg-slate-950/80 text-slate-200 border border-slate-800 rounded-tl-sm whitespace-pre-wrap font-sans"
                  }`}
                >
                  {m.content}
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
                <span>AI đang phân tích sổ cái và tính toán...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Questions */}
          {suggestedQuestions.length > 0 && !isLoading && (
            <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {suggestedQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(sq)}
                  className="px-2.5 py-1 rounded-full bg-slate-800/60 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-300 border border-slate-700 text-[11px] whitespace-nowrap transition-colors"
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
              placeholder="Hỏi AI về dư nợ, hạn trả nợ, chi tiêu..."
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
    </>
  );
};
