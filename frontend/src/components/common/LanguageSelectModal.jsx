import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, X, Sparkles, CheckCircle2, Star, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../../data/languages';

export default function LanguageSelectModal({ isOpen, onClose }) {
  const { i18n, t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const activeCode = (i18n.language ? i18n.language.split('-')[0].toLowerCase() : 'en');
  const [selectedCode, setSelectedCode] = useState(activeCode);
  const [justSwitched, setJustSwitched] = useState(null);

  const currentLang = getLanguageByCode(activeCode) || {
    name: 'English',
    nativeName: 'English (US)',
    flag: '🌐'
  };

  const handleSelectLanguage = async (code) => {
    try {
      const clean = (code || 'en').split('-')[0].toLowerCase();
      setSelectedCode(clean);
      setJustSwitched(clean);

      // 1. Immediately apply across i18n
      await i18n.changeLanguage(clean);

      // 2. Persist in local storage
      localStorage.setItem('i18nextLng', clean);

      // 3. Silently sync to user account profile in background if logged in
      if (user && updateProfile) {
        updateProfile({ preferred_language: clean }).catch((err) => {
          console.warn("Background language profile sync skipped:", err);
        });
      }

      // 4. Dispatch custom event for global UI observers
      window.dispatchEvent(new CustomEvent('agrishield-language-changed', { detail: { language: clean } }));

      // Brief animation feedback before close
      setTimeout(() => {
        setJustSwitched(null);
        onClose?.();
      }, 500);
    } catch (err) {
      console.error("Language switch error:", err);
    }
  };

  if (!isOpen) return null;

  const isTe = activeCode === 'te';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md">
        {/* Backdrop */}
        <div className="fixed inset-0" onClick={onClose} />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-3xl bg-white dark:bg-[#0f172a] border-2 border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header Banner matching Picture 4 */}
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm">
                <Globe className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isTe ? 'భాషా ప్రాధాన్యతలు & సెట్టింగ్‌లు' : 'Language Preferences & Settings'}
                  </h3>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-xs">
                    ⚡ 1-Tap Toggle
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-white/60 mt-0.5 truncate">
                  {isTe 
                    ? 'మీ ప్రాధాన్య ప్రాంతీయ భాషను ఎంచుకోండి. వెంటనే సిస్టమ్ అంతా మారుతుంది.'
                    : 'Select your preferred language. The entire website updates instantly.'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Active Language Highlight Strip (Picture 4 Style) */}
          <div className="px-5 py-3 bg-emerald-500/15 dark:bg-emerald-500/10 border-b border-emerald-500/25 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300 font-bold">
                {isTe ? 'ప్రస్తుత భాష:' : 'Active Language:'}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center gap-1 shadow-2xs">
                <span>{currentLang.flag}</span>
                <span>{currentLang.nativeName}</span>
                <span>({currentLang.name})</span>
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-extrabold hidden sm:inline flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isTe ? 'లైవ్ మార్పులు తక్షణమే వర్తిస్తాయి' : 'Live updates apply immediately'}</span>
            </span>
          </div>

          {/* Grid Title */}
          <div className="px-5 pt-3 pb-1 flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/50">
              {isTe ? 'అందుబాటులో ఉన్న భాషలు (13 ప్రాంతీయ భాషలు)' : 'Available Languages (13 Regional Locales)'}
            </h4>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              {isTe ? 'కార్డుపై ట్యాప్ చేసి యాక్టివేట్ చేయండి' : 'Tap any card to activate'}
            </span>
          </div>

          {/* Languages Rich Cards Grid (Picture 4 Aesthetics) */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3 max-h-[62vh] custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isCurrentlyActive = (activeCode || '').toLowerCase().startsWith(lang.code.toLowerCase());
                const isJustClicked = justSwitched === lang.code;

                return (
                  <motion.div
                    key={lang.code}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer ${
                      isCurrentlyActive
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/25'
                        : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]'
                    }`}
                  >
                    {/* Top Row: Flag, Name, Active Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                          isCurrentlyActive 
                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs' 
                            : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10'
                        }`}>
                          {lang.flag}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className={`text-base font-black tracking-tight ${
                              isCurrentlyActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                            }`}>
                              {lang.nativeName}
                            </h4>
                            {isCurrentlyActive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black uppercase">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-white/45 font-semibold">
                            {lang.name}
                          </p>
                        </div>
                      </div>

                      {/* Right Selection Indicator */}
                      <div>
                        {isCurrentlyActive ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs shadow-xs flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>1st</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 text-[11px] font-bold">
                            + Select
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Region & Greeting Pill */}
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-white/5">
                      <span className="text-slate-500 dark:text-white/50 truncate max-w-[170px] font-medium">
                        {lang.region}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold text-[10px] border border-slate-200/60 dark:border-white/5">
                        {lang.greeting}
                      </span>
                    </div>

                    {/* Bottom Action Button matching Picture 4 */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLanguage(lang.code);
                        }}
                        className={`w-full py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                          isCurrentlyActive
                            ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-emerald-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-700 hover:text-slate-950 dark:text-emerald-300 dark:hover:text-slate-950 border border-emerald-500/30'
                        }`}
                      >
                        {isCurrentlyActive ? (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>{isTe ? '✓ సక్రియంగా ఉంది (Active)' : '✓ Active Language'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isTe ? 'ఈ భాషను ఎంచుకోండి' : 'Activate Language'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Feedback Overlay on Click */}
                    {isJustClicked && (
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute inset-0 bg-emerald-500/25 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-emerald-900 dark:text-emerald-100 font-black text-sm z-20"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span>{isTe ? 'భాష మార్చబడింది!' : 'Language Switched!'}</span>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0b1120] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500 dark:text-white/50">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('languages_modal.footer_info', 'Telugu, Hindi, Tamil & 9 other Indian regional languages supported.')}</span>
            </span>
            <button
              onClick={onClose}
              type="button"
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black transition-all text-xs cursor-pointer shadow-xs"
            >
              {t('common.done', 'Done')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
