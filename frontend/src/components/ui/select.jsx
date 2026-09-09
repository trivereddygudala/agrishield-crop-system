import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const Select = React.forwardRef(
  ({ className, children, options, error, label, helperText, leftIcon, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-slate-800 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 text-slate-500 dark:text-slate-500 pointer-events-none z-10">
              {leftIcon}
            </div>
          )}
          <select
            ref={ref}
            className={cn(
              "w-full appearance-none rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm font-semibold text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 cursor-pointer shadow-xs",
              error ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 hover:border-slate-400 focus:border-emerald-600 dark:border-slate-800 dark:hover:border-slate-700",
              leftIcon && "pl-10",
              className
            )}
            {...props}
          >
            {options && options.length > 0
              ? options.map((opt, idx) => {
                  const val = typeof opt === "object" ? opt.value : opt;
                  const lbl = typeof opt === "object" ? opt.label : opt;
                  return (
                    <option key={idx} value={val} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                      {lbl}
                    </option>
                  );
                })
              : children}
          </select>
          <div className="absolute right-3 text-slate-500 dark:text-slate-400 pointer-events-none">
            <ChevronDown className="w-4 h-4" />
          </div>
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
Select.displayName = "Select";

export { Select };
