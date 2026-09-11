import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Leaf, 
  ShieldAlert, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Share2, 
  Check, 
  Activity, 
  Sprout, 
  Download, 
  Sparkles,
  Printer,
  MessageCircle,
  Calculator,
  Volume2,
  VolumeX,
  Stethoscope,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import API from '../services/api';
import { Card, Button, Badge, Progress, Skeleton } from '../components/ui/index';
import { useFarm } from '../context/FarmContext';
import { shareDiagnosticToWhatsApp, printPrescriptionSlip } from '../utils/prescriptionShare';
import { generateAndDownloadPrescriptionPDF } from '../utils/pdfPrescriptionGenerator';
import { AcreageDosageCalculator } from '../components/intelligence/AcreageDosageCalculator';
import { getDiseaseDetails, translateCrop, translateDisease } from '../utils/diseaseAdvisoryData';
import { useSpeechReader } from '../hooks/useSpeechReader';
import VoiceCropDoctorModal from '../components/intelligence/VoiceCropDoctorModal';

const ADVICE_DB = {
  "healthy": {
    treatment: "No treatment required. Your crop is healthy!",
    practices: [
      "Maintain active crop rotation scheduling.",
      "Monitor soil nitrogen, phosphorus, and potassium levels.",
      "Ensure proper drip irrigation, avoiding pooling of water."
    ]
  },
  "early blight": {
    treatment: "Apply organic copper-based fungicides immediately. Avoid chemical contact during high heat.",
    practices: [
      "Remove all infected bottom leaves to prevent splash dispersion.",
      "Water crops at soil level to keep the leaf canopy dry.",
      "Maintain a 3-year crop rotation cycle for solanaceous plants."
    ]
  },
  "late blight": {
    treatment: "Apply chlorothalonil or copper fungicides at the first sign of symptoms.",
    practices: [
      "Immediately destroy infected crops. Do not compost diseased foliage.",
      "Ensure maximum spacing between rows to improve wind airflow.",
      "Choose late-blight-resistant cultivars for future plantings."
    ]
  },
  "generic disease": {
    treatment: "Apply broad-spectrum organic neem oil spray or consult a local agronomy advisor.",
    practices: [
      "Isolate affected areas to reduce spore dispersion.",
      "Ensure clean tools and clean boots when moving between crop rows.",
      "Provide balanced compost nutrients to boost natural crop immunity."
    ]
  }
};

