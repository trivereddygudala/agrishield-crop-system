import React, { useState, useEffect, useMemo } from 'react';
import { 
  FlaskConical, ClipboardList, ShieldAlert, Sparkles, Volume2, VolumeX, 
  CheckCircle2, Clock, Droplets, AlertTriangle, ShieldCheck, Info,
  Package, Calendar, HelpCircle, Layers, ExternalLink, ZoomIn, X,
  ChevronDown, ChevronUp, Sprout, Flower2, Apple, Shield, Globe, Loader2,
  Award, UserCheck, PenSquare, SlidersHorizontal
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge } from '../ui/index';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { useStudio } from '../../context/StudioContext';
import API from '../../services/api';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' }
];

const AgrochemicalResults = ({ data = {} }) => {
  const { t, i18n } = useTranslation();
  const studio = useStudio();
  const overrides = studio?.cardOverrides?.['agro-scan'] || {};
  const isHumanCalibrated = Boolean(overrides.human_verified || overrides.is_modified);

  const currentLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Multilingual State & Translation Cache
  const [activeLang, setActiveLang] = useState(currentLang || 'en');
  const [translatedCache, setTranslatedCache] = useState(() => data?.translations || {});
  const [isTranslating, setIsTranslating] = useState(false);

  // Sync cache and active language with incoming data props
  useEffect(() => {
    if (data?.translations) {
      setTranslatedCache(prev => ({ ...prev, ...data.translations }));
    }
    if (data?.current_language) {
      setActiveLang(data.current_language);
    }
  }, [data]);

  // Request on-demand translation if user selects a language not yet in cache
  useEffect(() => {
    if (activeLang === 'en') return;
    if (translatedCache[activeLang]) return;

    let isMounted = true;
    const fetchTranslation = async () => {
      setIsTranslating(true);
      try {
        const res = await API.post('/api/translate-agrochemical', {
          agrochemical: data,
          language: activeLang
        });
        if (isMounted && res.data?.success && res.data?.agrochemical) {
          setTranslatedCache(prev => ({
            ...prev,
            [activeLang]: res.data.agrochemical
          }));
        }
      } catch (err) {
        console.warn("On-demand agrochemical translation failed:", err);
      } finally {
        if (isMounted) setIsTranslating(false);
      }
    };

    fetchTranslation();
    return () => { isMounted = false; };
  }, [activeLang, data, translatedCache]);

  const handleLanguageSelect = (langCode) => {
    setActiveLang(langCode);
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
    window.dispatchEvent(new CustomEvent('agrishield-language-changed', { detail: { language: langCode } }));
  };

  // Active localized data object (cached translation or raw data)
  const activeData = translatedCache[activeLang] || data;

  // Extract the core structured sections with intelligent fallbacks
  const productDetails = activeData?.product_details || activeData?.info?.product_details || {
    brand_name: activeData?.productName || activeData?.info?.product_name || "Certified Agricultural Product",
    company: activeData?.brand || activeData?.info?.brand || "Registered Manufacturer",
    active_ingredient: activeData?.activeIngredient || activeData?.info?.active_ingredients || "Active Plant Protection Formulation",
    category_type: activeData?.category_type || activeData?.info?.category_type || "Pesticide",
    is_fertilizer: activeData?.is_fertilizer || activeData?.info?.is_fertilizer || false,
    detailed_description: activeData?.detailed_description || activeData?.info?.detailed_description || "",
    formulation: activeData?.formulation || activeData?.info?.formulation || "Wettable Powder / Liquid Formulation",
    batch_number: activeData?.batchNumber || activeData?.info?.batch_number || "Verified Authentic Batch",
    mfg_date: activeData?.mfgDate || activeData?.info?.mfg_date || "Recent Manufacturing",
    exp_date: activeData?.expDate || activeData?.info?.exp_date || "Best before 24-36 months",
    net_quantity: activeData?.netQuantity || activeData?.info?.net_qty || "Standard Commercial Pack",
    registration_number: activeData?.registrationNumber || activeData?.info?.registration_number || "CIR-Verified",
    hazard_color: activeData?.info?.hazard_color || "#16a34a",
    toxicity_class: activeData?.toxicityClass || activeData?.info?.toxicity_level || "Class III - Caution (Green/Blue Triangle)",
    image_url: activeData?.info?.image_url || "/samples/fertilizer_01.jpg"
  };

  const userInstructions = activeData?.user_instructions || activeData?.info?.user_instructions || {
    dilution_rate_per_litre: activeData?.mixingRatio || activeData?.dosage || activeData?.info?.recommended_dosage || "2.0 mL or 2.5 g / L of clean water",
    mixing_guide: [
      "1. Take 2 to 3 litres of fresh, clean water in a dedicated plastic mixing bucket.",
      "2. Accurately measure the recommended product dose using a clean measuring cup or scoop.",
      "3. Pour into the bucket and stir vigorously with a clean wooden or plastic stick until fully dissolved.",
      "4. Pour the pre-mixed solution into the sprayer tank filled with the rest of the clean water through the strainer.",
      "5. Agitate the tank gently and apply as a uniform fine mist covering both upper and lower leaf surfaces."
    ],
    best_spray_timing: "Early morning (6:00 AM – 9:00 AM) or late afternoon / evening (4:30 PM – 6:30 PM). Avoid peak midday sunlight and wind to prevent rapid chemical evaporation and crop scorch.",
    spray_interval: activeData?.sprayInterval || activeData?.info?.spray_interval || "Repeat after 10 to 14 days if disease or pest pressure persists.",
    ppe_precautions: [
      "Wear chemical-resistant nitrile or neoprene rubber gloves during measuring, mixing, and spraying.",
      "Wear protective safety goggles or a transparent face shield to prevent accidental splashes.",
      "Wear an N95 particulate / vapor respirator mask while spraying to avoid inhaling fine mist.",
      "Wear long-sleeved clothing and waterproof boots; wash face, hands, and skin with soap immediately after spraying."
    ],
    is_fertilizer: false
  };

  const chemicalExplanation = activeData?.chemical_explanation || activeData?.info?.chemical_explanation || {
    category_type: activeData?.category_type || activeData?.info?.category_type || "Pesticide",
    is_fertilizer: activeData?.is_fertilizer || activeData?.info?.is_fertilizer || false,
    fertilizer_growth_stages: activeData?.fertilizer_growth_stages || activeData?.info?.fertilizer_growth_stages || null,
    action_mode: activeData?.info?.action_mode || activeData?.category || activeData?.info?.product_type || "Dual Action Protective & Curative Formulation",
    approved_crops: activeData?.info?.target_crops || ["Tomato", "Chilli", "Paddy", "Cotton", "Vegetables"],
    target_diseases_and_pests: activeData?.info?.target_diseases || ["Fungal Blights", "Leaf Spots", "Mildew", "Insect Pests"],
    preharvest_interval: activeData?.info?.preharvest_interval ? `${activeData.info.preharvest_interval} mandatory waiting period before harvest.` : "14 days waiting period before crop harvest.",
    utility_and_benefits: "Delivers rapid, targeted foliar protection by inhibiting pathogen cell metabolism and halting pest damage, protecting overall crop yield."
  };

  // Determine Product Category Classification
  const getCategoryMeta = () => {
    const rawCategory = productDetails?.category_type || chemicalExplanation?.category_type || activeData?.category_type || activeData?.info?.category_type || '';
    const text = `${productDetails?.brand_name} ${productDetails?.active_ingredient} ${chemicalExplanation?.action_mode} ${rawCategory}`.toLowerCase();

    if (rawCategory === 'Fertilizer' || text.includes('fertiliz') || text.includes('urea') || text.includes('npk') || text.includes('nutrient') || text.includes('పోషక') || text.includes('ఎరువు')) {
      return {
        type: 'Fertilizer',
        label: activeLang === 'te' ? 'ఎరువు & మొక్కల పోషణ' : activeLang === 'ta' ? 'உரம் & தாவர ஊட்டச்சத்து' : activeLang === 'hi' ? 'उर्वरक एवं पादप पोषण' : 'Fertilizer & Plant Nutrition',
        icon: '🌱',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40',
        textColor: 'text-emerald-400'
      };
    }
    if (rawCategory === 'Fungicide' || text.includes('fungicid') || text.includes('blight') || text.includes('mancozeb') || text.includes('saaf') || text.includes('copper') || text.includes('mildew') || text.includes('శిలీంధ్ర') || text.includes('తెగులు')) {
      return {
        type: 'Fungicide',
        label: activeLang === 'te' ? 'శిలీంద్ర సంహారిణి (తెగుళ్ల నివారణ)' : activeLang === 'ta' ? 'பூஞ்சைக்கொல்லி (பூஞ்சை நோய் தடுப்பு)' : activeLang === 'hi' ? 'कवकनाशी (फफूंद रोग नियंत्रण)' : 'Fungicide (Fungal Disease Control)',
        icon: '🍄',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-950/40',
        textColor: 'text-rose-400'
      };
    }
    if (rawCategory === 'Insecticide' || text.includes('insecticid') || text.includes('coragen') || text.includes('confidor') || text.includes('imidacloprid') || text.includes('pest') || text.includes('thrips') || text.includes('పురుగు') || text.includes('కీటక')) {
      return {
        type: 'Insecticide',
        label: activeLang === 'te' ? 'పురుగుమందు (కీటకాల నివారణ)' : activeLang === 'ta' ? 'பூச்சிக்கொல்லி (பூச்சி கட்டுப்பாடு)' : activeLang === 'hi' ? 'कीटनाशक (कीट नियंत्रण)' : 'Insecticide (Pest & Insect Control)',
        icon: '🐛',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-950/40',
        textColor: 'text-amber-400'
      };
    }
    if (rawCategory === 'Herbicide' || text.includes('herbicid') || text.includes('weed') || text.includes('glyphosate') || text.includes('కలుపు')) {
      return {
        type: 'Herbicide',
        label: activeLang === 'te' ? 'కలుపు మందు (కలుపు మొక్కల నివారణ)' : activeLang === 'ta' ? 'களைக்கொல்லி (களை கட்டுப்பாடு)' : activeLang === 'hi' ? 'शाकनाशी (खरपतवार नियंत्रण)' : 'Herbicide (Weed & Grass Control)',
        icon: '🌿',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-950/40',
        textColor: 'text-purple-400'
      };
    }
    if (rawCategory === 'Plant Growth Regulator' || text.includes('growth regulator') || text.includes('pgr') || text.includes('వృద్ధి')) {
      return {
        type: 'Plant Growth Regulator',
        label: activeLang === 'te' ? 'మొక్కల వృద్ధి నియంత్రకం (PGR)' : activeLang === 'ta' ? 'தாவர வளர்ச்சி சீராக்கி (PGR)' : activeLang === 'hi' ? 'पादप वृद्धि नियामक (PGR)' : 'Plant Growth Regulator (PGR)',
        icon: '📈',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-cyan-950/40',
        textColor: 'text-cyan-400'
      };
    }
    return {
      type: 'Pesticide',
      label: activeLang === 'te' ? 'వ్యవసాయ పంట సంరక్షణ మందు' : activeLang === 'ta' ? 'பயிர் பாதுகாப்பு மருந்து' : activeLang === 'hi' ? 'कृषि फसल सुरक्षा उत्पाद' : 'Agricultural Crop Protection / Pesticide',
      icon: '🧪',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-950/40',
      textColor: 'text-blue-400'
    };
  };

  const categoryMeta = getCategoryMeta();
  const isFertilizer = categoryMeta.type === 'Fertilizer' || productDetails?.is_fertilizer || chemicalExplanation?.is_fertilizer;

  // Fertilizer Growth Stages Data
  const growthStages = chemicalExplanation?.fertilizer_growth_stages || {
    vegetative_stage: activeLang === 'te'
      ? "బలమైన వేరు వ్యవస్థ, కొత్త పిలకల ఏర్పాటు మరియు పత్రహరిత తయారీకి తోడ్పడుతుంది."
      : "Supports vigorous root establishment, rapid shoot tillering, and deep chlorophyll synthesis. Apply during early vegetative flush to build a strong canopy foundation.",
    flowering_stage: activeLang === 'te'
      ? "పూత రాలడాన్ని అరికట్టి, ఎక్కువ మొగ్గలు రావడానికి మరియు ఫలదీకరణకు సహాయపడుతుంది."
      : "Enhances floral bud formation, prevents premature flower drop, and boosts pollen fertility for maximum pollination success.",
    fruiting_stage: activeLang === 'te'
      ? "కాయలు బరువు పెరగడానికి, రంగు, నాణ్యత మరియు గింజ నిండుదనానికి దోహదం చేస్తుంది."
      : "Promotes uniform fruit enlargement, grain filling, sugar accumulation, pulp density, and optimal post-harvest firmness."
  };

  // Detailed Description Text
  const detailedDescription = productDetails?.detailed_description || 
    chemicalExplanation?.detailed_description || 
    chemicalExplanation?.utility_and_benefits || 
    `${productDetails.brand_name} is a high-grade agricultural product manufactured by ${productDetails.company}. It delivers targeted plant protection and health optimization through ${chemicalExplanation.action_mode.toLowerCase()}.`;

  // Determine detection source
  const isWebSearch = activeData?.source === 'live_web_search' || productDetails?.verification_source === 'live_web_search';
  const isCatalog = activeData?.source === 'catalog' || productDetails?.verification_source === 'catalog';
  const isGeminiVision = activeData?.gemini_vision_used || productDetails?.gemini_vision_used || activeData?.source === 'gemini_vision_ocr';

  // Build high-clarity speech summary
  const agroSpeech = activeLang === 'te'
    ? `${productDetails.brand_name}, వర్గం: ${categoryMeta.label}, కంపెనీ: ${productDetails.company}. క్రియాశీల రసాయనం: ${productDetails.active_ingredient}. ఉపయోగించే మోతాదు: లీటరు నీటికి ${userInstructions.dilution_rate_per_litre}. పిచికారీ సమయం: ఉదయం లేదా సాయంత్రం.`
    : activeLang === 'ta'
    ? `${productDetails.brand_name}, வகை: ${categoryMeta.label}, நிறுவனம்: ${productDetails.company}. தீவிர மூலக்கூறு: ${productDetails.active_ingredient}. அளவு: ஒரு லிட்டர் தண்ணீருக்கு ${userInstructions.dilution_rate_per_litre}.`
    : activeLang === 'hi'
    ? `${productDetails.brand_name}, श्रेणी: ${categoryMeta.label}, कंपनी: ${productDetails.company}. सक्रिय रसायन: ${productDetails.active_ingredient}. उपयोग दर: प्रति लीटर पानी में ${userInstructions.dilution_rate_per_litre}. छिड़काव का समय: सुबह या शाम.`
    : activeLang === 'kn'
    ? `${productDetails.brand_name}, ವರ್ಗ: ${categoryMeta.label}, ಕಂಪನಿ: ${productDetails.company}. ಸಕ್ರಿಯ ಪದಾರ್ಥ: ${productDetails.active_ingredient}. ಪ್ರಮಾಣ: ಪ್ರತಿ ಲೀಟರ್ ನೀರಿಗೆ ${userInstructions.dilution_rate_per_litre}.`
    : `${productDetails.brand_name}, Category: ${categoryMeta.type}, by ${productDetails.company}. Active ingredient: ${productDetails.active_ingredient}. Recommended dilution: ${userInstructions.dilution_rate_per_litre}.`;

  const renderLanguageSwitcher = () => (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-900/95 dark:bg-slate-900/95 rounded-2xl border border-indigo-500/30 shadow-lg flex-wrap">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
        <Globe className="w-4 h-4 text-emerald-400" />
        <span className="hidden sm:inline">Advisory Language:</span>
        {isTranslating && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> Translating...
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {SUPPORTED_LANGUAGES.map(lang => {
          const isSelected = activeLang === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageSelect(lang.code)}
              disabled={isTranslating}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-105 border border-emerald-400'
                  : 'bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/70'
              }`}
            >
              <span>{lang.native}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderAgroHero = () => (
    <Card className="p-5 sm:p-7 bg-gradient-to-r from-slate-950 via-indigo-950/90 to-slate-900 text-white border border-indigo-500/30 shadow-2xl relative overflow-hidden">
      {/* 50% AI + 50% Human Collaborative Header */}
      <div className="mb-4 p-3 sm:p-4 rounded-2xl bg-black/40 border border-white/15 backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative z-10">
        {/* 50% AI */}
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex flex-col items-center justify-center text-white font-black shadow-md shrink-0 leading-none">
            <span className="text-[11px]">50%</span>
            <span className="text-[8px] tracking-tighter font-extrabold">AI</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">Multi-Modal Label OCR</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 text-[10px] font-mono">Tesseract + Gemini</span>
            </div>
            <p className="text-xs text-slate-300">
              Match Source: <strong className="text-white">{isWebSearch ? 'Live Web Verified' : (isCatalog ? 'Curated Catalog' : 'Neural OCR')}</strong>
            </p>
          </div>
        </div>

        <div className="hidden md:block w-px h-10 bg-white/15" />

        {/* 50% Human */}
        <div className="flex-1 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col items-center justify-center text-white font-black shadow-md shrink-0 leading-none">
              <span className="text-[11px]">50%</span>
              <span className="text-[8px] tracking-tighter font-extrabold">HUMAN</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">Agronomist Review</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                  isHumanCalibrated 
                    ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50' 
                    : 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40'
                }`}>
                  <UserCheck className="w-3 h-3" />
                  {isHumanCalibrated ? 'CALIBRATED & VERIFIED' : 'ACCREDITED PROFESSOR REVIEW'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Lead: <strong className="text-white">{studio?.agronomistProfile?.name || 'Dr. V. Ramanjaneyulu'}</strong> ({studio?.agronomistProfile?.institution || 'PJTSAU'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="glass"
              size="sm"
              onClick={() => studio?.openDrawer('editor', 'agro-scan')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black border-none text-xs shadow-md shrink-0"
            >
              <PenSquare className="w-3.5 h-3.5 mr-1" />
              Edit 50%
            </Button>
            <Button
              variant="glass"
              size="sm"
              onClick={() => studio?.openDrawer('layout', 'agro-scan')}
              className="bg-white/20 hover:bg-white/30 text-white font-bold border-white/20 text-xs shadow-sm shrink-0"
              title="Reorder cards & visual effects"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Official Agronomist Calibration Seal Stamp if modified */}
      {isHumanCalibrated && (
        <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/10 border-2 border-emerald-400/60 flex items-center justify-between gap-3 text-emerald-200 relative z-10">
          <div className="flex items-center gap-2.5">
            <Award className="w-6 h-6 text-emerald-400 shrink-0 animate-pulse" />
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>Certified Chemical Formulations Validation</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono">
                  {studio?.agronomistProfile?.registrationNo || 'AP-AGRO-2024-8842'}
                </span>
              </p>
              <p className="text-[11px] text-emerald-200/90 font-medium">
                Active ingredient & tank dilution verified by {studio?.agronomistProfile?.name || 'Dr. V. Ramanjaneyulu'}. Safe for field application.
              </p>
            </div>
          </div>
          <Badge variant="glow-emerald" className="text-[10px] font-black uppercase shrink-0">
            SEAL VALIDATED
          </Badge>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="space-y-3 flex-1">
          {/* Category and Verification Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md flex items-center gap-1.5 ${categoryMeta.badgeColor}`}>
              <span>{categoryMeta.icon}</span> {categoryMeta.label}
            </span>
            {isWebSearch ? (
              <Badge variant="glass" className="px-3 py-0.5 text-xs font-bold text-cyan-300 border-cyan-400/40 bg-cyan-950/70 flex items-center gap-1 shadow-sm">
                🌐 Live Web & AI Verified
              </Badge>
              ) : isCatalog ? (
                <Badge variant="glass" className="px-3 py-0.5 text-xs font-bold text-emerald-300 border-emerald-400/40 bg-emerald-950/70 flex items-center gap-1 shadow-sm">
                  🛡️ Certified Catalog Product
                </Badge>
              ) : (
                <Badge variant="glass" className="px-3 py-0.5 text-xs font-bold text-indigo-300 border-indigo-400/40 bg-indigo-950/70 flex items-center gap-1">
                  ✓ OCR Packaging Analysis
                </Badge>
              )}
              {isGeminiVision && (
                <Badge variant="glass" className="px-3 py-0.5 text-xs font-black text-cyan-200 border-cyan-400/50 bg-cyan-950/80 flex items-center gap-1 shadow-sm">
                  👁️ Gemini Vision OCR Assist
                </Badge>
              )}
              {productDetails.company && (
                <Badge variant="glass" className="px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                  🏢 {productDetails.company}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white leading-tight">
                {productDetails.brand_name}
              </h2>
              <Button
                variant="glass"
                size="sm"
                onClick={() => speak(agroSpeech, 'agro_summary', currentLang)}
                leftIcon={<Volume2 className={`w-4 h-4 ${speakingId === 'agro_summary' ? 'animate-bounce text-indigo-300' : 'text-white'}`} />}
                className="bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold border-indigo-400/40 shadow-sm"
              >
                {speakingId === 'agro_summary' 
                  ? (currentLang === 'te' ? 'వాయిస్ ఆపండి' : currentLang === 'hi' ? 'आवाज रोकें' : 'Stop Audio') 
                  : (currentLang === 'te' ? 'వివరాలు వినండి' : currentLang === 'hi' ? 'विवरण सुनें' : 'Listen Instructions')}
              </Button>
            </div>

            <p className="text-xs sm:text-sm text-indigo-200/90 font-medium">
              <span className="font-bold text-white">Active Ingredient:</span> {productDetails.active_ingredient}
            </p>
          </div>

          {/* Product Image Thumbnail with Tap-to-Zoom */}
          {productDetails.image_url && (
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              <div 
                onClick={() => setShowImageZoom(true)}
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-indigo-400/50 bg-slate-900 shadow-lg cursor-pointer group"
                title="Click to view full packaging"
              >
                <img 
                  src={productDetails.image_url} 
                  alt={productDetails.brand_name} 
                  className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                <ZoomIn className="w-3 h-3" /> Tap to zoom
              </span>
            </div>
          )}
        </div>
      </Card>
    );

    const renderProductDetails = () => (
      <CollapsibleSection 
        title={t('agrochemical.product_details', '1. Product Details & Classification')} 
        icon={FlaskConical} 
        badge={`${categoryMeta.icon} ${categoryMeta.type}`} 
        defaultOpen={true}
        onSpeak={() => {
          const text = `${productDetails.brand_name} by ${productDetails.company}. Classified as ${categoryMeta.label}. Active ingredient: ${productDetails.active_ingredient}. Formulation: ${productDetails.formulation}. Batch: ${productDetails.batch_number}. Expiry: ${productDetails.exp_date}. Toxicity: ${productDetails.toxicity_class}.`;
          speak(text, 'agro_details', currentLang);
        }}
        isSpeaking={speakingId === 'agro_details'}
      >
        <div className="space-y-3.5">
          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {/* Commercial Brand Name */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-indigo-500" /> Commercial Brand Name
              </span>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">{productDetails.brand_name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mfg: {productDetails.company}</p>
            </div>

            {/* Product Category Classification (Pesticide, Fungicide, Insecticide, Fertilizer, Herbicide) */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Product Category & Function
              </span>
              <p className="font-black text-slate-900 dark:text-white text-sm mt-1 flex items-center gap-1.5">
                <span>{categoryMeta.icon}</span> {categoryMeta.label}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isFertilizer ? "Soil & Foliar Plant Nutrition" : "Targeted Crop Protection Formulation"}
              </p>
            </div>

            {/* Active Ingredients */}
            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60">
              <span className="text-indigo-700 dark:text-indigo-400 font-bold uppercase text-[10px] flex items-center gap-1">
                <FlaskConical className="w-3.5 h-3.5" /> Technical Molecule & Potency
              </span>
              <p className="font-black text-slate-900 dark:text-white text-sm mt-1">{productDetails.active_ingredient}</p>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-300 mt-0.5 font-medium">Standard certified chemical composition</p>
            </div>

            {/* Formulation Type */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-teal-500" /> Formulation Type
              </span>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">{productDetails.formulation}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Pack: {productDetails.net_quantity}</p>
            </div>

            {/* Batch & Expiry Timeline */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Batch & Expiry Timeline
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-xs mt-1">Batch: <span className="font-mono">{productDetails.batch_number}</span></p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Exp: {productDetails.exp_date}</p>
            </div>

            {/* Toxicity Hazard Classification */}
            <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60">
              <span className="text-amber-800 dark:text-amber-400 font-bold uppercase text-[10px] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Hazard Toxicity Level
              </span>
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20" 
                  style={{ backgroundColor: productDetails.hazard_color || '#16a34a' }}
                />
                <p className="font-extrabold text-amber-950 dark:text-amber-300 text-xs">
                  {productDetails.toxicity_class}
                </p>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/90 mt-0.5">Statutory regulatory color triangle</p>
            </div>
          </div>

          {/* SECTION 1.2: Product Description with 6-Line Clamp and Show More Toggle */}
          <div className="p-4 bg-slate-50/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Product Technical Description & Action Overview
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {isDescriptionExpanded ? "Full Narrative" : "Summary Preview"}
              </span>
            </div>

            <div className="relative">
              <p className={`text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed transition-all duration-300 whitespace-pre-line ${isDescriptionExpanded ? '' : 'line-clamp-6'}`}>
                {detailedDescription}
              </p>
              {!isDescriptionExpanded && (
                <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-slate-50 dark:from-slate-800 to-transparent pointer-events-none" />
              )}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 transition-all cursor-pointer"
              >
                {isDescriptionExpanded ? (
                  <>
                    Show Less <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Show More (Read Full Description) <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    );

    const renderApplicationGuide = () => (
      <CollapsibleSection 
        title={t('agrochemical.user_instructions', '2. User Instructions & Mixing Guide')} 
        icon={ClipboardList} 
        badge="Usage Protocol" 
        defaultOpen={true}
        onSpeak={() => {
          const text = `Manufacturer recommended dilution rate: ${userInstructions.dilution_rate_per_litre}. Spray timing: ${userInstructions.best_spray_timing}. Repeat spray interval: ${userInstructions.spray_interval}.`;
          speak(text, 'agro_instructions', currentLang);
        }}
        isSpeaking={speakingId === 'agro_instructions'}
      >
        <div className="space-y-4 text-xs">
          {/* Dilution Rate Highlight Card (Clean Water Proportion) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Recommended Dilution Proportion (Per Litre of Clean Water)
                </span>
                <p className="font-display font-black text-slate-900 dark:text-white text-xl sm:text-2xl mt-1.5">
                  {userInstructions.dilution_rate_per_litre}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                  Dissolve this exact manufacturer-tested dosage per 1 litre of clean water. Maintain uniform calibration.
                </p>
              </div>
              <Badge variant="glow-emerald" className="text-xs font-black uppercase shrink-0">
                100% Water Calibrated
              </Badge>
            </div>
          </div>

          {/* 2.5: Step-by-Step Mixing and Preparation Guide */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[11px] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-500" /> 
                {isFertilizer ? "Step-by-Step Fertilizer Dissolution & Application Guide" : "Step-by-Step Mixing & Preparation Guide"}
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                4-Stage Protocol
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {Array.isArray(userInstructions.mixing_guide) && userInstructions.mixing_guide.length > 0 ? (
                userInstructions.mixing_guide.map((step, idx) => {
                  const stepText = step.replace(/^\d+[\.\)]\s*/, '');
                  return (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-indigo-400/40 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {stepText}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                  {userInstructions.mixing_guide}
                </div>
              )}
            </div>
          </div>

          {/* Application Timing & Interval Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Optimal Application Timing
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-1.5 leading-relaxed">
                {userInstructions.best_spray_timing}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-500" /> Application Repeat Interval
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-1.5 leading-relaxed">
                {userInstructions.spray_interval}
              </p>
            </div>
          </div>

          {/* 2.6: Personal Protective Equipment (PPE) & Safe Handling */}
          <div className="p-4 sm:p-5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/70 dark:border-amber-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-amber-800 dark:text-amber-400 font-black uppercase text-[11px] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" /> 
                Personal Protective Equipment (PPE) & Safe Handling Protocol
              </span>
              <Badge variant="glass" className="text-amber-700 dark:text-amber-300 border-amber-400/40 bg-amber-500/10 text-[10px] font-bold">
                Mandatory Safety
              </Badge>
            </div>

            {/* 4 Dedicated PPE Safety Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/40 shadow-sm">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                  🧤
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Chemical-Resistant Gloves</h4>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Wear nitrile or neoprene rubber gloves during chemical measuring, bucket mixing, and spraying.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/40 shadow-sm">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                  🥽
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Eye Protection / Goggles</h4>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Wear safety goggles or transparent protective face shield to prevent hazardous splash contact with eyes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/40 shadow-sm">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                  😷
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Respiratory Vapor Mask</h4>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Wear an N95 particulate or chemical organic vapor mask while spraying to avoid inhaling fine mist droplets.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/40 shadow-sm">
                <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                  🥾
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">Protective Apparel & Post-Wash</h4>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Wear full-length long sleeves and waterproof gumboots; wash face, hands, and skin thoroughly with soap after spray.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    );

    const renderModeOfAction = () => (
      <CollapsibleSection 
        title={t('agrochemical.chemical_explanation', isFertilizer ? '3. Plant Growth Stages & Target Crops' : '3. Target Plants, Diseases & Mode of Action')} 
        icon={isFertilizer ? Sprout : Sparkles} 
        badge={isFertilizer ? "Growth & Nutrition" : "Target & Control"} 
        defaultOpen={true}
        onSpeak={() => {
          const text = isFertilizer
            ? `Approved crops: ${Array.isArray(chemicalExplanation.approved_crops) ? chemicalExplanation.approved_crops.join(', ') : chemicalExplanation.approved_crops}. Growth stages: vegetative, flowering, and fruiting support.`
            : `Mode of action: ${chemicalExplanation.action_mode}. Approved crops: ${Array.isArray(chemicalExplanation.approved_crops) ? chemicalExplanation.approved_crops.join(', ') : chemicalExplanation.approved_crops}. Targets: ${Array.isArray(chemicalExplanation.target_diseases_and_pests) ? chemicalExplanation.target_diseases_and_pests.join(', ') : chemicalExplanation.target_diseases_and_pests}. Pre-harvest interval: ${chemicalExplanation.preharvest_interval}.`;
          speak(text, 'agro_explanation', currentLang);
        }}
        isSpeaking={speakingId === 'agro_explanation'}
      >
        <div className="space-y-4 text-xs">
          {/* 2.4: Target Plants Used For This Product */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-800 dark:text-emerald-400 font-extrabold uppercase text-[11px] flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-emerald-600" /> Target Plants / Approved Safe Crops
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                Crop Compatibility Verified
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {Array.isArray(chemicalExplanation.approved_crops) ? (
                chemicalExplanation.approved_crops.map((crop, idx) => (
                  <span key={idx} className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold shadow-sm flex items-center gap-1.5">
                    <span>🌱</span> {crop}
                  </span>
                ))
              ) : (
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{chemicalExplanation.approved_crops}</span>
              )}
            </div>
          </div>

          {/* Conditional: If Fertilizer -> Show Specific Growth Stages (Vegetative, Flowering, Fruiting) */}
          {isFertilizer ? (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 rounded-2xl border-2 border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-emerald-800 dark:text-emerald-300 font-black uppercase text-[11px] flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Fertilizer Growth Stage Usage & Agronomic Benefits
                </span>
                <Badge variant="glow-emerald" className="text-[10px] font-bold">
                  Yield Maximization
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* Vegetative Stage */}
                <div className="p-3.5 bg-white dark:bg-slate-900/80 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 shadow-sm space-y-1.5">
                  <span className="text-emerald-700 dark:text-emerald-400 font-black uppercase text-[10px] flex items-center gap-1.5">
                    🌱 Vegetative Stage (Canopy & Root)
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {growthStages.vegetative_stage}
                  </p>
                </div>

                {/* Flowering Stage */}
                <div className="p-3.5 bg-white dark:bg-slate-900/80 rounded-xl border border-pink-200/80 dark:border-pink-900/60 shadow-sm space-y-1.5">
                  <span className="text-pink-700 dark:text-pink-400 font-black uppercase text-[10px] flex items-center gap-1.5">
                    🌸 Flowering Stage (Bloom & Retention)
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {growthStages.flowering_stage}
                  </p>
                </div>

                {/* Fruiting Stage */}
                <div className="p-3.5 bg-white dark:bg-slate-900/80 rounded-xl border border-amber-200/80 dark:border-amber-900/60 shadow-sm space-y-1.5">
                  <span className="text-amber-700 dark:text-amber-400 font-black uppercase text-[10px] flex items-center gap-1.5">
                    🍎 Fruiting & Grain Filling Stage
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {growthStages.fruiting_stage}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Target Diseases & Pests Controlled for Pesticides/Fungicides/Insecticides */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200/70 dark:border-rose-900/50 space-y-2">
                <span className="text-rose-800 dark:text-rose-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  🩺 Target Pests & Pathogens Controlled / Cured
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Array.isArray(chemicalExplanation.target_diseases_and_pests) ? (
                    chemicalExplanation.target_diseases_and_pests.map((dis, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-900 dark:text-rose-300 border border-rose-500/30 text-xs font-bold">
                        {dis}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{chemicalExplanation.target_diseases_and_pests}</span>
                  )}
                </div>
              </div>

              {/* Pre-Harvest Interval (PHI) Card */}
              <div className="p-4 bg-cyan-50/60 dark:bg-cyan-950/30 rounded-2xl border border-cyan-200/80 dark:border-cyan-900/50 flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-cyan-900 dark:text-cyan-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600" /> Pre-Harvest Interval (PHI) Waiting Period
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {chemicalExplanation.preharvest_interval}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Strictly follow this statutory interval before harvesting produce for food consumption.
                  </p>
                </div>
                <div>
                  <Badge variant="glass" className="text-cyan-700 dark:text-cyan-300 border-cyan-400/40 bg-cyan-500/10 font-bold text-[10px]">
                    Food Safety Compliant
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    );

  const defaultAgroOrder = [
    { key: 'agro_hero', label: 'Chemical Identification Hero', visible: true },
    { key: 'product_details', label: 'Product Details & Classification', visible: true },
    { key: 'application_guide', label: 'User Instructions & Dilution Guide', visible: true },
    { key: 'mode_of_action', label: 'Utility, Benefits & Action Mode', visible: true }
  ];

  const agroCardMap = {
    agro_hero: renderAgroHero,
    product_hero: renderAgroHero,
    product_details: renderProductDetails,
    application_guide: renderApplicationGuide,
    dilution_guide: renderApplicationGuide,
    mode_of_action: renderModeOfAction,
    growth_stages: renderModeOfAction,
    safety_ppe: renderApplicationGuide
  };

  const activeAgroOrder = (
    studio?.cardOrders?.['agro-scan'] &&
    studio.cardOrders['agro-scan'].some(c => agroCardMap[c.key] && agroCardMap[c.key]() !== null)
  )
    ? studio.cardOrders['agro-scan']
    : defaultAgroOrder;

  return (
    <div className="space-y-4">
      {renderLanguageSwitcher()}

      {activeAgroOrder.map((cardItem) => {
        if (cardItem.visible === false) return null;
        const renderer = agroCardMap[cardItem.key];
        if (!renderer) return null;
        const renderedNode = renderer();
        if (!renderedNode) return null;

        return (
          <div
            key={cardItem.key}
            className={`transition-all duration-300 ${studio?.getCardClass ? studio.getCardClass(cardItem.key) : ''}`}
            onMouseEnter={() => studio?.setFocusedCardKey && studio.setFocusedCardKey(cardItem.key)}
            onMouseLeave={() => studio?.setFocusedCardKey && studio.setFocusedCardKey(null)}
          >
            {renderedNode}
          </div>
        );
      })}

      {/* Product Image Zoom Modal */}
      {showImageZoom && productDetails.image_url && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <div 
            className="relative max-w-lg w-full bg-slate-900 rounded-3xl p-5 border border-slate-700 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">{productDetails.brand_name}</h3>
                <p className="text-xs text-slate-400">{productDetails.company}</p>
              </div>
              <button 
                onClick={() => setShowImageZoom(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-[70vh] flex items-center justify-center p-2">
              <img 
                src={productDetails.image_url} 
                alt={productDetails.brand_name} 
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgrochemicalResults;
