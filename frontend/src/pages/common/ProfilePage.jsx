import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Calendar, MapPin, Save, AlertCircle, Check, Palette, Sparkles, Truck, Phone, Clock, Users, DollarSign, ShieldCheck, Sprout, ArrowRight, Globe, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, Button, Input, Select, Badge } from '../../components/ui/index';
import { INDIA_STATES, getDistricts, getMandals, getVillages } from '../../data/indiaLocations';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import { useWebSocket } from '../../context/WebSocketContext';
import LiveWeatherWidget from '../../components/intelligence/LiveWeatherWidget';
import SprayAdvisorWidget from '../../components/intelligence/SprayAdvisorWidget';
import FarmRoutineWidget from '../../components/intelligence/FarmRoutineWidget';
import WidgetErrorBoundary from '../../components/WidgetErrorBoundary';
import { useNavbarTheme } from '../../hooks/useNavbarTheme';
import { useColorTheme } from '../../hooks/useColorTheme';
import NavbarSceneRenderer from '../../components/animations/NavbarSceneRenderer';

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
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
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

  // Multi-Language Quick-Switch Preferences (Strict 1, 2, or 3 selection)
  const [preferredLanguages, setPreferredLanguages] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_preferred_languages'));
      if (Array.isArray(saved) && saved.length > 0) return saved.slice(0, 3);
    } catch (_) {}
    if (user?.preferred_languages && Array.isArray(user.preferred_languages) && user.preferred_languages.length > 0) {
      return user.preferred_languages.slice(0, 3);
    }
    return ['te', 'en'];
  });
  const [languagesToast, setLanguagesToast] = useState('');
  const [languagesError, setLanguagesError] = useState('');
  const [savingLanguages, setSavingLanguages] = useState(false);

  const handleTogglePreferredLanguage = (langCode) => {
    setLanguagesError('');
    setLanguagesToast('');
    if (preferredLanguages.includes(langCode)) {
      if (preferredLanguages.length <= 1) {
        setLanguagesError(isTe ? 'కనీసం 1 భాషను ఎంచుకోవాలి.' : 'At least 1 language must remain selected.');
        return;
      }
      setPreferredLanguages(preferredLanguages.filter(c => c !== langCode));
    } else {
      if (preferredLanguages.length >= 3) {
        setLanguagesError(isTe ? 'గరిష్టంగా 3 భాషలను మాత్రమే ఎంచుకోవచ్చు. మరొకటి జోడించడానికి ఒకదాన్ని తీసివేయండి.' : 'You can select up to 3 quick-switch languages. Deselect one to add another.');
        return;
      }
      setPreferredLanguages([...preferredLanguages, langCode]);
    }
  };

  const handleSavePreferredLanguages = async () => {
    if (preferredLanguages.length === 0) {
      setLanguagesError(isTe ? 'దయచేసి కనీసం 1 భాషను ఎంచుకోండి.' : 'Please select at least 1 language.');
      return;
    }
    setSavingLanguages(true);
    setLanguagesError('');
    setLanguagesToast('');
    try {
      localStorage.setItem('agrishield_preferred_languages', JSON.stringify(preferredLanguages));
      if (user && updateProfile) {
        await updateProfile({ preferred_languages: preferredLanguages });
      }
      window.dispatchEvent(new CustomEvent('agrishield-preferred-languages-updated', {
        detail: { languages: preferredLanguages }
      }));
      setLanguagesToast(isTe ? `భాషల ప్రాధాన్యతలు సేవ్ చేయబడ్డాయి! స్కాన్ ఫలితాల్లో ఈ ${preferredLanguages.length} భాషలు మాత్రమే కనిపిస్తాయి.` : `Language preferences saved! Scan results will strictly show only these ${preferredLanguages.length} language(s).`);
      setTimeout(() => setLanguagesToast(''), 5000);
    } catch (err) {
      console.error("Language save error:", err);
      setLanguagesToast(isTe ? 'భాషలు లోకల్‌గా సేవ్ చేయబడ్డాయి!' : 'Language preferences saved locally!');
      setTimeout(() => setLanguagesToast(''), 5000);
    } finally {
      setSavingLanguages(false);
    }
  };

  const isEquipmentProvider = userRole === 'equipment_provider';

  // Provider Hub Profile Attributes
  const [hubName, setHubName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return saved.hub_name || saved.hubName || user?.provider_profile?.hub_name || user?.name || '';
    } catch { return ''; }
  });
  const [dispatchPhone, setDispatchPhone] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return saved.dispatch_phone || saved.dispatchPhone || user?.provider_profile?.dispatch_phone || user?.phone || '';
    } catch { return ''; }
  });
  const [serviceRadiusKm, setServiceRadiusKm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return String(saved.service_radius_km || saved.serviceRadiusKm || user?.provider_profile?.service_radius_km || '25');
    } catch { return '25'; }
  });
  const [operatorCount, setOperatorCount] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return String(saved.operator_count || saved.operatorCount || user?.provider_profile?.operator_count || '2');
    } catch { return '2'; }
  });
  const [payoutUpiId, setPayoutUpiId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return saved.payout_upi_id || saved.payoutUpiId || user?.provider_profile?.payout_upi_id || '';
    } catch { return ''; }
  });
  const [operatingTimings, setOperatingTimings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return saved.operating_timings || saved.operatingTimings || user?.provider_profile?.operating_timings || '06:00 AM - 07:00 PM';
    } catch { return '06:00 AM - 07:00 PM'; }
  });

  const [smamLicenseNo, setSmamLicenseNo] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return saved.smam_license_no || saved.smamLicenseNo || user?.provider_profile?.smam_license_no || '';
    } catch { return ''; }
  });
  const [emergencyPhone, setEmergencyPhone] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_provider_hub_profile') || '{}');
      return saved.emergency_phone || saved.emergencyPhone || user?.provider_profile?.emergency_phone || '';
    } catch { return ''; }
  });

  // Farmer Specific Agronomic & Identity Attributes
  const [farmerPhone, setFarmerPhone] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return saved.phone || user?.phone || user?.mobile || user?.farmer_profile?.phone || '';
    } catch { return user?.phone || user?.mobile || ''; }
  });
  const [totalAcres, setTotalAcres] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return String(saved.total_acres || saved.acres || user?.farmer_profile?.total_acres || user?.farmer_profile?.acres || '2.5');
    } catch { return '2.5'; }
  });
  const [ownershipType, setOwnershipType] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return saved.ownership_type || user?.farmer_profile?.ownership_type || 'Owner';
    } catch { return 'Owner'; }
  });
  const [selectedCrops, setSelectedCrops] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return saved.selected_crops || user?.selected_crops || user?.farmer_profile?.selected_crops || ['Paddy', 'Chilli'];
    } catch { return ['Paddy', 'Chilli']; }
  });
  const [soilType, setSoilType] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return saved.soil_type || user?.farmer_profile?.soil_type || 'Black Cotton Soil';
    } catch { return 'Black Cotton Soil'; }
  });
  const [irrigationSource, setIrrigationSource] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return saved.irrigation_source || user?.farmer_profile?.irrigation_source || 'Borewell';
    } catch { return 'Borewell'; }
  });
  const [kisanId, setKisanId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
      return saved.kisan_id || user?.farmer_profile?.kisan_id || '';
    } catch { return ''; }
  });

  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');

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
      
      if (user.phone || user.mobile) setFarmerPhone(user.phone || user.mobile);
      if (user.selected_crops) setSelectedCrops(user.selected_crops);

      if (user.farmer_profile) {
        if (user.farmer_profile.phone) setFarmerPhone(user.farmer_profile.phone);
        if (user.farmer_profile.total_acres) setTotalAcres(String(user.farmer_profile.total_acres));
        if (user.farmer_profile.ownership_type) setOwnershipType(user.farmer_profile.ownership_type);
        if (user.farmer_profile.selected_crops) setSelectedCrops(user.farmer_profile.selected_crops);
        if (user.farmer_profile.soil_type) setSoilType(user.farmer_profile.soil_type);
        if (user.farmer_profile.irrigation_source) setIrrigationSource(user.farmer_profile.irrigation_source);
        if (user.farmer_profile.kisan_id) setKisanId(user.farmer_profile.kisan_id);
      }

      if (user.provider_profile) {
        if (user.provider_profile.hub_name) setHubName(user.provider_profile.hub_name);
        if (user.provider_profile.dispatch_phone) setDispatchPhone(user.provider_profile.dispatch_phone);
        if (user.provider_profile.service_radius_km) setServiceRadiusKm(String(user.provider_profile.service_radius_km));
        if (user.provider_profile.operator_count) setOperatorCount(String(user.provider_profile.operator_count));
        if (user.provider_profile.payout_upi_id) setPayoutUpiId(user.provider_profile.payout_upi_id);
        if (user.provider_profile.operating_timings) setOperatingTimings(user.provider_profile.operating_timings);
        if (user.provider_profile.smam_license_no) setSmamLicenseNo(user.provider_profile.smam_license_no);
        if (user.provider_profile.emergency_phone) setEmergencyPhone(user.provider_profile.emergency_phone);
      }

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
      if (adminPassword.length < 12 || !/[A-Z]/.test(adminPassword) || !/[0-9]/.test(adminPassword) || !/[!@#$%^&*]/.test(adminPassword)) {
        setErrorMsg('Admin password must be 12+ characters and contain uppercase, digit, and special symbol (!@#$%^&*).');
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
      } else if (isEquipmentProvider) {
        const fullLocationString = [village, mandal, district, state].filter(Boolean).join(', ') || farmLocation.trim();
        updatePayload.farm_location = fullLocationString;
        const providerData = {
          hub_name: hubName.trim(),
          dispatch_phone: dispatchPhone.trim(),
          service_radius_km: serviceRadiusKm,
          operator_count: operatorCount,
          payout_upi_id: payoutUpiId.trim(),
          operating_timings: operatingTimings.trim(),
          smam_license_no: smamLicenseNo.trim(),
          emergency_phone: emergencyPhone.trim(),
          base_location: fullLocationString,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('agrishield_provider_hub_profile', JSON.stringify(providerData));
        updatePayload.provider_profile = providerData;
        updatePayload.phone = dispatchPhone.trim();
        updatePayload.mobile = dispatchPhone.trim();
      } else {
        const fullLocationString = [village, mandal, district, state].filter(Boolean).join(', ') || farmLocation.trim();
        updatePayload.farm_location = fullLocationString;
        updatePayload.crop_history = user?.crop_history || [];
        updatePayload.farming_practices = farmingPractices;
        updatePayload.phone = farmerPhone.trim();
        updatePayload.mobile = farmerPhone.trim();
        updatePayload.selected_crops = selectedCrops;

        const farmerData = {
          phone: farmerPhone.trim(),
          mobile: farmerPhone.trim(),
          total_acres: totalAcres.trim(),
          acres: totalAcres.trim(),
          ownership_type: ownershipType,
          selected_crops: selectedCrops,
          soil_type: soilType,
          irrigation_source: irrigationSource,
          kisan_id: kisanId.trim(),
          farming_practices: farmingPractices,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('agrishield_farmer_profile', JSON.stringify(farmerData));
        updatePayload.farmer_profile = farmerData;
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
    { id: 'languages', label: '🌐 Languages (1-3)' },
    { id: 'visuals', label: 'Visual Customization', hideOnMobile: true },
    { id: 'themes', label: 'Website Themes', hideOnMobile: true },
  ] : [
    { id: 'profile', label: t('profile_page.tabs.profile', 'Profile Settings') },
    { id: 'languages', label: isTe ? '🌐 భాషల ఎంపిక (1-3)' : '🌐 Languages (1-3)' },
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
          {userRole === 'admin' 
            ? 'Administrator Profile & Security' 
            : isEquipmentProvider 
              ? (isTe ? 'మెషినరీ ప్రొవైడర్ హబ్ ప్రొఫైల్' : 'Equipment Provider Hub Profile')
              : userRole === 'tester' 
                ? 'QA Tester Profile' 
                : t('profile_page.farmer_title', 'Farmer Profile & Identity')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
          {userRole === 'admin' 
            ? 'Manage administrative credentials, security credentials, and interface themes.'
            : isEquipmentProvider
              ? (isTe ? 'మీ యంత్రాల హబ్ వివరాలు, సర్వీస్ పరిధి, ఆపరేటర్లు మరియు చెల్లింపు వివరాలు నిర్వహించండి.' : 'Manage your machinery hub profile, dispatch radius, operator count, and payout UPI details.')
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
              <Card glass className="p-6 text-center md:col-span-1 flex flex-col items-center justify-between border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md relative overflow-hidden group min-h-[340px]">
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isEquipmentProvider ? 'bg-gradient-to-r from-amber-500 to-orange-400' : userRole === 'admin' ? 'bg-gradient-to-r from-sky-500 to-indigo-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`} />
                
                {isEquipmentProvider ? (
                  <div className="flex flex-col items-center mt-3 w-full">
                    <div className="bg-amber-500/10 text-amber-500 border border-amber-500/25 h-20 w-20 rounded-full flex items-center justify-center font-black text-3xl shadow-inner mb-3">
                      🚜
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">
                      {hubName || user?.name || 'Machinery Hub'}
                    </h3>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black tracking-wider uppercase">
                        🚜 {isTe ? 'మెషినరీ ప్రొవైడర్' : 'EQUIPMENT PROVIDER'}
                      </span>
                    </div>

                    <div className="border-t border-slate-100 dark:border-white/5 w-full mt-4 pt-3.5 text-left space-y-2 text-xs text-slate-600 dark:text-white/60">
                      <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-amber-500 shrink-0" /> <span className="font-bold">{dispatchPhone || user?.phone || '9876543210'}</span></div>
                      <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /> <span className="line-clamp-1">{[village, mandal, district].filter(Boolean).join(', ') || user?.farm_location || 'Hub Location'}</span></div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-white/5">
                        <span className="text-slate-450 dark:text-white/40">Dispatch Radius:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{serviceRadiusKm || '25'} km</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-450 dark:text-white/40">Trained Operators:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{operatorCount || '2'} Drivers</span>
                      </div>
                      {payoutUpiId && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-450 dark:text-white/40">Payout UPI:</span>
                          <span className="font-bold text-emerald-500 truncate max-w-[120px]">{payoutUpiId}</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full pt-4 mt-auto">
                      <Link to="/provider/dashboard?tab=fleet" className="w-full block">
                        <Button size="sm" variant="outline" className="w-full text-xs font-bold border-amber-400 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400">
                          🚜 {isTe ? 'ఫ్లీట్ నిర్వహణ హబ్' : 'Open Machinery Fleet'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : userRole === 'admin' ? (
                  <div className="flex flex-col items-center mt-3 w-full">
                    <div className="bg-sky-500/10 text-sky-500 border border-sky-500/25 h-20 w-20 rounded-full flex items-center justify-center font-black text-3xl shadow-inner mb-3">
                      🛡️
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">
                      {user?.name || 'Administrator'}
                    </h3>
                    <div className="mt-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[9px] font-black tracking-wider uppercase">
                        🛡️ SYSTEM ADMIN
                      </span>
                    </div>

                    <div className="border-t border-slate-100 dark:border-white/5 w-full mt-4 pt-3.5 text-left space-y-2 text-xs text-slate-600 dark:text-white/60">
                      <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /> <span className="truncate">{user?.email || 'admin@agrishield.com'}</span></div>
                      <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" /> Joined {formattedDate}</div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-white/5">
                        <span className="text-slate-450 dark:text-white/40">Privilege:</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400">Master Governance</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-450 dark:text-white/40">API Status:</span>
                        <span className="font-bold text-emerald-500">🟢 290 Routes Active</span>
                      </div>
                    </div>

                    <div className="w-full pt-4 mt-auto">
                      <Link to="/admin" className="w-full block">
                        <Button size="sm" variant="outline" className="w-full text-xs font-bold border-sky-400 text-sky-600 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400">
                          🛡️ {isTe ? 'అడ్మిన్ కంట్రోల్ సెంటర్' : 'Open Admin Center'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center mt-3 w-full">
                    <div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 h-20 w-20 rounded-full flex items-center justify-center font-black text-3xl shadow-inner mb-3">
                      {user?.name ? user.name.charAt(0).toUpperCase() : '👨‍🌾'}
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">
                      {user?.name || 'Farmer'}
                    </h3>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black tracking-wider uppercase">
                        🌾 {isTe ? 'రైతు' : 'FARMER'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[9px] font-black tracking-wider uppercase">
                        🛡️ {isTe ? 'కిసాన్ ధృవీకరణ' : 'KISAN VERIFIED'}
                      </span>
                    </div>

                    <div className="border-t border-slate-100 dark:border-white/5 w-full mt-4 pt-3.5 text-left space-y-2 text-xs text-slate-600 dark:text-white/60">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {farmerPhone || user?.phone || user?.mobile || 'Phone not set'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{user?.email || 'N/A'}</span>
                      </div>
                      {user?.farm_location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="line-clamp-2 leading-relaxed">{user.farm_location}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-white/5">
                        <span className="text-slate-450 dark:text-white/40">Land Holding:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalAcres} Acres ({ownershipType})</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-450 dark:text-white/40">Active Crops:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                          {selectedCrops?.join(', ') || 'Paddy, Chilli'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-450 dark:text-white/40">Soil & Water:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                          {soilType.split(' ')[0]} • {irrigationSource.split(' ')[0]}
                        </span>
                      </div>
                      {kisanId && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-450 dark:text-white/40">Kisan ID:</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{kisanId}</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full pt-4 mt-auto">
                      <Link to="/farm" className="w-full block">
                        <Button size="sm" variant="outline" className="w-full text-xs font-bold border-emerald-400 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400">
                          🌾 {isTe ? 'నా పొలం & భూమి రికార్డులు' : 'Go to My Farm & Land'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </Card>

              <Card glass className="p-6 md:col-span-2 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
                <form onSubmit={handleUpdateSubmit} className="space-y-5">
                  <h3 className="font-black text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-white/5 pb-3">
                    {userRole === 'admin' 
                      ? 'Admin Identity & Credentials' 
                      : isEquipmentProvider 
                        ? (isTe ? 'మెషినరీ హబ్ & ప్రొవైడర్ సెట్టింగ్‌లు' : 'Machinery Hub & Provider Settings') 
                        : t('profile_page.form.heading', 'Agronomic Profile Settings')}
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
                      label={isEquipmentProvider ? (isTe ? 'ప్రొవైడర్ / యజమాని పేరు' : 'Provider / Owner Name') : t('profile_page.form.full_name', 'Full Name')}
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
                          <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                            {isEquipmentProvider ? (isTe ? 'హబ్ బేస్ డిస్పాచ్ ప్రదేశం (భారతదేశం)' : 'Equipment Hub Base Dispatch Location (India)') : t('profile_page.location_title', 'Farmer Native Location (India)')}
                          </span>
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

                      {isEquipmentProvider ? (
                        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-amber-500" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                              {isTe ? 'మెషినరీ హబ్ వ్యాపార సమాచారం & చెల్లింపులు' : 'Machinery Hub Operations & Payout Settings'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                              label={isTe ? 'వ్యాపార / హబ్ పేరు' : 'Machinery Hub / Agency Name'}
                              value={hubName}
                              onChange={(e) => setHubName(e.target.value)}
                              placeholder="e.g. Balaji Agro Custom Hiring Center"
                              leftIcon={<Truck className="w-4 h-4 text-slate-400" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />

                            <Input
                              label={isTe ? 'డిస్పాచ్ మొబైల్ / వాట్సాప్' : 'Dispatch Contact Phone / WhatsApp'}
                              value={dispatchPhone}
                              onChange={(e) => setDispatchPhone(e.target.value)}
                              placeholder="e.g. 9876543210"
                              leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />

                            <Select
                              label={isTe ? 'సేవా పరిధి (కి.మీ)' : 'Service Coverage Radius'}
                              value={serviceRadiusKm}
                              onChange={(e) => setServiceRadiusKm(e.target.value)}
                              options={[
                                { value: '10', label: '10 km (Local Village Radius)' },
                                { value: '25', label: '25 km (Mandal / Taluka Range)' },
                                { value: '50', label: '50 km (District Level)' },
                                { value: '100', label: '100 km (Regional Fleet Dispatch)' }
                              ]}
                              className="text-xs font-bold text-slate-800 dark:text-white"
                            />

                            <Select
                              label={isTe ? 'శిక్షణ పొందిన ఆపరేటర్ల సంఖ్య' : 'Trained Operators & Drivers'}
                              value={operatorCount}
                              onChange={(e) => setOperatorCount(e.target.value)}
                              options={[
                                { value: '1', label: '1 Dedicated Driver' },
                                { value: '2', label: '2 Trained Operators' },
                                { value: '3', label: '3 Trained Operators' },
                                { value: '5', label: '4 - 5 Operators' },
                                { value: '10', label: '6+ Fleet Team' }
                              ]}
                              className="text-xs font-bold text-slate-800 dark:text-white"
                            />

                            <Input
                              label={isTe ? 'చెల్లింపుల యూపీఐ ఐడీ (UPI ID)' : 'Payout UPI ID (Direct Bank Settlement)'}
                              value={payoutUpiId}
                              onChange={(e) => setPayoutUpiId(e.target.value)}
                              placeholder="e.g. balajihub@oksbi"
                              leftIcon={<DollarSign className="w-4 h-4 text-emerald-500" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />

                            <Input
                              label={isTe ? 'రోజువారీ పని వేళలు' : 'Operating Dispatch Hours'}
                              value={operatingTimings}
                              onChange={(e) => setOperatingTimings(e.target.value)}
                              placeholder="e.g. 06:00 AM - 07:00 PM"
                              leftIcon={<Clock className="w-4 h-4 text-slate-400" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />

                            <Input
                              label={isTe ? 'ప్రభుత్వ SMAM 40% సబ్సిడీ / CHC లైసెన్స్ సంఖ్య (ఐచ్ఛికం)' : 'Government SMAM 40% Subsidy / CHC License No. (Optional)'}
                              value={smamLicenseNo}
                              onChange={(e) => setSmamLicenseNo(e.target.value)}
                              placeholder="e.g. AP-SMAM-CHC-2024-8841"
                              leftIcon={<ShieldCheck className="w-4 h-4 text-slate-400" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />

                            <Input
                              label={isTe ? 'అత్యవసర బ్రేక్‌డౌన్ / మెకానిక్ ఫోన్' : 'Emergency Field Breakdown & Mechanic Phone'}
                              value={emergencyPhone}
                              onChange={(e) => setEmergencyPhone(e.target.value)}
                              placeholder="e.g. 9440182736"
                              leftIcon={<Phone className="w-4 h-4 text-rose-500" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />
                          </div>
                        </div>
                      ) : userRole === 'farmer' ? (
                        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-2">
                            <Sprout className="w-4 h-4 text-emerald-500" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                              {isTe ? 'రైతు సాగు భూమి & పంట వివరాలు' : 'Farmer Land, Crops & Agronomic Specifications'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                              label={isTe ? 'రైతు మొబైల్ / వాట్సాప్ నంబర్' : 'Farmer Mobile / WhatsApp Number'}
                              value={farmerPhone}
                              onChange={(e) => setFarmerPhone(e.target.value)}
                              placeholder="e.g. 9440182736"
                              leftIcon={<Phone className="w-4 h-4 text-emerald-500" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                label={isTe ? 'మొత్తం సాగు భూమి (ఎకరాలు)' : 'Total Farm Size (Acres)'}
                                type="number"
                                step="0.1"
                                value={totalAcres}
                                onChange={(e) => setTotalAcres(e.target.value)}
                                placeholder="e.g. 3.5"
                                className="bg-white dark:bg-slate-900 text-xs font-bold"
                              />

                              <Select
                                label={isTe ? 'భూమి హక్కు' : 'Land Tenure'}
                                value={ownershipType}
                                onChange={(e) => setOwnershipType(e.target.value)}
                                options={[
                                  { value: 'Owner', label: isTe ? 'భూ యజమాని (Owner)' : 'Owner Farmer' },
                                  { value: 'Tenant', label: isTe ? 'కౌలు రైతు (Tenant)' : 'Tenant Farmer' },
                                  { value: 'Joint Family', label: isTe ? 'ఉమ్మడి కుటుంబం (Joint)' : 'Joint Holding' }
                                ]}
                                className="text-xs font-bold text-slate-800 dark:text-white"
                              />
                            </div>

                            <Select
                              label={isTe ? 'నేల రకం (భారతీయ వర్గీకరణ)' : 'Soil Classification'}
                              value={soilType}
                              onChange={(e) => setSoilType(e.target.value)}
                              options={[
                                { value: 'Black Cotton Soil', label: 'Black Cotton Soil (నల్లరేగడి నేల)' },
                                { value: 'Red Loam Soil', label: 'Red Sandy / Loam Soil (ఎర్ర నేల)' },
                                { value: 'Alluvial Soil', label: 'Alluvial River Soil (ఒండ్రు నేల)' },
                                { value: 'Clay Loam Soil', label: 'Clay Loam Soil (బంక నేల)' },
                                { value: 'Sandy Loam', label: 'Sandy Loam Soil (ఇసుక నేల)' }
                              ]}
                              className="text-xs font-bold text-slate-800 dark:text-white"
                            />

                            <Select
                              label={isTe ? 'నీటి వనరు & సాగు పద్ధతి' : 'Irrigation & Water Source'}
                              value={irrigationSource}
                              onChange={(e) => setIrrigationSource(e.target.value)}
                              options={[
                                { value: 'Borewell', label: 'Borewell & Submersible Pump (బోరుబావి)' },
                                { value: 'Canal', label: 'Government Canal Irrigation (కాలువ నీరు)' },
                                { value: 'Drip System', label: 'Micro Drip Irrigation (బిందు సేద్యం)' },
                                { value: 'Sprinkler', label: 'Sprinkler System (తుంపర సేద్యం)' },
                                { value: 'Open Well', label: 'Open Agricultural Well (బావి నీరు)' },
                                { value: 'Rainfed', label: 'Rainfed Dryland (వర్షాధార సేద్యం)' }
                              ]}
                              className="text-xs font-bold text-slate-800 dark:text-white"
                            />

                            <Select
                              label={t('profile_page.form.farming_practice', 'Primary Farming Practice')}
                              value={farmingPractices}
                              onChange={(e) => setFarmingPractices(e.target.value)}
                              options={[
                                { value: 'Conventional', label: t('profile_page.form.conventional', 'Conventional Farming') },
                                { value: 'Organic', label: t('profile_page.form.organic', 'Organic Farming (సేంద్రీయ వ్యవసాయం)') },
                                { value: 'Hydroponic', label: t('profile_page.form.hydroponic', 'Hydroponic / Protected Farming') },
                                { value: 'Regenerative', label: t('profile_page.form.regenerative', 'Regenerative Agro-forestry (ప్రకృతి వ్యవసాయం)') }
                              ]}
                              className="text-xs font-bold text-slate-800 dark:text-white"
                            />

                            <Input
                              label={isTe ? 'పీఎం-కిసాన్ / రైతు భరోసా ఐడీ (ఐచ్ఛికం)' : 'PM-KISAN / Rythu Bharosa ID (Optional)'}
                              value={kisanId}
                              onChange={(e) => setKisanId(e.target.value)}
                              placeholder="e.g. AP-PMK-2024-9918"
                              leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
                              className="bg-white dark:bg-slate-900 text-xs font-bold"
                            />
                          </div>

                          {/* Primary Crops Selector Chips */}
                          <div className="space-y-1.5 pt-1">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase">
                              {isTe ? 'ప్రస్తుత సీజన్ పంటలు (ఎంచుకోండి)' : 'Current Season Crops (Select all that apply)'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: 'Paddy', label: 'Paddy (వరి)', icon: '🌾' },
                                { id: 'Chilli', label: 'Chilli (మిరప)', icon: '🌶️' },
                                { id: 'Cotton', label: 'Cotton (పత్తి)', icon: '🌱' },
                                { id: 'Tomato', label: 'Tomato (టమోటా)', icon: '🍅' },
                                { id: 'Maize', label: 'Maize (మొక్కజొన్న)', icon: '🌽' },
                                { id: 'Groundnut', label: 'Groundnut (వేరుశనగ)', icon: '🥜' },
                                { id: 'Sugarcane', label: 'Sugarcane (చెరకు)', icon: '🎋' },
                                { id: 'Bengal Gram', label: 'Bengal Gram (శనగ)', icon: '🥣' }
                              ].map(crop => {
                                const isSelected = selectedCrops.includes(crop.id);
                                return (
                                  <button
                                    type="button"
                                    key={crop.id}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedCrops(selectedCrops.filter(c => c !== crop.id));
                                      } else {
                                        setSelectedCrops([...selectedCrops, crop.id]);
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-emerald-400'
                                    }`}
                                  >
                                    <span>{crop.icon}</span>
                                    <span>{crop.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : null}
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

          {activeTab === 'languages' && (
            <div className="space-y-6">
              {/* Header Information Card */}
              <Card glass className="p-5 sm:p-6 border border-emerald-500/30 bg-emerald-500/[0.03] backdrop-blur-md rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-black text-2xl shadow-inner shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        {isTe ? 'స్కాన్ ఫలితాల భాషల ప్రాధాన్యత (1 నుండి 3 భాషలు)' : 'Diagnostic Results Preferred Languages (1 to 3)'}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-0.5">
                        {isTe 
                          ? 'మీరు ఇక్కడ ఎంచుకున్న 1, 2 లేదా 3 భాషలు మాత్రమే వ్యాధి నిర్ధారణ, మొక్కల గుర్తింపు మరియు పురుగుమందుల స్కానర్ ఫలితాల్లో క్విక్ బటన్లుగా కనిపిస్తాయి.' 
                          : 'Scan results across Disease Diagnosis, Plant Identification, and Agrochemical Verification will strictly display ONLY the 1, 2, or 3 languages you choose and save here.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-black border flex items-center gap-1.5 shrink-0 ${
                      preferredLanguages.length === 3
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{preferredLanguages.length} / 3 {isTe ? 'ఎంచుకున్నారు' : 'Selected'}</span>
                    </span>
                  </div>
                </div>

                {/* Notifications & Error Banners */}
                {languagesError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-bold flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{languagesError}</span>
                  </motion.div>
                )}

                {languagesToast && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>{languagesToast}</span>
                  </motion.div>
                )}

                {/* Currently Chosen Languages Sequence Pill Bar */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-white/40">
                      {isTe ? 'ప్రస్తుత ఎంపిక క్రమం:' : 'Active Quick-Switch Order:'}
                    </span>
                    {preferredLanguages.map((code, idx) => {
                      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === code);
                      return (
                        <span 
                          key={code} 
                          className="px-3 py-1 rounded-xl text-xs font-extrabold bg-slate-900 text-white dark:bg-white/10 border border-slate-700/80 flex items-center gap-1.5 shadow-xs"
                        >
                          <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500 text-slate-950 font-black">
                            {idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd'}
                          </span>
                          <span>{langObj?.flag || '🌾'}</span>
                          <span>{langObj?.nativeName || code}</span>
                        </span>
                      );
                    })}
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSavePreferredLanguages}
                    isLoading={savingLanguages}
                    leftIcon={<Save className="w-4 h-4" />}
                    className="shadow-md shadow-emerald-500/20 font-black text-xs"
                  >
                    {isTe ? 'భాషల ప్రాధాన్యతలను సేవ్ చేయండి' : 'Save Language Preferences'}
                  </Button>
                </div>
              </Card>

              {/* 12 Regional Language Cards Selection Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white/40">
                    {isTe ? 'అందుబాటులో ఉన్న భారతీయ భాషలు (కనీసం 1, గరిష్టంగా 3 ఎంచుకోండి)' : 'Select 1, 2, or 3 Languages for Instant Scan Switching'}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-white/40 font-semibold">
                    {preferredLanguages.length}/3 {isTe ? 'ఎంపిక పూర్తయింది' : 'Max Limit'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = preferredLanguages.includes(lang.code);
                    const selectedIdx = preferredLanguages.indexOf(lang.code);

                    return (
                      <motion.div
                        key={lang.code}
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => handleTogglePreferredLanguage(lang.code)}
                        className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 relative select-none ${
                          isSelected
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 dark:border-emerald-400 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/25'
                            : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                              isSelected 
                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs' 
                                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10'
                            }`}>
                              {lang.flag}
                            </div>
                            <div>
                              <h4 className={`text-base font-black tracking-tight ${
                                isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                              }`}>
                                {lang.nativeName}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-white/45 font-semibold">
                                {lang.name}
                              </p>
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-xs">
                                {selectedIdx === 0 ? '1st (Primary)' : selectedIdx === 1 ? '2nd' : '3rd'}
                              </span>
                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-white/20 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 dark:border-white/5">
                          <span className="text-slate-500 dark:text-white/40 truncate max-w-[150px]">
                            {lang.region}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                            {lang.greeting}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Sticky Action Card */}
              <div className="p-4 rounded-2xl bg-slate-900/90 text-white border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-slate-300">
                    {isTe 
                      ? 'సేవ్ చేసిన తర్వాత, మీరు స్కాన్ చేసే ప్రతిసారీ ఫలితాల పైన కేవలం ఈ భాషలే 1-ట్యాప్ బటన్లుగా కనిపిస్తాయి.' 
                      : 'Once saved, every time you scan, strictly only these selected languages will appear as 1-tap quick buttons on the diagnosis screen.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSavePreferredLanguages}
                  isLoading={savingLanguages}
                  leftIcon={<Save className="w-4 h-4" />}
                  className="shadow-lg shadow-emerald-500/25 shrink-0 w-full sm:w-auto font-black"
                >
                  {isTe ? 'భాషల ప్రాధాన్యతలను సేవ్ చేయండి' : 'Save Language Preferences'}
                </Button>
              </div>
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
