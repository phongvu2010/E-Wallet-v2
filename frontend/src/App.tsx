import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Spinner } from "./components/common/Spinner";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { QueryProvider } from "./providers/QueryProvider";
import { ToastProvider } from "./context/ToastContext";

// Lazy-loaded dashboard pages for code-splitting & optimal initial bundle size
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const AccountsPage = lazy(() =>
  import("./pages/AccountsPage").then((m) => ({ default: m.AccountsPage }))
);
const TransactionsPage = lazy(() =>
  import("./pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage }))
);
const StatementsPage = lazy(() =>
  import("./pages/StatementsPage").then((m) => ({ default: m.StatementsPage }))
);
const InstallmentsPage = lazy(() =>
  import("./pages/InstallmentsPage").then((m) => ({ default: m.InstallmentsPage }))
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))
);
const RewardsPage = lazy(() =>
  import("./pages/RewardsPage").then((m) => ({ default: m.RewardsPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

const PageFallback: React.FC = () => (
  <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
    <Spinner size="lg" />
    <p className="text-sm text-slate-400 font-medium">Đang tải trang...</p>
  </div>
);

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route
                  index
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="accounts"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AccountsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="transactions"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <TransactionsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="statements"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <StatementsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="installments"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <InstallmentsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AnalyticsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="rewards"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <RewardsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SettingsPage />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};
