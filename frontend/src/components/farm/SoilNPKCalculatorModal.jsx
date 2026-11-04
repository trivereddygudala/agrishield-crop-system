import { getLocalizedField, formatMeasurementUnit } from '../../utils/localizationHelper';
import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, CheckCircle2, AlertTriangle, ShieldCheck, CreditCard, DollarSign, 
  ChevronRight, Share2, Layers, Calendar, Sprout, ArrowRight,
  Sparkles, RefreshCw, X, Info, ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Agronomic Indian Soil Database with nutrient index
const SOIL_TYPES = {
  "red_loamy": { 
    name: "Red Sandy Loam", 
    desc: "Permeable, low organic carbon, prone to zinc & phosphorus fixation.",
    pH: "6.2 - 6.8",
    nDeficit: 1.15,
    pDeficit: 1.20,
    kDeficit: 1.05,
    micronutrientNeed: "Zinc Sulphate 21% (10 kg/acre)"
  },
  "black_cotton": { 
    name: "Black Cotton Soil (Regur)", 
    desc: "High clay content, rich in calcium/magnesium, deficient in available nitrogen.",
    pH: "7.5 - 8.3",
    nDeficit: 1.25,
    pDeficit: 1.10,
    kDeficit: 0.90,
    micronutrientNeed: "Iron Chelate (Fe-EDTA) & Sulphur (15 kg/acre)"
  },
  "alluvial": { 
    name: "Alluvial Riverbed Soil", 
    desc: "Highly fertile, rich in potash, medium phosphorus, balanced organic matter.",
    pH: "6.8 - 7.4",
    nDeficit: 1.00,
    pDeficit: 1.00,
    kDeficit: 0.95,
    micronutrientNeed: "Boron 20% (1 kg/acre)"
  },
  "laterite": { 
    name: "Laterite / Coastal Acid Soil", 
    desc: "Acidic pH, high phosphate fixation, requires agricultural lime buffering.",
    pH: "5.0 - 5.8",
    nDeficit: 1.20,
    pDeficit: 1.35,
    kDeficit: 1.15,
    micronutrientNeed: "Agricultural Lime (150 kg/acre) + Magnesium"
  }
};

// Crop Nutrient Benchmark per Acre (N : P₂O₅ : K₂O in kg/acre)
const NPK_BENCHMARKS = {
  "Tomato": { name: "Tomato", N: 55, P: 30, K: 45, foliar: "NPK 19:19:19 @ 100g/20L pump at flowering" },
  "Paddy (Rice)": { name: "Paddy (Rice)", N: 48, P: 24, K: 24, foliar: "Zinc Sulphate 21% @ 40g/20L pump at 30 DAS" },
  "Maize (Corn)": { name: "Maize (Corn)", N: 50, P: 25, K: 20, foliar: "Urea 2% foliar spray or 19:19:19 before tasseling" },
  "Red Chilli": { name: "Red Chilli", N: 60, P: 30, K: 35, foliar: "Potassium Nitrate 13:0:45 @ 100g/20L pump during pod fill" },
  "Cotton": { name: "Cotton", N: 45, P: 22, K: 22, foliar: "Magnesium Sulphate @ 80g/20L pump at boll formation" },
  "Wheat": { name: "Wheat", N: 48, P: 24, K: 16, foliar: "NPK 0:52:34 @ 100g/20L pump at flag leaf stage" }
};

// Farmer-Friendly Bag + Kg Breakdown Helper
function formatBagAndKg(totalKg, bagWeight, isTe = false) {
  if (!totalKg || totalKg <= 0) return { primary: isTe ? '0 బస్తాలు' : '0 Bags', secondary: '0 kg', bags: 0, looseKg: 0 };
  const fullBags = Math.floor(totalKg / bagWeight);
  const looseKg = Math.round(totalKg % bagWeight);

  let primary = '';
  if (fullBags === 0) {
    primary = `${looseKg} kg`;
  } else if (looseKg === 0) {
    primary = isTe ? `${fullBags} బస్తాలు` : `${fullBags} ${fullBags === 1 ? 'Bag' : 'Bags'}`;
  } else {
    primary = isTe 
      ? `${fullBags} బస్తాలు + ${looseKg} kg` 
      : `${fullBags} ${fullBags === 1 ? 'Bag' : 'Bags'} + ${looseKg} kg`;
  }

  const secondary = isTe
    ? `మొత్తం ${totalKg} kg (${bagWeight} kg బస్తా)`
    : `Total ${totalKg} kg (${bagWeight} kg/bag)`;

  return { primary, secondary, bags: fullBags, looseKg, totalKg };
}

