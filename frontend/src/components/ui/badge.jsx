import React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  default: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700",
  success: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-600/80 shadow-xs font-bold",
  healthy: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500/80 shadow-xs font-bold",
  diseased: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-500/80 shadow-xs font-bold",
  agrochemical: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-600/80 shadow-xs font-bold",
  warning: "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-600/80 shadow-xs font-bold",
  purple: "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-600/80 shadow-xs font-bold",
  cyan: "bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-600/80 shadow-xs font-bold",
  outline: "border-slate-300 text-slate-800 bg-white dark:bg-transparent dark:border-slate-600 dark:text-slate-200 font-semibold",
  glass: "bg-slate-100/90 text-slate-800 border-slate-300 dark:bg-white/20 dark:text-white dark:border-white/35 backdrop-blur-md shadow-xs font-bold",
  "glow-emerald": "bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/50 font-bold",
  "glow-rose": "bg-rose-100 text-rose-900 border-rose-300 shadow-xs dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/50 font-bold",
  "glow-amber": "bg-amber-100 text-amber-950 border-amber-300 shadow-xs dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/50 font-bold",
  "glow-sky": "bg-sky-100 text-sky-900 border-sky-300 shadow-xs dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/50 font-bold",
  "glow-purple": "bg-purple-100 text-purple-950 border-purple-300 shadow-xs dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-400/50 font-bold"
};

const Badge = ({ className, variant = "default", dot = false, icon, children, ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {icon}
      {children}
    </span>
  );
};

export { Badge };
