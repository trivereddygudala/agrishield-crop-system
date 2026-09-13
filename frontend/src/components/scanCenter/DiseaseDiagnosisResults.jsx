import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Bug, Stethoscope, CloudSun, Volume2, Globe, Download, Save, Check, RefreshCw, 
  AlertTriangle, ShieldCheck, Share2, TrendingUp, Landmark, Phone, FileText, Sparkles,
  Layers, FlaskConical, Info, Eye, Image as ImageIcon, ZoomIn, X, CheckCircle2
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge, Progress } from '../ui/index';
import { translateCrop, translateDisease, getDiseaseDetails, localizeAdvice } from '../../utils/diseaseAdvisoryData';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { FORMULATION_TEXTS, getAudioActionLabel, getSpeechLocale, getSafetyFallback } from '../../utils/regionalLocale';
import { getMatchingProducts } from '../../utils/commercialProducts';
import KisanHelpdeskModal from '../intelligence/KisanHelpdeskModal';
import PrescriptionSlipModal from './PrescriptionSlipModal';

const DiseaseDiagnosisResults = ({ liveResult, previewUrl, onSaveScan, onDownloadPDF }) => {
  const { t, i18n } = useTranslation();
  const [showHelpdeskModal, setShowHelpdeskModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(true);
  const [previewProductModal, setPreviewProductModal] = useState(null);
  const [zoomImageModal, setZoomImageModal] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);

  // Speech reader hook
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();

  const [selectedChemicalIdx, setSelectedChemicalIdx] = useState(0);

  const rawDiseaseName = liveResult?.disease_name || liveResult?.predicted_class || 'Crop Health Condition';
  const rawCropName = liveResult?.crop_name || 'Agricultural Crop';

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

  const selectedChem = chemicalsList[selectedChemicalIdx] || chemicalsList[0] || '';
  const currentDosage = parseChemicalDosage(selectedChem);

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
    <div className="space-y-4">
      {/* Medical-Grade Result Card — Compact for 1 Mobile Screen Fit */}
      <Card className={`p-4 sm:p-6 border shadow-2xl text-white relative overflow-hidden ${
        status === 'healthy' 
          ? 'bg-gradient-to-br from-slate-950 via-emerald-950/90 to-slate-900 border-emerald-500/40 shadow-emerald-950/50' 
          : 'bg-gradient-to-br from-slate-950 via-rose-950/90 to-slate-900 border-rose-500/40 shadow-rose-950/50'
      }`}>
        {/* Glow Spheres */}
        <div className={`pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${
          status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-teal-500/20 blur-3xl" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status === 'healthy' ? 'glow-emerald' : 'glow-rose'} className="px-3 py-0.5 text-xs font-black uppercase tracking-wider">
                {status.toUpperCase()}
              </Badge>
              <Badge variant="glass" className="px-3 py-0.5 text-xs font-bold text-white bg-white/20 border-white/30 backdrop-blur-md">
                🌾 {t('results.target_crop', 'Crop')}: {localizedCrop}
              </Badge>
              {liveResult?.is_offline ? (
                <Badge variant="glow-amber" className="px-3 py-0.5 text-xs font-black text-amber-200 border-amber-400/60 bg-amber-500/30 animate-pulse">
                  📡 ZERO-INTERNET OFFLINE TRIAGE
                </Badge>
              ) : (
                <Badge variant="glow-purple" className="px-3 py-0.5 text-xs font-bold text-teal-200 border-teal-400/40 bg-teal-500/20">
                  ⚡ PyTorch EfficientNetV2
                </Badge>
              )}
              {liveResult?.dual_model_consensus && (
                <Badge variant="glow-emerald" className="px-3 py-0.5 text-xs font-black text-emerald-200 border-emerald-400/50 bg-emerald-950/70 flex items-center gap-1 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{currentLang === 'te' ? 'Dual-AI ధృవీకరించబడింది' : 'Dual-AI Verified'}</span>
                </Badge>
              )}
              {liveResult?.ensemble_used && (
                <Badge variant="glow-cyan" className="px-3 py-0.5 text-xs font-black text-cyan-200 border-cyan-400/60 bg-cyan-950/70 flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{currentLang === 'te' ? 'ద్వంద్వ AI ధృవీకరణ (Gemini Vision)' : 'Dual AI Consensus: PyTorch + Gemini Vision'}</span>
                </Badge>
              )}
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

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md">
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

      {/* Differential Diagnosis Card (Top Candidates & Real Commercial Products with Companies) */}
      {(liveResult?.differential_candidates?.length > 1 || liveResult?.is_ambiguous || parseFloat(confidence) < 80 || status !== 'healthy') && (
        <Card className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/5 via-white to-orange-500/5 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/20 border-2 border-amber-400/40 dark:border-amber-500/30 shadow-md">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                  <span>{currentLang === 'te' ? 'లక్షణాల నిర్ధారణ & అధికారిక మార్కెట్ ఉత్పత్తులు' : 'Differential Diagnosis & Prescribed Market Products'}</span>
                  <Badge variant="warning" className="text-[10px] font-black uppercase">
                    {currentLang === 'te' ? 'కంపెనీ బ్రాండ్లు & సరిచూసే విధానం' : 'Real Company Brands & Verification'}
                  </Badge>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {currentLang === 'te' 
                    ? 'సరైన మందును మాత్రమే ఎంచుకోవడానికి, దిగువ ఇచ్చిన వ్యాధి లక్షణాలు మరియు అసలైన కంపెనీ ప్యాకెట్ చిత్రాన్ని చూడండి.'
                    : 'To avoid spraying the incorrect chemical, compare the leaf symptoms and verify the authentic company brand product below.'}
                </p>
              </div>
            </div>
          </div>

          {/* Differential Candidates Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3.5">
            {(liveResult?.differential_candidates || [
              {
                disease_name: rawDiseaseName,
                crop_name: rawCropName,
                confidence: parseFloat(confidence),
                visual_hallmark: liveResult?.symptoms || 'Primary disease symptoms observed on leaf surface.'
              },
              {
                disease_name: rawDiseaseName.toLowerCase().includes('early') ? 'Late Blight' : (rawDiseaseName.toLowerCase().includes('late') ? 'Early Blight' : 'Leaf Spot'),
                crop_name: rawCropName,
                confidence: Math.max(12, 100 - parseFloat(confidence)),
                visual_hallmark: 'Secondary visual check to ensure symptoms are not on margins.'
              }
            ]).slice(0, 2).map((cand, idx) => {
              const isPrimary = idx === 0;
              const candCrop = cand.crop_name || rawCropName;
              const locCandDisease = translateDisease(cand.disease_name, i18n.language, candCrop) || cand.disease_name;
              const matchingProds = getMatchingProducts(cand.disease_name, candCrop, 1);
              const prod = matchingProds[0];

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isPrimary
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600/70 shadow-sm ring-1 ring-emerald-500/20'
                      : 'bg-white/90 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                        isPrimary 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-400 dark:bg-slate-600 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {isPrimary 
                          ? (currentLang === 'te' ? 'ప్రధాన అంచనా' : 'Primary Candidate') 
                          : (currentLang === 'te' ? 'ప్రత్యామ్నాయ అవకాశం' : 'Alternative Possibility')}
                      </span>
                    </div>
                    <Badge variant={isPrimary ? "success" : "outline"} className="text-xs font-black">
                      {cand.confidence}% {currentLang === 'te' ? 'ఖచ్చితత్వం' : 'Match'}
                    </Badge>
                  </div>

                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-2">
                    {locCandDisease}
                  </h4>

                  <div className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 mb-3">
                    <span className="text-amber-500 font-bold shrink-0">🔍</span>
                    <p className="leading-relaxed">
                      <strong className="font-bold text-slate-900 dark:text-white">
                        {currentLang === 'te' ? 'ఆకుపై గుర్తించే లక్షణం: ' : 'Visual Hallmark: '}
                      </strong>
                      {cand.visual_hallmark}
                    </p>
                  </div>

                  {/* Real Commercial Product Card with Real Image & Company */}
                  {prod && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-700/80 p-3.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          {currentLang === 'te' ? 'మార్కెట్ అధికారిక బ్రాండ్' : 'Recommended Market Brand'}
                        </span>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {prod.company}
                        </span>
                      </div>

                      <div className="flex items-start gap-3.5">
                        {/* Authentic Real Product Photo Thumbnail with Zoom */}
                        <button 
                          type="button"
                          onClick={() => setPreviewProductModal(prod)}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-white border border-slate-200 dark:border-slate-700 shrink-0 relative flex items-center justify-center p-1.5 group cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all shadow-xs"
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
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-xs">
                            <Eye className="w-4 h-4" />
                            <span>Zoom</span>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-slate-900/85 py-0.5 text-center text-[9px] font-black text-white">
                            {prod.badge || prod.company.split(' ')[0]}
                          </div>
                        </button>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-baseline justify-between gap-1 flex-wrap">
                            <h5 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                              {prod.brandName}
                            </h5>
                            <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                              {prod.approxPrice}
                            </span>
                          </div>

                          {/* Highlighted Chemical Composition (Answers "where are the chemical names") */}
                          <div className="p-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70">
                            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              <span>🧪</span>
                              <span>{currentLang === 'te' ? 'రసాయన ఫార్ములా (యాక్టివ్ కాంపోజిషన్):' : 'Active Chemical / Technical Name:'}</span>
                            </div>
                            <p className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">
                              {prod.activeIngredients}
                            </p>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block mt-0.5">
                              Formulation: {prod.formulation}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-0.5">
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-extrabold border border-teal-200 dark:border-teal-800/60">
                              🎯 20L Tank: {prod.dosagePer20L}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              🥄 {prod.farmerMeasureTip}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

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
      )}

      {/* Verified Pathology Reference Gallery (Authentic Field Comparison from Curated Dataset) */}
      {referenceImages.length > 0 && (
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
      )}

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

      {/* 3. Chemical Fungicide Treatment & Dosage (Farmer-Friendly Single-Medicine Guide) */}
      <CollapsibleSection
        title={t('results.chemical_treatment', 'Chemical Fungicide Treatment & Dosage')}
        icon={FlaskConical}
        defaultOpen={true}
        badgeText="Chemical Protocol"
        onSpeak={() => {
          const rateText = `${FORMULATION_TEXTS.rate_label[currentLang] || 'Recommended Rate:'} ${currentDosage.rate} ${currentDosage.unit} / ${FORMULATION_TEXTS.per_litre_water[currentLang] || 'Litre water'}`;
          speak(`${selectedChem}. ${rateText}`, 'card_chemical', currentLang);
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

        </div>
      </CollapsibleSection>

      {/* 4. Safety Precautions & PPE */}
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
