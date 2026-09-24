import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calculator, TrendingUp, DollarSign, Sprout, Sparkles, 
  ArrowRight, ShieldCheck, ChevronRight, Download, Share2, 
  Calendar, Layers, CheckCircle2, AlertCircle, Info, RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Agronomic ICAR & TNAU baseline yield benchmarks (Quintals per Acre)
const CROP_BENCHMARKS = {
  "Tomato": { name: "Tomato", icon: "🍅", avgYield: 140, minYield: 100, maxYield: 190, unit: "Quintals", pricePerQtl: 2800, costPerAcre: 45000, durationDays: 110, bestMonths: "Feb - May, Nov - Dec" },
  "Paddy (Rice)": { name: "Paddy (Rice)", icon: "🌾", avgYield: 24, minYield: 18, maxYield: 32, unit: "Quintals", pricePerQtl: 2320, costPerAcre: 22000, durationDays: 135, bestMonths: "Oct - Dec, April" },
  "Maize (Corn)": { name: "Maize (Corn)", icon: "🌽", avgYield: 30, minYield: 22, maxYield: 40, unit: "Quintals", pricePerQtl: 2225, costPerAcre: 20000, durationDays: 105, bestMonths: "Sept - Nov, March" },
  "Red Chilli": { name: "Red Chilli", icon: "🌶️", avgYield: 15, minYield: 10, maxYield: 22, unit: "Quintals", pricePerQtl: 18500, costPerAcre: 65000, durationDays: 160, bestMonths: "Jan - April" },
  "Cotton": { name: "Cotton", icon: "⚪", avgYield: 12, minYield: 8, maxYield: 16, unit: "Quintals", pricePerQtl: 7120, costPerAcre: 32000, durationDays: 150, bestMonths: "Nov - Feb" },
  "Wheat": { name: "Wheat", icon: "🌾", avgYield: 20, minYield: 15, maxYield: 26, unit: "Quintals", pricePerQtl: 2425, costPerAcre: 18000, durationDays: 120, bestMonths: "March - April" },
  "Soybean": { name: "Soybean", icon: "🟡", avgYield: 10, minYield: 7, maxYield: 14, unit: "Quintals", pricePerQtl: 4892, costPerAcre: 16000, durationDays: 95, bestMonths: "Oct - Nov" },
  "Groundnut (Peanut)": { name: "Groundnut (Peanut)", icon: "🥜", avgYield: 14, minYield: 10, maxYield: 19, unit: "Quintals", pricePerQtl: 6780, costPerAcre: 24000, durationDays: 115, bestMonths: "Nov - Jan, May" },
  "Onion": { name: "Onion", icon: "🧅", avgYield: 110, minYield: 80, maxYield: 150, unit: "Quintals", pricePerQtl: 2150, costPerAcre: 42000, durationDays: 120, bestMonths: "Nov - Jan, April - May" },
  "Potato": { name: "Potato", icon: "🥔", avgYield: 120, minYield: 90, maxYield: 160, unit: "Quintals", pricePerQtl: 1650, costPerAcre: 48000, durationDays: 100, bestMonths: "Jan - March" }
};

