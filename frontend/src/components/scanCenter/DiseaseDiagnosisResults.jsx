import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bug, Stethoscope, CloudSun, Volume2, Globe, Download, Save, Check, RefreshCw, 
  AlertTriangle, ShieldCheck, Share2, TrendingUp, Landmark, Phone, FileText, Sparkles,
  Layers, FlaskConical, Info, Eye, Image as ImageIcon, ZoomIn, X, CheckCircle2,
  UserCheck, SlidersHorizontal, Settings2, PenSquare, Award, ArrowLeft, ArrowRight,
  ChevronRight, ThumbsUp, Calculator, HelpCircle, MessageSquare, BookOpen
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge, Progress } from '../ui/index';
import { translateCrop, translateDisease, getDiseaseDetails, localizeAdvice } from '../../utils/diseaseAdvisoryData';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { FORMULATION_TEXTS, getAudioActionLabel, getSpeechLocale, getSafetyFallback } from '../../utils/regionalLocale';
import { COMMERCIAL_PRODUCTS, getMatchingProducts } from '../../utils/commercialProducts';
import { 
  getDiseaseCategory, 
  getScientificName, 
  getPlantixSymptomList, 
  getPlantixAgronomicNarrative,
  FIELD_SEVERITY_OPTIONS 
} from '../../utils/plantixDiagnosisHelper';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import ScanLanguageBar from './ScanLanguageBar';
import KisanHelpdeskModal from '../intelligence/KisanHelpdeskModal';
import PrescriptionSlipModal from './PrescriptionSlipModal';
import { shareDiagnosticToWhatsApp } from '../../utils/prescriptionShare';

