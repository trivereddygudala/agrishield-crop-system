import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BADGE_TRANSLATIONS = {
  te: {
    'Safety Protocol': 'భద్రతా విధానం',
    'Agronomy Tips': 'వ్యవసాయ చిట్కాలు',
    'Root Cause': 'మూల కారణం',
    'Chemical Protocol': 'రసాయన విధానం',
    'Eco Friendly': 'సేంద్రీయ పద్ధతి',
    'AI Analysis': 'AI విశ్లేషణ',
    'Outbreak Plan': 'నివారణ ప్రణాళిక',
    'Mandi Index': 'మార్కెట్ సూచిక'
  },
  hi: {
    'Safety Protocol': 'सुरक्षा नियम',
    'Agronomy Tips': 'कृषि सलाह',
    'Root Cause': 'मूल कारण',
    'Chemical Protocol': 'रासायनिक नियम',
    'Eco Friendly': 'जैविक विधि',
    'AI Analysis': 'AI विश्लेषण',
    'Outbreak Plan': 'रोकथाम योजना',
    'Mandi Index': 'मंडी भाव सूचकांक'
  }
};

const CollapsibleSection = ({ 
  title, 
  icon: Icon, 
  badge, 
  badgeText,
  defaultOpen = true, 
  children, 
  className = '', 
  headerBg = 'bg-slate-50/80 hover:bg-slate-100/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80',
  onSpeak = null,
  isSpeaking = false,
  speechTitle = 'Listen this section'
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rawBadge = badge || badgeText;
  const langKey = (i18n.language ? i18n.language.split('-')[0] : 'en').toLowerCase();
  const localizedBadge = (BADGE_TRANSLATIONS[langKey] && BADGE_TRANSLATIONS[langKey][rawBadge]) || rawBadge;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-200 ${className}`}>
      <div className={`w-full px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between transition-colors text-left ${headerBg}`}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-left"
        >
          {Icon && (
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 shadow-xs shrink-0">
              <Icon size={18} />
            </div>
          )}
          <span className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-base truncate">
            {title}
          </span>
          {localizedBadge && (
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs shrink-0">
              {localizedBadge}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {onSpeak && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSpeak();
              }}
              title={isSpeaking ? (langKey === 'te' ? 'వాయిస్ ఆపండి' : 'Stop voice readout') : (langKey === 'te' ? 'ఈ విభాగాన్ని వినండి' : speechTitle)}
              aria-label={isSpeaking ? 'Stop voice readout' : speechTitle}
              className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold active:scale-95 ${
                isSpeaking
                  ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse shadow-md shadow-emerald-600/30'
                  : 'bg-emerald-500/10 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-700/60 hover:bg-emerald-500/20'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX size={16} />
                  <span className="text-[11px] hidden sm:inline">{langKey === 'te' ? 'ఆపండి' : 'Stop'}</span>
                </>
              ) : (
                <>
                  <Volume2 size={16} />
                  <span className="text-[11px] hidden sm:inline">{langKey === 'te' ? 'వినండి' : 'Listen'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`text-slate-500 dark:text-slate-400 p-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''}`}
            aria-label={isOpen ? 'Collapse section' : 'Expand section'}
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleSection;
