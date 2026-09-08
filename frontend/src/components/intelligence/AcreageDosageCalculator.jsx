import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Droplets, Package, Calculator, Check, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

/**
 * AcreageDosageCalculator:
 * Calculates total water required, spray tank pumps, chemical quantity, and estimated cost in ₹
 * based on field acreage and prescribed agrochemical dosage per liter.
 */
export const AcreageDosageCalculator = ({
  cropName = 'Crop',
  diseaseName = 'Foliar Pathogen',
  chemicalName = 'Mancozeb 75% WP',
  dosagePerLiter = 2.5, // in grams or ml per liter
  unit = 'g', // 'g' or 'ml'
  initialAcres = 1.0
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language ? i18n.language.split('-')[0] : 'en';

  const [acres, setAcres] = useState(() => {
    const n = parseFloat(initialAcres);
    return isNaN(n) || n <= 0 ? 1.0 : n;
  });

  const QUICK_ACRES = [0.5, 1.0, 2.0, 2.5, 5.0];

  // Agronomic calculations
  const calc = useMemo(() => {
    const validAcres = Math.max(0.1, acres);
    // Standard knapsack foliar water volume in India: 150 Liters per acre
    const totalWaterLiters = Math.round(validAcres * 150);
    // Standard knapsack manual/battery sprayer tank: 15 Liters
    const tankPumps = Math.ceil(totalWaterLiters / 15);
    // Total chemical required
    const totalAmount = Math.round(totalWaterLiters * dosagePerLiter);
    
    // Formatting chemical quantity (grams or kg)
    let displayAmount = '';
    if (unit === 'ml') {
      if (totalAmount >= 1000) {
        displayAmount = `${(totalAmount / 1000).toFixed(2)} Liters`;
      } else {
        displayAmount = `${totalAmount} ml`;
      }
    } else {
      if (totalAmount >= 1000) {
        displayAmount = `${(totalAmount / 1000).toFixed(2)} Kg`;
      } else {
        displayAmount = `${totalAmount} grams`;
      }
    }

    // Recommended commercial retail pack size
    let packRecommendation = '';
    if (totalAmount <= 250) {
      packRecommendation = '1x 250g/ml pack';
    } else if (totalAmount <= 500) {
      packRecommendation = '1x 500g/ml pack';
    } else if (totalAmount <= 1000) {
      packRecommendation = '1x 1 Kg/L pack';
    } else {
      const kgs = Math.ceil(totalAmount / 1000);
      packRecommendation = `${kgs}x 1 Kg/L packs`;
    }

    // Estimated retail cost in Indian Rupees (average ~₹380/Kg for standard fungicides like Mancozeb)
    const estimatedCostRupees = Math.round(totalAmount * 0.42);

    return {
      totalWaterLiters,
      tankPumps,
      totalAmount,
      displayAmount,
      packRecommendation,
      estimatedCostRupees
    };
  }, [acres, dosagePerLiter, unit]);

  return (
    <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.04] via-teal-500/[0.02] to-slate-900/30 dark:bg-slate-900/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t('calculator.title', 'Field Spray & Chemical Dosage Calculator')}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {acres} {acres === 1 ? 'Acre' : 'Acres'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('calculator.subtitle', 'Precise water, tank pumps & chemical pack estimation for your acreage')}
            </p>
          </div>
        </div>

        {/* Selected Chemical Badge */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="truncate max-w-[180px]">{chemicalName}</span>
          <span className="text-[10px] text-slate-400">({dosagePerLiter} {unit}/L)</span>
        </div>
      </div>

      {/* Acreage Controller */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('calculator.field_size', 'Select Field Acreage (పొలం విస్తీర్ణం / एकड़):')}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAcres(prev => Math.max(0.25, parseFloat((prev - 0.5).toFixed(2))))}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-extrabold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
              title="Decrease 0.5 Acre"
            >
              -
            </button>
            <input
              type="number"
              step="0.25"
              min="0.1"
              max="100"
              value={acres}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAcres(isNaN(val) ? 0.1 : Math.max(0.1, val));
              }}
              className="w-20 py-1.5 text-center font-black text-sm rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-xs"
            />
            <button
              type="button"
              onClick={() => setAcres(prev => parseFloat((prev + 0.5).toFixed(2)))}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-extrabold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
              title="Increase 0.5 Acre"
            >
              +
            </button>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Acres</span>
          </div>
        </div>

        {/* Quick Acreage Preset Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {QUICK_ACRES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAcres(q)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                acres === q
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50'
              }`}
            >
              {q} {q === 1 ? 'Acre' : 'Acres'}
            </button>
          ))}
        </div>
      </div>

      {/* Calculated Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        
        {/* Metric 1: Water Requirement */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-sky-500 mb-1">
            <Droplets className="w-4 h-4" />
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Total Water</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
            {calc.totalWaterLiters} <span className="text-xs font-bold text-slate-400">Liters</span>
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            150 L/acre foliar volume
          </p>
        </div>

        {/* Metric 2: Spray Tank Pumps */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-teal-500 mb-1">
            <Package className="w-4 h-4" />
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Tank Pumps</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tabular-nums">
            {calc.tankPumps} <span className="text-xs font-bold text-slate-400">tanks</span>
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            ~15 Liters knapsack pump
          </p>
        </div>

        {/* Metric 3: Total Chemical Quantity */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-500/40 shadow-xs">
          <div className="flex items-center gap-1.5 text-emerald-500 mb-1">
            <Check className="w-4 h-4" />
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Chemical to Buy</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {calc.displayAmount}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-bold mt-0.5 truncate">
            {calc.packRecommendation}
          </p>
        </div>

        {/* Metric 4: Estimated Cost */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-amber-500/40 shadow-xs">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <span className="font-extrabold text-sm">₹</span>
            <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Est. Treatment Cost</span>
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
            ₹{calc.estimatedCostRupees}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Approx. retail Mandi rate
          </p>
        </div>

      </div>

      {/* Actionable Guidance Note for Farmer */}
      <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-900 dark:text-white">Foliar Spray Tip:</strong> Dissolve <strong>{dosagePerLiter * 15} {unit}</strong> of {chemicalName} per each 15-Liter knapsack pump. Spray during early morning or late afternoon when temperatures are under 32°C and wind speed is under 12 km/h.
        </p>
      </div>

    </div>
  );
};

export default AcreageDosageCalculator;
