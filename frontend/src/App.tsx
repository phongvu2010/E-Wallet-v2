import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { StatementsPage } from "./pages/StatementsPage";
import { InstallmentsPage } from "./pages/InstallmentsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { RewardsPage } from "./pages/RewardsPage";
import { SettingsPage } from "./pages/SettingsPage";

import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { QueryProvider } from "./providers/QueryProvider";
import { ToastProvider } from "./context/ToastContext";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="statements" element={<StatementsPage />} />
                <Route path="installments" element={<InstallmentsPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="rewards" element={<RewardsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};
