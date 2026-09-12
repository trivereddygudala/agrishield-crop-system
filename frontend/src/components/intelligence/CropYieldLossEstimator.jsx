import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingDown, ShieldCheck, DollarSign, Clock, AlertTriangle, 
  Sparkles, CheckCircle2, ChevronRight, Sliders, ArrowUpRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '../ui/index';
import { calculateCropEconomics, formatINR, SEVERITY_LEVELS } from '../../utils/cropEconomics';

export const CropYieldLossEstimator = ({
  cropName = 'Tomato',
  diseaseName = 'Early Blight',
  initialSeverity = 'moderate',
  initialAcres = 1.0,
  compact = false
}) => {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [acres, setAcres] = useState(initialAcres);
  const [severity, setSeverity] = useState(initialSeverity);

  const econ = useMemo(() => {
    return calculateCropEconomics({
      cropName,
      diseaseName,
      severity,
      acres
    });
  }, [cropName, diseaseName, severity, acres]);

  return (
    <Card glass className="p-5 sm:p-6 border border-emerald-500/20 bg-gradient-to-br from-white/85 via-emerald-500/[0.03] to-white/90 dark:from-[#030e07]/90 dark:via-emerald-950/20 dark:to-[#020b05]/95 backdrop-blur-md shadow-xl relative overflow-hidden rounded-[24px]">
      {/* Top emerald gradient edge */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 shrink-0 shadow-sm">
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {isTe ? '💰 పంట దిగుబడి & ఆర్థిక నష్టం అంచనా' : 'AI Crop Yield Loss & Economic Estimator'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                ₹ APMC Mandi
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {isTe
                ? `${cropName} పంటలో చికిత్స చేయకపోతే వచ్చే నష్టం & మందు పిచికారీ చేయడం వల్ల రక్షించబడే విలువ.`
                : `Financial impact for ${cropName} (${diseaseName}): untreated loss vs value protected with timely spray.`}
            </p>
          </div>
        </div>

        {/* Protection ROI Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/35 text-emerald-600 dark:text-emerald-300 font-extrabold text-xs shrink-0 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>{econ.roiMultiplier}x {isTe ? 'పిచికారీ లాభం (ROI)' : 'Spray ROI'}</span>
        </div>
      </div>

      {/* Interactive Controls: Acres Slider & Severity Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 p-3.5 rounded-2xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
        {/* Farm Acres Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-white/80">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-500" />
              {isTe ? 'పొలం విస్తీర్ణం (Plot Acreage):' : 'Plot Size (Acres):'}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
              {acres} {isTe ? 'ఎకరాలు' : 'Acre(s)'}
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={acres}
            onChange={(e) => setAcres(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0.5 Acre</span>
            <span>5 Acres</span>
            <span>10 Acres</span>
          </div>
        </div>

        {/* Severity Stage Selector */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700 dark:text-white/80 block">
            {isTe ? 'వ్యాధి తీవ్రత దశ (Infection Stage):' : 'Infection Severity Stage:'}
          </span>
          <div className="grid grid-cols-4 gap-1">
            {Object.keys(SEVERITY_LEVELS).map((lvlKey) => {
              const active = severity.toLowerCase().includes(lvlKey);
              return (
                <button
                  key={lvlKey}
                  type="button"
                  onClick={() => setSeverity(lvlKey)}
                  className={`px-2 py-1.5 rounded-xl text-[10px] font-black tracking-tight transition-all text-center ${
                    active
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                      : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-emerald-400'
                  }`}
                >
                  {lvlKey.toUpperCase()}
                  <span className="block text-[8px] font-normal opacity-80">
                    -{SEVERITY_LEVELS[lvlKey].lossPct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4 Financial Impact Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        {/* 1. Untreated Projected Loss */}
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <span>{isTe ? 'అంచనా నష్టం' : 'Projected Loss'}</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-300">
            {formatINR(econ.projectedLossINR)}
          </p>
          <span className="text-[10px] text-rose-700/80 dark:text-rose-300/60 block">
            -{econ.yieldLossPct}% ({econ.yieldLossQuintals} {isTe ? 'క్వింటాళ్ళు' : 'Qtl'})
          </span>
        </div>

        {/* 2. Protected Harvest Value */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span>{isTe ? 'రక్షించబడే విలువ' : 'Value Protected'}</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-300">
            {formatINR(econ.harvestSavedINR)}
          </p>
          <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/60 block">
            {isTe ? 'పిచికారీ చేసిన తర్వాత' : 'With timely treatment'}
          </span>
        </div>

        {/* 3. Treatment Spray Cost */}
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-sky-600 dark:text-sky-400">
            <span>{isTe ? 'పిచికారీ ఖర్చు' : 'Treatment Cost'}</span>
            <span className="text-[10px] opacity-75">Chemical+Labor</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-sky-600 dark:text-sky-300">
            {formatINR(econ.totalTreatmentCostINR)}
          </p>
          <span className="text-[10px] text-sky-700/80 dark:text-sky-300/60 block">
            {isTe ? 'మొత్తం మందు ఖర్చు' : 'Total spray investment'}
          </span>
        </div>

        {/* 4. Total Potential Harvest Value */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <span>{isTe ? 'మొత్తం పంట విలువ' : 'Total Harvest Value'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-300">
            {formatINR(econ.grossPotentialValue)}
          </p>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-300/60 block">
            {econ.totalYieldQuintals} Qtl @ {formatINR(econ.pricePerQuintal)}/Qtl
          </span>
        </div>
      </div>

      {/* 48-Hour Urgency Alert Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 flex items-start sm:items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
          <Clock className="w-4 h-4 animate-pulse" />
        </div>
        <div className="text-xs">
          <span className="font-extrabold text-slate-800 dark:text-white block">
            {isTe ? '⏱️ 48 గంటల తక్షణ చర్య హెచ్చరిక (Urgency Advisory):' : '⏱️ 48-Hour Immediate Spray Urgency Advisory:'}
          </span>
          <p className="text-slate-600 dark:text-white/60 text-[11px] mt-0.5">
            {isTe
              ? `ఈరోజే మందు పిచికారీ చేయడం వల్ల, మరో 2 రోజులు ఆలస్యం చేయడంతో పోలిస్తే అదనంగా ${formatINR(econ.additionalDelayLossINR)} నష్టాన్ని నివారించవచ్చు.`
              : `Spraying today prevents an additional ${formatINR(econ.additionalDelayLossINR)} in yield destruction compared to delaying by 48 hours.`}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default CropYieldLossEstimator;
