import React from "react";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { clsx } from "clsx";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  badgeText?: string;
  badgeVariant?: "success" | "danger" | "warning" | "info" | "neutral" | "purple";
  progress?: number; // 0 to 100
  progressColor?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  badgeVariant = "neutral",
  progress,
  progressColor = "bg-emerald-500",
  className,
}) => {
  return (
    <Card hover className={clsx("relative overflow-hidden group", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-slate-100 mt-2 font-sans tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-slate-200 shadow-inner group-hover:scale-105 transition-transform">
          {icon}
        </div>
      </div>

      {badgeText && (
        <div className="mt-4 flex items-center justify-between">
          <Badge variant={badgeVariant} size="sm">
            {badgeText}
          </Badge>
          {progress !== undefined && (
            <span className="text-xs font-mono text-slate-400">
              {progress.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {progress !== undefined && (
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </Card>
  );
};
