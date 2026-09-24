import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, CheckCircle2, AlertTriangle, ShieldCheck, 
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

export default function SoilNPKCalculatorModal({ isOpen, onClose, initialCrop = "Tomato", initialAcres = 2.0 }) {
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
    // 1. Calculate elemental requirements adjusted for soil deficit
    const totalN = Math.round(crop.N * acres * soil.nDeficit);
    const totalP = Math.round(crop.P * acres * soil.pDeficit);
    const totalK = Math.round(crop.K * acres * soil.kDeficit);

    // 2. Commercial Fertilizer Total Kg Math
    let dapTotalKg = 0;
    let ureaTotalKg = 0;
    let mopTotalKg = 0;

    if (useDAP) {
      // DAP (18:46:0) has 46% P2O5 and 18% N
      dapTotalKg = Math.round(totalP / 0.46);
      const nFromDAP = Math.round(dapTotalKg * 0.18);
      const remainingN = Math.max(0, totalN - nFromDAP);
      // Urea (46% N)
      ureaTotalKg = Math.round(remainingN / 0.46);
    } else {
      ureaTotalKg = Math.round(totalN / 0.46);
    }

    // MOP (60% K2O)
    mopTotalKg = Math.round(totalK / 0.60);

    // 3. Format into Farmer-Friendly Units (Bags + loose kg)
    const urea = formatBagAndKg(ureaTotalKg, 45, isTe);
    const dap = formatBagAndKg(dapTotalKg, 50, isTe);
    const mop = formatBagAndKg(mopTotalKg, 50, isTe);

    // 4. Split Timing Allocations in Kg & Bags
    // Basal (Day 0): 100% DAP + 50% MOP + 33% Urea
    const basalDapKg = dapTotalKg;
    const basalMopKg = Math.round(mopTotalKg * 0.5);
    const basalUreaKg = Math.round(ureaTotalKg * 0.33);

    // Vegetative (25-30 DAS): 33% Urea
    const vegUreaKg = Math.round(ureaTotalKg * 0.33);

    // Flowering / Fruit (50-60 DAS): 34% Urea + 50% MOP
    const flowerUreaKg = Math.max(0, ureaTotalKg - basalUreaKg - vegUreaKg);
    const flowerMopKg = Math.max(0, mopTotalKg - basalMopKg);

    return {
      totalN,
      totalP,
      totalK,
      urea,
      dap,
      mop,
      ureaTotalKg,
      dapTotalKg,
      mopTotalKg,
      splits: {
        basal: { dapKg: basalDapKg, mopKg: basalMopKg, ureaKg: basalUreaKg },
        vegetative: { ureaKg: vegUreaKg },
        flowering: { ureaKg: flowerUreaKg, mopKg: flowerMopKg }
      }
    };
  }, [crop, soil, acres, useDAP, isTe]);

  const shareSchedule = () => {
    const text = isTe
      ? `🧪 *అగ్రిషీల్డ్ స్మార్ట్ ఎరువుల షెడ్యూల్ (రైతు బస్తాల లెక్క):*%0A` +
        `• పంట: *${crop.name}* (${acres} ఎకరాలు)%0A` +
        `• నేల రకం: *${soil.name}* (pH ${soil.pH})%0A` +
        `• అవసరమైన ఎరువులు (బస్తాలు + కిలోలు):%0A` +
        `  - యూరియా (45kg బస్తా): *${schedule.urea.primary}* (${schedule.urea.secondary})%0A` +
        `  - DAP (50kg బస్తా): *${schedule.dap.primary}* (${schedule.dap.secondary})%0A` +
        `  - పొటాష్ MOP (50kg బస్తా): *${schedule.mop.primary}* (${schedule.mop.secondary})%0A` +
        `• దశలవారీ షెడ్యూల్:%0A` +
        `  1. ఆఖరి దుక్కిలో: DAP మొత్తం (${schedule.splits.basal.dapKg} kg) + MOP ${schedule.splits.basal.mopKg} kg + యూరియా ${schedule.splits.basal.ureaKg} kg%0A` +
        `  2. పైపాటుగా (25-30 రోజులు): యూరియా ${schedule.splits.vegetative.ureaKg} kg%0A` +
        `  3. పూత/కాత దశ (50-60 రోజులు): యూరియా ${schedule.splits.flowering.ureaKg} kg + MOP ${schedule.splits.flowering.mopKg} kg%0A` +
        `• స్ప్రేయర్ పిచికారీ: ${crop.foliar}%0A` +
        `• సూక్ష్మపోషకాలు: ${soil.micronutrientNeed}%0A` +
        `అగ్రిషీల్డ్ ICAR శాస్త్రీయ సిఫారసుల ప్రకారం లెక్కించబడింది.`
      : `🧪 *AgriShield Precision Soil NPK Fertilizer Schedule:*%0A` +
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-3xl max-h-[95vh] flex flex-col rounded-3xl bg-[#070d15] border border-emerald-500/30 shadow-2xl shadow-black overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 sm:px-6 border-b border-white/10 flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-[#070d15] to-[#070d15]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isTe ? 'రైతు బస్తాల లెక్క' : 'Farmer Bag Units'}
                </span>
                <span className="text-[10px] text-white/50 hidden sm:inline">ICAR Certified Fertigation</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {isTe ? 'స్మార్ట్ నేల NPK ఎరువుల కాలిక్యులేటర్' : 'Smart Soil NPK Fertilizer & Fertigation Schedule'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body with Clean Visible Scrollbar */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 space-y-3 text-white text-xs"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,185,129,0.4) transparent' }}
        >
          {/* Section 1: Field Parameters (Soil, Crop, Acres) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Soil Type */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">
                {isTe ? 'పొలం నేల రకం:' : 'Soil Classification:'}
              </label>
              <select
                value={selectedSoilKey}
                onChange={(e) => setSelectedSoilKey(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {Object.keys(SOIL_TYPES).map(sKey => (
                  <option key={sKey} value={sKey} className="bg-[#0b1219]">
                    {SOIL_TYPES[sKey].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Crop */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">
                {isTe ? 'సాగు పంట:' : 'Target Crop:'}
              </label>
              <select
                value={selectedCropKey}
                onChange={(e) => setSelectedCropKey(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {Object.keys(NPK_BENCHMARKS).map(cKey => (
                  <option key={cKey} value={cKey} className="bg-[#0b1219]">
                    {cKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Acreage */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">
                {isTe ? 'విస్తీర్ణం (ఎకరాలు):' : 'Acreage (Acres):'}
              </label>
              <input
                type="number"
                step="0.5"
                min="0.25"
                max="50"
                value={acres}
                onChange={(e) => setAcres(Math.max(0.25, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Soil Diagnostic Strip */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs gap-3">
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-400">{soil.name}</span>
              <p className="text-white/60 text-[11px] leading-tight">{soil.desc}</p>
            </div>
            <div className="text-right shrink-0 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/5">
              <span className="text-[10px] text-white/50 block">pH Level</span>
              <span className="text-xs font-black text-emerald-300">{soil.pH}</span>
            </div>
          </div>

          {/* Section 2: 3 Main Commercial Fertilizer Bag Cards (Farmer-Friendly Units!) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                {isTe ? 'మొత్తం అవసరమైన ఎరువుల బస్తాల మోతాదు' : 'Total Fertilizer Bag Prescription (Whole Bags + Loose Kg)'}
              </span>
              <span className="text-[10px] text-white/40">
                {acres} {acres === 1 ? 'Acre' : 'Acres'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Card 1: Urea */}
              <div className="p-3 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/35 space-y-0.5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Nitrogen (N)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">45 kg Bag</span>
                </div>
                <p className="text-xs font-black text-white">Urea (46% N)</p>
                <div className="pt-0.5">
                  <p className="text-xl sm:text-2xl font-black text-emerald-300 tracking-tight leading-none">
                    {schedule.urea.primary}
                  </p>
                  <p className="text-[11px] text-white/60 font-semibold mt-0.5">
                    {schedule.urea.secondary}
                  </p>
                </div>
              </div>

              {/* Card 2: DAP */}
              <div className="p-3 rounded-2xl bg-sky-500/[0.07] border border-sky-500/35 space-y-0.5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">Phosphorus (P)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold">50 kg Bag</span>
                </div>
                <p className="text-xs font-black text-white">DAP (18:46:0)</p>
                <div className="pt-0.5">
                  <p className="text-xl sm:text-2xl font-black text-sky-300 tracking-tight leading-none">
                    {schedule.dap.primary}
                  </p>
                  <p className="text-[11px] text-white/60 font-semibold mt-0.5">
                    {schedule.dap.secondary}
                  </p>
                </div>
              </div>

              {/* Card 3: MOP Potash */}
              <div className="p-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/35 space-y-0.5 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Potassium (K)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">50 kg Bag</span>
                </div>
                <p className="text-xs font-black text-white">MOP Potash (60% K₂O)</p>
                <div className="pt-0.5">
                  <p className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight leading-none">
                    {schedule.mop.primary}
                  </p>
                  <p className="text-[11px] text-white/60 font-semibold mt-0.5">
                    {schedule.mop.secondary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Stage-Wise Application Schedule (All 3 Stages Prominently Displayed!) */}
          <div className="p-3.5 rounded-2xl bg-[#060b13] border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{isTe ? '3-దశల ఎరువుల వేసే షెడ్యూల్ (Fertigation Schedule)' : 'Complete 3-Stage Application Schedule'}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">
                100% Fully Visible
              </span>
            </div>

            <div className="space-y-1.5">
              {/* Stage 1: Basal */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <strong className="text-emerald-400 text-xs font-bold">
                      {isTe ? '1. ఆఖరి దుక్కిలో / నాటేటప్పుడు (Day 0 Basal):' : 'Stage 1: Basal Dressing (At Sowing / Transplanting):'}
                    </strong>
                  </div>
                  <p className="text-white/80 text-[11px] pl-4">
                    {isTe
                      ? `DAP మొత్తం (${schedule.splits.basal.dapKg} kg) + MOP ${schedule.splits.basal.mopKg} kg + యూరియా ${schedule.splits.basal.ureaKg} kg కలిపి భూమిలో వేయాలి.`
                      : `Apply 100% DAP (${schedule.splits.basal.dapKg} kg) + 50% MOP (${schedule.splits.basal.mopKg} kg) + 33% Urea (${schedule.splits.basal.ureaKg} kg). Mix 5cm into soil.`}
                  </p>
                </div>
                <span className="text-[10px] font-black text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 shrink-0 self-start sm:self-auto">
                  Day 0
                </span>
              </div>

              {/* Stage 2: Vegetative */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                    <strong className="text-sky-400 text-xs font-bold">
                      {isTe ? '2. శాఖీయ దశ / పిలకల దశ (25–30 రోజులు):' : 'Stage 2: Vegetative / Tillering Stage (25–30 DAS):'}
                    </strong>
                  </div>
                  <p className="text-white/80 text-[11px] pl-4">
                    {isTe
                      ? `రెండవ మోతాదుగా యూరియా ${schedule.splits.vegetative.ureaKg} kg తేమ ఉన్నప్పుడు పైపాటుగా చల్లాలి.`
                      : `Top-dress 33% Urea (${schedule.splits.vegetative.ureaKg} kg) after weeding under moist soil conditions.`}
                  </p>
                </div>
                <span className="text-[10px] font-black text-sky-300 px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/25 shrink-0 self-start sm:self-auto">
                  25–30 DAS
                </span>
              </div>

              {/* Stage 3: Flowering */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <strong className="text-amber-400 text-xs font-bold">
                      {isTe ? '3. పూత & పిందె కాత దశ (50–60 రోజులు):' : 'Stage 3: Flowering & Fruit Set Stage (50–60 DAS):'}
                    </strong>
                  </div>
                  <p className="text-white/80 text-[11px] pl-4">
                    {isTe
                      ? `మిగిలిన యూరియా ${schedule.splits.flowering.ureaKg} kg + మిగిలిన పొటాష్ MOP ${schedule.splits.flowering.mopKg} kg పైపాటుగా వేయాలి.`
                      : `Top-dress final 34% Urea (${schedule.splits.flowering.ureaKg} kg) + remaining 50% MOP (${schedule.splits.flowering.mopKg} kg) for fruit weight & grain sizing.`}
                  </p>
                </div>
                <span className="text-[10px] font-black text-amber-300 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 shrink-0 self-start sm:self-auto">
                  50–60 DAS
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: 20L Backpack Knapsack Sprayer Fertigation Dose */}
          <div className="p-3 rounded-2xl bg-emerald-500/[0.09] border border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>20L Backpack Knapsack Sprayer Foliar Recipe</span>
              </span>
              <span className="text-[10px] text-white/50">Morning 7–10 AM</span>
            </div>
            <p className="text-white/90 text-xs font-medium leading-relaxed">
              • <strong className="text-white">Foliar Nutrition:</strong> {crop.foliar}<br />
              • <strong className="text-white">Micronutrient Correction:</strong> {soil.micronutrientNeed}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 sm:px-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#060b12]">
          <span className="text-[11px] text-white/50 text-center sm:text-left">
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
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
            >
              {isTe ? 'ముగించు' : 'Close'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
