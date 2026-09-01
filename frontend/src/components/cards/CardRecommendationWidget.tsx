import React, { useState } from "react";
import {
  Award,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Flame,
  HelpCircle,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCardRecommendation } from "../../hooks/useFinanceMutations";
import { useCategories } from "../../hooks/useFinanceQueries";
import {
  CardRecommendationItem,
  CardRecommendationResponse,
} from "../../types/cardRecommendation";
import { Category } from "../../types/category";
import { formatCurrency } from "../../utils/formatters";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { CurrencyInput } from "../common/CurrencyInput";
import { Input } from "../common/Input";
import { Select } from "../common/Select";

const QUICK_CATEGORIES = [
  { name: "Nhà hàng & F&B", label: "🍽️ Ẩm thực & Cafe" },
  { name: "Dịch vụ số & Ứng dụng", label: "🛒 Mua sắm Online" },
  { name: "Siêu thị & Bách hóa", label: "🏪 Siêu thị & Tiêu dùng" },
  { name: "Chi tiêu khác", label: "💳 Chi tiêu khác" },
];

export const CardRecommendationWidget: React.FC = () => {
  const [amount, setAmount] = useState<string>("1000000");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("Nhà hàng & F&B");
  const [merchantName, setMerchantName] = useState<string>("");
  const [recommendationResult, setRecommendationResult] =
    useState<CardRecommendationResponse | null>(null);

  const { data: categories = [] } = useCategories();
  const recommendMutation = useCardRecommendation();

  const handleQuickCategorySelect = (catName: string) => {
    setSelectedCategoryName(catName);
    const matched = categories.find((c: Category) =>
      c.name.toLowerCase().includes(catName.toLowerCase())
    );
    if (matched) {
      setSelectedCategoryId(matched.id);
    }
  };

  const handleExecuteRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) return;

    try {
      const res = await recommendMutation.mutateAsync({
        amount: numAmount,
        category_id: selectedCategoryId || undefined,
        category_name: selectedCategoryName || undefined,
        merchant_name: merchantName ? merchantName.trim() : undefined,
      });
      setRecommendationResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Card Recommendation Engine</span>
          </div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <span>Trợ Lý Đề Xuất Thẻ Chi Tiêu Tối Ưu</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tự động tính toán mức hoàn tiền cao nhất, kiểm tra hạn mức khả dụng và bảo vệ điểm tín dụng CIC
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form */}
        <form onSubmit={handleExecuteRecommend} className="lg:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Chọn nhanh mục đích chi tiêu
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_CATEGORIES.map((qc) => (
                <button
                  key={qc.name}
                  type="button"
                  onClick={() => handleQuickCategorySelect(qc.name)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all border ${
                    selectedCategoryName === qc.name
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                      : "bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  {qc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput
              label="Số tiền dự kiến (VNĐ)"
              value={amount}
              onValueChange={(val) => setAmount(String(val || 0))}
              onChangeRaw={(raw) => setAmount(raw)}
              placeholder="VD: 500,000"
              required
            />

            <Input
              label="Tên cửa hàng (Tùy chọn)"
              placeholder="Shopee, Starbucks, Grab..."
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5 shadow-lg shadow-emerald-950/50"
            isLoading={recommendMutation.isPending}
            leftIcon={<Flame className="w-4 h-4 text-amber-300" />}
          >
            Đề Xuất Thẻ Quẹt Tốt Nhất
          </Button>
        </form>

        {/* Right Result Display */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          {!recommendationResult ? (
            <div className="h-full min-h-[160px] p-6 rounded-2xl bg-slate-950/50 border border-slate-800/80 border-dashed flex flex-col items-center justify-center text-center gap-2 text-slate-500">
              <CreditCard className="w-8 h-8 text-slate-600" />
              <p className="text-xs font-medium text-slate-400">
                Nhập số tiền và danh mục bên trái, sau đó nhấn <b>Đề Xuất Thẻ</b> để nhận phân tích tối ưu.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Best Choice Card */}
              {recommendationResult.best_choice ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-slate-900 border border-emerald-500/40 shadow-xl shadow-emerald-950/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-md">
                      <Award className="w-3.5 h-3.5" />
                      <span>LỰA CHỌN TỐI ƯU NHẤT #1</span>
                    </div>

                    <Badge variant="success" size="md">
                      +
                      {recommendationResult.best_choice.reward_type === "CASHBACK"
                        ? formatCurrency(recommendationResult.best_choice.estimated_reward_amount)
                        : `${recommendationResult.best_choice.estimated_points_earned.toLocaleString()} Points`}
                    </Badge>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-extrabold text-white">
                        {recommendationResult.best_choice.account_name}
                      </h4>
                      <p className="text-xs text-slate-300">
                        {recommendationResult.best_choice.bank_name} • {recommendationResult.best_choice.card_number_masked}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400">Tỷ lệ ưu đãi</span>
                      <p className="text-lg font-bold text-emerald-400 font-mono">
                        {Number(recommendationResult.best_choice.reward_rate_percent)}%
                      </p>
                    </div>
                  </div>

                  {/* Reasons list */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    {recommendationResult.best_choice.reasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  Không tìm thấy thẻ nào có đủ hạn mức khả dụng để thực hiện giao dịch này!
                </div>
              )}

              {/* Alternative Recommendations */}
              {recommendationResult.recommendations.length > 1 && (
                <div>
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Các Lựa Chọn Dự Phòng Khác
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recommendationResult.recommendations.slice(1, 3).map((alt: CardRecommendationItem) => (
                      <div
                        key={alt.account_id}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">{alt.account_name}</p>
                          <p className="text-[11px] text-slate-400">
                            Khả dụng: {formatCurrency(alt.live_available_limit)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-300 font-mono">
                            {Number(alt.reward_rate_percent)}%
                          </span>
                          <p className="text-[10px] text-slate-400">
                            ~{formatCurrency(alt.estimated_reward_amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
