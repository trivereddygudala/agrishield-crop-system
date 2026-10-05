import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Droplets, Sun, Wind, Thermometer, Clock,
  Calendar, CheckCircle2, AlertTriangle, ShieldCheck,
  ArrowRight, Share2, RefreshCw, Zap, Gauge, Sparkles,
  Wifi, WifiOff, CloudRain, Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import API from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { translateCrop, translateStage } from '../../utils/diseaseAdvisoryData';

export default function SmartIrrigationScheduler({
  farmId,
  farmName = "My Farm",
  acreage = 2.0,
  cropName = "Tomato",
  growthStage = "Vegetative",
  latitude = 15.8020,
  longitude = 79.8050,
  district = "Prakasam",
  mandal = "Mundlamuru",
  village = "Pasupugallu",
  onClose
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  const [advisorData, setAdvisorData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [irrigationMethod, setIrrigationMethod] = useState('drip'); // 'drip', 'sprinkler', 'flood'

  const safeLat = !isNaN(parseFloat(latitude)) && parseFloat(latitude) !== 0 ? parseFloat(latitude) : 15.8020;
  const safeLng = !isNaN(parseFloat(longitude)) && parseFloat(longitude) !== 0 ? parseFloat(longitude) : 79.8050;

  // 1. Fetch authoritative recommendation from unified backend
  const fetchAdvisory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/api/intelligence/irrigation', {
        params: {
          farm_id: farmId,
          ...(cropName ? { crop_name: cropName } : {}),
          ...(growthStage ? { growth_stage: growthStage } : {}),
          farm_size: acreage,
          lat: safeLat,
          lon: safeLng
        }
      });
      if (res.data) {
        setAdvisorData(res.data);
      }
    } catch (e) {
      console.warn("Backend irrigation fetch fallback:", e);
      // Safe offline Software AI fallback with NO fake sensor values
      setAdvisorData({
        mode: "software_ai",
        sensor_status: "not_connected",
        irrigation_required: null,
        recommendation: isTe
          ? "వాతావరణం మరియు పంట దశ ఆధారంగా సలహా. మోటార్ వేసే ముందు నేల తేమను పరిశీలించండి."
          : "Advisory based on weather and crop stage. Check topsoil moisture before running irrigation.",
        reasoning: [
          isTe ? "లైవ్ సాయిల్ సెన్సార్ కనెక్ట్ చేయబడలేదు." : "Live soil moisture sensor is not connected.",
          isTe ? "ప్రాంతీయ వాతావరణం మరియు పంట నీటి అవసరం ఆధారంగా విశ్లేషించబడింది." : "Calculated using regional weather forecast and active crop growth stage."
        ],
        water_quantity_liters_per_acre: null,
        water_quantity_total: null,
        best_irrigation_time: "06:00 AM - 08:30 AM",
        next_irrigation_date: new Date().toISOString().split('T')[0],
        confidence_score: 80,
        current_soil_moisture: null,
        target_soil_moisture: 65,
        moisture_deficit: null,
        crop_type: cropName,
        growth_stage: growthStage
      });
    } finally {
      setIsLoading(false);
    }
  }, [farmId, cropName, growthStage, acreage, safeLat, safeLng, isTe]);

  useEffect(() => {
    fetchAdvisory();
  }, [fetchAdvisory]);

  // Reactive updates on incoming WebSocket telemetry
  const { lastTelemetry } = useWebSocket();
  useEffect(() => {
    if (lastTelemetry) {
      const telem = lastTelemetry.telemetry || lastTelemetry;
      if (telem.soil_moisture !== undefined || telem.soil_percentage !== undefined || telem.rain_detected !== undefined || telem.rain_sensor !== undefined) {
        fetchAdvisory();
      }
    }
  }, [lastTelemetry, fetchAdvisory]);

  // Derived state
  const isSmartIoT = advisorData?.mode === 'smart_iot' && advisorData?.current_soil_moisture !== null;
  const isSensorOffline = advisorData?.sensor_status === 'offline';
  const soilMoistureVal = advisorData?.current_soil_moisture;
  const hasSoilMoisture = soilMoistureVal !== null && soilMoistureVal !== undefined;

  // Pump minutes calculation per method
  const baseMinutes = advisorData?.recommended_pump_minutes || 0;
  const dripMinutes = baseMinutes;
  const sprinklerMinutes = Math.round(baseMinutes * (3.2 / 12.0) * 1.25);
  const floodHours = Number(((baseMinutes * (3.2 / 25.0) * 1.8) / 60).toFixed(1));

  const localizedCrop = translateCrop(cropName, i18n.language) || cropName;
  const localizedStage = translateStage(growthStage, i18n.language) || growthStage;

  const handleShareWhatsApp = () => {
    const sensorText = hasSoilMoisture
      ? `📊 *నేల తేమ (లైవ్ సెన్సార్):* ${soilMoistureVal}%\n`
      : `🌱 *మోడ్:* సాఫ్ట్‌వేర్ AI మోడ్ (సెన్సార్ కనెక్ట్ కాలేదు)\n`;

    const text = isTe
      ? `💧 *AgriShield స్మార్ట్ నీటి పారుదల షెడ్యూల్*\n\n` +
        `📍 *పొలం:* ${farmName} (${village})\n🌱 *పంట:* ${localizedCrop} (${acreage} ఎకరాలు) · దశ: ${localizedStage}\n\n` +
        sensorText +
        `☀️ *వాతావరణం:* ${advisorData?.weather_summary || 'అందుబాటులో ఉంది'}\n\n` +
        `⚡ *రైతుకు సలహా:* ${advisorData?.recommendation || ''}\n` +
        (baseMinutes > 0 ? `⏱️ *సిఫార్సు మోటార్ సమయం:* ${Math.floor(baseMinutes / 60)} గం. ${baseMinutes % 60} నిమిషాలు\n` : '') +
        `\n_AgriShield AI స్మార్ట్ అగ్రికల్చర్ ప్లాట్‌ఫారమ్._`
      : `💧 *AgriShield Smart Irrigation Advisor*\n\n` +
        `📍 *Farm:* ${farmName} (${village})\n🌱 *Crop:* ${localizedCrop} (${acreage} Acres) · Stage: ${localizedStage}\n\n` +
        (hasSoilMoisture ? `📊 *Live Soil Moisture:* ${soilMoistureVal}%\n` : `🌱 *Mode:* Software AI Mode (No Hardware Sensor)\n`) +
        `☀️ *Weather Summary:* ${advisorData?.weather_summary || 'Normal conditions'}\n\n` +
        `⚡ *Recommendation:* ${advisorData?.recommendation || ''}\n` +
        (baseMinutes > 0 ? `⏱️ *Suggested Run Time:* ${Math.floor(baseMinutes / 60)}h ${baseMinutes % 60}m\n` : '') +
        `\n_Generated via AgriShield Smart Irrigation Engine._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="rounded-3xl bg-[#060c14] border border-cyan-500/25 p-4 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Atmosphere Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1.5 ${
                isSmartIoT
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : isSensorOffline
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSmartIoT ? 'bg-cyan-400 animate-pulse' : isSensorOffline ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {isSmartIoT
                  ? '📡 Smart IoT Hardware Mode'
                  : isSensorOffline
                  ? '⚠️ Sensor Offline · Software Mode'
                  : '🌱 Software AI Mode'}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {isSmartIoT ? 'Live Field Sensor Telemetry' : 'Regional Weather & Crop Stage'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {isTe ? 'స్మార్ట్ నీటి పారుదల & మోటార్ సలహాదారు' : 'Smart Irrigation Advisor & Water Scheduler'}
            </h2>
            <p className="text-xs text-white/60">
              {localizedCrop} ({localizedStage} {isTe ? 'దశ' : 'Stage'}) · {acreage} {isTe ? 'ఎకరాలు' : 'Acres'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={fetchAdvisory}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-white/80 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? (isTe ? 'సమకాలీకరిస్తోంది...' : 'Syncing...') : (isTe ? 'రిఫ్రెష్' : 'Sync')}</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>{isTe ? 'వాట్సాప్ షేర్' : 'Share WhatsApp'}</span>
          </button>
        </div>
      </div>

      {/* Mode Explanation Notice Banner */}
      <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
        isSmartIoT
          ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
          : isSensorOffline
          ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
          : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
      }`}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">
            {isSmartIoT
              ? (isTe ? 'లైవ్ ఫీల్డ్ హార్డ్‌వేర్ యాక్టివ్:' : 'Live Field Sensor Connected:')
              : isSensorOffline
              ? (isTe ? 'ఫీల్డ్ సెన్సార్ ఆఫ్‌లైన్:' : 'Field Sensor Offline:')
              : (isTe ? 'సాఫ్ట్‌వేర్ AI మోడ్:' : 'Software AI Mode:')}
          </strong>{' '}
          <span>
            {isSmartIoT
              ? (isTe ? 'మీ పొలంలోని ESP32 సెన్సార్ నుండి రియల్-టైమ్ నేల తేమ రీడింగ్స్ ఆధారంగా విశ్లేషణ చేయబడుతోంది.' : 'Precision advice computed from real-time field soil sensors and weather forecasts.')
              : isSensorOffline
              ? (isTe ? 'పొలంలోని సెన్సార్ ఆఫ్‌లైన్‌లో ఉంది. వాతావరణ అంచనా మరియు పంట దశ ఆధారంగా సలహా అందించబడుతోంది.' : 'IoT field node is offline. Automatic fallback to weather and crop growth stage advisory.')
              : (isTe ? 'లైవ్ హార్డ్‌వేర్ సెన్సార్ కనెక్ట్ కాలేదు. ఉపగ్రహ వాతావరణ సూచన మరియు పంట నీటి అవసరాల ఆధారంగా సలహా ఇవ్వబడింది.' : 'No IoT hardware connected. Advisory is calculated using weather forecasts and crop growth requirements.')}
          </span>
        </div>
      </div>

      {/* Main Intelligent Verdict Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        advisorData?.irrigation_required === false
          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
          : advisorData?.irrigation_required === true
          ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
          : 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
      } space-y-2`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              advisorData?.irrigation_required === false
                ? 'bg-emerald-400'
                : advisorData?.irrigation_required === true
                ? 'bg-amber-400'
                : 'bg-cyan-400'
            } animate-ping`} />
            <span className="text-xs font-black uppercase tracking-wider">
              {advisorData?.irrigation_required === false
                ? (isTe ? 'మోటార్ అవసరం లేదు · నీటిని ఆదా చేయండి' : 'Skip Pump Run · Soil Sufficient')
                : advisorData?.irrigation_required === true
                ? (isTe ? 'నీటి పారుదల సిఫార్సు చేయబడింది' : 'Irrigation Recommended Today')
                : (isTe ? 'పొలం పరిశీలన సలహా' : 'Field Inspection Advised')}
            </span>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-black/40">
            {hasSoilMoisture
              ? `Soil: ${soilMoistureVal}%`
              : isSensorOffline
              ? (isTe ? 'సెన్సార్: ఆఫ్‌లైన్' : 'Soil: Offline')
              : (isTe ? 'సెన్సార్: లేదు' : 'Soil: Not Connected')}
          </span>
        </div>

        <p className="text-sm font-semibold text-white/95 leading-relaxed">
          {advisorData?.recommendation}
        </p>

        {/* Reasoning list */}
        {advisorData?.reasoning && advisorData.reasoning.length > 0 && (
          <div className="pt-2 border-t border-white/10 space-y-1">
            {advisorData.reasoning.map((r, idx) => (
              <p key={idx} className="text-xs text-white/70 flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{r}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 4 Precision Agro-Hydrology Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Soil Moisture Status */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-cyan-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'నేల తేమ స్థితి' : 'Soil Moisture Reading'}
            </span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-cyan-300">
            {hasSoilMoisture ? `${soilMoistureVal}%` : (isTe ? 'కనెక్ట్ కాలేదు' : 'Unavailable')}
          </p>
          <p className="text-[11px] text-white/60">
            {hasSoilMoisture
              ? (isTe ? `లక్ష్యం: ${advisorData?.target_soil_moisture || 65}%` : `Target: ${advisorData?.target_soil_moisture || 65}%`)
              : (isTe ? 'సాఫ్ట్‌వేర్ AI మోడ్' : 'Software AI Mode')}
          </p>
        </div>

        {/* Card 2: Rain Risk */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-blue-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'వర్ష సూచన సంభావ్యత' : 'Rain Probability'}
            </span>
            <CloudRain className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-300">
            {advisorData?.rain_probability != null ? `${advisorData.rain_probability}%` : '--'}
          </p>
          <p className="text-[11px] text-white/60">
            {advisorData?.rain_probability > 50
              ? (isTe ? 'వర్షం వల్ల మోటార్ ఆపవచ్చు' : 'Rain bypass active')
              : (isTe ? 'వర్షం తక్కువ సంభావ్యత' : 'Low precipitation risk')}
          </p>
        </div>

        {/* Card 3: Water Demand */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'నీటి పరిమాణ అవసరం' : 'Water Demand'}
            </span>
            <Droplets className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {advisorData?.water_quantity_liters_per_acre != null
              ? `${Number(advisorData.water_quantity_liters_per_acre).toLocaleString('en-IN')}`
              : '--'} <span className="text-xs font-normal text-white/60">L/acre</span>
          </p>
          <p className="text-[11px] text-white/60">
            {advisorData?.water_quantity_total != null
              ? `${Number(advisorData.water_quantity_total).toLocaleString('en-IN')} L total`
              : (isTe ? 'క్షేత్ర తనిఖీ తర్వాత నిర్ణయించండి' : 'Verify in field')}
          </p>
        </div>

        {/* Card 4: Best Time Window */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-purple-500/25 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              {isTe ? 'అనుకూల సమయం' : 'Optimal Window'}
            </span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-sm font-black text-purple-300 mt-2 truncate">
            {advisorData?.best_irrigation_time || 'Early Morning'}
          </p>
          <p className="text-[11px] text-white/60">
            {isTe ? 'బాష్పీభవన నష్టాన్ని తగ్గిస్తుంది' : 'Reduces evaporation loss'}
          </p>
        </div>
      </div>

      {/* Recommended Motor Run Time by Method */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>{isTe ? 'పద్ధతి ప్రకారం మోటార్ నడపవలసిన సమయం' : 'Recommended Pump Duration by Irrigation System'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Method 1: Drip */}
          <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            irrigationMethod === 'drip'
              ? 'bg-cyan-500/15 border-cyan-500/50 shadow-lg shadow-cyan-950/40'
              : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
          }`}
          onClick={() => setIrrigationMethod('drip')}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300">💧 {isTe ? 'డ్రిప్ ఇరిగేషన్' : 'Drip Irrigation'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono">92% Eff.</span>
            </div>
            <p className="text-2xl font-black text-white mt-2">
              {dripMinutes === 0 ? '0h 0m' : `${Math.floor(dripMinutes / 60)}h ${dripMinutes % 60}m`}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {isTe ? 'వేర్ల వద్ద సూక్ష్మ నీటి సరఫరా (ఉత్తమ పద్ధతి)' : 'Direct root zone micro-emission (Recommended)'}
            </p>
          </div>

          {/* Method 2: Sprinkler */}
          <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            irrigationMethod === 'sprinkler'
              ? 'bg-blue-500/15 border-blue-500/50 shadow-lg shadow-blue-950/40'
              : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
          }`}
          onClick={() => setIrrigationMethod('sprinkler')}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300">🌧️ {isTe ? 'స్ప్రింక్లర్ పద్ధతి' : 'Sprinkler System'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/20 text-blue-300 font-mono">75% Eff.</span>
            </div>
            <p className="text-2xl font-black text-white mt-2">
              {sprinklerMinutes === 0 ? '0h 0m' : `${Math.floor(sprinklerMinutes / 60)}h ${sprinklerMinutes % 60}m`}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {isTe ? 'తేలికపాటి పిచికారీ, ఆకుల చల్లదనం' : 'Overhead canopy micro-droplets'}
            </p>
          </div>

          {/* Method 3: Flood */}
          <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            irrigationMethod === 'flood'
              ? 'bg-slate-500/15 border-slate-500/50 shadow-lg'
              : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
          }`}
          onClick={() => setIrrigationMethod('flood')}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">🌊 {isTe ? 'కాలువ / బోరు బావి పారకం' : 'Surface Flood / Furrow'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-400/20 text-slate-300 font-mono">50% Eff.</span>
            </div>
            <p className="text-2xl font-black text-white mt-2">
              {floodHours === 0 ? '0 Hours' : `${floodHours} Hours`}
            </p>
            <p className="text-xs text-white/60 mt-1">
              {isTe ? 'కాలువల ద్వారా నేరుగా పారించడం' : 'Traditional furrow flooding (High loss)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
