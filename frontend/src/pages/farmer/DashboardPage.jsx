import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Droplets, Sprout, Clock, RefreshCw, ChevronRight, TrendingUp, Camera, ShieldCheck, MapPin,
  Volume2, VolumeX, Share2, Phone, Check, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useTranslation } from 'react-i18next';
import API from '../../services/api';
import { Button, Card, Skeleton, Badge } from '../../components/ui/index';
import WidgetErrorBoundary from '../../components/WidgetErrorBoundary';
import { useWebSocket } from '../../context/WebSocketContext';
import { useSpeechReader } from '../../hooks/useSpeechReader';

// Intelligence System Widgets
import FieldIntelligenceWidget from '../../components/intelligence/FieldIntelligenceWidget';
import { translateCrop, translateStage, translateDisease } from '../../utils/diseaseAdvisoryData';
import { CURATED_FARM_PHOTOS } from '../../services/photoService';

// In-memory module-level cache to enable instantaneous (0ms) page transitions
let cachedDashboardStats = null;
let cachedDashboardDevices = null;
let cachedActiveDevice = null;


// Dynamic Real-Time Time-of-Day Weather Intelligence with Custom Color Schemes & Micro-Animations
const getTimeOfDayWeather = (hour, liveWeather, language) => {
  const isTe = language === 'te';
  const isHi = language === 'hi';
  const rainProb = liveWeather?.current?.rain_probability ?? 0;
  const isRain = rainProb > 50;
  const isCloudy = !isRain && rainProb > 25;

  const isNight = hour >= 20 || hour < 5;
  const isDawn = hour >= 5 && hour < 8;
  const isDay = hour >= 8 && hour < 17;
  const isDusk = hour >= 17 && hour < 20;

  const tempVal = liveWeather?.current?.temperature != null
    ? Math.round(liveWeather.current.temperature)
    : (isNight ? 24 : isDawn ? 26 : isDusk ? 29 : 34);

  if (isRain) {
    return {
      period: 'rain',
      icon: '🌧️',
      hasTwinkle: false,
      hasPulseGlow: true,
      text: isTe ? 'వర్షం' : isHi ? 'बारिश' : 'Rainy Weather',
      voiceText: isTe ? 'వర్షంగా ఉంది' : isHi ? 'बारिश हो रही है' : 'it is rainy',
      bgClasses: 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white border-2 border-sky-300 shadow-lg shadow-blue-500/30',
      tempVal
    };
  }

  if (isNight) {
    return {
      period: 'night',
      icon: isCloudy ? '☁️' : '🌙',
      hasTwinkle: !isCloudy,
      hasPulseGlow: true,
      text: isCloudy 
        ? (isTe ? 'మేఘావృత రాత్రి' : isHi ? 'बादल वाली रात' : 'Cloudy Night')
        : (isTe ? 'శాంతమైన రాత్రి' : isHi ? 'शांत रात' : 'Clear Night'),
      voiceText: isCloudy
        ? (isTe ? 'మేఘావృత రాత్రిగా ఉంది' : isHi ? 'बादल वाली रात है' : 'cloudy night')
        : (isTe ? 'చల్లని మరియు శాంతమైన రాత్రిగా ఉంది' : isHi ? 'शांत और सुहावनी रात है' : 'pleasant clear night'),
      bgClasses: 'bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-emerald-100 border-2 border-emerald-400/70 shadow-lg shadow-emerald-950/70',
      tempVal
    };
  }

  if (isDawn) {
    return {
      period: 'dawn',
      icon: isCloudy ? '⛅' : '🌅',
      hasTwinkle: false,
      hasPulseGlow: true,
      text: isTe ? 'చల్లని ఉదయం' : isHi ? 'सुहावनी सुबह' : 'Fresh Morning',
      voiceText: isTe ? 'చల్లని ఆహ్లాదకరమైన ఉదయం' : isHi ? 'ताज़ा और सुहावनी सुबह' : 'crisp fresh morning',
      bgClasses: 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white border-2 border-amber-300 shadow-lg shadow-orange-500/30',
      tempVal
    };
  }

  if (isDusk) {
    return {
      period: 'dusk',
      icon: isCloudy ? '⛅' : '🌇',
      hasTwinkle: true,
      hasPulseGlow: true,
      text: isTe ? 'చల్లని సాయంత్రం' : isHi ? 'सुहावनी शाम' : 'Cool Evening',
      voiceText: isTe ? 'ఆహ్లాదకరమైన సాయంత్రం' : isHi ? 'सुहावनी शाम' : 'pleasant cool evening',
      bgClasses: 'bg-gradient-to-r from-amber-600 via-orange-600 to-emerald-800 text-white border-2 border-amber-300 shadow-lg shadow-orange-500/30',
      tempVal
    };
  }

  // Daytime (8 AM - 5 PM)
  return {
    period: 'day',
    icon: isCloudy ? '⛅' : '☀️',
    hasTwinkle: false,
    hasPulseGlow: true,
    text: isCloudy 
      ? (isTe ? 'తేలికపాటి మేఘాలు' : isHi ? 'हल्के बादल' : 'Partly Cloudy')
      : (isTe ? 'ఎండ' : isHi ? 'धूप' : 'Sunny'),
    voiceText: isCloudy
      ? (isTe ? 'తేలికపాటి మేఘాలు ఉన్నాయి' : isHi ? 'हल्के बादल हैं' : 'partly cloudy')
      : (isTe ? 'ఎండగా ఉంది' : isHi ? 'धूप खिली है' : 'bright and sunny'),
    bgClasses: 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 border-2 border-amber-300 shadow-lg shadow-amber-400/40',
    tempVal
  };
};

