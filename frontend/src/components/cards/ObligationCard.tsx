import React from "react";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { UpcomingObligation } from "../../types/analytics";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { Calendar, Clock } from "lucide-react";
import { clsx } from "clsx";

interface ObligationCardProps {
  obligation: UpcomingObligation;
}

export const ObligationCard: React.FC<ObligationCardProps> = ({ obligation }) => {
  const isUrgent = obligation.days_remaining <= 5;

  return (
    <Card
      hover
      className={clsx(
        "p-4 flex items-center justify-between transition-all",
        isUrgent ? "border-amber-500/30 bg-amber-500/5" : ""
      )}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={clsx(
            "p-3 rounded-xl border flex items-center justify-center",
            obligation.obligation_type === "STATEMENT"
              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
              : "bg-purple-500/10 text-purple-400 border-purple-500/20"
          )}
        >
          {obligation.obligation_type === "STATEMENT" ? (
            <Calendar className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-400">
              {obligation.obligation_type === "STATEMENT" ? "Kỳ Sao Kê" : "Trả Góp"}
            </span>
            <Badge
              variant={
                obligation.payment_status === "PAID"
                  ? "success"
                  : isUrgent
                  ? "warning"
                  : "neutral"
              }
              size="sm"
            >
              {obligation.payment_status}
            </Badge>
          </div>
          <h4 className="text-sm font-semibold text-slate-200 mt-0.5">
            {obligation.account_name}
          </h4>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <span>Hạn: {formatDate(obligation.due_date)}</span>
            <span>•</span>
            <span className={isUrgent ? "text-amber-400 font-medium" : ""}>
              Còn {obligation.days_remaining} ngày
            </span>
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xs text-slate-400">Số tiền phải trả</p>
        <p className="text-base font-bold text-slate-100 font-mono mt-0.5">
          {formatCurrency(obligation.total_amount_due)}
        </p>
        {Number(obligation.minimum_amount_due) > 0 &&
          Number(obligation.minimum_amount_due) !== Number(obligation.total_amount_due) && (
            <p className="text-[11px] text-slate-400">
              Tối thiểu: {formatCurrency(obligation.minimum_amount_due)}
            </p>
          )}
      </div>
    </Card>
  );
};
