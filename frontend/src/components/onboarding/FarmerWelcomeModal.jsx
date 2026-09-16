import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Droplets, 
  Globe, 
  X, 
  Leaf, 
  Store,
  Layers
} from 'lucide-react';
import { Button, Badge } from '../ui/index';

const LANGUAGES = [
  { code: 'te', name: 'తెలుగు', region: 'ఆంధ్రప్రదేశ్ & తెలంగాణ', flag: '🌾', acceptLabel: 'అంగీకరించి కొనసాగించండి' },
  { code: 'hi', name: 'हिन्दी', region: 'भारत (National)', flag: '🇮🇳', acceptLabel: 'स्वीकार करें और आगे बढ़ें' },
  { code: 'en', name: 'English', region: 'India (Default)', flag: '🌐', acceptLabel: 'Accept & Continue' },
  { code: 'ta', name: 'தமிழ்', region: 'தமிழ்நாடு', flag: '🌴', acceptLabel: 'ஏற்றுக்கொண்டு தொடரவும்' },
  { code: 'kn', name: 'ಕನ್ನಡ', region: 'ಕರ್ನಾಟಕ', flag: '🌿', acceptLabel: 'ಒಪ್ಪಿಕೊಂಡು ಮುಂದುವರಿಯಿರಿ' }
];

const TUTORIAL_SLIDES = [
  {
    step: 1,
    titleEn: "Focus Closely on the Sick Leaf",
    titleTe: "వ్యాధి సోకిన ఆకుపై స్పష్టంగా ఫోకస్ చేయండి",
    descEn: "Take a clear, well-lit photo of the leaf lesion or spotted fruit. Avoid taking blurry photos from far away.",
    descTe: "మచ్చలు ఉన్న ఆకు లేదా కాయను దగ్గరగా సహజ వెలుతురులో ఫోటో తీయండి. చెట్టు మొత్తాన్ని దూరంగా మసకగా తీయవద్దు.",
    icon: Camera,
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    badge: "1. Capture Guidance",
    tips: [
      "Natural daylight works best",
      "Keep leaf centered in the frame",
      "Ensure veins and spots are sharp"
    ]
  },
  {
    step: 2,
    titleEn: "Instant Dual-AI Diagnosis",
    titleTe: "తక్షణ ఏఐ రోగ నిర్ధారణ (2 సెకన్లలో)",
    descEn: "Our PyTorch EfficientNetV2 neural vision identifies 1,200+ crop diseases and plant species with Grad-CAM heatmaps.",
    descTe: "మా శక్తివంతమైన న్యూరల్ నెట్‌వర్క్ 2 సెకన్లలో పంట రకాన్ని మరియు రోగాన్ని 98%+ ఖచ్చితత్వంతో నిర్ధారిస్తుంది.",
    icon: Layers,
    color: "from-sky-500/20 to-blue-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
    badge: "2. Real-Time AI Analysis",
    tips: [
      "Visual lesion heatmaps included",
      "Differential diagnosis safety checks",
      "Telugu & Hindi audio voice readout"
    ]
  },
  {
    step: 3,
    titleEn: "Store Medicines & 15L Pump Dosage",
    titleTe: "సమీప దుకాణాల్లో లభించే మందులు & 15లీ పంపు మోతాదు",
    descEn: "Get genuine Indian shop brand recommendations (Syngenta, UPL, Bayer) with exact dilution per 15-Litre sprayer tank.",
    descTe: "రైతు భరోసా కేంద్రాలు & అగ్రి దుకాణాల్లో లభించే అసలైన బ్రాండ్లు (సాఫ్, అమిస్టార్ టాప్) మరియు పంపుకి సరైన మోతాదు తెలుసుకోండి.",
    icon: Store,
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
    badge: "3. Verified Treatment",
    tips: [
      "Exact 15L backpack pump dosage",
      "Organic & bio-fungicide alternatives",
      "Download printable Rx prescription"
    ]
  }
];

