import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, Check, ArrowLeft, CheckCircle2, Sparkles, Plus, 
  Trash2, Save, AlertCircle, Info, Star
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Card, Button, Badge } from '../../components/ui/index';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../../data/languages';

/**
 * Full Standalone Languages Management Tab.
 * Direct in-page configuration for 1 to 3 preferred quick-access languages.
 * Never redirects to another tab or the farmer profile.
 */
export default function LanguagesPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  // Currently active system language
  const [activeCode, setActiveCode] = useState(i18n.language ? i18n.language.split('-')[0].toLowerCase() : 'en');
  
  // 1 to 3 preferred languages strictly selected by farmer
  const [selectedLangs, setSelectedLangs] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('agrishield_preferred_languages'));
      if (Array.isArray(cached) && cached.length > 0) {
        return cached.slice(0, 3);
      }
    } catch (_) {}
    if (user?.preferred_languages && Array.isArray(user.preferred_languages) && user.preferred_languages.length > 0) {
      return user.preferred_languages.slice(0, 3);
    }
    return ['te', 'en'];
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const [justSwitched, setJustSwitched] = useState(null);

  // Sync state if active language changed externally
  useEffect(() => {
    if (i18n.language) {
      setActiveCode(i18n.language.split('-')[0].toLowerCase());
    }
  }, [i18n.language]);

  // Toggle selection for 1-3 languages directly in-page
  const handleToggleLanguage = (code) => {
    setErrorNotice('');
    setSaveSuccess(false);

    const clean = (code || '').toLowerCase();
    const isSelected = selectedLangs.includes(clean);

    if (isSelected) {
      if (selectedLangs.length <= 1) {
        setErrorNotice(
          activeCode === 'te' 
            ? 'కనీసం 1 భాష ఎంపికలో ఉండాలి.' 
            : 'You must have at least 1 language selected.'
        );
        return;
      }
      setSelectedLangs(selectedLangs.filter(c => c !== clean));
    } else {
      if (selectedLangs.length >= 3) {
        setErrorNotice(
          activeCode === 'te'
            ? 'గరిష్టంగా 3 భాషలు మాత్రమే ఎంచుకోవచ్చు. మరొకటి జోడించడానికి ముందుగా ఉన్నదాన్ని తొలగించండి.'
            : 'Maximum 3 languages allowed. Tap an existing selected language to remove it first.'
        );
        return;
      }
      setSelectedLangs([...selectedLangs, clean]);
    }
  };

  // Set language as 1st primary
  const handleMakePrimary = (code) => {
    const clean = (code || '').toLowerCase();
    const rest = selectedLangs.filter(c => c !== clean);
    setSelectedLangs([clean, ...rest]);
    setSaveSuccess(false);
  };

  // Save changes directly in this tab with ZERO redirects
  const handleSavePreferences = async () => {
    try {
      setErrorNotice('');

      // 1. Persist to localStorage for top navbar & scan centers
      localStorage.setItem('agrishield_preferred_languages', JSON.stringify(selectedLangs));

      // 2. If current active language is not among selected, switch to 1st chosen language
      if (!selectedLangs.includes(activeCode)) {
        const nextLang = selectedLangs[0] || 'te';
        await i18n.changeLanguage(nextLang);
        localStorage.setItem('i18nextLng', nextLang);
        setActiveCode(nextLang);
      }

      // 3. Dispatch real-time event for top Navbar & Scan Centers
      window.dispatchEvent(
        new CustomEvent('agrishield-preferred-languages-updated', {
          detail: { languages: selectedLangs }
        })
      );
      window.dispatchEvent(
        new CustomEvent('agrishield-language-changed', {
          detail: { language: activeCode }
        })
      );

      // 4. Background profile sync if logged in (silently without leaving page)
      if (user && updateProfile) {
        updateProfile({ preferred_languages: selectedLangs }).catch((err) => {
          console.warn("Background language profile sync skipped:", err);
        });
      }

      // 5. Show in-page confirmation banner
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      console.error("Save language preferences error:", err);
      setErrorNotice('Failed to save language preferences. Please try again.');
    }
  };

  // Instant 1-tap live activation of any language
  const handleActivateLive = async (code) => {
    try {
      const clean = (code || '').toLowerCase();
      setActiveCode(clean);
      setJustSwitched(clean);

      // Ensure it is in selected languages so it appears in quick buttons
      if (!selectedLangs.includes(clean)) {
        if (selectedLangs.length < 3) {
          const updated = [clean, ...selectedLangs];
          setSelectedLangs(updated);
          localStorage.setItem('agrishield_preferred_languages', JSON.stringify(updated));
          window.dispatchEvent(
            new CustomEvent('agrishield-preferred-languages-updated', {
              detail: { languages: updated }
            })
          );
        } else {
          // Replace last one with the newly active language
          const updated = [clean, selectedLangs[0], selectedLangs[1]];
          setSelectedLangs(updated);
          localStorage.setItem('agrishield_preferred_languages', JSON.stringify(updated));
          window.dispatchEvent(
            new CustomEvent('agrishield-preferred-languages-updated', {
              detail: { languages: updated }
            })
          );
        }
      }

      await i18n.changeLanguage(clean);
      localStorage.setItem('i18nextLng', clean);

      window.dispatchEvent(
        new CustomEvent('agrishield-language-changed', {
          detail: { language: clean }
        })
      );

      if (user && updateProfile) {
        updateProfile({ preferred_language: clean }).catch(() => {});
      }

      setTimeout(() => setJustSwitched(null), 1200);
    } catch (err) {
      console.error("Live activation error:", err);
    }
  };

  const currentLangObj = getLanguageByCode(activeCode);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-6 pb-24 w-full"
    >
      {/* Top Navigation & Back Button */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/more')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{activeCode === 'te' ? '← వెనుకకు (మరిన్ని సేవలు)' : '← Back to More'}</span>
        </button>

        <Badge variant="healthy" size="sm" className="font-black">
          {activeCode === 'te' ? 'పూర్తి భాషా నియంత్రణ' : 'Full Language Hub'}
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col gap-1 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {activeCode === 'te' ? 'భాషల ఎంపిక & సెట్టింగ్‌లు' : 'Language Preferences & Settings'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-white/50 mt-0.5">
              {activeCode === 'te' 
                ? 'మీరు ఎంచుకున్న 1 నుండి 3 భాషలు మాత్రమే పై హెడర్ బార్ మరియు స్కాన్ రిజల్ట్స్‌లో 1-ట్యాప్ బటన్లుగా కనిపిస్తాయి.' 
                : 'Select your 1 to 3 preferred languages. These appear as 1-tap quick buttons in your top header and scan results.'}
            </p>
          </div>
        </div>
      </div>

      {/* In-Page Success & Error Alerts */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-900 dark:text-emerald-200 flex items-center gap-3 text-xs sm:text-sm font-bold shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <span>
                {activeCode === 'te' 
                  ? 'భాషా ప్రాధాన్యతలు విజయవంతంగా భద్రపరచబడ్డాయి! పై బార్‌లో మరియు స్కాన్ సెంటర్లలో మీ ఎంపికలు నవీకరించబడ్డాయి.' 
                  : 'Preferences saved successfully! Your 1-tap buttons in the top bar and scan centers are now updated.'}
              </span>
            </div>
          </motion.div>
        )}

        {errorNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-900 dark:text-rose-200 flex items-center gap-3 text-xs sm:text-sm font-bold shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <div className="flex-1">
              <span>{errorNotice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================
          CARD 1: LIVE 1-TO-3 QUICK BUTTONS PREVIEW & SAVE
         ======================================================== */}
      <Card glass className="p-4 sm:p-6 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-slate-900/5 rounded-3xl space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {activeCode === 'te' ? 'మీ క్విక్-స్విచ్ బటన్లు (1 నుండి 3 భాషలు)' : 'Your 1-Tap Quick Buttons (1 to 3 Languages)'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {selectedLangs.length} / 3 {activeCode === 'te' ? 'ఎంపికయ్యాయి' : 'Selected'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
              {activeCode === 'te' 
                ? 'ఈ బటన్లు మీ వెబ్‌సైట్ పైభాగంలో మరియు వ్యాధి విశ్లేషణ ఫలితాలలో నేరుగా కనిపిస్తాయి.' 
                : 'These buttons render directly in your top navigation header and scan result cards.'}
            </p>
          </div>

          <Button
            type="button"
            onClick={handleSavePreferences}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{activeCode === 'te' ? 'ప్రాధాన్యతలను సేవ్ చేయండి' : 'Save Preferences'}</span>
          </Button>
        </div>

        {/* Live Preview of the Quick Buttons */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {activeCode === 'te' ? 'లైవ్ ప్రివ్యూ (ఇలా కనిపిస్తాయి):' : 'Live Header Preview:'}
          </span>

          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-wrap shadow-xs">
            {selectedLangs.map((code, idx) => {
              const langObj = getLanguageByCode(code);
              const isActive = (activeCode || '').toLowerCase().startsWith(code.toLowerCase());

              return (
                <div key={code} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleActivateLive(code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-xs border border-emerald-400 scale-[1.02]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{langObj?.flag || '🌾'}</span>
                    <span>{langObj?.nativeName || code}</span>
                    {idx === 0 && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900/10 dark:bg-white/10 font-bold ml-1">
                        1st
                      </span>
                    )}
                  </button>

                  {/* Remove or Reorder Button */}
                  {selectedLangs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleToggleLanguage(code)}
                      title={`Remove ${langObj?.name || code}`}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ========================================================
          CARD 2: ALL 13 REGIONAL LANGUAGES SELECTION GRID
         ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/40">
              {activeCode === 'te' ? 'అందుబాటులో ఉన్న భాషలు (13 ప్రాంతీయ భాషలు)' : 'Available Languages (13 Regional Locales)'}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-white/30 mt-0.5">
              {activeCode === 'te' ? 'ఏదైనా కార్డుపై ట్యాప్ చేసి ఎంచుకోండి లేదా తొలగించండి' : 'Tap any card to add or remove from your 1-tap quick buttons'}
            </p>
          </div>

          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hidden sm:inline">
            ⚡ 1-Tap Toggle
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLangs.includes(lang.code.toLowerCase());
            const rankIndex = selectedLangs.indexOf(lang.code.toLowerCase());
            const isCurrentlyActive = (activeCode || '').toLowerCase().startsWith(lang.code.toLowerCase());
            const isJustClicked = justSwitched === lang.code;

            return (
              <motion.div
                key={lang.code}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/25'
                    : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03]'
                }`}
              >
                {/* Top: Flag, Names, Selection Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                      isSelected 
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs' 
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10'
                    }`}>
                      {lang.flag}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className={`text-base font-black tracking-tight ${
                          isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                        }`}>
                          {lang.nativeName}
                        </h4>
                        {isCurrentlyActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-extrabold">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-white/45 font-semibold">
                        {lang.name}
                      </p>
                    </div>
                  </div>

                  {/* Priority Rank or Toggle Button */}
                  <div>
                    {isSelected ? (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] shadow-2xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{rankIndex === 0 ? '1st' : rankIndex === 1 ? '2nd' : '3rd'}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 text-[11px] font-bold">
                        + Add
                      </span>
                    )}
                  </div>
                </div>

                {/* Region & Greeting */}
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-white/40 truncate max-w-[150px]">
                    {lang.region}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                    {lang.greeting}
                  </span>
                </div>

                {/* Action Buttons: Toggle Selection & Set as Active */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleLanguage(lang.code)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black shadow-xs'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Trash2 className="w-3 h-3" />
                        <span>{activeCode === 'te' ? 'తొలగించు' : 'Remove'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>{activeCode === 'te' ? 'పై బార్‌కు జోడించండి' : 'Select'}</span>
                      </>
                    )}
                  </button>

                  {/* Make Primary Button (if selected and not already 1st) */}
                  {isSelected && rankIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMakePrimary(lang.code)}
                      title="Set as 1st Primary Language"
                      className="px-2.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>{activeCode === 'te' ? '1వదిగా' : '1st'}</span>
                    </button>
                  )}

                  {/* Instant Switch Button */}
                  <button
                    type="button"
                    onClick={() => handleActivateLive(lang.code)}
                    disabled={isCurrentlyActive}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isCurrentlyActive
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 opacity-60 cursor-default'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-250 dark:border-slate-700'
                    }`}
                  >
                    <span>{isCurrentlyActive ? '✓ Active' : (activeCode === 'te' ? 'ఇప్పుడే మార్చండి' : 'Activate')}</span>
                  </button>
                </div>

                {isJustClicked && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-emerald-500/25 backdrop-blur-xs rounded-2xl flex items-center justify-center gap-2 text-emerald-950 dark:text-emerald-100 font-black text-sm z-10"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Applied Live!</span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Helpful Guarantee Note */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 flex items-center gap-3 text-xs text-slate-600 dark:text-white/50">
        <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
        <span>
          {activeCode === 'te' 
            ? 'ఈ పేజీలోనే మీ ప్రాధాన్యతలు నేరుగా భద్రపరచబడతాయి. ప్రొఫైల్ లేదా ఇతర ట్యాబ్‌లకు వెళ్లాల్సిన అవసరం లేదు.' 
            : 'All preferences are managed directly inside this tab. Zero redirects to farmer profile or external forms.'}
        </span>
      </div>
    </motion.div>
  );
}
