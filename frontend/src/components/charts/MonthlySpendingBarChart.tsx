import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatDate } from "../../utils/formatters";

interface MonthlySpendingItem {
  month: string;
  total_spending: number;
}

interface MonthlySpendingBarChartProps {
  data: MonthlySpendingItem[];
}

export const MonthlySpendingBarChart: React.FC<MonthlySpendingBarChartProps> = ({
  data,
}) => {
  const chartData = [...data].reverse().map((item) => ({
    ...item,
    formattedMonth: formatDate(item.month, "MM/yyyy"),
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        Chưa có dữ liệu lịch sử chi tiêu
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="formattedMonth"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`}
          />
          <Tooltip
            cursor={{ fill: "#1e293b", opacity: 0.4 }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs">
                    <p className="font-semibold text-slate-200">
                      Tháng {item.formattedMonth}
                    </p>
                    <p className="font-mono text-emerald-400 font-bold mt-1">
                      {formatCurrency(item.total_spending)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="total_spending"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
