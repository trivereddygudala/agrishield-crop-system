import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Wind, CloudRain, Droplets, Compass, AlertTriangle, 
  CheckCircle2, Clock, Share2, Info, ChevronDown, ChevronUp, Sun
} from 'lucide-react';

/**
 * Agronomic Stull Wet Bulb Temperature Approximation
 * Inputs: Temperature in °C, Relative Humidity in % (0 - 100)
 */
export function calculateWetBulb(tempC, rh) {
  const T = Number(tempC) || 28;
  const RH = Math.min(100, Math.max(5, Number(rh) || 60));

  const tw = T * Math.atan(0.151977 * Math.pow(RH + 8.313659, 0.5)) +
    Math.atan(T + RH) -
    Math.atan(RH - 1.676331) +
    0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) -
    4.686035;

  return parseFloat(tw.toFixed(1));
}

/**
 * Calculates Delta-T (Delta-T = Dry Bulb - Wet Bulb)
 * Global agronomic standard for foliar pesticide & fungicide spray efficacy
 */
export function calculateDeltaT(tempC, rh) {
  const dryBulb = Number(tempC) || 28;
  const wetBulb = calculateWetBulb(dryBulb, rh);
  const deltaT = parseFloat((dryBulb - wetBulb).toFixed(1));
  return Math.max(0, deltaT);
}

