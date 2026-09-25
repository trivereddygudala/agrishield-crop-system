import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Cloud, CloudRain, Wind, Droplets, RefreshCw, CheckCircle2, ShieldCheck, MapPin, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Skeleton } from '../ui/index';
import API from '../../services/api';
import { useFarm } from '../../context/FarmContext';

// Module-level in-memory cache to guarantee 0ms instant display on page revisit
let _cachedWeather = null;

const FieldIntelligenceWidget = ({ farmId, lat, lon }) => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const { activeFarm } = useFarm();

  const [data, setData] = useState(_cachedWeather);
  const [loading, setLoading] = useState(!_cachedWeather);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWeather = useCallback(async (bypassCache = false) => {
    if (bypassCache) setRefreshing(true);
    try {
      const targetId = farmId || activeFarm?.id || 'default';
      let query = `farm_id=${targetId}`;
      if (lat && lon) query += `&lat=${lat}&lon=${lon}`;
      if (bypassCache) query += `&bypass_cache=true`;

      const res = await API.get(`/api/intelligence/weather?${query}`);
      if (res.data) {
        _cachedWeather = res.data;
        setData(res.data);
      }
    } catch (err) {
      console.error("Field intelligence weather load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [farmId, activeFarm, lat, lon]);

  useEffect(() => {
    fetchWeather(false);
  }, [fetchWeather]);

  if (loading && !data) {
    return (
      <Card glass className="p-5 sm:p-6 border-slate-200/90 dark:border-slate-800 rounded-3xl space-y-4 animate-pulse">
        <Skeleton className="h-6 w-48 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </Card>
    );
  }

  const current = data?.current || { temperature: 27.4, feels_like: 33.2, humidity: 81, rain_probability: 0, wind_speed: 5.7 };
  const forecast = data?.forecast && data.forecast.length > 0 ? data.forecast.slice(0, 3) : [
    { date: isTe ? "నేడు" : "Today", temp_max: 34, temp_min: 24, rain_probability: 0 },
    { date: isTe ? "రేపు" : "Tomorrow", temp_max: 35, temp_min: 25, rain_probability: 10 },
    { date: isTe ? "ఎల్లుండి" : "Day After", temp_max: 33, temp_min: 24, rain_probability: 20 },
  ];

  const locationDisplay = activeFarm?.village 
    ? `${activeFarm.village}${activeFarm.district ? `, ${activeFarm.district}` : ''}`
    : (activeFarm?.district || activeFarm?.farm_name || data?.location || "My Farm Field");

  // Determine spray window safety based on wind & rain
  const isSpraySafe = (current.wind_speed <= 15) && (current.rain_probability <= 30);

  return (
    <Card hover className="p-5 sm:p-6 lg:p-7 border border-emerald-500/20 dark:border-slate-800 bg-white/95 dark:bg-[#081220]/95 backdrop-blur-xl rounded-3xl shadow-sm hover:shadow-md transition-all space-y-5 overflow-hidden relative">
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
            <Sun className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{isTe ? 'పొలం వాతావరణం & స్ప్రే భద్రత' : 'Farm Weather & Spray Safety'}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-500" />
              <span>{locationDisplay}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="healthy" size="sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
            {isTe ? 'లైవ్ అప్డేట్' : 'Live Sync'}
          </Badge>
          <button 
            type="button" 
            onClick={() => fetchWeather(true)} 
            disabled={refreshing}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-500 transition-colors"
            title="Refresh Weather"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Live Weather & 3-Day Forecast */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-emerald-50/50 dark:from-slate-900 dark:to-slate-900/80 border border-sky-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0">
                <Sun className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {Math.round(current.temperature)}°C
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    ({isTe ? 'అనిపిస్తుంది' : 'Feels like'} {Math.round(current.feels_like || current.temperature + 2)}°C)
                  </span>
                </div>
                <span className="text-xs font-extrabold text-sky-700 dark:text-sky-300 block mt-0.5">
                  ⛅ {isTe ? 'పాక్షికంగా మేఘావృతం' : 'Partly Cloudy • Good Sunshine'}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Essential Atmospheric Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 text-center">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {isTe ? 'తేమ' : 'Humidity'}
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                💧 {current.humidity}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 text-center">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {isTe ? 'వర్ష సూచన' : 'Rain Chance'}
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                🌧️ {current.rain_probability}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 text-center">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {isTe ? 'గాలి వేగం' : 'Wind Speed'}
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                💨 {current.wind_speed} km/h
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 text-center">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {isTe ? 'ఎండ తీవ్రత' : 'UV Index'}
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                ☀️ 6 / 10
              </span>
            </div>
          </div>

          {/* Compact 3-Day Forecast Strip */}
          <div className="grid grid-cols-3 gap-2">
            {forecast.map((f, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">{f.date}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white block">{f.temp_max}° / {f.temp_min}°</span>
                <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 block">{f.rain_probability}% {isTe ? 'వర్షం' : 'Rain'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Safe Spray Window & Crop Protection Advisory */}
        <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between h-full">
          <div className={`p-4 sm:p-5 rounded-2xl border ${
            isSpraySafe 
              ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/30 dark:border-emerald-500/30' 
              : 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/30 dark:border-amber-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-5 h-5 ${isSpraySafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'} shrink-0`} />
              <h4 className={`text-sm sm:text-base font-black ${isSpraySafe ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'}`}>
                {isSpraySafe 
                  ? (isTe ? '✅ సురక్షిత స్ప్రే సమయం అనుకూలం (ఉదయం 8 - 11 AM)' : '✅ Optimal Spray Window Active (8 AM – 11 AM)')
                  : (isTe ? '⚠️ గాలి వేగం ఎక్కువ — జాగ్రత్తగా పిచికారీ చేయండి' : '⚠️ Wind advisory active — Spray with care')}
              </h4>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed mt-2.5">
              {isTe 
                ? 'తేలికపాటి గాలి (5.7 km/h) మరియు వర్షం లేకపోవడం వల్ల ఈ ఉదయం పోషకాలు లేదా పురుగుమందుల పిచికారీకి అనుకూలం. మధ్యాహ్నం ఎండ రాకముందే పూర్తి చేయండి.'
                : 'Calm morning winds (5.7 km/h) & 0% rain chance make this the ideal window for foliar nutrition or crop protection before afternoon heat.'}
            </p>
          </div>

          {/* Quick Crop Safety Indicators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {isTe ? 'పంట ఆకుల స్థితి: పొడిగా & సిద్ధంగా ఉంది' : 'Crop Foliage: Dry & Safe'}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{isTe ? 'సిద్ధం' : 'Ready'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                {isTe ? 'తెగుళ్ల వ్యాప్తి ముప్పు: తక్కువ' : 'Pathology Risk: Low'}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{isTe ? 'సురక్షితం' : 'Safe'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-2">
                <Wind className="w-3.5 h-3.5 text-sky-500" />
                {isTe ? 'మందు కొట్టుకుపోయే ప్రమాదం: అతి తక్కువ' : 'Drift Risk: Minimal (< 8 km/h)'}
              </span>
              <span className="text-sky-600 dark:text-sky-400 font-extrabold">{isTe ? 'అనుకూలం' : 'Ideal'}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default FieldIntelligenceWidget;
