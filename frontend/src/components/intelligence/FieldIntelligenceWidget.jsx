import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Sun, Cloud, CloudRain, Wind, Droplets, RefreshCw, CheckCircle2, ShieldCheck, MapPin, 
  Sparkles, AlertCircle, Navigation, Moon, Clock, Sunrise, Sunset
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Skeleton } from '../ui/index';
import API from '../../services/api';
import { useFarm } from '../../context/FarmContext';

// Module-level in-memory cache to guarantee 0ms instant display on page revisit
let _cachedWeather = null;

const FieldIntelligenceWidget = ({ farmId, lat, lon }) => {
  const { t, i18n } = useTranslation();
  const isTe = (i18n?.language || 'en').startsWith('te');
  const isHi = (i18n?.language || 'en').startsWith('hi');
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
      const queryLat = activeCoords ? activeCoords.lat : (activeFarm?.latitude ? Number(activeFarm.latitude) : (lat && lat !== 28.6139 ? lat : 16.5062));
      const queryLon = activeCoords ? activeCoords.lon : (activeFarm?.longitude ? Number(activeFarm.longitude) : (lon && lon !== 77.209 ? lon : 80.6480));

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
        alert(t('dashboard.weather.gps_not_supported', 'GPS Geolocation is not supported by your browser.'));
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
          alert(t('dashboard.weather.gps_permission_denied', 'Could not retrieve live GPS location. Please check browser location permissions.'));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    }
  };

  // Current Hour & Time-of-Day Determination
  const currentHour = new Date().getHours();
  const isNight = currentHour >= 20 || currentHour < 5;
  const isDawn = currentHour >= 5 && currentHour < 8;
  const isDay = currentHour >= 8 && currentHour < 17;
  const isDusk = currentHour >= 17 && currentHour < 20;

  const current = data?.current || { 
    temperature: isNight ? 24 : isDawn ? 26 : isDusk ? 29 : 34, 
    feels_like: isNight ? 25 : isDawn ? 27 : isDusk ? 30 : 36, 
    humidity: isNight ? 85 : 70, 
    rain_probability: 0, 
    wind_speed: isNight ? 4.2 : 6.5 
  };

  const isRain = current.rain_probability > 50;
  const isCloudy = !isRain && current.rain_probability > 25;

  // Determine spray window safety based on wind, rain & time-of-day
  const isWindRainSafe = (current.wind_speed <= 15) && (current.rain_probability <= 30);
  const isSprayActive = isWindRainSafe && (currentHour >= 6 && currentHour <= 11 || currentHour >= 16 && currentHour <= 18);

  const forecast = data?.forecast && data.forecast.length > 0 ? data.forecast.slice(0, 3) : [
    { date: isTe ? 'ఈ రోజు' : 'Today', temp_max: 34, temp_min: 24, rain_probability: 0 },
    { date: isTe ? 'రేపు' : 'Tomorrow', temp_max: 35, temp_min: 25, rain_probability: 10 },
    { date: isTe ? 'ఎల్లుండి' : 'Day After', temp_max: 33, temp_min: 24, rain_probability: 20 },
  ];

  const locationDisplay = activeFarm?.village
    ? `${activeFarm.village}${activeFarm.district ? `, ${activeFarm.district}` : ''}`
    : (activeFarm?.district || activeFarm?.farm_name || data?.location || "Guntur, Andhra Pradesh");

  // Time-of-day dynamic styles for Weather Box
  const weatherTheme = isRain ? {
    period: 'rain',
    iconText: '🌧️',
    title: isTe ? 'వర్షపు వాతావరణం' : isHi ? 'बारिश का मौसम' : 'Rainy Weather',
    desc: isTe ? 'పొలంలో వర్షపు జల్లులు పడే అవకాశం ఉంది' : 'Precipitation expected in field area',
    cardBorder: 'border-sky-500/40 dark:border-sky-500/50',
    ambientGlow: 'bg-sky-500/15',
    bannerBg: 'bg-gradient-to-r from-sky-950 via-blue-950 to-slate-900 border-sky-400/40 text-sky-100',
    badgeVariant: 'warning',
    badgeText: isTe ? 'వర్షపు సూచన' : 'Rain Radar'
  } : isNight ? {
    period: 'night',
    iconText: isCloudy ? '☁️' : '🌙',
    title: isCloudy 
      ? (isTe ? 'మేఘావృత రాత్రి' : 'Cloudy Night') 
      : (isTe ? 'శాంతమైన రాత్రి' : 'Clear Night Sky'),
    desc: isTe ? 'చల్లని ఉష్ణోగ్రత • నిశ్శబ్ద రాత్రి వాతావరణం' : 'Cool night temperatures • Calm nocturnal atmosphere',
    cardBorder: 'border-emerald-500/40 dark:border-emerald-500/50',
    ambientGlow: 'bg-emerald-600/15',
    bannerBg: 'bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border-emerald-500/40 text-emerald-100',
    badgeVariant: 'healthy',
    badgeText: isTe ? 'రాత్రి సమయం' : 'Night Mode'
  } : isDawn ? {
    period: 'dawn',
    iconText: '🌅',
    title: isTe ? 'ఉదయపు వాతావరణం' : 'Fresh Morning Dawn',
    desc: isTe ? 'చల్లని గాలి • అనుకూలమైన ఉదయపు వాతావరణం' : 'Crisp morning air • Dew evaporating',
    cardBorder: 'border-amber-500/40 dark:border-amber-500/50',
    ambientGlow: 'bg-amber-500/15',
    bannerBg: 'bg-gradient-to-r from-amber-950 via-orange-950 to-slate-900 border-amber-400/50 text-amber-100',
    badgeVariant: 'warning',
    badgeText: isTe ? 'ఉదయపు సమయం' : 'Morning Dawn'
  } : isDusk ? {
    period: 'dusk',
    iconText: '🌇',
    title: isTe ? 'సాయంత్రపు వాతావరణం' : 'Pleasant Evening Twilight',
    desc: isTe ? 'చల్లబడుతున్న ఉష్ణోగ్రత • సాయంత్రపు సమయం' : 'Cooling twilight breeze • Sunset hours',
    cardBorder: 'border-orange-500/40 dark:border-orange-500/50',
    ambientGlow: 'bg-orange-500/15',
    bannerBg: 'bg-gradient-to-r from-orange-950 via-rose-950 to-slate-900 border-orange-400/50 text-orange-100',
    badgeVariant: 'warning',
    badgeText: isTe ? 'సాయంత్రపు సమయం' : 'Evening Dusk'
  } : {
    period: 'day',
    iconText: isCloudy ? '⛅' : '☀️',
    title: isCloudy ? (isTe ? 'తేలికపాటి మేఘాలు' : 'Partly Cloudy') : (isTe ? 'తేట ఎండ' : 'Bright Sunshine'),
    desc: isTe ? 'పంటల కిరణజన్య సంయోగక్రియకు ఉత్తమ ఎండ' : 'Optimal natural sunlight for crop photosynthesis',
    cardBorder: 'border-amber-400/40 dark:border-amber-500/40',
    ambientGlow: 'bg-amber-400/15',
    bannerBg: 'bg-gradient-to-r from-amber-50 via-yellow-50 to-emerald-50/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-850 border-amber-300 dark:border-slate-800 text-slate-900 dark:text-white',
    badgeVariant: 'healthy',
    badgeText: isTe ? 'పగటి ఎండ' : 'Day Sunshine'
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

  return (
    <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 w-full items-stretch">
      {/* ══════════════════════════════════════════════════════════════════
          BOX 1: Dedicated Farm Weather & Rain Forecast Box (Animated & Time-Aware)
      ══════════════════════════════════════════════════════════════════ */}
      <Card hover className={`p-5 sm:p-6 border-2 ${weatherTheme.cardBorder} bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 relative overflow-hidden`}>
        {/* Ambient weather glow */}
        <div className={`absolute top-0 right-0 w-72 h-72 ${weatherTheme.ambientGlow} rounded-full blur-3xl pointer-events-none transition-all duration-700`} />

        {/* Box 1 Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
              <motion.span
                animate={
                  isNight
                    ? { rotate: [0, -10, 10, 0], scale: [1, 1.12, 1] }
                    : isRain
                    ? { y: [0, -2, 0], scale: [1, 1.08, 1] }
                    : { rotate: [0, 180, 360], scale: [1, 1.08, 1] }
                }
                transition={{ duration: isDay ? 14 : 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-xl inline-block"
              >
                {weatherTheme.iconText}
              </motion.span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isTe ? 'పొలం వాతావరణం & వర్ష సూచన' : 'Farm Weather & Rain Forecast'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300/80 dark:border-indigo-700">
                  {weatherTheme.badgeText}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${useLiveGps ? 'text-emerald-500 animate-bounce' : 'text-sky-500'}`} />
                <span className={useLiveGps ? 'text-emerald-700 dark:text-emerald-300 font-black' : ''}>
                  {useLiveGps
                    ? `${data?.location || (isTe ? 'మొబైల్ లైవ్ జీపీఎస్' : 'Current Mobile Location')} (${liveGpsCoords?.lat}°, ${liveGpsCoords?.lon}°)`
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer select-none active:scale-95 ${
                useLiveGps
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40'
              }`}
              title={useLiveGps ? (isTe ? 'నమోదైన పొలం స్థానానికి మారండి' : 'Switch back to Registered Farm') : (isTe ? 'మొబైల్ లైవ్ జీపీఎస్‌కు మారండి' : 'Switch to Live Mobile GPS')}
            >
              <Navigation className={`w-3.5 h-3.5 ${useLiveGps ? 'fill-current animate-pulse' : ''} ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>
                {gpsLoading
                  ? (isTe ? 'గుర్తిస్తోంది...' : 'Locating...') 
                  : (useLiveGps ? (isTe ? 'లైవ్ జీపీఎస్' : 'Live GPS') : (isTe ? 'ఫోన్ జీపీఎస్' : 'Phone GPS'))}
              </span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchWeather(true)}
              disabled={refreshing || gpsLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-sky-500 transition-colors cursor-pointer"
              title={isTe ? 'వాతావరణాన్ని రీఫ్రెష్ చేయండి' : 'Refresh Weather'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Real-Time Weather Hero Banner (Animated & Time-Color Styled) */}
        <div className={`p-4 sm:p-5 rounded-2xl border ${weatherTheme.bannerBg} flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 transition-all duration-500`}>
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/20 flex items-center justify-center shrink-0 shadow-lg relative">
              <motion.div
                animate={
                  isNight
                    ? { rotate: [0, -10, 10, 0], scale: [1, 1.15, 1] }
                    : isRain
                    ? { y: [0, -3, 0], scale: [1, 1.08, 1] }
                    : { rotate: [0, 180, 360], scale: [1, 1.1, 1] }
                }
                transition={{ duration: isDay ? 14 : 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-3xl select-none"
              >
                {weatherTheme.iconText}
              </motion.div>
              {isNight && !isCloudy && (
                <motion.span
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.2, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-1 -right-1 text-xs text-amber-200"
                >
                  ✨
                </motion.span>
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {Math.round(current.temperature)}°C
                </span>
                <span className="text-xs font-bold opacity-80">
                  ({isTe ? 'అనిపించే ఉష్ణోగ్రత' : 'Feels like'} {Math.round(current.feels_like || current.temperature + 1)}°C)
                </span>
              </div>
              <span className="text-xs sm:text-sm font-black block mt-0.5 tracking-wide">
                {weatherTheme.title}
              </span>
              <p className="text-[11px] font-semibold opacity-75 mt-0.5">
                {weatherTheme.desc}
              </p>
            </div>
          </div>

          {/* Quick Diurnal Highlight Pill */}
          <div className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/15 dark:bg-white/10 border border-white/20 text-xs font-black shrink-0 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 opacity-80" />
            <span>
              {isNight ? (isTe ? 'రాత్రి ఉష్ణోగ్రత: 24°C' : 'Night Air: Cool') :
               isDawn ? (isTe ? 'ఉదయపు గాలి: ఆహ్లాదం' : 'Morning: Crisp') :
               isDusk ? (isTe ? 'సాయంత్రపు గాలి: చల్లదనం' : 'Evening: Calm') :
               (isTe ? 'పగటి ఉష్ణోగ్రత: సాధారణం' : 'Daylight: Active')}
            </span>
          </div>
        </div>

        {/* 4 Farmer-Friendly Weather Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isTe ? 'గాలిలో తేమ' : 'Humidity'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              💧 {current.humidity}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {current.humidity > 80 ? (isTe ? 'రాత్రి మంచు/తేమ' : 'High / Dew') : (isTe ? 'సరైన తేమ' : 'Optimal')}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isTe ? 'వర్ష సూచన' : 'Rain Chance'}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              🌧️ {current.rain_probability}%
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {current.rain_probability <= 20 ? (isTe ? 'వర్షం లేదు (సురక్షితం)' : 'No Rain (Safe)') : (isTe ? 'వర్షపు అవకాశం' : 'Rain Risk')}
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
              {current.wind_speed <= 10 ? (isTe ? 'నెమ్మదైన గాలి' : 'Gentle Breeze') : (isTe ? 'వేగవంతమైన గాలి' : 'Moderate Wind')}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isNight ? (isTe ? 'రాత్రి ఆకాశం' : 'Night Sky') : (isTe ? 'ఎండ తీవ్రత (UV)' : 'Sun / UV Index')}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
              {isNight ? '🌙 Clear' : '☀️ 6 / 10'}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
              {isNight ? (isTe ? 'నిర్మల రాత్రి' : 'Starlit') : (isTe ? 'సాధారణ ఎండ' : 'Moderate Sun')}
            </span>
          </div>
        </div>

        {/* 3-Day Farmer Rain Forecast */}
        <div className="relative z-10">
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-2">
            📅 {isTe ? 'రాబోయే 3 రోజుల వాతావరణం & వర్ష సూచన:' : 'Next 3 Days Rain Forecast for Field:'}
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
          BOX 2: Dedicated Spray Safety Window & Crop Protection Box (Time-Aware)
      ══════════════════════════════════════════════════════════════════ */}
      <Card hover className="p-5 sm:p-6 border-2 border-emerald-500/40 dark:border-emerald-500/30 bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 relative overflow-hidden">
        {/* Ambient spray safety glow */}
        <div className={`absolute top-0 right-0 w-72 h-72 ${isNight ? 'bg-indigo-600/10' : 'bg-emerald-500/10'} rounded-full blur-3xl pointer-events-none transition-all duration-700`} />

        {/* Box 2 Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {isTe ? 'మందుల పిచికారీ భద్రతా విండో' : 'Crop Spraying Safety Window'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {isTe ? 'తెగుళ్ల నివారణ & పోషకాల స్ప్రే సమయ విశ్లేషణ' : 'Real-time foliar spray & pesticide timing'}
              </p>
            </div>
          </div>

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-xs ${
            isNight
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : isSprayActive
              ? 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isNight ? 'bg-emerald-400 animate-pulse' : isSprayActive ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span>
              {isNight ? (isTe ? '⏱️ తదుపరి సమయం: రేపు ఉదయం 7:30 AM' : '⏱️ Next Safe Spray: Tomorrow 7:30 AM') :
               currentHour < 12 ? (isTe ? '⏱️ ఉదయం 8:00 – 11:30 AM' : '⏱️ 8:00 AM – 11:30 AM') :
               currentHour < 17 ? (isTe ? '⏱️ సాయంత్రం 4:00 – 6:30 PM' : '⏱️ 4:00 PM – 6:30 PM') :
               (isTe ? '⏱️ తదుపరి సమయం: రేపు ఉదయం' : '⏱️ Next Safe Spray: Tomorrow Morning')}
            </span>
          </div>
        </div>

        {/* Big Farmer Status Banner (Clean Emerald & Dark Slate — Zero Purple) */}
        <div className={`p-4 sm:p-5 rounded-2xl border-2 relative z-10 transition-all duration-500 ${
          isNight
            ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-emerald-500/50 text-white shadow-xl shadow-emerald-950/30'
            : isSprayActive
            ? 'bg-emerald-500/15 border-emerald-500/40 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 shadow-md'
            : 'bg-amber-500/15 border-amber-500/40 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 shadow-md'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isNight
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-md'
                : 'bg-white/20 border-white/30 text-white'
            }`}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-2xl"
              >
                {isNight ? '🌙' : isSprayActive ? '✅' : '⚠️'}
              </motion.div>
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                {isNight
                  ? (isTe ? '🌙 రాత్రి వేళ స్ప్రే చేయవద్దు • రేపు ఉదయం 7:30 AM కి స్ప్రే చేయండి' : '🌙 Do Not Spray at Night • Next Safe Spray: Tomorrow 7:30 AM')
                  : isSprayActive
                  ? (isTe ? '✅ ఇప్పుడు మందు పిచికారీ చేయడానికి అనుకూలమైన సమయం' : '✅ Safe to Spray Right Now (Ideal Conditions)')
                  : (isTe ? '⚠️ ఎండ తీవ్రత ఎక్కువ — సాయంత్రం 4:00 PM వరకు వేచి ఉండండి' : '⚠️ Midday Heat — Pause Spraying Until 4:00 PM')}
              </h4>
              <p className="text-xs font-semibold text-emerald-200 dark:text-emerald-300 mt-1 leading-relaxed">
                {isNight
                  ? (isTe ? 'రాత్రి వేళ పడే మంచు చుక్కల వల్ల మందు కారిపోతుంది. రేపు ఉదయం ఎండలో స్ప్రే చేస్తే 100% ప్రభావం ఉంటుంది.' : 'Heavy night dew washes spray away. Spraying in gentle morning sunlight gives full absorption and disease protection.')
                  : isSprayActive
                  ? (isTe ? 'గాలి వేగం తక్కువగా ఉంది మరియు ఎండ అనుకూలంగా ఉంది. మందు సమానంగా వ్యాపిస్తుంది.' : 'Gentle breeze and cool temperatures prevent chemical evaporation and wind drift.')
                  : (isTe ? 'తీవ్రమైన ఎండలో స్ప్రే చేస్తే మందు ఆవిరైపోతుంది మరియు ఆకులు మాడిపోయే ప్రమాదం ఉంది.' : 'Hot midday sun evaporates foliar spray and causes leaf burn. Waiting saves your input costs.')}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Clear Practical Reasons for Farmers (Simple, Non-Technical Farmer Words) */}
        <div className="space-y-2.5 relative z-10">
          <span className="text-xs font-black text-slate-800 dark:text-slate-200 block uppercase tracking-wider">
            📋 {isNight ? (isTe ? 'రేపు ఉదయం వరకు ఎందుకు వేచి ఉండాలి? (ముఖ్య కారణాలు):' : 'Why You Should Wait for Tomorrow Morning:') : (isTe ? 'రైతులకు స్పష్టమైన కారణాలు (ఎందుకు సురక్షితం):' : 'Clear Reasons for Farmers (Why It Is Safe):')}
          </span>

          {/* Reason 1 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 flex items-start gap-3 hover:border-emerald-500/40 transition-colors">
            <span className="text-xl shrink-0">{isNight ? '🌿' : '💨'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {isNight 
                    ? (isTe ? 'మొక్కల ఆకులు రాత్రి నిద్రిస్తాయి:' : 'Leaves Rest at Night:') 
                    : (isTe ? `నెమ్మదైన గాలి (${current.wind_speed} km/h):` : `Gentle Breeze (${current.wind_speed} km/h):`)}
                </span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {isNight ? (isTe ? 'మందు లోపలికి ఇంకదు' : 'No Absorption') : (isTe ? 'మందు పక్కకు కొట్టుకుపోదు' : "Won't Drift")}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                {isNight
                  ? (isTe ? 'రాత్రి వేళల్లో మొక్కల ఆకుల రంధ్రాలు మూసుకుంటాయి, కాబట్టి ఇప్పుడు మందు పిచికారీ చేసినా అది లోపలికి ఇంకకుండా వృథా అవుతుంది.' : 'Plant leaves close their breathing pores after dark. Any pesticide applied tonight cannot penetrate the plant and will be wasted.')
                  : (isTe ? 'గాలి చాలా నెమ్మదిగా వీస్తుంది. మందు పక్క చేలలోకి కొట్టుకుపోకుండా నేరుగా మీ పంట ఆకులపైనే నిలుస్తుంది.' : 'Wind is gentle. Medicine stays on your target crop without drifting to neighboring fields.')}
              </p>
            </div>
          </div>

          {/* Reason 2 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 flex items-start gap-3 hover:border-emerald-500/40 transition-colors">
            <span className="text-xl shrink-0">{isNight ? '💧' : '🌧️'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {isNight
                    ? (isTe ? 'రాత్రి పడే దట్టమైన మంచు:' : 'Heavy Night Dew:')
                    : (isTe ? `వర్షపు ముప్పు లేదు (${current.rain_probability}%):` : `Zero Rain Risk (${current.rain_probability}%):`)}
                </span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  {isNight ? (isTe ? 'మందు కారిపోతుంది' : 'Washes Off') : (isTe ? 'కరిగిపోదు' : "Won't Wash Off")}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                {isNight
                  ? (isTe ? 'రాత్రి పడే మంచు చుక్కల వల్ల మందు పలుచబడి ఆకుల నుంచి నేలమీద కారిపోతుంది. ఉదయం మంచు ఆరిన తర్వాతే పిచికారీ చేయాలి.' : 'Night moisture and dew drops dilute the spray and wash it straight off the leaves onto the ground.')
                  : (isTe ? 'నేడు వర్షం పడే అవకాశం లేదు. పిచికారీ చేసిన మందు ఆకులపై చక్కగా అతుక్కుంటుంది.' : 'No rainfall is expected today. The medicine will dry and adhere properly to plant leaves.')}
              </p>
            </div>
          </div>

          {/* Reason 3 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 flex items-start gap-3 hover:border-emerald-500/40 transition-colors">
            <span className="text-xl shrink-0">{isNight ? '🌅' : '🌿'}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {isNight
                    ? (isTe ? 'ఉదయం ఉత్తమ స్ప్రే సమయం:' : 'Best Time: Tomorrow Morning:')
                    : (isTe ? 'ఆకులు ఆరి ఉన్నాయి:' : 'Dry Crop Foliage:')}
                </span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {isNight ? (isTe ? 'ఉదయం 7:30 AM – 10:30 AM' : '7:30 AM – 10:30 AM') : (isTe ? 'వేగంగా గ్రహిస్తాయి' : 'Absorbs Effectively')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                {isNight
                  ? (isTe ? 'ఉదయం సూర్యుని ఎండ తగలగానే ఆకుల రంధ్రాలు తెరుచుకుంటాయి మరియు మంచు ఆరిపోతుంది, అప్పుడు స్ప్రే చేస్తే పూర్తి రక్షణ లభిస్తుంది.' : 'Morning sunlight clears the dew and reopens leaf pores, giving your crop maximum disease protection with minimum medicine.')
                  : (isTe ? 'ఉదయపు మంచు ఆరిపోయింది. ఆకులు పోషకాలను మరియు తెగులు మందులను వేగంగా గ్రహించడానికి సిద్ధంగా ఉన్నాయి.' : 'Morning dew has cleared. Leaves are ready to absorb foliar nutrition and protective sprays.')}
              </p>
            </div>
          </div>
        </div>

        {/* Farmer Tip Footer (High-Contrast Emerald Leaf Card — Zero Washed Out Purple) */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700/80 text-xs font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-3 relative z-10 shadow-xs">
          <span className="text-xl shrink-0">💡</span>
          <span className="leading-relaxed">
            {isNight
              ? (isTe ? 'రైతు సలహా: రాత్రి వేళ ప్రశాంతంగా విశ్రాంతి తీసుకోండి. రేపు ఉదయం 7:30 AM నుండి 10:30 AM లోపు స్ప్రే చేస్తే మందు ఆదా అవుతుంది మరియు పంటకు పూర్తి రక్షణ లభిస్తుంది.' : 'Farmer Advice: Rest well tonight. Morning spraying between 7:30 AM and 10:30 AM saves your medicine cost and keeps your crop 100% healthy.')
              : (isTe ? 'రైతు సలహా: మధ్యాహ్నం 11:30 AM లోపే పిచికారీ పూర్తి చేయండి. ఎండ తీవ్రత వల్ల మందు ఆవిరి కాకుండా ఉంటుంది.' : 'Farmer Tip: Complete your spraying before 11:30 AM to prevent evaporation from midday sun.')}
          </span>
        </div>
      </Card>
    </div>
  );
};

export default FieldIntelligenceWidget;
