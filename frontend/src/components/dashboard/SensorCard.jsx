import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/index';

const SensorCard = ({ title, value, unit, icon: Icon, trend, trendValue, color, delay = 0 }) => {
  const isPositive = trend === 'up';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="h-full"
    >
      <Card 
        glass 
        className="p-4 rounded-2xl relative overflow-hidden group border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] backdrop-blur-md transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 h-full flex flex-col justify-between"
      >
        {/* Glow on hover */}
        <div 
          className="absolute -right-10 -top-10 w-28 h-28 rounded-full opacity-10 blur-2xl group-hover:opacity-25 transition-opacity duration-500 pointer-events-none"
          style={{ backgroundColor: color }}
        />

        <div className="flex justify-between items-start relative z-10">
          <div 
            className="p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 transition-colors shadow-xs"
            style={{ 
              backgroundColor: `${color}12`, 
              borderColor: `${color}25` 
            }}
          >
            <Icon className="w-5 h-5 shrink-0" style={{ color }} />
          </div>
          
          {trendValue && (
            <div className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${
              isPositive 
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
            }`}>
              {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {trendValue}
            </div>
          )}
        </div>

        <div className="space-y-1 relative z-10 mt-4 flex-1 flex flex-col justify-end">
          <h3 className="text-slate-500 dark:text-white/40 text-[10px] font-bold uppercase tracking-wider">{title}</h3>
          <div className="flex items-baseline gap-0.5 flex-wrap">
            <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
              {value}
            </span>
            <span className="text-xs font-extrabold text-slate-500 dark:text-white/40 leading-none">
              {unit}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default SensorCard;