const FarmerWelcomeModal = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState('language'); // 'language' | 'tutorial'
  const [selectedLang, setSelectedLang] = useState('te');
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    // Show on first visit, or when explicitly requested via custom event
    const completed = localStorage.getItem('agrishield_onboarding_completed');
    if (!completed) {
      setIsOpen(true);
      const current = (i18n.language || 'te').split('-')[0];
      setSelectedLang(['te', 'hi', 'en', 'ta', 'kn'].includes(current) ? current : 'te');
    }

    const handleOpenTutorial = () => {
      setStage('tutorial');
      setSlideIdx(0);
      setIsOpen(true);
    };

    window.addEventListener('open-farmer-guide', handleOpenTutorial);
    return () => window.removeEventListener('open-farmer-guide', handleOpenTutorial);
  }, [i18n.language]);

  const handleLanguageSelect = (code) => {
    setSelectedLang(code);
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const handleAcceptLanguage = () => {
    i18n.changeLanguage(selectedLang);
    setStage('tutorial');
  };

  const handleFinishOnboarding = () => {
    localStorage.setItem('agrishield_onboarding_completed', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const currentLangObj = LANGUAGES.find(l => l.code === selectedLang) || LANGUAGES[0];
  const isTe = selectedLang === 'te';
  const slide = TUTORIAL_SLIDES[slideIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl"
      >
        {/* Decorative Top Accent Banner */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* ════════ STAGE 1: NATIVE LANGUAGE SELECTION ════════ */}
        {stage === 'language' && (
          <div className="p-5 sm:p-7 space-y-5">
            <div className="text-center space-y-1.5">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1 border border-emerald-500/20 shadow-xs">
                <Globe className="w-7 h-7 animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                మీ భాషను ఎంచుకోండి / Select Language
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Choose your preferred language for instant diagnosis, Telugu voice assistance, and local shop medicines.
              </p>
            </div>

            {/* Language Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-slate-50/60 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-emerald-500/40 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lang.flag}</span>
                      <div>
                        <span className="block text-sm font-black text-slate-900 dark:text-white leading-tight">
                          {lang.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {lang.region}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dynamic Real-Time Accept Button */}
            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={handleAcceptLanguage}
                rightIcon={<ChevronRight className="w-5 h-5" />}
                className="w-full py-3 text-sm sm:text-base font-black shadow-lg shadow-emerald-600/20"
              >
                <span>{currentLangObj.acceptLabel}</span>
              </Button>
            </div>
          </div>
        )}

        {/* ════════ STAGE 2: 3-SLIDE VISUAL CAMERA & MEDICINE GUIDE ════════ */}
        {stage === 'tutorial' && (
          <div className="p-5 sm:p-7 space-y-5">
            {/* Header with Skip Option */}
            <div className="flex items-center justify-between pb-1">
              <Badge variant="success" className="text-[10px] font-black uppercase tracking-wider py-0.5 px-2">
                {slide.badge}
              </Badge>
              <button
                type="button"
                onClick={handleFinishOnboarding}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                {isTe ? 'దాటవేయి (Skip)' : 'Skip Guide'}
              </button>
            </div>

            {/* Slide Visual Card */}
            <div className={`p-5 rounded-2xl bg-gradient-to-br ${slide.color} border shadow-inner space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200/60 dark:border-white/10">
                  <slide.icon className="w-7 h-7" />
                </div>
                <span className="text-xs font-black uppercase text-slate-400">
                  {slideIdx + 1} / {TUTORIAL_SLIDES.length}
                </span>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                  {isTe ? slide.titleTe : slide.titleEn}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {isTe ? slide.descTe : slide.descEn}
                </p>
              </div>

              {/* Bullet Highlights */}
              <div className="pt-2 space-y-1.5 border-t border-slate-200/50 dark:border-white/10">
                {slide.tips.map((tip, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[3]" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Slide Dots Indicator */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {TUTORIAL_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSlideIdx(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    slideIdx === idx 
                      ? 'w-7 bg-emerald-600' 
                      : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              {slideIdx > 0 && (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSlideIdx(prev => prev - 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  className="w-1/3 text-xs font-bold"
                >
                  {isTe ? 'వెనుకకు' : 'Back'}
                </Button>
              )}

              {slideIdx < TUTORIAL_SLIDES.length - 1 ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setSlideIdx(prev => prev + 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  className="flex-1 py-2.5 text-xs sm:text-sm font-black shadow-md shadow-emerald-600/20"
                >
                  {isTe ? 'తదుపరి (Next)' : 'Next Step'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleFinishOnboarding}
                  rightIcon={<Sparkles className="w-4 h-4" />}
                  className="flex-1 py-2.5 text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/25 bg-gradient-to-r from-emerald-600 to-teal-600"
                >
                  {isTe ? 'ప్రారంభించండి (Start Scanning)' : 'Get Started Now'}
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default FarmerWelcomeModal;
