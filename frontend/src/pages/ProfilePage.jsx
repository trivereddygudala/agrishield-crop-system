import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Calendar, MapPin, Save, AlertCircle, Check, Palette, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, Button, Input, Select, Badge } from '../components/ui/index';
import { INDIA_STATES, getDistricts, getMandals, getVillages } from '../data/indiaLocations';
import { useWebSocket } from '../context/WebSocketContext';
import LiveWeatherWidget from '../components/intelligence/LiveWeatherWidget';
import SprayAdvisorWidget from '../components/intelligence/SprayAdvisorWidget';
import FarmRoutineWidget from '../components/intelligence/FarmRoutineWidget';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import { useNavbarTheme } from '../hooks/useNavbarTheme';
import { useColorTheme } from '../hooks/useColorTheme';
import NavbarSceneRenderer from '../components/animations/NavbarSceneRenderer';

const ANIMATION_THEMES = [
  // 🚜 Precision Agriculture (1-10)
  { id: 'smart-tractor', name: 'Smart Tractor', category: '🚜 Precision Agriculture' },
  { id: 'agri-drone', name: 'Agri-Drone', category: '🚜 Precision Agriculture' },
  { id: 'greenhouse', name: 'Greenhouse', category: '🚜 Precision Agriculture' },
  { id: 'solar-panels', name: 'Solar Panels', category: '🚜 Precision Agriculture' },
  { id: 'wind-turbine', name: 'Wind Turbine', category: '🚜 Precision Agriculture' },
  { id: 'smart-sprinklers', name: 'Sprinklers', category: '🚜 Precision Agriculture' },
  { id: 'harvest-robot', name: 'Harvest Robot', category: '🚜 Precision Agriculture' },
  { id: 'conveyor-belt', name: 'Conveyor', category: '🚜 Precision Agriculture' },
  { id: 'crop-rows', name: 'Crop Rows', category: '🚜 Precision Agriculture' },
  { id: 'fence-patrol', name: 'Fence Patrol', category: '🚜 Precision Agriculture' },
  // 🌱 Crop Biology (11-20)
  { id: 'seed-sprouting', name: 'Sprouting', category: '🌱 Crop Biology' },
  { id: 'photosynthesis', name: 'Photosynthesis', category: '🌱 Crop Biology' },
  { id: 'chlorophyll-flow', name: 'Chlorophyll', category: '🌱 Crop Biology' },
  { id: 'roots-growing', name: 'Root System', category: '🌱 Crop Biology' },
  { id: 'wheat-field', name: 'Wheat Field', category: '🌱 Crop Biology' },
  { id: 'sunflower-track', name: 'Sunflower', category: '🌱 Crop Biology' },
  { id: 'fruit-ripening', name: 'Fruit Ripen', category: '🌱 Crop Biology' },
  { id: 'pollination', name: 'Pollination', category: '🌱 Crop Biology' },
  { id: 'leaf-unfurl', name: 'Leaf Unfurl', category: '🌱 Crop Biology' },
  { id: 'cell-division', name: 'Cell Division', category: '🌱 Crop Biology' },
  // 🔬 Disease Detection (21-30)
  { id: 'disease-scan', name: 'Disease Scan', category: '🔬 Disease Detection' },
  { id: 'spore-alert', name: 'Spore Alert', category: '🔬 Disease Detection' },
  { id: 'ai-diagnosis', name: 'AI Diagnosis', category: '🔬 Disease Detection' },
  { id: 'microscope-view', name: 'Microscope', category: '🔬 Disease Detection' },
  { id: 'health-spectrum', name: 'Health Meter', category: '🔬 Disease Detection' },
  { id: 'leaf-xray', name: 'Leaf X-Ray', category: '🔬 Disease Detection' },
  { id: 'pathogen-track', name: 'Pathogen Track', category: '🔬 Disease Detection' },
  { id: 'confidence-meter', name: 'Confidence', category: '🔬 Disease Detection' },
  { id: 'image-classify', name: 'Classifier', category: '🔬 Disease Detection' },
  { id: 'model-training', name: 'Model Train', category: '🔬 Disease Detection' },
  // 🌦️ Weather (31-40)
  { id: 'gentle-rain', name: 'Gentle Rain', category: '🌦️ Weather & Climate' },
  { id: 'heavy-storm', name: 'Thunderstorm', category: '🌦️ Weather & Climate' },
  { id: 'snowfall', name: 'Snowfall', category: '🌦️ Weather & Climate' },
  { id: 'misty-morning', name: 'Misty Morning', category: '🌦️ Weather & Climate' },
  { id: 'golden-sunrise', name: 'Sunrise', category: '🌦️ Weather & Climate' },
  { id: 'purple-sunset', name: 'Sunset', category: '🌦️ Weather & Climate' },
  { id: 'heatwave', name: 'Heatwave', category: '🌦️ Weather & Climate' },
  { id: 'rainbow-arc', name: 'Rainbow', category: '🌦️ Weather & Climate' },
  { id: 'wind-gusts', name: 'Wind Gusts', category: '🌦️ Weather & Climate' },
  { id: 'cloud-drift', name: 'Cloud Drift', category: '🌦️ Weather & Climate' },
  // 🟤 Soil & Earth (41-50)
  { id: 'soil-layers', name: 'Soil Layers', category: '🟤 Soil & Earth' },
  { id: 'moisture-gradient', name: 'Moisture', category: '🟤 Soil & Earth' },
  { id: 'mineral-crystals', name: 'Minerals', category: '🟤 Soil & Earth' },
  { id: 'earthworm-tunnel', name: 'Earthworm', category: '🟤 Soil & Earth' },
  { id: 'erosion-flow', name: 'Erosion', category: '🟤 Soil & Earth' },
  { id: 'compost-cycle', name: 'Compost', category: '🟤 Soil & Earth' },
  { id: 'topo-contours', name: 'Topography', category: '🟤 Soil & Earth' },
  { id: 'volcanic-soil', name: 'Volcanic', category: '🟤 Soil & Earth' },
  { id: 'desert-dunes', name: 'Desert Dunes', category: '🟤 Soil & Earth' },
  { id: 'permafrost-thaw', name: 'Permafrost', category: '🟤 Soil & Earth' },
  // 📡 IoT & Hardware (51-60)
  { id: 'esp32-pulse', name: 'ESP32 Pulse', category: '📡 IoT & Hardware' },
  { id: 'sensor-array', name: 'Sensor Array', category: '📡 IoT & Hardware' },
  { id: 'bluetooth-pair', name: 'Bluetooth', category: '📡 IoT & Hardware' },
  { id: 'wifi-broadcast', name: 'WiFi Signal', category: '📡 IoT & Hardware' },
  { id: 'ota-update', name: 'OTA Update', category: '📡 IoT & Hardware' },
  { id: 'telemetry-feed', name: 'Telemetry', category: '📡 IoT & Hardware' },
  { id: 'battery-charge', name: 'Battery', category: '📡 IoT & Hardware' },
  { id: 'circuit-board', name: 'Circuit Board', category: '📡 IoT & Hardware' },
  { id: 'gateway-node', name: 'Gateway Hub', category: '📡 IoT & Hardware' },
  { id: 'edge-compute', name: 'Edge Compute', category: '📡 IoT & Hardware' },
  // 💧 Water & Irrigation (61-70)
  { id: 'drip-irrigation', name: 'Drip System', category: '💧 Water & Irrigation' },
  { id: 'river-flow', name: 'River Flow', category: '💧 Water & Irrigation' },
  { id: 'water-pump', name: 'Water Pump', category: '💧 Water & Irrigation' },
  { id: 'hydroponic-system', name: 'Hydroponics', category: '💧 Water & Irrigation' },
  { id: 'reservoir-fill', name: 'Reservoir', category: '💧 Water & Irrigation' },
  { id: 'canal-network', name: 'Canal Network', category: '💧 Water & Irrigation' },
  { id: 'rain-harvest', name: 'Rain Harvest', category: '💧 Water & Irrigation' },
  { id: 'flood-warning', name: 'Flood Warning', category: '💧 Water & Irrigation' },
  { id: 'water-quality', name: 'Water Quality', category: '💧 Water & Irrigation' },
  { id: 'fogponics', name: 'Fogponics', category: '💧 Water & Irrigation' },
  // 🦋 Nature & Ecosystem (71-80)
  { id: 'butterfly-garden', name: 'Butterflies', category: '🦋 Nature & Ecosystem' },
  { id: 'honeybee-hive', name: 'Honeybees', category: '🦋 Nature & Ecosystem' },
  { id: 'bird-migration', name: 'Bird Flight', category: '🦋 Nature & Ecosystem' },
  { id: 'firefly-night', name: 'Fireflies', category: '🦋 Nature & Ecosystem' },
  { id: 'frog-pond', name: 'Frog Pond', category: '🦋 Nature & Ecosystem' },
  { id: 'ladybug-patrol', name: 'Ladybug', category: '🦋 Nature & Ecosystem' },
  { id: 'spider-web', name: 'Spider Web', category: '🦋 Nature & Ecosystem' },
  { id: 'bamboo-forest', name: 'Bamboo', category: '🦋 Nature & Ecosystem' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', category: '🦋 Nature & Ecosystem' },
  { id: 'coral-reef', name: 'Coral Reef', category: '🦋 Nature & Ecosystem' },
  // 📊 Data Visualization (81-90)
  { id: 'neural-network', name: 'Neural Net', category: '📊 Data & Analytics' },
  { id: 'yield-chart', name: 'Yield Chart', category: '📊 Data & Analytics' },
  { id: 'data-stream', name: 'Data Stream', category: '📊 Data & Analytics' },
  { id: 'radar-sweep', name: 'Radar Sweep', category: '📊 Data & Analytics' },
  { id: 'biometric-pulse', name: 'Biometric', category: '📊 Data & Analytics' },
  { id: 'pie-chart', name: 'Pie Chart', category: '📊 Data & Analytics' },
  { id: 'bar-graph', name: 'Bar Graph', category: '📊 Data & Analytics' },
  { id: 'scatter-plot', name: 'Scatter Plot', category: '📊 Data & Analytics' },
  { id: 'heatmap-grid', name: 'Heatmap', category: '📊 Data & Analytics' },
  { id: 'flow-diagram', name: 'Data Flow', category: '📊 Data & Analytics' },
  // ✨ Premium Abstract (91-100)
  { id: 'aurora-borealis', name: 'Aurora', category: '✨ Premium Abstract' },
  { id: 'liquid-chrome', name: 'Liquid Chrome', category: '✨ Premium Abstract' },
  { id: 'glass-orbs', name: 'Glass Orbs', category: '✨ Premium Abstract' },
  { id: 'deep-space', name: 'Deep Space', category: '✨ Premium Abstract' },
  { id: 'abyssal-blue', name: 'Abyssal Blue', category: '✨ Premium Abstract' },
  { id: 'neon-edge', name: 'Neon Edge', category: '✨ Premium Abstract' },
  { id: 'carbon-fiber', name: 'Carbon Fiber', category: '✨ Premium Abstract' },
  { id: 'vercel-dark', name: 'Vercel Dark', category: '✨ Premium Abstract' },
  { id: 'hyper-speed', name: 'Hyper-Speed', category: '✨ Premium Abstract' },
  { id: 'sonic-wave', name: 'Sonic Wave', category: '✨ Premium Abstract' },
  // 🎭 Role-Based Welcome (101-103)
  { id: 'welcome-farmer', name: '👨‍🌾 Welcome Farmer', category: '🎭 Welcome' },
  { id: 'welcome-admin', name: '🛡️ Welcome Admin', category: '🎭 Welcome' },
  { id: 'welcome-tester', name: '🔧 Welcome Tester', category: '🎭 Welcome' }
];

const COLOR_THEMES = [
  { id: 'agrishield-default', name: 'AgriShield Emerald', desc: 'The classic environmental forest emerald color system.', colorClass: 'bg-emerald-500' },
  { id: 'harvest-gold', name: 'Harvest Gold', desc: 'Warm fields of ripening wheat and seasonal harvest.', colorClass: 'bg-amber-500' },
  { id: 'ocean-irrigation', name: 'Ocean Irrigation', desc: 'Hydrology ocean blue for clean water resource systems.', colorClass: 'bg-blue-500' },
  { id: 'sunset-farm', name: 'Sunset Farm', desc: 'Vibrant sky orange and warm autumn sunsets.', colorClass: 'bg-orange-500' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', desc: 'Bright rose pink hues for organic spring blossoms.', colorClass: 'bg-rose-500' },
  { id: 'lavender-fields', name: 'Lavender Fields', desc: 'Scenic royal purple for premium floral farms.', colorClass: 'bg-purple-500' },
  { id: 'forest-floor', name: 'Forest Floor', desc: 'Vibrant organic green representing soil health.', colorClass: 'bg-green-600' }
];

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const { t } = useTranslation();
  const userRole = user?.role?.toLowerCase() || 'farmer';
  const { theme, setTheme: handleNavbarThemeChange } = useNavbarTheme();
  const { colorTheme, setColorTheme: handleColorThemeChange } = useColorTheme();
  const [activeTab, setActiveTab] = useState('profile');

  // QA Tester simulation configurations saved in localStorage
  const [simOutbreak, setSimOutbreak] = useState(() => {
    const cached = localStorage.getItem('sim_outbreak_active');
    return cached === null ? true : cached === 'true';
  });
  const [simTelemetryDrift, setSimTelemetryDrift] = useState(() => {
    const cached = localStorage.getItem('sim_telemetry_drift');
    return cached === null ? true : cached === 'true';
  });
  const [simHardwareAlarms, setSimHardwareAlarms] = useState(() => {
    const cached = localStorage.getItem('sim_hardware_alarms');
    return cached === null ? true : cached === 'true';
  });

  const handleToggleOutbreak = (val) => {
    setSimOutbreak(val);
    localStorage.setItem('sim_outbreak_active', String(val));
    window.dispatchEvent(new CustomEvent('simOutbreakChange', { detail: val }));
  };
  const handleToggleTelemetryDrift = (val) => {
    setSimTelemetryDrift(val);
    localStorage.setItem('sim_telemetry_drift', String(val));
    window.dispatchEvent(new CustomEvent('simTelemetryDriftChange', { detail: val }));
  };
  const handleToggleHardwareAlarms = (val) => {
    setSimHardwareAlarms(val);
    localStorage.setItem('sim_hardware_alarms', String(val));
    window.dispatchEvent(new CustomEvent('simHardwareAlarmsChange', { detail: val }));
  };
  
  const { lastTelemetry } = useWebSocket();
  const activeTelemetry = lastTelemetry?.telemetry || lastTelemetry || {};
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [farmingPractices, setFarmingPractices] = useState('Conventional');

  const availableDistricts = getDistricts(state);
  const availableMandals = getMandals(state, district);
  const availableVillages = getVillages(state, district, mandal);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setFarmLocation(user.farm_location || '');
      setPreferredLanguage(user.preferred_language || 'en');
      setFarmingPractices(user.farming_practices || 'Conventional');
      
      if (user.farm_location && user.farm_location.includes(',')) {
        const parts = user.farm_location.split(',').map(s => s.trim());
        if (parts.length >= 4) {
          setVillage(parts[0]);
          setMandal(parts[1]);
          setDistrict(parts[2]);
          setState(parts[3]);
        } else if (parts.length === 2) {
          setDistrict(parts[0]);
          setState(parts[1]);
        }
      }
    }
  }, [user]);

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!name || !name.trim()) {
      setErrorMsg('Name cannot be empty.');
      return;
    }

    if (userRole === 'admin' && adminPassword) {
      if (adminPassword !== adminConfirmPassword) {
        setErrorMsg('Password confirmation does not match.');
        return;
      }
      if (adminPassword.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');
    setToastMsg('');

    try {
      const updatePayload = {
        name: name.trim(),
        preferred_language: user?.preferred_language || i18n.language || 'en',
      };

      if (userRole === 'admin') {
        if (adminPassword) {
          updatePayload.password = adminPassword;
        }
      } else {
        const fullLocationString = [village, mandal, district, state].filter(Boolean).join(', ') || farmLocation.trim();
        updatePayload.farm_location = fullLocationString;
        updatePayload.crop_history = user?.crop_history || [];
        updatePayload.farming_practices = farmingPractices;
      }

      await updateProfile(updatePayload);
      setToastMsg('Profile details updated successfully.');
      setErrorMsg('');
      setAdminPassword('');
      setAdminConfirmPassword('');
    } catch (err) {
      console.error("Profile update error:", err);
      const detail = err?.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Failed to update profile information.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })
    : 'Recently';

  const profileTabs = userRole === 'admin' ? [
    { id: 'profile', label: 'Admin Profile & Security' },
    { id: 'visuals', label: 'Visual Customization', hideOnMobile: true },
    { id: 'themes', label: 'Website Themes', hideOnMobile: true },
  ] : [
    { id: 'profile', label: t('profile_page.tabs.profile', 'Profile Settings') },
    { id: 'visuals', label: t('profile_page.tabs.visuals', 'Visual Customization'), hideOnMobile: true },
    { id: 'themes', label: t('profile_page.tabs.themes', 'Website Themes'), hideOnMobile: true },
    ...(userRole === 'tester' ? [{ id: 'tester', label: t('profile_page.tabs.tester', 'Tester Operations Panel') }] : [])
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto space-y-6 w-full pb-16"
    >
      <div className="flex flex-col gap-1 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {userRole === 'admin' ? 'Administrator Profile & Security' : userRole === 'tester' ? 'QA Tester Profile' : 'Farmer Profile & Identity'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
          {userRole === 'admin' 
            ? 'Manage administrative credentials, security credentials, and interface themes.'
            : 'Review your credentials and update your personal profile attributes.'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-white/10 pb-px overflow-x-auto hide-scrollbar">
        {profileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors relative focus:outline-none ${tab.hideOnMobile ? 'hidden md:inline-block' : ''} ${
              activeTab === tab.id 
                ? 'text-emerald-500' 
                : 'text-slate-500 hover:text-slate-700 dark:text-white/35 dark:hover:text-white/60'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="profileTabIndicator" 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-t-full" 
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'profile' && (
            <div className="grid md:grid-cols-3 gap-6">
              <Card glass className="p-6 text-center md:col-span-1 flex flex-col items-center justify-between border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md relative overflow-hidden group min-h-[300px]">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
                <div className="flex flex-col items-center mt-3">
                  <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 h-20 w-20 rounded-full flex items-center justify-center font-black text-3xl shadow-inner mb-3">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">
                    {user?.name || 'Administrator'}
                  </h3>
                  <div className="mt-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black tracking-wider uppercase">
                      {user?.role ? user.role : 'ADMIN'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 w-full mt-6 pt-4 text-left space-y-2.5 text-xs text-slate-500 dark:text-white/40">
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400 shrink-0" /> <span className="truncate">{user?.email || 'N/A'}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400 shrink-0" /> Joined {formattedDate}</div>
                  {userRole !== 'admin' && user?.farm_location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0" /> <span className="line-clamp-2 leading-relaxed">{user.farm_location}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card glass className="p-6 md:col-span-2 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
                <form onSubmit={handleUpdateSubmit} className="space-y-5">
                  <h3 className="font-black text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-white/5 pb-3">
                    {userRole === 'admin' ? 'Admin Identity & Credentials' : t('profile_page.form.heading', 'Agronomic Profile Settings')}
                  </h3>

                  {errorMsg && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {toastMsg && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{toastMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label={t('profile_page.form.full_name', 'Full Name')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      leftIcon={<User className="w-4 h-4 text-slate-400" />}
                      className="bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                    <Input
                      label={t('profile_page.form.email', 'Email Address')}
                      value={email}
                      disabled
                      helperText={t('profile_page.form.email_locked', 'Email is locked to account authentication.')}
                      leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                      className="bg-white dark:bg-slate-900 text-xs font-bold"
                    />
                  </div>

                  {userRole !== 'admin' && (
                    <>
                      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">{t('profile_page.location_title', 'Farmer Native Location (India)')}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">{t('profile_page.form.state', 'State / UT')}</label>
                            <select
                              value={state}
                              onChange={(e) => { setState(e.target.value); setDistrict(''); setMandal(''); setVillage(''); }}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
                            >
                              <option value="">-- {t('profile_page.form.select_state', 'Select State / UT')} --</option>
                              {INDIA_STATES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">{t('profile_page.form.district', 'District')}</label>
                            <select
                              value={district}
                              onChange={(e) => { setDistrict(e.target.value); setMandal(''); setVillage(''); }}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
                              disabled={!state}
                            >
                              <option value="">{state ? `-- ${t('profile_page.form.select_district', 'Select District')} --` : '-- Select State first --'}</option>
                              {availableDistricts.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">{t('profile_page.form.mandal', 'Mandal / Taluka')}</label>
                            <select
                              value={mandal}
                              onChange={(e) => { setMandal(e.target.value); setVillage(''); }}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
                              disabled={!district}
                            >
                              <option value="">{district ? `-- ${t('profile_page.form.select_mandal', 'Select Mandal')} --` : '-- Select District first --'}</option>
                              {availableMandals.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">{t('profile_page.form.village', 'Village / Town')}</label>
                            <select
                              value={village}
                              onChange={(e) => setVillage(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
                              disabled={!mandal}
                            >
                              <option value="">
                                {!mandal 
                                  ? '-- Select Mandal first --' 
                                  : availableVillages.length > 0 
                                    ? '-- Select Village --' 
                                    : '-- Select Village / Sector --'}
                              </option>
                              {availableVillages.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                          label={t('profile_page.form.farming_practice', 'Primary Farming Practice')}
                          value={farmingPractices}
                          onChange={(e) => setFarmingPractices(e.target.value)}
                          options={[
                            { value: 'Conventional', label: t('profile_page.form.conventional', 'Conventional Farming') },
                            { value: 'Organic', label: t('profile_page.form.organic', 'Organic Farming') },
                            { value: 'Hydroponic', label: t('profile_page.form.hydroponic', 'Hydroponic / Protected') },
                            { value: 'Regenerative', label: t('profile_page.form.regenerative', 'Regenerative Agro-forestry') }
                          ]}
                          className="text-xs font-bold text-slate-800 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {userRole === 'admin' && (
                    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] p-4">
                      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          {t('profile_page.form.admin_password_section', 'Admin Password & Security Reset')}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">{t('profile_page.form.leave_blank', 'Leave blank to keep current')}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label={t('profile_page.form.new_admin_password', 'New Admin Password')}
                          type="password"
                          placeholder="••••••••"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="bg-white dark:bg-slate-900 text-xs font-bold"
                        />
                        <Input
                          label={t('profile_page.form.confirm_password', 'Confirm New Password')}
                          type="password"
                          placeholder="••••••••"
                          value={adminConfirmPassword}
                          onChange={(e) => setAdminConfirmPassword(e.target.value)}
                          className="bg-white dark:bg-slate-900 text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="primary"
                      size="md"
                      type="submit"
                      isLoading={loading}
                      leftIcon={<Save className="w-4 h-4" />}
                      className="shadow-lg shadow-emerald-500/20"
                    >
                      Save Profile Changes
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {activeTab === 'visuals' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Palette className="h-5 w-5 text-emerald-500 shrink-0" />
                    Navbar Animation Gallery
                  </h2>
                  <p className="text-slate-500 dark:text-white/40 text-xs mt-1">
                    Choose from 103 exclusive dynamic visual themes for your main navigation header.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-extrabold shrink-0 select-none">
                  103 Themes Ready
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {ANIMATION_THEMES.map((t) => {
                  const isActive = theme === t.id;
                  return (
                    <motion.button 
                      key={t.id}
                      onClick={() => handleNavbarThemeChange(t.id)}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative text-left p-3 rounded-2xl border transition-all duration-300 group flex flex-col justify-between h-[145px] overflow-hidden ${
                        isActive 
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' 
                          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="w-full">
                        {isActive && (
                          <div className="absolute top-2.5 right-2.5 text-emerald-500 z-20 animate-pulse">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="relative h-14 w-full rounded-xl overflow-hidden border border-slate-200/50 dark:border-white/5 bg-slate-950 mb-2 pointer-events-none z-10">
                          <NavbarSceneRenderer theme={t.id} noWrapper={true} />
                        </div>
                      </div>
                      <div>
                        <h3 className={`font-black text-xs leading-tight transition-colors line-clamp-1 ${isActive ? 'text-emerald-500' : 'text-slate-800 dark:text-white/80 group-hover:text-emerald-500'}`}>
                          {t.name}
                        </h3>
                        <p className="text-[9px] text-slate-400 dark:text-white/30 mt-0.5 line-clamp-1 font-black uppercase tracking-wider">
                          {t.category.replace(/[^a-zA-Z0-9\s&]/g, '').trim()}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'themes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                  <Palette className="h-5 w-5 text-emerald-500 shrink-0" />
                  Website Color Themes
                </h2>
                <p className="text-slate-500 dark:text-white/40 text-xs mt-1">
                  Choose from 15 custom palettes to instantly theme the user interface styling.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {COLOR_THEMES.map((themeItem) => {
                  const isActive = colorTheme === themeItem.id;
                  return (
                    <motion.button
                      key={themeItem.id}
                      onClick={() => handleColorThemeChange(themeItem.id)}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative text-left p-5 rounded-2xl border transition-all duration-300 flex gap-4 group ${
                        isActive 
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' 
                          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-inner ${themeItem.colorClass}`}>
                          {isActive && <Check className="w-5 h-5 drop-shadow-md text-white" />}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className={`font-black text-sm tracking-tight transition-colors ${isActive ? 'text-emerald-500' : 'text-slate-900 dark:text-white/80 group-hover:text-emerald-500'}`}>
                          {themeItem.name}
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-white/40 mt-1 leading-relaxed">
                          {themeItem.desc}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WidgetErrorBoundary name="Autonomous Farm Schedule">
                <div className="lg:col-span-2">
                  <FarmRoutineWidget />
                </div>
              </WidgetErrorBoundary>
              
              <WidgetErrorBoundary name="Live Weather Intelligence">
                <LiveWeatherWidget telemetry={activeTelemetry} />
              </WidgetErrorBoundary>
              
              <WidgetErrorBoundary name="Spray Application Advisor">
                <SprayAdvisorWidget telemetry={activeTelemetry} />
              </WidgetErrorBoundary>
            </div>
          )}

          {activeTab === 'tester' && userRole === 'tester' && (
            <Card glass className="p-6 border border-slate-200/85 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    QA Tester Operations & Simulation Panel
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                    Enable, disable, and mock system state changes to verify core application resilience and layouts.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* 1. Outbreak Notification Simulation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/5">
                  <div className="space-y-1">
                    <span className="text-sm font-black text-slate-900 dark:text-white block">1. Outbreak Warning Simulation</span>
                    <span className="text-xs text-slate-550 dark:text-slate-400 block leading-relaxed max-w-lg">
                      Triggers a critical 12-second warning toast alert 8s after landing on the dashboard regarding Tomato Late Blight.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOutbreak(true)}
                      className={`px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[56px] min-w-[90px] border ${
                        simOutbreak
                          ? 'bg-emerald-500 text-white border-emerald-450 shadow-md shadow-emerald-500/25 font-black scale-[1.02]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleOutbreak(false)}
                      className={`px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[56px] min-w-[90px] border ${
                        !simOutbreak
                          ? 'bg-rose-500 text-white border-rose-450 shadow-md shadow-rose-500/25 font-black scale-[1.02]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>

                {/* 2. Sensor Data Drift Simulation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/5">
                  <div className="space-y-1">
                    <span className="text-sm font-black text-slate-900 dark:text-white block">2. Sensor Data Drift Simulation</span>
                    <span className="text-xs text-slate-550 dark:text-slate-400 block leading-relaxed max-w-lg">
                      Fluctuates ESP32 live dashboard telemetry readings dynamically to test visual range gauges (soil moisture, temperature).
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTelemetryDrift(true)}
                      className={`px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[56px] min-w-[90px] border ${
                        simTelemetryDrift
                          ? 'bg-emerald-500 text-white border-emerald-450 shadow-md shadow-emerald-500/25 font-black scale-[1.02]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleTelemetryDrift(false)}
                      className={`px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[56px] min-w-[90px] border ${
                        !simTelemetryDrift
                          ? 'bg-rose-500 text-white border-rose-450 shadow-md shadow-rose-500/25 font-black scale-[1.02]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>

                {/* 3. Hardware Fault Alarms Simulation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/5">
                  <div className="space-y-1">
                    <span className="text-sm font-black text-slate-900 dark:text-white block">3. Low Battery & Offline Node Simulation</span>
                    <span className="text-xs text-slate-550 dark:text-slate-400 block leading-relaxed max-w-lg">
                      Fires simulated hardware failure alert logs inside the top notifications dropdown when the ESP32 loses battery.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleHardwareAlarms(true)}
                      className={`px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[56px] min-w-[90px] border ${
                        simHardwareAlarms
                          ? 'bg-emerald-500 text-white border-emerald-450 shadow-md shadow-emerald-500/25 font-black scale-[1.02]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleHardwareAlarms(false)}
                      className={`px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all min-h-[56px] min-w-[90px] border ${
                        !simHardwareAlarms
                          ? 'bg-rose-500 text-white border-rose-450 shadow-md shadow-rose-500/25 font-black scale-[1.02]'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-250 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-800'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default ProfilePage;
