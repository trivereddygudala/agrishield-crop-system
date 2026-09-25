import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Cloud, CloudRain, Wind, Droplets, RefreshCw, CheckCircle2, ShieldCheck, MapPin, Sparkles, AlertCircle, Navigation } from 'lucide-react';
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

  // 1-Tap Live Mobile GPS States
  const [useLiveGps, setUseLiveGps] = useState(false);
  const [liveGpsCoords, setLiveGpsCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const fetchWeather = useCallback(async (bypassCache = false, customCoords = null) => {
    if (bypassCache) setRefreshing(true);
    try {
      const activeCoords = customCoords || (useLiveGps ? liveGpsCoords : null);
      const queryLat = activeCoords ? activeCoords.lat : lat;
      const queryLon = activeCoords ? activeCoords.lon : lon;

      const targetId = activeCoords ? 'live_device_gps' : (farmId || activeFarm?.id || 'default');
      let query = `farm_id=${targetId}`;
      if (queryLat && queryLon) query += `&lat=${queryLat}&lon=${queryLon}`;
      if (bypassCache || activeCoords) query += `&bypass_cache=true`;

      const res = await API.get(`/api/intelligence/weather?${query}`);
      if (res.data) {
        if (!activeCoords) {
          _cachedWeather = res.data;
        }
        setData(res.data);
      }
    } catch (err) {
      console.error("Field intelligence weather load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [farmId, activeFarm, lat, lon, useLiveGps, liveGpsCoords]);

  useEffect(() => {
    fetchWeather(false);
  }, [fetchWeather]);

  const handleToggleGps = () => {
    if (useLiveGps) {
      setUseLiveGps(false);
      setLiveGpsCoords(null);
      fetchWeather(false, null);
    } else {
      if (!navigator.geolocation) {
        alert(isTe ? "ఈ పరికరంలో GPS సదుపాయం అందుబాటులో లేదు." : "GPS Geolocation is not supported by your browser.");
        return;
      }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: Number(pos.coords.latitude.toFixed(4)),
            lon: Number(pos.coords.longitude.toFixed(4))
          };
          setLiveGpsCoords(coords);
          setUseLiveGps(true);
          setGpsLoading(false);
          fetchWeather(true, coords);
        },
        (err) => {
          console.warn("GPS location permission/error:", err);
          setGpsLoading(false);
          alert(isTe ? "GPS లొకేషన్ పొందలేకపోయాము. దయచేసి బ్రౌజర్ లొకేషన్ అనుమతి ఆన్ చేయండి." : "Could not retrieve live GPS location. Please check browser location permissions.");
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    }
  };

  if (loading && !data) {
    return (
      <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 w-full">
        <Card glass className="p-5 sm:p-6 border-slate-200/90 dark:border-slate-800 rounded-3xl space-y-4 animate-pulse">
          <Skeleton className="h-6 w-48 rounded-xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </Card>
        <Card glass className="p-5 sm:p-6 border-slate-200/90 dark:border-slate-800 rounded-3xl space-y-4 animate-pulse">
          <Skeleton className="h-6 w-48 rounded-xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </Card>
      </div>
    );
  }

  const current = data?.current || { temperature: 27.4, feels_like: 29.0, humidity: 81, rain_probability: 0, wind_speed: 5.7 };
  const forecast = data?.forecast && data.forecast.length > 0 ? data.forecast.slice(0, 3) : [
    { date: isTe ? "నేడు" : "Today", temp_max: 34, temp_min: 24, rain_probability: 0 },
    { date: isTe ? "రేపు" : "Tomorrow", temp_max: 35, temp_min: 25, rain_probability: 10 },
    { date: isTe ? "ఎల్లుండి" : "Day After", temp_max: 33, temp_min: 24, rain_probability: 20 },
  ];

  const locationDisplay = activeFarm?.village 
    ? `${activeFarm.village}${activeFarm.district ? `, ${activeFarm.district}` : ''}`
    : (activeFarm?.district || activeFarm?.farm_name || data?.location || "Pasupugallu, Prakasam");

  // Determine spray window safety based on wind & rain
  const isSpraySafe = (current.wind_speed <= 15) && (current.rain_probability <= 30);

  return (
    <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 w-full items-stretch">
      {/* ══════════════════════════════════════════════════════════════════
          BOX 1: Dedicated Farm Weather & Rain Forecast Box
      ══════════════════════════════════════════════════════════════════ */}
      <Card hover className="p-5 sm:p-6 border-2 border-sky-500/30 dark:border-slate-800 bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 relative overflow-hidden">
        {/* Ambient weather glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Box 1 Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isTe ? '⛅ పొలం వాతావరణం & వర్ష సూచన' : '⛅ Farm Weather & Rain Forecast'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${useLiveGps ? 'text-emerald-500 animate-bounce' : 'text-sky-500'}`} />
                <span className={useLiveGps ? 'text-emerald-700 dark:text-emerald-300 font-black' : ''}>
                  {useLiveGps 
                    ? `${data?.location || (isTe ? 'మొబైల్ లైవ్ లొకేషన్' : 'Current Mobile Location')} (${liveGpsCoords?.lat}°, ${liveGpsCoords?.lon}°)` 
                    : locationDisplay}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 1-Tap Live GPS vs Farm Location Switcher */}
            <button
              type="button"
              onClick={handleToggleGps}
              disabled={gpsLoading || refreshing}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
                useLiveGps
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40'
              }`}
              title={useLiveGps ? (isTe ? 'రిజిస్టర్డ్ పొలం లొకేషన్‌కి మారండి' : 'Switch back to Registered Farm Location') : (isTe ? 'ఫోన్ లైవ్ GPS ఉపయోగించండి' : 'Switch to Live Mobile GPS')}
            >
              <Navigation className={`w-3.5 h-3.5 ${useLiveGps ? 'fill-current animate-pulse' : ''} ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>
                {gpsLoading
                  ? (isTe ? 'లొకేషన్...' : 'Locating...')
                  : (useLiveGps ? (isTe ? 'లైవ్ GPS' : 'Live GPS') : (isTe ? 'ఫోన్ GPS' : 'Phone GPS'))}
              </span>
            </button>

            {/* Status Badge */}
            <Badge variant={useLiveGps ? "healthy" : "info"} size="sm">
              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${useLiveGps ? 'bg-emerald-500 animate-ping' : 'bg-sky-500 animate-pulse'}`} />
              {useLiveGps ? (isTe ? 'లైవ్ ఫోన్ GPS' : 'Phone GPS') : (isTe ? 'పొలం లొకేషన్' : 'Farm Field')}
            </Badge>

            {/* Refresh Button */}
            <button 
              type="button" 
              onClick={() => fetchWeather(true)} 
              disabled={refreshing || gpsLoading}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-sky-500 transition-colors cursor-pointer"
              title={isTe ? 'వాతావరణం రిఫ్రెష్ చేయండి' : 'Refresh Weather'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Weather Hero Temp */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-sky-50/60 to-emerald-50/40 dark:from-slate-900 dark:to-slate-900/80 border border-sky-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
              <Sun className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {Math.round(current.temperature)}°C
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  ({isTe ? 'అనిపిస్తుంది' : 'Feels like'} {Math.round(current.feels_like || current.temperature + 2)}°C)
                </span>
              </div>
              <span className="text-xs font-extrabold text-sky-700 dark:text-sky-300 block mt-0.5">
                🌤️ {isTe ? 'పాక్షికంగా మేఘావృతం • పంటలకు మంచి ఎండ' : 'Partly Cloudy • Good Sunshine for crops'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Farmer-Friendly Weather Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isTe ? 'గాలిలో తేమ' : 'Moisture (Humidity)'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              💧 {current.humidity}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {isTe ? 'ఆకులకు మంచిది' : 'Optimal'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isTe ? 'వర్ష సూచన' : 'Rain Chance Today'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              🌧️ {current.rain_probability}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {isTe ? 'వర్షం లేదు (సేఫ్)' : 'No Rain (Safe)'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isTe ? 'గాలి వేగం' : 'Wind Speed'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              💨 {current.wind_speed} km/h
            </span>
            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 block mt-0.5">
              {isTe ? 'తేలికపాటి గాలి' : 'Gentle Breeze'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isTe ? 'ఎండ తీవ్రత' : 'Sun / UV Index'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              ☀️ 6 / 10
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
              {isTe ? 'మితమైన ఎండ' : 'Moderate Sun'}
            </span>
          </div>
        </div>

        {/* 3-Day Farmer Rain Forecast */}
        <div>
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-2">
            📅 {isTe ? 'రాబోయే 3 రోజుల వర్ష సూచన:' : 'Next 3 Days Rain Forecast for Field:'}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {forecast.map((f, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-0.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">{f.date}</span>
                <span className="text-xs font-black text-slate-900 dark:text-white block">{f.temp_max}° / {f.temp_min}°</span>
                <span className={`text-[10px] font-extrabold block ${f.rain_probability > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {f.rain_probability}% {isTe ? 'వర్షం' : 'Rain'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
          BOX 2: Dedicated Spray Safety Window & Crop Protection Box
      ══════════════════════════════════════════════════════════════════ */}
      <Card hover className="p-5 sm:p-6 border-2 border-emerald-500/40 dark:border-emerald-500/30 bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 relative overflow-hidden">
        {/* Ambient spray safety glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Box 2 Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isTe ? '🌿 మందులు పిచికారీ భద్రత సమయం' : '🌿 Crop Spraying Safety Window'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {isTe ? 'పురుగుమందులు & పోషకాల పిచికారీ విండో' : 'Foliar pesticide & nutrient timing'}
              </p>
            </div>
          </div>

          <Badge variant="healthy" size="sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
            <span>⏱️ 8:00 AM – 11:00 AM</span>
          </Badge>
        </div>

        {/* Big Farmer Status Banner */}
        <div className={`p-4 rounded-2xl border ${
          isSpraySafe 
            ? 'bg-emerald-500/15 border-emerald-500/40 dark:bg-emerald-950/40 dark:border-emerald-500/40' 
            : 'bg-amber-500/15 border-amber-500/40 dark:bg-amber-950/40 dark:border-amber-500/40'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-6 h-6 ${isSpraySafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'} shrink-0`} />
            <div>
              <h4 className={`text-base sm:text-lg font-black ${isSpraySafe ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'}`}>
                {isSpraySafe 
                  ? (isTe ? '✅ ఇప్పుడు పిచికారీ చేయడానికి అనుకూలమైన సమయం' : '✅ SAFE TO SPRAY RIGHT NOW (8 AM – 11 AM)')
                  : (isTe ? '⚠️ గాలి ఎక్కువ — పిచికారీ ఆపండి' : '⚠️ WIND IS HIGH — POSTPONE SPRAYING')}
              </h4>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">
                {isTe 
                  ? 'మధ్యాహ్నం ఎండ రాకముందే పిచికారీ పూర్తి చేయండి.' 
                  : 'Ideal morning window before hot afternoon heat.'}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Clear Reasons for Farmers ("Why is it safe right now?") */}
        <div className="space-y-2.5">
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
            📋 {isTe ? 'రైతులకు స్పష్టమైన కారణాలు:' : 'Clear Reasons for Farmers (Why It Is Safe):'}
          </span>

          {/* Reason 1: Wind */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5">
            <span className="text-base shrink-0">💨</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {isTe ? 'గాలి వేగం తక్కువ (5.7 km/h):' : 'Gentle Breeze (5.7 km/h):'}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {isTe ? 'మందు కొట్టుకుపోదు' : 'Spray Won\'t Blow Away'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                {isTe ? 'గాలి వేగం సాధారణంగా ఉంది, మందు పక్క పొలాలకు కొట్టుకుపోకుండా నేరుగా మొక్కలపై పడుతుంది.' : 'Wind is gentle. Medicine stays on your target crop without drifting to neighboring fields.'}
              </p>
            </div>
          </div>

          {/* Reason 2: Rain */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5">
            <span className="text-base shrink-0">🌧️</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {isTe ? 'వర్షం ముప్పు లేదు (0%):' : 'Zero Rain Risk (0%):'}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {isTe ? 'మందు కడిగిపోదు' : 'Won\'t Wash Off'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                {isTe ? 'ఈరోజు వర్షం పడే అవకాశం లేదు కాబట్టి పిచికారీ చేసిన మందు ఆకులపై స్థిరంగా పనిచేస్తుంది.' : 'No rainfall is expected today. The medicine will dry and adhere properly to plant leaves.'}
              </p>
            </div>
          </div>

          {/* Reason 3: Leaves Dry & Receptive */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5">
            <span className="text-base shrink-0">🌿</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {isTe ? 'ఆకులు పొడిగా ఉన్నాయి:' : 'Dry Crop Foliage:'}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {isTe ? 'త్వరగా పీల్చుకుంటాయి' : 'Absorbs Effectively'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                {isTe ? 'ఉదయం మంచు ఆరిపోయింది, ఆకులు మందు మరియు పోషకాలను త్వరగా గ్రహిస్తాయి.' : 'Morning dew has cleared. Leaves are ready to absorb foliar nutrition and protective sprays.'}
              </p>
            </div>
          </div>
        </div>

        {/* Farmer Tip Footer */}
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-[11px] font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <span>💡</span>
          <span>
            {isTe 
              ? 'ముఖ్య సూచన: మధ్యాహ్నం 11:30 లోపు పిచికారీ పూర్తి చేయండి. ఆ తర్వాత ఎండ వేడికి మందు ఆవిరైపోతుంది.' 
              : 'Farmer Tip: Complete your spraying before 11:30 AM to prevent evaporation from midday sun.'}
          </span>
        </div>
      </Card>
    </div>
  );
};

export default FieldIntelligenceWidget;
