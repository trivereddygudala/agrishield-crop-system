import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check, MapPin, Sparkles, X, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '../../data/languages';

/**
 * State to regional language mapping for India
 */
const STATE_TO_LANG_MAP = {
  'andhra pradesh': 'te',
  'telangana': 'te',
  'tamil nadu': 'ta',
  'puducherry': 'ta',
  'karnataka': 'kn',
  'kerala': 'ml',
  'lakshadweep': 'ml',
  'maharashtra': 'mr',
  'goa': 'mr',
  'gujarat': 'gu',
  'daman and diu': 'gu',
  'dadra and nagar haveli': 'gu',
  'punjab': 'pa',
  'chandigarh': 'pa',
  'west bengal': 'bn',
  'tripura': 'bn',
  'odisha': 'or',
  'assam': 'as',
  'uttar pradesh': 'hi',
  'bihar': 'hi',
  'madhya pradesh': 'hi',
  'rajasthan': 'hi',
  'haryana': 'hi',
  'delhi': 'hi',
  'jharkhand': 'hi',
  'chhattisgarh': 'hi',
  'uttarakhand': 'hi',
  'himachal pradesh': 'hi',
  'jammu and kashmir': 'hi'
};

/**
 * Detect local state language from user profile, farm location, or storage
 */
export function detectLocalLanguage(user) {
  try {
    const rawLoc = (
      user?.farm_location || 
      user?.state || 
      localStorage.getItem('agrishield_farmer_state') || 
      localStorage.getItem('farmer_location') || 
      ''
    ).toLowerCase();

    for (const [state, code] of Object.entries(STATE_TO_LANG_MAP)) {
      if (rawLoc.includes(state)) {
        return code;
      }
    }

    // Secondary check: user's preferred language if set
    if (user?.preferred_language && user.preferred_language !== 'en') {
      return user.preferred_language.toLowerCase().split('-')[0];
    }
  } catch (e) {
    console.warn('Language detection error:', e);
  }

  // Default to Telugu for AgriShield primary farmer userbase
  return 'te';
}

/**
 * Reusable, clean, location-aware language selector bar for AI Scan Center
 */
export default function ScanLanguageBar({
  activeLang = 'en',
  onLanguageSelect,
  isTranslating = false,
  label = 'Diagnosis Language',
  className = ''
}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Detect local language based on farmer location
  const localLangCode = useMemo(() => detectLocalLanguage(user), [user]);

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

  // Filter languages for the popup dropdown
  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORTED_LANGUAGES;
    const q = searchQuery.toLowerCase();
    return SUPPORTED_LANGUAGES.filter(
      l => l.name.toLowerCase().includes(q) || 
           (l.nativeName && l.nativeName.toLowerCase().includes(q)) || 
           (l.region && l.region.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelect = (code) => {
    onLanguageSelect?.(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  const currentLangObj = getLanguageByCode(activeLang);

  return (
    <div className={`relative z-20 mb-4 p-2.5 sm:p-3 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-emerald-500/30 shadow-lg flex items-center justify-between gap-3 flex-wrap ${className}`}>
      {/* Left: Active Language Indicator */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
        <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="hidden sm:inline font-semibold">{label}:</span>
        <span className="text-[11px] text-emerald-300 font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1">
          <span>{currentLangObj?.flag || '🌾'}</span>
          <span>{currentLangObj?.nativeName || activeLang}</span>
        </span>
        {isTranslating && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 animate-pulse ml-1">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> Translating...
          </span>
        )}
      </div>

      {/* Right: Smart 3-Pill Bar + "+ More Languages" Expander */}
      <div className="flex items-center gap-1.5 flex-wrap relative" ref={dropdownRef}>
        {/* Quick Access Pills (English, Local, Active/Hindi) */}
        {quickLanguages.map((lang) => {
          const isSelected = activeLang === lang.code;
          const isPrimary = quickLanguages[0]?.code === lang.code && quickLanguages.length > 1;

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              disabled={isTranslating}
              title={isPrimary ? `Primary Language (${lang.name})` : lang.name}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-105 border border-emerald-400'
                  : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/70'
              }`}
            >
              <span>{lang.flag || '🌾'}</span>
              <span>{lang.nativeName || lang.name}</span>
              {isPrimary && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-300 font-extrabold hidden xs:inline">
                  1st
                </span>
              )}
            </button>
          );
        })}

        {/* "+ More Languages" Expand Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
            isOpen
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-sm shadow-emerald-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border-emerald-500/30'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>+ More ({SUPPORTED_LANGUAGES.length - quickLanguages.length})</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-300' : ''}`} />
        </button>

        {/* Sleek Glassmorphic Dropdown Popover */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-h-96 overflow-hidden bg-slate-950/95 backdrop-blur-2xl rounded-2xl border border-emerald-500/40 shadow-2xl shadow-emerald-950/60 z-50 flex flex-col"
            >
              {/* Popover Header */}
              <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/60">
                <div className="flex items-center gap-1.5 text-xs font-black text-white">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>All Languages / అన్ని భాషలు</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-2 border-b border-slate-800/80 bg-slate-950/50">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search language / state..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Language List Grid */}
              <div className="p-2 overflow-y-auto max-h-64 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                {filteredLanguages.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No language matching "{searchQuery}"
                  </div>
                ) : (
                  filteredLanguages.map((lang) => {
                    const isSelected = activeLang === lang.code;
                    const isLocal = lang.code === localLangCode;

                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelect(lang.code)}
                        className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border border-emerald-400/60 text-white'
                            : 'hover:bg-slate-900 text-slate-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{lang.flag || '🌾'}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">
                                {lang.nativeName || lang.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({lang.name})
                              </span>
                            </div>
                            {lang.region && (
                              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                                <span>{lang.region}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isLocal && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                              Local
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Popover Footer Info */}
              <div className="p-2 border-t border-slate-800/80 bg-slate-900/50 text-[10px] text-slate-400 flex items-center justify-between px-3">
                <span>13 Official Regional Languages</span>
                <span className="text-emerald-400 font-semibold">1-Tap Instant Switch</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
