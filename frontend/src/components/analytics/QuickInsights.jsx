import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';

const QuickInsights = ({ insights }) => {
  const { t } = useTranslation();
  if (!insights || insights.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-full">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{t('analytics.quick_insights', 'Quick Insights')}</h3>
      <div className="space-y-4">
        {insights.map((insight, idx) => {
          const IconComponent = Icons[insight.icon] || Icons.Lightbulb;
          
          // Map backend colors to tailwind classes
          const colorMap = {
            green: 'bg-emerald-100 text-emerald-600',
            red: 'bg-rose-100 text-rose-600',
            blue: 'bg-blue-100 text-blue-600',
            purple: 'bg-purple-100 text-purple-600',
            orange: 'bg-orange-100 text-orange-600',
            default: 'bg-slate-100 text-slate-600'
          };
          
          const iconColorClass = colorMap[insight.color] || colorMap.default;

          return (
            <motion.div 
              key={insight.id || idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50"
            >
              <div className={`p-2 rounded-lg shrink-0 ${iconColorClass}`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{insight.title}</p>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-base font-semibold text-slate-800 dark:text-slate-200">{insight.value}</span>
                  {insight.unit && <span className="text-xs text-slate-500 dark:text-slate-400">{insight.unit}</span>}
                </div>
                {insight.description && (
                  <p className="text-xs text-slate-400 mt-1">{insight.description}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default QuickInsights;
