import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../utils/formatters";
import { InstallmentForecast } from "../../types/installment";

interface InstallmentForecastChartProps {
  data: InstallmentForecast[];
}

export const InstallmentForecastChart: React.FC<InstallmentForecastChartProps> = ({
  data,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        Hiện không có khoản trả góp nào cần thanh toán trong tương lai
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="colorInstallment" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="billing_month" stroke="#64748b" fontSize={11} tickLine={false} />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            tickFormatter={(val) => `${(val / 1000000).toFixed(1)}Tr`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs">
                    <p className="font-semibold text-slate-200">
                      Kỳ {item.billing_month} ({item.active_plans_count} gói)
                    </p>
                    <p className="font-mono text-purple-400 font-bold mt-1">
                      Tổng tiền: {formatCurrency(item.total_monthly_payment)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gốc: {formatCurrency(item.total_principal_due)} | Lãi/Phí:{" "}
                      {formatCurrency(item.total_interest_due)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="total_monthly_payment"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorInstallment)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
