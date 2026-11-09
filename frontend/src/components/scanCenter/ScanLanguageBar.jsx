import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_LANGUAGES } from '../../data/languages';

/**
 * Reusable, clean, location-aware language selector bar for AI Scan Center.
 * Strictly renders ONLY the 1, 2, or 3 preferred languages configured by the farmer.
 * Zero unselected languages, zero "+ More" clutter, and harmonious adaptive colors.
 * Supports both activeLang/currentLang and onLanguageSelect/onSelectLanguage props.
 */
export default function ScanLanguageBar({
  activeLang: propActiveLang,
  currentLang,
  onLanguageSelect,
  onSelectLanguage,
  isTranslating = false,
  label = '',
  className = ''
}) {
  const { i18n } = useTranslation();
  const { user, updateProfile } = useAuth();
  
  // Resolve active language code from props or global i18n
  const resolvedCode = (propActiveLang || currentLang || i18n?.language || 'en').split('-')[0].toLowerCase();

  // Strict farmer-configured preferred languages (1, 2, or 3 languages)
  const [preferredCodes, setPreferredCodes] = useState(() => {
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

  // Listen for real-time changes saved in Profile -> Languages tab
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e?.detail?.languages && Array.isArray(e.detail.languages) && e.detail.languages.length > 0) {
        setPreferredCodes(e.detail.languages.slice(0, 3));
      } else {
        try {
          const cached = JSON.parse(localStorage.getItem('agrishield_preferred_languages'));
          if (Array.isArray(cached) && cached.length > 0) {
            setPreferredCodes(cached.slice(0, 3));
          }
        } catch (_) {}
      }
    };

    window.addEventListener('agrishield-preferred-languages-updated', handleUpdate);
    return () => window.removeEventListener('agrishield-preferred-languages-updated', handleUpdate);
  }, []);

  // Determine the 1, 2, or 3 quick-access pill languages strictly following user selection
  const quickLanguages = useMemo(() => {
    let codes = preferredCodes;
    if (!Array.isArray(codes) || codes.length === 0) {
      codes = ['te', 'en'];
    }
    // Strictly map to SUPPORTED_LANGUAGES in the exact order selected by the user
    const mapped = codes
      .map(c => SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === (c || '').toLowerCase()))
      .filter(Boolean);

    if (mapped.length === 0) {
      const fallback = SUPPORTED_LANGUAGES.find(l => l.code === 'te') || SUPPORTED_LANGUAGES[0];
      return [fallback];
    }
    return mapped;
  }, [preferredCodes]);

  const handleSelect = async (code) => {
    const clean = (code || 'en').split('-')[0].toLowerCase();
    
    // Call both callback styles for complete backward compatibility
    if (onLanguageSelect) onLanguageSelect(clean);
    if (onSelectLanguage) onSelectLanguage(clean);

    // Synchronously update global website i18n
    try {
      if (i18n && i18n.language !== clean) {
        await i18n.changeLanguage(clean);
        localStorage.setItem('i18nextLng', clean);
        if (user && updateProfile) {
          updateProfile({ preferred_language: clean }).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent('agrishield-language-changed', { detail: { language: clean } }));
      }
    } catch (e) {
      console.warn("ScanLanguageBar i18n sync:", e);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* Optional Label (Hidden when empty or in compact header bars) */}
      {label && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mr-1">
          <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="hidden sm:inline font-bold">{label}:</span>
        </div>
      )}

      {/* Translating Spinner Indicator */}
      {isTranslating && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse mr-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
        </span>
      )}

      {/* Strictly the 1, 2, or 3 Preferred Language Pills */}
      {quickLanguages.map((lang) => {
        const isSelected = resolvedCode.startsWith(lang.code.toLowerCase());

        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => handleSelect(lang.code)}
            disabled={isTranslating}
            title={`Switch to ${lang.name} (${lang.nativeName || lang.name})`}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
              isSelected
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black shadow-xs border border-emerald-400 scale-[1.02]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            <span>{lang.flag || '🌾'}</span>
            <span>{lang.nativeName || lang.name}</span>
          </button>
        );
      })}
    </div>
  );
}
