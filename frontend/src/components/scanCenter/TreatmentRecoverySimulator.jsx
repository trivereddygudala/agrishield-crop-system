import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkles, Calendar, CheckCircle2, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, Badge, Button } from '../ui/index';
import { getRecoveryStageData } from '../../utils/regionalLocale';

export default function TreatmentRecoverySimulator({ cropName = 'Crop', diseaseName = 'Disease Condition' }) {
  const { t, i18n } = useTranslation();
  const [activeDay, setActiveDay] = useState(0);

  const stages = [
    {
      day: 0,
      title: "Day 0: Acute Infection Active",
      badge: "Infection Active",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      leafColor: "from-amber-600/40 via-rose-900/60 to-emerald-950/80",
      lesionOpacity: 1.0,
      chlorophyllLevel: 45,
    },
    {
      day: 5,
      title: "Day 5: Pathogen Containment",
      badge: "Spread Halted",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      leafColor: "from-amber-700/30 via-slate-800/60 to-emerald-950/80",
      lesionOpacity: 0.6,
      chlorophyllLevel: 62,
    },
    {
      day: 12,
      title: "Day 12: Foliar Regeneration",
      badge: "Shoot Regrowth",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
      leafColor: "from-emerald-600/20 via-emerald-800/50 to-emerald-950/90",
      lesionOpacity: 0.25,
      chlorophyllLevel: 80,
    },
    {
      day: 20,
      title: "Day 20: Full Canopy Restoration",
      badge: "Harvest Protected",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      leafColor: "from-emerald-500/30 via-emerald-700/50 to-emerald-900/90",
      lesionOpacity: 0.05,
      chlorophyllLevel: 96,
    }
  ];

  const currentStage = stages.find(s => s.day === activeDay) || stages[0];
  const lang = i18n.language || 'en';
  const stageData = getRecoveryStageData(currentStage.day, lang);

  const getLocalizedBadge = (stage) => {
    return getRecoveryStageData(stage.day, lang).badge;
  };

  return (
    <Card className="p-5 sm:p-7 border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/80 shadow-xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {t('results.recovery_prognosis', 'AI Prognosis Simulator')}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-white/40 font-semibold">
              {t('results.treatment_horizon', '20-Day Treatment Horizon')}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
            {t('results.recovery_simulator', 'Prescriptive Treatment & Foliar Recovery Simulator')}
          </h3>
        </div>

        <Badge variant="glass" className={`px-3 py-1 text-xs font-black uppercase border ${currentStage.badgeColor}`}>
          {getLocalizedBadge(currentStage)}
        </Badge>
      </div>

      {/* Interactive Timeline Stepper */}
      <div className="pt-5 pb-3">
        <div className="grid grid-cols-4 gap-2">
          {stages.map((stage) => {
            const isSelected = activeDay === stage.day;
            return (
              <button
                key={stage.day}
                type="button"
                onClick={() => setActiveDay(stage.day)}
                className={`py-2 px-1 sm:px-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/30 scale-102 font-black'
                    : 'bg-white/60 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-emerald-500/40 font-bold'
                }`}
              >
                <span className="text-xs sm:text-sm block">{t(`results.day_${stage.day}`, `Day ${stage.day}`)}</span>
                <span className="text-[10px] opacity-80 hidden sm:block truncate">{getLocalizedBadge(stage)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Simulation Display Box */}
      <div className="mt-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-white/10 text-white space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Simulated Foliar Health Canvas */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center shadow-2xl shrink-0 bg-black">
            {/* Background foliar gradient reflecting chlorophyll recovery */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${currentStage.leafColor} transition-all duration-700`} />
            
            {/* Simulated leaf silhouette & veins */}
            <svg viewBox="0 0 100 100" className="w-36 h-36 relative z-10 drop-shadow-md">
              <path
                d="M50 10 C 25 35, 20 70, 50 90 C 80 70, 75 35, 50 10 Z"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
              />
              <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
              <line x1="50" y1="35" x2="32" y2="48" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <line x1="50" y1="35" x2="68" y2="48" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <line x1="50" y1="55" x2="30" y2="68" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <line x1="50" y1="55" x2="70" y2="68" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

              {/* Lesion spots with dynamic opacity */}
              <circle cx="42" cy="42" r="6" fill="#b91c1c" opacity={currentStage.lesionOpacity} />
              <circle cx="58" cy="50" r="8" fill="#991b1b" opacity={currentStage.lesionOpacity} />
              <circle cx="38" cy="65" r="5" fill="#7f1d1d" opacity={currentStage.lesionOpacity} />
              <circle cx="62" cy="32" r="4.5" fill="#dc2626" opacity={currentStage.lesionOpacity} />
            </svg>

            {/* Chlorophyll Gauge Badge */}
            <div className="absolute bottom-2 inset-x-2 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 flex items-center justify-between text-[11px] font-bold z-20">
              <span className="text-slate-300">{t('results.chlorophyll_vigor', 'Chlorophyll Vigor')}</span>
              <span className="text-emerald-400 font-extrabold">{currentStage.chlorophyllLevel}%</span>
            </div>
          </div>

          {/* Clinical Details */}
          <div className="space-y-3 flex-1">
            <h4 className="text-base sm:text-lg font-black text-emerald-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              {stageData.title}
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              {stageData.desc}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">{t('results.lesion_activity', 'Lesion Activity')}</span>
                <span className="font-extrabold text-white">
                  {activeDay === 0 ? t('results.active_high', 'Active (High)') : activeDay === 5 ? t('results.active_moderate', 'Desiccating') : t('results.active_low', 'Arrested (Zero)')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">{t('results.photosynthetic_capacity', 'Photosynthetic Capacity')}</span>
                <span className="font-extrabold text-emerald-400">
                  {currentStage.chlorophyllLevel}% {t('results.restored', 'Restored')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
