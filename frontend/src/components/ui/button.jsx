import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variantStyles = {
  primary: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm shadow-emerald-600/25 border border-emerald-500/30 dark:bg-emerald-600 dark:hover:bg-emerald-500 font-semibold",
  gradient: "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/40 font-bold",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700",
  outline: "border border-slate-300 hover:border-emerald-500/60 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:border-emerald-500/40 dark:hover:text-emerald-400",
  ghost: "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100",
  danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/25 border border-rose-500/30 dark:bg-rose-600 dark:hover:bg-rose-500 font-semibold",
  success: "bg-green-600 hover:bg-green-500 text-white shadow-sm shadow-green-600/25 border border-green-500/30 dark:bg-green-600 dark:hover:bg-green-500 font-semibold",
  sky: "bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/25 border border-sky-500/30 dark:bg-sky-600 dark:hover:bg-sky-500 font-semibold",
  amber: "bg-amber-500 hover:bg-amber-400 text-white shadow-sm shadow-amber-500/25 border border-amber-400/30 dark:bg-amber-600 dark:hover:bg-amber-500 font-semibold",
  indigo: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/25 border border-indigo-500/30 dark:bg-indigo-600 dark:hover:bg-indigo-500 font-semibold",
  glass: "bg-white/80 hover:bg-white text-slate-800 border border-slate-200/90 shadow-sm backdrop-blur-md dark:bg-slate-900/80 dark:hover:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700/80"
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-base rounded-2xl gap-2.5 font-semibold",
  icon: "p-2.5 rounded-xl text-sm justify-center",
};

const Button = React.forwardRef(
  ({ className, variant = "primary", size = "md", isLoading = false, disabled, children, leftIcon, rightIcon, ...props }, ref) => {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return (
      <motion.button
        ref={ref}
        whileTap={disabled || isLoading || prefersReducedMotion ? undefined : { scale: 0.98 }}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed select-none",
          variantStyles[variant] || variantStyles.primary,
          sizeStyles[size] || sizeStyles.md,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button };
