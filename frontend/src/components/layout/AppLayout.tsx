import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Clock,
  CreditCard,
  LayoutDashboard,
  Menu,
  Receipt,
} from "lucide-react";
import { clsx } from "clsx";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { AICopilotDrawer } from "../ai/AICopilotDrawer";

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Tổng quan Tài chính", subtitle: "Dư nợ tức thời, hạn mức khả dụng và chỉ số tín dụng" },
  "/accounts": { title: "Quản lý Thẻ & Hạn mức", subtitle: "Chi tiết các thẻ tín dụng và đối soát hạn mức khả dụng" },
  "/transactions": { title: "Sổ cái Giao dịch Thẻ", subtitle: "Lịch sử chi tiêu, thanh toán nợ, hoàn tiền và phí thẻ" },
  "/statements": { title: "Sao kê & Đối soát Dư nợ", subtitle: "Đối chiếu số dư thực tế vs sao kê ngân hàng" },
  "/installments": { title: "Gói Trả góp & Dự phóng Dòng tiền", subtitle: "Lịch biểu trả góp từng kỳ và tất toán trước hạn" },
  "/analytics": { title: "Báo cáo Phân tích Chuyên sâu", subtitle: "Cơ cấu chi tiêu danh mục và đánh giá rủi ro tín dụng" },
  "/rewards": { title: "Điểm thưởng & Hoàn tiền", subtitle: "Theo dõi Shinhan Point, Cashback và hạn sử dụng" },
  "/settings": { title: "Cài đặt & Đồng bộ ETL", subtitle: "Đồng bộ tệp Excel/PDF và quản lý quy tắc Merchant" },
};

const mobileBottomTabs = [
  { path: "/", label: "Tổng quan", icon: LayoutDashboard },
  { path: "/accounts", label: "Thẻ & Hạn mức", icon: CreditCard },
  { path: "/transactions", label: "Sổ cái", icon: Receipt },
  { path: "/installments", label: "Trả góp", icon: Clock },
];

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const currentMeta = routeTitles[location.pathname] || {
    title: "Credit Wallet 2.0",
    subtitle: "Quản lý tài chính cá nhân",
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Sidebar Drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pb-20 lg:pb-0">
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed bottom for one-hand mobile navigation) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-2xl shadow-slate-950"
      >
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={clsx(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[60px]",
                isActive
                  ? "text-emerald-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <div
                className={clsx(
                  "p-1 rounded-lg transition-colors",
                  isActive ? "bg-emerald-500/15" : "bg-transparent"
                )}
              >
                <Icon className={clsx("w-5 h-5", isActive ? "stroke-[2.5]" : "stroke-[1.75]")} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* Menu / Drawer Toggle Button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className={clsx(
            "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-w-[60px]",
            sidebarOpen ? "text-emerald-400 font-semibold" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-5 h-5 stroke-[1.75]" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Menu</span>
        </button>
      </nav>

      {/* Global AI Financial Copilot */}
      <AICopilotDrawer />
    </div>
  );
};
