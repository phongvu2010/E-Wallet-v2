import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
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

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const currentMeta = routeTitles[location.pathname] || {
    title: "Credit Wallet 2.0",
    subtitle: "Quản lý tài chính cá nhân",
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
        />
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
          <Outlet />
        </main>
      </div>

      {/* Global AI Financial Copilot */}
      <AICopilotDrawer />
    </div>
  );
};
