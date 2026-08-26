import React, { useEffect, useState } from "react";
import { etlService } from "../services/etlService";
import { categoryService } from "../services/categoryService";
import { CategoryTreeNode } from "../types/category";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Spinner } from "../components/common/Spinner";
import {
  Settings,
  RefreshCw,
  FolderTree,
  Database,
  CheckCircle2,
  Terminal,
} from "lucide-react";

export const SettingsPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  // ETL Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncOutput, setSyncOutput] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await categoryService.getTree();
      setCategories(res);
    } catch (err) {
      console.error("Error loading categories", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus("idle");
    setSyncOutput("Bắt đầu thực thi ETL Migration script từ Excel và PDF...");
    try {
      const res = await etlService.sync();
      if (res.success) {
        setSyncStatus("success");
        setSyncOutput(res.data.output || "Đồng bộ thành công!");
      } else {
        setSyncStatus("error");
        setSyncOutput(res.message + "\n" + (res.data.output || ""));
      }
    } catch (err: any) {
      setSyncStatus("error");
      setSyncOutput(`Lỗi thực thi: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>Cài Đặt Hệ Thống & Đồng Bộ Dữ Liệu ETL</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Quản lý cây danh mục thu chi và công cụ nạp dữ liệu tự động từ tệp sao kê
        </p>
      </div>

      {/* 2. ETL Sync Panel */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Đồng Bộ Dữ Liệu Tự Động (ETL Migration)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Đọc dữ liệu từ file <b>data/My Credit Wallet 2.0.xlsx</b> và các tệp sao kê PDF trong thư mục data/
            </p>
          </div>

          <Button
            variant="primary"
            onClick={handleTriggerSync}
            isLoading={isSyncing}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {isSyncing ? "Đang Đồng Bộ..." : "Chạy Đồng Bộ Ngay"}
          </Button>
        </div>

        {/* Terminal Output */}
        {syncOutput && (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-60 overflow-y-auto space-y-1">
            <div className="flex items-center gap-2 text-slate-500 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4" />
              <span>ETL Console Output:</span>
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed">{syncOutput}</pre>
          </div>
        )}
      </Card>

      {/* 3. Category Tree */}
      <Card>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-sky-400" />
              <span>Cây Danh Mục Thu Chi Phân Cấp (2 Cấp)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cấu trúc danh mục phục vụ báo cáo và phân loại giao dịch tự động
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((parent) => (
              <div
                key={parent.id}
                className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-200">{parent.name}</h4>
                  <Badge variant="info" size="sm">
                    {parent.category_type}
                  </Badge>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  {parent.children && parent.children.length > 0 ? (
                    parent.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-800/40 text-slate-300"
                      >
                        <span>• {child.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {child.is_system ? "System" : "Custom"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 italic">Không có mục con</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4. Connection & Environment Details */}
      <Card>
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
          <Database className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Thông Tin Môi Trường Hệ Thống</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Database Engine</p>
            <p className="font-bold text-slate-200 mt-1">PostgreSQL 16-alpine</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Backend API</p>
            <p className="font-bold text-slate-200 mt-1">FastAPI 0.115+ / Python 3.14</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Frontend Stack</p>
            <p className="font-bold text-slate-200 mt-1">React 18 + Vite + Tailwind</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <p className="text-slate-400">Security Layer</p>
            <p className="font-bold text-emerald-400 mt-1">Supabase & RLS Ready</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
