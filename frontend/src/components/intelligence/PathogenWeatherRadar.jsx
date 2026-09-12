import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  CloudRain, Wind, Thermometer, Droplets, ShieldAlert, CheckCircle2, 
  RefreshCw, Cpu, Globe, AlertTriangle, Clock, Radio, Activity, Eye
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge } from '../ui/index';
import API from '../../services/api';
import { useHardwareMode } from '../../hooks/useHardwareMode';

export const PathogenWeatherRadar = ({
  cropName = 'Tomato',
  lat = 16.5062,
  lon = 80.6480,
  farmId = null,
  onRefresh = null
}) => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const { hardwareMode } = useHardwareMode();

  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState(null);
  const [error, setError] = useState(null);

  const fetchRadar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get('/api/intelligence/pathogen-radar', {
        params: {
          crop_name: cropName,
          lat,
          lon,
          farm_id: farmId || undefined,
          hardware_mode: hardwareMode
        }
      });
      setRadarData(res.data);
    } catch (err) {
      console.error('Failed to fetch pathogen radar:', err);
      setError('Unable to load live weather pathogen radar.');
    } finally {
      setLoading(false);
    }
  }, [cropName, lat, lon, farmId, hardwareMode]);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  const pathogens = radarData?.pathogens || [];
  const overallRisk = radarData?.overall_risk_percentage ?? 45;
  const overallLevel = radarData?.overall_risk_level || 'Moderate';
  const overallColor = radarData?.overall_risk_color || '#3b82f6';
  const sprayWindow = radarData?.spray_window;
  const ambient = radarData?.weather_telemetry?.ambient;
  const microclimate = radarData?.weather_telemetry?.microclimate;

  return (
    <Card glass className="p-5 sm:p-6 border border-emerald-500/20 bg-gradient-to-br from-white/80 via-emerald-500/[0.02] to-white/85 dark:from-[#040e08]/90 dark:via-emerald-950/20 dark:to-[#030a06]/95 backdrop-blur-md shadow-xl relative overflow-hidden rounded-[24px]">
      {/* Top ambient glow line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2.5px] transition-all duration-500" 
        style={{ background: `linear-gradient(to right, #10b981, ${overallColor}, #06b6d4)` }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 shrink-0">
            <Radio className="w-5 h-5 animate-pulse text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {isTe ? '🌦️ వాతావరణ ఆధారిత వ్యాధి వ్యాప్తి రాడార్' : 'Hyperlocal Weather & Pathogen Outbreak Radar'}
              </h3>
              
              {/* Dual-Stream Mode Badge */}
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                hardwareMode
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-400/40'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              }`}>
                {hardwareMode ? <Cpu className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                {hardwareMode
                  ? (isTe ? '🔌 డ్యూయల్-స్ట్రీమ్: ESP32 + OpenWeather' : 'Dual-Stream: ESP32 + OpenWeather')
                  : (isTe ? '🌱 సాఫ్ట్‌వేర్-ఓన్లీ: OpenWeather లైవ్ ఫీడ్' : 'Software-Only: OpenWeather Live')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {hardwareMode
                ? (isTe ? 'పొలంలోని ESP32 సెన్సార్ కానోపీ తేమ మరియు ఉపగ్రహ వాతావరణ సూచన విశ్లేషణ.' : 'Fused on-field ESP32 canopy microclimate sensors with regional OpenWeather satellite predictions.')
                : (isTe ? 'ఉపగ్రహ వాతావరణం ఆధారంగా ఫంగల్ స్పోర్ వ్యాప్తి అవకాశాల గణన.' : 'Real-time biological pathogen germination forecast calculated from OpenWeatherMap.')}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchRadar}
          isLoading={loading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="text-xs font-bold shrink-0 self-end sm:self-center"
        >
          {isTe ? 'తాజాకరించు' : 'Sync Radar'}
        </Button>
      </div>

      {/* Hero Dual-Gauge & Weather Telemetry Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
        
        {/* Outbreak Threat Gauge Card */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-black/25 border border-slate-200/80 dark:border-white/10 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-wider">
              {isTe ? 'వ్యాధి వ్యాప్తి ప్రమాదం' : 'Outbreak Threat Level'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ backgroundColor: overallColor }}>
              {overallLevel.toUpperCase()}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight" style={{ color: overallColor }}>
              {overallRisk}%
            </span>
            <span className="text-xs font-bold text-slate-500">
              {isTe ? 'సంక్రమణ సంభావ్యత' : 'Germination Risk'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700" 
              style={{ width: `${overallRisk}%`, backgroundColor: overallColor }} 
            />
          </div>

          <p className="text-[11px] font-semibold text-slate-600 dark:text-white/70">
            {radarData?.urgency || 'Foliage in stable low-pathogen baseline conditions.'}
          </p>
        </div>

        {/* Macro Ambient Weather Stream (OpenWeatherMap) */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-black/25 border border-slate-200/80 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Globe className="w-3.5 h-3.5" />
              {isTe ? 'ఉపగ్రహ వాతావరణం (OpenWeather)' : 'OpenWeatherMap Live'}
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 font-extrabold">
              Macro
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
              <span className="text-[10px] text-slate-400 block">{isTe ? 'ఉష్ణోగ్రత' : 'Temp'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{ambient?.temperature_c ?? 28.5}°C</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
              <span className="text-[10px] text-slate-400 block">{isTe ? 'గాలి తేమ' : 'Humidity'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{ambient?.relative_humidity_pct ?? 65}%</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
              <span className="text-[10px] text-slate-400 block">{isTe ? 'వర్ష సూచన' : 'Rain Prob'}</span>
              <span className="font-extrabold text-sky-500">{ambient?.rain_probability_pct ?? 20}%</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">
              <span className="text-[10px] text-slate-400 block">{isTe ? 'గాలి వేగం' : 'Wind'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{ambient?.wind_speed_ms ?? 3.2} m/s</span>
            </div>
          </div>
        </div>

        {/* Microclimate Canopy Sensor Stream (ESP32) */}
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-black/25 border border-slate-200/80 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              {isTe ? 'కానోపీ సెన్సార్ (ESP32)' : 'Canopy Sensor Node'}
            </span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
              hardwareMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-200 dark:bg-white/10 text-slate-500'
            }`}>
              {hardwareMode ? 'Online' : 'Standby'}
            </span>
          </div>

          {hardwareMode ? (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-300 block">{isTe ? 'ఆకుల క్రింద ఉష్ణోగ్రత' : 'Canopy Temp'}</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{microclimate?.canopy_temperature_c ?? 26.8}°C</span>
                </div>
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-300 block">{isTe ? 'కానోపీ తేమ (RH)' : 'Canopy RH'}</span>
                  <span className="font-extrabold text-cyan-500">{microclimate?.canopy_humidity_pct ?? 84.5}%</span>
                </div>
              </div>

              {/* Canopy Moisture Trap Alert */}
              {microclimate?.moisture_trap_detected && (
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-600 dark:text-amber-300 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isTe 
                      ? `కానోపీ తేమ డెల్టా +${microclimate.humidity_delta_pct}%: ఆకుల లోపల ఫంగల్ స్పోర్ ట్రాప్ కనుగొనబడింది!` 
                      : `Canopy moisture delta +${microclimate.humidity_delta_pct}%: Microclimate fungal trap detected!`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[84px] flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-100/60 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10">
              <Cpu className="w-5 h-5 text-slate-400 mb-1" />
              <p className="text-[11px] text-slate-500 dark:text-white/50 font-medium">
                {isTe ? 'సాఫ్ట్‌వేర్ మోడ్ క్రియాశీలం. హార్డ్‌వేర్ మోడ్ ఆన్ చేస్తే సెన్సార్ డ్యూయల్ స్ట్రీమ్ సక్రియమవుతుంది.' : 'Software mode active. Switch to Hardware Mode in Settings to view DHT22 canopy sensors.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pathogen Breakdown Cards */}
      <div className="space-y-2.5 my-4">
        <h4 className="text-xs font-black text-slate-700 dark:text-white/70 uppercase tracking-wider px-1">
          {isTe ? 'జీవసంబంధిత వ్యాధికారకాల ప్రమాద విశ్లేషణ (Pathogen Outbreak Risk)' : 'Crop Pathogen Germination Breakdown'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {pathogens.map((p) => {
            const isHigh = p.risk_percentage >= 50;
            return (
              <div 
                key={p.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isHigh 
                    ? 'bg-rose-500/[0.06] border-rose-500/30 dark:bg-rose-950/20' 
                    : 'bg-white/50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/10 hover:border-emerald-400/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-800 dark:text-white truncate" title={p.name}>
                    {p.name.split('(')[0]}
                  </span>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    p.risk_percentage >= 75 ? 'bg-rose-500 text-white' :
                    p.risk_percentage >= 50 ? 'bg-amber-500 text-white' :
                    p.risk_percentage >= 30 ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
                  }`}>
                    {p.risk_percentage}%
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-2">
                  <div 
                    className="h-full rounded-full"
                    style={{ 
                      width: `${p.risk_percentage}%`,
                      backgroundColor: p.risk_percentage >= 50 ? '#f43f5e' : '#10b981'
                    }} 
                  />
                </div>

                <div className="text-[10px] text-slate-500 dark:text-white/50 space-y-0.5">
                  <p><strong>Ideal:</strong> {p.optimal_temp_range} • {p.optimal_humidity}</p>
                  <p className="truncate"><strong>Vector:</strong> {p.spore_vector}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spray Window & Action Plan */}
      {sprayWindow && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 dark:text-white">
                  {isTe ? 'పిచికారీ సమయ విండో (Spray Timing Window):' : 'Agronomic Spray Window:'}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                  {sprayWindow.status}
                </span>
              </div>
              <p className="text-slate-600 dark:text-white/60 text-[11px] mt-0.5">
                {sprayWindow.reason} • <strong>{sprayWindow.best_time}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PathogenWeatherRadar;