const PredictionResultPage = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeFarm, profileCompleted } = useFarm();
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [nvidiaAdvice, setNvidiaAdvice] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGradCam, setShowGradCam] = useState(false);
  const [showVoiceDoctor, setShowVoiceDoctor] = useState(false);
  const [isVerifyingCloud, setIsVerifyingCloud] = useState(false);
  
  const imagePath = location.state?.imagePath;
  const passedPreviewUrl = location.state?.previewUrl;
  const backendBaseUrl = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    if (!imagePath && !passedPreviewUrl && !location.state?.offlineTriage) {
      navigate('/upload', { replace: true });
      return;
    }

    if (location.state?.offlineTriage) {
      setResult(location.state.offlineTriage);
      setLoading(false);
      return;
    }

    if (location.state?.initialResult) {
      setResult(location.state.initialResult);
      setLoading(false);
      return;
    }

    const runAIPrediction = async () => {
      try {
        const res = await API.post('/api/predict', { 
          image_path: imagePath,
          language: i18n.language || 'en'
        });
        setResult(res.data);

        try {
          const adviceRes = await API.post('/api/ai/farming-assistant', {
            crop_name: res.data.crop_name,
            disease_name: res.data.disease_name,
            confidence: res.data.confidence,
            language: i18n.language || 'en',
            farm_context: activeFarm ? {
              farm_name: activeFarm.farm_name,
              location: activeFarm.location,
              soil_type: activeFarm.soil_type,
              growth_stage: activeFarm.growth_stage,
              irrigation_method: activeFarm.irrigation_method
            } : null
          });
          setNvidiaAdvice(adviceRes.data);
        } catch { /* silently fallback to static db */ }

      } catch (err) {
        console.error("AI prediction request failed:", err);
        setErrorMsg("Failed to execute AI analysis model on the uploaded image.");
      } finally {
        setLoading(false);
      }
    };

    runAIPrediction();
  }, [imagePath, passedPreviewUrl, navigate, activeFarm, location.state]);

  const handleCloudVerify = async () => {
    if (!imagePath || !navigator.onLine) return;
    setIsVerifyingCloud(true);
    try {
      const res = await API.post('/api/predict', { 
        image_path: imagePath,
        language: i18n.language || 'en'
      });
      setResult(res.data);
    } catch (e) {
      console.error('Cloud verification failed:', e);
    } finally {
      setIsVerifyingCloud(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAdviceForDisease = (disName) => {
    const key = (disName || '').toLowerCase();
    for (const dKey in ADVICE_DB) {
      if (key.includes(dKey)) return ADVICE_DB[dKey];
    }
    return ADVICE_DB["generic disease"];
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-3xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  const isHealthy = result?.prediction_status === 'healthy' || (result?.disease_name || '').toLowerCase().includes('healthy');
  const fallbackAdvice = getAdviceForDisease(result?.disease_name);
  const confidencePercent = result?.confidence ? (result.confidence * 100).toFixed(1) : '98.5';
  const displayImgUrl = passedPreviewUrl || (imagePath ? `${backendBaseUrl}/${imagePath.replace(/\\/g, '/')}` : '');

  const diseaseKb = getDiseaseDetails(result?.disease_name, i18n.language);
  const localizedCrop = translateCrop(result?.crop_name, i18n.language);
  const localizedDisease = translateDisease(result?.disease_name, i18n.language);

  const handleWhatsAppShare = () => {
    if (!result) return;
    shareDiagnosticToWhatsApp({
      cropName: localizedCrop || result.crop_name,
      diseaseName: localizedDisease || result.disease_name,
      confidence: confidencePercent,
      severity: isHealthy ? 'Healthy' : 'Active Symptoms',
      chemicals: diseaseKb.chemicals?.length > 0 ? diseaseKb.chemicals : (result.chemical_treatment ? [result.chemical_treatment] : []),
      organic: diseaseKb.organic?.length > 0 ? diseaseKb.organic : (result.organic_treatment ? [result.organic_treatment] : []),
      prevention: diseaseKb.prevention || (result.prevention_methods?.[0] || ''),
      acres: activeFarm?.total_area || 1.0,
      farmLocation: activeFarm?.location || 'Pasupugallu Farm',
      farmerName: activeFarm?.farm_name || 'AgriShield Farmer',
      language: i18n?.language || 'en'
    });
  };

  const handlePrintPrescription = () => {
    if (!result) return;
    printPrescriptionSlip({
      cropName: localizedCrop || result.crop_name,
      diseaseName: localizedDisease || result.disease_name,
      confidence: confidencePercent,
      severity: isHealthy ? 'Healthy' : 'Active Symptoms',
      chemicals: diseaseKb.chemicals?.length > 0 ? diseaseKb.chemicals : (result.chemical_treatment ? [result.chemical_treatment] : []),
      organic: diseaseKb.organic?.length > 0 ? diseaseKb.organic : (result.organic_treatment ? [result.organic_treatment] : []),
      prevention: diseaseKb.prevention || (result.prevention_methods?.[0] || ''),
      acres: activeFarm?.total_area || 1.0,
      farmLocation: activeFarm?.location || 'Pasupugallu Farm',
      farmerName: activeFarm?.farm_name || 'AgriShield Farmer',
      language: i18n?.language || 'en'
    });
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    try {
      generateAndDownloadPrescriptionPDF({
        cropName: localizedCrop || result.crop_name,
        diseaseName: localizedDisease || result.disease_name,
        confidence: confidencePercent,
        severity: isHealthy ? 'Healthy' : (result.severity || 'Active Symptoms'),
        chemicals: diseaseKb.chemicals?.length > 0 ? diseaseKb.chemicals : (result.chemical_treatment ? [result.chemical_treatment] : []),
        organic: diseaseKb.organic?.length > 0 ? diseaseKb.organic : (result.organic_treatment ? [result.organic_treatment] : []),
        prevention: diseaseKb.prevention || (result.prevention_methods?.[0] || ''),
        acres: activeFarm?.total_area || 1.0,
        farmLocation: activeFarm?.location || 'Pasupugallu Farm',
        farmerName: activeFarm?.farm_name || 'AgriShield Farmer',
        doctorNote: result.symptoms || 'Early foliar spray recommended before dewfall.',
        language: i18n?.language || 'en',
        isOffline: result.is_offline || false
      });
    } catch (e) {
      console.warn("Direct PDF failed, falling back to print slip:", e);
      handlePrintPrescription();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-4xl mx-auto w-full pb-12"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Link to="/upload">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Scan Center
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ask Voice Doctor Button */}
          <Button 
            variant="solid" 
            size="sm" 
            onClick={() => setShowVoiceDoctor(true)}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-md border-0 active:scale-95"
            leftIcon={<Stethoscope className="w-4 h-4 text-emerald-200" />}
          >
            Ask Voice Doctor
          </Button>

          {/* Voice Readout Button */}
          {result && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const currentLang = (i18n.language || 'en').split('-')[0].toLowerCase();
                const crop = translateCrop(result.crop_name, currentLang) || result.crop_name || 'Crop';
                const disease = translateDisease(result.disease_name, currentLang, result.crop_name) || result.disease_name || 'Diagnosis';
                const speechSummary = `${crop}. ${disease}. ${result.organic_treatment || ''}. ${result.chemical_treatment || ''}`;
                speak(speechSummary, 'pred_summary', currentLang);
              }}
              className={`font-extrabold border-slate-300 dark:border-slate-700 active:scale-95 ${
                speakingId === 'pred_summary' ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse' : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              leftIcon={speakingId === 'pred_summary' ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
            >
              {speakingId === 'pred_summary' ? (i18n.language === 'te' ? 'వాయిస్ ఆపండి' : i18n.language === 'hi' ? 'आवाज रोकें' : 'Stop Voice') : (i18n.language === 'te' ? 'సారాంశం వినండి' : i18n.language === 'hi' ? 'सारांश सुनें' : 'Listen Voice')}
            </Button>
          )}

          {/* WhatsApp Share Button */}
          <Button 
            variant="solid" 
            size="sm" 
            onClick={handleWhatsAppShare}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-black shadow-md shadow-[#25D366]/20 border-0 active:scale-95"
            leftIcon={<MessageCircle className="w-4 h-4 fill-white" />}
          >
            Send to WhatsApp
          </Button>

          {/* Download Clinical Prescription PDF */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadPDF}
            className="font-extrabold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 active:scale-95"
            leftIcon={<Download className="w-4 h-4 text-emerald-500" />}
          >
            Download Rx (PDF)
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleShare}
            leftIcon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          >
            {copied ? 'Link Copied' : 'Share'}
          </Button>
        </div>
      </div>

      {/* Offline Field Triage Banner */}
      {result?.is_offline && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-amber-300 text-sm">Zero-Internet Field Triage Mode</p>
              <p className="text-slate-300 text-xs">
                {result.triage_disclaimer || "Calculated locally on-device. Saved to offline queue."}
              </p>
            </div>
          </div>

          {imagePath && navigator.onLine && (
            <Button
              variant="solid"
              size="sm"
              onClick={handleCloudVerify}
              disabled={isVerifyingCloud}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isVerifyingCloud ? 'animate-spin' : ''}`} />}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold shrink-0 shadow-md"
            >
              {isVerifyingCloud ? 'Verifying with Cloud...' : 'Verify with PyTorch Cloud AI'}
            </Button>
          )}
        </div>
      )}

      {/* Main Prediction Summary Card */}
      <Card className={`p-6 sm:p-8 border-0 shadow-2xl text-white relative overflow-hidden ${
        isHealthy 
          ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950' 
          : 'bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950'
      }`}>
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          {/* Diagnostic Image Container */}
          <div className="w-full md:w-56 flex flex-col shrink-0 gap-3">
            <div className="w-full h-56 rounded-2xl overflow-hidden bg-slate-950 border border-white/20 relative group">
              {!imgError && displayImgUrl ? (
                <img 
                  src={showGradCam && result?.gradcam_base64 ? result.gradcam_base64 : displayImgUrl} 
                  alt={showGradCam ? "Grad-CAM AI X-Ray" : "Diagnosed Crop"}
                  className="w-full h-full object-cover transition-all duration-300"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                  <Leaf className="w-10 h-10 mb-2 opacity-40 text-emerald-400" />
                  <span className="text-xs font-semibold">{t('results.diagnostic_image', 'Diagnostic Image')}</span>
                </div>
              )}
            </div>
            
            {/* Grad-CAM Toggle */}
            {result?.gradcam_base64 && !isHealthy && (
              <Button
                variant={showGradCam ? "solid" : "outline"}
                size="sm"
                onClick={() => setShowGradCam(!showGradCam)}
                className={`w-full transition-all duration-300 font-bold ${
                  showGradCam 
                    ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500' 
                    : 'text-rose-400 border-white/20 hover:border-rose-400/50 hover:bg-rose-500/10'
                }`}
                leftIcon={<Activity className="w-4 h-4" />}
              >
                {showGradCam ? 'Hide AI X-Ray' : 'View AI X-Ray (Grad-CAM)'}
              </Button>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isHealthy ? 'healthy' : 'diseased'}>
                {isHealthy ? `🟢 ${t('common.healthy', 'HEALTHY')}` : `🔴 ${t('common.diseased', 'DISEASE DETECTED')}`}
              </Badge>
              <Badge variant="outline" className="text-white border-white/20">
                {t('results.target_crop', 'Crop')}: {localizedCrop || result?.crop_name || 'Agricultural Crop'}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {localizedDisease || result?.disease_name || 'Crop Health Condition'}
            </h1>

            <div className="pt-2">
              <Progress value={parseFloat(confidencePercent)} label={t('results.confidence', 'Diagnostic Confidence')} showValue />
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-300 pt-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {result?.prediction_date || new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {result?.prediction_time || new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Diagnostic Tiles Grid */}
      {result && !isHealthy && !result.is_agrochemical && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          
          <Card className="p-5 border-l-4 border-l-amber-500 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('results.symptoms', 'Symptoms & Causes')}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const causes = (result.possible_causes || nvidiaAdvice?.possible_causes || []).join('. ');
                  const text = `Symptoms: ${result.symptoms || nvidiaAdvice?.disease_explanation || 'Not available'}. Possible causes: ${causes}`;
                  speak(text, 'card_symptoms_page', i18n.language || 'en');
                }}
                className={`p-1.5 rounded-lg border transition-colors ${
                  speakingId === 'card_symptoms_page'
                    ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
                title="Listen symptoms"
              >
                {speakingId === 'card_symptoms_page' ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <p><strong>{t('results.symptoms', 'Symptoms:')}</strong> {result.symptoms || nvidiaAdvice?.disease_explanation || 'No details available.'}</p>
              <div>
                <strong>{t('results.causes', 'Possible Causes:')}</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {(result.possible_causes || nvidiaAdvice?.possible_causes || []).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-l-4 border-l-emerald-500 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('results.treatment_plan', 'Treatment Plan')}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const text = `Treatment Plan. Organic approach: ${result.organic_treatment || nvidiaAdvice?.organic_treatment || 'None'}. Chemical intervention: ${result.chemical_treatment || nvidiaAdvice?.chemical_treatment || 'None'}`;
                  speak(text, 'card_treatment_page', i18n.language || 'en');
                }}
                className={`p-1.5 rounded-lg border transition-colors ${
                  speakingId === 'card_treatment_page'
                    ? 'bg-emerald-600 text-white border-emerald-700 animate-pulse'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}
                title="Listen treatment"
              >
                {speakingId === 'card_treatment_page' ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <p><strong>{t('results.organic', 'Organic:')}</strong> {result.organic_treatment || nvidiaAdvice?.organic_treatment || 'None recommended.'}</p>
              <p><strong>{t('results.chemical', 'Chemical:')}</strong> {result.chemical_treatment || nvidiaAdvice?.chemical_treatment || 'None recommended.'}</p>
            </div>
          </Card>

          <Card className="p-5 border-l-4 border-l-blue-500 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('results.prevention', 'Prevention & Precautions')}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const methods = (result.prevention_methods || nvidiaAdvice?.prevention_methods || fallbackAdvice.practices).join('. ');
                  const text = `Prevention methods: ${methods}. ${nvidiaAdvice?.farmer_friendly_advice || ''}. ${result.safety_precautions || ''}`;
                  speak(text, 'card_prevention_page', i18n.language || 'en');
                }}
                className={`p-1.5 rounded-lg border transition-colors ${
                  speakingId === 'card_prevention_page'
                    ? 'bg-blue-600 text-white border-blue-700 animate-pulse'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                }`}
                title="Listen prevention"
              >
                {speakingId === 'card_prevention_page' ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div>
                <strong>{t('results.prevention_methods', 'Prevention Methods:')}</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {(result.prevention_methods || nvidiaAdvice?.prevention_methods || fallbackAdvice.practices).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <p><strong>{t('results.farming_advice', 'Farming Advice:')}</strong> {nvidiaAdvice?.farmer_friendly_advice || nvidiaAdvice?.best_farming_practices?.join(' ') || 'Regularly monitor crop health.'}</p>
              {result.safety_precautions && (
                <p className="text-rose-600 dark:text-rose-400 mt-2"><strong>{t('results.safety_precautions', 'Safety Precautions:')}</strong> {result.safety_precautions}</p>
              )}
            </div>
          </Card>

        </div>
      )}

      {/* Field Acreage Chemical Dosage & Spray Tank Calculator */}
      {!isHealthy && result && !result.is_agrochemical && (
        <AcreageDosageCalculator 
          cropName={localizedCrop || result.crop_name}
          diseaseName={localizedDisease || result.disease_name}
          chemicalName={diseaseKb.chemicals?.[0]?.split('@')[0]?.trim() || result.chemical_treatment?.split('@')[0]?.trim() || "Mancozeb 75% WP"}
          dosagePerLiter={2.5}
          unit="g"
          initialAcres={activeFarm?.total_area || 1.0}
        />
      )}

      {/* Agrochemical Product Details */}
      {result && result.is_agrochemical && (
        <Card className="p-6 border-l-4 border-l-purple-500 shadow-sm mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('results.agrochemical_profile', 'Agrochemical Profile')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
            <p><strong>{t('results.brand', 'Brand:')}</strong> {result.brand}</p>
            <p><strong>{t('results.category', 'Category:')}</strong> {result.category}</p>
            <p><strong>{t('results.active_ingredient', 'Active Ingredient:')}</strong> {result.activeIngredient}</p>
            <p><strong>{t('results.dosage', 'Dosage:')}</strong> {result.dosage}</p>
            <p className="md:col-span-2 text-rose-600 dark:text-rose-400"><strong>{t('results.safety_precautions', 'Safety Precautions:')}</strong> {result.ppe}</p>
          </div>
        </Card>
      )}

      {/* Healthy Crop Fallback */}
      {isHealthy && !result?.is_agrochemical && (
        <Card glass className="p-6 border-emerald-200 dark:border-emerald-900 mt-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold mb-3">
            <Sprout className="w-5 h-5" />
            <span>Crop is Healthy</span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{fallbackAdvice.treatment}</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 dark:text-slate-400">
            {fallbackAdvice.practices.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </Card>
      )}

      {/* Voice Crop Doctor Consultation Modal */}
      <VoiceCropDoctorModal 
        isOpen={showVoiceDoctor} 
        onClose={() => setShowVoiceDoctor(false)} 
        initialCrop={localizedCrop || result?.crop_name} 
        initialDisease={localizedDisease || result?.disease_name} 
        initialSymptoms={result?.symptoms} 
      />
    </motion.div>
  );
};

export default PredictionResultPage;
