import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const Card = React.forwardRef(({ className, glass = false, hover = false, ...props }, ref) => {
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Component = hover && !prefersReducedMotion ? motion.div : "div";
  const hoverAnimation = hover && !prefersReducedMotion ? { 
    whileHover: { y: -4, transition: { duration: 0.25, ease: "easeOut" } }, 
    whileTap: { scale: 0.99 } 
  } : {};

  return (
    <Component
      ref={ref}
      className={cn(
        "rounded-[18px] border border-slate-200 bg-white text-slate-900 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-300 dark:bg-[#0d1527]/95 dark:text-slate-100 dark:border-slate-800/90 dark:shadow-sm",
        glass && "glass-card",
        hover && "cursor-pointer hover:border-emerald-500/60 hover:shadow-md dark:hover:border-emerald-500/40",
        className
      )}
      {...hoverAnimation}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    style={{ fontFamily: 'var(--font-display)' }}
    className={cn(
      "text-lg font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium leading-relaxed", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 border-t border-slate-100 dark:border-slate-800/80 mt-4", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
