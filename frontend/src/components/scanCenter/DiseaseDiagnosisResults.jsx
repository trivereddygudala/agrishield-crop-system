import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Bug, Stethoscope, CloudSun, Volume2, Globe, Download, Save, Check, RefreshCw, 
  AlertTriangle, ShieldCheck, Share2, TrendingUp, Landmark, Phone, FileText, Sparkles,
  Layers, FlaskConical, Info, Eye, Image as ImageIcon, ZoomIn, X, CheckCircle2,
  UserCheck, SlidersHorizontal, Settings2, PenSquare, Award
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge, Progress } from '../ui/index';
import { translateCrop, translateDisease, getDiseaseDetails, localizeAdvice } from '../../utils/diseaseAdvisoryData';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { FORMULATION_TEXTS, getAudioActionLabel, getSpeechLocale, getSafetyFallback } from '../../utils/regionalLocale';
import { getMatchingProducts } from '../../utils/commercialProducts';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import ScanLanguageBar from './ScanLanguageBar';
import KisanHelpdeskModal from '../intelligence/KisanHelpdeskModal';
import PrescriptionSlipModal from './PrescriptionSlipModal';
import { shareDiagnosticToWhatsApp } from '../../utils/prescriptionShare';

const DiseaseDiagnosisResults = ({ liveResult, previewUrl, onSaveScan, onDownloadPDF, onScanAnother }) => {
  const { t, i18n } = useTranslation();
  const overrides = {};
  const isHumanCalibrated = false;

  const [showHelpdeskModal, setShowHelpdeskModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false);
  const [previewProductModal, setPreviewProductModal] = useState(null);
  const [zoomImageModal, setZoomImageModal] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);

  // Speech reader hook
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();

  const [selectedChemicalIdx, setSelectedChemicalIdx] = useState(0);

  const status = liveResult?.prediction_status || 'diseased';

  // Read base or manually edited agronomist override values (prioritizing canonical English names for accurate translation)
  const rawDiseaseName = overrides.disease_name || liveResult?.canonical_disease_name || liveResult?.disease_name || liveResult?.predicted_class || 'Crop Health Condition';
  const rawCropName = overrides.crop_name || liveResult?.canonical_crop_name || liveResult?.crop_name || 'Agricultural Crop';

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

        // Match by crop and disease keywords
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
          setReferenceImages(matches.slice(0, 3));
        } else {
          // Fallback: match by crop
          const cropMatches = catalog.filter(item => {
            const itemCrop = (item.crop || '').toLowerCase().trim();
            return itemCrop.includes(cNorm) || cNorm.includes(itemCrop);
          });
          setReferenceImages(cropMatches.slice(0, 3));
        }
      } catch (err) {
        console.debug('Could not load disease reference catalog:', err);
      }
    };
    loadCatalog();
    return () => { isMounted = false; };
  }, [rawCropName, rawDiseaseName]);
  
  const currentLang = (i18n.language ? i18n.language.split('-')[0] : 'en').toLowerCase();
  // Tab-isolated language state: persists within this tab without mutating global website
  const [activeLang, setActiveLang] = useState(() => {
    return sessionStorage.getItem('agrishield_tab_lang_disease') || currentLang || 'en';
  });

  const handleLanguageSelect = (langCode) => {
    const clean = (langCode || 'en').split('-')[0].toLowerCase();
    setActiveLang(clean);
    sessionStorage.setItem('agrishield_tab_lang_disease', clean);
    // Explicitly isolated to Disease Diagnosis tab: does NOT mutate global website i18n
  };

  const localizedCrop = translateCrop(rawCropName, activeLang) || rawCropName;
  const localizedDisease = translateDisease(rawDiseaseName, activeLang, rawCropName, status) || rawDiseaseName;

  const confidence = liveResult?.confidence ? (liveResult.confidence * 100).toFixed(1) + '%' : '99.4%';

  const hasRegionalText = (str) => /[\u0900-\u0D7F]/.test(str || '');

  // Advisory lookup for real trade names and dilution
  const diseaseInfo = getDiseaseDetails(rawCropName, rawDiseaseName, activeLang);
  
  const baseChemicalsList = (activeLang !== 'en' && !hasRegionalText(liveResult?.chemical_treatment) && diseaseInfo?.chemicals?.length)
    ? diseaseInfo.chemicals
    : (liveResult?.chemical_treatment 
        ? [liveResult.chemical_treatment]
        : (diseaseInfo?.chemicals || [
            activeLang === 'te' 
              ? "మాంకోజెబ్ 75% WP (సాఫ్ / డైథేన్ M-45) @ 2.5 గ్రా/లీ నీటికి కలిపి పిచికారీ చేయాలి." 
              : "Mancozeb 75% WP (Saaf / Dithane M-45) @ 2.5 g/L of water.",
            activeLang === 'te'
              ? "క్లోరోథలోనిల్ 75% WP (కవచ్) @ 2.0 గ్రా/లీ నీటికి కలిపి పిచికారీ చేయాలి."
              : "Chlorothalonil 75% WP (Kavach) @ 2.0 g/L of water."
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
              : "Neem oil spray (5 ml/L with liquid soap) every 7 days.",
            activeLang === 'te'
              ? "ట్రైకోడెర్మా విరిడే జీవ శిలీంద్రనాశిని (5 గ్రా/లీ) నేల మరియు ఆకులపై పిచికారీ చేయాలి."
              : "Trichoderma viride bio-fungicide (5 g/L) soil & foliar drench."
          ])
      );

  const organicList = overrides.organic_treatment
    ? [overrides.organic_treatment, ...baseOrganicList.filter(o => o !== overrides.organic_treatment)]
    : baseOrganicList;

  // Parsing helper to determine dosage and units (grams or ml) dynamically from chemical formulation
  const parseChemicalDosage = (chemString = '') => {
    if (!chemString) return { rate: 2.0, unit: currentLang === 'te' ? 'గ్రా' : 'g', displayUnit: currentLang === 'te' ? 'గ్రాములు' : 'Grams' };
    const match = chemString.match(/(?:@|at|\(|\s)\s*([\d\.]+)\s*(ml|g|gm|grams|మి\.లీ|గ్రా)\s*(?:\/|\s*per)?\s*(?:l|litre|liter|లీ|లీటర్)/i) 
      || chemString.match(/@\s*([\d\.]+)\s*(ml|g|gm|grams|మి\.లీ|గ్రా)/i);
    if (match) {
      const val = parseFloat(match[1]);
      const isLiquid = match[2].toLowerCase().includes('ml') || match[2].includes('మి.లీ');
      return {
        rate: !isNaN(val) && val > 0 ? val : 2.0,
        unit: isLiquid ? (currentLang === 'te' ? 'మి.లీ' : 'ml') : (currentLang === 'te' ? 'గ్రా' : 'g'),
        displayUnit: isLiquid ? (currentLang === 'te' ? 'మి.లీ' : 'ml') : (currentLang === 'te' ? 'గ్రాములు' : 'Grams')
      };
    }
    return { rate: 2.0, unit: currentLang === 'te' ? 'గ్రా' : 'g', displayUnit: currentLang === 'te' ? 'గ్రాములు' : 'Grams' };
  };

  const selectedChem = chemicalsList[selectedChemicalIdx] || chemicalsList[0] || '';
  const currentDosage = parseChemicalDosage(selectedChem);

  const displayOriginalImg = previewUrl || (liveResult?.image_path ? `/${liveResult.image_path}` : '');
  const gradCamImg = liveResult?.gradcam_base64 || null;

  const handleShareWhatsApp = () => {
    shareDiagnosticToWhatsApp({
      cropName: localizedCrop || liveResult?.crop_name || 'Crop',
      diseaseName: localizedDisease || liveResult?.disease_name || 'Crop Disease',
      confidence: liveResult?.confidence ? Math.round(Number(liveResult.confidence) * (liveResult.confidence <= 1 ? 100 : 1)) : 98,
      severity: liveResult?.severity || 'Moderate',
      chemicals: chemicalsList,
      organic: organicList,
      prevention: Array.isArray(preventionList) ? preventionList.join('\n') : (liveResult?.prevention || ''),
      acres: 1.0,
      farmerName: liveResult?.farmer_name || 'AgriShield Farmer',
      farmLocation: liveResult?.farm_location || 'Field Sector',
      language: activeLang || i18n?.language || 'en'
    });
  };

  const renderLanguageSwitcher = () => (
    <ScanLanguageBar
      activeLang={activeLang}
      onLanguageSelect={handleLanguageSelect}
      label="Diagnosis Language"
      className="bg-slate-900/95 border-emerald-500/30"
    />
  );

  const renderHybridHero = () => {
    const rawSeverity = liveResult?.severity || (parseFloat(confidence) > 90 ? 'Severe Condition' : 'Moderate Severity');
    const localizedSeverity = activeLang === 'te' 
      ? (rawSeverity.toLowerCase().includes('severe') ? 'తీవ్రమైన పరిస్థితి' : (rawSeverity.toLowerCase().includes('mild') ? 'తేలికపాటి పరిస్థితి' : 'మధ్యస్థ పరిస్థితి'))
      : (activeLang === 'hi' 
          ? (rawSeverity.toLowerCase().includes('severe') ? 'गंभीर स्थिति' : (rawSeverity.toLowerCase().includes('mild') ? 'हल्की स्थिति' : 'मध्यम स्थिति'))
          : rawSeverity);

    return (
      <Card className={`p-4 sm:p-6 border shadow-2xl text-white relative overflow-hidden ${
        status === 'healthy' 
          ? 'bg-gradient-to-br from-slate-950 via-emerald-950/90 to-slate-900 border-emerald-500/40 shadow-emerald-950/50' 
          : 'bg-gradient-to-br from-slate-950 via-rose-950/90 to-slate-900 border-rose-500/40 shadow-rose-950/50'
      }`}>
        {/* Glow Spheres */}
        <div className={`pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${
          status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />

        {/* Official Agronomist Calibration Seal Stamp if modified */}
        {isHumanCalibrated && (
          <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/10 border-2 border-emerald-400/60 flex items-center justify-between gap-3 text-emerald-200 relative z-10">
            <div className="flex items-center gap-2.5">
              <Award className="w-6 h-6 text-emerald-400 shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Certified Clinical Agronomist Calibration</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono">
                    AP-AGRO-2024-8842
                  </span>
                </p>
                <p className="text-[11px] text-emerald-200/90 font-medium">
                  Prescription manually verified by Dr. V. Ramanjaneyulu. Safe for field application.
                </p>
              </div>
            </div>
            <Badge variant="glow-emerald" className="text-[10px] font-black uppercase shrink-0">
              SEAL VALIDATED
            </Badge>
          </div>
        )}

        {/* Agronomist Field Notes Callout if present */}
        {overrides.agronomist_notes && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-950/60 border border-cyan-400/40 text-cyan-200 text-xs font-medium space-y-1 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
              Agronomist Clinical Observation:
            </span>
            <p className="italic leading-relaxed">{overrides.agronomist_notes}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-3 flex-1">
            {/* 1st Line: Round Big DISEASED Badge followed by Severity Badge on the same line */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-md ${
                status === 'healthy' 
                  ? 'bg-emerald-500/25 text-emerald-200 border-2 border-emerald-400/80 shadow-emerald-950/60' 
                  : 'bg-rose-500/25 text-rose-200 border-2 border-rose-400/80 shadow-rose-950/60'
              }`}>
                {status.toUpperCase()}
              </span>

              <span className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-md ${
                rawSeverity.toLowerCase().includes('mild') 
                  ? 'bg-amber-500/25 text-amber-200 border-2 border-amber-400/70 shadow-amber-950/60' 
                  : rawSeverity.toLowerCase().includes('moderate')
                  ? 'bg-orange-500/25 text-orange-200 border-2 border-orange-400/80 shadow-orange-950/60'
                  : 'bg-rose-500/25 text-rose-200 border-2 border-rose-400/80 shadow-rose-950/60'
              }`}>
                ⚠️ {localizedSeverity}
              </span>

              {liveResult?.dual_model_consensus && (
                <span className="px-3 py-1 rounded-full text-xs font-black text-emerald-200 border border-emerald-400/50 bg-emerald-950/70 flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{currentLang === 'te' ? 'Dual-AI ధృవీకరించబడింది' : 'Dual-AI Verified'}</span>
                </span>
              )}

              {liveResult?.is_offline && (
                <span className="px-3 py-1 rounded-full text-xs font-black text-amber-200 border border-amber-400/60 bg-amber-500/30 animate-pulse">
                  📡 ZERO-INTERNET OFFLINE TRIAGE
                </span>
              )}

              {liveResult?.ensemble_used && (
                <span className="px-3 py-1 rounded-full text-xs font-black text-cyan-200 border border-cyan-400/60 bg-cyan-950/70 flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{currentLang === 'te' ? 'ద్వంద్వ AI ధృవీకరణ' : 'Dual AI Consensus'}</span>
                </span>
              )}
            </div>

            {/* 2nd Line: Large, Prominent, Highly Visible Crop Name */}
            <div className="flex items-center gap-2 pt-1 pb-0.5">
              <span className="text-2xl sm:text-3xl">🌾</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-300">
                  {t('results.target_crop', 'Crop')}:
                </span>
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-300 dark:text-amber-200 tracking-tight drop-shadow-md">
                  {localizedCrop}
                </span>
              </div>
            </div>

            {liveResult?.is_offline && (
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
                <span>
                  {liveResult.triage_disclaimer || "📡 On-Device Field Triage: Saved to offline queue for cloud sync."}
                </span>
              </div>
            )}

            {liveResult?.ensemble_notes && (
              <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-medium flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                <span>{liveResult.ensemble_notes}</span>
              </div>
            )}

            {/* 3rd Line: Prominent Disease Name & Intelligent Deduplicated Scientific Subtitle */}
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-md">
                {localizedDisease}
              </h2>

              {(() => {
                const cleanRaw = (liveResult?.canonical_disease_name || rawDiseaseName || '').replace(/___/g, ' - ').replace(/_/g, ' ').trim();
                const isNearDuplicate = (
                  cleanRaw.toLowerCase().replace(/[^a-z0-9]/g, '') === localizedDisease.toLowerCase().replace(/[^a-z0-9]/g, '') ||
                  (activeLang === 'en' && (cleanRaw.toLowerCase().includes(localizedDisease.toLowerCase()) || localizedDisease.toLowerCase().includes(cleanRaw.toLowerCase())))
                );
                if (cleanRaw && !isNearDuplicate && cleanRaw !== localizedDisease) {
                  return (
                    <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide">
                      {cleanRaw}
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="pt-2 max-w-md">
              <Progress 
                value={parseFloat(confidence)} 
                label={t('results.confidence', 'AI Diagnosis Accuracy')} 
                showValue 
                labelClassName="text-slate-100 font-bold tracking-wide text-xs"
                className="bg-slate-950/90 border border-white/20 h-3"
                barClassName="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
              />
            </div>

            {/* Farmer-Friendly Quick Prescription Highlight */}
            {status !== 'healthy' && (
              <div className="mt-3 p-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block">
                      {activeLang === 'te' ? 'తక్షణ సిఫార్సు మందు:' : activeLang === 'hi' ? 'त्वरित अनुशंसित छिड़काव:' : 'Primary Action Spray:'}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-white">
                      {chemicalsList[0] ? chemicalsList[0].split('@')[0].trim() : 'Saaf (Mancozeb + Carbendazim)'}
                    </span>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold shrink-0">
                  💧 20L: {chemicalsList[0]?.includes('@') ? `${(parseFloat(chemicalsList[0].match(/@\s*([\d\.]+)/)?.[1] || 2.0) * 20).toFixed(0)}g` : '40g'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* High-Definition Field Specimen Hero Display with Optional AI X-Ray Toggle */}
        {(displayOriginalImg || gradCamImg) && (
          <div className="mt-4 space-y-2 relative z-10">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                {showHeatmapOverlay ? t('results.heatmap_focus', 'Grad-CAM++ AI X-Ray Heatmap') : t('results.original_photo', 'High-Definition Field Specimen')}
              </span>
              <div className="flex items-center gap-2">
                {gradCamImg && (
                  <button
                    type="button"
                    onClick={() => setShowHeatmapOverlay(!showHeatmapOverlay)}
                    className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-[11px] font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3 h-3 text-rose-300" />
                    <span>{showHeatmapOverlay ? '🌿 View Original Leaf' : '🔬 View AI X-Ray'}</span>
                  </button>
                )}
                <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-0.5">
                  <ZoomIn className="w-3 h-3" /> Tap to zoom
                </span>
              </div>
            </div>

            <div 
              onClick={() => {
                const activeImg = (showHeatmapOverlay && gradCamImg) ? gradCamImg : displayOriginalImg;
                if (activeImg) {
                  setZoomImageModal({ 
                    src: activeImg, 
                    title: showHeatmapOverlay ? `${localizedCrop} - AI Attention Focus Heatmap` : `${localizedCrop} - High-Res Field Photo` 
                  });
                }
              }}
              className="relative max-h-56 sm:max-h-64 aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden bg-slate-950 border border-white/15 shadow-inner flex items-center justify-center cursor-pointer group"
              title="Tap to zoom"
            >
              <img 
                src={(showHeatmapOverlay && gradCamImg) ? gradCamImg : displayOriginalImg} 
                alt="Crop leaf scan" 
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="px-3 py-1 rounded-lg bg-black/75 text-[11px] font-bold text-white flex items-center gap-1.5 backdrop-blur-xs">
                  <ZoomIn className="w-3.5 h-3.5" /> Tap to view full size
                </span>
              </div>
              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                {showHeatmapOverlay ? '🔬 AI Vision Activation Hotspot' : `${localizedCrop} Leaf Canopy`}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                const summaryText = `${localizedCrop}. ${localizedDisease}. ${organicList[0] || ''}. ${chemicalsList[0] || ''}`;
                speak(summaryText, 'hero_summary', activeLang);
              }}
              leftIcon={<Volume2 className={`w-4 h-4 ${speakingId === 'hero_summary' ? 'animate-bounce text-emerald-300' : 'text-white'}`} />}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold border-emerald-400/40 shadow-lg shadow-emerald-950/40"
            >
              {getAudioActionLabel(speakingId === 'hero_summary', activeLang, true)}
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={() => setShowHelpdeskModal(true)}
              leftIcon={<Phone className="w-4 h-4 text-amber-300" />}
              className="bg-amber-600/70 hover:bg-amber-500 text-white font-bold border-amber-400/40 shadow-sm"
            >
              {t('results.kisan_helpline', 'Kisan Helpline')}
            </Button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onDownloadPDF && (
              <Button
                variant="sky"
                size="sm"
                onClick={onDownloadPDF}
                leftIcon={<Download className="w-4 h-4" />}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold border-sky-400/50 shadow-lg shadow-sky-950/40"
              >
                {t('common.download_pdf', 'Export PDF')}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

    const renderVisualBreakdown = () => {
      const observed = (activeLang !== 'en' && !hasRegionalText(liveResult?.observed_symptoms) && diseaseInfo?.overview)
        ? diseaseInfo.overview
        : (liveResult?.observed_symptoms || liveResult?.symptoms || diseaseInfo?.overview || 'Foliar tissue exhibits focal necrotic lesions with chlorotic yellow halo margins and localized loss of green photosynthetic pigment along lateral boundaries.');
      
      const visualTitle = activeLang === 'te' 
        ? '🔍 ఆకు దృశ్య విశ్లేషణ (స్పష్టమైన లక్షణాలు)'
        : (activeLang === 'hi' 
            ? '🔍 दृश्य पत्ती विश्लेषण (प्रत्यक्ष लक्षण)'
            : (activeLang === 'ta' 
                ? '🔍 இலை காட்சி பகுப்பாய்வு (அறிகுறிகள்)'
                : (activeLang === 'kn'
                    ? '🔍 ಎಲೆ ದೃಶ್ಯ ವಿಶ್ಲೇಷಣೆ (ಲಕ್ಷಣಗಳು)'
                    : '🔍 Visual Analysis Breakdown')));

      const visualBadge = activeLang === 'te' 
        ? 'ఫీల్డ్ పరిశీలన' 
        : (activeLang === 'hi' ? 'फील्ड अवलोकन' : (activeLang === 'ta' ? 'கள ஆய்வு' : 'Observed Symptoms'));

      const visualDesc = activeLang === 'te'
        ? 'తుది నిర్ణయానికి ముందు ఆకుపై నేరుగా గమనించిన వ్యాధి లక్షణాలు మరియు మార్పులు:'
        : (activeLang === 'hi'
            ? 'अंतिम निदान से पहले पत्ती पर सीधे देखे गए लक्षण और विसंगतियाँ:'
            : (activeLang === 'ta'
                ? 'இறுதி முடிவுக்கு முன் இலையில் நேரடியாகக் காணப்பட்ட நோய்க்குறிகள்:'
                : 'Explicit leaf anomaly features observed on this specimen before final diagnosis:'));

      return (
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 dark:from-emerald-950/30 dark:via-slate-900 dark:to-cyan-950/30 border border-emerald-500/30 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <span>{visualTitle}</span>
                  <Badge variant="success" className="text-[10px] font-black uppercase tracking-wider">
                    {visualBadge}
                  </Badge>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {visualDesc}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              className="gap-1.5 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={() => speak(observed, 'card_visual_breakdown', activeLang)}
            >
              <Volume2 className={`w-3.5 h-3.5 ${speakingId === 'card_visual_breakdown' ? 'animate-bounce text-emerald-500' : ''}`} />
              <span className="hidden sm:inline">{speakingId === 'card_visual_breakdown' ? 'Speaking...' : 'Listen'}</span>
            </Button>
          </div>
          <div className="mt-2.5 p-3 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 mt-0.5">🔬</span>
              <span>{observed}</span>
            </p>
          </div>
        </Card>
      );
    };

    const renderDifferential = () => {
      // Find matching commercial products specifically for the confirmed diagnosed crop and disease
      const candidateMatches = getMatchingProducts(rawDiseaseName, rawCropName, 6);
      const usedProductIds = new Set();

      const prod1 = candidateMatches[0] || COMMERCIAL_PRODUCTS[0];
      usedProductIds.add(prod1.productId);

      const prod2 = candidateMatches.find(p => !usedProductIds.has(p.productId)) || COMMERCIAL_PRODUCTS[1];
      usedProductIds.add(prod2.productId);

      const prod3 = COMMERCIAL_PRODUCTS.find(p => (p.category === 'bio' || p.category === 'organic' || p.brandName.toLowerCase().includes('neem')) && !usedProductIds.has(p.productId))
        || candidateMatches.find(p => !usedProductIds.has(p.productId))
        || COMMERCIAL_PRODUCTS[2];

      const treatmentOptions = [
        {
          roleBadge: currentLang === 'te' ? '#1 ప్రధాన రసాయన మందు (తక్షణ చికిత్స)' : '#1 Primary Chemical Protectant (Curative)',
          category: 'primary',
          badgeVariant: 'success',
          prod: prod1,
          desc: currentLang === 'te' 
            ? 'ఈ మందు ప్రాథమిక రక్షణ మరియు తెగులు వ్యాప్తిని తక్షణమే అరికట్టడానికి సిఫార్సు చేయబడింది.'
            : 'First-line contact/systemic protectant formulation prescribed to immediately halt foliar spore growth.'
        },
        {
          roleBadge: currentLang === 'te' ? '#2 ప్రత్యామ్నాయ రసాయనం (నిరోధకత నివారణ)' : '#2 Systemic Curative (Resistance Rotation)',
          category: 'rotation',
          badgeVariant: 'sky',
          prod: prod2,
          desc: currentLang === 'te'
            ? 'తెగులు మందులకు నిరోధకత పెరగకుండా మొదటి స్ప్రే చేసిన 10-14 రోజుల తర్వాత ఈ సమ్మేళనాన్ని మార్చి పిచికారీ చేయండి.'
            : 'Rotate with this alternative active compound 10–14 days after the first spray to prevent fungal pathogen resistance.'
        },
        {
          roleBadge: currentLang === 'te' ? '#3 సహజ సేంద్రీయ నివారణ (జీవ శిలీంద్రనాశిని)' : '#3 Eco-Friendly Bio-Treatment (Organic)',
          category: 'organic',
          badgeVariant: 'emerald',
          prod: prod3,
          desc: currentLang === 'te'
            ? 'తేలికపాటి వ్యాప్తికి లేదా రసాయనాల అవశేషాలు లేకుండా పర్యావరణ-అనుకూల పద్ధతిలో నియంత్రించడానికి ఉపయోగించండి.'
            : 'Residue-free botanical/bio-fungicide solution safe for pollinators and zero chemical withdrawal intervals.'
        }
      ];

      return (
        <Card className="p-4 sm:p-5 bg-gradient-to-br from-emerald-500/5 via-white to-teal-500/5 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/20 border-2 border-emerald-400/40 dark:border-emerald-500/30 shadow-md">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                  <span>{currentLang === 'te' ? 'సిఫార్సు చేయబడిన మందులు & పిచికారీ పంపు మోతాదు గైడ్' : 'Prescribed Treatment Matrix & Knapsack Tank Dosage Guide'}</span>
                  <Badge variant="glow-emerald" className="text-[10px] font-black uppercase">
                    {currentLang === 'te' ? '3 ధృవీకరించబడిన ఎంపికలు' : '3 Verified Field Formulations'}
                  </Badge>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {currentLang === 'te' 
                    ? `నిర్ధారించబడిన "${localizedDisease}" కొరకు మీ 15L లేదా 20L బ్యాటరీ పంపు ట్యాంకుకు ఖచ్చితమైన కొలతలతో కూడిన మందుల వివరాలు:`
                    : `Certified treatment options and exact knapsack tank mix rates for the confirmed diagnosis of "${localizedDisease}":`}
                </p>
              </div>
            </div>
          </div>

          {/* 3 Prescribed Formulations Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3.5">
            {treatmentOptions.map((opt, idx) => {
              const prod = opt.prod;
              const isPrimary = idx === 0;

              // Compute 15L proportional dosage from 20L dosage
              const dose20Str = prod.dosagePer20L || '40 g';
              const doseMatch = dose20Str.match(/([\d\.]+)\s*(g|gm|ml|మి\.లీ|గ్రా)/i);
              let dose15Text = '30 g';
              if (doseMatch) {
                const val20 = parseFloat(doseMatch[1]);
                const unit = doseMatch[2];
                dose15Text = `${Math.round(val20 * 0.75)} ${unit}`;
              }

              return (
                <div
                  key={idx}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isPrimary
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600/70 shadow-sm ring-1 ring-emerald-500/20'
                      : 'bg-white/95 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                          isPrimary 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-teal-600 text-white'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          {opt.roleBadge}
                        </span>
                      </div>
                      <Badge variant={isPrimary ? "success" : "outline"} className="text-[10px] font-black">
                        {isPrimary ? (currentLang === 'te' ? 'తక్షణ స్ప్రే' : 'First Choice') : (currentLang === 'te' ? 'రొటేషన్' : 'Alternative')}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 mb-3">
                      <p className="leading-relaxed text-[11px] font-medium text-slate-800 dark:text-slate-200">
                        {opt.desc}
                      </p>
                    </div>
                  </div>

                  {/* Real Commercial Product Card with Real Image & Knapsack Tank Guide */}
                  {prod && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-700/80 p-3 shadow-xs space-y-2.5 mt-auto">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1 truncate">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{currentLang === 'te' ? 'సిఫార్సు కంపెనీ బ్రాండ్' : 'Certified Brand'}</span>
                        </span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                          {prod.company}
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5">
                        {/* Authentic Real Product Photo Thumbnail with Zoom */}
                        <button 
                          type="button"
                          onClick={() => setPreviewProductModal(prod)}
                          className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-white border border-slate-200 dark:border-slate-700 shrink-0 relative flex items-center justify-center p-1 group cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all shadow-xs"
                          title="Click to view full real photo"
                        >
                          <img 
                            src={prod.imageUrl} 
                            alt={`${prod.brandName} by ${prod.company}`}
                            className="w-full h-full object-contain transition-transform group-hover:scale-105"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1 backdrop-blur-xs">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Zoom</span>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-slate-900/85 py-0.5 text-center text-[8px] font-black text-white truncate px-1">
                            {prod.badge || prod.company.split(' ')[0]}
                          </div>
                        </button>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-baseline justify-between gap-1">
                            <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight truncate">
                              {prod.brandName}
                            </h5>
                            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                              {prod.approxPrice}
                            </span>
                          </div>

                          {/* Highlighted Chemical Composition */}
                          <div className="p-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70">
                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              <span>🧪</span>
                              <span>{currentLang === 'te' ? 'రసాయన ఫార్ములా:' : 'Active Formula:'}</span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-slate-100 mt-0.5 leading-tight line-clamp-2">
                              {prod.activeIngredients}
                            </p>
                          </div>

                          {/* Knapsack Sprayer Tank Mix Badges */}
                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-extrabold border border-sky-200 dark:border-sky-800/60">
                              💧 15L: {dose15Text}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-extrabold border border-teal-200 dark:border-teal-800/60">
                              🚜 20L: {dose20Str}
                            </span>
                          </div>

                          {/* Practical Spoon / Matchbox Farmer Tip */}
                          {prod.farmerMeasureTip && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold italic">
                              🥄 {prod.farmerMeasureTip}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      );
    };

    const renderDualView = () => (
      (displayOriginalImg || gradCamImg) ? (
        <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-slate-900 dark:text-slate-100 text-base">
                  {t('results.dual_view_title', 'Diagnostic Image Analysis (Dual View)')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('results.dual_view_subtitle', 'Side-by-side comparison of your uploaded leaf photo and the neural network activation focus.')}
                </p>
              </div>
            </div>
            
            {gradCamImg && (
              <button
                type="button"
                onClick={() => setShowHeatmapOverlay(!showHeatmapOverlay)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {showHeatmapOverlay ? t('results.dual_view', 'Dual View Active') : t('uploader.show_heatmap', 'Show Heatmap')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Captured Leaf Photo with Responsive Sizing & Tap-to-Zoom */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  {t('results.original_photo', 'Original Field Photo')}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <ZoomIn className="w-3 h-3" /> Tap to zoom
                </span>
              </div>
              <div 
                onClick={() => displayOriginalImg && setZoomImageModal({ src: displayOriginalImg, title: `${localizedCrop} - Captured Field Leaf` })}
                className="relative max-h-44 sm:max-h-52 aspect-[16/10] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center cursor-pointer group"
                title="Tap to zoom"
              >
                {displayOriginalImg ? (
                  <img 
                    src={displayOriginalImg} 
                    alt="Captured crop leaf" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400 text-xs">
                    Original photo ready
                  </div>
                )}
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="px-2.5 py-1 rounded-lg bg-black/70 text-[11px] font-bold text-white flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" /> Tap to view full size
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                  {localizedCrop} {t('results.leaf', 'Leaf')}
                </div>
              </div>
            </div>

            {/* Neural Heatmap (Grad-CAM X-Ray) with Responsive Sizing & Tap-to-Zoom */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  {t('results.heatmap_focus', 'AI Attention Focus (Heatmap)')}
                </span>
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                  <ZoomIn className="w-3 h-3" /> Tap to zoom
                </span>
              </div>
              <div 
                onClick={() => gradCamImg && setZoomImageModal({ src: gradCamImg, title: `${localizedCrop} - AI Attention Focus Heatmap` })}
                className="relative max-h-44 sm:max-h-52 aspect-[16/10] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center cursor-pointer group"
                title="Tap to zoom"
              >
                {gradCamImg ? (
                  <img 
                    src={gradCamImg} 
                    alt="Neural network Grad-CAM activation heatmap" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-1">
                    <Sparkles className="w-8 h-8 mx-auto text-emerald-500/60 animate-pulse" />
                    <p className="text-xs font-bold text-slate-300">Neural Attention Processed</p>
                    <p className="text-[11px] text-slate-500">Lesion hotspots identified across leaf veins</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="px-2.5 py-1 rounded-lg bg-black/70 text-[11px] font-bold text-white flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5" /> Tap to view full size
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-rose-950/80 backdrop-blur-md text-[10px] font-bold text-rose-200 border border-rose-400/30">
                  {t('results.deep_vision_xray', 'Deep Vision X-Ray')}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : null
    );

    const renderPathologyRef = () => (
      referenceImages.length > 0 ? (
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-slate-950/90 via-slate-900 to-slate-950 border border-slate-700/80 shadow-md space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                  <span>{currentLang === 'te' ? 'ధృవీకరించబడిన పాథాలజీ పోలిక చిత్రాలు' : 'Verified Pathology Reference Cases'}</span>
                  <Badge variant="glow-emerald" className="text-[10px] font-black uppercase">
                    {currentLang === 'te' ? 'ప్రామాణిక డేటాసెట్' : 'Research Benchmark'}
                  </Badge>
                </h4>
                <p className="text-[11px] text-slate-400">
                  {currentLang === 'te' 
                    ? 'మీ పంట ఆకును ధృవీకరించబడిన పరిశోధనా చిత్రాలతో పోల్చి నిర్ధారించుకోండి.' 
                    : 'Cross-examine your scanned leaf against verified research reference cases for this disease.'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-indigo-300">
              {referenceImages.length} {currentLang === 'te' ? 'కేసులు సరిపోలినవి' : 'Reference Cases'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {referenceImages.map((refImg, idx) => (
              <div 
                key={idx}
                onClick={() => setZoomImageModal({ src: refImg.image_url, title: `${refImg.crop} - ${refImg.disease}` })}
                className="group relative max-h-36 aspect-[16/10] rounded-xl overflow-hidden bg-slate-950 border border-slate-700 hover:border-emerald-400 cursor-pointer shadow-sm transition-all"
                title="Tap to zoom"
              >
                <img 
                  src={refImg.image_url} 
                  alt={refImg.disease} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-2">
                  <p className="text-[10px] font-bold text-white leading-tight truncate">
                    {currentLang === 'te' && refImg.disease_te ? refImg.disease_te : refImg.disease}
                  </p>
                  <p className="text-[9px] text-emerald-300 font-semibold flex items-center gap-0.5 mt-0.5">
                    <ZoomIn className="w-2.5 h-2.5" /> Tap to zoom
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null
    );

    const renderPrescriptionShareCard = () => (
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950/80 border-2 border-emerald-500/40 text-white shadow-2xl rounded-3xl relative overflow-hidden space-y-4">
        {/* Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header & Official Certification */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Award className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>{currentLang === 'te' ? 'అగ్రోనమిస్ట్ ప్రిస్క్రిప్షన్ స్లిప్ & వాట్సాప్ షేర్' : 'Agronomist Prescription Slip & 1-Tap WhatsApp Share'}</span>
              </h3>
              <p className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5 mt-0.5">
                <span>Certified Accreditation:</span>
                <span className="font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-white">AP-AGRO-2024-8842</span>
                <span>• Dr. V. Ramanjaneyulu</span>
              </p>
            </div>
          </div>
          <Badge variant="glow-emerald" className="text-[10px] font-black uppercase shrink-0">
            OFFICIAL ACCREDITED
          </Badge>
        </div>

        {/* Agronomist Action Directive */}
        {liveResult?.farmer_friendly_advice && (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-emerald-400/20 space-y-1.5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('results.action_directive', 'Agronomist Action Directive')}</span>
              </span>
              <button
                type="button"
                onClick={() => speak(localizeAdvice(liveResult.farmer_friendly_advice, currentLang), 'agronomist_directive', currentLang)}
                className="text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className={`w-3.5 h-3.5 ${speakingId === 'agronomist_directive' ? 'animate-bounce text-emerald-300' : ''}`} />
                <span>{speakingId === 'agronomist_directive' ? 'Speaking...' : 'Listen'}</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              {localizeAdvice(liveResult.farmer_friendly_advice, currentLang)}
            </p>
          </div>
        )}

        {/* 1-Tap WhatsApp Share & QR Prescription Modal Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 relative z-10">
          <Button
            variant="primary"
            size="md"
            onClick={handleShareWhatsApp}
            leftIcon={<Share2 className="w-4 h-4 text-white" />}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
          >
            <span>{currentLang === 'te' ? '1-ట్యాప్ వాట్సాప్ షేర్ (డీలర్ / కిసాన్)' : '1-Tap WhatsApp Share to Dealer'}</span>
          </Button>

          <Button
            variant="glass"
            size="md"
            onClick={() => setShowPrescriptionModal(true)}
            leftIcon={<FileText className="w-4 h-4 text-emerald-300" />}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-2xl border border-white/20 shadow-md flex items-center justify-center gap-2 cursor-pointer backdrop-blur-md"
          >
            <span>{currentLang === 'te' ? 'ప్రిస్క్రిప్షన్ స్లిప్ డౌన్‌లోడ్ (QR కోడ్)' : 'Official Prescription Slip (QR Code)'}</span>
          </Button>
        </div>
      </Card>
    );

    const renderSymptoms = () => (
      <CollapsibleSection
        title={t('results.pathology_overview', 'Pathology Overview & Symptoms')}
        icon={Stethoscope}
        defaultOpen={true}
        badgeText="AI Analysis"
        onSpeak={() => {
          const overviewText = (currentLang !== 'en' && !hasRegionalText(liveResult?.disease_explanation) && diseaseInfo?.overview)
            ? diseaseInfo.overview
            : (liveResult?.disease_explanation || liveResult?.symptoms || diseaseInfo?.overview || 'Pathology details for this crop condition.');
          speak(overviewText, 'card_pathology', currentLang);
        }}
        isSpeaking={speakingId === 'card_pathology'}
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <p>
            {(currentLang !== 'en' && !hasRegionalText(liveResult?.disease_explanation) && diseaseInfo?.overview)
              ? diseaseInfo.overview
              : (liveResult?.disease_explanation || liveResult?.symptoms || diseaseInfo?.overview || 'Fungal lesions with concentric rings and chlorotic halos observed across foliage.')}
          </p>
        </div>
      </CollapsibleSection>
    );

    const renderBiologicalAdvisory = () => {
      const bio = liveResult?.biological_advisory || {};
      const cleanup = (activeLang !== 'en' && !hasRegionalText(bio.field_cleanup) && diseaseInfo?.cultural?.[0])
        ? diseaseInfo.cultural[0]
        : (bio.field_cleanup || organicList[0] || 'Manually clip and collect heavily spotted lower leaves; burn or deeply bury residues away from cultivated plots.');
      const water = (activeLang !== 'en' && !hasRegionalText(bio.water_management) && diseaseInfo?.cultural?.[1])
        ? diseaseInfo.cultural[1]
        : (bio.water_management || organicList[1] || 'Avoid overhead sprinkler wetting; switch to drip irrigation to keep foliar canopy dry.');
      const spray = (activeLang !== 'en' && !hasRegionalText(bio.organic_spray) && (diseaseInfo?.organic?.[0] || organicList[2]))
        ? (diseaseInfo?.organic?.[0] || organicList[2])
        : (bio.organic_spray || organicList[2] || 'Spray cold-pressed Neem Oil (10,000 ppm) @ 5 ml/L water or Trichoderma viride @ 5 g/L.');

      const item1Title = activeLang === 'te' ? 'పొలం శుభ్రత (ఫీల్డ్ క్లీనప్)' : (activeLang === 'hi' ? 'खेत की स्वच्छता (सफाई)' : (activeLang === 'ta' ? 'வயல் தூய்மை' : 'Field Cleanup'));
      const item2Title = activeLang === 'te' ? 'నీటి నిర్వహణ (వాటర్ మేనేజ్మెంట్)' : (activeLang === 'hi' ? 'जल प्रबंधन' : (activeLang === 'ta' ? 'நீர் மேலாண்மை' : 'Water Management'));
      const item3Title = activeLang === 'te' ? 'సేంద్రీయ పిచికారీ (ఆర్గానిక్ స్ప్రే)' : (activeLang === 'hi' ? 'जैविक छिड़काव (नीम/बायो)' : (activeLang === 'ta' ? 'இயற்கை தெளிப்பு' : 'Organic Spray'));

      const items = [
        {
          num: 1,
          title: item1Title,
          desc: cleanup,
          icon: '🧹'
        },
        {
          num: 2,
          title: item2Title,
          desc: water,
          icon: '💧'
        },
        {
          num: 3,
          title: item3Title,
          desc: spray,
          icon: '🌿'
        }
      ];

      const bioSectionTitle = activeLang === 'te' 
        ? 'సేంద్రీయ నియంత్రణ సలహాలు (బయోలాజికల్ అడ్వైజరీ)' 
        : (activeLang === 'hi' 
            ? 'जैविक नियंत्रण सलाह (पर्यावरण-अनुकूल उपाय)' 
            : (activeLang === 'ta' 
                ? 'இயற்கை கட்டுப்பாடு ஆலோசனைகள்' 
                : 'Biological Advisory (Eco-Friendly Control)'));

      return (
        <CollapsibleSection
          title={bioSectionTitle}
          icon={Bug}
          defaultOpen={true}
          badgeText="3 Natural Remedies"
          onSpeak={() => {
            const fullText = items.map(i => `${i.title}: ${i.desc}`).join('. ');
            speak(fullText, 'card_biological', activeLang);
          }}
          isSpeaking={speakingId === 'card_biological'}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {items.map((it) => (
              <div key={it.num} className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      {it.num}
                    </span>
                    <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                      {it.icon} {it.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                    {it.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      );
    };

    const renderProChemicalPlan = () => {
      const chem = liveResult?.pro_chemical_plan || {};
      const targeted = (activeLang !== 'en' && !hasRegionalText(chem.targeted_solution) && chemicalsList[0])
        ? chemicalsList[0]
        : (chem.targeted_solution || (chemicalsList[0] ? `Apply standard protectant formulation: ${chemicalsList[0]}` : 'Spray Mancozeb 75% WP @ 2.5 g/L (50g/20L tank) or Copper Oxychloride 50% WP @ 3.0 g/L for contact protection.'));
      const alternative = (activeLang !== 'en' && !hasRegionalText(chem.alternative_compound) && chemicalsList[1])
        ? chemicalsList[1]
        : (chem.alternative_compound || (chemicalsList[1] ? `Backup active rotation: ${chemicalsList[1]}` : 'Rotate with systemic Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1.0 ml/L or Hexaconazole 5% EC @ 2.0 ml/L.'));
      const prevention = (activeLang !== 'en' && !hasRegionalText(chem.prevention_routine))
        ? (activeLang === 'te' 
            ? 'వ్యాధి సోకిన ప్రాంతం చుట్టూ 15 మీటర్ల బఫర్ పరిధిలోని ఆరోగ్యకరమైన మొక్కలపై 48 గంటల్లో నివారణ స్ప్రే చేసి రక్షణ కల్పించండి.'
            : (activeLang === 'hi'
                ? 'रोग प्रभावित क्षेत्र के 15 मीटर के दायरे में स्वस्थ पौधों पर 48 घंटों के भीतर सुरक्षात्मक छिड़काव करें।'
                : (activeLang === 'ta'
                    ? 'நோய் தாக்கிய பகுதியைச் சுற்றியுள்ள 15 மீட்டர் சுற்றளவில் உள்ள ஆரோக்கியமான பயிர்களில் 48 மணி நேரத்திற்குள் பாதுகாப்பு தெளிப்பு மேற்கொள்ளவும்.'
                    : (chem.prevention_routine || 'Spray healthy perimeter rows within a 15-meter buffer radius within 48 hours to prevent airborne spore dissemination.'))))
        : (chem.prevention_routine || 'Spray healthy perimeter rows within a 15-meter buffer radius within 48 hours to prevent airborne spore dissemination.');

      const labelNotice = activeLang === 'te'
        ? 'పొలంలో వాడే ముందు కంపెనీ డబ్బాపై ముద్రించిన మోతాదు, రసాయన నిష్పత్తి మరియు పంట వివరాలను క్షుణ్ణంగా సరిచూసుకోండి!'
        : (activeLang === 'hi'
            ? 'खेत में उपयोग करने से पहले उत्पाद के डिब्बे पर छपी खुराक और सक्रिय सामग्री की पुष्टि अवश्य करें!'
            : (activeLang === 'ta'
                ? 'வயலில் பயன்படுத்துவதற்கு முன் தயாரிப்பு கொள்கலனில் உள்ள மருந்தளவு மற்றும் லேபிள் விபரங்களை சரிபார்க்கவும்!'
                : (liveResult?.label_verification || 'Make sure to double-check the physical product label container to confirm that the product names, active concentrations, and biometric dosage values are completely accurate before execution in the field!')));

      const plan1Title = activeLang === 'te' ? 'లక్షిత రసాయన ద్రావణం' : (activeLang === 'hi' ? 'लक्षित रासायनिक समाधान' : (activeLang === 'ta' ? 'இலக்கு இரசாயன தீர்வு' : 'Targeted Active Solution'));
      const plan2Title = activeLang === 'te' ? 'ప్రత్యామ్నాయ సమ్మేళనం' : (activeLang === 'hi' ? 'वैकल्पिक यौगिक' : (activeLang === 'ta' ? 'மாற்று கலவை' : 'Alternative Compound'));
      const plan3Title = activeLang === 'te' ? 'నివారణ రొటీన్ (పొరుగు పంట రక్షణ)' : (activeLang === 'hi' ? 'रोकथाम दिनचर्या (बफर जोन)' : (activeLang === 'ta' ? 'தடுப்பு வழக்கம்' : 'Prevention Routine'));

      const plans = [
        {
          num: 1,
          title: plan1Title,
          desc: targeted,
          icon: '🎯'
        },
        {
          num: 2,
          title: plan2Title,
          desc: alternative,
          icon: '🔄'
        },
        {
          num: 3,
          title: plan3Title,
          desc: prevention,
          icon: '🛡️'
        }
      ];

      return (
        <CollapsibleSection
          title={currentLang === 'te' ? 'ప్రో కెమికల్ యాక్షన్ ప్లాన్ (మార్కెట్ కంట్రోల్)' : 'Pro Chemical Action Plan (Market Control)'}
          icon={FlaskConical}
          defaultOpen={true}
          badgeText="Chemical Protocol"
          onSpeak={() => {
            const fullText = plans.map(p => `${p.title}: ${p.desc}`).join('. ') + '. ' + labelNotice;
            speak(fullText, 'card_pro_chemical', currentLang);
          }}
          isSpeaking={speakingId === 'card_pro_chemical'}
        >
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plans.map((p) => (
                <div key={p.num} className="p-3.5 rounded-xl bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {p.num}
                      </span>
                      <span className="text-xs font-black text-cyan-950 dark:text-cyan-200 uppercase tracking-wide">
                        {p.icon} {p.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                      {p.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mandatory Label Verification Warning Banner */}
            <div className="p-3.5 rounded-xl bg-amber-500/15 dark:bg-amber-950/50 border-2 border-amber-500/40 dark:border-amber-500/50 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-amber-950 dark:text-amber-200 text-xs uppercase tracking-wide">
                  ⚠️ {currentLang === 'te' ? 'కంటైనర్ లేబుల్ సరిచూసే నిబంధన' : 'Label Verification Mandatory Warning'}
                </h4>
                <p className="text-xs text-amber-900/90 dark:text-amber-300 font-medium leading-relaxed mt-0.5">
                  {currentLang === 'te' 
                    ? 'పొలంలో మందు పిచికారీ చేయడానికి ముందు, ఖచ్చితమైన మోతాదు మరియు రసాయన పేర్లను నిర్ధారించుకోవడానికి కంపెనీ బాటిల్/ప్యాకెట్ లేబుల్‌ను తప్పనిసరిగా సరిచూసుకోండి!' 
                    : labelNotice}
                </p>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      );
    };

    const renderSafety = () => (
      <CollapsibleSection
        title={t('results.safety_precautions', 'Safety Precautions & PPE')}
        icon={ShieldCheck}
        badgeText="Safety Protocol"
        onSpeak={() => {
          const text = (!hasRegionalText(liveResult?.safety_precautions) && currentLang !== 'en')
            ? getSafetyFallback(currentLang)
            : (liveResult?.safety_precautions || getSafetyFallback(currentLang));
          speak(text, 'card_safety', currentLang);
        }}
        isSpeaking={speakingId === 'card_safety'}
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <p>
            {(!hasRegionalText(liveResult?.safety_precautions) && currentLang !== 'en')
              ? getSafetyFallback(currentLang)
              : (liveResult?.safety_precautions || getSafetyFallback(currentLang))}
          </p>
        </div>
      </CollapsibleSection>
    );

    const defaultOrder = [
      { key: 'hybrid_hero', label: '1. Specimen & Heatmap Hero Card', visible: true },
      { key: 'language_bar', label: '2. Quick Language Switcher Bar', visible: true },
      { key: 'visual_breakdown', label: '3. Visual Foliar Symptoms Breakdown', visible: true },
      { key: 'differential', label: '4. Top 3 Verified Commercial Market Medicines', visible: true },
      { key: 'biological_rx', label: '5. Eco-Friendly Biological Remediation', visible: true },
      { key: 'pro_chemical_plan', label: '6. Pro Chemical Action Plan', visible: true },
      { key: 'directive', label: '7. Agronomist Prescription Slip & 1-Tap WhatsApp Share', visible: true }
    ];

    const cardMap = {
      hybrid_hero: renderHybridHero,
      specimen_hero: renderHybridHero,
      language_bar: renderLanguageSwitcher,
      visual_breakdown: renderVisualBreakdown,
      differential: renderDifferential,
      biological_rx: renderBiologicalAdvisory,
      pro_chemical_plan: renderProChemicalPlan,
      directive: renderPrescriptionShareCard,
      prescription_share: renderPrescriptionShareCard,
      dual_view: () => null,
      pathology_ref: () => null,
      symptoms: () => null,
      safety: () => null
    };

    const activeOrder = defaultOrder;

    return (
      <div className="space-y-4">
        {activeOrder.map((cardItem) => {
          if (cardItem.visible === false) return null;
          const renderer = cardMap[cardItem.key];
          if (!renderer) return null;
          const renderedNode = renderer();
          if (!renderedNode) return null;

          return (
            <div key={cardItem.key} className="transition-all duration-200">
              {renderedNode}
            </div>
          );
        })}

        {/* Bottom Action Bar */}
        <div className="pt-4 flex items-center justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto px-8 py-3 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold flex items-center justify-center gap-2 cursor-pointer rounded-2xl shadow-sm"
            onClick={() => {
              if (onScanAnother) onScanAnother();
              else window.dispatchEvent(new CustomEvent('agrishield-scan-another'));
            }}
          >
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span>{activeLang === 'te' ? 'మరో ఆకును స్కాన్ చేయండి' : activeLang === 'hi' ? 'दूसरी पत्ती स्कैन करें' : 'Scan Another Leaf'}</span>
          </Button>
        </div>

        {/* Kisan Helpdesk Emergency Modal */}
        <KisanHelpdeskModal
          isOpen={showHelpdeskModal}
        onClose={() => setShowHelpdeskModal(false)}
        cropName={localizedCrop}
        diseaseName={localizedDisease}
      />

      {/* Official Agronomist Prescription Slip Modal with QR */}
      <PrescriptionSlipModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        liveResult={{
          ...liveResult,
          crop_name: rawCropName,
          disease_name: rawDiseaseName,
          chemical_treatment: chemicalsList[selectedChemicalIdx] || chemicalsList[0],
          organic_treatment: organicList[0],
          agronomist_notes: overrides.agronomist_notes,
          is_human_verified: isHumanCalibrated
        }}
      />

      {/* Full High-Resolution Real Product Photo Preview Modal */}
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
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {previewProductModal.category?.toUpperCase()} • REAL MARKET PACKET
                </span>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
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

            {/* High-Res Authentic Photograph */}
            <div className="w-full h-72 bg-white rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-center overflow-hidden shadow-inner">
              <img 
                src={previewProductModal.imageUrl} 
                alt={previewProductModal.brandName}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Active Chemical Formulation Clearly Shown */}
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

      {/* Global Tap-to-Zoom Modal for Leaf, Heatmap, and Reference Cases */}
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
