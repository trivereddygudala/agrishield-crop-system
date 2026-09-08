import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastIdCounter = 0;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-100',
  error: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-100',
  warning: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-100',
  info: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/80 dark:border-sky-800 dark:text-sky-100',
};

const ICON_STYLES = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-rose-600 dark:text-rose-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
};

const ToastItem = ({ toast, onDismiss }) => {
  const Icon = ICONS[toast.type] || Info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md w-full sm:max-w-sm pointer-events-auto ${STYLES[toast.type]}`}
      role="status"
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${ICON_STYLES[toast.type]}`} />
      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-sm font-bold leading-tight">{toast.title}</p>}
        {toast.message && <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{toast.message}</p>}
        {toast.action && (
          <button
            onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}
            className="mt-1.5 text-[10px] font-bold underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5 opacity-50" />
      </button>
    </motion.div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000, action }) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message, action }]);

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }, [dismiss]);

  const toast = {
    success: (title, message, opts) => addToast({ type: 'success', title, message, ...opts }),
    error: (title, message, opts) => addToast({ type: 'error', title, message, duration: 6000, ...opts }),
    warning: (title, message, opts) => addToast({ type: 'warning', title, message, ...opts }),
    info: (title, message, opts) => addToast({ type: 'info', title, message, ...opts }),
    dismiss,
  };

  // Monitor Network Connectivity (Offline-First Toast Banner)
  React.useEffect(() => {
    const handleOnline = () => {
      toast.success(
        "🌐 Online Mode",
        "Your connection has been restored successfully!"
      );
    };

    const handleOffline = () => {
      toast.warning(
        "⚠️ Offline Mode",
        "Working from cache. Scans and predictions will be queued locally.",
        { duration: 0 } // Permanent until offline status ends or user dismisses
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on load
    if (!navigator.onLine) {
      // Small delay to allow react components to fully mount/bind context
      setTimeout(handleOffline, 1000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-auto sm:max-w-sm z-[99999] flex flex-col gap-2 pointer-events-none items-center sm:items-end"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for components rendered outside provider
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
};
