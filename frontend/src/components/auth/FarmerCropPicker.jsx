import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, AlertCircle, Info } from 'lucide-react';

export const SUPPORTED_AI_CROPS = [
  { id: 'Tomato', name: 'Tomato', teluguName: 'టమాటా', emoji: '🍅', category: 'Vegetable' },
  { id: 'Chilli', name: 'Chilli', teluguName: 'మిరప', emoji: '🌶️', category: 'Spice' },
  { id: 'Rice', name: 'Rice / Paddy', teluguName: 'వరి', emoji: '🌾', category: 'Cereal' },
  { id: 'Cotton', name: 'Cotton', teluguName: 'పత్తి', emoji: '🧶', category: 'Fiber' },
  { id: 'Corn', name: 'Corn / Maize', teluguName: 'మొక్కజొన్న', emoji: '🌽', category: 'Cereal' },
  { id: 'Potato', name: 'Potato', teluguName: 'బంగాళాదుంప', emoji: '🥔', category: 'Tuber' },
  { id: 'Wheat', name: 'Wheat', teluguName: 'గోధుమ', emoji: '🌾', category: 'Cereal' },
  { id: 'Bell Pepper', name: 'Bell Pepper / Capsicum', teluguName: 'క్యాప్సికమ్', emoji: '🫑', category: 'Vegetable' },
  { id: 'Grape', name: 'Grape', teluguName: 'ద్రాక్ష', emoji: '🍇', category: 'Fruit' },
  { id: 'Apple', name: 'Apple', teluguName: 'యాపిల్', emoji: '🍎', category: 'Fruit' },
  { id: 'Mango', name: 'Mango', teluguName: 'మామిడి', emoji: '🥭', category: 'Horticulture' },
  { id: 'Sugarcane', name: 'Sugarcane', teluguName: 'చెరకు', emoji: '🎋', category: 'Cash Crop' },
  { id: 'Banana', name: 'Banana', teluguName: 'అరటి', emoji: '🍌', category: 'Fruit' },
  { id: 'Soybean', name: 'Soybean', teluguName: 'సోయాబీన్', emoji: '🫘', category: 'Legume' }
];

export default function FarmerCropPicker({ selectedCrops = [], onChange, isTe = false, maxCrops = 8 }) {
  const toggleCrop = (cropId) => {
    if (selectedCrops.includes(cropId)) {
      onChange(selectedCrops.filter((id) => id !== cropId));
    } else {
      if (selectedCrops.length >= maxCrops) {
        return;
      }
      onChange([...selectedCrops, cropId]);
    }
  };

  const isMaxReached = selectedCrops.length >= maxCrops;

  return (
    <div className="space-y-3">
      {/* Header with counter */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span>{isTe ? 'మీరు పండించే 8 ప్రధాన పంటలను ఎంచుకోండి' : 'Select Your 8 Primary Crops to Scan'}</span>
            <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {isTe
              ? 'ఈ ఎంపిక బ్యాకెండ్ మోడల్ వేగాన్ని పెంచి, మీ పంటల కోసం ఖచ్చితమైన AI నిర్ధారణ ఫలితాలను అందిస్తుంది.'
              : 'Pre-configures AI disease pipelines for your crops, reduces server load, and speeds up scan results.'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black border transition-all ${
              selectedCrops.length > 0
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}
          >
            {selectedCrops.length} / {maxCrops} {isTe ? 'ఎంచుకున్నారు' : 'Selected'}
          </span>
        </div>
      </div>

      {/* 14 Crops Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {SUPPORTED_AI_CROPS.map((crop) => {
          const isSelected = selectedCrops.includes(crop.id);
          const isDisabled = !isSelected && isMaxReached;

          return (
            <motion.button
              key={crop.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleCrop(crop.id)}
              disabled={isDisabled}
              className={`flex items-center gap-2 p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-400 shadow-sm shadow-emerald-500/10'
                  : isDisabled
                  ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shrink-0">
                {crop.emoji}
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                  {isTe ? crop.teluguName : crop.name}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold truncate">
                  {isTe ? crop.name : crop.category}
                </p>
              </div>

              {isSelected && (
                <div className="absolute top-2.5 right-2 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {selectedCrops.length === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{isTe ? 'దయచేసి కనీసం 1 పంటను ఎంచుకోండి (గరిష్టంగా 8).' : 'Please select at least 1 crop (up to 8).'}</span>
        </p>
      )}
    </div>
  );
}
