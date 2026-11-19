import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';

const CROPS = [
  { value: 'Chilli', nameEn: 'Chilli', nameTe: 'మిరప', icon: '🌶️', color: 'border-rose-400 bg-rose-50/70 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' },
  { value: 'Tomato', nameEn: 'Tomato', nameTe: 'టమాటా', icon: '🍅', color: 'border-red-400 bg-red-50/70 hover:bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200' },
  { value: 'Rice', nameEn: 'Paddy / Rice', nameTe: 'వరి', icon: '🌾', color: 'border-amber-400 bg-amber-50/70 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' },
  { value: 'Cotton', nameEn: 'Cotton', nameTe: 'పత్తి', icon: '🌿', color: 'border-emerald-400 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  { value: 'Maize', nameEn: 'Maize (Corn)', nameTe: 'మొక్కజొన్న', icon: '🌽', color: 'border-yellow-400 bg-yellow-50/70 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200' },
  { value: 'Groundnut', nameEn: 'Groundnut', nameTe: 'వేరుశనగ', icon: '🥜', color: 'border-orange-400 bg-orange-50/70 hover:bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200' },
  { value: 'Sugarcane', nameEn: 'Sugarcane', nameTe: 'చెరకు', icon: '🎋', color: 'border-teal-400 bg-teal-50/70 hover:bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200' },
  { value: 'Banana', nameEn: 'Banana', nameTe: 'అరటి', icon: '🍌', color: 'border-yellow-300 bg-yellow-50/60 hover:bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200' },
  { value: 'Mango', nameEn: 'Mango', nameTe: 'మామిడి', icon: '🥭', color: 'border-orange-300 bg-orange-50/60 hover:bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200' },
  { value: 'Potato', nameEn: 'Potato', nameTe: 'బంగాళాదుంప', icon: '🥔', color: 'border-stone-400 bg-stone-50/70 hover:bg-stone-100 text-stone-800 dark:bg-stone-950/40 dark:text-stone-200' },
  { value: 'Onion', nameEn: 'Onion', nameTe: 'ఉల్లి', icon: '🧅', color: 'border-purple-400 bg-purple-50/70 hover:bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200' },
  { value: '', nameEn: 'All Crops (Generic)', nameTe: 'అన్ని పంటలు', icon: '🌱', color: 'border-slate-300 bg-slate-50/80 hover:bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' }
];

export const QuickCropSelectorModal = ({ isOpen, onClose, onSelectCrop, activeLang = 'te' }) => {
  const isTe = activeLang === 'te';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-800/40">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                🌿
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                  {isTe ? 'పంటను ఎంచుకోండి' : 'Select Your Crop Family'}
                </h3>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <Sparkles className="w-3 h-3" />
                  {isTe ? '98%+ ఖచ్చితమైన నిర్ధారణ కోసం' : 'Locks 98%+ Diagnostic Precision'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtext info */}
          <div className="px-4 py-2 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 text-[11px] text-slate-600 dark:text-slate-300">
            {isTe 
              ? 'మీరు ఎంచుకున్న పంట ప్రత్యేక మైక్రో-మోడల్‌తో విశ్లేషణ జరుగుతుంది. ఇతర పంటల లక్షణాలు తొలగించబడతాయి.'
              : 'Routes exclusively to this crop’s dedicated micro-model, silencing irrelevant diseases for instant, error-free results.'}
          </div>

          {/* Crops Grid */}
          <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CROPS.map((crop) => (
              <button
                key={crop.value || 'all'}
                type="button"
                onClick={() => onSelectCrop(crop.value)}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all active:scale-[0.97] cursor-pointer shadow-xs ${crop.color}`}
              >
                <span className="text-2xl shrink-0">{crop.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black truncate leading-tight">
                    {isTe ? crop.nameTe : crop.nameEn}
                  </p>
                  <p className="text-[10px] opacity-75 truncate">
                    {isTe ? crop.nameEn : crop.nameTe}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer note */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 text-center shrink-0">
            <button
              type="button"
              onClick={() => onSelectCrop('')}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              {isTe ? 'పంట తెలియదా? అన్ని పంటల సాధారణ విశ్లేషణను ప్రారంభించండి →' : "Don't know the crop? Run generic All-Crops scan →"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QuickCropSelectorModal;
