import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, CheckCircle2, AlertTriangle, ShieldCheck, 
  ChevronRight, Share2, Layers, Calendar, Sprout, ArrowRight,
  Sparkles, RefreshCw, X, Info
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
  "Tomato": { name: "Tomato", N: 55, P: 30, K: 45, basalSplit: "35% N + 100% P + 50% K", foliar: "NPK 19:19:19 @ 100g/20L tank at flowering" },
  "Paddy (Rice)": { name: "Paddy (Rice)", N: 48, P: 24, K: 24, basalSplit: "50% N + 100% P + 50% K", foliar: "Zinc Sulphate 21% @ 40g/20L tank at 30 DAS" },
  "Maize (Corn)": { name: "Maize (Corn)", N: 50, P: 25, K: 20, basalSplit: "33% N + 100% P + 50% K", foliar: "Urea 2% foliar spray or 19:19:19 before tasseling" },
  "Red Chilli": { name: "Red Chilli", N: 60, P: 30, K: 35, basalSplit: "30% N + 100% P + 40% K", foliar: "Potassium Nitrate 13:0:45 @ 100g/20L tank during pod fill" },
  "Cotton": { name: "Cotton", N: 45, P: 22, K: 22, basalSplit: "25% N + 100% P + 50% K", foliar: "Magnesium Sulphate @ 80g/20L tank at boll formation" },
  "Wheat": { name: "Wheat", N: 48, P: 24, K: 16, basalSplit: "50% N + 100% P + 100% K", foliar: "NPK 0:52:34 @ 100g/20L tank at flag leaf stage" }
};

