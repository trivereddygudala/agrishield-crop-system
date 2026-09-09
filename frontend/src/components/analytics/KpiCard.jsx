import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Card } from '../ui/index';

const KpiCard = ({ title, value, description, iconName, colorClass, delay = 0 }) => {
  const IconComponent = Icons[iconName] || Icons.HelpCircle;
  
  return (
    <Card 
      glass 
      hover 
      className="p-5 rounded-2xl border-slate-200/80 dark:border-slate-800 flex flex-col justify-between"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">{value}</h3>
          {description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium pt-1">{description}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${colorClass}`}>
          <IconComponent className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
};

export default KpiCard;
