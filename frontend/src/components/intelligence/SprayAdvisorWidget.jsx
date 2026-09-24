import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, Wind, Droplets, Sun, Clock, ThermometerSnowflake, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import WhatsAppAlertButton from './WhatsAppAlertButton';

const SprayAdvisorWidget = ({ telemetry, weatherData }) => {
  const { t, i18n } = useTranslation();
  const isTelugu = i18n.language === 'te';

  // Determine values from hardware telemetry or weather data with farm-friendly defaults
  const temp = telemetry?.temperature ?? weatherData?.temperature ?? 26;
  const humidity = telemetry?.humidity ?? weatherData?.humidity ?? 60;
  const windSpeed = telemetry?.wind_speed ?? weatherData?.wind_speed ?? 8; // km/h
  const isRaining = telemetry?.rain_detected || telemetry?.rain_sensor || weatherData?.is_raining || false;
  const lux = telemetry?.light_lux ?? telemetry?.light_intensity ?? 12000;
  const pressure = telemetry?.pressure ?? 1012;

  // Evaluate 4 Critical Field Spray Conditions
  let rainStatus = 'ok';
  let tempStatus = 'ok';
  let windStatus = 'ok';
  let sunStatus = 'ok';

  // 1. Rain / Precipitation (Chemical washout risk within 2-4 hours)
  if (isRaining) {
    rainStatus = 'bad';
  } else if (pressure < 1002 || (weatherData?.rain_probability && weatherData.rain_probability > 40)) {
    rainStatus = 'warn'; // Storm / rain approaching
  }

  // 2. Temperature (Leaves burn if sprayed in blistering heat > 32°C, chemicals crystallize/ineffective < 12°C)
  if (temp > 32 || temp < 12) {
    tempStatus = 'bad';
  } else if (temp > 28 || temp < 16) {
    tempStatus = 'warn';
  }

  // 3. Wind Drift (Wind > 15 km/h causes chemical drift to non-target crops or loss to atmosphere)
  if (windSpeed > 18) {
    windStatus = 'bad';
  } else if (windSpeed > 12) {
    windStatus = 'warn';
  }

  // 4. Sun & Evaporation (Peak UV photodegrades chemicals; midday sun burns wet foliar stomata)
  if (lux > 30000 || (temp > 30 && humidity < 35)) {
    sunStatus = 'bad';
  } else if (lux > 18000) {
    sunStatus = 'warn';
  }

  // Determine Overall Spray Window Status
  let status = '';
  let message = '';
  let isOptimal = false;
  let color = 'text-slate-400';
  let bg = 'bg-slate-50 dark:bg-slate-900/50';
  let border = 'border-slate-200 dark:border-slate-800';
  let bgGradient = '';

  if (rainStatus === 'bad' || windStatus === 'bad' || tempStatus === 'bad') {
    isOptimal = false;
    status = isTelugu ? 'ప్రస్తుతం పిచికారీ చేయవద్దు 🛑' : 'Do Not Spray Right Now 🛑';
    color = 'text-rose-500 dark:text-rose-400';
    bg = 'bg-rose-500/10 dark:bg-rose-950/20';
    border = 'border-rose-500/30';
    bgGradient = 'from-rose-500/10 to-transparent';

    if (rainStatus === 'bad') {
      message = isTelugu 
        ? 'వర్షం పడే అవకాశం ఉంది. రసాయన మందులు కొట్టుకుపోయి వృధా అవుతాయి.'
        : 'Active rain detected or imminent. Agrochemicals will wash away instantly with zero absorption.';
    } else if (windStatus === 'bad') {
      message = isTelugu
        ? `గాలి వేగం ఎక్కువుగా ఉంది (${windSpeed} km/h). మందు గాల్లోకి కొట్టుకుపోయి పక్క పొలాలకు నష్టం కలిగిస్తుంది.`
        : `High wind speed (${windSpeed} km/h). Severe droplet drift risk onto non-target crops and loss to atmosphere.`;
    } else {
      message = isTelugu
        ? `తీవ్రమైన ఉష్ణోగ్రత (${temp}°C). ఎండలో మందు కొడితే ఆకులు మాడిపోయే ప్రమాదం ఉంది.`
        : `Extreme temperature (${temp}°C). Midday application will cause severe leaf scorch and phytotoxicity.`;
    }
  } else if (rainStatus === 'warn' || windStatus === 'warn' || tempStatus === 'warn' || sunStatus === 'bad') {
    isOptimal = false;
    status = isTelugu ? 'జాగ్రత్త: అనుకూలత తక్కువగా ఉంది ⚠️' : 'Caution: Marginal Spray Window ⚠️';
    color = 'text-amber-500 dark:text-amber-400';
    bg = 'bg-amber-500/10 dark:bg-amber-950/20';
    border = 'border-amber-500/30';
    bgGradient = 'from-amber-500/10 to-transparent';
    message = isTelugu
      ? 'పరిస్థితులు పూర్తిగా అనుకూలంగా లేవు. సాయంత్రం 4 గంటల తర్వాత లేదా ఎండ తగ్గాక పిచికారీ చేయండి.'
      : 'Conditions are marginal. Lower sprayer pressure or postpone spraying until early morning or late afternoon.';
  } else {
    isOptimal = true;
    status = isTelugu ? 'మందులు పిచికారీకి అనువైన సమయం ✅' : 'Optimal Spray Window Active ✅';
    color = 'text-emerald-500 dark:text-emerald-400';
    bg = 'bg-emerald-500/10 dark:bg-emerald-950/20';
    border = 'border-emerald-500/30';
    bgGradient = 'from-emerald-500/10 to-transparent';
    message = isTelugu
      ? `గాలి వేగం తక్కువగా ఉంది (${windSpeed} km/h), ఉష్ణోగ్రత అనుకూలం (${temp}°C). రసాయనాలు లేదా పురుగు మందుల పిచికారీకి ఉత్తమ సమయం.`
      : `Ideal weather parameters: calm winds (${windSpeed} km/h), mild temp (${temp}°C), and zero rain risk. Safe for fungicide/insecticide foliar spray.`;
  }

  const ConditionPill = ({ label, state, icon: Icon, detail }) => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
      state === 'ok' 
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
        : state === 'warn' 
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' 
        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
    }`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
      {detail && <span className="opacity-70 text-[10px]">({detail})</span>}
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative p-5 sm:p-6 rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between ${bg} ${border}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} pointer-events-none`} />
      
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {isTelugu ? 'రసాయన పిచికారీ భద్రతా సూచిక' : 'Pesticide Spray Safety Window'}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                {isTelugu ? 'గాలి, వర్షం, ఉష్ణోగ్రత ఆధారిత నిజసమయ విశ్లేషణ' : 'Real-time wind, washout, and scorch risk analysis'}
              </p>
            </div>
          </div>
          {isOptimal ? (
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          ) : (
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </span>
          )}
        </div>
        
        <div>
          <h2 className={`text-lg sm:text-xl font-black ${color}`}>{status}</h2>
          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
            {message}
          </p>
        </div>
        
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <ConditionPill label={isTelugu ? 'గాలి' : 'Wind'} state={windStatus} icon={Wind} detail={`${windSpeed} km/h`} />
            <ConditionPill label={isTelugu ? 'వర్షం' : 'Rain'} state={rainStatus} icon={Droplets} detail={isRaining ? 'Raining' : 'Clear'} />
            <ConditionPill label={isTelugu ? 'ఉష్ణోగ్రత' : 'Temp'} state={tempStatus} icon={ThermometerSnowflake} detail={`${temp}°C`} />
            <ConditionPill label={isTelugu ? 'ఎండ' : 'Sun/UV'} state={sunStatus} icon={Sun} detail={lux > 25000 ? 'High UV' : 'Mild'} />
          </div>

          <WhatsAppAlertButton
            cropName="Farm Crops"
            sectorName="Sector A"
            riskLevel={isOptimal ? "Optimal Spray Window" : status}
            temperature={temp}
            humidity={humidity}
            prescription={isOptimal ? "Apply preventative bio-fungicide or scheduled fertilizer spray." : message}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default SprayAdvisorWidget;
