import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Leaf, 
  Activity, 
  Droplet, 
  Wind, 
  Thermometer, 
  CheckCircle, 
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  Shield,
  ThumbsUp,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useSpeechReader } from '../hooks/useSpeechReader';
import { translateCrop, localizeAdvice } from '../utils/diseaseAdvisoryData';
import { getLocalizedSeverity, getAudioActionLabel } from '../utils/regionalLocale';

const CropAdvisorPanel = ({ advisor }) => {
  const { t, i18n } = useTranslation();
  const { speak, speakingId } = useSpeechReader();
  if (!advisor) return null;

  const { crop, severity, treatment, spray, recovery, prevention, tips } = advisor;

  // Compute severity style classes
  const isHighRisk = severity?.level?.toLowerCase()?.includes('high') || severity?.level?.toLowerCase()?.includes('severe');
  const isModerateRisk = severity?.level?.toLowerCase()?.includes('moderate') || severity?.level?.toLowerCase()?.includes('medium');
  const isHealthy = severity?.level?.toLowerCase()?.includes('healthy') || severity?.level?.toLowerCase()?.includes('low');

  const severityCardBg = isHighRisk 
    ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-400 dark:border-rose-800/80' 
    : isModerateRisk 
      ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-400 dark:border-amber-800/80' 
      : 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-800/80';

  const severityBadgeBg = isHighRisk 
    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-400/50' 
    : isModerateRisk 
      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/50' 
      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/50';

  const localizedCropName = translateCrop(crop?.name, i18n.language) || crop?.name;
  const normLevel = isHighRisk ? 'High' : isModerateRisk ? 'Moderate' : 'Low';
  const localizedSev = getLocalizedSeverity(normLevel, i18n.language);
  const localizedSeverityLevel = localizedSev.level;
  const hasVernacular = /[\u0900-\u0D7F]/.test(severity?.description || '');
  const localizedSeverityDesc = (!hasVernacular && i18n.language !== 'en')
    ? localizedSev.desc
    : (severity?.description || localizedSev.desc);

  return (
    <div className="space-y-6 mt-6">
      {/* 1. Header & Severity Summary */}
      <div 
        className={`rounded-2xl border p-6 flex flex-col md:flex-row items-center justify-between shadow-md backdrop-blur-md transition-all ${severityCardBg}`}
      >
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div 
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-md border ${severityBadgeBg}`}
          >
            {severity.icon}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
              <span>{localizedCropName}</span>
              <span className="text-slate-400 dark:text-slate-600">•</span>
              <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${severityBadgeBg}`}>
                {localizedSeverityLevel} {t('results.risk_label', 'Risk')}
              </span>
            </h2>
            <p className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm mt-1.5 leading-relaxed">
              {localizedSeverityDesc}
            </p>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-300/80 dark:border-slate-700 text-center shadow-md min-w-[160px]">
          <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('results.recovery_estimate_label', 'Recovery Estimate')}
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {recovery.expected_days > 0 ? `${recovery.expected_days} ${t('results.day', 'Days')}` : t('results.healthy', 'Healthy')}
          </div>
        </div>
      </div>

      {/* 2. Action Plan Tabs / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Organic Treatment */}
        {treatment.organic && treatment.organic.length > 0 && (
          <Card className="border-emerald-300 dark:border-emerald-700/70 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent dark:from-emerald-950/60 dark:to-slate-900 border-b border-emerald-200 dark:border-emerald-800/80 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-emerald-950 dark:text-emerald-300 flex items-center text-lg font-black">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 mr-2.5 border border-emerald-400/40">
                  <Leaf className="w-5 h-5" />
                </div>
                {t('results.organic_approach', 'Organic Approach')}
              </CardTitle>
              <button
                type="button"
                onClick={() => speak(treatment.organic.join('. '), 'advisor_organic', i18n.language || 'en')}
                className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold ${
                  speakingId === 'advisor_organic'
                    ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse shadow-md'
                    : 'bg-white/80 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-300/60 hover:bg-emerald-50'
                }`}
                title="Voice readout"
              >
                {speakingId === 'advisor_organic' ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="hidden sm:inline text-[11px]">{getAudioActionLabel(speakingId === 'advisor_organic', i18n.language)}</span>
              </button>
            </CardHeader>
            <CardContent className="pt-5">
              <ul className="space-y-3">
                {treatment.organic.map((step, idx) => (
                  <li key={idx} className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 flex items-start gap-3 shadow-2xs">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-slate-800 dark:text-slate-100 font-medium text-xs sm:text-sm leading-relaxed">{localizeAdvice(step, i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Chemical Treatment */}
        {treatment.chemical && treatment.chemical.length > 0 && (
          <Card className="border-blue-300 dark:border-blue-700/70 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-transparent dark:from-blue-950/60 dark:to-slate-900 border-b border-blue-200 dark:border-blue-800/80 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-blue-950 dark:text-blue-300 flex items-center text-lg font-black">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-300 mr-2.5 border border-blue-400/40">
                  <Activity className="w-5 h-5" />
                </div>
                {t('results.chemical_intervention', 'Chemical Intervention')}
              </CardTitle>
              <button
                type="button"
                onClick={() => speak(treatment.chemical.map(s => localizeAdvice(s, i18n.language)).join('. '), 'advisor_chemical', i18n.language || 'en')}
                className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold ${
                  speakingId === 'advisor_chemical'
                    ? 'bg-blue-600 text-white border-blue-500 animate-pulse shadow-md'
                    : 'bg-white/80 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-300/60 hover:bg-blue-50'
                }`}
                title="Voice readout"
              >
                {speakingId === 'advisor_chemical' ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="hidden sm:inline text-[11px]">{getAudioActionLabel(speakingId === 'advisor_chemical', i18n.language)}</span>
              </button>
            </CardHeader>
            <CardContent className="pt-5">
              <ul className="space-y-3">
                {treatment.chemical.map((step, idx) => (
                  <li key={idx} className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3 shadow-2xs">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <span className="text-slate-800 dark:text-slate-100 font-medium text-xs sm:text-sm leading-relaxed">{localizeAdvice(step, i18n.language)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 3. Spray Advisory */}
      {spray.best_time !== "No urgent spray needed" && (
        <Card className="bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white dark:from-indigo-950/60 dark:via-purple-950/40 dark:to-slate-900 border-indigo-300 dark:border-indigo-700/70 shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-indigo-950 dark:text-indigo-200 flex items-center">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 mr-2.5 border border-indigo-400/40">
                  <Droplet className="w-5 h-5" />
                </div>
                {t('results.optimal_spray_conditions', 'Optimal Spray Conditions')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  const sprayText = `Optimal spray conditions. Best timing: ${localizeAdvice(spray.best_time, i18n.language)}. Wind alert: ${localizeAdvice(spray.wind_warning, i18n.language)}. Spray interval: every ${spray.interval_days} days.`;
                  speak(sprayText, 'advisor_spray', i18n.language || 'en');
                }}
                className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold ${
                  speakingId === 'advisor_spray'
                    ? 'bg-indigo-600 text-white border-indigo-500 animate-pulse shadow-md'
                    : 'bg-white/80 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-300/60 hover:bg-indigo-50'
                }`}
                title="Voice readout"
              >
                {speakingId === 'advisor_spray' ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="hidden sm:inline text-[11px]">{getAudioActionLabel(speakingId === 'advisor_spray', i18n.language)}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800/80 flex items-start space-x-3.5 shadow-2xs">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">{t('results.timing', 'Timing')}</div>
                  <div className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm mt-1">{localizeAdvice(spray.best_time, i18n.language)}</div>
                </div>
              </div>
              <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800/80 flex items-start space-x-3.5 shadow-2xs">
                <Wind className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">{t('results.wind_alert', 'Wind Alert')}</div>
                  <div className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm mt-1">{localizeAdvice(spray.wind_warning, i18n.language)}</div>
                </div>
              </div>
              <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl p-4 border border-indigo-200 dark:border-indigo-800/80 flex items-start space-x-3.5 shadow-2xs">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">{t('results.interval', 'Interval')}</div>
                  <div className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm mt-1">{t('results.every_days', 'Every {{days}} days', { days: spray.interval_days })}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Prevention & Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prevention */}
        <Card className="border-amber-300 dark:border-amber-700/70 shadow-sm hover:shadow-md transition-all overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent dark:from-amber-950/60 dark:to-slate-900 border-b border-amber-200 dark:border-amber-800/80 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-amber-950 dark:text-amber-300 flex items-center text-lg font-black">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mr-2.5 border border-amber-400/40">
                <Shield className="w-5 h-5" />
              </div>
              {t('results.future_prevention', 'Future Prevention')}
            </CardTitle>
            <button
              type="button"
              onClick={() => speak(prevention.map(p => localizeAdvice(p, i18n.language)).join('. '), 'advisor_prevention', i18n.language || 'en')}
              className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold ${
                speakingId === 'advisor_prevention'
                  ? 'bg-amber-600 text-white border-amber-500 animate-pulse shadow-md'
                  : 'bg-white/80 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-amber-300/60 hover:bg-amber-50'
              }`}
              title="Voice readout"
            >
              {speakingId === 'advisor_prevention' ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span className="hidden sm:inline text-[11px]">{getAudioActionLabel(speakingId === 'advisor_prevention', i18n.language)}</span>
            </button>
          </CardHeader>
          <CardContent className="pt-5">
            <ul className="space-y-3">
              {prevention.map((item, idx) => (
                <li key={idx} className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-3 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                  <span className="text-slate-800 dark:text-slate-100 font-medium text-xs sm:text-sm leading-relaxed">{localizeAdvice(item, i18n.language)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Farmer Tips */}
        <Card className="border-sky-300 dark:border-sky-700/70 shadow-sm hover:shadow-md transition-all overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-sky-500/15 via-cyan-500/10 to-transparent dark:from-sky-950/60 dark:to-slate-900 border-b border-sky-200 dark:border-sky-800/80 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sky-950 dark:text-sky-300 flex items-center text-lg font-black">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-700 dark:text-sky-300 mr-2.5 border border-sky-400/40">
                <ThumbsUp className="w-5 h-5" />
              </div>
              {t('results.expert_farmer_tips', 'Expert Farmer Tips')}
            </CardTitle>
            <button
              type="button"
              onClick={() => speak(tips.map(tp => localizeAdvice(tp, i18n.language)).join('. '), 'advisor_tips', i18n.language || 'en')}
              className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1 text-xs font-bold ${
                speakingId === 'advisor_tips'
                  ? 'bg-sky-600 text-white border-sky-500 animate-pulse shadow-md'
                  : 'bg-white/80 dark:bg-slate-800 text-sky-600 dark:text-sky-400 border-sky-300/60 hover:bg-sky-50'
              }`}
              title="Voice readout"
            >
              {speakingId === 'advisor_tips' ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span className="hidden sm:inline text-[11px]">{getAudioActionLabel(speakingId === 'advisor_tips', i18n.language)}</span>
            </button>
          </CardHeader>
          <CardContent className="pt-5">
            <ul className="space-y-3">
              {tips.map((item, idx) => (
                <li key={idx} className="p-3.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 flex items-start gap-3 shadow-2xs hover:border-sky-400 transition-colors">
                  <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                  <span className="text-slate-800 dark:text-slate-100 font-medium text-xs sm:text-sm leading-relaxed">{localizeAdvice(item, i18n.language)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
};

export default CropAdvisorPanel;
