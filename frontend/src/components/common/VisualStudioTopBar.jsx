import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Smartphone, Monitor, RotateCcw, 
  X, Check, SlidersHorizontal, Info, Eye, Layers
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';

export default function VisualStudioTopBar() {
  const {
    isVisualEditMode,
    setIsVisualEditMode,
    previewDevice,
    setPreviewDevice,
    resetAllCardStyles,
    openDrawer,
    cardStyles
  } = useStudio();

  if (!isVisualEditMode) return null;

  const modifiedCardsCount = Object.keys(cardStyles || {}).length;
  const hiddenCardsCount = Object.values(cardStyles || {}).filter(c => c?.isHidden).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-[9990] bg-slate-950/90 backdrop-blur-xl border-b border-emerald-500/30 px-3 sm:px-6 py-2 shadow-2xl flex items-center justify-between gap-2"
      >
        {/* Left: Studio Live Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="tracking-wide hidden sm:inline">STUDIO VISUAL BUILDER</span>
            <span className="tracking-wide sm:hidden">STUDIO</span>
          </div>

          <span className="text-[11px] text-slate-400 hidden md:inline">
            Touch or hover cards to customize colors, box corners, sizes & gradients live
          </span>
        </div>

        {/* Center: Mobile vs Desktop Viewport Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              previewDevice === 'desktop'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Preview standard desktop layout"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              previewDevice === 'mobile'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Preview responsive mobile layout (390px phone view)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile (390px)</span>
            <span className="sm:hidden">Phone</span>
          </button>
        </div>

        {/* Right: Actions (Drawer, Reset, Save/Exit) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Modified Badges */}
          {modifiedCardsCount > 0 && (
            <span className="hidden lg:inline-flex text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              {modifiedCardsCount} customized
            </span>
          )}

          {hiddenCardsCount > 0 && (
            <span className="hidden lg:inline-flex text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              {hiddenCardsCount} hidden
            </span>
          )}

          {/* Reset All */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all card designs and styles across the website to original factory defaults?')) {
                resetAllCardStyles();
              }
            }}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition-all"
            title="Reset all visual edits back to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset All</span>
          </button>

          {/* Open Full Studio Drawer */}
          <button
            type="button"
            onClick={() => openDrawer('editor')}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 text-slate-200 hover:text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all"
            title="Open 50% AI + 50% Human Agronomist Studio Panel"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Full Studio</span>
          </button>

          {/* Exit Visual Mode */}
          <button
            type="button"
            onClick={() => setIsVisualEditMode(false)}
            className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
            title="Save and exit visual edit mode"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