export default function SoilNPKCalculatorModal({ isOpen, onClose, initialCrop = "Tomato", initialAcres = 2.0 }) {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [selectedSoilKey, setSelectedSoilKey] = useState("red_loamy");
  const [selectedCropKey, setSelectedCropKey] = useState(
    NPK_BENCHMARKS[initialCrop] ? initialCrop : "Tomato"
  );
  const [acres, setAcres] = useState(initialAcres || 2.0);
  const [useDAP, setUseDAP] = useState(true); // DAP vs SSP

  const soil = SOIL_TYPES[selectedSoilKey] || SOIL_TYPES["red_loamy"];
  const crop = NPK_BENCHMARKS[selectedCropKey] || NPK_BENCHMARKS["Tomato"];

  // Fertilizer Bag Calculation
  const schedule = useMemo(() => {
    // 1. Calculate elemental requirements adjusted for soil deficit
    const totalN = Math.round(crop.N * acres * soil.nDeficit);
    const totalP = Math.round(crop.P * acres * soil.pDeficit);
    const totalK = Math.round(crop.K * acres * soil.kDeficit);

    // 2. Commercial Bag Conversions (DAP 18:46:0 has 18% N, 46% P; Urea 46% N; MOP 60% K)
    let dapBags = 0;
    let sspBags = 0;
    let ureaBags = 0;
    let mopBags = 0;

    if (useDAP) {
      // 50kg bag of DAP provides 23kg P2O5 and 9kg N
      dapBags = +(totalP / 23).toFixed(1);
      const nFromDAP = dapBags * 9;
      const remainingN = Math.max(0, totalN - nFromDAP);
      // 45kg bag of Urea provides 20.7kg N (46%)
      ureaBags = +(remainingN / 20.7).toFixed(1);
    } else {
      // SSP provides 16% P2O5 -> 50kg bag has 8kg P2O5
      sspBags = +(totalP / 8).toFixed(1);
      ureaBags = +(totalN / 20.7).toFixed(1);
    }

    // 50kg bag of MOP provides 30kg K2O (60%)
    mopBags = +(totalK / 30).toFixed(1);

    return {
      totalN,
      totalP,
      totalK,
      dapBags,
      sspBags,
      ureaBags,
      mopBags,
    };
  }, [crop, soil, acres, useDAP]);

  const shareSchedule = () => {
    const text = isTe
      ? `🧪 *అగ్రిషీల్డ్ స్మార్ట్ ఎరువుల షెడ్యూల్ (NPK):*%0A` +
        `• పంట: ${crop.name} (${acres} ఎకరాలు)%0A` +
        `• నేల రకం: ${soil.name} (pH ${soil.pH})%0A` +
        `• అవసరమైన ఎరువుల బస్తాలు:%0A` +
        `  - యూరియా (46% N): *${schedule.ureaBags} బస్తాలు* (45kg)%0A` +
        `  - DAP (18:46:0): *${schedule.dapBags} బస్తాలు* (50kg)%0A` +
        `  - పొటాష్ MOP (60% K): *${schedule.mopBags} బస్తాలు* (50kg)%0A` +
        `• సూక్ష్మపోషకాలు: ${soil.micronutrientNeed}%0A` +
        `• స్ప్రేయర్ మోతాదు: ${crop.foliar}%0A` +
        `అగ్రిషీల్డ్ ICAR నార్మ్స్ ద్వారా లెక్కించబడింది.`
      : `🧪 *AgriShield Precision Soil NPK Fertilizer Schedule:*%0A` +
        `• Crop: ${crop.name} (${acres} Acres)%0A` +
        `• Soil: ${soil.name} (pH ${soil.pH})%0A` +
        `• Fertilizer Bag Prescription:%0A` +
        `  - Urea (46% N): *${schedule.ureaBags} Bags* (45kg)%0A` +
        `  - DAP (18:46:0): *${schedule.dapBags} Bags* (50kg)%0A` +
        `  - MOP / Potash (60% K): *${schedule.mopBags} Bags* (50kg)%0A` +
        `• Micronutrient: ${soil.micronutrientNeed}%0A` +
        `• Backpack Sprayer Foliar: ${crop.foliar}%0A` +
        `Certified via AgriShield AI Farm Sentinel.`;

    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#080d14] border border-emerald-500/25 shadow-2xl shadow-black/80 overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-white/[0.015]">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Soil Health Card
                </span>
                <span className="text-[10px] text-white/40">ICAR Stage-Wise Fertigation</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                {isTe ? 'స్మార్ట్ నేల పోషకాలు & NPK ఎరువుల కాలిక్యులేటర్' : 'Smart Soil Health & NPK Fertilizer Calculator'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 no-scrollbar">
          {/* Top Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Soil Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                {isTe ? 'పొలం నేల రకం:' : 'Soil Classification:'}
              </label>
              <select
                value={selectedSoilKey}
                onChange={(e) => setSelectedSoilKey(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {Object.keys(SOIL_TYPES).map(sKey => (
                  <option key={sKey} value={sKey} className="bg-[#0b1219]">
                    {SOIL_TYPES[sKey].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Crop */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                {isTe ? 'సాగు చేసే పంట:' : 'Cultivated Crop:'}
              </label>
              <select
                value={selectedCropKey}
                onChange={(e) => setSelectedCropKey(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {Object.keys(NPK_BENCHMARKS).map(cKey => (
                  <option key={cKey} value={cKey} className="bg-[#0b1219]">
                    {cKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Acreage */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                {isTe ? 'విస్తీర్ణం (ఎకరాలు):' : 'Acreage (Acres):'}
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={acres}
                onChange={(e) => setAcres(Math.max(0.25, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Soil Diagnostic Banner */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-400">{soil.name} Characteristics:</span>
              <p className="text-white/60">{soil.desc}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-white/40 block">Soil pH</span>
              <span className="text-sm font-black text-white">{soil.pH}</span>
            </div>
          </div>

          {/* 3 Main Commercial Fertilizer Bag Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Urea */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Nitrogen (N)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">45 kg Bag</span>
              </div>
              <p className="text-sm font-black text-white">Urea (46% N)</p>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-3xl font-black text-white">{schedule.ureaBags}</span>
                <span className="text-xs font-bold text-emerald-400">Bags</span>
              </div>
              <p className="text-[11px] text-white/50">Total {schedule.totalN} kg elemental N</p>
            </div>

            {/* Card 2: DAP */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-sky-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400">Phosphorus (P)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold">50 kg Bag</span>
              </div>
              <p className="text-sm font-black text-white">DAP (18:46:0)</p>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-3xl font-black text-white">{schedule.dapBags}</span>
                <span className="text-xs font-bold text-sky-400">Bags</span>
              </div>
              <p className="text-[11px] text-white/50">Total {schedule.totalP} kg elemental P₂O₅</p>
            </div>

            {/* Card 3: MOP Potash */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Potassium (K)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">50 kg Bag</span>
              </div>
              <p className="text-sm font-black text-white">MOP (60% K₂O)</p>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-3xl font-black text-white">{schedule.mopBags}</span>
                <span className="text-xs font-bold text-amber-400">Bags</span>
              </div>
              <p className="text-[11px] text-white/50">Total {schedule.totalK} kg elemental K₂O</p>
            </div>
          </div>

          {/* Growth Stage Application Splits */}
          <div className="p-4 rounded-2xl bg-[#060a10] border border-white/10 space-y-3">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>{isTe ? 'దశలవారీగా ఎరువుల వేసే షెడ్యూల్ (Split Timing):' : 'Stage-Wise Application Schedule:'}</span>
            </span>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-3">
                <div>
                  <strong className="text-emerald-400 block">1. Basal Application (At Sowing / Transplanting):</strong>
                  <span className="text-white/60">Apply 100% of DAP ({schedule.dapBags} bags) + 50% MOP + 33% Urea. Mix into furrow 5cm below seed.</span>
                </div>
                <span className="text-[10px] font-bold text-white/40 shrink-0">Day 0</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-3">
                <div>
                  <strong className="text-sky-400 block">2. Vegetative / Tillering Stage (25–30 DAS):</strong>
                  <span className="text-white/60">Top-dress 33% Urea top-coat under moist soil conditions after weeding.</span>
                </div>
                <span className="text-[10px] font-bold text-white/40 shrink-0">25-30 DAS</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start justify-between gap-3">
                <div>
                  <strong className="text-amber-400 block">3. Flowering / Fruit Set Stage (50–60 DAS):</strong>
                  <span className="text-white/60">Top-dress remaining 33% Urea + remaining 50% MOP for grain density and fruit sizing.</span>
                </div>
                <span className="text-[10px] font-bold text-white/40 shrink-0">50-60 DAS</span>
              </div>
            </div>
          </div>

          {/* 20L Backpack Knapsack Sprayer Fertigation Dose */}
          <div className="p-4 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-1.5 text-xs">
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>20L Backpack Knapsack Sprayer Foliar Dose</span>
            </span>
            <p className="text-white/90 font-medium">
              {crop.foliar}. Micronutrient supplement: {soil.micronutrientNeed}. Spray in early morning before 10 AM.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 sm:px-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.01]">
          <span className="text-[11px] text-white/40">
            Calculated in accordance with ICAR & State Agricultural University (SAU) Fertilizer Norms.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={shareSchedule}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isTe ? 'WhatsApp లో పంపండి' : 'Share on WhatsApp'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
