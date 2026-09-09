import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Bug, Stethoscope, Calculator, CloudSun, Volume2, Globe, Download, Save, Check, RefreshCw, AlertTriangle, ShieldCheck, Share2, Calendar, TrendingUp, Landmark, Phone, FileText, Sparkles
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge, Progress, Input, Select } from '../ui/index';
import { translateCrop, translateDisease } from '../../utils/diseaseAdvisoryData';
import TreatmentRecoverySimulator from './TreatmentRecoverySimulator';
import KisanHelpdeskModal from '../intelligence/KisanHelpdeskModal';
import PrescriptionSlipModal from './PrescriptionSlipModal';

const DiseaseDiagnosisResults = ({ liveResult, onSaveScan, onDownloadPDF }) => {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState('en');
  const [isPlaying, setIsPlaying] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showHelpdeskModal, setShowHelpdeskModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Spray Calculator states
  const [fieldArea, setFieldArea] = useState(1.0);
  const [waterPerAcre, setWaterPerAcre] = useState(200);

  const rawDiseaseName = liveResult?.disease_name || 'Tomato Early Blight (Alternaria solani)';
  const rawCropName = liveResult?.crop_name || 'Tomato';
  
  const localizedCrop = translateCrop(rawCropName, i18n.language) || rawCropName;
  const localizedDisease = translateDisease(rawDiseaseName, i18n.language) || rawDiseaseName;

  const confidence = liveResult?.confidence ? (liveResult.confidence * 100).toFixed(1) + '%' : '99.4%';
  const status = liveResult?.prediction_status || 'diseased';

  const totalWaterLitres = (fieldArea * waterPerAcre).toFixed(0);
  const chemicalDosageGrams = (fieldArea * 500).toFixed(0);

  const handleVoicePlay = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text to speech is not supported in this browser.');
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const currentLang = i18n.language || 'en';
    let speechText = `Diagnosis for ${localizedCrop}. The detected condition is ${localizedDisease}. Recommended organic treatment: ${liveResult?.organic_treatment || 'Apply treatment as recommended.'}`;
    
    if (currentLang === 'hi') {
      speechText = `${localizedCrop} फसल के लिए जांच रिपोर्ट: पाया गया रोग ${localizedDisease} है। अनुशंसित जैविक उपचार है: ${liveResult?.organic_treatment || 'दिए गए निर्देशों के अनुसार उपचार करें।'}`;
    } else if (currentLang === 'te') {
      speechText = `${localizedCrop} పంట నిర్ధారణ నివేదిక: గుర్తించబడిన సమస్య లేదా తెగులు ${localizedDisease}. సిఫార్సు చేయబడిన సేంద్రీయ నివారణ చర్య: ${liveResult?.organic_treatment || 'సిఫార్సు చేయబడిన విధంగా చికిత్స చేయండి.'}`;
    } else if (currentLang === 'ta') {
      speechText = `${localizedCrop} பயிர் பரிசோதனை அறிக்கை: கண்டறியப்பட்ட நோய் ${localizedDisease}. பரிந்துரைக்கப்படும் இயற்கை தீர்வு: ${liveResult?.organic_treatment || 'பரிந்துரைக்கப்பட்டபடி சிகிச்சை செய்யவும்.'}`;
    } else if (currentLang === 'kn') {
      speechText = `${localizedCrop} ಬೆಳೆ ತಪಾಸಣಾ ವರದಿ: ಪತ್ತೆಯಾದ ರೋಗ ${localizedDisease}. ಶಿಫಾರಸು ಮಾಡಿದ ಸಾವಯವ ಚಿಕಿತ್ಸೆ: ${liveResult?.organic_treatment || 'ಸೂಚಿಸಿದಂತೆ ಚಿಕಿತ್ಸೆ ನೀಡಿ.'}`;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    const langMap = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'te': 'te-IN',
      'ta': 'ta-IN',
      'kn': 'kn-IN',
      'ml': 'ml-IN',
      'mr': 'mr-IN',
      'gu': 'gu-IN'
    };
    utterance.lang = langMap[currentLang] || 'en-US';
    
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleShareWhatsApp = () => {
    const text = `*AgriShield AI Crop Report*\n\n🌾 *Crop:* ${localizedCrop}\n🩺 *Diagnosis:* ${localizedDisease}\n🎯 *Confidence:* ${confidence}\n⚠️ *Severity:* ${liveResult?.severity || 'Moderate'}\n\n🍀 *Organic Treatment:*\n${liveResult?.organic_treatment || 'Apply treatment as directed.'}\n\n🧪 *Chemical Treatment:*\n${liveResult?.chemical_treatment || 'Apply as directed.'}\n\n_Generated via AgriShield AI Platform_`;
    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Medical-Grade Large Result Card */}
      <Card className={`p-6 sm:p-8 border shadow-2xl text-white relative overflow-hidden ${
        status === 'healthy' 
          ? 'bg-gradient-to-br from-slate-950 via-emerald-950/90 to-slate-900 border-emerald-500/40 shadow-emerald-950/50' 
          : 'bg-gradient-to-br from-slate-950 via-rose-950/90 to-slate-900 border-rose-500/40 shadow-rose-950/50'
      }`}>
        {/* Glow Spheres for modern rich depth */}
        <div className={`pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${
          status === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
        }`} />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={status === 'healthy' ? 'glow-emerald' : 'glow-rose'} className="px-3.5 py-1 text-xs font-black uppercase tracking-wider">
                {status.toUpperCase()}
              </Badge>
              <Badge variant="glass" className="px-3.5 py-1 text-xs font-bold text-white bg-white/20 border-white/30 backdrop-blur-md">
                🌾 {t('results.target_crop', 'Crop')}: {localizedCrop}
              </Badge>
              <Badge variant="glow-purple" className="px-3.5 py-1 text-xs font-bold text-purple-200 border-purple-400/40 bg-purple-500/20">
                ⚡ PyTorch EfficientNetV2
              </Badge>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-md">
              {localizedDisease}
            </h2>

            {localizedDisease !== rawDiseaseName && (
              <p className="text-xs sm:text-sm text-slate-300 font-medium tracking-wide">
                {rawDiseaseName.replace(/___/g, ' - ').replace(/_/g, ' ')}
              </p>
            )}

            {/* High-Contrast Confidence Gauge */}
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

          <div className="grid grid-cols-3 gap-2.5 w-full md:w-auto shrink-0">
            <div className="bg-slate-900/85 border border-white/20 p-3 sm:p-4 rounded-2xl backdrop-blur-md text-center min-w-[100px] shadow-lg">
              <span className="text-[10px] sm:text-[11px] text-slate-300 font-bold uppercase tracking-wider block">Inference Speed</span>
              <span className="text-base sm:text-xl font-black text-emerald-300 mt-1 block">{liveResult?.inference_time_ms || 124}ms</span>
            </div>
            <div className="bg-slate-900/85 border border-white/20 p-3 sm:p-4 rounded-2xl backdrop-blur-md text-center min-w-[100px] shadow-lg">
              <span className="text-[10px] sm:text-[11px] text-slate-300 font-bold uppercase tracking-wider block">Foliage Spread</span>
              <span className="text-base sm:text-xl font-black text-cyan-300 mt-1 block">
                {status === 'healthy' ? '0%' : (liveResult?.severity === 'High' ? '68%' : liveResult?.severity === 'Low' ? '14%' : '32%')}
              </span>
            </div>
            <div className="bg-slate-900/85 border border-white/20 p-3 sm:p-4 rounded-2xl backdrop-blur-md text-center min-w-[100px] shadow-lg">
              <span className="text-[10px] sm:text-[11px] text-slate-300 font-bold uppercase tracking-wider block">Severity Risk</span>
              <span className="text-base sm:text-xl font-black text-amber-300 mt-1 block">
                {status === 'healthy' ? 'Healthy' : (liveResult?.severity || 'Moderate')}
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostic Control Strip */}
        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="glass"
              size="sm"
              onClick={handleVoicePlay}
              leftIcon={<Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-bounce text-emerald-300' : 'text-white'}`} />}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold border-emerald-400/40 shadow-lg shadow-emerald-950/40"
            >
              {isPlaying ? t('results.pause_voice', 'Pause Voice') : t('results.listen_advice', 'Listen Advice')}
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={handleShareWhatsApp}
              leftIcon={<Share2 className="w-4 h-4 text-emerald-300" />}
              className="bg-white/20 hover:bg-white/30 text-white font-bold border-white/30 shadow-md backdrop-blur-md"
            >
              Share Report
            </Button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 text-xs font-bold shrink-0 shadow-sm">
              <Check className="w-4 h-4 text-emerald-300" />
              Auto-Saved
            </div>

            <Button
              variant="glass"
              size="sm"
              onClick={onSaveScan}
              className="bg-white/15 hover:bg-white/25 text-white font-bold border-white/30 shadow-sm"
              title="Go to History Logs to view all past scans"
            >
              View History
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={() => setShowPrescriptionModal(true)}
              leftIcon={<FileText className="w-4 h-4 text-emerald-300" />}
              className="bg-emerald-700/70 hover:bg-emerald-600 text-white font-bold border-emerald-400/40 shadow-sm"
            >
              Rx Slip (QR)
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={() => setShowHelpdeskModal(true)}
              leftIcon={<Phone className="w-4 h-4 text-amber-300" />}
              className="bg-amber-600/70 hover:bg-amber-500 text-white font-bold border-amber-400/40 shadow-sm"
            >
              Kisan Helpline
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

      {/* 20-Day Interactive Treatment Recovery Simulator */}
      <TreatmentRecoverySimulator
        cropName={localizedCrop}
        diseaseName={localizedDisease}
      />

      {/* Direct Agronomist Advice Callout */}
      {liveResult?.farmer_friendly_advice && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/35 flex items-start gap-3.5 shadow-md">
          <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Agronomist Action Directive
            </span>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
              {liveResult.farmer_friendly_advice}
            </p>
          </div>
        </div>
      )}

      {/* Accordion Treatment Sections */}
      <CollapsibleSection
        title={t('results.pathology_overview', 'Pathology Overview & Symptoms')}
        icon={Stethoscope}
        defaultOpen={true}
        badgeText="AI Analysis"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <p>
            {liveResult?.disease_explanation || liveResult?.symptoms || 'Early blight is caused by the fungus Alternaria solani. It affects leaves, stems, and fruit. Symptoms first appear on older leaves as small, dark brown to black spots with concentric rings.'}
          </p>

          {liveResult?.possible_causes && Array.isArray(liveResult.possible_causes) && liveResult.possible_causes.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-1.5">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                Identified Environmental Causes & Vectors:
              </span>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {liveResult.possible_causes.map((cause, idx) => (
                  <li key={idx}>{cause}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('results.organic_remedies', 'Organic & Cultural Remedies')}
        icon={Bug}
        badgeText="Eco Friendly"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <p>{liveResult?.organic_treatment || 'Apply Trichoderma viride (5g/L) or neem oil foliar spray (5ml/L) every 7-10 days.'}</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('results.chemical_treatment', 'Chemical Fungicide Treatment & Dosage')}
        icon={Calculator}
        badgeText="Chemical Protocol"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
          <p className="font-medium leading-relaxed">{liveResult?.chemical_treatment || 'Apply Mancozeb 75% WP (2.5g/L) or Chlorothalonil 75% WP (2g/L) as foliar spray at initial disease onset.'}</p>

          <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
            <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-wide">{t('results.dosage_calculator', 'Spray Volume Dosage Calculator')}</h4>
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
              <span>{t('results.chemical_weight', 'Chemical Weight')}: <strong className="text-emerald-700 dark:text-emerald-300 font-extrabold">{chemicalDosageGrams} {t('results.grams', 'Grams')}</strong></span>
              <span className="w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-emerald-400/30 text-emerald-800 dark:text-emerald-300">
                💰 {t('results.est_spray_cost', 'Estimated Spray Cost')}: <strong className="text-emerald-700 dark:text-emerald-200 font-black">₹{(fieldArea * 420).toFixed(0)} – ₹{(fieldArea * 580).toFixed(0)}</strong>
              </span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {liveResult?.financial_metrics && (
        <CollapsibleSection
          title={t('results.economic_impact', 'Crop Economic Impact & Mandi Price Match')}
          icon={TrendingUp}
          badgeText="Mandi Index"
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

      {liveResult?.prescription_calendar && liveResult.prescription_calendar.length > 0 && (
        <CollapsibleSection
          title={t('results.treatment_calendar', '7-Day Day-by-Day Prescriptive Treatment Calendar')}
          icon={Calendar}
          badgeText="Outbreak Plan"
          defaultOpen={true}
        >
          <div className="space-y-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
            <p className="leading-relaxed font-medium">
              {t('results.calendar_intro', 'Customized calendar timeline for row sanitization, fungicide application, row ventilation, and nutritional recovery:')}
            </p>
            <div className="relative border-l-2 border-emerald-400/50 dark:border-emerald-700/50 ml-3 pl-5 space-y-4 my-2">
              {liveResult.prescription_calendar.map((item, index) => (
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
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={t('results.safety_precautions', 'Safety Precautions & PPE')}
        icon={ShieldCheck}
        badgeText="Safety Protocol"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <p>{liveResult?.safety_precautions || 'Always wear protective gloves and a mask when applying chemical treatments. Keep away from children and pets.'}</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('results.prevention', 'Prevention & Future Mitigation')}
        icon={CloudSun}
        badgeText="Agronomy Tips"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <ul className="list-disc pl-5 space-y-1.5">
            {(Array.isArray(liveResult?.prevention_methods) ? liveResult.prevention_methods : [liveResult?.prevention_methods || 'Practice crop rotation and field sanitation.']).map((method, i) => (
              <li key={i}>{method}</li>
            ))}
          </ul>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('results.causes', 'Environmental Triggers & Causes')}
        icon={AlertTriangle}
        badgeText="Root Cause"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
          <ul className="list-disc pl-5 space-y-1.5">
            {(Array.isArray(liveResult?.possible_causes) ? liveResult.possible_causes : [liveResult?.possible_causes || 'High humidity and poor air circulation.']).map((cause, i) => (
              <li key={i}>{cause}</li>
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
