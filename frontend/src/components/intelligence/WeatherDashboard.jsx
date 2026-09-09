import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cloud, CloudRain, Sun, Wind, Droplets, RefreshCw, AlertTriangle, Gauge, Eye, MapPin, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, Skeleton } from '../ui/index';
import API from '../../services/api';
import { useFarm } from '../../context/FarmContext';
import { useWebSocket } from '../../context/WebSocketContext';

export const WeatherCard = ({ current, location, providerName, cacheStatus, onRefresh, onLocate, onFarmLocate, locating }) => {
  const { t } = useTranslation();
  return (
  <Card glass className="p-4 sm:p-6 lg:p-8 border-slate-200/80 dark:border-slate-800 space-y-5 relative overflow-hidden bg-gradient-sky-card">
    {/* Ambient weather glow backdrop */}
    <div className="absolute top-0 right-0 -z-10 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

    {/* Header row */}
    <div className="flex flex-col gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg sm:text-xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{location}</h3>
            <Badge variant={cacheStatus === 'Cached' ? 'warning' : 'healthy'}>
              {cacheStatus === 'Cached' ? t('dashboard.weather.cached', 'Cached') : t('dashboard.weather.live_sync', 'Live Sync')}
            </Badge>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
            {t('dashboard.weather.provider', 'Provider')}: <strong className="text-slate-700 dark:text-slate-200">{providerName}</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
        <Button variant="secondary" size="sm" onClick={onFarmLocate} className="w-full text-xs font-bold px-1.5 sm:px-3 justify-center" leftIcon={<Sprout className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}>
          {t('dashboard.weather.farm', 'Farm')}
        </Button>
        <Button variant="outline" size="sm" onClick={onLocate} isLoading={locating} className="w-full text-xs font-bold px-1.5 sm:px-3 justify-center" leftIcon={<MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />}>
          {t('dashboard.weather.live_gps', 'Live GPS')}
        </Button>
        <Button variant="outline" size="sm" onClick={onRefresh} className="w-full text-xs font-bold px-1.5 sm:px-3 justify-center" leftIcon={<RefreshCw className="w-3.5 h-3.5 shrink-0" />}>
          {t('dashboard.weather.sync', 'Sync')}
        </Button>
      </div>
    </div>

    {/* Weather Hero Temp & Graphic */}
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-3.5 sm:gap-5">
        <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <Sun className="w-9 h-9 sm:w-12 sm:h-12 animate-spin-slow" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {current?.temperature ?? 30.9}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-slate-400">°C</span>
          </div>
          <span className="text-xs font-bold text-sky-700 dark:text-sky-400 block mt-0.5">
            {t('dashboard.weather.feels_like', 'Feels like')} {current?.feels_like ?? 33.2}°C • {t('dashboard.weather.partly_cloudy', 'Partly Cloudy')}
          </span>
        </div>
      </div>
    </div>

    {/* Weather Stats Pills Grid — 2x2 grid on mobile, 4-col on sm+ */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 w-full pt-1 min-w-0">
      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-black mb-0.5 truncate">
          <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="truncate">{t('dashboard.weather.humidity', 'Humidity')}</span>
        </div>
        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white block truncate">{current?.humidity ?? 59}%</span>
      </div>

      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-black mb-0.5 truncate">
          <CloudRain className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="truncate">{t('dashboard.weather.rain_prob', 'Rain Prob')}</span>
        </div>
        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white block truncate">{current?.rain_probability ?? 0}%</span>
      </div>

      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-black mb-0.5 truncate">
          <Wind className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{t('dashboard.weather.wind_speed', 'Wind Speed')}</span>
        </div>
        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white block truncate">{current?.wind_speed ?? 4.85} m/s</span>
      </div>

      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-black mb-0.5 truncate">
          <Gauge className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">{t('dashboard.weather.uv_index', 'UV Index')}</span>
        </div>
        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white block truncate">6 / 10</span>
      </div>
    </div>
  </Card>
  );
};

export const WeatherForecast = ({ forecast = [] }) => {
  const { t } = useTranslation();
  const defaultForecast = [
    { date: "Today", temp_max: 34, temp_min: 24, rain_probability: 0 },
    { date: "Wed", temp_max: 35, temp_min: 25, rain_probability: 10 },
    { date: "Thu", temp_max: 33, temp_min: 24, rain_probability: 20 },
    { date: "Fri", temp_max: 32, temp_min: 23, rain_probability: 45 },
    { date: "Sat", temp_max: 31, temp_min: 22, rain_probability: 65 },
    { date: "Sun", temp_max: 33, temp_min: 24, rain_probability: 15 },
    { date: "Mon", temp_max: 34, temp_min: 25, rain_probability: 5 }
  ];

  const items = forecast.length > 0 ? forecast : defaultForecast;

  return (
    <Card glass className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 space-y-3 w-full max-w-full min-w-0 overflow-hidden">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        {t('dashboard.weather.forecast_title', '7-Day Agro-Weather Forecast Strip')}
      </h4>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none w-full min-w-0 max-w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        {items.map((f, i) => {
          let WeatherIcon = Sun;
          let iconColor = 'text-amber-500 dark:text-amber-400';
          if (f.rain_probability > 40) {
            WeatherIcon = CloudRain;
            iconColor = 'text-sky-500 dark:text-sky-400';
          } else if (f.rain_probability > 10) {
            WeatherIcon = Cloud;
            iconColor = 'text-slate-500 dark:text-slate-400';
          }
          return (
            <div key={i} className="min-w-[95px] flex-none p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-1 hover:border-emerald-500/50 transition-colors shadow-xs">
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold block">{f.date}</span>
              <div className="my-1.5 flex items-center justify-center">
                <WeatherIcon className={`w-6 h-6 ${iconColor}`} />
              </div>
              <p className="text-xs font-black text-slate-900 dark:text-slate-100">{f.temp_max}° / {f.temp_min}°</p>
              <span className="text-[9px] font-extrabold text-sky-600 dark:text-sky-400 block">{f.rain_probability}% {t('dashboard.weather.rain', 'Rain')}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export const WeatherAlerts = ({ recommendations = [] }) => {
  const { t } = useTranslation();
  return (
    <Card glass className="p-4 sm:p-5 border-slate-200/80 dark:border-slate-800 space-y-3 w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{t('dashboard.weather.advisories_title', 'Agronomic Weather Advisories')}</span>
      </div>
      <ul className="space-y-2">
        {(recommendations.length > 0 ? recommendations : [
          t('dashboard.weather.adv_spray', 'Optimal spraying window identified between 06:00 AM - 08:30 AM before wind speed increases.'),
          t('dashboard.weather.adv_irrigation', 'Maintain current drip irrigation cycle; no heavy rainfall projected within the next 48 hours.')
        ]).map((rec, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export const WeatherDashboard = React.memo(({ farmId, lat, lon }) => {
  const { activeFarm } = useFarm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState(lat && lon ? { lat, lon } : null);

  const targetFarmId = farmId || (activeFarm ? activeFarm.id : 'default');

  const fetchWeather = useCallback(async (customCoords = null, forceSync = false, targetId = null) => {
    setLoading(true);
    try {
      const activeCoords = customCoords || coords;
      let query = "";
      if (activeCoords && activeCoords.lat && activeCoords.lon) {
        query = `lat=${activeCoords.lat}&lon=${activeCoords.lon}`;
      } else {
        const idToUse = targetId || targetFarmId;
        query = `farm_id=${idToUse}`;
      }
      if (forceSync) query += `&bypass_cache=true`;

      const res = await API.get(`/api/intelligence/weather?${query}`);
      setData(res.data);
    } catch {
      /* fallback */
    } finally {
      setLoading(false);
    }
  }, [coords, targetFarmId]);

  const handleFarmLocation = useCallback(() => {
    setCoords(null);
    fetchWeather(null, true, targetFarmId);
  }, [fetchWeather, targetFarmId]);

  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      fetchWeather(null, true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        };
        setCoords(newCoords);
        setLocating(false);
        fetchWeather(newCoords, true);
      },
      () => {
        setLocating(false);
        fetchWeather(null, true);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, [fetchWeather]);

  useEffect(() => {
    if (!coords && !lat && !lon) {
      handleDetectLocation();
    } else {
      fetchWeather();
    }
  }, [targetFarmId, lat, lon]);

  const { latestAlert } = useWebSocket();
  useEffect(() => {
    if (latestAlert && (latestAlert.category === 'weather' || latestAlert.message?.toLowerCase().includes('rain') || latestAlert.message?.toLowerCase().includes('storm') || latestAlert.message?.toLowerCase().includes('frost'))) {
      fetchWeather(null, true);
    }
  }, [latestAlert, fetchWeather]);

  if (loading && !data) {
    return (
      <Card glass className="p-6 border-slate-200/80 dark:border-slate-800 space-y-4">
        <Skeleton className="h-6 w-48 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </Card>
    );
  }

  const current = data?.current || { temperature: 30.9, humidity: 59, rain_probability: 0, wind_speed: 4.85 };
  const forecast = data?.forecast || [];
  const recs = data?.recommendations || [];
  const location = data?.location || (activeFarm ? activeFarm.farm_name : "Farm Location");
  const providerName = data?.provider_name || "OpenWeatherMapProvider";
  const cacheStatus = data?.metadata?.cache_status || data?.cache_status || "Live";

  return (
    <div className="space-y-4">
      <WeatherCard 
        current={current} 
        location={location} 
        providerName={providerName} 
        cacheStatus={cacheStatus} 
        onRefresh={() => fetchWeather(coords, true)} 
        onLocate={handleDetectLocation}
        onFarmLocate={handleFarmLocation}
        locating={locating}
      />
      <WeatherForecast forecast={forecast} />
      <WeatherAlerts recommendations={recs} />
    </div>
  );
});

export default WeatherDashboard;
