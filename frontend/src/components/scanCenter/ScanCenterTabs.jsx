import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Sprout, Bug, FlaskConical } from 'lucide-react';
import { Badge } from '../ui/index';

const TABS = [
  {
    id: 'disease-diag',
    labelKey: 'tabs.disease_diag',
    label: 'Disease Diagnosis',
    icon: Bug,
    descKey: 'tabs.disease_diag_desc',
    description: 'Detect fungal, bacterial & viral crop pathologies',
    badgeKey: 'tabs.badges.pytorch',
    badge: 'PyTorch AI',
    color: 'emerald'
  },
  {
    id: 'plant-id',
    labelKey: 'tabs.plant_id',
    label: 'Plant Identification',
    icon: Sprout,
    descKey: 'tabs.plant_id_desc',
    description: 'Identify crop variety, botanical species & growth traits',
    badgeKey: 'tabs.badges.species',
    badge: 'Species Engine',
    color: 'teal'
  },
  {
    id: 'agro-scan',
    labelKey: 'tabs.agro_scan',
    label: 'Agrochemical Scanner',
    icon: FlaskConical,
    descKey: 'tabs.agro_scan_desc',
    description: 'Scan pesticides, fungicides & fertilizer product labels',
    badgeKey: 'tabs.badges.ocr',
    badge: 'OCR Vision',
    color: 'sky'
  }
];

const ScanCenterTabs = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();
  return (
    <div 
      role="tablist" 
      aria-label="AI Scan Modules" 
      className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/90 dark:bg-slate-900/60 p-3 rounded-[24px] border border-slate-200 dark:border-white/10 backdrop-blur-md shadow-sm"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const colorsMap = {
          emerald: 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30',
          teal: 'text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/30',
          sky: 'text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/30'
        };

        return (
          <motion.button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`flex flex-col text-left p-5 rounded-2xl transition-all duration-300 relative overflow-hidden focus:outline-none ${
              isActive
                ? 'bg-white dark:bg-white/[0.04] shadow-md border-2 border-emerald-500 dark:border-emerald-500/50 z-10'
                : 'hover:bg-white dark:hover:bg-white/[0.02] text-slate-700 dark:text-white/60 border border-slate-200 dark:border-white/5 bg-slate-50/60 dark:bg-transparent'
            }`}
          >
            {isActive && (
              <motion.div 
                layoutId="activeTabGlow"
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" 
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}

            <div className="flex items-center justify-between mb-3 w-full relative z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-colors border ${
                  isActive 
                    ? colorsMap[tab.color]
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-transparent text-slate-600 dark:text-white/30 shadow-xs'
                }`}>
                  <Icon className="w-5 h-5 shrink-0" />
                </div>
                <span className={`font-black text-base tracking-tight ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-white/70'}`} style={{ fontFamily: 'var(--font-display)' }}>
                  {t(tab.labelKey, tab.label)}
                </span>
              </div>
              <Badge variant={isActive ? "healthy" : "default"} className="text-[9px] uppercase tracking-wider font-extrabold shrink-0">
                {tab.badgeKey ? t(tab.badgeKey, tab.badge) : tab.badge}
              </Badge>
            </div>

            <p className={`text-xs sm:text-sm leading-relaxed relative z-10 ${isActive ? 'text-slate-600 dark:text-white/60 font-medium' : 'text-slate-600 dark:text-white/40'}`}>
              {t(tab.descKey, tab.description)}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
};

export default ScanCenterTabs;
