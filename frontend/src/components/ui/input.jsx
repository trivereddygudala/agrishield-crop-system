import React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(
  ({ className, type = "text", error, leftIcon, rightIcon, label, helperText, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 text-slate-500 dark:text-slate-500 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              "w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
              error ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 hover:border-slate-400 focus:border-emerald-600 dark:border-slate-800 dark:hover:border-slate-700",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-slate-500 dark:text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <span className="text-xs font-semibold text-rose-600 mt-0.5">{error}</span>
        )}
        {helperText && !error && (
          <span className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">{helperText}</span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

const Textarea = React.forwardRef(
  ({ className, error, label, helperText, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 min-h-[100px]",
            error ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 hover:border-slate-400 focus:border-emerald-600 dark:border-slate-800 dark:hover:border-slate-700",
            className
          )}
          {...props}
        />
        {error && (
          <span className="text-xs font-semibold text-rose-600 mt-0.5">{error}</span>
        )}
        {helperText && !error && (
          <span className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">{helperText}</span>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