export default function YieldProfitEstimator({ initialCrop = "Tomato", initialAcres = 2.0, mandiPriceOverride = null }) {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [selectedCropKey, setSelectedCropKey] = useState(
    CROP_BENCHMARKS[initialCrop] ? initialCrop : "Tomato"
  );
  const [acreage, setAcreage] = useState(initialAcres || 2.0);
  const [managementQuality, setManagementQuality] = useState('high'); // 'standard', 'high', 'expert'
  const [irrigationType, setIrrigationType] = useState('drip'); // 'rainfed', 'flood', 'drip', 'sprinkler'
  const [customCostPerAcre, setCustomCostPerAcre] = useState(
    CROP_BENCHMARKS[initialCrop]?.costPerAcre || 45000
  );

  const crop = CROP_BENCHMARKS[selectedCropKey] || CROP_BENCHMARKS["Tomato"];
  const currentMandiPrice = mandiPriceOverride || crop.pricePerQtl;

  // Management & Irrigation Multipliers
  const calculations = useMemo(() => {
    let yieldMultiplier = 1.0;
    if (managementQuality === 'standard') yieldMultiplier *= 0.90;
    if (managementQuality === 'high') yieldMultiplier *= 1.10;
    if (managementQuality === 'expert') yieldMultiplier *= 1.25;

    if (irrigationType === 'drip') yieldMultiplier *= 1.15;
    if (irrigationType === 'sprinkler') yieldMultiplier *= 1.08;
    if (irrigationType === 'rainfed') yieldMultiplier *= 0.82;

    const estimatedYieldPerAcre = Math.round(crop.avgYield * yieldMultiplier);
    const totalYieldQuintals = Math.round(estimatedYieldPerAcre * acreage);
    const totalYieldTonnes = (totalYieldQuintals * 0.1).toFixed(1);

    const grossRevenue = Math.round(totalYieldQuintals * currentMandiPrice);
    const totalExpenses = Math.round(customCostPerAcre * acreage);
    const netProfit = grossRevenue - totalExpenses;
    const roiPercentage = totalExpenses > 0 ? Math.round((netProfit / totalExpenses) * 100) : 0;
    const profitPerAcre = acreage > 0 ? Math.round(netProfit / acreage) : 0;

    return {
      estimatedYieldPerAcre,
      totalYieldQuintals,
      totalYieldTonnes,
      grossRevenue,
      totalExpenses,
      netProfit,
      roiPercentage,
      profitPerAcre,
    };
  }, [crop, acreage, managementQuality, irrigationType, currentMandiPrice, customCostPerAcre]);

  const handleCropChange = (cropKey) => {
    setSelectedCropKey(cropKey);
    const newCrop = CROP_BENCHMARKS[cropKey];
    if (newCrop) {
      setCustomCostPerAcre(newCrop.costPerAcre);
    }
  };

  const shareToWhatsApp = () => {
    const text = isTe
      ? `🌾 *అగ్రిషీల్డ్ దిగుబడి & లాభాల అంచనా:*%0A` +
        `• పంట: ${crop.name} (${acreage} ఎకరాలు)%0A` +
        `• అంచనా దిగుబడి: *${calculations.totalYieldQuintals} క్వింటాళ్లు* (${calculations.totalYieldTonnes} టన్నులు)%0A` +
        `• మార్కెట్ ధర: ₹${currentMandiPrice.toLocaleString()} / క్వింటాల్%0A` +
        `• స్థూల రాబడి: *₹${calculations.grossRevenue.toLocaleString()}*%0A` +
        `• సాగు ఖర్చు: ₹${calculations.totalExpenses.toLocaleString()}%0A` +
        `• నికర లాభం: *₹${calculations.netProfit.toLocaleString()}* (ROI: ${calculations.roiPercentage}%)%0A` +
        `అగ్రిషీల్డ్ AI ద్వారా సర్టిఫై చేయబడింది.`
      : `🌾 *AgriShield Crop Yield & Profit Forecast:*%0A` +
        `• Crop: ${crop.name} (${acreage} Acres)%0A` +
        `• Estimated Yield: *${calculations.totalYieldQuintals} Quintals* (${calculations.totalYieldTonnes} Tonnes)%0A` +
        `• Mandi Price: ₹${currentMandiPrice.toLocaleString()} / Qtl%0A` +
        `• Gross Revenue: *₹${calculations.grossRevenue.toLocaleString()}*%0A` +
        `• Cultivation Cost: ₹${calculations.totalExpenses.toLocaleString()}%0A` +
        `• Net Projected Profit: *₹${calculations.netProfit.toLocaleString()}* (ROI: ${calculations.roiPercentage}%)%0A` +
        `Certified via AgriShield AI Farm Sentinel.`;

    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="rounded-3xl bg-[#070d14] border border-emerald-500/25 p-5 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AI Mandi Economics
              </span>
              <span className="text-[10px] text-white/40">ICAR & APMC Benchmark</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
              {isTe ? 'పంట దిగుబడి & లాభాల అంచనా కాలిక్యులేటర్' : 'Crop Yield & Harvest Profit Estimator'}
            </h2>
          </div>
        </div>

        <button
          onClick={shareToWhatsApp}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{isTe ? 'WhatsApp లో పంచుకోండి' : 'Share on WhatsApp'}</span>
        </button>
      </div>

      {/* Control Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Crop Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">
            {isTe ? 'పంటను ఎంచుకోండి:' : 'Select Target Crop:'}
          </label>
          <select
            value={selectedCropKey}
            onChange={(e) => handleCropChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            {Object.keys(CROP_BENCHMARKS).map(cKey => (
              <option key={cKey} value={cKey} className="bg-[#0b1219] text-white">
                {CROP_BENCHMARKS[cKey].icon} {cKey}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Acreage Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">
            {isTe ? 'పొలం విస్తీర్ణం (ఎకరాలు):' : 'Cultivated Area (Acres):'}
          </label>
          <input
            type="number"
            step="0.25"
            min="0.25"
            max="100"
            value={acreage}
            onChange={(e) => setAcreage(Math.max(0.1, parseFloat(e.target.value) || 0))}
            className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* 3. Management / Health Quality */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">
            {isTe ? 'పంట సంరక్షణ నాణ్యత:' : 'Farm Practice & Health:'}
          </label>
          <select
            value={managementQuality}
            onChange={(e) => setManagementQuality(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="standard" className="bg-[#0b1219]">Standard (Basic Practice)</option>
            <option value="high" className="bg-[#0b1219]">High (AgriShield AI Managed)</option>
            <option value="expert" className="bg-[#0b1219]">Expert (Precision Fertigation)</option>
          </select>
        </div>

        {/* 4. Irrigation System */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300">
            {isTe ? 'నీటి పారుదల పద్ధతి:' : 'Irrigation Method:'}
          </label>
          <select
            value={irrigationType}
            onChange={(e) => setIrrigationType(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
          >
            <option value="drip" className="bg-[#0b1219]">💧 Automated Drip (+15% Yield)</option>
            <option value="sprinkler" className="bg-[#0b1219]">🌧️ Sprinkler Gun (+8% Yield)</option>
            <option value="flood" className="bg-[#0b1219]">🌊 Furrow / Flood Canal</option>
            <option value="rainfed" className="bg-[#0b1219]">☁️ Rainfed (Monsoon Dependent)</option>
          </select>
        </div>
      </div>

      {/* Main Results Display Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Estimated Yield */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/25 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            {isTe ? 'మొత్తం అంచనా దిగుబడి' : 'Total Expected Yield'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{calculations.totalYieldQuintals}</span>
            <span className="text-xs font-bold text-emerald-400">Quintals</span>
          </div>
          <p className="text-[11px] text-white/50">
            ≈ {calculations.totalYieldTonnes} Tonnes ({calculations.estimatedYieldPerAcre} Qtl/Acre)
          </p>
        </div>

        {/* Card 2: Gross Revenue */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-sky-500/25 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            {isTe ? 'అంచనా స్థూల రాబడి' : 'Gross Mandi Revenue'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-sky-400 font-bold">₹</span>
            <span className="text-3xl font-black text-white">{calculations.grossRevenue.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-white/50">
            @ ₹{currentMandiPrice.toLocaleString()} / Quintal live rate
          </p>
        </div>

        {/* Card 3: Cultivation Expenses */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-500/25 space-y-1 relative overflow-hidden">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
            {isTe ? 'మొత్తం సాగు ఖర్చు' : 'Total Input Expenses'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-amber-400 font-bold">₹</span>
            <span className="text-3xl font-black text-white">{calculations.totalExpenses.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-white/50">
            Seeds, fertilizer, spray & labor (₹{customCostPerAcre.toLocaleString()}/acre)
          </p>
        </div>

        {/* Card 4: Net Projected Profit */}
        <div className={`p-4 rounded-2xl border space-y-1 relative overflow-hidden ${
          calculations.netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-rose-500/10 border-rose-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              {isTe ? 'నికర లాభం' : 'Net Projected Profit'}
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
              ROI: {calculations.roiPercentage}%
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-emerald-400">₹</span>
            <span className="text-3xl font-black text-emerald-300">
              {calculations.netProfit.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-emerald-400/70 font-semibold">
            ₹{calculations.profitPerAcre.toLocaleString()} Net Profit per Acre
          </p>
        </div>
      </div>

      {/* Seasonal Selling & Harvest Advice Banner */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-white/70">
            <strong>Optimal Selling Window:</strong> {crop.bestMonths} (Historical wholesale peak prices recorded at APMC hubs).
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/50 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Crop Duration: {crop.durationDays} Days</span>
        </div>
      </div>
    </div>
  );
}