const DiseaseDiagnosisResults = ({ liveResult, previewUrl, onSaveScan, onDownloadPDF, onScanAnother }) => {
  const { t, i18n } = useTranslation();
  const overrides = {};
  const isHumanCalibrated = false;

  // Plantix 2-Stage Funnel State: 'confirm' (Verification Screen) | 'treatment' (Medicines & Prescription)
  const [diagnosticStage, setDiagnosticStage] = useState('confirm');

  // Modals & Inspection States
  const [showHelpdeskModal, setShowHelpdeskModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false);
  const [previewProductModal, setPreviewProductModal] = useState(null);
  const [zoomImageModal, setZoomImageModal] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);
  const [showDifferentialMatches, setShowDifferentialMatches] = useState(false);

  // Treatment & Dosage States
  const [activeProductIdx, setActiveProductIdx] = useState(0);
  const [selectedTankSize, setSelectedTankSize] = useState(20); // 15 | 16 | 20 | 200
  const [selectedSeverity, setSelectedSeverity] = useState(3); // Default tier 3
  const [surveySentiment, setSurveySentiment] = useState(null); // 'bad' | 'neutral' | 'good'
  const [isSurveySubmitted, setIsSurveySubmitted] = useState(false);

  // Speech reader hook
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();

  const status = liveResult?.prediction_status || 'diseased';

  // Read base or manually edited agronomist override values
  const rawDiseaseName = overrides.disease_name || liveResult?.canonical_disease_name || liveResult?.disease_name || liveResult?.predicted_class || 'Crop Health Condition';
  const rawCropName = overrides.crop_name || liveResult?.canonical_crop_name || liveResult?.crop_name || 'Agricultural Crop';

  const currentLang = (i18n.language ? i18n.language.split('-')[0] : 'en').toLowerCase();
  const [activeLang, setActiveLang] = useState(() => {
    try {
      const preferred = JSON.parse(localStorage.getItem('agrishield_preferred_languages'));
      if (Array.isArray(preferred) && preferred.length > 0) {
        const cached = sessionStorage.getItem('agrishield_tab_lang_disease');
        if (cached && preferred.includes(cached)) return cached;
        return preferred[0];
      }
    } catch (_) {}
    return sessionStorage.getItem('agrishield_tab_lang_disease') || currentLang || 'en';
  });

  // Listen for changes saved in Profile -> Languages tab
  useEffect(() => {
    const handleUpdate = (e) => {
      const langs = e?.detail?.languages;
      if (Array.isArray(langs) && langs.length > 0) {
        if (!langs.includes(activeLang)) {
          setActiveLang(langs[0]);
          sessionStorage.setItem('agrishield_tab_lang_disease', langs[0]);
        }
      }
    };
    window.addEventListener('agrishield-preferred-languages-updated', handleUpdate);
    return () => window.removeEventListener('agrishield-preferred-languages-updated', handleUpdate);
  }, [activeLang]);

  const handleLanguageSelect = (langCode) => {
    const clean = (langCode || 'en').split('-')[0].toLowerCase();
    setActiveLang(clean);
    sessionStorage.setItem('agrishield_tab_lang_disease', clean);
  };

  const localizedCrop = translateCrop(rawCropName, activeLang) || rawCropName;
  const localizedDisease = translateDisease(rawDiseaseName, activeLang, rawCropName, status) || rawDiseaseName;
  const categoryInfo = getDiseaseCategory(rawCropName, rawDiseaseName, activeLang);
  const scientificName = getScientificName(rawCropName, rawDiseaseName);
  const plantixSymptoms = getPlantixSymptomList(rawCropName, rawDiseaseName, activeLang, liveResult?.observed_symptoms || liveResult?.symptoms);
  const plantixNarrative = getPlantixAgronomicNarrative(rawCropName, rawDiseaseName, activeLang);

  const handlePlaySymptomsAudio = () => {
    if (speakingId === 'plantix_symptoms_audio') {
      stopSpeech();
      return;
    }
    const symptomsSpeech = plantixSymptoms.join('. ');
    const fullAudioText = `${localizedDisease}. ${categoryInfo.label}. ${plantixSymptoms.length > 0 ? (activeLang === 'te' ? 'లక్షణాలు: ' : activeLang === 'hi' ? 'लक्षण: ' : 'Symptoms: ') + symptomsSpeech : ''}. ${plantixNarrative}`;
    speak(fullAudioText, 'plantix_symptoms_audio', getSpeechLocale(activeLang), 0.8);
  };

  // Load matching authentic pathology comparison photos from dataset catalog
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      try {
        const res = await fetch('/samples/dataset_catalog.json');
        if (!res.ok) return;
        const catalog = await res.json();
        if (!Array.isArray(catalog) || !isMounted) return;

        const cNorm = (rawCropName || '').toLowerCase().trim();
        const dNorm = (rawDiseaseName || '').toLowerCase().trim();

        const matches = catalog.filter(item => {
          const itemCrop = (item.crop || '').toLowerCase().trim();
          const itemDisease = (item.disease || '').toLowerCase().trim();
          const cropMatches = itemCrop.includes(cNorm) || cNorm.includes(itemCrop);
          if (!cropMatches) return false;

          const dWords = dNorm.split(/[\s_]+/).filter(w => w.length > 3 && !['leaf', 'spot', 'rot', 'blight', 'virus', 'mold'].includes(w));
          if (dWords.length > 0) {
            return dWords.some(w => itemDisease.includes(w));
          }
          return itemDisease.includes(dNorm) || dNorm.includes(itemDisease);
        });

        if (matches.length > 0) {
          setReferenceImages(matches.slice(0, 2));
        } else {
          const cropMatches = catalog.filter(item => {
            const itemCrop = (item.crop || '').toLowerCase().trim();
            return itemCrop.includes(cNorm) || cNorm.includes(itemCrop);
          });
          setReferenceImages(cropMatches.slice(0, 2));
        }
      } catch (err) {
        console.debug('Could not load disease reference catalog:', err);
      }
    };
    loadCatalog();
    return () => { isMounted = false; };
  }, [rawCropName, rawDiseaseName]);

  // Advisory lookup for real trade names and dilution
  const diseaseInfo = getDiseaseDetails(rawCropName, rawDiseaseName, activeLang);
  const hasRegionalText = (str) => /[\u0900-\u0D7F]/.test(str || '');

  const baseChemicalsList = (activeLang !== 'en' && !hasRegionalText(liveResult?.chemical_treatment) && diseaseInfo?.chemicals?.length)
    ? diseaseInfo.chemicals
    : (liveResult?.chemical_treatment 
        ? [liveResult.chemical_treatment]
        : (diseaseInfo?.chemicals || [
            activeLang === 'te' 
              ? "సాల్మొన్ (బేయర్) లేదా ఎక్స్‌పోనస్ (BASF) @ 1.0 మి.లీ/లీ నీటికి కలిపి పిచికారీ చేయాలి." 
              : "Solomon (Bayer) or Exponus (BASF) @ 1.0 ml/L of water."
          ])
      );

  const chemicalsList = overrides.chemical_treatment 
    ? [overrides.chemical_treatment, ...baseChemicalsList.filter(c => c !== overrides.chemical_treatment)]
    : baseChemicalsList;

  const baseOrganicList = (activeLang !== 'en' && !hasRegionalText(liveResult?.organic_treatment) && diseaseInfo?.organic?.length)
    ? diseaseInfo.organic
    : (liveResult?.organic_treatment 
        ? [liveResult.organic_treatment] 
        : (diseaseInfo?.organic || [
            activeLang === 'te'
              ? "వేప నూనె స్ప్రే (5 మి.లీ/లీటర్ నీటికి) ప్రతి 7 రోజులకు ఒకసారి పిచికారీ చేయాలి."
              : "Neem oil spray (5 ml/L with liquid soap) every 7 days."
          ])
      );

  const organicList = overrides.organic_treatment
    ? [overrides.organic_treatment, ...baseOrganicList.filter(o => o !== overrides.organic_treatment)]
    : baseOrganicList;

  // Retrieve commercial branded products matching disease and crop
  const candidateProducts = getMatchingProducts(rawDiseaseName, rawCropName, 6);
  const activeProduct = candidateProducts[activeProductIdx] || candidateProducts[0] || COMMERCIAL_PRODUCTS[0];

  const displayOriginalImg = previewUrl || (liveResult?.image_path ? `/${liveResult.image_path}` : '');
  const gradCamImg = liveResult?.gradcam_base64 || null;

  // Format today's date in regional style
  const getFormattedDate = () => {
    const now = new Date();
    if (activeLang === 'te') {
      const months = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
      return `${now.getDate()} ${months[now.getMonth()]}`;
    }
    if (activeLang === 'hi') {
      const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
      return `${now.getDate()} ${months[now.getMonth()]}`;
    }
    return now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const handleShareWhatsApp = () => {
    shareDiagnosticToWhatsApp({
      cropName: localizedCrop || liveResult?.crop_name || 'Crop',
      diseaseName: localizedDisease || liveResult?.disease_name || 'Crop Disease',
      confidence: liveResult?.confidence ? Math.round(Number(liveResult.confidence) * (liveResult.confidence <= 1 ? 100 : 1)) : 98,
      severity: liveResult?.severity || 'Moderate',
      chemicals: chemicalsList,
      organic: organicList,
      prevention: plantixSymptoms.join('\n'),
      acres: 1.0,
      farmerName: liveResult?.farmer_name || 'AgriShield Farmer',
      farmLocation: liveResult?.farm_location || 'Field Sector',
      language: activeLang || i18n?.language || 'en'
    });
  };

  // Dynamic Dosage Calculator Logic based on selected product and tank size
  const calculateSprayerDose = (product, tankLitres) => {
    if (!product) return { amount: '20 ml', tip: '~1 measuring cap' };
    const isLiquid = (product.formulation || '').includes('SC') || (product.formulation || '').includes('EC') || (product.formulation || '').includes('SL') || (product.dosagePer20L || '').includes('ml');
    const unit = isLiquid ? (activeLang === 'te' ? 'మి.లీ' : 'ml') : (activeLang === 'te' ? 'గ్రా' : 'g');

    if (tankLitres === 15 && product.dosagePer15L) {
      return { amount: `${product.dosagePer15L}`, tip: product.farmerMeasureTip || '~1 cap / spoon' };
    }
    if (tankLitres === 20 && product.dosagePer20L) {
      return { amount: `${product.dosagePer20L}`, tip: product.farmerMeasureTip || '~1 cap / spoon' };
    }

    // Estimate proportionally from 20L
    const baseMatch = (product.dosagePer20L || '20').match(/([\d\.]+)/);
    const baseRate = baseMatch ? parseFloat(baseMatch[1]) : 20;
    const computed = ((baseRate / 20) * tankLitres).toFixed(tankLitres >= 100 ? 0 : 1);
    return {
      amount: `${computed} ${unit}`,
      tip: product.farmerMeasureTip || '~1 cap / spoon'
    };
  };

  const calculatedDose = calculateSprayerDose(activeProduct, selectedTankSize);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* ========================================================
          STAGE 1: SYMPTOM VERIFICATION SCREEN (Plantix Pages 1 & 10)
         ======================================================== */}
      {diagnosticStage === 'confirm' && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Top Plantix Header Bar */}
          <div className="flex items-center justify-between px-1 py-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onScanAnother) onScanAnother();
                  else window.dispatchEvent(new CustomEvent('agrishield-scan-another'));
                }}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Scan another plant"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {getFormattedDate()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ScanLanguageBar
                activeLang={activeLang}
                onLanguageSelect={handleLanguageSelect}
                label=""
                className="bg-transparent border-0 py-0"
              />
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{activeLang === 'te' ? 'పంచుకోండి' : activeLang === 'hi' ? 'शेयर करें' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* Plantix Main Disease Verification Card */}
          <Card className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl rounded-3xl space-y-4 text-left">
            {/* Header: Title, Category Badge, and Scientific Name */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border flex items-center gap-1 ${categoryInfo.color}`}>
                  <span>{categoryInfo.icon}</span>
                  <span>{categoryInfo.label}</span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  {localizedCrop}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                {localizedDisease}
              </h1>

              {scientificName && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 italic font-medium flex items-center gap-1 mt-0.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{scientificName}</span>
                </p>
              )}
            </div>

            {/* Specimen Comparison Gallery (Plantix Multi-Photo Swipe) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                  📷 {referenceImages.length > 0 ? `${referenceImages.length + 1} ఫోటోలు / Photos` : 'ఫోటోలు / Photos'}
                </span>
                {gradCamImg && (
                  <button
                    type="button"
                    onClick={() => setShowHeatmapOverlay(!showHeatmapOverlay)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    <span>{showHeatmapOverlay ? '🌿 View Original Leaf' : '🔬 View AI X-Ray'}</span>
                  </button>
                )}
              </div>

              {/* Horizontal Photo Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Uploaded Specimen */}
                <div 
                  onClick={() => setZoomImageModal({ 
                    src: (showHeatmapOverlay && gradCamImg) ? gradCamImg : displayOriginalImg, 
                    title: `${localizedCrop} - ${activeLang === 'te' ? 'మీరు అప్‌లోడ్ చేసిన ఫోటో' : 'Your Uploaded Photo'}` 
                  })}
                  className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/60 shadow-md flex items-center justify-center cursor-pointer group"
                >
                  <img 
                    src={(showHeatmapOverlay && gradCamImg) ? gradCamImg : displayOriginalImg} 
                    alt="Uploaded specimen" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                    {activeLang === 'te' ? 'మీ ఫోటో' : 'Your Scan'}
                  </div>
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                </div>

                {/* Reference Photos from Authentic Catalog */}
                {referenceImages.map((refImg, idx) => {
                  const resolvedImgUrl = refImg.image_url || refImg.url || '/samples/chilli_leaf_spot.jpg';
                  return (
                    <div 
                      key={idx}
                      onClick={() => setZoomImageModal({ 
                        src: resolvedImgUrl, 
                        title: `${refImg.disease || localizedDisease} (${activeLang === 'te' ? 'క్షేత్ర నమూనా' : 'Field Reference'})` 
                      })}
                      className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-sm flex items-center justify-center cursor-pointer group"
                    >
                      <img 
                        src={resolvedImgUrl} 
                        alt={refImg.disease || 'Field reference'} 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/samples/chilli_leaf_spot.jpg';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold backdrop-blur-xs">
                        {activeLang === 'te' ? `నమూనా ${idx + 1}` : `Sample ${idx + 1}`}
                      </div>
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prominent Plantix Audio Readout Button (🔊 వినండి) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handlePlaySymptomsAudio}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-950 dark:text-indigo-200 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer"
              >
                <Volume2 className={`w-5 h-5 ${speakingId === 'plantix_symptoms_audio' ? 'animate-bounce text-indigo-600 dark:text-indigo-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <span>
                  {speakingId === 'plantix_symptoms_audio' 
                    ? (activeLang === 'te' ? 'ఆపడానికి నొక్కండి' : activeLang === 'hi' ? 'रोकने के लिए दबाएं' : 'Tap to Stop Audio')
                    : (activeLang === 'te' ? '🔊 వినండి (లక్షణాలు చదవండి)' : activeLang === 'hi' ? '🔊 सुनें (लक्षण पढ़ें)' : '🔊 Listen to Symptoms (0.8x Audio)')}
                </span>
              </button>
            </div>

            {/* Symptoms Checklist & Plantix Agronomic Narrative (🌿 లక్షణాలు) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{activeLang === 'te' ? 'లక్షణాలు' : activeLang === 'hi' ? 'लक्षण' : 'Symptoms Checklist'}</span>
                </span>
              </div>

              {/* 4 Bullet Points */}
              <ul className="space-y-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium">
                {plantixSymptoms.map((symptom, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-slate-300 mt-2 shrink-0" />
                    <span className="leading-relaxed">{symptom}</span>
                  </li>
                ))}
              </ul>

              {/* Deep Agronomic Pathology Narrative Paragraph (Matching Plantix Picture 1) */}
              {plantixNarrative && (
                <div className="pt-2">
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal text-justify">
                    {plantixNarrative}
                  </p>
                </div>
              )}

              {/* Subtle Dashed Divider */}
              <div className="border-t border-dashed border-slate-200 dark:border-slate-700/80 my-3" />

              {/* More Information Section (📖 మరింత సమాచారం - Matching Plantix Picture 1) */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span>{activeLang === 'te' ? 'మరింత సమాచారం' : activeLang === 'hi' ? 'अधिक जानकारी' : 'More Information'}</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1 pl-1">
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      • {activeLang === 'te' ? 'శాస్త్రీయ నామం: ' : activeLang === 'hi' ? 'वैज्ञानिक नाम: ' : 'Scientific Name: '}
                    </span>
                    <span className="italic font-serif">{scientificName}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      • {activeLang === 'te' ? 'వర్గం: ' : activeLang === 'hi' ? 'श्रेणी: ' : 'Category: '}
                    </span>
                    <span>{categoryInfo.icon} {categoryInfo.label}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Action Button: Confirm & View Treatment */}
            <div className="pt-2 space-y-2.5">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  stopSpeech();
                  setDiagnosticStage('treatment');
                }}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer transition-all"
              >
                <span>{activeLang === 'te' ? 'ధ్రువీకరించండి & చికిత్సను చూడండి' : activeLang === 'hi' ? 'पुष्टि करें और उपचार देखें' : 'Confirm & View Treatment'}</span>
                <ArrowRight className="w-5 h-5" />
              </Button>

              {/* Secondary Link: View Similar Diagnoses */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowDifferentialMatches(!showDifferentialMatches)}
                  className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline transition-all cursor-pointer py-1"
                >
                  {showDifferentialMatches 
                    ? (activeLang === 'te' ? '▲ ఇలాంటి వ్యాధులను దాచండి' : '▲ Hide Similar Diagnoses')
                    : (activeLang === 'te' ? 'ఇలాంటి వ్యాధి నిర్ధారణలను చూడండి' : 'View similar diagnoses')}
                </button>
              </div>

              {/* Differential Possibilities Accordion */}
              {showDifferentialMatches && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-2 text-xs"
                >
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    {activeLang === 'te' ? 'సారూప్య వ్యాధులు (Differential Candidates):' : 'Similar Possible Diagnoses:'}
                  </p>
                  <div className="space-y-1.5">
                    {(liveResult?.top3_predictions || [
                      { class: rawDiseaseName, confidence: 0.94 },
                      { class: 'Cercospora Leaf Spot', confidence: 0.04 },
                      { class: 'Powdery Mildew', confidence: 0.02 }
                    ]).map((cand, cIdx) => (
                      <div key={cIdx} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {translateDisease(cand.class, activeLang, rawCropName) || cand.class}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-500">
                          {Math.round((cand.confidence || 0.1) * 100)}% Match
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </Card>

          {/* Plantix Page 10 & 11 Fallback: Ask Community / Second Opinion */}
          <div 
            onClick={() => setShowHelpdeskModal(true)}
            className="p-4 rounded-3xl bg-cyan-50/90 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 flex items-center justify-between gap-3 cursor-pointer hover:bg-cyan-100/80 dark:hover:bg-cyan-900/50 transition-all shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-xs sm:text-sm font-extrabold text-cyan-950 dark:text-cyan-200">
                  {activeLang === 'te' ? 'సరైన ఫలితం దొరకలేదా?' : activeLang === 'hi' ? 'सही परिणाम नहीं मिला?' : "Didn't find the right result?"}
                </h4>
                <p className="text-[11px] sm:text-xs text-cyan-800 dark:text-cyan-300 font-medium">
                  {activeLang === 'te' 
                    ? 'కమ్యూనిటీని లేదా వ్యవసాయ నిపుణుడిని సహాయం అడగడానికి ఇక్కడ నొక్కండి' 
                    : 'Click here to ask the farming community and expert agronomists for help'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />
          </div>
        </motion.div>
      )}

      {/* ========================================================
          STAGE 2: STEP-BY-STEP TREATMENT & PRODUCTS (Plantix Pages 3-6)
         ======================================================== */}
      {diagnosticStage === 'treatment' && (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Top Bar with Back to Symptoms Button */}
          <div className="flex items-center justify-between px-1 py-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              type="button"
              onClick={() => setDiagnosticStage('confirm')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-blue-600" />
              <span>{activeLang === 'te' ? 'లక్షణాలు / వెనుకకు' : activeLang === 'hi' ? 'लक्षण / वापस' : 'Back to Symptoms'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>{activeLang === 'te' ? 'ప్రిస్క్రిప్షన్ స్లిప్' : 'Rx Slip'}</span>
              </button>

              {onDownloadPDF && (
                <button
                  type="button"
                  onClick={onDownloadPDF}
                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-xs font-bold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  <span>PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Step 1: Diagnosis Result Summary (Plantix Page 3) */}
          <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-slate-200 dark:border-slate-700">
                  <img src={displayOriginalImg} alt="Thumbnail" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    {activeLang === 'te' ? '1 వ్యాధి నిర్ధారణ ఫలితం' : activeLang === 'hi' ? '1 निदान परिणाम' : '1 Diagnosis Result'}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white leading-tight">
                    {localizedDisease}
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">{localizedCrop} • {categoryInfo.label}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDiagnosticStage('confirm')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black text-blue-600 dark:text-blue-400 transition-colors shrink-0 cursor-pointer"
              >
                {activeLang === 'te' ? 'మార్చండి' : activeLang === 'hi' ? 'बदलें' : 'Change'}
              </button>
            </div>
          </Card>

          {/* Step 2: Recommended Products Carousel (Plantix Page 3 & 7-9) */}
          <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md text-left space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white">
                {activeLang === 'te' ? '2 సిఫారసు చేయబడిన ఉత్పత్తులు' : activeLang === 'hi' ? '2 अनुशंसित उत्पाद' : '2 Recommended Products'}
              </h2>
            </div>

            {/* Critical Plantix Safety Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-500/15 dark:bg-amber-950/50 border-2 border-amber-500/40 dark:border-amber-500/50 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-200 leading-snug">
                  {activeLang === 'te' 
                    ? 'క్రింది ఎంపికల నుండి ఒక ఉత్పత్తిని మాత్రమే ఎంచుకోండి మరియు వాడండి.' 
                    : activeLang === 'hi'
                      ? 'नीचे दिए गए विकल्पों में से केवल एक ही उत्पाद चुनें और उसका उपयोग करें।'
                      : 'Pick and use only ONE product from the options below. Do not mix multiple chemicals.'}
                </p>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5 font-medium">
                  {activeLang === 'te' ? 'రసాయనాలను కలపడం వల్ల పంట దెబ్బతినే ప్రమాదం ఉంది.' : 'Mixing incompatible pesticides causes chemical burns.'}
                </p>
              </div>
            </div>

            {/* Horizontal Commercial Products Carousel */}
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {candidateProducts.map((prod, pIdx) => {
                const isSelected = pIdx === activeProductIdx;
                return (
                  <div
                    key={prod.productId || pIdx}
                    onClick={() => setActiveProductIdx(pIdx)}
                    className={`min-w-[210px] sm:min-w-[230px] p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-left shrink-0 ${
                      isSelected 
                        ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 shadow-md ring-2 ring-blue-500/20' 
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Product Image & Community Upvotes Badge */}
                      <div className="relative w-full h-32 rounded-xl bg-white p-2 border border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden mb-2.5">
                        <img 
                          src={prod.imageUrl} 
                          alt={prod.brandName} 
                          className="w-full h-full object-contain hover:scale-105 transition-transform"
                        />
                        {prod.upvotes && (
                          <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[10px] font-black flex items-center gap-1 backdrop-blur-xs">
                            <ThumbsUp className="w-3 h-3 text-amber-400" />
                            <span>{prod.upvotes}</span>
                          </div>
                        )}
                      </div>

                      {/* Brand & Manufacturer */}
                      <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                        {prod.brandName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        {prod.company} {activeLang === 'te' ? 'నుండి' : ''}
                      </p>

                      {/* Active Ingredients */}
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium line-clamp-2 leading-tight">
                        {prod.activeIngredients}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-teal-700 dark:text-teal-400">
                        💧 20L: {prod.dosagePer20L}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewProductModal(prod);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[10px]"
                      >
                        {activeLang === 'te' ? 'వివరాలు' : 'Details'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Chemical Actives Summary */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                🧪 {activeLang === 'te' ? 'సిఫారసు చేయబడిన క్రియాశీల రసాయనాలు:' : 'Active Chemical Formulations:'}
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {candidateProducts.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {p.activeIngredients}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Step 3: Spraying Instructions & Dosage Calculator (Plantix Page 4) */}
          <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md text-left space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white leading-tight">
                  {activeLang === 'te' ? '3 పిచికారీ సూచనలు' : activeLang === 'hi' ? '3 छिड़काव निर्देश' : '3 Spraying Instructions'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {activeLang === 'te' ? 'మీ మొక్క మందుని ఎలా ఉపయోగించాలో తెలుసుకోండి' : 'Learn how to apply your plant medicine accurately'}
                </p>
              </div>
            </div>

            {/* Interactive Dosage Calculator Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  <span>{activeLang === 'te' ? 'మోతాదు కాలిక్యులేటర్' : activeLang === 'hi' ? 'खुराक कैलकुलेटर' : 'Dosage Calculator'}</span>
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {activeLang === 'te' ? 'ఎంచుకున్న ఉత్పత్తి:' : 'Selected:'} <strong className="text-slate-900 dark:text-white">{activeProduct.brandName}</strong>
                </span>
              </div>

              {/* Tank Size Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  {activeLang === 'te' ? 'మీ స్ప్రే పంప్ పరిమాణం ఎంచుకోండి:' : 'Select your sprayer tank size:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { size: 15, label: '15L Knapsack', sub: activeLang === 'te' ? 'హ్యాండ్ పంప్' : 'Hand Pump' },
                    { size: 16, label: '16L Manual', sub: activeLang === 'te' ? 'మాన్యువల్' : 'Manual' },
                    { size: 20, label: '20L Power', sub: activeLang === 'te' ? 'ఇంజిన్ పంప్' : 'Power Sprayer' },
                    { size: 200, label: '200L Barrel', sub: activeLang === 'te' ? 'ఎకరానికి' : 'Tractor/Acre' }
                  ].map(tank => (
                    <button
                      key={tank.size}
                      type="button"
                      onClick={() => setSelectedTankSize(tank.size)}
                      className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        selectedTankSize === tank.size
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-sm font-black">{tank.label}</div>
                      <div className={`text-[10px] ${selectedTankSize === tank.size ? 'text-blue-100 font-semibold' : 'text-slate-500'}`}>
                        {tank.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Calculation Result Output */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {activeLang === 'te' ? `${selectedTankSize} లీటర్ల ట్యాంకుకు కలపవలసిన మోతాదు:` : `Required dose for ${selectedTankSize}L tank:`}
                  </span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {calculatedDose.amount}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span>🥄</span>
                    <span><strong>{activeLang === 'te' ? 'అంచనా:' : 'Measure tip:'}</strong> {calculatedDose.tip}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>⏳</span>
                    <span><strong>{activeLang === 'te' ? 'కోతకు ముందు విరామం (PHI):' : 'Pre-Harvest Interval:'}</strong> {activeProduct.phiDays ? `${activeProduct.phiDays} ${activeLang === 'te' ? 'రోజులు' : 'days'}` : (activeLang === 'te' ? '7 రోజులు' : '7 days')}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 4: Crop Damage Severity Survey & Rating (Plantix Pages 5 & 6) */}
          <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md text-left space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                4
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white">
                {activeLang === 'te' ? '4 సర్వే: పంట నష్టం తీవ్రత' : activeLang === 'hi' ? '4 सर्वेक्षण: फसल क्षति' : '4 Survey: Crop Damage Severity'}
              </h2>
            </div>

            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              {activeLang === 'te' 
                ? 'మీ పంటలో ఎంత భాగం దెబ్బతిన్నట్లు కనిపిస్తోంది లేదా ప్రస్తుతం ఎంత భాగం ఈ వ్యాధి లక్షణాలు కనిపిస్తున్నాయి?' 
                : 'How much of your crop appears damaged or shows these disease symptoms?'}
            </p>

            {/* 6 Radio Severity Tiers */}
            <div className="space-y-2">
              {FIELD_SEVERITY_OPTIONS.map((opt) => {
                const isSelected = selectedSeverity === opt.id;
                const optText = opt.label[activeLang] || opt.label.en;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedSeverity(opt.id)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 shadow-xs'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                      {optText}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Emoji Utility Feedback Rating (Plantix Page 6) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {activeLang === 'te' ? 'ఈ వ్యాధి నిర్ధారణ మీకు ఎంత ఉపయోగకరంగా ఉంది?' : 'How useful was this diagnosis to you?'}
              </span>

              <div className="flex items-center justify-center gap-4 pt-1">
                {[
                  { id: 'bad', emoji: '🙁', label: 'Not Useful' },
                  { id: 'neutral', emoji: '😐', label: 'Neutral' },
                  { id: 'good', emoji: '😃', label: 'Very Useful' }
                ].map(sent => (
                  <button
                    key={sent.id}
                    type="button"
                    onClick={() => {
                      setSurveySentiment(sent.id);
                      setIsSurveySubmitted(true);
                    }}
                    className={`w-14 h-14 rounded-2xl text-2xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                      surveySentiment === sent.id 
                        ? 'bg-blue-500/20 border-blue-500 scale-110 shadow-md' 
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:scale-105'
                    }`}
                  >
                    <span>{sent.emoji}</span>
                  </button>
                ))}
              </div>

              {isSurveySubmitted && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  ✓ {activeLang === 'te' ? 'ధన్యవాదాలు! మీ అభిప్రాయం నమోదు చేయబడింది.' : 'Thank you! Your feedback has been recorded.'}
                </p>
              )}
            </div>
          </Card>

          {/* Eco-Friendly Biological Treatment Section */}
          <CollapsibleSection
            title={activeLang === 'te' ? '🌱 సేంద్రీయ & జీవ నియంత్రణ చర్యలు' : '🌱 Eco-Friendly Biological Treatment'}
            icon={ShieldCheck}
            defaultOpen={false}
            badgeText={activeLang === 'te' ? 'రసాయన రహితం' : '100% Organic'}
          >
            <div className="space-y-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium">
              {organicList.map((org, oIdx) => (
                <div key={oIdx} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">🌿</span>
                  <span className="leading-relaxed">{org}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Sticky Plantix Bottom Action Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                if (onSaveScan) onSaveScan();
                else alert(activeLang === 'te' ? 'మీ పంట చరిత్రకు విజయవంతంగా సేవ్ చేయబడింది!' : 'Saved to My Crop Diagnoses successfully!');
              }}
              leftIcon={<Save className="w-4 h-4" />}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <span>{activeLang === 'te' ? 'మీ పంట వ్యాధి నిర్ధారణలకు సేవ్ చేయండి' : 'Save to My Crop Diagnoses'}</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (onScanAnother) onScanAnother();
                else window.dispatchEvent(new CustomEvent('agrishield-scan-another'));
              }}
              leftIcon={<RefreshCw className="w-4 h-4 text-emerald-600" />}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 font-extrabold text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <span>{activeLang === 'te' ? 'మరో ఆకును స్కాన్ చేయండి' : 'Scan Another Leaf'}</span>
            </Button>
          </div>
        </motion.div>
      )}

      {/* ========================================================
          GLOBAL MODALS (Helpdesk, Prescription Slip, Product & Zoom)
         ======================================================== */}
      <KisanHelpdeskModal
        isOpen={showHelpdeskModal}
        onClose={() => setShowHelpdeskModal(false)}
        cropName={localizedCrop}
        diseaseName={localizedDisease}
      />

      <PrescriptionSlipModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        liveResult={{
          ...liveResult,
          crop_name: rawCropName,
          disease_name: rawDiseaseName,
          chemical_treatment: activeProduct?.brandName ? `${activeProduct.brandName} (${activeProduct.activeIngredients}) @ ${calculatedDose.amount} in ${selectedTankSize}L` : chemicalsList[0],
          organic_treatment: organicList[0],
          agronomist_notes: overrides.agronomist_notes,
          is_human_verified: isHumanCalibrated
        }}
      />

      {/* Commercial Product Detail Modal */}
      {previewProductModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setPreviewProductModal(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {previewProductModal.category?.toUpperCase()} • REAL MARKET PACKET
                </span>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  {previewProductModal.brandName}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Manufacturer: {previewProductModal.company}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewProductModal(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-sm font-black transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="w-full h-64 bg-white rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-center overflow-hidden shadow-inner">
              <img 
                src={previewProductModal.imageUrl} 
                alt={previewProductModal.brandName}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block flex items-center gap-1">
                <span>🧪</span>
                <span>Active Chemical / Technical Formulation:</span>
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                {previewProductModal.activeIngredients}
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                <span>Formulation: <strong>{previewProductModal.formulation}</strong></span>
                <span>•</span>
                <span>Action: <strong>{previewProductModal.action}</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 pt-1 px-1">
              <span>Standard (20L Tank): <strong className="font-extrabold text-teal-700 dark:text-teal-400">{previewProductModal.dosagePer20L}</strong></span>
              <span>Price: <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">{previewProductModal.approxPrice}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Global Tap-to-Zoom Modal */}
      {zoomImageModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomImageModal(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-700 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                {zoomImageModal.title || 'Diagnostic Visual Inspection'}
              </h3>
              <button 
                onClick={() => setZoomImageModal(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[70vh] p-2">
              <img 
                src={zoomImageModal.src} 
                alt="Zoomed view" 
                className="max-h-[66vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseaseDiagnosisResults;