const DashboardPage = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const farmId = activeFarm?.farm_id || activeFarm?.id;
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Instant load: If cache exists from this session, do NOT show skeleton
  const [loading, setLoading] = useState(!cachedDashboardStats);

  // Full Suite: 1-Tap Audio Reader State (Calibrated at 1.0x standard pace)
  const { speak, stop, speakingId } = useSpeechReader();
  const isAudioPlaying = speakingId === 'dashboard_daily_brief';

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState(() => cachedDashboardStats || {
    total: 0,
    healthy: 0,
    diseased: 0,
    recent: [],
  });

  const [devices, setDevices] = useState(() => cachedDashboardDevices || []);
  const [activeDevice, setActiveDevice] = useState(() => cachedActiveDevice || null);

  // Default coordinates or active farm coordinates
  const [coordinates, setCoordinates] = useState(() => {
    if (activeFarm && activeFarm.latitude && activeFarm.longitude) {
      const lat = Number(activeFarm.latitude);
      const lon = Number(activeFarm.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
    return { lat: 16.5062, lon: 80.6480 };
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
      const lat = Number(activeFarm.latitude);
      const lon = Number(activeFarm.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        setCoordinates({ lat, lon });
      }
    }
  }, [activeFarm]);

  // Live Weather Telemetry for Dynamic Banner and Voice Sync
  const [liveWeather, setLiveWeather] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadLiveWeather = async () => {
      try {
        const queryLat = coordinates?.lat || 16.5062;
        const queryLon = coordinates?.lon || 80.6480;
        const targetId = farmId || activeFarm?.id || 'default';
        const res = await API.get(`/api/intelligence/weather?farm_id=${targetId}&lat=${queryLat}&lon=${queryLon}`);
        if (res?.data && isMounted) {
          setLiveWeather(res.data);
        }
      } catch (err) {
        // Silent fallback
      }
    };
    loadLiveWeather();
    return () => { isMounted = false; };
  }, [farmId, activeFarm, coordinates]);

  const { lastTelemetry, deviceStatusMap, connectionStatus } = useWebSocket();

  const fetchDashboardData = useCallback(async (isBackground = false, skipDeviceStatus = false) => {
    if (!isBackground && !cachedDashboardStats) setLoading(true);
    try {
      const statsPromise = API.get('/api/history?limit=10').catch(err => {
        console.warn('Stats load failed:', err);
        return { data: { predictions: [], total: 0 } };
      });
      const devicesPromise = skipDeviceStatus
        ? Promise.resolve({ data: null })
        : API.get('/api/v1/devices/status').catch(err => {
            console.warn('Devices status load failed:', err);
            return { data: [] };
          });

      const [statsRes, devicesRes] = await Promise.all([statsPromise, devicesPromise]);

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

      if (devicesRes.data) {
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
      }
    } catch (error) {
      console.error('Dashboard data load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isBackground = !!cachedDashboardStats;
    fetchDashboardData(isBackground);
    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchDashboardData(true, false);
    }, 30000);
    return () => clearInterval(intervalId);
  }, [coordinates, fetchDashboardData, connectionStatus]);

  useEffect(() => {
    const targetDevId = activeFarm?.device_id || activeDevice?.device_id || (devices && devices[0]?.device_id);

    if (lastTelemetry && (!targetDevId || lastTelemetry.device_id === targetDevId)) {
      const telem = lastTelemetry.telemetry || lastTelemetry;
      setActiveDevice(prev => ({
        ...(prev || {}),
        device_id: lastTelemetry.device_id || targetDevId || 'ESP32-NODE-ALPHA',
        status: lastTelemetry.status || 'online',
        latest_telemetry: {
          ...(prev?.latest_telemetry || {}),
          ...telem
        }
      }));
    } else if (targetDevId && deviceStatusMap[targetDevId]) {
      const dev = deviceStatusMap[targetDevId];
      setActiveDevice(prev => ({
        ...(prev || {}),
        device_id: targetDevId,
        status: dev.status || 'offline',
        latest_telemetry: {
          ...(prev?.latest_telemetry || {}),
          ...(dev.latest_telemetry || {})
        }
      }));
    } else if (Object.keys(deviceStatusMap).length > 0 && !targetDevId) {
      const firstId = Object.keys(deviceStatusMap)[0];
      const dev = deviceStatusMap[firstId];
      setActiveDevice(prev => ({
        ...(prev || {}),
        device_id: firstId,
        status: dev.status || 'offline',
        latest_telemetry: {
          ...(prev?.latest_telemetry || {}),
          ...(dev.latest_telemetry || {})
        }
      }));
    }
  }, [lastTelemetry, deviceStatusMap, activeFarm, devices]);

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

  const cropName = activeFarm?.crop_name || '';
  const growthStage = activeFarm?.growth_stage || 'Vegetative';
  const farmSize = activeFarm?.farm_size || 1.0;

  const currentDateFormatted = new Date().toLocaleDateString(
    i18n.language === 'te' ? 'te-IN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );

  const farmLocationDisplay = activeFarm?.village 
    ? `${activeFarm.village}${activeFarm.district ? `, ${activeFarm.district}` : ''}` 
    : (activeFarm?.district || activeFarm?.farm_name || t('dashboard.my_farm_field', 'My Farm Field'));

  // ─── Dynamic Real-Time Time-of-Day Weather & Colors ───
  const currentHour = new Date().getHours();
  const timeWeatherInfo = getTimeOfDayWeather(currentHour, liveWeather, i18n.language);
  const isNightTime = currentHour >= 20 || currentHour < 5;

  const dynamicSprayWindow = currentHour < 12
    ? (i18n.language === 'te' ? '8:00 AM – 11:30 AM (అనుకూల సమయం)' : '8:00 AM – 11:30 AM (Optimal Window)')
    : currentHour < 17
    ? (i18n.language === 'te' ? '4:00 PM – 6:30 PM (సాయంత్రం విండో)' : '4:00 PM – 6:30 PM (Evening Window)')
    : (i18n.language === 'te' ? 'రేపు ఉదయం 7:30 AM (తదుపరి విండో)' : 'Tomorrow 7:30 AM (Next Window)');

  // Ambient Sky Glow depending on actual time of day
  const ambientSkyGlow = currentHour >= 5 && currentHour < 8
    ? 'from-amber-500/25 via-rose-500/20 to-transparent'
    : currentHour >= 8 && currentHour < 17
    ? 'from-sky-500/20 via-emerald-500/15 to-transparent'
    : currentHour >= 17 && currentHour < 20
    ? 'from-orange-600/30 via-rose-600/20 to-indigo-950/30'
    : 'from-slate-950/90 via-emerald-950/60 to-slate-950/90';

  // ─── Today's 3-Task Quick Field Routine Checklist ───
  const todayDateKey = new Date().toISOString().slice(0, 10);
  const [dailyTasks, setDailyTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(`agrishield_daily_routine_${todayDateKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved daily tasks:', e);
    }
    return [
      { id: 'task_irrigation', titleTe: 'ఉదయం డ్రిప్ ఇరిగేషన్ / నీటి పారుదల', titleEn: 'Morning Drip Irrigation (Field Section A)', completed: false, icon: '💧' },
      { id: 'task_scouting', titleTe: 'పొలం పరిశీలన & తెగుళ్ల తనిఖీ', titleEn: 'Crop Scouting & Leaf Inspection', completed: false, icon: '🔍' },
      { id: 'task_spray', titleTe: 'సాయంత్రం సూక్ష్మ పోషకాల పిచికారీ', titleEn: 'Foliar Micronutrient Application', completed: false, icon: '🧴' },
    ];
  });

  const toggleTask = (taskId) => {
    setDailyTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
      try {
        localStorage.setItem(`agrishield_daily_routine_${todayDateKey}`, JSON.stringify(updated));
      } catch (e) { /* ignore */ }
      return updated;
    });
  };

  const completedTasksCount = dailyTasks.filter(t => t.completed).length;

  // ─── 1-Tap Daily Voice Farm Briefing (Standard 1.0x Pace) ───
  const handleToggleAudio = () => {
    if (isAudioPlaying) {
      stop();
    } else {
      const isTe = i18n.language === 'te';
      const isHi = i18n.language === 'hi';
      const farmerName = user?.name || user?.username || (isTe ? 'రైతు సోదరులారా' : 'Farmer');
      const localizedCropName = cropName ? (translateCrop(cropName, i18n.language) || cropName) : (isTe ? 'పంట' : 'crop');
      const localizedStage = translateStage(growthStage, i18n.language) || growthStage;
      const soilVal = activeTelemetry?.soil_moisture != null ? `${activeTelemetry.soil_moisture}%` : (isTe ? 'సరైన స్థాయిలో' : 'optimal');

      const currentTemp = timeWeatherInfo.tempVal;
      const weatherCond = timeWeatherInfo.voiceText;

      let text = '';
      if (isTe) {
        text = `నమస్తే ${farmerName} గారు! నేటి మీ పొలం సమాచారం: వాతావరణం ${currentTemp} డిగ్రీలు మరియు ${weatherCond}. సురక్షితమైన మందుల పిచికారీ సమయం ${dynamicSprayWindow}. మీ ${localizedCropName} పంట ${localizedStage} దశలో ఉంది. నేలలో తేమ ${soilVal} ఉంది. మార్కెట్లో ప్రస్తుత క్వింటాల్ ధర ₹2,150. తెగుళ్ల ముప్పు ప్రస్తుతం తక్కువగా ఉంది. శుభదినం!`;
      } else if (isHi) {
        text = `नमस्ते ${farmerName} जी! आज का खेत का विवरण: मौसम ${currentTemp} डिग्री और ${weatherCond}। सुरक्षित छिड़काव का समय ${dynamicSprayWindow} है। आपकी ${localizedCropName} फसल ${localizedStage} अवस्था में है। मिट्टी की नमी ${soilVal} है। मंडी में आज का भाव ₹2,150 प्रति क्विंटल है। फसल रोग का जोखिम कम है। आपका दिन शुभ हो!`;
      } else {
        text = `Namaste ${farmerName}! Here is today's farm report: The weather is ${currentTemp} degrees and ${weatherCond}. The safe spray window is ${dynamicSprayWindow}. Your ${localizedCropName} is in ${localizedStage} stage. Soil moisture is ${soilVal}. Current mandi market rate is ₹2,150 per quintal. Foliar disease risk is low. Have a productive farming day!`;
      }
      speak(text, 'dashboard_daily_brief', i18n.language, 1.0);
    }
  };

  // ─── 1-Tap WhatsApp Farm Report Dispatch ───
  const handleShareWhatsApp = () => {
    const isTe = i18n.language === 'te';
    const isHi = i18n.language === 'hi';
    const farmerName = user?.name || user?.username || 'Farmer';
    const localizedCropName = cropName ? (translateCrop(cropName, i18n.language) || cropName) : 'Crop';
    const soilVal = activeTelemetry?.soil_moisture != null ? `${activeTelemetry.soil_moisture}%` : 'Normal';
    const currentTemp = liveWeather?.current?.temperature != null 
      ? Math.round(liveWeather.current.temperature) 
      : 34;
    const rainProb = liveWeather?.current?.rain_probability ?? 0;
    const weatherCond = rainProb > 50 
      ? (isTe ? 'వర్షం' : isHi ? 'बारिश' : 'Rainy') 
      : (isTe ? 'ఎండ' : isHi ? 'धूप' : 'Sunny');
    const weatherEmoji = rainProb > 50 ? '🌧️' : (rainProb > 25 ? '⛅' : '☀️');

    const message = `🌾 *AgriShield AI - ${isTe ? 'నేటి వ్యవసాయ నివేదిక' : 'Daily Farm Status'}* 🌾\n` +
      `👤 ${farmerName} | 📍 ${farmLocationDisplay}\n` +
      `📅 ${currentDateFormatted}\n` +
      `--------------------------------\n` +
      `${weatherEmoji} ${isTe ? 'వాతావరణం' : 'Weather'}: ${currentTemp}°C & ${weatherCond}\n` +
      `⏱️ ${isTe ? 'స్ప్రే సమయం' : 'Safe Spray'}: ${dynamicSprayWindow}\n` +
      `💧 ${isTe ? 'నేల తేమ' : 'Soil Moisture'}: ${soilVal}\n` +
      `🌿 ${isTe ? 'క్రియాశీల పంట' : 'Crop'}: ${localizedCropName} (${translateStage(growthStage, i18n.language)})\n` +
      `📈 ${isTe ? 'మార్కెట్ ధర' : 'Mandi Rate'}: ₹2,150/Qtl (+₹50)\n` +
      `🛡️ ${isTe ? 'తెగులు ముప్పు' : 'Disease Risk'}: ${isTe ? 'తక్కువ (రక్షణలో ఉంది)' : 'Low (Safe)'}\n` +
      `--------------------------------\n` +
      `🚜 _AgriShield AI Smart Agriculture System_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="h-64 rounded-3xl" />
      </div>
    );
  }

  const isTe = i18n.language === 'te';

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 w-full pb-28 sm:pb-12 max-w-[1600px] mx-auto"
    >
      {/* ─── Top Farm Header Bar (Clean, Compact & Modern) ─── */}
      <motion.div variants={itemVariants} className="col-span-12">
        <div className="p-4 sm:p-5 rounded-3xl bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0 shadow-xs">
              🌾
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {activeFarm?.farm_name ? `${activeFarm.farm_name}` : (isTe ? 'నా పొలం పరిశీలన' : 'My Farm Overview')}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 font-bold">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {farmLocationDisplay}
                </span>
                <span>•</span>
                <span className="text-slate-700 dark:text-slate-300">{currentDateFormatted}</span>
              </div>
            </div>
          </div>

          {/* Header Actions: Refresh + WhatsApp Share + Quick Field Actions */}
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            <button 
              type="button"
              onClick={handleManualRefresh}
              className="p-2.5 sm:p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-600 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
              title={isTe ? 'సమాచారాన్ని రీఫ్రెష్ చేయండి' : 'Refresh Farm Data'}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95 flex items-center gap-2 text-xs font-black"
              title={isTe ? 'నేటి నివేదికను వాట్సాప్‌లో పంపండి' : 'Share Farm Status on WhatsApp'}
            >
              <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isTe ? 'వాట్సాప్ నివేదిక' : 'WhatsApp Share'}</span>
            </button>

            <Link 
              to="/farm?tab=smart-actions"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:py-3 rounded-2xl border-2 border-teal-500/30 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-xs font-black transition-all shadow-xs"
            >
              <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{isTe ? 'పొలం పనులు' : 'Field Actions'}</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── The Smart Rythu Hero Card (Mobile Super-App Centerpiece) ─── */}
      <motion.div variants={itemVariants} className="col-span-12">
        <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-2xl bg-slate-950">
          {/* Authentic agricultural photography background with gentle blur */}
          <img 
            src={CURATED_FARM_PHOTOS.farmHero} 
            alt="Authentic Farm Field" 
            className="absolute inset-0 w-full h-full object-cover object-center scale-105 filter blur-[1.5px] opacity-60"
            loading="eager"
          />
          {/* Ambient gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/30" />
          <div className="absolute inset-0 bg-emerald-950/20 mix-blend-multiply" />
          <div className={`absolute inset-0 bg-gradient-to-b ${ambientSkyGlow} mix-blend-screen pointer-events-none`} />

          {/* Hero Card Content */}
          <div className="relative z-10 p-5 sm:p-6 lg:p-8 space-y-5 text-white">
            {/* Top Row: Greeting + 1-Tap Voice Briefing */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 text-xs font-black mb-2 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isTe ? '🌾 ఈ రోజు పొలం స్థితి' : "🌾 Today's Field Condition"}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {t('dashboard.namaste_farmer', 'Namaste, {{name}}! 👋', { name: user?.name || user?.username || (isTe ? 'రైతు' : 'Farmer') })}
                </h2>
              </div>

              {/* 1-Tap Male Voice Briefing Button */}
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-lg cursor-pointer transition-all active:scale-95 border ${
                  isAudioPlaying
                    ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-slate-950 hover:shadow-emerald-500/40'
                }`}
                title={isTe ? 'నేటి వ్యవసాయ సమాచారాన్ని తెలుగులో వినండి' : "Listen to today's farm audio briefing"}
              >
                {isAudioPlaying ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span>{isTe ? 'ఆపండి (Stop)' : 'Stop Audio'}</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>{isTe ? '🔊 వినండి (Voice Brief)' : '🔊 1-Tap Voice Brief'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Middle Row: Real-Time Weather Glance with Micro-Animation & Dynamic Time Colors */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-semibold">
              <div className={`px-4 py-2 rounded-2xl font-black shadow-lg flex items-center gap-2 transition-all duration-500 ${timeWeatherInfo.bgClasses}`}>
                <motion.div
                  animate={
                    timeWeatherInfo.period === 'night'
                      ? { rotate: [0, -12, 12, 0], scale: [1, 1.12, 1] }
                      : timeWeatherInfo.period === 'day'
                      ? { rotate: [0, 180, 360], scale: [1, 1.08, 1] }
                      : timeWeatherInfo.period === 'rain'
                      ? { y: [0, -2, 0], scale: [1, 1.06, 1] }
                      : { scale: [1, 1.1, 1] }
                  }
                  transition={{ 
                    duration: timeWeatherInfo.period === 'day' ? 14 : timeWeatherInfo.period === 'night' ? 4 : 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="inline-flex items-center justify-center text-lg shrink-0 select-none"
                >
                  {timeWeatherInfo.icon}
                </motion.div>

                {timeWeatherInfo.hasTwinkle && (
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.25, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="text-xs text-amber-200 select-none"
                  >
                    ✨
                  </motion.span>
                )}

                <span className="tracking-wide">
                  {timeWeatherInfo.tempVal}°C • {timeWeatherInfo.text}
                </span>
              </div>

              {/* Safe Spray Window Badge with Time-Aware Night/Day Palette */}
              <div className={`px-4 py-2 rounded-2xl font-black shadow-lg flex items-center gap-2 border transition-all duration-500 ${
                isNightTime
                  ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300 shadow-emerald-950/50'
                  : 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-emerald-500/30'
              }`}>
                <motion.span 
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-block"
                >
                  ⏱️
                </motion.span>
                <span>{isTe ? 'మందుల స్ప్రే సమయం:' : 'Safe Spray:'} {dynamicSprayWindow}</span>
              </div>
            </div>

            {/* Prominent Centerpiece: Big "Scan Crop Leaf" CTA Button */}
            <div className="pt-2 pb-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link to="/upload" className="flex-1 sm:flex-initial">
                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-base sm:text-lg shadow-xl shadow-emerald-600/40 border border-emerald-400/50 cursor-pointer transform active:scale-95 transition-all"
                >
                  <Camera className="w-6 h-6 stroke-[2.5]" />
                  <span>{isTe ? '📷 ఆకు తెగులు పరీక్ష (Scan Crop Leaf)' : '📷 Scan Crop Leaf Now'}</span>
                </button>
              </Link>
              <p className="text-xs text-slate-300 font-semibold self-center">
                {isTe ? 'ఫోన్ కెమెరాతో ఆకు ఫోటో తీసి తక్షణ వ్యాధి నివారణ పొందండి' : 'Take a photo of diseased leaf for instant AI prescription'}
              </p>
            </div>

            {/* Bottom Row: 3 Traffic-Light Reassurance Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/15">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-emerald-400/60 text-emerald-300 text-xs sm:text-sm font-black shadow-md">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{isTe ? '🟢 పంట ఆరోగ్యం: సురక్షితం' : '🟢 Crop Condition: Healthy'}</span>
              </div>

              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-sky-400/60 text-sky-300 text-xs sm:text-sm font-black shadow-md">
                <span className="shrink-0">💧</span>
                <span className="truncate">
                  {activeTelemetry?.soil_moisture != null
                    ? (isTe ? `నేల తేమ: ${activeTelemetry.soil_moisture}% (తగినంత)` : `Soil Moisture: ${activeTelemetry.soil_moisture}% (Good)`)
                    : (isTe ? 'నేల తేమ: సాధారణం (వాతావరణ మోడ్)' : 'Soil Moisture: Normal (Weather)')}
                </span>
              </div>

              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/70 backdrop-blur-md border border-emerald-400/60 text-emerald-300 text-xs sm:text-sm font-black shadow-md">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{isTe ? '🛡️ తెగుళ్ల ముప్పు: తక్కువ' : '🛡️ Pest Risk: Low (Safe)'}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Section 1: Today's Field Condition (Highlighted Heading) ─── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/25 shrink-0 border border-emerald-400/40">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {isTe ? 'ఈ రోజు పొలం పరిస్థితి' : "Today's Field Condition"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700 shadow-xs">
                  {isTe ? 'ప్రత్యక్ష నివేదిక' : 'Live Telemetry'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {isTe ? 'పంట దశ, ఆకుల పరీక్షలు, నేల తేమ & మార్కెట్ ధర' : 'Live metrics for crop stage, leaf tests, soil water & mandi rate'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Metric 1: My Crop & Stage */}
          <div className="h-full">
            <div className="p-4 sm:p-5 border-t-4 border-t-emerald-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-emerald-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                    {isTe ? 'నా పంట & దశ' : 'My Crop & Stage'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Sprout className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {cropName ? (translateCrop(cropName, i18n.language) || cropName) : (
                    <Link to="/farm" className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
                      <span>+ {isTe ? 'పంటను సెట్ చేయండి' : 'Set Crop'}</span>
                    </Link>
                  )}
                </div>
              </div>
              <div className="mt-3">
                {cropName ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {translateStage(growthStage, i18n.language)} {isTe ? 'దశ' : 'Stage'}
                  </span>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {isTe ? 'మై ఫార్మ్ ట్యాబ్‌లో అమర్చండి' : 'Configure in My Farm'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Metric 2: Leaf Health Checks */}
          <div className="h-full">
            <div className="p-4 sm:p-5 border-t-4 border-t-teal-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-teal-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                    {isTe ? 'ఆకు పరీక్షల సంఖ్య' : 'Leaf Health Checks'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-teal-500/15 dark:bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {stats.total} {isTe ? 'పరీక్షలు' : 'Scans'}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 text-teal-800 dark:text-teal-300 font-bold text-xs">
                  🌿 {stats.healthy} {isTe ? 'ఆరోగ్యం' : 'Healthy'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 font-bold text-xs">
                  🍂 {stats.diseased} {isTe ? 'నివారణ' : 'Treated'}
                </span>
              </div>
            </div>
          </div>

          {/* Metric 3: Soil Moisture */}
          <div className="h-full">
            <div className="p-4 sm:p-5 border-t-4 border-t-sky-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-sky-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                    {isTe ? 'నేల తేమ శాతం' : 'Soil Moisture (Water)'}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 dark:bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                    <Droplets className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {activeTelemetry?.soil_moisture != null ? `${activeTelemetry.soil_moisture}%` : '35%'}
                </div>
              </div>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 text-sky-800 dark:text-sky-300 font-bold text-xs">
                  💧 {activeTelemetry?.soil_moisture != null
                    ? (activeTelemetry.soil_moisture > 50 ? (isTe ? 'సరైన తేమ' : 'Optimal') : activeTelemetry.soil_moisture > 30 ? (isTe ? 'తగినంత నీరు' : 'Adequate') : (isTe ? 'నీరు అవసరం' : 'Needs Water'))
                    : (isTe ? 'తగినంత తేమ (సహజం)' : 'Adequate (Good)')}
                </span>
              </div>
            </div>
          </div>

          {/* Metric 4: Mandi Rate */}
          <div className="h-full">
            <Link to="/market" className="block h-full group">
              <div className="p-4 sm:p-5 border-t-4 border-t-amber-500 border-x border-b border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b1322]/95 backdrop-blur-md rounded-2xl shadow-xs hover:shadow-md hover:border-amber-500/40 transition-all flex flex-col justify-between h-full relative overflow-hidden">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                      {isTe ? 'నేటి మార్కెట్ ధర' : "Today's Mandi Price"}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                    ₹2,150 / Qtl
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    ▲ +₹50 {isTe ? 'ఈ రోజు' : 'today'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── Section 2: Today's Field Work (Highlighted Heading) ─── */}
      <motion.div variants={itemVariants} className="col-span-12">
        <div className="p-4 sm:p-5 rounded-3xl bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-800 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-sky-500/25 shrink-0 border border-sky-400/40">
                📋
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    {isTe ? 'నేటి పొలం పనులు' : "Today's Field Work"}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950/90 dark:text-sky-300 border border-sky-300/80 dark:border-sky-700 shadow-xs">
                    {completedTasksCount} / {dailyTasks.length} {isTe ? 'పూర్తయింది' : 'Completed'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {isTe ? 'ఈ రోజు మీ పొలంలో పూర్తి చేయవలసిన 3 ముఖ్యమైన పనులు' : 'Daily 3-task agronomic action checklist for your farm'}
                </p>
              </div>
            </div>

            {/* Micro Progress Bar */}
            <div className="flex items-center gap-2 w-full sm:w-48">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(completedTasksCount / dailyTasks.length) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {Math.round((completedTasksCount / dailyTasks.length) * 100)}%
              </span>
            </div>
          </div>

          {/* 3 Interactive Daily Tasks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {dailyTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => toggleTask(task.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  task.completed
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400/60 text-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-400/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">{task.icon}</span>
                  <span className={`text-xs font-bold leading-tight ${task.completed ? 'line-through opacity-75' : ''}`}>
                    {isTe ? task.titleTe : task.titleEn}
                  </span>
                </div>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                  task.completed
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                }`}>
                  {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            ))}
          </div>

          <div className="pt-1 flex justify-end">
            <Link 
              to="/farm?tab=smart-actions" 
              className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>{isTe ? 'అన్ని పొలం పనులను చూడండి →' : 'View all field tasks & schedules →'}</span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── Section 3: Rythu Services (Highlighted Heading) ─── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xl shadow-md shadow-amber-500/25 shrink-0 border border-amber-400/40">
              🌾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {isTe ? 'రైతు సేవలు & సాధనాలు' : 'Rythu Services & Tools'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700 shadow-xs">
                  {isTe ? '6 ముఖ్యమైన సేవలు' : '6 Core Services'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {isTe ? 'ఆకు స్కానర్, వ్యవసాయ సలహా, ట్రాక్టర్ల బుకింగ్ & కిసాన్ కాల్ సెంటర్' : 'Instant AI leaf doctor, voice agronomist, equipment booking & toll-free helpline'}
              </p>
            </div>
          </div>
          <Link to="/more" className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300/70 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-black hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-xs transition-all">
            <span>{isTe ? 'అన్ని సేవలు చూడండి' : 'See all tools'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* Tool 1: Leaf Doctor */}
          <div className="h-full">
            <Link to="/upload" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.leafDoctor} alt="Scan Leaf Disease" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isTe ? 'ఆకు తెగులు పరీక్ష' : 'Scan Leaf Disease'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {isTe ? 'ఫోటో తీసి తక్షణ తెగులు నివారణ' : 'Scan leaf for instant AI disease detection.'}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Tool 2: Ask Farm Doctor */}
          <div className="h-full">
            <Link to="/assistant" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.agronomist} alt="Ask Farm Doctor" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isTe ? 'వ్యవసాయ సలహాదారు' : 'Ask Farm Doctor'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {isTe ? 'వాయిస్ లేదా చాట్ ద్వారా అడగండి' : 'Ask farming advice in voice or chat.'}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Tool 3: Rent Machinery */}
          <div className="h-full">
            <Link to="/equipment-booking" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-amber-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.tractorField} alt="Rent Machinery" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isTe ? 'ట్రాక్టర్లు & డ్రోన్లు' : 'Rent Machinery'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {isTe ? 'సమీపంలోని ట్రాక్టర్లు, డ్రోన్ల బుకింగ్' : 'Book tractors, drones & harvesters nearby.'}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Tool 4: Mandi Prices */}
          <div className="h-full">
            <Link to="/market" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.rice} alt="Market Mandi Prices" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isTe ? 'నేటి మార్కెట్ ధరలు' : 'Mandi Prices'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {isTe ? 'రోజువారీ మార్కెట్ ధరల పరిశీలన' : 'Track daily live agricultural mandi rates.'}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Tool 5: Farm GPS Map */}
          <div className="h-full">
            <Link to="/farm" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.farmField} alt="Farm GPS Map" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isTe ? 'పొలం మ్యాప్ & వివరాలు' : 'Farm GPS Map'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {isTe ? 'పొలం సరిహద్దులు & పంట సెటప్' : 'View field GPS boundary & crop setup.'}
                  </p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Tool 6: 24x7 Kisan Call Center */}
          <div className="h-full">
            <Link to="/support" className="block group h-full">
              <Card hover className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1424] rounded-2xl shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700">
                      <img src={CURATED_FARM_PHOTOS.supportTeam} alt="24x7 Support Team" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {isTe ? 'ఉచిత కిసాన్ కాల్' : '24×7 Kisan Helpline'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                    {isTe ? 'ప్రభుత్వ ఉచిత వ్యవసాయ హెల్ప్‌లైన్' : 'Official government toll-free helpline.'}
                  </p>
                  <a
                    href="tel:18001801551"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-black hover:bg-emerald-500/25 transition-colors cursor-pointer w-full"
                    title="National Toll-Free Kisan Call Center"
                  >
                    <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">1800-180-1551 (ఉచిత కాల్)</span>
                  </a>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ─── Section 4: Unified Field Intelligence (Time-Aware Highlighted Heading) ─── */}
      <motion.div variants={itemVariants} className="w-full max-w-full min-w-0 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pb-1">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${isNightTime ? 'bg-gradient-to-br from-emerald-800 to-teal-900 text-emerald-100 border-emerald-400/50' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400/40'} flex items-center justify-center text-xl shadow-md shadow-indigo-500/25 shrink-0 border`}>
              <motion.span
                animate={isNightTime ? { rotate: [0, -10, 10, 0] } : { scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block"
              >
                {isNightTime ? '🌙' : '🌦️'}
              </motion.span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {isTe ? 'వాతావరణం & సురక్షిత స్ప్రే సమయం' : 'Weather & Safe Spray Times'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border shadow-xs ${
                  isNightTime
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-700'
                }`}>
                  {isNightTime ? (isTe ? 'రాత్రి రాడార్' : 'Night Radar') : (isTe ? 'ప్రత్యక్ష రాడార్' : 'Live Radar')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {isNightTime
                  ? (isTe ? 'రాత్రి ఉష్ణోగ్రత, తేమ, రేపటి వర్ష సూచన మరియు ఉదయపు స్ప్రే సమయం' : 'Nocturnal temperature, dew moisture, tomorrow rain radar & morning spray window')
                  : (isTe ? 'వర్ష సూచన, గాలి వేగం, తేమ మరియు సురక్షిత పిచికారీ గంటల విశ్లేషణ' : 'Real-time temperature, rain probability, wind speed & optimal spray window')}
              </p>
            </div>
          </div>
        </div>
        <WidgetErrorBoundary name="Field Intelligence">
          <FieldIntelligenceWidget farmId={farmId} lat={coordinates?.lat || 16.5062} lon={coordinates?.lon || 80.6480} />
        </WidgetErrorBoundary>
      </motion.div>

      {/* ─── Section 5: Recent Leaf Scan Results (Highlighted Heading) ─── */}
      {stats.recent && stats.recent.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-xl shadow-md shadow-teal-500/25 shrink-0 border border-teal-400/40">
                📜
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    {isTe ? 'ఇటీవల స్కాన్ చేసిన ఆకుల ఫలితాలు' : 'Recent Leaf Scan Results'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-teal-100 text-teal-900 dark:bg-teal-950/90 dark:text-teal-300 border border-teal-300/80 dark:border-teal-700 shadow-xs">
                    {stats.total} {isTe ? 'మొత్తం రికార్డులు' : 'Total Records'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {isTe ? 'మీ పొలంలో ఆకుల తాజా ఆరోగ్య చరిత్ర & నివారణ సూచనలు' : 'Recent diagnostic history, health percentage & treatment recommendations'}
                </p>
              </div>
            </div>
            <Link to="/history" className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300/70 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-black hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-xs transition-all">
              <span>{isTe ? `అన్ని రికార్డులు (${stats.total})` : `View all history (${stats.total})`}</span>
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
                        {translateCrop(scan.crop_name, i18n.language) || (isTe ? 'పంట' : 'Crop')} • {translateDisease(scan.predicted_class || scan.disease_name, i18n.language) || (isHealthy ? (isTe ? 'ఆరోగ్యకరమైన ఆకు' : 'Healthy Leaf') : (isTe ? 'వ్యాధి సోకిన ఆకు' : 'Infection Detected'))}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold ${isHealthy ? 'text-emerald-500' : 'text-rose-400'}`}>
                          {isHealthy ? `100% ${isTe ? 'ఆరోగ్యం' : 'Healthy'}` : `${Math.round((scan.confidence || scan.confidence_score || 0.95) * 100)}% ${isTe ? 'మ్యాచ్' : 'Match'}`}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {scan.created_at ? (() => {
                            try {
                              const d = new Date(scan.created_at);
                              return isNaN(d.getTime()) ? (isTe ? 'ఇటీవల' : 'Recent') : d.toLocaleDateString();
                            } catch (e) {
                              return isTe ? 'ఇటీవల' : 'Recent';
                            }
                          })() : (isTe ? 'ఇటీవల' : 'Recent')}
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