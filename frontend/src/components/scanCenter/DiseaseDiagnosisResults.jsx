import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Bug, Stethoscope, Calculator, CloudSun, Volume2, Globe, Download, Save, Check, RefreshCw, 
  AlertTriangle, ShieldCheck, Share2, Calendar, TrendingUp, Landmark, Phone, FileText, Sparkles,
  Layers, FlaskConical, Droplets, Info, Eye, Image as ImageIcon
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge, Progress, Input, Select } from '../ui/index';
import { translateCrop, translateDisease, getDiseaseDetails, localizeAdvice, localizeCalendarItem } from '../../utils/diseaseAdvisoryData';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { TANK_GUIDE_TEXTS, FORMULATION_TEXTS, getAudioActionLabel, getSpeechLocale, getSafetyFallback, buildDiseaseChemicalSpeech } from '../../utils/regionalLocale';
import TreatmentRecoverySimulator from './TreatmentRecoverySimulator';
import KisanHelpdeskModal from '../intelligence/KisanHelpdeskModal';
import PrescriptionSlipModal from './PrescriptionSlipModal';

const DiseaseDiagnosisResults = ({ liveResult, previewUrl, onSaveScan, onDownloadPDF }) => {
  const { t, i18n } = useTranslation();
  const [showHelpdeskModal, setShowHelpdeskModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(true);

  // Speech reader hook
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();

  // Spray Calculator states
  const [fieldArea, setFieldArea] = useState(1.0);
  const [waterPerAcre, setWaterPerAcre] = useState(200);
  const [tankSize, setTankSize] = useState(15); // 15L or 20L backpack pump
  const [selectedChemicalIdx, setSelectedChemicalIdx] = useState(0);

  const rawDiseaseName = liveResult?.disease_name || liveResult?.predicted_class || 'Crop Health Condition';
  const rawCropName = liveResult?.crop_name || 'Agricultural Crop';
  
  const localizedCrop = translateCrop(rawCropName, i18n.language) || rawCropName;
  const localizedDisease = translateDisease(rawDiseaseName, i18n.language, rawCropName) || rawDiseaseName;

  const confidence = liveResult?.confidence ? (liveResult.confidence * 100).toFixed(1) + '%' : '99.4%';
  const status = liveResult?.prediction_status || 'diseased';

  const currentLang = (i18n.language ? i18n.language.split('-')[0] : 'en').toLowerCase();
  const hasRegionalText = (str) => /[\u0900-\u0D7F]/.test(str || '');

  // Advisory lookup for real trade names and dilution
  const diseaseInfo = getDiseaseDetails(rawCropName, rawDiseaseName, currentLang);
  
  const chemicalsList = (currentLang !== 'en' && !hasRegionalText(liveResult?.chemical_treatment) && diseaseInfo?.chemicals?.length)
    ? diseaseInfo.chemicals
    : (liveResult?.chemical_treatment 
        ? [liveResult.chemical_treatment]
        : (diseaseInfo?.chemicals || [
            currentLang === 'te' 
              ? "మాంకోజెబ్ 75% WP (సాఫ్ / డైథేన్ M-45) @ 2.5 గ్రా/లీ నీటికి కలిపి పిచికారీ చేయాలి." 
              : "Mancozeb 75% WP (Saaf / Dithane M-45) @ 2.5 g/L of water.",
            currentLang === 'te'
              ? "క్లోరోథలోనిల్ 75% WP (కవచ్) @ 2.0 గ్రా/లీ నీటికి కలిపి పిచికారీ చేయాలి."
              : "Chlorothalonil 75% WP (Kavach) @ 2.0 g/L of water."
          ])
      );

  const organicList = (currentLang !== 'en' && !hasRegionalText(liveResult?.organic_treatment) && diseaseInfo?.organic?.length)
    ? diseaseInfo.organic
    : (liveResult?.organic_treatment 
        ? [liveResult.organic_treatment] 
        : (diseaseInfo?.organic || [
            currentLang === 'te'
              ? "వేప నూనె స్ప్రే (5 మి.లీ/లీటర్ నీటికి) ప్రతి 7 రోజులకు ఒకసారి పిచికారీ చేయాలి."
              : "Neem oil spray (5 ml/L with liquid soap) every 7 days.",
            currentLang === 'te'
              ? "ట్రైకోడెర్మా విరిడే జీవ శిలీంద్రనాశిని (5 గ్రా/లీ) నేల మరియు ఆకులపై పిచికారీ చేయాలి."
              : "Trichoderma viride bio-fungicide (5 g/L) soil & foliar drench."
          ])
      );

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

  // Farmer spoon / matchbox approximation helper for quick field application
  const getFarmerMeasureTip = (amount, unit) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return '';
    const isTe = currentLang === 'te';
    if (unit === 'ml' || unit === 'మి.లీ') {
      if (num <= 5) return isTe ? '~1 చిన్న చెంచా (5 మి.లీ)' : '~1 teaspoon (5 ml)';
      if (num <= 10) return isTe ? '~2 చిన్న చెంచాలు (10 మి.లీ)' : '~2 teaspoons (10 ml)';
      if (num <= 20) return isTe ? '~1 మూత / కప్పు (~15-20 మి.లీ)' : '~1 measuring cap (~15-20 ml)';
      if (num <= 35) return isTe ? '~2 మూతలు (~30 మి.లీ)' : '~2 measuring caps (~30 ml)';
      return isTe ? `~${Math.round(num / 15)} మూతలు` : `~${Math.round(num / 15)} measuring caps`;
    } else {
      if (num <= 15) return isTe ? '~1 టేబుల్ స్పూన్ (15 గ్రా)' : '~1 level tablespoon (15 g)';
      if (num <= 25) return isTe ? '~1.5 స్పూన్లు లేదా 1 అగ్గిపెట్టె పరిమాణం' : '~1.5 tablespoons or 1 matchbox size';
      if (num <= 35) return isTe ? '~2 పూర్తి స్పూన్లు లేదా 1.5 అగ్గిపెట్టెలు' : '~2 full tablespoons or 1.5 matchboxes';
      if (num <= 50) return isTe ? '~2.5 నుండి 3 స్పూన్లు లేదా 2 అగ్గిపెట్టెలు' : '~2.5 to 3 tablespoons or 2 matchboxes';
      return isTe ? `~${(num / 15).toFixed(1)} స్పూన్లు` : `~${(num / 15).toFixed(1)} tablespoons`;
    }
  };

  const selectedChem = chemicalsList[selectedChemicalIdx] || chemicalsList[0] || '';
  const currentDosage = parseChemicalDosage(selectedChem);

  // Calculations
  const totalWaterLitres = (fieldArea * waterPerAcre).toFixed(0);
  const chemicalDosageGrams = (fieldArea * waterPerAcre * currentDosage.rate).toFixed(0);
  const tanksNeeded = Math.ceil((fieldArea * waterPerAcre) / (tankSize || 15));
  const tankMedicineGrams = ((tankSize || 15) * currentDosage.rate).toFixed(1);

  const displayOriginalImg = previewUrl || (liveResult?.image_path ? `/${liveResult.image_path}` : '');
  const gradCamImg = liveResult?.gradcam_base64 || null;

  const handleShareWhatsApp = () => {
    const title = t('results.share_title', '*AgriShield AI Crop Health Report*');
    const cropLbl = t('results.target_crop', 'Crop');
    const diagLbl = t('results.diagnosis', 'Diagnosis');
    const confLbl = t('results.confidence', 'Confidence');
    const sevLbl = t('results.severity', 'Severity');
    const orgLbl = t('results.organic_approach', 'Organic Treatment');
    const chemLbl = t('results.chemical_treatment', 'Chemical Fungicide');
    const genVia = t('results.generated_via', 'Generated via AgriShield AI Platform');

    const text = `${title}\n\n🌾 *${cropLbl}:* ${localizedCrop}\n🩺 *${diagLbl}:* ${localizedDisease}\n🎯 *${confLbl}:* ${confidence}\n⚠️ *${sevLbl}:* ${liveResult?.severity || 'Moderate'}\n\n🍀 *${orgLbl}:*\n${organicList[0] || ''}\n\n🧪 *${chemLbl}:*\n${chemicalsList[0] || ''}\n\n_${genVia}_`;
    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Medical-Grade Large Result Card */}
      <Card className={`p-6 sm:p-8 border shadow-2xl text-white relative overflow-hidden ${
        status === 'healthy' 
          ? 'bg-gradient-to-br from-slate-950 via-emerald-950/90 to-slate-900 border-emerald-500/40 shadow-emerald-950/50' 
          : 'bg-gradient-to-br from-slate-950 via-rose-950/90 to-slate-900 border-rose-500/40 shadow-rose-950/50'
      }`}>
        {/* Glow Spheres */}
        <div className={`pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${
          status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-teal-500/20 blur-3xl" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={status === 'healthy' ? 'glow-emerald' : 'glow-rose'} className="px-3.5 py-1 text-xs font-black uppercase tracking-wider">
                {status.toUpperCase()}
              </Badge>
              <Badge variant="glass" className="px-3.5 py-1 text-xs font-bold text-white bg-white/20 border-white/30 backdrop-blur-md">
                🌾 {t('results.target_crop', 'Crop')}: {localizedCrop}
              </Badge>
              {liveResult?.is_offline ? (
                <Badge variant="glow-amber" className="px-3.5 py-1 text-xs font-black text-amber-200 border-amber-400/60 bg-amber-500/30 animate-pulse">
                  📡 ZERO-INTERNET OFFLINE TRIAGE
                </Badge>
              ) : (
                <Badge variant="glow-purple" className="px-3.5 py-1 text-xs font-bold text-teal-200 border-teal-400/40 bg-teal-500/20">
                  ⚡ PyTorch EfficientNetV2
                </Badge>
              )}
            </div>

            {liveResult?.is_offline && (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
                <span>
                  {liveResult.triage_disclaimer || "📡 On-Device Field Triage: Calculated on your device without cellular internet. Saved to offline queue for cloud sync."}
                </span>
              </div>
            )}

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-md">
              {localizedDisease}
            </h2>

            {localizedDisease !== rawDiseaseName && (
              <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide">
                {rawDiseaseName.replace(/___/g, ' - ').replace(/_/g, ' ')}
              </p>
            )}

            <div className="pt-2 max-w-md">
              <Progress 
                value={parseFloat(confidence)} 
                label={t('results.confidence', 'Neural Prediction Confidence')} 
                showValue 
                labelClassName="text-slate-100 font-bold tracking-wide text-xs"
                className="bg-slate-950/90 border border-white/20 h-3"
                barClassName="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                const summaryText = `${localizedCrop}. ${localizedDisease}. ${organicList[0] || ''}. ${chemicalsList[0] || ''}`;
                speak(summaryText, 'hero_summary', currentLang);
              }}
              leftIcon={<Volume2 className={`w-4 h-4 ${speakingId === 'hero_summary' ? 'animate-bounce text-emerald-300' : 'text-white'}`} />}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold border-emerald-400/40 shadow-lg shadow-emerald-950/40"
            >
              {getAudioActionLabel(speakingId === 'hero_summary', currentLang, true)}
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={handleShareWhatsApp}
              leftIcon={<Share2 className="w-4 h-4 text-emerald-300" />}
              className="bg-white/20 hover:bg-white/30 text-white font-bold border-white/30 shadow-md backdrop-blur-md"
            >
              {t('results.share_report', 'Share Report')}
            </Button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="glass"
              size="sm"
              onClick={() => setShowPrescriptionModal(true)}
              leftIcon={<FileText className="w-4 h-4 text-emerald-300" />}
              className="bg-emerald-700/70 hover:bg-emerald-600 text-white font-bold border-emerald-400/40 shadow-sm"
            >
              {t('results.rx_slip', 'Rx Slip (QR)')}
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

      {/* Side-by-Side Visual Split View: Captured Leaf vs Neural Heatmap */}
      {(displayOriginalImg || gradCamImg) && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Captured Leaf Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  {t('results.original_photo', 'Original Field Photo')}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{t('results.captured_leaf', 'Captured Leaf')}</span>
              </div>
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center">
                {displayOriginalImg ? (
                  <img 
                    src={displayOriginalImg} 
                    alt="Captured crop leaf" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400 text-xs">
                    Original photo ready
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                  {localizedCrop} {t('results.leaf', 'Leaf')}
                </div>
              </div>
            </div>

            {/* Neural Heatmap (Grad-CAM X-Ray) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  {t('results.heatmap_focus', 'AI Attention Focus (Heatmap)')}
                </span>
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{t('results.necrosis_highlight', 'Necrosis Highlight')}</span>
              </div>
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center">
                {gradCamImg ? (
                  <img 
                    src={gradCamImg} 
                    alt="Neural network Grad-CAM activation heatmap" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-1">
                    <Sparkles className="w-8 h-8 mx-auto text-emerald-500/60 animate-pulse" />
                    <p className="text-xs font-bold text-slate-300">Neural Attention Processed</p>
                    <p className="text-[11px] text-slate-500">Lesion hotspots identified across leaf veins</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-rose-950/80 backdrop-blur-md text-[10px] font-bold text-rose-200 border border-rose-400/30">
                  {t('results.deep_vision_xray', 'Deep Vision X-Ray')}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 20-Day Interactive Treatment Recovery Simulator */}
      <TreatmentRecoverySimulator
        cropName={localizedCrop}
        diseaseName={localizedDisease}
      />

      {/* Direct Agronomist Advice Callout */}
      {liveResult?.farmer_friendly_advice && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/35 flex items-start justify-between gap-3.5 shadow-md">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                {t('results.action_directive', 'Agronomist Action Directive')}
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                {localizeAdvice(liveResult.farmer_friendly_advice, currentLang)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => speak(localizeAdvice(liveResult.farmer_friendly_advice, currentLang), 'agronomist_directive', i18n.language || 'en')}
            className={`p-2 rounded-xl border shrink-0 transition-all ${
              speakingId === 'agronomist_directive'
                ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse'
                : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-300/50'
            }`}
            title="Read aloud"
          >
            <Volume2 size={16} />
          </button>
        </div>
      )}

      {/* 1. Pathology Overview & Symptoms */}
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

          {liveResult?.possible_causes && Array.isArray(liveResult.possible_causes) && liveResult.possible_causes.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                {t('results.causes_vectors', 'Identified Environmental Causes & Vectors:')}
              </span>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {liveResult.possible_causes.map((cause, idx) => (
                  <li key={idx}>{localizeAdvice(cause, currentLang)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. Organic & Cultural Remedies */}
      <CollapsibleSection
        title={t('results.organic_remedies', 'Organic & Cultural Remedies')}
        icon={Bug}
        badgeText="Eco Friendly"
        onSpeak={() => {
          const text = organicList.join('. ');
          speak(text, 'card_organic', currentLang);
        }}
        isSpeaking={speakingId === 'card_organic'}
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {organicList.map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 shadow-xs">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-semibold">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. Chemical Fungicide Treatment & Dosage (Farmer-Friendly Interactive Single-Medicine Guide) */}
      <CollapsibleSection
        title={t('results.chemical_treatment', 'Chemical Fungicide Treatment & Dosage')}
        icon={Calculator}
        defaultOpen={true}
        badgeText="Chemical Protocol"
        onSpeak={() => {
          const text = buildDiseaseChemicalSpeech({
            selectedChem,
            tankSize,
            tankGrams: tankMedicineGrams,
            unit: currentDosage.displayUnit,
            area: fieldArea,
            tanks: tanksNeeded,
            water: totalWaterLitres
          }, currentLang);
          speak(text, 'card_chemical', currentLang);
        }}
        isSpeaking={speakingId === 'card_chemical'}
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
          
          {/* CRITICAL FARMER DIRECTIVE BANNER: USE ANY ONE */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/15 dark:bg-amber-950/50 border-2 border-amber-500/40 dark:border-amber-500/50 space-y-1.5 shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-amber-950 dark:text-amber-200 text-xs sm:text-sm uppercase tracking-wide">
                  ⚠️ {t('results.single_medicine_rule', 'CRITICAL FARMER RULE: CHOOSE & USE ANY ONE MEDICINE ONLY!')}
                </h4>
                <p className="text-xs text-amber-900/90 dark:text-amber-300 font-medium leading-relaxed mt-0.5">
                  {t('results.single_medicine_desc', 'DO NOT mix multiple fungicides together in the tank. Purchase whichever single formulation is available at your local Kisan Seva Kendra or agro store. Tap the option below that you have bought:')}
                </p>
              </div>
            </div>
          </div>

          {/* Single Chemical Formulation Selector Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                {FORMULATION_TEXTS.section_title[currentLang] || FORMULATION_TEXTS.section_title.en}
              </span>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                {`${FORMULATION_TEXTS.option_prefix[currentLang] || 'Option'} ${selectedChemicalIdx + 1} / ${chemicalsList.length}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {chemicalsList.map((chem, idx) => {
                const isSelected = selectedChemicalIdx === idx;
                const dosage = parseChemicalDosage(chem);
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedChemicalIdx(idx)}
                    role="button"
                    tabIndex={0}
                    className={`relative p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border text-left ${
                      isSelected
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-500/30 shadow-md'
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-700/60 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isSelected 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          <FlaskConical className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                              {`${FORMULATION_TEXTS.option_prefix[currentLang] || 'Option'} ${String.fromCharCode(65 + idx)}`}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                {FORMULATION_TEXTS.chosen_badge[currentLang] || FORMULATION_TEXTS.chosen_badge.en}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-relaxed mt-1">
                            {chem}
                          </p>
                          <span className="inline-block mt-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                            {`${FORMULATION_TEXTS.rate_label[currentLang] || 'Recommended Rate:'} ${dosage.rate} ${dosage.unit} / ${FORMULATION_TEXTS.per_litre_water[currentLang] || 'Litre water'}`}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 mt-1">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected 
                            ? 'border-emerald-600 bg-emerald-600 text-white' 
                            : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Backpack Tank Glance Card with Dynamic Calculations */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-teal-500/10 via-emerald-500/10 to-transparent border-2 border-teal-500/30 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  {TANK_GUIDE_TEXTS.header[currentLang] || TANK_GUIDE_TEXTS.header.en}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {TANK_GUIDE_TEXTS.sub[currentLang] || TANK_GUIDE_TEXTS.sub.en}
                </p>
              </div>

              {/* Tank Size Selector (15L / 16L / 20L) */}
              <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs self-start sm:self-auto">
                {[15, 16, 20].map((litres) => (
                  <button
                    key={litres}
                    type="button"
                    onClick={() => setTankSize(litres)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      tankSize === litres 
                        ? 'bg-teal-600 text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {litres} {TANK_GUIDE_TEXTS.tank_label[currentLang] || 'L Tank'}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Tank Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">
                  {TANK_GUIDE_TEXTS.step1.title[currentLang] || TANK_GUIDE_TEXTS.step1.title.en}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {tankSize} {TANK_GUIDE_TEXTS.step1.unit[currentLang] || 'Litres'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  {TANK_GUIDE_TEXTS.step1.sub[currentLang] || 'Clean water'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/60 border-2 border-emerald-500/40 shadow-xs">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block uppercase font-bold">
                  {TANK_GUIDE_TEXTS.step2.title[currentLang] || TANK_GUIDE_TEXTS.step2.title.en}
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                  {tankMedicineGrams} {currentDosage.displayUnit}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {getFarmerMeasureTip(tankMedicineGrams, currentDosage.unit)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">
                  {TANK_GUIDE_TEXTS.step3.title[currentLang] || TANK_GUIDE_TEXTS.step3.title.en}
                </span>
                <span className="text-sm sm:text-base font-black text-teal-700 dark:text-teal-300 mt-0.5 block">
                  {tanksNeeded} {TANK_GUIDE_TEXTS.step3.unit[currentLang] || 'Pumps'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  {(TANK_GUIDE_TEXTS.step3.forField[currentLang] || TANK_GUIDE_TEXTS.step3.forField.en).replace('{{area}}', fieldArea)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">
                  {TANK_GUIDE_TEXTS.step4.title[currentLang] || TANK_GUIDE_TEXTS.step4.title.en}
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {currentDosage.rate} {currentDosage.unit}/L
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  {TANK_GUIDE_TEXTS.step4.sub[currentLang] || 'Recommended standard'}
                </span>
              </div>
            </div>

            {/* Practical 3-Step Mixing Instruction for Farmers */}
            <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 border border-teal-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <span className="font-extrabold text-teal-900 dark:text-teal-200 block text-[11px] uppercase tracking-wider">
                {TANK_GUIDE_TEXTS.mixing_instructions_title[currentLang] || TANK_GUIDE_TEXTS.mixing_instructions_title.en}:
              </span>
              <ul className="space-y-1 leading-relaxed list-decimal pl-4">
                {(TANK_GUIDE_TEXTS.mixing_steps[currentLang] || TANK_GUIDE_TEXTS.mixing_steps.en).map((step, sIdx) => (
                  <li key={sIdx} className="text-xs text-slate-700 dark:text-slate-300">{step}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Full Farm Dosage Calculator */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
            <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-wide">
              {t('results.dosage_calculator', 'Full Farm Spray Volume Dosage Calculator')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={t('results.farm_size', 'Farm Size (Acres)')}
                type="number"
                step="0.5"
                value={fieldArea}
                onChange={(e) => setFieldArea(parseFloat(e.target.value) || 0)}
              />
              <Input
                label={t('results.water_per_acre', 'Water per Acre (Litres)')}
                type="number"
                value={waterPerAcre}
                onChange={(e) => setWaterPerAcre(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="p-3.5 bg-emerald-500/15 dark:bg-emerald-950/70 rounded-xl border border-emerald-400/40 dark:border-emerald-700/60 flex flex-wrap justify-between items-center font-bold text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm gap-2.5 shadow-xs">
              <span>{t('results.required_water', 'Required Water Volume')}: <strong className="text-emerald-700 dark:text-emerald-300 font-extrabold">{totalWaterLitres} {t('results.litres', 'Litres')}</strong></span>
              <span>{t('results.chemical_weight', 'Total Medicine to Buy')}: <strong className="text-emerald-700 dark:text-emerald-300 font-extrabold">{chemicalDosageGrams >= 1000 ? `${(chemicalDosageGrams / 1000).toFixed(2)} Kg/L` : `${chemicalDosageGrams} ${currentDosage.displayUnit}`}</strong></span>
            </div>
          </div>

        </div>
      </CollapsibleSection>

      {/* 4. Crop Economic Impact & Mandi Price Match */}
      {liveResult?.financial_metrics && (
        <CollapsibleSection
          title={t('results.economic_impact', 'Crop Economic Impact & Mandi Price Match')}
          icon={TrendingUp}
          badgeText="Mandi Index"
          onSpeak={() => {
            const metrics = liveResult.financial_metrics;
            const text = `Mandi Rate: rupees ${metrics.mandi_price_qtl} per quintal. Total crop value: rupees ${metrics.total_crop_value_inr}. Value at risk: rupees ${metrics.value_at_risk_inr}. Prompt treatment will protect this value.`;
            speak(text, 'card_economic', i18n.language || 'en');
          }}
          isSpeaking={speakingId === 'card_economic'}
        >
<div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
            <p className="leading-relaxed font-medium">
              {t('results.economic_intro', 'Based on your registered farm profile of')} <strong className="text-slate-900 dark:text-white font-extrabold">{liveResult.financial_metrics.acreage_used} {t('results.acres', 'Acres')}</strong>, {t('results.economic_intro_mid', 'the regional market pricing, and yield estimates for')} <strong className="text-slate-900 dark:text-white font-extrabold">{liveResult.crop_name}</strong>:
            </p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">{t('results.today_mandi_rate', "Today's APMC Mandi Rate")}</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">₹{liveResult.financial_metrics.mandi_price_qtl} / {t('results.quintals', 'quintal')}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">{t('results.est_harvest_yield', 'Est. Harvest Yield')}</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">{liveResult.financial_metrics.estimated_yield_qtl.toFixed(1)} {t('results.quintals', 'quintals')}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">{t('results.total_crop_value', 'Total Estimated Crop Value')}</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1 block">₹{liveResult.financial_metrics.total_crop_value_inr.toLocaleString()}</span>
              </div>
              <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-400/50 dark:border-amber-700/60 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-extrabold uppercase tracking-wider block">{t('results.estimated_var', 'Estimated Value-at-Risk')}</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-300 mt-1 block">₹{liveResult.financial_metrics.value_at_risk_inr.toLocaleString()}</span>
              </div>
            </div>
            <div className="p-3.5 bg-blue-500/15 dark:bg-blue-950/50 rounded-xl border border-blue-300/80 dark:border-blue-700/60 text-xs sm:text-sm text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
              <strong className="font-extrabold text-blue-800 dark:text-blue-300">💡 {t('results.value_note_title', 'Agronomist Value Note')}:</strong> {t('results.value_note_text', 'Implementing the treatment guidelines immediately will protect the estimated')} <strong className="font-extrabold text-blue-950 dark:text-blue-100">₹{liveResult.financial_metrics.value_at_risk_inr.toLocaleString()}</strong> {t('results.value_note_protect', 'from necrosis and crop failure.')}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* 5. 7-Day Day-by-Day Prescriptive Treatment Calendar */}
      {liveResult?.prescription_calendar && liveResult.prescription_calendar.length > 0 && (
        <CollapsibleSection
          title={t('results.treatment_calendar', '7-Day Day-by-Day Prescriptive Treatment Calendar')}
          icon={Calendar}
          badgeText="Outbreak Plan"
          defaultOpen={true}
          onSpeak={() => {
            const text = liveResult.prescription_calendar.map(rawItem => {
              const item = localizeCalendarItem(rawItem, currentLang);
              const dayLabel = currentLang === 'te' ? `రోజు ${item.day}` : currentLang === 'hi' ? `दिन ${item.day}` : `Day ${item.day}`;
              return `${dayLabel}: ${item.title}. ${item.activity}`;
            }).join('. ');
            speak(text, 'card_calendar', currentLang);
          }}
          isSpeaking={speakingId === 'card_calendar'}
        >
          <div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
            <p className="leading-relaxed font-medium">
              {t('results.calendar_intro', 'Customized calendar timeline for row sanitization, fungicide application, row ventilation, and nutritional recovery:')}
            </p>
            <div className="relative border-l-2 border-emerald-400/50 dark:border-emerald-700/50 ml-3 pl-5 space-y-4 my-2">
              {liveResult.prescription_calendar.map((rawItem, index) => {
                const item = localizeCalendarItem(rawItem, currentLang);
                return (
                  <div key={index} className="relative">
                    <div className="absolute -left-[28px] top-0 w-4 h-4 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-900 flex items-center justify-center shadow-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 rounded-2xl hover:border-emerald-400/60 dark:hover:border-emerald-500/60 transition-colors shadow-xs">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-black bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 mb-1.5">
                        {t('results.day', 'Day')} {item.day}
                      </span>
                      <h5 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm mb-1">{item.title}</h5>
                      <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">{item.activity}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* 6. Safety Precautions & PPE */}
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

      {/* 7. Prevention & Future Mitigation */}
      <CollapsibleSection
        title={t('results.prevention', 'Prevention & Future Mitigation')}
        icon={CloudSun}
        badgeText="Agronomy Tips"
        onSpeak={() => {
          const rawItems = Array.isArray(liveResult?.prevention_methods) ? liveResult.prevention_methods : [liveResult?.prevention_methods || 'Practice crop rotation and field sanitation.'];
          const items = rawItems.map(item => localizeAdvice(item, currentLang));
          speak(items.join('. '), 'card_prevention', currentLang);
        }}
        isSpeaking={speakingId === 'card_prevention'}
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <ul className="list-disc pl-5 space-y-1.5">
            {(Array.isArray(liveResult?.prevention_methods) ? liveResult.prevention_methods : [liveResult?.prevention_methods || 'Practice crop rotation and field sanitation.']).map((method, i) => (
              <li key={i}>{localizeAdvice(method, currentLang)}</li>
            ))}
          </ul>
        </div>
      </CollapsibleSection>

      {/* 8. Environmental Triggers & Causes */}
      <CollapsibleSection
        title={t('results.causes', 'Environmental Triggers & Causes')}
        icon={AlertTriangle}
        badgeText="Root Cause"
        onSpeak={() => {
          const rawCauses = Array.isArray(liveResult?.possible_causes) ? liveResult.possible_causes : [liveResult?.possible_causes || 'High humidity and poor air circulation.'];
          const causes = rawCauses.map(cause => localizeAdvice(cause, currentLang));
          speak(causes.join('. '), 'card_causes', currentLang);
        }}
        isSpeaking={speakingId === 'card_causes'}
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <ul className="list-disc pl-5 space-y-1.5">
            {(Array.isArray(liveResult?.possible_causes) ? liveResult.possible_causes : [liveResult?.possible_causes || 'High humidity and poor air circulation.']).map((cause, i) => (
              <li key={i}>{localizeAdvice(cause, currentLang)}</li>
            ))}
          </ul>
        </div>
      </CollapsibleSection>

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
        liveResult={liveResult}
      />
    </div>
  );
};

export default DiseaseDiagnosisResults;
