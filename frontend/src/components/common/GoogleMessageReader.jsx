import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Trash2, Share2, ShieldCheck, CheckCheck,
  FileText, Sparkles, Volume2, VolumeX, ChevronDown, ChevronUp, ChevronRight,
  X, CheckCircle2, Pill, Sprout, AlertTriangle, CloudRain, Droplets
} from 'lucide-react';
import { formatDateTime, timeAgo } from '../../utils/dateUtils';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { getDiseaseDetails, translateCrop, translateDisease } from '../../utils/diseaseAdvisoryData';

export default function GoogleMessageReader({
  message,
  translatedTitle,
  translatedBody,
  onBack,
  onDelete,
  lang = 'te'
}) {
  const [showFullReview, setShowFullReview] = useState(false);
  const reviewRef = useRef(null);
  const isTelugu = (lang || '').toLowerCase().startsWith('te');

  const { speak, stop, speakingId } = useSpeechReader();
  const messageId = message?.notification_id || message?.id || 'sms_active';
  const isSpeaking = speakingId === `sms_${messageId}`;

  // Cleanup speech synthesis on component unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Smooth auto-scroll to Full Review when opened
  useEffect(() => {
    if (showFullReview && reviewRef.current) {
      setTimeout(() => {
        reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showFullReview]);

  if (!message) return null;

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stop();
    } else {
      const textToRead = `${translatedTitle || message.title}. ${translatedBody || message.message}`;
      speak(textToRead, `sms_${messageId}`, lang || 'te', 0.95);
    }
  };

  const handleBack = () => {
    stop();
    if (onBack) onBack();
  };

  const handleDelete = () => {
    stop();
    if (onDelete) onDelete(message.notification_id || message.id);
    if (onBack) onBack();
  };

  const handleShareWhatsApp = () => {
    const shareText = `*AgriShield Alert / నోటిఫికేషన్*\n\n*${translatedTitle || message.title}*\n${translatedBody || message.message}\n\n- AgriShield AI Crop Protection`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const isDisease = message.category === 'disease';
  const isWeather = message.category === 'weather';

  // Parse crop, disease, and match against local advisory knowledge base
  const parsedInfo = useMemo(() => {
    let crop = message.crop || '';
    let disease = message.disease || '';
    let confidence = message.confidence_score != null ? (message.confidence_score > 1 ? message.confidence_score : message.confidence_score * 100).toFixed(1) : null;

    const fullText = `${message.title || ''} ${message.message || ''}`;
    
    // Extract confidence if in text: "100.0% confidence"
    if (!confidence) {
      const confMatch = fullText.match(/(\d+(?:\.\d+)?)\s*%\s*confidence/i);
      if (confMatch) confidence = parseFloat(confMatch[1]).toFixed(1);
    }

    // Extract crop name if in text: "on Maize" or "for Tomato"
    if (!crop) {
      const onMatch = fullText.match(/(?:on|in|for|crop:)\s+([A-Za-z]+)/i);
      if (onMatch) {
        crop = onMatch[1].trim();
      }
    }

    // Extract disease name if in text: "Alert: Leaf Blight Detected" or "Leaf Blight identified"
    if (!disease) {
      const alertMatch = fullText.match(/(?:Alert|Verified):\s*([A-Za-z\s]+?)(?:\s+Detected|\s+identified|\s+with|\s*$)/i);
      if (alertMatch) {
        disease = alertMatch[1].trim();
      } else {
        const idMatch = fullText.match(/([A-Za-z\s]+?)\s+identified\s+on/i);
        if (idMatch) disease = idMatch[1].trim();
      }
    }

    // Query comprehensive advisory database
    const advisory = getDiseaseDetails(crop, disease, isTelugu ? 'te' : 'en');
    const teluguCrop = translateCrop(crop, 'te');
    const teluguDisease = translateDisease(disease, 'te');

    return {
      crop,
      teluguCrop,
      disease: advisory?.name || disease,
      teluguDisease,
      confidence,
      advisory
    };
  }, [message, isTelugu]);

  // ─── FULL SCREEN VIEW: DEDICATED DIAGNOSTIC REVIEW WITH NEAT TOP BACK BUTTON ───
  if (showFullReview) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] max-w-3xl mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* ─── NEAT TOP HEADER & BACK BUTTON ─── */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setShowFullReview(false)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs sm:text-sm border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
              title={isTelugu ? "సందేశానికి తిరిగి వెళ్ళండి" : "Back to Notification"}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isTelugu ? 'సందేశానికి తిరిగి' : 'Back to Notification'}</span>
            </button>
            <div className="min-w-0 hidden sm:block">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 truncate block">
                {isTelugu ? 'పూర్తి డయాగ్నస్టిక్ సమీక్ష' : 'Full Diagnostic Review'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href="tel:18001801551"
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 transition-colors"
              title={isTelugu ? "కిసాన్ కాల్ సెంటర్ (1800-180-1551)" : "Call Kisan Helpline"}
            >
              <Phone className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
              title={isTelugu ? "వాట్సాప్‌లో షేర్ చేయండి" : "Share via WhatsApp"}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── FULL SCREEN SCROLLABLE ADVISORY BODY ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Header Title Card */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {isTelugu ? 'పూర్తి సమీక్ష & AI నిర్ధారణ నివేదిక' : 'Full Diagnostic Review & Advisory'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isTelugu ? 'తక్షణ చర్యలు, పిచికారీ మోతాదులు మరియు నివారణ మార్గాలు' : 'Immediate actions, spray dosages & disease remedies'}
              </p>
            </div>
          </div>

          {/* Diagnosis Badges & Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            {parsedInfo.crop && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">{isTelugu ? 'పంట' : 'Crop'}</span>
                <span className="text-sm font-black text-slate-900 dark:text-white block mt-0.5">{isTelugu ? parsedInfo.teluguCrop : parsedInfo.crop}</span>
              </div>
            )}
            {parsedInfo.disease && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <span className="text-[10px] uppercase font-black text-slate-400 block">{isTelugu ? 'గుర్తించిన తెగులు' : 'Detected Issue'}</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400 block mt-0.5">{isTelugu ? parsedInfo.teluguDisease : parsedInfo.disease}</span>
              </div>
            )}
            {parsedInfo.confidence && (
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-xs col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-black text-slate-400 block">{isTelugu ? 'ఖచ్చితత్వం' : 'Confidence'}</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">{parsedInfo.confidence}% Neural Match</span>
              </div>
            )}
          </div>

          {/* Overview / Pathology */}
          {parsedInfo.advisory?.overview && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-500/20 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed shadow-xs">
              <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <span>🔬</span>
                <span>{isTelugu ? 'వ్యాధి సమాచారం & లక్షణాలు (Pathology & Symptoms):' : 'Pathogen Pathology & Symptoms:'}</span>
              </p>
              <p className="leading-relaxed">{parsedInfo.advisory.overview}</p>
            </div>
          )}

          {/* Chemical Treatments */}
          {parsedInfo.advisory?.chemicals && parsedInfo.advisory.chemicals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-emerald-600" />
                <span>{isTelugu ? 'రసాయన మందుల పిచికారీ & మోతాదు (Chemical Spray Dosages)' : 'Recommended Chemical Spray & Dosages'}</span>
              </h4>
              <div className="space-y-2">
                {parsedInfo.advisory.chemicals.map((chem, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm shadow-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 font-black flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{chem}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Organic Treatments */}
          {parsedInfo.advisory?.organic && parsedInfo.advisory.organic.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-teal-600" />
                <span>{isTelugu ? 'సేంద్రీయ & జీవ నియంత్రణ మార్గాలు (Organic Remedies)' : 'Organic & Biological Treatment Alternatives'}</span>
              </h4>
              <div className="space-y-2">
                {parsedInfo.advisory.organic.map((org, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-teal-500/20 text-xs sm:text-sm shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{org}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prevention Advice */}
          {parsedInfo.advisory?.prevention && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs sm:text-sm space-y-1.5 shadow-xs">
              <span className="font-black text-amber-700 dark:text-amber-400 block">
                {isTelugu ? '🛡️ భవిష్యత్తు నివారణ చర్యలు (Future Prevention):' : '🛡️ Long-term Field Prevention:'}
              </span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {parsedInfo.advisory.prevention}
              </p>
            </div>
          )}

          {/* Kisan Support Dial Option */}
          <div className="pt-2">
            <a
              href="tel:18001801551"
              className="w-full py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-emerald-500/30 transition-colors shadow-xs"
            >
              <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isTelugu ? 'వ్యవసాయ నిపుణుడిని సంప్రదించండి: 1800-180-1551' : 'Speak to Agronomist: 1800-180-1551'}</span>
            </a>
          </div>

          {/* Bottom Back Button */}
          <div className="pt-2 pb-6">
            <button
              type="button"
              onClick={() => setShowFullReview(false)}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-sm flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isTelugu ? 'సందేశానికి తిరిగి వెళ్ళండి' : 'Back to Notification'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── STANDARD GOOGLE MESSAGE CONVERSATION VIEW ───
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] max-w-3xl mx-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
    >
      {/* ─── GOOGLE MESSAGES TOP APP BAR ─── */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title={isTelugu ? "వెనుకకు" : "Back"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
          </div>

          {/* Contact Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {isTelugu ? 'AgriShield హెచ్చరికలు' : 'AgriShield Alerts'}
              </h2>
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                ✓ {isTelugu ? 'ధృవీకరించబడింది' : 'Verified'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isTelugu ? 'అధికారిక SMS గేట్‌వే • 100% విశ్వసనీయం' : 'Official SMS Gateway • 100% Reliable'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Voice Readout Header Button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`p-2.5 rounded-full transition-all cursor-pointer ${
              isSpeaking
                ? 'bg-amber-500 text-white shadow-md animate-pulse'
                : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400'
            }`}
            title={
              isSpeaking
                ? (isTelugu ? "వాయిస్ ఆపండి" : "Stop Voice")
                : (isTelugu ? "తెలుగులో బిగ్గరగా వినండి" : "Listen via Voice")
            }
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <a
            href="tel:18001801551"
            className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            title={isTelugu ? "కిసాన్ కాల్ సెంటర్ (1800-180-1551)" : "Call Kisan Helpline"}
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
            title={isTelugu ? "వాట్సాప్‌లో షేర్ చేయండి" : "Share via WhatsApp"}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-2.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
            title={isTelugu ? "సందేశాన్ని తొలగించండి" : "Delete Message"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── CHAT CONVERSATION STREAM ─── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-950 dark:to-slate-900">
        {/* Date Stamp Pill */}
        <div className="flex justify-center">
          <div className="px-3 py-1 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] font-bold text-slate-600 dark:text-slate-400 shadow-xs">
            {formatDateTime(message.lifecycle?.created_at || message.created_at)}
          </div>
        </div>

        {/* End-to-End Encryption Note */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          <span>🔒</span>
          <span>
            {isTelugu
              ? 'AgriShield క్లౌడ్ ద్వారా నేరుగా రైతుకు పంపబడిన అధికారిక సందేశం'
              : 'End-to-end encrypted notification delivered via AgriShield System'}
          </span>
        </div>

        {/* ─── GOOGLE MESSAGES SPEECH BUBBLE ─── */}
        <div className="flex items-start gap-2.5 max-w-xl">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 mt-1 shadow-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>

          <div className="relative bg-white dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 rounded-3xl rounded-tl-sm p-4 sm:p-5 border border-slate-200 dark:border-slate-700/80 shadow-md space-y-3 w-full">
            {/* Header / Category & Priority */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  {message.category || 'System'}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                  {message.priority || 'Normal'} Priority
                </span>
              </div>
            </div>

            {/* Notification Title */}
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
              {translatedTitle || message.title}
            </h3>

            {/* Notification Body Text */}
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
              {translatedBody || message.message}
            </p>

            {/* In-Bubble Voice Audio Bar */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleToggleSpeech}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSpeaking
                    ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500/40 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/70 hover:border-amber-400/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isSpeaking ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}>
                    {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {isTelugu ? 'వాయిస్ సందేశం' : 'Voice Narration'}
                      </span>
                      {isSpeaking && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                          {isTelugu ? 'ప్లే అవుతోంది' : 'Playing'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {isSpeaking
                        ? (isTelugu ? 'ఆడియో ప్లే అవుతోంది...' : 'Playing narration...')
                        : (isTelugu ? 'తెలుగులో వినడానికి నొక్కండి' : 'Tap to hear voice')}
                    </p>
                  </div>
                </div>

                {isSpeaking ? (
                  <div className="flex items-end gap-1 h-4 px-1">
                    <span className="w-1 bg-amber-500 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-2.5" />
                    <span className="w-1 bg-amber-500 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-4" />
                    <span className="w-1 bg-amber-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-3" />
                  </div>
                ) : (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-400/15 px-2 py-1 rounded-lg border border-amber-400/30 hidden sm:inline-block">
                    {isTelugu ? 'ప్లే' : 'Play'}
                  </span>
                )}
              </button>
            </div>

            {/* Smart Action Buttons Inside Message (Opens full review screen) */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setShowFullReview(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span>🌿</span>
                <span>{isTelugu ? 'పూర్తి సమీక్ష & నివారణ చూడండి' : 'See Full Review & Remedies'}</span>
              </button>

              <a
                href="tel:18001801551"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-600 transition-all active:scale-95 shadow-xs"
              >
                <span>📞</span>
                <span>{isTelugu ? 'కిసాన్ హెల్ప్‌లైన్: 1800-180-1551' : 'Call Kisan Helpline'}</span>
              </a>
            </div>

            {/* Message Delivery Status & Receipt */}
            <div className="flex items-center justify-end gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>{timeAgo(message.lifecycle?.created_at || message.created_at)}</span>
              <span>•</span>
              <span>SMS 1</span>
              <span>•</span>
              <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCheck className="w-3.5 h-3.5 inline mr-0.5" />
                {isTelugu ? 'చదివారు' : 'Read'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── GOOGLE MESSAGES BOTTOM ACTION BAR (See Full Review) ─── */}
      <div className="p-3 sm:p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => setShowFullReview(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] cursor-pointer"
        >
          <FileText className="w-5 h-5 text-emerald-100" />
          <span>{isTelugu ? 'పూర్తి సమీక్ష చూడండి' : 'See Full Review'}</span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </motion.div>
  );
}
