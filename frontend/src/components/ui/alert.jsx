import React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

const alertVariants = {
  info: {
    container: "bg-sky-50 border-sky-300 text-sky-950 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-200",
    icon: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />,
  },
  success: {
    container: "bg-emerald-50 border-emerald-300 text-emerald-950 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
  },
  warning: {
    container: "bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200",
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
  },
  danger: {
    container: "bg-rose-50 border-rose-300 text-rose-950 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200",
    icon: <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
  },
};

const Alert = ({ className, variant = "info", title, children, onClose }) => {
  const currentVariant = alertVariants[variant] || alertVariants.info;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-2xl border transition-all text-sm relative",
        currentVariant.container,
        className
      )}
    >
      {currentVariant.icon}
      <div className="flex-1">
        {title && <h4 className="font-bold mb-0.5">{title}</h4>}
        <div className="text-xs opacity-90">{children}</div>
      </div>
    </div>
  );
};

export { Alert };
