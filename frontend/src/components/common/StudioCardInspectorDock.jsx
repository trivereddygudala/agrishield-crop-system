import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Box, Maximize2, Trash2, RotateCcw, 
  ChevronUp, ChevronDown, Check, Eye, EyeOff, 
  Edit3, Sparkles, X, SlidersHorizontal, SunMedium
} from 'lucide-react';
import { 
  useStudio, 
  STUDIO_GRADIENTS, 
  STUDIO_BORDERS, 
  STUDIO_GLOWS, 
  STUDIO_PADDINGS, 
  STUDIO_SCALES 
} from '../../context/StudioContext';

export default function StudioCardInspectorDock() {
  return null;
}

function _unusedStudioCardInspectorDock() {
  const {
    isVisualEditMode,
    activeCardKey,
    setActiveCardKey,
    cardStyles,
    updateCardStyle,
    resetCardStyle,
    toggleCardHidden
  } = useStudio();

  // Active sub-menu: null | 'colors' | 'boxes' | 'sizes' | 'text'
  const [activeMenu, setActiveMenu] = useState('colors'); // default to colors for immediate feedback
  const [editText, setEditText] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const currentStyle = activeCardKey ? (cardStyles?.[activeCardKey] || {}) : {};

  // Sync title and description when card changes
  useEffect(() => {
    if (activeCardKey) {
      setEditText(currentStyle.titleOverride || '');
      setEditDesc(currentStyle.descOverride || '');
    }
  }, [activeCardKey, currentStyle.titleOverride, currentStyle.descOverride]);

  if (!isVisualEditMode || !activeCardKey) {
    return null;
  }

  // Format readable card name
  const formattedName = activeCardKey
    .replace(/^dashboard-/, '')
    .replace(/^landing-/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed bottom-4 sm:bottom-6 left-2 right-2 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-[9995] max-w-xl w-full sm:w-[580px] bg-slate-950/98 backdrop-blur-2xl border-2 border-emerald-500/60 rounded-3xl shadow-2xl shadow-black/90 p-3 sm:p-4 text-white select-none ring-1 ring-emerald-400/40"
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block leading-tight">
                Editing Card
              </span>
              <h4 className="text-xs sm:text-sm font-black text-white truncate">
                {currentStyle.titleOverride || formattedName}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Reset Card */}
            <button
              type="button"
              onClick={() => resetCardStyle(activeCardKey)}
              className="p-1.5 px-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1 transition-all"
              title="Reset this card to factory style"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Hide Card */}
            <button
              type="button"
              onClick={() => {
                toggleCardHidden(activeCardKey);
                setActiveCardKey(null);
              }}
              className="p-1.5 px-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1 transition-all"
              title="Hide this card from site"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hide</span>
            </button>

            {/* Close Inspector */}
            <button
              type="button"
              onClick={() => setActiveCardKey(null)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close card inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feature Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 mb-3 text-xs">
          {[
            { id: 'colors', label: 'Colors', icon: Palette },
            { id: 'boxes', label: 'Boxes & Glow', icon: Box },
            { id: 'sizes', label: 'Size & Padding', icon: Maximize2 },
            { id: 'text', label: 'Edit Text', icon: Edit3 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMenu === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMenu(tab.id)}
                className={`py-1.5 px-1 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Submenu: 1. Colors & Gradients */}
        {activeMenu === 'colors' && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-bold text-slate-400">Select Gradient Theme:</span>
              <button
                type="button"
                onClick={() => updateCardStyle(activeCardKey, { gradientId: null })}
                className="text-[10px] text-slate-400 hover:text-white underline"
              >
                Default Style
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {Object.values(STUDIO_GRADIENTS).map((g) => {
                const isActive = currentStyle.gradientId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => updateCardStyle(activeCardKey, { gradientId: g.id })}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all ${
                      isActive
                        ? 'border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/80 scale-105 shadow-md'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <div 
                      className="w-5 h-5 rounded-full border border-white/30 shadow-inner"
                      style={{ backgroundColor: g.accentColor }}
                    />
                    <span className="text-[9px] font-bold text-slate-300 truncate w-full text-center">
                      {g.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Submenu: 2. Boxes & Glow */}
        {activeMenu === 'boxes' && (
          <div className="space-y-2.5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Corner Curvature:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.values(STUDIO_BORDERS).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => updateCardStyle(activeCardKey, { borderStyle: b.id })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-extrabold border transition-all ${
                      (currentStyle.borderStyle || 'rounded-2xl') === b.id
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {b.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Neon Border Glow:</span>
              <div className="grid grid-cols-6 gap-1">
                {Object.values(STUDIO_GLOWS).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => updateCardStyle(activeCardKey, { borderGlow: g.id })}
                    className={`py-1 px-1 rounded-xl text-[10px] font-bold border capitalize truncate transition-all ${
                      (currentStyle.borderGlow || 'none') === g.id
                        ? 'border-rose-400 bg-rose-500/20 text-rose-300 ring-1 ring-rose-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {g.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submenu: 3. Size & Padding */}
        {activeMenu === 'sizes' && (
          <div className="space-y-2.5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Internal Padding:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.values(STUDIO_PADDINGS).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateCardStyle(activeCardKey, { cardPadding: p.id })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-extrabold border transition-all ${
                      currentStyle.cardPadding === p.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Card Scale:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.values(STUDIO_SCALES).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateCardStyle(activeCardKey, { cardScale: s.id })}
                    className={`py-1.5 px-2 rounded-xl text-xs font-extrabold border transition-all ${
                      (currentStyle.cardScale || 'normal') === s.id
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submenu: 4. In-Place Text Editor */}
        {activeMenu === 'text' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  updateCardStyle(activeCardKey, { titleOverride: e.target.value });
                }}
                placeholder="Custom card title..."
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => {
                  setEditText('');
                  updateCardStyle(activeCardKey, { titleOverride: undefined });
                }}
                className="px-2.5 py-1.5 bg-slate-850 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
              >
                Reset Text
              </button>
            </div>
            <textarea
              rows={2}
              value={editDesc}
              onChange={(e) => {
                setEditDesc(e.target.value);
                updateCardStyle(activeCardKey, { descOverride: e.target.value });
              }}
              placeholder="Custom card subtitle or description..."
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