export default function SprayWeatherRadarCard({
  temperature = 28,
  humidity = 65,
  windSpeed = 8,
  windDeg = 85,
  rainProbability = 10,
  cropName = 'Tomato',
  locationName = 'Guntur, AP',
  isTelugu = false
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = isTelugu || currentLang === 'te';

  const [expanded, setExpanded] = useState(false);

  // Compute Agronomic Indices
  const deltaT = useMemo(() => calculateDeltaT(temperature, humidity), [temperature, humidity]);
  const wetBulb = useMemo(() => calculateWetBulb(temperature, humidity), [temperature, humidity]);

  // Delta-T Status: Ideal is 2°C - 8°C
  const deltaTStatus = useMemo(() => {
    if (deltaT < 2.0) {
      return {
        rating: 'low',
        color: 'text-sky-500 dark:text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/30',
        badge: isTe ? 'తక్కువ ఆవిరి (ఫంగస్ ప్రమాదం)' : 'Low Evaporation (Fungal Risk)',
        advice: isTe 
          ? 'నీటి బిందువులు చాలా సేపు ఆకుపై ఉంటాయి. ఫంగల్ వ్యాధులు వ్యాపించే అవకాశం ఉంది.' 
          : 'Droplets do not evaporate easily. Risk of fungal spread or chemical leaf runoff.'
      };
    }
    if (deltaT >= 2.0 && deltaT <= 8.0) {
      return {
        rating: 'ideal',
        color: 'text-emerald-500 dark:text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        badge: isTe ? 'అనుకూల సమయం (ఉత్తమ శోషణ)' : 'Ideal Spray Window (Optimal)',
        advice: isTe 
          ? 'మందు ఆకులలోకి సమర్థవంతంగా చేరుతుంది. గరిష్ట రక్షణ లభిస్తుంది.' 
          : 'Pesticide droplets survive and bond optimally with leaf cuticles for maximum efficacy.'
      };
    }
    if (deltaT > 8.0 && deltaT <= 10.0) {
      return {
        rating: 'marginal',
        color: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        badge: isTe ? 'జాగ్రత్త (వేగవంతమైన ఆవిరి)' : 'Marginal (High Evaporation)',
        advice: isTe 
          ? 'ఉష్ణోగ్రత పెరుగుతోంది. మందు బిందువులు త్వరగా ఆవిరవుతాయి. ముతక నాజిల్‌ను వాడండి.' 
          : 'Droplets dry quickly in heat. Use coarser nozzles to prevent spray drift.'
      };
    }
    return {
      rating: 'lockout',
      color: 'text-rose-500 dark:text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/30',
      badge: isTe ? 'మందు కొట్టకూడదు (లాక్‌అవుట్)' : 'Spray Lockout (Do Not Spray)',
      advice: isTe 
        ? 'అధిక వేడి కారణంగా మందు బిందువులు ఆకును చేరకముందే ఆవిరవుతాయి. ఆకులు మాడిపోయే ప్రమాదం ఉంది.' 
        : 'Severe evaporation risk. Droplets evaporate mid-air, scorching leaf tissue (phytotoxicity).'
    };
  }, [deltaT, isTe]);

  // Wind Speed Evaluation (Ideal: 5 - 15 km/h)
  const windStatus = useMemo(() => {
    if (windSpeed < 5) {
      return {
        rating: 'calm',
        color: 'text-amber-500',
        label: isTe ? 'చాలా ప్రశాంతం (ఇన్‌వర్షన్ ప్రమాదం)' : 'Too Calm (Inversion Risk)',
        advice: isTe ? 'గాలి లేకపోవడం వల్ల మందు పొగలా పైనే నిలబడుతుంది.' : 'Calm air may trap fine chemical mist near ground level.'
      };
    }
    if (windSpeed <= 15) {
      return {
        rating: 'ideal',
        color: 'text-emerald-500',
        label: isTe ? 'అనుకూల గాలి వేగం' : 'Ideal Spray Wind',
        advice: isTe ? 'మందు పంటపై సమానంగా పడుతుంది.' : 'Uniform canopy penetration without excessive drift.'
      };
    }
    return {
      rating: 'high',
      color: 'text-rose-500',
      label: isTe ? 'తీవ్రమైన గాలి (మందు కొట్టవద్దు)' : 'High Drift Risk (Lockout)',
      advice: isTe ? 'మందు గాలికి పక్క పొలంలోకి లేదా మీ ముఖంపై కొట్టుకుపోతుంది.' : 'Chemical will blow away to non-target areas or operator.'
    };
  }, [windSpeed, isTe]);

  // Rain-Fast Washout Evaluation
  const rainStatus = useMemo(() => {
    if (rainProbability > 35) {
      return {
        rating: 'danger',
        label: isTe ? 'వర్షం ముప్పు (మందు కొట్టుకుపోతుంది)' : 'High Rain Washout Risk',
        color: 'text-rose-500'
      };
    }
    return {
      rating: 'safe',
      label: isTe ? 'వర్ష రహితం (మందు ఆకుకు పట్టుకుంటుంది)' : 'Rain-Fast Safe (>4h Dry)',
      color: 'text-emerald-500'
    };
  }, [rainProbability, isTe]);

  // Hourly Spray Timeline Schedule (12h Overview)
  const hourlyWindows = useMemo(() => [
    { time: '06:00 AM', status: 'safe', label: '6 AM' },
    { time: '07:30 AM', status: 'safe', label: '7:30' },
    { time: '09:00 AM', status: 'safe', label: '9 AM' },
    { time: '10:30 AM', status: 'marginal', label: '10:30' },
    { time: '12:00 PM', status: 'lockout', label: '12 PM' },
    { time: '01:30 PM', status: 'lockout', label: '1:30' },
    { time: '03:00 PM', status: 'lockout', label: '3 PM' },
    { time: '04:30 PM', status: 'marginal', label: '4:30' },
    { time: '05:30 PM', status: 'safe', label: '5:30' },
    { time: '06:30 PM', status: 'safe', label: '6:30' },
  ], []);

  // WhatsApp Task Share
  const handleWhatsAppShare = () => {
    const text = isTe
      ? `🌾 *అగ్రిషీల్డ్ స్ప్రే వాతావరణ రాడార్ సూచన* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *ప్రాంతం:* ${locationName}\n` +
        `🌱 *పంట:* ${cropName}\n` +
        `📅 *తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
        `⏱️ *ఉత్తమ స్ప్రే సమయం:* 06:30 AM - 09:30 AM (ఉదయం)\n` +
        `⚠️ *మందు కొట్టకూడని సమయం:* 11:30 AM - 03:30 PM (మధ్యాహ్నం వేడి)\n\n` +
        `📊 *వాతావరణ వివరాలు:*\n` +
        `• డెల్టా-T: ${deltaT}°C (${deltaTStatus.badge})\n` +
        `• గాలి వేగం: ${windSpeed} km/h (${windStatus.label})\n` +
        `• ఉష్ణోగ్రత: ${temperature}°C | తేమ: ${humidity}%\n` +
        `• వర్ష సూచన: ${rainStatus.label}\n\n` +
        `✨ _రైతులకు ఖచ్చితమైన స్ప్రే సలహా - అగ్రిషీల్డ్._`
      : `🌾 *AgriShield Spray-Weather Radar Advisory* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Location:* ${locationName}\n` +
        `🌱 *Target Crop:* ${cropName}\n` +
        `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
        `⏱️ *Optimal Spray Window:* 06:30 AM – 09:30 AM (Morning)\n` +
        `🚫 *Spray Lockout:* 11:30 AM – 03:30 PM (Midday Heat)\n\n` +
        `📊 *Key Agronomic Telemetry:*\n` +
        `• Delta-T Index: ${deltaT}°C (${deltaTStatus.badge})\n` +
        `• Wind Velocity: ${windSpeed} km/h (${windStatus.label})\n` +
        `• Temp & Humidity: ${temperature}°C | ${humidity}%\n` +
        `• Rain Washout Risk: ${rainStatus.label}\n\n` +
        `✨ _Measured via AgriShield Smart Agro-Weather Radar._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {isTe ? 'స్ప్రే వాతావరణ రాడార్' : 'Spray-Weather Radar'}
              </h3>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${deltaTStatus.bg} ${deltaTStatus.color}`}>
                {deltaTStatus.rating === 'ideal' ? (isTe ? 'అనుకూలం' : 'Ideal') : (isTe ? 'హెచ్చరిక' : 'Caution')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {locationName} • {isTe ? 'డెల్టా-T & గాలి వేగం విశ్లేషణ' : 'Delta-T & Foliar Spray Efficacy'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleWhatsAppShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          title={isTe ? 'వాట్సాప్‌లో కూలీలకు పంపండి' : 'Share Spray Advisory on WhatsApp'}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isTe ? 'షేర్' : 'Share'}</span>
        </button>
      </div>

      {/* Main Radar Telemetry Grid */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Hero Advisory Banner */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${deltaTStatus.bg}`}>
          <div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className={`w-4 h-4 ${deltaTStatus.color}`} />
              <span className={`text-xs font-black uppercase tracking-wider ${deltaTStatus.color}`}>
                {deltaTStatus.badge}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
              {deltaTStatus.advice}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-slate-700/50">
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-400">Delta-T</span>
              <p className={`text-xl font-black ${deltaTStatus.color}`}>
                {deltaT}°C
              </p>
            </div>
            <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase text-slate-400">Wet Bulb</span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {wetBulb}°C
              </p>
            </div>
          </div>
        </div>

        {/* 3 Telemetry Metrics */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          {/* 1. Wind Speed & Direction */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Wind className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase">{isTe ? 'గాలి వేగం' : 'Wind Drift'}</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {windSpeed} <span className="text-xs font-normal text-slate-500">km/h</span>
              </p>
              <Compass 
                className="w-3.5 h-3.5 text-sky-500 transition-transform" 
                style={{ transform: `rotate(${windDeg}deg)` }}
                title={`Wind direction: ${windDeg}°`}
              />
            </div>
            <span className={`text-[10px] font-bold block mt-0.5 truncate ${windStatus.color}`}>
              {windStatus.label}
            </span>
          </div>

          {/* 2. Temperature & RH */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Sun className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase">{isTe ? 'ఉష్ణోగ్రత' : 'Temp / RH'}</span>
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {temperature}°C <span className="text-xs font-normal text-slate-500">/ {humidity}%</span>
            </p>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mt-0.5">
              {humidity > 70 ? (isTe ? 'అధిక తేమ' : 'High Humidity') : (isTe ? 'అనుకూల తేమ' : 'Normal')}
            </span>
          </div>

          {/* 3. Rain Washout Risk */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <CloudRain className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase">{isTe ? 'వర్ష ప్రమాదం' : 'Rain Washout'}</span>
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {rainProbability}%
            </p>
            <span className={`text-[10px] font-bold block mt-0.5 truncate ${rainStatus.color}`}>
              {rainStatus.label}
            </span>
          </div>
        </div>

        {/* 12-Hour Timeline Visual Bar */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
            <span>{isTe ? '12 గంటల స్ప్రే విండో సమయాలు' : "Today's 12-Hour Spray Timeline"}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black">
              🟢 {isTe ? 'ఉత్తమం' : 'Safe'} | 🟡 {isTe ? 'జాగ్రత్త' : 'Caution'} | 🔴 {isTe ? 'వద్దు' : 'Lockout'}
            </span>
          </div>

          <div className="grid grid-cols-10 gap-1 text-center">
            {hourlyWindows.map((slot, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div 
                  className={`w-full h-3 rounded-full mb-1 transition-all ${
                    slot.status === 'safe'
                      ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                      : slot.status === 'marginal'
                        ? 'bg-amber-400'
                        : 'bg-rose-500/80'
                  }`}
                  title={`${slot.time}: ${slot.status.toUpperCase()}`}
                />
                <span className="text-[9px] font-bold text-slate-400 truncate max-w-full">
                  {slot.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expandable Agronomic Delta-T Science Explanation */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white pt-1 cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            {isTe ? 'డెల్టా-T సూత్రం ఎలా పనిచేస్తుంది?' : 'How does Delta-T protect your harvest?'}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 animate-in fade-in duration-150">
            <p>
              • <strong>ΔT (Delta-T)</strong> = Dry Bulb Temp − Wet Bulb Temp. ఇది ఆకుపై మందు బిందువులు ఎంత సేపు బతుకుతాయో కొలుస్తుంది.
            </p>
            <p>
              • <strong>2°C నుండి 8°C (ఆకుపచ్చ):</strong> అత్యుత్తమ సమయం. మందు ఆకులోకి పూర్తిగా ఇంకి తెగుళ్లను నాశనం చేస్తుంది.
            </p>
            <p>
              • <strong>&gt; 8°C (ఎరుపు):</strong> మధ్యాహ్నం అధిక వేడికి మందు బిందువులు గాలిలోనే ఆవిరై, ఆకును మాడ్చివేస్తాయి.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
