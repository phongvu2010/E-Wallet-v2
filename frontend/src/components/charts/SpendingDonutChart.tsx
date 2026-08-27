import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "../../utils/formatters";

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

interface SpendingDonutChartProps {
  data: ChartDataItem[];
  totalAmount: number;
}

const COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
];

export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({
  data,
  totalAmount,
}) => {
  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || COLORS[index % COLORS.length],
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        Chưa có dữ liệu chi tiêu trong kỳ
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full justify-between">
      <div className="w-full h-52 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0];
                  const percent = totalAmount > 0 ? ((Number(item.value) / totalAmount) * 100).toFixed(1) : 0;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs">
                      <p className="font-semibold text-slate-200">{item.name}</p>
                      <p className="font-mono text-emerald-400 font-bold mt-1">
                        {formatCurrency(Number(item.value))} ({percent}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <p className="text-[10px] text-slate-400 font-medium">Tổng Chi Tiêu</p>
          <p className="text-xs font-bold text-slate-100 font-mono mt-0.5">
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      {/* Custom Grid Legend */}
      <div className="w-full grid grid-cols-2 gap-x-3 gap-y-2 px-1 mt-3">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[11px] min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-300 font-medium truncate" title={item.name}>
              {item.name}
            </span>
            <span className="font-mono text-slate-400 ml-auto shrink-0">
              {totalAmount > 0 ? ((item.value / totalAmount) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
