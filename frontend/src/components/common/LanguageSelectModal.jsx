import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../../data/languages';

export default function LanguageSelectModal({ isOpen, onClose }) {
  const { i18n, t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [selectedCode, setSelectedCode] = useState(i18n.language || 'en');
  const [justSwitched, setJustSwitched] = useState(null);

  const currentLang = getLanguageByCode(i18n.language);

  const handleSelectLanguage = async (code) => {
    try {
      setSelectedCode(code);
      setJustSwitched(code);

      // 1. Immediately apply across i18n
      await i18n.changeLanguage(code);

      // 2. Persist in local storage
      localStorage.setItem('i18nextLng', code);

      // 3. Silently sync to user account profile in background if logged in
      if (user && updateProfile) {
        updateProfile({ preferred_language: code }).catch((err) => {
          console.warn("Background language profile sync skipped:", err);
        });
      }

      // 4. Dispatch custom event for global UI observers
      window.dispatchEvent(new CustomEvent('agrishield-language-changed', { detail: { language: code } }));

      // Brief animation feedback before close
      setTimeout(() => {
        setJustSwitched(null);
        onClose?.();
      }, 450);
    } catch (err) {
      console.error("Language switch error:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
        {/* Backdrop */}
        <div className="fixed inset-0" onClick={onClose} />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-white dark:bg-[#151a21] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header Banner */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
                <Globe className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {t('languages_modal.title', 'Choose System Language / భాషను ఎంచుకోండి')}
                  </h3>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                    1-Tap Instant Switch
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5 truncate">
                  {t('languages_modal.subtitle', 'Tap any regional language to switch immediately without saving.')}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Active Language Highlight Strip */}
          <div className="px-5 py-2.5 bg-emerald-500/10 dark:bg-emerald-500/[0.06] border-b border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <span>{t('languages_modal.current_active', 'Active Language')}:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                {currentLang.nativeName} ({currentLang.name})
              </strong>
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold hidden sm:inline">
              ⚡ {t('languages_modal.no_save_needed', 'No save button needed • Changes apply live')}
            </span>
          </div>

          {/* Languages Grid */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 max-h-[60vh] custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = (selectedCode || '').toLowerCase().startsWith(lang.code.toLowerCase());
                const isJustClicked = justSwitched === lang.code;

                return (
                  <motion.button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`relative p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/25'
                        : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                        isActive 
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs' 
                          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200'
                      }`}>
                        {lang.flag}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-black tracking-tight ${
                            isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                          }`}>
                            {lang.nativeName}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-white/40 font-semibold">
                            {lang.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5 truncate">
                          {lang.region}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/5">
                        {lang.greeting}
                      </span>
                      {isActive ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-white/20" />
                      )}
                    </div>

                    {isJustClicked && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-200 font-extrabold text-sm"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span>Applied!</span>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Footer note */}
          <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-white/40">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('languages_modal.footer_info', 'Telugu, Hindi, Tamil & 9 other Indian regional languages supported.')}</span>
            </span>
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-white font-bold transition-all text-xs cursor-pointer"
            >
              {t('common.done', 'Done')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
