import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Check, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Badge } from '../components/ui/index';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../data/languages';

export default function LanguagesPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
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

      // Clear switch badge
      setTimeout(() => {
        setJustSwitched(null);
      }, 1000);
    } catch (err) {
      console.error("Language switch error:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-6 pb-20 w-full"
    >
      {/* Top Navigation & Back Button */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/more')}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] hover:bg-slate-100 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('languages_page.back_to_more', '← Back to More (ఇతర సేవలు)')}</span>
        </button>

        <Badge variant="healthy" size="sm" className="font-black">
          1-Tap Instant Live Switch
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col gap-1 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-sm">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('languages_page.title', 'System Languages / భాషల ఎంపిక')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-0.5">
              {t('languages_page.subtitle', 'Choose your preferred regional language. Live changes apply instantly without requiring any Save Changes button.')}
            </p>
          </div>
        </div>
      </div>

      {/* Active Language Status Card */}
      <Card glass className="p-4 sm:p-5 border-emerald-500/30 bg-emerald-500/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{currentLang.flag}</span>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {t('languages_page.currently_active', 'Currently Active Language')}
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {currentLang.nativeName} ({currentLang.name})
            </h3>
            <p className="text-xs text-slate-500 dark:text-white/50">
              {currentLang.region} • Greeting: <strong>"{currentLang.greeting}"</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-xs flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Active</span>
          </span>
        </div>
      </Card>

      {/* 12 Regional Language Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/40">
            {t('languages_page.available_languages', 'Available Indian Languages (12 Locales)')}
          </h2>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            ⚡ Tap to select
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = (selectedCode || '').toLowerCase().startsWith(lang.code.toLowerCase());
            const isJustClicked = justSwitched === lang.code;

            return (
              <motion.button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code)}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                  isActive
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/25'
                    : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                      isActive 
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs' 
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10'
                    }`}>
                      {lang.flag}
                    </div>
                    <div>
                      <h4 className={`text-base font-black tracking-tight ${
                        isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                      }`}>
                        {lang.nativeName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-white/45 font-semibold">
                        {lang.name}
                      </p>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-white/20 shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-white/40 truncate max-w-[150px]">
                    {lang.region}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                    {lang.greeting}
                  </span>
                </div>

                {isJustClicked && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-emerald-500/25 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-emerald-950 dark:text-emerald-100 font-black text-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Applied Live!</span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Helpful Info Note */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 flex items-center gap-3 text-xs text-slate-500 dark:text-white/40">
        <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
        <span>
          {t('languages_page.instant_notice', 'Languages switched here take effect globally across all pages, AI diagnostics, voice agronomist consultations, and weather forecasts without requiring you to submit any profile forms.')}
        </span>
      </div>
    </motion.div>
  );
}
