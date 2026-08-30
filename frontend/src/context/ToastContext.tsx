import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { clsx } from "clsx";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, type, message, title, duration };
    setToasts((prev) => [...prev.slice(-4), newToast]); // keep maximum 5 active toasts

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (message: string, title?: string) => addToast("success", message, title),
    error: (message: string, title?: string) => addToast("error", message, title, 5000),
    warning: (message: string, title?: string) => addToast("warning", message, title),
    info: (message: string, title?: string) => addToast("info", message, title),
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {/* Toast Container rendered in portal/top-right */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
      case "info":
        return <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case "success":
        return "border-emerald-500/30 bg-slate-900/95 shadow-emerald-950/20";
      case "error":
        return "border-rose-500/30 bg-slate-900/95 shadow-rose-950/20";
      case "warning":
        return "border-amber-500/30 bg-slate-900/95 shadow-amber-950/20";
      case "info":
        return "border-sky-500/30 bg-slate-900/95 shadow-sky-950/20";
    }
  };

  return (
    <div
      className={clsx(
        "pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-3 fade-in-0",
        getColors()
      )}
    >
      {getIcon()}
      <div className="flex-1 min-w-0 pr-1">
        {toast.title && (
          <h4 className="text-xs font-bold text-slate-100 tracking-tight mb-0.5">
            {toast.title}
          </h4>
        )}
        <p className="text-xs text-slate-300 leading-relaxed break-words font-medium">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-1 -mr-1 -mt-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800/60 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
