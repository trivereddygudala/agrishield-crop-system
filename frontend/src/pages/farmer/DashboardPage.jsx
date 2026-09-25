import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Droplets, Sprout, Clock, RefreshCw, ChevronRight, TrendingUp, Camera, ShieldCheck, MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useTranslation } from 'react-i18next';
import API from '../../services/api';
import { Button, Card, Skeleton, Badge } from '../../components/ui/index';
import WidgetErrorBoundary from '../../components/WidgetErrorBoundary';
import { useWebSocket } from '../../context/WebSocketContext';

// Intelligence System Widgets
import FieldIntelligenceWidget from '../../components/intelligence/FieldIntelligenceWidget';
import { translateCrop, translateStage, translateDisease } from '../../utils/diseaseAdvisoryData';
import { CURATED_FARM_PHOTOS } from '../../services/photoService';

// In-memory module-level cache to enable instantaneous (0ms) page transitions
let cachedDashboardStats = null;
let cachedDashboardDevices = null;
let cachedActiveDevice = null;

const DashboardPage = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isTe = i18n.language === 'te';
  
  // Instant load: If cache exists from this session, do NOT show skeleton
  const [loading, setLoading] = useState(!cachedDashboardStats);


  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState(() => cachedDashboardStats || {
    total: 0,
    healthy: 0,
    diseased: 0,
    recent: [],
  });

  const [devices, setDevices] = useState(() => cachedDashboardDevices || []);
  const [activeDevice, setActiveDevice] = useState(() => cachedActiveDevice || null);

  // Default Delhi coordinates or active farm coordinates
  const [coordinates, setCoordinates] = useState(() => {
    if (activeFarm && activeFarm.latitude && activeFarm.longitude) {
      return { lat: activeFarm.latitude, lon: activeFarm.longitude };
    }
    return { lat: 28.6139, lon: 77.2090 };
  });

  useEffect(() => {
    if (user?.role?.toLowerCase() === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user?.role?.toLowerCase() === 'equipment_provider') {
      navigate('/provider/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (activeFarm && activeFarm.latitude && activeFarm.longitude) {
      setCoordinates({ lat: activeFarm.latitude, lon: activeFarm.longitude });
    }
  }, [activeFarm]);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground && !cachedDashboardStats) setLoading(true);
    try {
      const [statsRes, devicesRes] = await Promise.all([
        API.get('/api/history?limit=10').catch(err => {
          console.warn("Stats load failed:", err);
          return { data: { predictions: [], total: 0 } };
        }),
        API.get('/api/v1/devices/status').catch(err => {
          console.warn("Devices status load failed:", err);
          return { data: [] };
        })
      ]);

      const list = statsRes.data?.predictions || [];
      const total = statsRes.data?.total || 0;
      let healthy = 0;
      let diseased = 0;
      
      list.forEach(item => {
        if (item.prediction_status === 'healthy') healthy++;
        else diseased++;
      });

      const newStats = { total, healthy, diseased, recent: list.slice(0, 5) };
      cachedDashboardStats = newStats;
      setStats(newStats);

      const deviceList = devicesRes.data || [];
      cachedDashboardDevices = deviceList;
      setDevices(deviceList);
      
      if (deviceList.length > 0) {
        const sorted = [...deviceList].sort((a, b) => {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (b.status === 'online' && a.status !== 'online') return 1;
          return (a.seconds_since_seen ?? 999999) - (b.seconds_since_seen ?? 999999);
        });
        const onlineDev = sorted[0];
        cachedActiveDevice = onlineDev;
        setActiveDevice(prev => {
          if (prev && prev.device_id === onlineDev.device_id) {
            return { ...onlineDev, latest_telemetry: onlineDev.latest_telemetry || prev.latest_telemetry };
          }
          return onlineDev;
        });
      }
    } catch (error) {
      console.error("Dashboard data load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If cached data exists, refresh silently in the background (stale-while-revalidate)
    const isBackground = !!cachedDashboardStats;
    fetchDashboardData(isBackground);
    const intervalId = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    return () => clearInterval(intervalId);
  }, [coordinates, fetchDashboardData]);

  const { lastTelemetry, deviceStatusMap } = useWebSocket();

  useEffect(() => {
    if (lastTelemetry) {
      const telem = lastTelemetry.telemetry || lastTelemetry;
      setActiveDevice(prev => ({
        ...(prev || {}),
        device_id: lastTelemetry.device_id || prev?.device_id || "ESP32-NODE-ALPHA",
        status: lastTelemetry.status || 'online',
        latest_telemetry: {
          ...(prev?.latest_telemetry || {}),
          ...telem
        }
      }));
    } else if (Object.keys(deviceStatusMap).length > 0) {
      const devIds = Object.keys(deviceStatusMap);
      const dev = deviceStatusMap[devIds[0]];
      setActiveDevice(prev => ({
        ...(prev || {}),
        device_id: devIds[0],
        status: dev.status || 'online',
        latest_telemetry: {
          ...(prev?.latest_telemetry || {}),
          ...(dev.latest_telemetry || {})
        }
      }));
    }
  }, [lastTelemetry, deviceStatusMap]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData(true);
    setIsRefreshing(false);
  };

  // Live telemetry sensor drift simulation for QA Testing
  const [driftOffset, setDriftOffset] = useState({ temp: 0, hum: 0, soil: 0 });

  useEffect(() => {
    const userRole = user?.role?.toLowerCase() || 'farmer';
    const isDriftSimEnabled = localStorage.getItem('sim_telemetry_drift') !== 'false';

    if (userRole !== 'tester' || !isDriftSimEnabled) {
      setDriftOffset({ temp: 0, hum: 0, soil: 0 });
      return;
    }

    const interval = setInterval(() => {
      setDriftOffset(prev => ({
        temp: prev.temp + (Math.random() - 0.5) * 0.4,
        hum: prev.hum + (Math.random() - 0.5) * 1.0,
        soil: prev.soil + (Math.random() - 0.5) * 0.8
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [user]);

  const rawTelemetry = activeDevice?.latest_telemetry || {};
  const activeTelemetry = {
    ...rawTelemetry,
    temperature: rawTelemetry.temperature != null ? parseFloat((rawTelemetry.temperature + driftOffset.temp).toFixed(1)) : null,
    humidity: rawTelemetry.humidity != null ? Math.min(100, Math.max(0, Math.round(rawTelemetry.humidity + driftOffset.hum))) : null,
    soil_moisture: (rawTelemetry.soil_moisture != null || rawTelemetry.soil_percentage != null)
      ? Math.min(100, Math.max(0, Math.round((rawTelemetry.soil_moisture ?? rawTelemetry.soil_percentage) + driftOffset.soil)))
      : null
  };

  const farmId = activeFarm?.farm_id || activeFarm?.id;
  const cropName = activeFarm?.crop_name || "Tomato";
  const growthStage = activeFarm?.growth_stage || "Vegetative";
  const farmSize = activeFarm?.farm_size || 1.0;

  const currentDateFormatted = new Date().toLocaleDateString(
    i18n.language === 'te' ? 'te-IN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );

  const farmLocationDisplay = activeFarm?.village 
    ? `${activeFarm.village}${activeFarm.district ? `, ${activeFarm.district}` : ''}` 
    : (activeFarm?.district || activeFarm?.farm_name || t('dashboard.my_farm_field', 'My Farm Field'));

  // Stagger container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto w-full animate-pulse p-4">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-[380px] rounded-3xl" />
          <Skeleton className="lg:col-span-5 h-[380px] rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 w-full pb-6 max-w-[1600px] mx-auto"
    >
      {/* ─── Top Header Card (Field Overview & Scan Leaf Action - Bounded & Professional) ─── */}
      <motion.div variants={itemVariants} className="col-span-12">
        <div className="p-4 sm:p-5 lg:p-6 rounded-3xl bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0 shadow-xs">
              🌾
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {activeFarm?.farm_name ? `${activeFarm.farm_name} ${t('dashboard.overview', 'Overview')}` : t('dashboard.my_farm_overview', 'My Farm Overview')}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                <span className="flex items-center gap-1 text-rose-500 font-bold">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {farmLocationDisplay}
                </span>
                <span>•</span>
                <span className="text-slate-700 dark:text-slate-300 font-bold">{currentDateFormatted}</span>
              </div>
            </div>
          </div>

          {/* Action Row: Refresh + Wide Pill Scan Crop Leaf Button */}
          <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <button 
              type="button"
              onClick={handleManualRefresh}
              className="p-3 sm:p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-600 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
              title={t('dashboard.refresh_btn', 'Refresh Dashboard Data')}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <Link to="/upload" className="flex-1 md:flex-initial">
              <Button 
                variant="primary" 
                size="lg" 
                leftIcon={<Camera className="w-5 h-5" />} 
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/30 py-3 sm:py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm sm:text-base transition-all active:scale-[0.98] cursor-pointer"
              >
                {t('dashboard.scan_crop_leaf', 'Scan Crop Leaf')}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── Daily Farm Status Banner (Professional, Boundaries, Light Blur, Highlighted Words) ─── */}
      <motion.div variants={itemVariants} className="col-span-12">
        <div className="w-full">
          <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-xl bg-slate-900">
            {/* Real agricultural landscape photography with gentle blur */}
            <img 
              src={CURATED_FARM_PHOTOS.farmHero} 
              alt="Authentic Agricultural Farm Field" 
              className="absolute inset-0 w-full h-full object-cover object-center scale-105 filter blur-[1.5px]"
              loading="eager"
            />
            {/* Balanced translucent gradient scrim allowing vibrant green fields & sunlight to show through clearly */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/20" />
            <div className="absolute inset-0 bg-emerald-950/20 mix-blend-multiply" />
            
            <div className="relative z-10 p-5 sm:p-6 lg:p-8 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* High-contrast frosted glass container with highlighted keywords */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/55 backdrop-blur-md border border-white/20 shadow-2xl space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/60 text-emerald-300 text-xs font-black shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🌾 {isTe ? 'పొలం ప్రత్యక్ష సమాచారం' : 'Authentic Field Telemetry'}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {t('dashboard.namaste_farmer', 'Namaste, {{name}}! 👋', { name: user?.name || user?.username || 'Farmer' })}
                </h2>
                <div className="text-xs sm:text-sm font-semibold text-slate-100 leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span>{isTe ? 'ఈరోజు ' : 'Today is '}</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black shadow-md border border-amber-300 text-xs sm:text-sm">
                    ☀️ {isTe ? '34°C & ఎండగా ఉంది' : '34°C & Sunny'}
                  </span>
                  <span>{isTe ? ' — సురక్షిత స్ప్రే సమయం: ' : ' — Safe spray window: '}</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-400 text-slate-950 font-black shadow-md border border-emerald-300 text-xs sm:text-sm">
                    ⏱️ {isTe ? 'ఉదయం 8 AM – 11 AM' : '8 AM – 11 AM'}
                  </span>
                </div>
              </div>

              {/* 3 High-Contrast Status Badges with glowing dots & highlighted text */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-emerald-400/60 text-emerald-300 text-xs sm:text-sm font-black shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isTe ? 'పంట: ఆరోగ్యకరం' : 'Crops: Healthy'}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-sky-400/60 text-sky-300 text-xs sm:text-sm font-black shadow-lg">
                  <span>💧</span>
                  <span>{isTe ? `నేల: ${activeTelemetry?.soil_moisture ?? 45}% (తగినంత)` : `Soil: ${activeTelemetry?.soil_moisture ?? 45}% (Optimal)`}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-emerald-400/60 text-emerald-300 text-xs sm:text-sm font-black shadow-lg">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isTe ? 'తెగుళ్ల ముప్పు: తక్కువ' : 'Disease Risk: Low'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Essential Farmer KPIs (4 Spacious, High-Contrast Cards) ─── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Active Crop */}
        <div className="h-full">
          <div className="p-4 sm:p-5 border-t-4 border-t-emerald-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  {t('dashboard.kpi.active_crop_label', 'Active Crop:')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Sprout className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                {cropName ? (translateCrop(cropName, i18n.language) || cropName) : (
                  <Link to="/farm" className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                    <span>+ {t('dashboard.set_crop', 'Set Your Crop')}</span>
                  </Link>
                )}
              </div>
            </div>
            {cropName ? (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {translateStage(growthStage, i18n.language)} {t('dashboard.kpi.stage', 'Stage')}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-3">
                {t('dashboard.configure_crop', 'Configure crop in My Farm')}
              </p>
            )}
          </div>
        </div>

        {/* KPI 2: Leaf Scans */}
        <div className="h-full">
          <div className="p-4 sm:p-5 border-t-4 border-t-teal-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-teal-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  {t('dashboard.kpi.leaf_scans_label', 'Leaf Scans:')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 dark:bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                {stats.total}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 text-teal-800 dark:text-teal-300 font-bold text-xs">
                🌿 {stats.healthy} {t('dashboard.kpi.healthy', 'Healthy')}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 font-bold text-xs">
                🍂 {stats.diseased} {t('dashboard.kpi.treated', 'Treated')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Soil Water */}
        <div className="h-full">
          <div className="p-4 sm:p-5 border-t-4 border-t-sky-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-sky-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  {t('dashboard.kpi.soil_water_label', 'Soil Water:')}
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 dark:bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Droplets className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                {activeTelemetry?.soil_moisture ?? 45}%
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 text-sky-800 dark:text-sky-300 font-bold text-xs">
                💧 {(activeTelemetry?.soil_moisture ?? 45) > 50 ? t('dashboard.kpi.optimal', 'Optimal') : (activeTelemetry?.soil_moisture ?? 45) > 30 ? t('dashboard.kpi.adequate', 'Adequate') : t('dashboard.kpi.needs_water', 'Needs Water')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Market Rate */}
        <div className="h-full">
          <Link to="/market" className="block h-full group">
            <div className="p-4 sm:p-5 border-t-4 border-t-amber-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-amber-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                    {t('dashboard.kpi.mandi_rate_label', 'Market Rate:')}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                  ₹2,150/Qtl
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  ▲ +₹50 {t('dashboard.kpi.today', 'today')}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>
        </div>
      </motion.div>

      {/* ─── Quick Touch-Friendly Farming Tools (6 Balanced Cards) ─── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
            {t('dashboard.quick_tools.title', 'Quick Farming Tools')}
          </h3>
          <Link to="/more" className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
            {t('dashboard.quick_tools.see_all', 'See all tools')}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <div className="h-full">
            <Link to="/upload" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.leafDoctor} alt="Crop Leaf Diagnosis" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {t('dashboard.quick_tools.leaf_doctor', 'Leaf Doctor')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {t('dashboard.quick_tools.leaf_doctor_desc', 'Scan crop leaf for instant disease detection.')}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          <div className="h-full">
            <Link to="/assistant" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.agronomist} alt="Human Agronomist Advisory" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {t('dashboard.quick_tools.agronomist', 'AI Agronomist')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {t('dashboard.quick_tools.agronomist_desc', 'Ask farming advice in your voice or language.')}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          <div className="h-full">
            <Link to="/market" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.rice} alt="Agricultural Market Produce" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {t('dashboard.quick_tools.mandi_prices', 'Market')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {t('dashboard.quick_tools.mandi_prices_desc', 'Track daily live agricultural market rates.')}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          <div className="h-full">
            <Link to="/farm" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.farmField} alt="GPS Farm Boundary" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {t('dashboard.quick_tools.my_farm', 'My Farm')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {t('dashboard.quick_tools.my_farm_desc', 'View field GPS boundaries & crop setup.')}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* 🚜 Farm Machinery, Drone & Pump Rental */}
          <div className="h-full">
            <Link to="/equipment-booking" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-amber-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.tractorField} alt="Farm Machinery, Drone & Pump Rental" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {t('dashboard.quick_tools.machinery', isTe ? 'వ్యవసాయ యంత్రాలు & డ్రోన్లు' : 'Farm Machinery, Drone & Pump Rental')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {t('dashboard.quick_tools.machinery_desc', isTe ? 'ట్రాక్టర్లు, స్ప్రేయింగ్ డ్రోన్లు & పంపుల అద్దె.' : 'Book nearby tractors, spraying drones & pumps.')}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* 🎧 Help & Support Team */}
          <div className="h-full">
            <Link to="/support" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.supportTeam} alt="Help & Support Team" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {t('dashboard.quick_tools.support', isTe ? 'రైతు సహాయం & మద్దతు' : 'Help & Support Team')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {t('dashboard.quick_tools.support_desc', isTe ? '24×7 వాట్సాప్ సహాయం & కాల్‌బ్యాక్ సేవ.' : '24×7 WhatsApp desk & 15-min phone callback.')}
                  </p>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── Unified Field Intelligence (Weather, Safe Spray Window, Foliar Safety) ─── */}
      <motion.div variants={itemVariants} className="w-full max-w-full min-w-0">
        <WidgetErrorBoundary name="Field Intelligence">
          <FieldIntelligenceWidget farmId={farmId} lat={coordinates.lat} lon={coordinates.lon} />
        </WidgetErrorBoundary>
      </motion.div>

      {/* ─── Recent Crop Diagnoses History (Fills mobile layout with immediate value) ─── */}
      {stats.recent && stats.recent.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                {t('dashboard.recent_diagnoses.title', 'Recent Crop Diagnoses')}
              </h3>
            </div>
            <Link to="/history" className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
              {t('dashboard.recent_diagnoses.view_all', 'View all ({{total}})', { total: stats.total })}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.recent.slice(0, 3).map((scan, idx) => {
              const isHealthy = scan.prediction_status === 'healthy';
              return (
                <Card key={scan.id || idx} hover className="p-3.5 flex items-center justify-between gap-3 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                      isHealthy ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    }`}>
                      {isHealthy ? '🌿' : '🍂'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {translateCrop(scan.crop_name, i18n.language) || 'Crop'} • {translateDisease(scan.predicted_class || scan.disease_name, i18n.language) || (isHealthy ? t('dashboard.recent_diagnoses.healthy', 'Healthy Leaf') : t('dashboard.recent_diagnoses.diseased', 'Infection Detected'))}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold ${isHealthy ? 'text-emerald-500' : 'text-rose-400'}`}>
                          {isHealthy ? `100% ${t('dashboard.recent_diagnoses.healthy', 'Healthy')}` : `${Math.round((scan.confidence || scan.confidence_score || 0.95) * 100)}% ${t('dashboard.recent_diagnoses.confidence', 'Match')}`}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {scan.created_at ? new Date(scan.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link to="/history" className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DashboardPage;