export default function SoilNPKCalculatorModal({ isOpen, onClose, initialCrop = "Tomato", initialAcres = 2.0, embedded = false }) {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [selectedSoilKey, setSelectedSoilKey] = useState("red_loamy");
  const [selectedCropKey, setSelectedCropKey] = useState(
    NPK_BENCHMARKS[initialCrop] ? initialCrop : "Tomato"
  );
  const [acres, setAcres] = useState(initialAcres || 2.0);
  const [useDAP, setUseDAP] = useState(true);

  const scrollRef = useRef(null);

  const soil = SOIL_TYPES[selectedSoilKey] || SOIL_TYPES["red_loamy"];
  const crop = NPK_BENCHMARKS[selectedCropKey] || NPK_BENCHMARKS["Tomato"];

  // Fertilizer Bag Calculation with Farmer-Friendly Whole Bags + Loose Kg Units
  const schedule = useMemo(() => {
    const totalN = Math.round(crop.N * acres * soil.nDeficit);
    const totalP = Math.round(crop.P * acres * soil.pDeficit);
    const totalK = Math.round(crop.K * acres * soil.kDeficit);

    let dapTotalKg = 0;
    let ureaTotalKg = 0;
    let mopTotalKg = Math.round(totalK / 0.60);

    if (useDAP) {
      dapTotalKg = Math.round(totalP / 0.46);
      const nFromDAP = Math.round(dapTotalKg * 0.18);
      const remainingN = Math.max(0, totalN - nFromDAP);
      ureaTotalKg = Math.round(remainingN / 0.46);
    } else {
      dapTotalKg = 0;
      ureaTotalKg = Math.round(totalN / 0.46);
    }

    const ureaBagInfo = formatBagAndKg(ureaTotalKg, 45, isTe);
    const dapBagInfo = formatBagAndKg(dapTotalKg, 50, isTe);
    const mopBagInfo = formatBagAndKg(mopTotalKg, 50, isTe);

    const basalUreaKg = Math.round(ureaTotalKg * 0.33);
    const vegUreaKg = Math.round(ureaTotalKg * 0.33);
    const flowUreaKg = Math.round(ureaTotalKg - basalUreaKg - vegUreaKg);

    const basalMopKg = Math.round(mopTotalKg * 0.50);
    const flowMopKg = Math.round(mopTotalKg - basalMopKg);

    return {
      elemental: { N: totalN, P: totalP, K: totalK },
      urea: ureaBagInfo,
      dap: dapBagInfo,
      mop: mopBagInfo,
      splits: {
        basal: {
          dapKg: dapTotalKg,
          ureaKg: basalUreaKg,
          mopKg: basalMopKg,
        },
        vegetative: {
          ureaKg: vegUreaKg,
        },
        flowering: {
          ureaKg: flowUreaKg,
          mopKg: flowMopKg,
        }
      }
    };
  }, [crop, soil, acres, useDAP, isTe]);

  const shareSchedule = () => {
    const text = isTe
      ? `🌱 *అగ్రిషీల్డ్ స్మార్ట్ ఎరువుల షెడ్యూల్ (ICAR ప్రమాణాలు)*%0A%0A` +
        `• పంట: *${crop.name}* (${acres} ఎకరాలు)%0A` +
        `• నేల: *${soil.name}* (pH ${soil.pH})%0A` +
        `• కావలసిన ఎరువుల బస్తాల లెక్క (రైతు బస్తాలు + కేజీలు):%0A` +
        `  - యూరియా (45kg బస్తా): *${schedule.urea.primary}* (${schedule.urea.secondary})%0A` +
        `  - DAP (50kg బస్తా): *${schedule.dap.primary}* (${schedule.dap.secondary})%0A` +
        `  - పొటాష్ MOP (50kg బస్తా): *${schedule.mop.primary}* (${schedule.mop.secondary})%0A` +
        `• ఎరువులు వేసే 3 దశలు:%0A` +
        `  1. ఆఖరి దుక్కిలో (Day 0): DAP మొత్తం (${schedule.splits.basal.dapKg} kg) + MOP ${schedule.splits.basal.mopKg} kg + యూరియా ${schedule.splits.basal.ureaKg} kg%0A` +
        `  2. శాఖీయ దశ (25-30 రోజులు): యూరియా ${schedule.splits.vegetative.ureaKg} kg%0A` +
        `  3. పూత & కాత దశ (50-60 రోజులు): యూరియా ${schedule.splits.flowering.ureaKg} kg + MOP ${schedule.splits.flowering.mopKg} kg%0A` +
        `• పిచికారీ స్ప్రే: ${crop.foliar}%0A` +
        `• సూక్ష్మ పోషకాలు: ${soil.micronutrientNeed}%0A` +
        `AgriShield AI ద్వారా సర్టిఫై చేయబడింది.`
      : `🌱 *AgriShield Smart Fertilizer Prescription (ICAR Norms)*%0A%0A` +
        `• Crop: *${crop.name}* (${acres} Acres)%0A` +
        `• Soil: *${soil.name}* (pH ${soil.pH})%0A` +
        `• Required Fertilizer (Farmer Bags + Loose Kg):%0A` +
        `  - Urea (45kg bag): *${schedule.urea.primary}* (${schedule.urea.secondary})%0A` +
        `  - DAP (50kg bag): *${schedule.dap.primary}* (${schedule.dap.secondary})%0A` +
        `  - MOP / Potash (50kg bag): *${schedule.mop.primary}* (${schedule.mop.secondary})%0A` +
        `• Application Timeline:%0A` +
        `  1. Basal (Day 0): All DAP (${schedule.splits.basal.dapKg} kg) + MOP ${schedule.splits.basal.mopKg} kg + Urea ${schedule.splits.basal.ureaKg} kg%0A` +
        `  2. Vegetative (25-30 DAS): Urea ${schedule.splits.vegetative.ureaKg} kg%0A` +
        `  3. Flowering (50-60 DAS): Urea ${schedule.splits.flowering.ureaKg} kg + MOP ${schedule.splits.flowering.mopKg} kg%0A` +
        `• Foliar Spray: ${crop.foliar}%0A` +
        `• Micronutrient: ${soil.micronutrientNeed}%0A` +
        `Certified via AgriShield ICAR Agronomic Norms.`;

    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (!isOpen && !embedded) return null;

  const calculatorCard = (
    <div className={`relative z-10 w-full flex flex-col rounded-3xl bg-white dark:bg-[#070d15] border border-slate-200/90 dark:border-emerald-500/30 shadow-md dark:shadow-2xl overflow-hidden transition-all ${
      embedded ? 'p-0' : 'max-w-3xl max-h-[95vh]'
    }`}>
      {/* Header */}
      <div className="shrink-0 px-5 py-4 sm:px-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 dark:from-emerald-950/40 dark:via-[#070d15] dark:to-[#070d15]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {isTe ? 'రైతు బస్తాల లెక్క' : 'Farmer Bag Units'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-white/50 hidden sm:inline font-semibold">ICAR Certified Fertigation</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {isTe ? 'స్మార్ట్ నేల NPK ఎరువుల కాలిక్యులేటర్' : 'Smart Soil NPK Fertilizer & Fertigation Schedule'}
            </h2>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div 
        ref={scrollRef}
        className={`px-4 py-4 sm:px-6 space-y-4 text-xs ${embedded ? '' : 'flex-1 overflow-y-auto'}`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,185,129,0.4) transparent' }}
      >
        {/* Section 1: Field Parameters (Soil, Crop, Acres) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Soil Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {isTe ? 'పొలం నేల రకం:' : 'Soil Classification:'}
            </label>
            <select
              value={selectedSoilKey}
              onChange={(e) => setSelectedSoilKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              {Object.keys(SOIL_TYPES).map(sKey => (
                <option key={sKey} value={sKey} className="bg-white dark:bg-[#0b1219] text-slate-800 dark:text-white">
                  {SOIL_TYPES[sKey].name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Crop */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {isTe ? 'సాగు పంట:' : 'Target Crop:'}
            </label>
            <select
              value={selectedCropKey}
              onChange={(e) => setSelectedCropKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              {Object.keys(NPK_BENCHMARKS).map(cKey => (
                <option key={cKey} value={cKey} className="bg-white dark:bg-[#0b1219] text-slate-800 dark:text-white">
                  {cKey}
                </option>
              ))}
            </select>
          </div>

          {/* Acreage */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {isTe ? 'విస్తీర్ణం (ఎకరాలు):' : 'Acreage (Acres):'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0.25"
              max="50"
              value={acres}
              onChange={(e) => setAcres(Math.max(0.25, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-xs font-bold focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Soil Diagnostic Strip */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs gap-3">
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">{soil.name}</span>
            <p className="text-slate-600 dark:text-white/60 text-[11px] leading-tight">{soil.desc}</p>
          </div>
          <div className="text-right shrink-0 bg-white dark:bg-white/[0.04] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-white/50 block font-semibold">pH Level</span>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">{soil.pH}</span>
          </div>
        </div>

        {/* Section 2: 3 Main Commercial Fertilizer Bag Cards (Farmer-Friendly Units!) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {isTe ? 'మొత్తం అవసరమైన ఎరువుల బస్తాల మోతాదు' : 'Total Fertilizer Bag Prescription (Whole Bags + Loose Kg)'}
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-white/50">
              {acres} {acres === 1 ? 'Acre' : 'Acres'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Urea */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/35 space-y-1 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Nitrogen (N)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 font-bold">45 kg Bag</span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white">Urea (46% N)</p>
              <div className="pt-0.5">
                <p className="text-xl sm:text-2xl font-black text-blue-800 dark:text-blue-300 tracking-tight leading-none">
                  {schedule.urea.primary}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-white/60 font-semibold mt-1">
                  {schedule.urea.secondary}
                </p>
              </div>
            </div>

            {/* Card 2: DAP */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/35 space-y-1 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Phosphorus (P)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold">50 kg Bag</span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white">DAP (18:46:0)</p>
              <div className="pt-0.5">
                <p className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight leading-none">
                  {schedule.dap.primary}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-white/60 font-semibold mt-1">
                  {schedule.dap.secondary}
                </p>
              </div>
            </div>

            {/* Card 3: MOP Potash */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/35 space-y-1 relative overflow-hidden shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Potassium (K)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-bold">50 kg Bag</span>
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-white">MOP Potash (60% K₂O)</p>
              <div className="pt-0.5">
                <p className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-300 tracking-tight leading-none">
                  {schedule.mop.primary}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-white/60 font-semibold mt-1">
                  {schedule.mop.secondary}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Stage-Wise Application Schedule */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#060b13] border border-slate-200 dark:border-emerald-500/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isTe ? '3-దశల ఎరువుల వేసే షెడ్యూల్ (Fertigation Schedule)' : 'Complete 3-Stage Application Schedule'}</span>
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
              100% Recommended
            </span>
          </div>

          <div className="space-y-2">
            {/* Stage 1: Basal */}
            <div className="p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <strong className="text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    {isTe ? '1. ఆఖరి దుక్కిలో / నాటేటప్పుడు (Day 0 Basal):' : 'Stage 1: Basal Dressing (At Sowing / Transplanting):'}
                  </strong>
                </div>
                <p className="text-slate-600 dark:text-white/80 text-[11px] pl-4">
                  {isTe
                    ? `DAP మొత్తం (${schedule.splits.basal.dapKg} kg) + MOP ${schedule.splits.basal.mopKg} kg + యూరియా ${schedule.splits.basal.ureaKg} kg కలిపి భూమిలో వేయాలి.`
                    : `Apply 100% DAP (${schedule.splits.basal.dapKg} kg) + 50% MOP (${schedule.splits.basal.mopKg} kg) + 33% Urea (${schedule.splits.basal.ureaKg} kg). Mix 5cm into soil.`}
                </p>
              </div>
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 shrink-0 self-start sm:self-auto">
                Day 0
              </span>
            </div>

            {/* Stage 2: Vegetative */}
            <div className="p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-sky-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                  <strong className="text-sky-700 dark:text-sky-400 text-xs font-bold">
                    {isTe ? '2. శాఖీయ దశ / పిలకల దశ (25–30 రోజులు):' : 'Stage 2: Vegetative / Tillering Stage (25–30 DAS):'}
                  </strong>
                </div>
                <p className="text-slate-600 dark:text-white/80 text-[11px] pl-4">
                  {isTe
                    ? `రెండవ మోతాదుగా యూరియా ${schedule.splits.vegetative.ureaKg} kg తేమ ఉన్నప్పుడు పైపాటుగా చల్లాలి.`
                    : `Top-dress 33% Urea (${schedule.splits.vegetative.ureaKg} kg) after weeding under moist soil conditions.`}
                </p>
              </div>
              <span className="text-[10px] font-black text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/25 shrink-0 self-start sm:self-auto">
                25–30 DAS
              </span>
            </div>

            {/* Stage 3: Flowering */}
            <div className="p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <strong className="text-amber-700 dark:text-amber-400 text-xs font-bold">
                    {isTe ? '3. పూత & పిందె కాత దశ (50–60 రోజులు):' : 'Stage 3: Flowering & Fruit Set Stage (50–60 DAS):'}
                  </strong>
                </div>
                <p className="text-slate-600 dark:text-white/80 text-[11px] pl-4">
                  {isTe
                    ? `మిగిలిన యూరియా ${schedule.splits.flowering.ureaKg} kg + మిగిలిన పొటాష్ MOP ${schedule.splits.flowering.mopKg} kg పైపాటుగా వేయాలి.`
                    : `Top-dress final 34% Urea (${schedule.splits.flowering.ureaKg} kg) + remaining 50% MOP (${schedule.splits.flowering.mopKg} kg) for fruit weight & grain sizing.`}
                </p>
              </div>
              <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 shrink-0 self-start sm:self-auto">
                50–60 DAS
              </span>
            </div>
          </div>
        </div>

                {/* Section 4B: Subsidized Fertilizer Cost Estimator & Khata Sync */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/25 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isTe ? 'రాయితీ ఎరువుల అంచనా వ్యయం & ఖాతా సింక్' : 'Subsidized Retail Cost & Khata Sync'}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 w-fit">
              {isTe ? 'కేంద్ర ప్రభుత్వ MRP ధరలు' : 'Govt Subsidized MRP'}
            </span>
          </div>

          {(() => {
            const ureaBags = Math.ceil((schedule.urea?.totalKg || 0) / 45) || 1;
            const dapBags = Math.ceil((schedule.dap?.totalKg || 0) / 50) || 1;
            const mopBags = Math.ceil((schedule.mop?.totalKg || 0) / 50) || 1;
            const ureaCost = ureaBags * 266.5;
            const dapCost = dapBags * 1350;
            const mopCost = mopBags * 1700;
            const totalCost = Math.round(ureaCost + dapCost + mopCost);

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-500/15">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Urea (₹266.5/bag)</span>
                    <strong className="text-slate-900 dark:text-slate-100 font-black">₹{Math.round(ureaCost).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-500/15">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">DAP (₹1,350/bag)</span>
                    <strong className="text-slate-900 dark:text-slate-100 font-black">₹{Math.round(dapCost).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-500/15">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">MOP (₹1,700/bag)</span>
                    <strong className="text-slate-900 dark:text-slate-100 font-black">₹{Math.round(mopCost).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold block">Total Est. Cost</span>
                    <strong className="text-emerald-700 dark:text-emerald-300 font-black text-sm">₹{totalCost.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const existing = JSON.parse(localStorage.getItem('agrishield_khata_default') || '[]');
                        const newEntry = {
                          id: 'tx-fert-' + Date.now(),
                          type: 'expense',
                          category: 'fertilizer',
                          description: `${crop.name} Basal & Top-dress Fertilizer (${acres} Acres): Urea + DAP + MOP`,
                          amount: totalCost,
                          date: new Date().toISOString().split('T')[0],
                          crop_name: crop.name,
                          payment_status: 'paid'
                        };
                        localStorage.setItem('agrishield_khata_default', JSON.stringify([newEntry, ...existing]));
                        alert(isTe ? `₹${totalCost} ఎరువుల ఖర్చు డిజిటల్ ఖాతాలో నమోదు చేయబడింది!` : `Recorded ₹${totalCost} fertilizer expense in Farm Khata!`);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{isTe ? `ఖాతాలో నమోదు చేయండి (₹${totalCost})` : `Record ₹${totalCost} in Farm Khata`}</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Section 4C: Micronutrient Deficiency Quick Identification Radar */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#060b13] border border-slate-200 dark:border-emerald-500/20 space-y-2.5">
          <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{isTe ? 'సూక్ష్మ పోషక లోపాల గుర్తింపు & నివారణ' : 'Micronutrient Deficiency Radar'}</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-amber-500/20 space-y-1">
              <strong className="text-amber-700 dark:text-amber-400 block font-bold">Zinc (Zn) Deficiency</strong>
              <p className="text-[11px] text-slate-600 dark:text-white/70">
                Symptoms: White/bleached spots on new leaves. Remedy: Zinc Sulphate 21% @ 2g/L water foliar spray.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-sky-500/20 space-y-1">
              <strong className="text-sky-700 dark:text-sky-400 block font-bold">Boron (B) Deficiency</strong>
              <p className="text-[11px] text-slate-600 dark:text-white/70">
                Symptoms: Flower drop, cracked fruit rind. Remedy: Solubor 20% @ 1g/L water spray at bud emergence.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-emerald-500/20 space-y-1">
              <strong className="text-emerald-700 dark:text-emerald-400 block font-bold">Calcium (Ca) Deficiency</strong>
              <p className="text-[11px] text-slate-600 dark:text-white/70">
                Symptoms: Blossom-End Rot (black base). Remedy: Chelated Calcium Nitrate @ 2.5g/L water weekly.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: 20L Backpack Knapsack Sprayer Foliar Recipe */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/[0.09] border border-emerald-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>20L Backpack Knapsack Sprayer Foliar Recipe</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-white/50 font-semibold">Morning 7–10 AM</span>
          </div>
          <p className="text-slate-700 dark:text-white/90 text-xs font-medium leading-relaxed">
            • <strong className="text-slate-900 dark:text-white">Foliar Nutrition:</strong> {crop.foliar}<br />
            • <strong className="text-slate-900 dark:text-white">Micronutrient Correction:</strong> {soil.micronutrientNeed}
          </p>
        </div>

        {/* Section 5: Organic & Bio-Fertilizer Equivalents */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-lime-500/10 border border-emerald-500/25 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isTe ? 'సేంద్రీయ & బయో ఎరువుల సమతుల్యత (Organic Equivalents)' : 'Organic & Bio-Fertilizer Equivalents'}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Natural Farming
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{isTe ? 'పశువుల ఎరువు (FYM)' : 'Farm Yard Manure'}</span>
              <strong className="text-slate-900 dark:text-white font-black text-sm block mt-0.5">{(acres * 4).toFixed(0)} Tonnes</strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">4–5 T/acre basal</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{isTe ? 'వర్మీకంపోస్ట్' : 'Vermicompost'}</span>
              <strong className="text-slate-900 dark:text-white font-black text-sm block mt-0.5">{(acres * 1.5).toFixed(1)} Tonnes</strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">1.5–2 T/acre rich humus</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{isTe ? 'జీవామృతం' : 'Jeevamrutha'}</span>
              <strong className="text-slate-900 dark:text-white font-black text-sm block mt-0.5">{(acres * 200).toFixed(0)} Litres</strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Monthly fertigation</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{isTe ? 'వేప పిండి' : 'Neem Cake'}</span>
              <strong className="text-slate-900 dark:text-white font-black text-sm block mt-0.5">{(acres * 100).toFixed(0)} kg</strong>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Anti-nematode protection</span>
            </div>
          </div>
        </div>

        {/* Section 6: Soil Health & pH Buffer Guidelines */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/25 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{isTe ? 'భూమి pH స్థాయి & నిర్వహణ' : 'Soil pH & Condition Buffer'}</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {soil.name} · pH {soil.pH}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
            {soil.desc} {isTe ? 'రైతులు విత్తే ముందు పచ్చిరొట్ట ఎరువులైన జీలుగ లేదా జనుము వేసి కలియదున్నడం వల్ల భూమిలో సేంద్రీయ కర్బనం (Organic Carbon) రెట్టింపు అవుతుంది.' : 'Incorporate green manure crops like Dhaincha or Sunn hemp before final plowing to boost organic carbon and nutrient retention.'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 sm:px-6 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-[#060b12]">
        <span className="text-[11px] text-slate-500 dark:text-white/50 text-center sm:text-left font-medium">
          {isTe 
            ? 'ICAR మరియు వ్యవసాయ విశ్వవిద్యాలయాల సిఫార్సుల ప్రకారం లెక్కించబడింది.' 
            : 'Computed strictly per ICAR & State Agricultural University fertilizer benchmarks.'}
        </span>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={shareSchedule}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>{isTe ? 'WhatsApp లో పంపండి' : 'Share on WhatsApp'}</span>
          </button>
          {!embedded && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-bold text-xs transition-all cursor-pointer"
            >
              {isTe ? 'ముగించు' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return calculatorCard;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-3xl"
      >
        {calculatorCard}
      </motion.div>
    </div>
  );
}
