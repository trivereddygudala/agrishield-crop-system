import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Clock, Calendar, ShieldCheck, AlertCircle, RefreshCw, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, Skeleton, Progress } from '../ui/index';
import API from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { translateCrop, translateStage } from '../../utils/diseaseAdvisoryData';

export const WaterRecommendationCard = ({ data, onRefresh }) => {
  const { lastTelemetry } = useWebSocket();
  const { t, i18n } = useTranslation();
  if (!data) return null;

  const isRequired = data.irrigation_required;
  const isSmartIoT = data.mode === 'smart_iot' || (lastTelemetry?.telemetry?.soil_moisture != null);
  const rawMoisture = lastTelemetry?.telemetry?.soil_moisture ?? data.current_soil_moisture ?? null;
  const moisturePct = rawMoisture !== null ? Math.min(100, Math.max(0, rawMoisture)) : null;

  const waveColor = moisturePct !== null && moisturePct > 60
    ? 'bg-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.5)]'
    : moisturePct !== null && moisturePct > 35
    ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
    : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]';

  const localizedCrop = translateCrop(data.crop_type, i18n.language) || data.crop_type || 'Crop';
  const localizedStage = translateStage(data.growth_stage, i18n.language) || data.growth_stage || 'Active';

  return (
    <Card glass className="p-6 sm:p-8 border-slate-200/80 dark:border-slate-800 space-y-6 relative overflow-hidden bg-gradient-emerald-card">
      {/* Background glow */}
      <div className="absolute top-0 right-0 -z-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:border dark:border-emerald-500/30 dark:text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                {t('dashboard.irrigation.title', 'Smart Drip Irrigation Advisor')}
              </h3>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isSmartIoT
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                  : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              }`}>
                {isSmartIoT ? '📡 Smart IoT Mode' : '🌱 Software AI Mode'}
              </span>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium block mt-0.5">
              {t('dashboard.irrigation.crop', 'Crop')}: <strong className="text-slate-900 dark:text-slate-100 font-bold">{localizedCrop}</strong> ({localizedStage} {t('dashboard.irrigation.stage', 'Stage')})
            </span>
          </div>
        </div>

        <span className={`self-start sm:self-auto px-3 py-1 text-[10px] font-black uppercase tracking-wider shrink-0 rounded-full border ${
          isRequired === true
            ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 shadow-xs'
            : isRequired === false
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 shadow-xs'
            : 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40 shadow-xs'
        }`}>
          {isRequired === true
            ? t('dashboard.irrigation.required', 'IRRIGATION RECOMMENDED')
            : isRequired === false
            ? t('dashboard.irrigation.optimal', 'SKIP PUMP TODAY')
            : (t('dashboard.irrigation.check_field', 'FIELD CHECK RECOMMENDED'))}
        </span>
      </div>

      {/* Hero Recommendation Headline & Plant Graphic Row */}
      <div className="grid sm:grid-cols-12 gap-4 items-center">
        <div className="sm:col-span-8 p-4 sm:p-5 rounded-2xl bg-sky-50 dark:bg-slate-900/90 border border-sky-200 dark:border-slate-800 space-y-3">
          <h4 className="font-extrabold text-sky-900 dark:text-sky-300 text-base sm:text-xl leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
            {data.recommendation}
          </h4>
          <div className="space-y-1.5 pt-1">
            {data.reasoning?.map((r, i) => (
              <p key={i} className="text-xs text-slate-700 dark:text-slate-200 font-medium flex items-start gap-2">
                <span className="text-sky-600 dark:text-sky-400 font-bold shrink-0">•</span>
                <span>{r}</span>
              </p>
            ))}
          </div>
        </div>

        {/* Visual Crop Moisture Pot */}
        <div className="sm:col-span-4 p-4 rounded-2xl bg-emerald-50/50 dark:bg-slate-900/90 border border-emerald-200/70 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden min-h-[140px] shadow-sm">
          {moisturePct !== null ? (
            <>
              <div className="relative w-16 h-20 border-2 border-slate-400 dark:border-slate-600 rounded-b-2xl rounded-t-sm flex items-end overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-950">
                {/* Water Wave Fill */}
                <motion.div
                  className={`w-full rounded-b-xl ${waveColor}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${moisturePct}%` }}
                  transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                />
                {/* Pot rim */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-400 dark:border-slate-600 rounded-sm" />
                {/* Value Label */}
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-800 dark:text-slate-200 bg-white/40 dark:bg-slate-900/40 px-1 py-0.5 rounded backdrop-blur-[1px] m-auto h-fit w-fit font-mono shadow-sm">
                  {moisturePct}%
                </span>
              </div>
              <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mt-1">
                {t('dashboard.irrigation.moisture_pot', 'Live Soil Pot')}
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center space-y-1">
              <span className="text-2xl">🌱</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {data.sensor_status === 'offline' ? 'Sensor Offline' : 'No Soil Sensor'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Advisory from Weather & Crop Stage
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Bottom Stats Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-0.5 shadow-xs">
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-wider block">
            {t('dashboard.irrigation.water_per_acre', 'Water Demand')}
          </span>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {data.water_quantity_liters_per_acre != null ? `${data.water_quantity_liters_per_acre} L` : '--'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-0.5 shadow-xs">
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-wider block">
            {t('dashboard.irrigation.optimal_window', 'Optimal Window')}
          </span>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-1">{data.best_irrigation_time}</p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-0.5 shadow-xs">
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-wider block">
            {t('dashboard.irrigation.next_date', 'Next Target Date')}
          </span>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{data.next_irrigation_date}</p>
        </div>

        <div className="bg-white dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-0.5 shadow-xs">
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-wider block">
            {t('dashboard.irrigation.confidence', 'Advisor Confidence')}
          </span>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>{data.confidence_score}%</p>
        </div>
      </div>
    </Card>
  );
};


// In-memory module cache for instant hydration
const _irrigationCacheMap = new Map();

export const IrrigationAdvisor = React.memo(({ farmId, cropName, growthStage, farmSize = 1.0 }) => {
  const cacheKey = `${farmId || 'default'}_${cropName || ''}_${growthStage || ''}_${farmSize}`;
  const initialCached = _irrigationCacheMap.get(cacheKey) || _irrigationCacheMap.get('latest');

  const [data, setData] = useState(initialCached || null);
  const [loading, setLoading] = useState(!initialCached);

  const fetchIrrigation = async () => {
    if (!initialCached && !data) setLoading(true);
    try {
      const res = await API.get('/api/intelligence/irrigation', {
        params: {
          farm_id: farmId,
          ...(cropName ? { crop_name: cropName } : {}),
          ...(growthStage ? { growth_stage: growthStage } : {}),
          farm_size: farmSize
        }
      });
      if (res.data) {
        _irrigationCacheMap.set(cacheKey, res.data);
        _irrigationCacheMap.set('latest', res.data);
        setData(res.data);
      }
    } catch (err) {
      console.warn("Irrigation fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIrrigation();
  }, [farmId, cropName, growthStage, farmSize]);

  const { lastTelemetry } = useWebSocket();
  useEffect(() => {
    if (lastTelemetry) {
      const telem = lastTelemetry.telemetry || lastTelemetry;
      if (telem.soil_moisture !== undefined || telem.soil_percentage !== undefined || telem.rain_detected !== undefined || telem.rain_sensor !== undefined) {
        fetchIrrigation();
      }
    }
  }, [lastTelemetry]);

  if (loading && !data) {
    return <Skeleton className="h-56 rounded-2xl w-full" />;
  }

  const defaultData = {
    mode: "software_ai",
    sensor_status: "not_connected",
    crop_type: cropName || "Field Crop",
    growth_stage: growthStage || "Active",
    irrigation_required: null,
    recommendation: "Checking real-time weather and crop water demand...",
    reasoning: [
      "Live soil moisture sensor is not connected.",
      "Advisory is calculated using regional weather forecast and crop growth stage."
    ],
    water_quantity_liters_per_acre: null,
    best_irrigation_time: "Early Morning or Evening",
    next_irrigation_date: "Today",
    confidence_score: 82,
    current_soil_moisture: null
  };

  return <WaterRecommendationCard data={data || defaultData} onRefresh={fetchIrrigation} />;
});

export default IrrigationAdvisor;
