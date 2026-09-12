import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  UploadCloud, Thermometer, Droplets, Sprout, Sun, CloudRain, Battery, HardDrive, Wifi,
  Clock, AlertTriangle, CheckCircle2, ShieldAlert, ArrowRight, Activity, Zap, RefreshCw, Gauge, Wind,
  Settings, Eye, ChevronRight, TrendingUp, Cpu, Layers, Camera, ShieldCheck, MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useTranslation } from 'react-i18next';
import API from '../services/api';
import { Button, Card, Skeleton, Badge } from '../components/ui/index';
import { useToast } from '../components/ui/toast';
import { useHardwareMode } from '../hooks/useHardwareMode';
import SensorCard from '../components/dashboard/SensorCard';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import { useWebSocket } from '../context/WebSocketContext';

// Intelligence System Widgets
import { WeatherDashboard } from '../components/intelligence/WeatherDashboard';
import { IrrigationAdvisor } from '../components/intelligence/IrrigationAdvisor';
import { DiseaseRiskCard } from '../components/intelligence/DiseaseRiskCard';
import { translateCrop, translateStage, translateDisease } from '../utils/diseaseAdvisoryData';

const DashboardPage = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const { t, i18n } = useTranslation();
  const { hardwareMode } = useHardwareMode();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userRole = user?.role?.toLowerCase() || 'farmer';
    const isOutbreakSimEnabled = localStorage.getItem('sim_outbreak_active') !== 'false';

    if (userRole !== 'tester' || !isOutbreakSimEnabled) {
      return;
    }

    // Simulate district outbreak alerts for crop disease warnings
    const timer = setTimeout(() => {
      toast.warning(
        "🚨 District Outbreak Alert",
        "A neighboring farm (0.8km away) detected Tomato Late Blight. Review spray treatment schedules immediately.",
        { duration: 12000 }
      );
    }, 8000);
    return () => clearTimeout(timer);
  }, [toast, user]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    healthy: 0,
    diseased: 0,
    recent: [],
  });

  const [devices, setDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);

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
    }
  }, [user, navigate]);

  useEffect(() => {
    if (activeFarm && activeFarm.latitude && activeFarm.longitude) {
      setCoordinates({ lat: activeFarm.latitude, lon: activeFarm.longitude });
    }
  }, [activeFarm]);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const statsRes = await API.get('/api/history?limit=10');
      const list = statsRes.data.predictions || [];
      const total = statsRes.data.total || 0;
      let healthy = 0;
      let diseased = 0;
      
      list.forEach(item => {
        if (item.prediction_status === 'healthy') healthy++;
        else diseased++;
      });

      setStats({ total, healthy, diseased, recent: list.slice(0, 5) });

      const devicesRes = await API.get('/api/v1/devices/status');
      const deviceList = devicesRes.data || [];
      setDevices(deviceList);
      
      if (deviceList.length > 0) {
        const sorted = [...deviceList].sort((a, b) => {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (b.status === 'online' && a.status !== 'online') return 1;
          return (a.seconds_since_seen ?? 999999) - (b.seconds_since_seen ?? 999999);
        });
        const onlineDev = sorted[0];
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
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(false);
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
      {/* ─── Header Section: Farmer Friendly ─── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl" role="img" aria-label="crop">🌾</span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {activeFarm?.farm_name ? `${activeFarm.farm_name} ${t('dashboard.overview', 'Overview')}` : t('dashboard.my_farm_overview', 'My Farm Overview')}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-semibold">
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <MapPin className="w-3.5 h-3.5" />
                {farmLocationDisplay}
              </span>
              <span>•</span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">{currentDateFormatted}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button 
              onClick={handleManualRefresh}
              className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-600 dark:text-white/60 hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-xs"
              title={t('dashboard.refresh_btn', 'Refresh Dashboard Data')}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <Link to="/upload" className="flex-1 sm:flex-initial">
              <Button 
                variant="primary" 
                size="lg" 
                leftIcon={<Camera className="w-5 h-5" />} 
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/30 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm sm:text-base transition-all active:scale-[0.98]"
              >
                {t('dashboard.scan_crop_leaf', 'Scan Crop Leaf')}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── Daily Farm Status Banner (Friendly & Actionable) ─── */}
      <motion.div variants={itemVariants} className="col-span-12">
        <Card glass className="p-4 sm:p-5 border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0c1626]/90 shadow-sm rounded-3xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                {t('dashboard.namaste_farmer', 'Namaste, {{name}}! 👋', { name: user?.name || user?.username || 'Farmer' })}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                {t('dashboard.daily_actionable_summary', 'Today is 34°C & Sunny — Ideal conditions for field work and foliar spraying')}
              </p>
            </div>

            {/* 3 Status Badges (Green / Sky / Protected) */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-black shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                {t('dashboard.crops_healthy', 'Crops: Healthy')}
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 dark:bg-sky-500/15 border border-sky-300 dark:border-sky-500/30 text-sky-900 dark:text-sky-300 text-xs sm:text-sm font-black shadow-xs">
                <span>💧</span>
                {t('dashboard.soil_optimal', 'Soil: {{pct}}% (Optimal)', { pct: activeTelemetry?.soil_moisture ?? 45 })}
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/25 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-black shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {t('dashboard.disease_risk_low', 'Disease Risk: Low')}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ─── Essential Farmer KPIs (4 Spacious, High-Contrast Cards) ─── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Active Crop */}
        <Card glass className="p-4 sm:p-5 border border-slate-200 dark:border-emerald-500/30 bg-white dark:bg-[#08121f] rounded-2xl shadow-sm hover:border-emerald-500/60 transition-all flex flex-col justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              {t('dashboard.kpi.active_crop_label', 'Active Crop:')}
            </span>
            <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {cropName ? (translateCrop(cropName, i18n.language) || cropName) : (
                <Link to="/farm" className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                  <span>+ {t('dashboard.set_crop', 'Set Your Crop')}</span>
                </Link>
              )}
            </div>
          </div>
          {cropName ? (
            <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 mt-3">
              ({translateStage(growthStage, i18n.language)} {t('dashboard.kpi.stage', 'Stage')})
            </p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-3">
              {t('dashboard.configure_crop', 'Configure crop in My Farm')}
            </p>
          )}
        </Card>

        {/* KPI 2: Leaf Scans */}
        <Card glass className="p-4 sm:p-5 border border-slate-200 dark:border-emerald-500/30 bg-white dark:bg-[#08121f] rounded-2xl shadow-sm hover:border-emerald-500/60 transition-all flex flex-col justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              {t('dashboard.kpi.leaf_scans_label', 'Leaf Scans:')}
            </span>
            <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {stats.total}
            </div>
          </div>
          <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-3">
            ({stats.healthy} {t('dashboard.kpi.healthy', 'Healthy')} · {stats.diseased} {t('dashboard.kpi.treated', 'Treated')})
          </p>
        </Card>

        {/* KPI 3: Soil Water */}
        <Card glass className="p-4 sm:p-5 border border-slate-200 dark:border-emerald-500/30 bg-white dark:bg-[#08121f] rounded-2xl shadow-sm hover:border-emerald-500/60 transition-all flex flex-col justify-between">
          <div>
            <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              {t('dashboard.kpi.soil_water_label', 'Soil Water:')}
            </span>
            <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {activeTelemetry?.soil_moisture ?? 45}%
            </div>
          </div>
          <p className="text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-400 mt-3">
            ({(activeTelemetry?.soil_moisture ?? 45) > 50 ? t('dashboard.kpi.optimal', 'Optimal') : (activeTelemetry?.soil_moisture ?? 45) > 30 ? t('dashboard.kpi.adequate', 'Adequate') : t('dashboard.kpi.needs_water', 'Needs Water')})
          </p>
        </Card>

        {/* KPI 4: Mandi Rate */}
        <Link to="/market" className="block">
          <Card glass className="p-4 sm:p-5 border border-slate-200 dark:border-emerald-500/30 bg-white dark:bg-[#08121f] rounded-2xl shadow-sm hover:border-emerald-500/60 transition-all flex flex-col justify-between h-full group">
            <div>
              <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                {t('dashboard.kpi.mandi_rate_label', 'Mandi Rate:')}
              </span>
              <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                ₹2,150/Qtl
              </div>
            </div>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center justify-between">
              <span>(▲ +₹50 {t('dashboard.kpi.today', 'today')})</span>
              <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </p>
          </Card>
        </Link>
      </motion.div>

      {/* ─── Quick Touch-Friendly Farming Tools (4 Balanced Cards) ─── */}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link to="/upload" className="block group">
            <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📷</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
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

          <Link to="/assistant" className="block group">
            <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">💬</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
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

          <Link to="/market" className="block group">
            <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📈</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {t('dashboard.quick_tools.mandi_prices', 'Mandi Prices')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {t('dashboard.quick_tools.mandi_prices_desc', 'Track daily live agricultural mandi rates.')}
                </p>
              </div>
            </Card>
          </Link>

          <Link to="/farm" className="block group">
            <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🌾</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
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
      </motion.div>

      {/* ─── Hero Intelligence Blocks (Weather, Irrigation, Risks) ─── */}
      <motion.div variants={itemVariants} className="grid lg:grid-cols-12 gap-6 w-full max-w-full min-w-0">
        <div className="lg:col-span-7 space-y-6 flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <WidgetErrorBoundary name="Weather Intelligence">
            <div className="flex-1 w-full max-w-full min-w-0">
              <WeatherDashboard farmId={farmId} lat={coordinates.lat} lon={coordinates.lon} />
            </div>
          </WidgetErrorBoundary>
        </div>

        <div className="lg:col-span-5 space-y-6 flex flex-col w-full max-w-full min-w-0">
          <WidgetErrorBoundary name="Smart Irrigation Advisor">
            <IrrigationAdvisor farmId={farmId} cropName={cropName} growthStage={growthStage} farmSize={farmSize} />
          </WidgetErrorBoundary>
          
          <WidgetErrorBoundary name="Disease Risk Forecast">
            <DiseaseRiskCard farmId={farmId} cropName={cropName} />
          </WidgetErrorBoundary>
        </div>
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

      {/* ─── Live Telemetry Streams (Hardware Mode Only) ─── */}
      {hardwareMode && (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-black text-slate-800 dark:text-white/80 uppercase tracking-wider">
                {t('dashboard.telemetry_stream', 'Live Field Micro-Telemetry Streams')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {activeDevice?.status === 'online' ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t('dashboard.streaming_live', 'STREAMING LIVE')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-white/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  {t('dashboard.node_offline_msg', 'NODE OFFLINE — SHOWING ESTIMATED DATA')}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            <SensorCard 
              title={t('metrics.temperature', 'Temperature')} 
              value={activeTelemetry?.temperature != null ? activeTelemetry.temperature : '--'} 
              unit={activeTelemetry?.temperature != null ? '°C' : ''} 
              icon={Thermometer} 
              color="#f97316" 
              delay={0.05} 
            />
            <SensorCard 
              title={t('metrics.humidity', 'Humidity')} 
              value={activeTelemetry?.humidity != null ? activeTelemetry.humidity : '--'} 
              unit={activeTelemetry?.humidity != null ? '%' : ''} 
              icon={Droplets} 
              color="#0ea5e9" 
              delay={0.1} 
            />
            <SensorCard 
              title={t('metrics.soil_moisture', 'Soil Moisture')} 
              value={(activeTelemetry?.soil_moisture != null || activeTelemetry?.soil_percentage != null) ? (activeTelemetry.soil_moisture ?? activeTelemetry.soil_percentage) : '--'} 
              unit={(activeTelemetry?.soil_moisture != null || activeTelemetry?.soil_percentage != null) ? '%' : ''} 
              icon={Sprout} 
              color="#10b981" 
              delay={0.15} 
            />
            <SensorCard 
              title={t('metrics.light', 'Light Level')} 
              value={(activeTelemetry?.light_intensity != null || activeTelemetry?.light_lux != null) ? (activeTelemetry.light_intensity ?? activeTelemetry.light_lux) : '--'} 
              unit={(activeTelemetry?.light_intensity != null || activeTelemetry?.light_lux != null) ? 'lx' : ''} 
              icon={Sun} 
              color="#eab308" 
              delay={0.2} 
            />
            <SensorCard 
              title={t('metrics.rain', 'Rain Status')} 
              value={activeTelemetry?.rain_intensity != null ? activeTelemetry.rain_intensity : (activeTelemetry?.rain_detected != null ? (activeTelemetry.rain_detected ? 'Raining' : 'Clear') : (activeTelemetry?.rain_sensor != null ? ((activeTelemetry.rain_sensor && (activeTelemetry.rain_analog === undefined || activeTelemetry.rain_analog > 100)) ? 'Raining' : 'Clear') : '--'))} 
              unit="" 
              icon={CloudRain} 
              color="#3b82f6" 
              delay={0.25} 
            />
            <SensorCard 
              title={t('metrics.pressure', 'Pressure')} 
              value={activeTelemetry?.pressure != null ? activeTelemetry.pressure : '--'} 
              unit={activeTelemetry?.pressure != null ? 'hPa' : ''} 
              icon={Gauge} 
              color="#8b5cf6" 
              delay={0.3} 
            />
            <SensorCard 
              title={t('metrics.vpd', 'VPD Deficit')} 
              value={activeTelemetry?.vpd != null ? activeTelemetry.vpd : '--'} 
              unit={activeTelemetry?.vpd != null ? 'kPa' : ''} 
              icon={Wind} 
              color="#14b8a6" 
              delay={0.35} 
            />
            <SensorCard 
              title={t('metrics.battery', 'Battery')} 
              value={activeTelemetry?.battery_percentage != null ? activeTelemetry.battery_percentage : (activeTelemetry?.battery != null ? activeTelemetry.battery : '--')} 
              unit={activeTelemetry?.battery_percentage != null || activeTelemetry?.battery != null ? '%' : ''} 
              icon={Battery} 
              color="#22c55e" 
              delay={0.4} 
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DashboardPage;
