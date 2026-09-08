import React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = {
  default: "bg-slate-200 text-slate-800 border-slate-400/60 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700",
  success: "bg-emerald-100 text-emerald-900 border-emerald-400/80 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-600/80 shadow-sm shadow-emerald-500/10 font-bold",
  healthy: "bg-emerald-500/20 text-emerald-800 border-emerald-400/80 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500/80 shadow-sm shadow-emerald-500/20 font-bold",
  diseased: "bg-rose-500/20 text-rose-800 border-rose-400/80 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-500/80 shadow-sm shadow-rose-500/20 font-bold",
  agrochemical: "bg-sky-100 text-sky-900 border-sky-400/80 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-600/80 shadow-sm shadow-sky-500/10 font-bold",
  warning: "bg-amber-100 text-amber-900 border-amber-400/80 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-600/80 shadow-sm shadow-amber-500/10 font-bold",
  purple: "bg-purple-100 text-purple-900 border-purple-400/80 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-600/80 shadow-sm shadow-purple-500/10 font-bold",
  cyan: "bg-cyan-100 text-cyan-900 border-cyan-400/80 dark:bg-cyan-950/80 dark:text-cyan-200 dark:border-cyan-600/80 shadow-sm shadow-cyan-500/10 font-bold",
  outline: "border-slate-400/80 text-slate-800 bg-transparent dark:border-slate-600 dark:text-slate-200 font-semibold",
  glass: "bg-white/20 text-white border-white/35 backdrop-blur-md shadow-sm font-bold",
  "glow-emerald": "bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)] font-bold",
  "glow-rose": "bg-rose-500/20 text-rose-300 border-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.25)] font-bold",
  "glow-amber": "bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)] font-bold",
  "glow-sky": "bg-sky-500/20 text-sky-300 border-sky-400/50 shadow-[0_0_12px_rgba(14,165,233,0.25)] font-bold",
  "glow-purple": "bg-purple-500/20 text-purple-300 border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.25)] font-bold"
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
