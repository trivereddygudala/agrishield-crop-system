import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const Progress = ({ value = 0, max = 100, className, barClassName, label, showValue = false, labelClassName }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full flex flex-col space-y-1.5">
      {(label || showValue) && (
        <div className={cn("flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300", labelClassName)}>
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        className={cn(
          "w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden relative",
          className
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn("h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full", barClassName)}
        />
      </div>
    </div>
  );
};

export { Progress };

