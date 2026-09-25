import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sprout, MapPin, Droplets, Cpu, Bell, Save, Navigation, 
  Check, AlertCircle, RefreshCw, ShieldCheck, Thermometer, Radio, Archive, Layers,
  Calendar, Leaf, ScanLine, Clock, ChevronRight, ChevronLeft, Sun, CloudRain, TrendingUp, Eye, Maximize2,
  Plus, Trash2, Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { Card, Button, Input, Select, Switch, Badge, Skeleton } from '../../components/ui/index';
import API from '../../services/api';
import { INDIA_STATES, getDistricts, getMandals, getVillages, getCoordinatesForLocation, geocodeLocationAsync } from '../../data/indiaLocations';
import { getSoilOptions, getLocalizedSoilName, SOIL_TYPES_DATABASE } from '../../data/indiaSoilTypes';
import { useTranslation } from 'react-i18next';
import { translateCrop } from '../../utils/diseaseAdvisoryData';
import FarmRoutineWidget from '../../components/intelligence/FarmRoutineWidget';
import LiveWeatherWidget from '../../components/intelligence/LiveWeatherWidget';
import SprayAdvisorWidget from '../../components/intelligence/SprayAdvisorWidget';
import SoilNPKCalculatorModal from '../../components/farm/SoilNPKCalculatorModal';
import DigitalFarmKhata from '../../components/farm/DigitalFarmKhata';
import GovernmentSchemeNavigator from '../../components/farm/GovernmentSchemeNavigator';
import WhatsAppDiagnosisHub from '../../components/farm/WhatsAppDiagnosisHub';
import CropGrowthTimeline from '../../components/farm/CropGrowthTimeline';

const FarmPage = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const { 
    activeFarm, farms, archivedFarms, createFarm, 
    updateFarm: saveFarmEdit, deleteFarm, unarchiveFarm,
    setActiveFarm: selectActiveFarm,
    loading: contextLoading 
  } = useFarm();
  
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || 'modules';
  const [activeTab, setActiveTabState] = useState(urlTab);

  useEffect(() => {
    const currentTab = searchParams.get('tab') || 'modules';
    setActiveTabState(currentTab);
  }, [searchParams]);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (tab === 'modules') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Farm Info
  const [farmName, setFarmName] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [farmUnit, setFarmUnit] = useState('acres');
  const [fieldsCount, setFieldsCount] = useState(1);
  const [boundaryCoordinates, setBoundaryCoordinates] = useState([]);
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [irrigationMethod, setIrrigationMethod] = useState('Manual');
  const [waterSource, setWaterSource] = useState('Rain Water');
  const [soilType, setSoilType] = useState('red_loamy');

  // Derived cascading options
  const availableDistricts = getDistricts(state);
  const availableMandals = getMandals(state, district);
  const availableVillages = getVillages(state, district, mandal);
  const [customVillage, setCustomVillage] = useState(false);

  // Crop Management
  const [cropName, setCropName] = useState('');
  const [cropVariety, setCropVariety] = useState('');
  const [growthStage, setGrowthStage] = useState('Vegetative');
  const [plantingDate, setPlantingDate] = useState('');

  // IoT Hardware
  const [deviceId, setDeviceId] = useState('');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [firmwareVersion, setFirmwareVersion] = useState('v2.5.0');

  // Alert Preferences
  const [notifications, setNotifications] = useState({
    disease: true,
    rain: true,
    battery: true,
    deviceOffline: true,
    irrigation: true,
    recommendation: true,
    sms: true
  });

  useEffect(() => {
    if (activeFarm) {
      setFarmName(activeFarm.farm_name || '');
      setFarmSize(activeFarm.farm_size || '');
      setFarmUnit(activeFarm.farm_unit || 'acres');
      setFieldsCount(activeFarm.fields_count || 1);
      setCropName(activeFarm.crop_name || '');
      setCropVariety(activeFarm.crop_variety || '');
      setGrowthStage(activeFarm.growth_stage || 'Vegetative');
      setPlantingDate(activeFarm.planting_date || '');
      const farmState = activeFarm.state || '';
      const farmDist = activeFarm.district || '';
      setState(farmState);
      setDistrict(farmDist);
      setMandal(activeFarm.mandal || '');
      setVillage(activeFarm.village || '');

      let initialLat = activeFarm.latitude !== undefined && activeFarm.latitude !== null ? activeFarm.latitude.toString() : '';
      let initialLng = activeFarm.longitude !== undefined && activeFarm.longitude !== null ? activeFarm.longitude.toString() : '';

      // If coordinates are missing or legacy default (16.5062, 80.6480) and district is not Vijayawada, map to actual district coords
      const isLegacyDefault = initialLat && initialLng && Math.abs(parseFloat(initialLat) - 16.5062) < 0.001 && Math.abs(parseFloat(initialLng) - 80.6480) < 0.001;
      if ((!initialLat || !initialLng || isLegacyDefault) && (farmDist || farmState)) {
        if (farmDist !== 'NT R' && farmDist !== 'Krishna') {
          const [dLat, dLng] = getCoordinatesForLocation(farmState, farmDist);
          initialLat = dLat.toFixed(6);
          initialLng = dLng.toFixed(6);
        }
      }

      setLatitude(initialLat);
      setLongitude(initialLng);
      setIrrigationMethod(activeFarm.irrigation_method || 'Manual');
      setWaterSource(activeFarm.water_source || 'Rain Water');
      setSoilType(activeFarm.soil_type || 'red_loamy');
      setDeviceId(activeFarm.device_id || '');
      setBoundaryCoordinates(activeFarm.boundary_coordinates || []);
    }
  }, [activeFarm]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await API.get('/api/v1/devices/status');
        setAvailableDevices(res.data || []);
      } catch (err) {
        console.warn("Failed to fetch available devices:", err);
      }
    };
    fetchDevices();
  }, []);

  // Compute dynamic farmer center coordinates: use manual/GPS coordinates if valid, else resolve from village/mandal/district/state
  const [districtDefaultLat, districtDefaultLng] = getCoordinatesForLocation(state, district, mandal, village);
  const effectiveLat = latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : districtDefaultLat;
  const effectiveLng = longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : districtDefaultLng;

  const handleFetchGeolocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setErrorMsg('Unable to retrieve location. Please grant location permission.');
      },
      { timeout: 8000 }
    );
  };

  const handleSaveFarm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setToastMsg('');

    try {
      const payload = {
        farm_name: farmName.trim() || 'My Farm Sector',
        farm_size: parseFloat(farmSize) > 0 ? parseFloat(farmSize) : 1.0,
        farm_unit: farmUnit || 'acres',
        number_of_fields: parseInt(fieldsCount) || 1,
        crop_name: cropName || 'Tomato',
        crop_variety: cropVariety || 'Standard',
        growth_stage: growthStage || 'Vegetative',
        planting_date: plantingDate || new Date().toISOString().split('T')[0],
        state: state || 'Andhra Pradesh',
        district: district || '',
        mandal: mandal || '',
        village: village || '',
        latitude: effectiveLat,
        longitude: effectiveLng,
        irrigation_method: irrigationMethod || 'Manual',
        water_source: waterSource || 'Rain Water',
        soil_type: soilType || 'red_loamy',
        device_id: deviceId || '',
        boundary_coordinates: boundaryCoordinates && boundaryCoordinates.length >= 3 ? boundaryCoordinates : undefined
      };

      if (activeFarm && activeFarm.id) {
        await saveFarmEdit(activeFarm.id, payload);
      } else {
        await createFarm(payload);
      }

      try {
        const savedFP = JSON.parse(localStorage.getItem('agrishield_farmer_profile') || '{}');
        savedFP.total_acres = String(payload.farm_size || savedFP.total_acres || '2.5');
        savedFP.acres = savedFP.total_acres;
        savedFP.soil_type = payload.soil_type || savedFP.soil_type;
        savedFP.irrigation_source = payload.irrigation_method || savedFP.irrigation_source;
        if (payload.crop_name && !savedFP.selected_crops?.includes(payload.crop_name)) {
          savedFP.selected_crops = [payload.crop_name, ...(savedFP.selected_crops || [])];
        }
        localStorage.setItem('agrishield_farmer_profile', JSON.stringify(savedFP));
      } catch (_) {}

      setToastMsg(t('farm_page.saved_success', 'Farm & Agronomic details saved successfully!'));
    } catch (err) {
      console.error("Save farm error:", err);
      let msg = t('farm_page.save_failed', 'Failed to save farm details.');
      if (typeof err.response?.data?.detail === 'string') {
        msg = err.response.data.detail;
      } else if (Array.isArray(err.response?.data?.detail)) {
        msg = err.response.data.detail.map(d => `${d.loc?.join('.') || 'field'}: ${d.msg}`).join('; ');
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const FIELD_MODULES = [
    { 
      id: 'my-fields', 
      title: isTe ? 'నా పొలాలు & రంగాలు' : 'My Fields & Sectors', 
      subtitle: isTe 
        ? `${farms.length} రిజిస్టర్డ్ పొలాల జాబితా, క్రియాశీల మార్పిడి & కొత్త పొలం జోడించండి` 
        : `Switch between & manage all ${farms.length} registered field sectors or add a new field`,
      icon: '🌾',
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    },
    { 
      id: 'field-setup', 
      title: isTe ? 'పొలం సెటప్ & సమాచారం' : 'Field Setup & Crops', 
      subtitle: isTe ? 'పంట పేరు, రకం, నాట్లు తేదీ, ఎకరాలు, నేల రకం & నీటి వనరు' : 'Crop variety, planting date, acreage, soil classification & irrigation source',
      icon: '⚙️',
      bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    },
    { 
      id: 'farm-khata', 
      title: isTe ? 'డిజిటల్ పొలం ఖాతా & పాస్‌బుక్' : 'Digital Farm Khata', 
      subtitle: isTe ? 'సాగు ఖర్చులు, దిగుబడి అమ్మకాలు, ఎకరాకు నికర లాభం & వాట్సాప్ లెడ్జర్' : 'Track cultivation expenses, harvest sales & net profit per acre with WhatsApp ledger',
      icon: '💰',
      bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    },
    { 
      id: 'soil-npk', 
      title: isTe ? 'NPK ఎరువుల కాలిక్యులేటర్' : 'Fertilizer & NPK Calculator', 
      subtitle: isTe ? 'యూరియా, DAP, పొటాష్ బస్తాల ఖచ్చితమైన లెక్క & స్ప్రే మోతాదు' : 'Exact Urea, DAP & Potash bag recommendations tailored for your acres',
      icon: '💊',
      bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    },
    { 
      id: 'crop-lifecycle', 
      title: isTe ? 'పంట దశలు & పనుల క్యాలెండర్' : 'Crop Timeline & Tasks', 
      subtitle: isTe ? 'విత్తిన తర్వాత రోజులు (DAS), దశల ప్రగతి & వారపు పనుల చెక్‌లిస్ట్' : 'Days after sowing (DAS), stage milestones & weekly actionable tasks',
      icon: '🌱',
      bg: 'bg-lime-500/10 text-lime-600 dark:text-lime-400'
    },
    { 
      id: 'farm-intelligence', 
      title: isTe ? 'స్ప్రే సలహాదారు & వాతావరణం' : 'Rain & Spray Advisor', 
      subtitle: isTe ? 'మందులు పిచికారీ చేయడానికి ముందు లైవ్ వర్షం హెచ్చరిక & సురక్షిత విండో' : 'Live weather forecasts, rain risk window & safe chemical spraying advisor',
      icon: '🌦️',
      bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
    },
    { 
      id: 'government-schemes', 
      title: isTe ? 'ప్రభుత్వ పథకాలు & సబ్సిడీలు' : 'Govt Schemes & Subsidies', 
      subtitle: isTe ? 'పీఎం కిసాన్, రైతు భరోసా, 90% డ్రిప్ సబ్సిడీ & పంట బీమా' : 'Direct links, PM-Kisan status, 90% drip subsidy eligibility & crop insurance',
      icon: '🏛️',
      bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
    },
    { 
      id: 'whatsapp-diagnosis', 
      title: isTe ? 'వాట్సాప్ పంట డాక్టర్ బాట్' : 'WhatsApp Crop Doctor', 
      subtitle: isTe ? 'వాట్సాప్‌లో ఆకు ఫోటో పంపి తక్షణమే తెలుగు వాయిస్ సలహా పొందండి' : 'Send crop leaf photo on WhatsApp for instant AI diagnosis and voice note',
      icon: '📱',
      bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
    }
  ];

  if (contextLoading && farms.length === 0) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto w-full pb-16">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4">
          <Skeleton className="h-10 w-64 rounded-xl animate-pulse" />
          <Skeleton className="h-4.5 w-96 rounded-xl mt-2 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto w-full pb-16">

      {/* Dedicated Fresh Page Header for Sub-Tabs */}
      {activeTab !== 'modules' && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4 mb-2">
          <button
            type="button"
            onClick={() => setActiveTab('modules')}
            className="flex items-center gap-2 text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors py-1 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>{isTe ? '← ఫీల్డ్ డాష్‌బోర్డ్‌కు తిరిగి' : '← Back to Field Overview'}</span>
          </button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-bold">
              {activeFarm?.farm_name || 'My Farm'}
            </Badge>
            {(activeTab === 'field-setup' || activeTab === 'crop-lifecycle') && (
              <Button size="sm" onClick={handleSaveFarm} isLoading={loading} leftIcon={<Save className="w-3.5 h-3.5" />}>
                {t('farm_page.save_changes', 'Save All Changes')}
              </Button>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ═══════ QUICK FIELD SECTOR SWITCHER ═══════ */}
      {activeTab === 'modules' && farms.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-2.5 px-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isTe ? 'క్రియాశీల పొలం:' : 'Active Field:'}
            </span>
            {farms.map((f) => {
              const isSelected = f.id === activeFarm?.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={async () => {
                    if (selectActiveFarm && !isSelected) {
                      await selectActiveFarm(f.id);
                      setToastMsg(isTe ? `${f.farm_name} క్రియాశీల పొలంగా మార్చబడింది!` : `Switched to ${f.farm_name}!`);
                      setTimeout(() => setToastMsg(''), 3000);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                  }`}
                >
                  <span>{f.farm_name || 'Field'}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('my-fields')}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 ml-2 cursor-pointer flex items-center gap-1"
          >
            <span>{isTe ? 'అన్నీ చూడండి' : 'View All'}</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* ═══════ PREMIUM FARM HERO BANNER — Only on Overview Tab ═══════ */}
      {activeTab === 'modules' && activeFarm && (() => {
        const plantDate = activeFarm.planting_date ? new Date(activeFarm.planting_date) : null;
        const today = new Date();
        const daysSincePlanting = plantDate ? Math.max(0, Math.floor((today - plantDate) / (1000 * 60 * 60 * 24))) : 0;
        const cropEmoji = {
          'Tomato': '🍅', 'Potato': '🥔', 'Corn': '🌽', 'Rice': '🌾', 'Wheat': '🌾',
          'Cotton': '🧶', 'Chilli': '🌶️', 'Sugarcane': '🎋', 'Soybean': '🫘',
          'Onion': '🧅', 'Grape': '🍇', 'Apple': '🍎', 'Mango': '🥭', 'Banana': '🍌',
          'Citrus': '🍊', 'Strawberry': '🍓', 'Peach': '🍑', 'Cucumber': '🥒'
        }[activeFarm.crop_name] || '🌱';
        const growthPercent = plantDate ? Math.min(100, Math.round((daysSincePlanting / 120) * 100)) : 0;
        const soilLabel = activeFarm.soil_type ? getLocalizedSoilName(activeFarm.soil_type, i18n.language) : (isTe ? 'ఎర్ర చల్కా' : 'Red Loamy');

        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900"
          >
            {/* Gradient Hero Card */}
            <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 dark:from-emerald-900 dark:via-teal-900 dark:to-emerald-950 p-5 pb-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg shadow-black/10">
                      {cropEmoji}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white leading-tight">
                        {activeFarm.farm_name || (isTe ? 'నా పొలం' : 'My Farm')}
                      </h2>
                      <p className="text-xs text-white/70 font-medium mt-0.5">
                        {activeFarm.village && `${activeFarm.village}, `}{activeFarm.district || ''}
                      </p>
                    </div>
                  </div>
                  {plantDate && (
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center shadow-lg">
                      <span className="text-xl font-black text-white leading-none block">{daysSincePlanting}</span>
                      <span className="text-[9px] font-bold text-white/80 uppercase tracking-wide">
                        {isTe ? 'రోజుల వయసు' : 'Days Old'}
                      </span>
                    </div>
                  )}
                </div>

                {plantDate && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-white/70 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Sprout className="w-3 h-3" />
                        {isTe ? 'పెరుగుదల పురోగతి' : 'Growth Progress'}
                      </span>
                      <span className="text-white/90">{growthPercent}%</span>
                    </div>
                    <div className="h-2 bg-white/15 rounded-full overflow-hidden backdrop-blur-sm">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${growthPercent}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                        className="h-full bg-gradient-to-r from-lime-300 via-green-300 to-emerald-200 rounded-full shadow-sm"
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-semibold text-white/50 mt-1">
                      <span>{isTe ? 'నాట్లు వేసిన' : 'Planted'}</span>
                      <span className="text-white/70">{activeFarm.growth_stage || 'Vegetative'}</span>
                      <span>{isTe ? 'పంట కోత' : 'Harvest'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Balanced White Metric Cards */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-900/40 rounded-b-3xl">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isTe ? 'పంట' : 'CROP'}
                  </span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug truncate">
                    {translateCrop(activeFarm.crop_name || 'Tomato', i18n.language)}
                  </p>
                  <div className="mt-1 flex items-center min-h-[20px]">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                      {activeFarm.crop_variety || 'Standard'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isTe ? 'దశ' : 'STAGE'}
                  </span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug truncate">
                    {activeFarm.growth_stage || 'Vegetative'}
                  </p>
                  <div className="mt-1 flex items-center min-h-[20px]">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                      <Check className="w-2.5 h-2.5" />{isTe ? 'ఆరోగ్యం' : 'Healthy'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-3.5 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isTe ? 'భూమి' : 'LAND'}
                  </span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug truncate">
                    {activeFarm.farm_size || '1'} {activeFarm.farm_unit || 'Acres'}
                  </p>
                  <div className="mt-1 flex items-center min-h-[20px]">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                      {soilLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Row */}
            <div className="flex gap-2.5 p-3.5 pt-0">
              <button
                type="button"
                onClick={() => setActiveTab('crop-lifecycle')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Leaf className="w-3.5 h-3.5" />
                <span>{isTe ? 'పంట వివరాలు' : 'Crop Details'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 text-sky-700 dark:text-sky-300 text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-all active:scale-[0.98] cursor-pointer"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>{isTe ? 'AI స్కాన్' : 'AI Scan'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isTe ? 'చరిత్ర' : 'History'}</span>
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* ═══════ FIELD MODULES — Clean 2-Column Boxes (Picture 1 Style) ═══════ */}
      {activeTab === 'modules' && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
              {isTe ? 'వ్యవసాయ సాధనాలు & ఫీల్డ్ మాడ్యూల్స్' : 'Field Tools & Agronomic Modules'}
            </h3>
            <span className="text-[11px] font-bold text-slate-400">
              {FIELD_MODULES.length} {isTe ? 'సాధనాలు' : 'Modules'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {FIELD_MODULES.map((mod, idx) => (
              <motion.button
                key={mod.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(mod.id)}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all text-left flex flex-col justify-between group cursor-pointer min-h-[140px]"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${mod.bg}`}>
                    {mod.icon}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950 transition-colors">
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">
                    {mod.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed font-medium">
                    {mod.subtitle}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ DRILL: My Fields & Sectors ═══════ */}
      {activeTab === 'my-fields' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                {isTe ? 'నా రిజిస్టర్డ్ పొలాలు' : 'My Registered Fields & Sectors'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isTe 
                  ? `మీ వద్ద మొత్తం ${farms.length} రిజిస్టర్డ్ పొలాలు ఉన్నాయి. కావలసిన పొలంపై క్లిక్ చేసి మార్చండి.` 
                  : `You have ${farms.length} registered field sectors. Tap any field to switch active profile.`}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={async () => {
                try {
                  await createFarm({
                    farm_name: `${t('farm_page.new_farm_prefix', 'New Farm Sector')} ${farms.length + 1}`,
                    soil_type: 'red_loamy'
                  });
                  setToastMsg(isTe ? 'కొత్త పొలం సృష్టించబడింది!' : 'New field sector created!');
                  setTimeout(() => setToastMsg(''), 3000);
                } catch (e) {
                  console.error(e);
                  setErrorMsg('Failed to create new field');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
            >
              {isTe ? '+ కొత్త పొలం జోడించండి' : '+ Add New Field'}
            </Button>
          </div>

          {/* List of Registered Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {farms.map((farm) => {
              const isActive = farm.id === activeFarm?.id;
              const farmCropEmoji = {
                'Tomato': '🍅', 'Potato': '🥔', 'Corn': '🌽', 'Rice': '🌾', 'Wheat': '🌾',
                'Cotton': '🧶', 'Chilli': '🌶️', 'Sugarcane': '🎋', 'Soybean': '🫘',
                'Onion': '🧅', 'Grape': '🍇', 'Apple': '🍎', 'Mango': '🥭', 'Banana': '🍌',
                'Citrus': '🍊', 'Strawberry': '🍓', 'Peach': '🍑', 'Cucumber': '🥒'
              }[farm.crop_name] || '🌱';

              return (
                <Card
                  key={farm.id}
                  glass
                  className={`p-4 sm:p-5 relative transition-all duration-200 ${
                    isActive 
                      ? 'border-2 border-emerald-500 dark:border-emerald-400 ring-4 ring-emerald-500/10 shadow-md shadow-emerald-500/10' 
                      : 'border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-xl flex items-center justify-center shrink-0">
                        {farmCropEmoji}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {farm.farm_name || 'Unnamed Field'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {farm.village ? `${farm.village}, ` : ''}{farm.district || 'Location pending'}
                        </p>
                      </div>
                    </div>
                    {isActive ? (
                      <Badge variant="glow-emerald" className="text-[11px] font-black shrink-0 px-2.5 py-1">
                        ✓ {isTe ? 'క్రియాశీలం' : 'Active Field'}
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (selectActiveFarm) {
                            await selectActiveFarm(farm.id);
                            setToastMsg(isTe ? `${farm.farm_name} క్రియాశీల పొలంగా మార్చబడింది!` : `Switched active field to ${farm.farm_name}!`);
                            setTimeout(() => setToastMsg(''), 3000);
                          }
                        }}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                      >
                        {isTe ? 'దీనికి మారండి' : 'Switch Active'}
                      </button>
                    )}
                  </div>

                  {/* Field Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-xs mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'పంట' : 'Crop'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">
                        {farm.crop_name || 'Not set'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'విస్తీర్ణం' : 'Area'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 block">
                        {farm.farm_size ? `${farm.farm_size} ${farm.farm_unit || 'acres'}` : 'Not set'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{isTe ? 'నేల' : 'Soil'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">
                        {farm.soil_type ? getLocalizedSoilName(farm.soil_type, i18n.language) : 'Red Loamy'}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!isActive && selectActiveFarm) {
                          await selectActiveFarm(farm.id);
                        }
                        setActiveTab('field-setup');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>{isTe ? 'సెటప్ & కాన్ఫిగర్' : 'Setup & GPS'}</span>
                    </button>
                    {farms.length > 1 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(isTe ? `ఖచ్చితంగా "${farm.farm_name}" పొలాన్ని తొలగించాలా?` : `Are you sure you want to delete "${farm.farm_name}"?`)) {
                            try {
                              await deleteFarm(farm.id);
                              setToastMsg(isTe ? 'పొలం తొలగించబడింది.' : 'Field deleted.');
                              setTimeout(() => setToastMsg(''), 3000);
                            } catch (e) {
                              console.error(e);
                              setErrorMsg('Failed to delete farm');
                            }
                          }
                        }}
                        className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={isTe ? 'తొలగించు' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Archived Fields Section (if any) */}
          {archivedFarms && archivedFarms.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Archive className="w-4 h-4" />
                <span>{isTe ? 'ఆర్కైవ్ చేసిన పొలాలు' : 'Archived Fields'}</span>
                <Badge variant="outline" className="text-[10px]">{archivedFarms.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {archivedFarms.map((af) => (
                  <div key={af.id} className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{af.farm_name}</span>
                      <span className="text-[11px] text-slate-400">{af.crop_name || 'No crop'} • {af.village || 'No village'}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await unarchiveFarm(af.id);
                          setToastMsg(isTe ? 'పొలం పునరుద్ధరించబడింది!' : 'Field restored!');
                          setTimeout(() => setToastMsg(''), 3000);
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      {isTe ? 'పునరుద్ధరించు' : 'Restore'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════ DRILL: Field Setup & Location ═══════ */}
      {activeTab === 'field-setup' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <form onSubmit={handleSaveFarm} className="space-y-5">
            <Card glass className="p-3.5 sm:p-5 space-y-5 w-full max-w-full min-w-0 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isTe ? 'పొలం సెటప్ & GPS కోఆర్డినేట్స్' : 'Farm Sector & GPS Coordinates'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTe ? 'మీ పొలం వివరాలు, అక్షాంశం/రేఖాంశం సెట్ చేయండి' : 'Set registered farm sector details and precise coordinates.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('farm_page.info.sector_name', 'Farm Sector Name')} placeholder={t('farm_page.info.sector_placeholder', 'e.g. Green Acre Tomato Sector')} value={farmName} onChange={(e) => setFarmName(e.target.value)} required />
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input label={t('farm_page.info.total_area', 'Total Farm Area')} type="number" placeholder="e.g. 2.5" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} />
                    <Select label={t('farm_page.info.area_unit', 'Area Unit')} value={farmUnit} onChange={(e) => setFarmUnit(e.target.value)}
                      options={[
                        { value: 'acres', label: t('farm_page.info.units.acres', 'Acres') },
                        { value: 'hectares', label: t('farm_page.info.units.hectares', 'Hectares') },
                        { value: 'cents', label: t('farm_page.info.units.cents', 'Cents') }
                      ]} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-white/40">{isTe ? "త్వరిత ఎంపిక:" : "Quick select:"}</span>
                    {[
                      { val: '0.5', label: isTe ? '0.5 ఎకరం' : '0.5 Acre' },
                      { val: '1.0', label: isTe ? '1 ఎకరం' : '1 Acre' },
                      { val: '2.0', label: isTe ? '2 ఎకరాలు' : '2 Acres' },
                      { val: '3.0', label: isTe ? '3 ఎకరాలు' : '3 Acres' },
                      { val: '5.0', label: isTe ? '5 ఎకరాలు' : '5 Acres' },
                      { val: '10.0', label: isTe ? '10 ఎకరాలు' : '10 Acres' }
                    ].map((preset) => (
                      <button key={preset.val} type="button" onClick={() => { setFarmSize(preset.val); setFarmUnit('acres'); }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                          String(farmSize) === preset.val && farmUnit === 'acres'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-600'
                        }`}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* India Location Selector */}
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                    {t('farm_page.info.india_location', 'Farm Location (India)')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.state', 'State / UT')} <span className="text-rose-500">*</span></label>
                    <select value={state} onChange={(e) => {
                      const newState = e.target.value;
                      setState(newState);
                      setDistrict('');
                      setMandal('');
                      if (newState) {
                        const [sLat, sLng] = getCoordinatesForLocation(newState, '');
                        setLatitude(sLat.toFixed(6));
                        setLongitude(sLng.toFixed(6));
                      }
                    }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" required>
                      <option value="">{t('farm_page.info.select_state', '-- Select State / UT --')}</option>
                      {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.district', 'District')} <span className="text-rose-500">*</span></label>
                    <select value={district} onChange={(e) => {
                      const newDist = e.target.value;
                      setDistrict(newDist);
                      setMandal('');
                      if (newDist) {
                        const [dLat, dLng] = getCoordinatesForLocation(state, newDist);
                        setLatitude(dLat.toFixed(6));
                        setLongitude(dLng.toFixed(6));
                      }
                    }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" disabled={!state} required>
                      <option value="">{state ? t('farm_page.info.select_district', '-- Select District --') : t('farm_page.info.select_state_first', '-- Select State first --')}</option>
                      {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.mandal', 'Mandal / Taluka')}</label>
                    <select value={mandal} onChange={async (e) => {
                      const newMandal = e.target.value;
                      setMandal(newMandal);
                      setVillage('');
                      setCustomVillage(false);
                      if (newMandal) {
                        const coords = await geocodeLocationAsync(state, district, newMandal, '');
                        if (coords && coords.length === 2) {
                          setLatitude(coords[0].toFixed(6));
                          setLongitude(coords[1].toFixed(6));
                        }
                      }
                    }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" disabled={!district}>
                      <option value="">{district ? t('farm_page.info.select_mandal', '-- Select Mandal --') : t('farm_page.info.select_district_first', '-- Select District first --')}</option>
                      {availableMandals.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.village', 'Village / Town')}</label>
                    <select value={village} onChange={async (e) => {
                      const newVillage = e.target.value;
                      setVillage(newVillage);
                      if (newVillage) {
                        const coords = await geocodeLocationAsync(state, district, mandal, newVillage);
                        if (coords && coords.length === 2) {
                          setLatitude(coords[0].toFixed(6));
                          setLongitude(coords[1].toFixed(6));
                        }
                      }
                    }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" disabled={!mandal}>
                      <option value="">{!mandal ? t('farm_page.info.select_mandal_first', '-- Select Mandal first --') : availableVillages.length > 0 ? t('farm_page.info.select_village', '-- Select Village --') : t('farm_page.info.select_village_sector', '-- Select Village / Sector --')}</option>
                      {availableVillages.map(v => <option key={v} value={v}>{v}</option>)}
                      {availableVillages.length === 0 && mandal && (
                        <>
                          <option value={`${mandal} Central Village`}>{mandal} Central Village</option>
                          <option value={`${mandal} North Sector`}>{mandal} North Sector</option>
                          <option value={`${mandal} South Sector`}>{mandal} South Sector</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                {(state || district || mandal || village) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('farm_page.info.selected', 'Selected:')}</span>
                    {village && <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold rounded-full">{village}</span>}
                    {mandal && <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[11px] font-semibold rounded-full">{mandal}</span>}
                    {district && <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-[11px] font-semibold rounded-full">{district}</span>}
                    {state && <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-semibold rounded-full">{state}</span>}
                    {(village || mandal) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md ml-auto">
                        <Check className="w-3 h-3" />
                        {isTe ? `మ్యాప్ ఆటోమేటిక్‌గా ${village || mandal} వద్ద సెట్ చేయబడింది` : `Map auto-centered on ${village || mandal}`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* GPS Coordinates */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <button type="button" onClick={handleFetchGeolocation} disabled={geoLoading}
                  className="w-full p-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md flex items-center justify-between transition-all transform active:scale-[0.99] group text-left cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 rounded-xl">
                      <Navigation className={`w-5 h-5 ${geoLoading ? 'animate-spin' : 'group-hover:translate-x-0.5 transition-transform'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-black">{isTe ? "📍 నా ప్రస్తుత పొలం స్థానాన్ని తీసుకోండి" : "📍 Capture My Current Field GPS"}</p>
                      <p className="text-xs text-white/80">{isTe ? "మీ ఫోన్ లొకేషన్ ద్వారా ఆటోమేటిక్‌గా తీసుకుంటుంది" : "Automatically fetches GPS from your device"}</p>
                    </div>
                  </div>
                </button>
                {latitude && longitude && (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{isTe ? `లొకేషన్: ${latitude}° N, ${longitude}° E` : `Coordinates: ${latitude}° N, ${longitude}° E`}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <Input label={t('farm_page.info.latitude', 'Latitude (°N)')} placeholder="e.g. 16.5062" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                  <Input label={t('farm_page.info.longitude', 'Longitude (°E)')} placeholder="e.g. 80.6480" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                </div>
              </div>

              {/* Regional Soil Selection */}
              <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400"><Layers className="w-4 h-4" /></div>
                    <h3 className="text-xs font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider">
                      {isTe ? "ప్రాంతీయ నేల రకం (మట్టి స్వభావం)" : t('farm_page.info.soil_type', `Regional Soil Classification (${state || 'India'})`)}
                    </h3>
                  </div>
                  <span className="self-start sm:self-auto text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">{state || 'India'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {getSoilOptions(state, i18n.language).map((soil) => {
                    const isSelected = soilType === soil.value;
                    const dbSoil = SOIL_TYPES_DATABASE[soil.value];
                    return (
                      <button key={soil.value} type="button" onClick={() => setSoilType(soil.value)}
                        className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                          isSelected ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md' : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                        }`}>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-black ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>{soil.label}</span>
                            {isSelected ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs"><Check className="w-3 h-3 stroke-[3]" /></span>
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                            <span className="flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded-md">
                              <Droplets className="w-3 h-3" />
                              {isTe ? `నీటి నిల్వ: ~${soil.waterRetentionDays} రోజులు` : `Retention: ~${soil.waterRetentionDays} Days`}
                            </span>
                            <span className="text-[10px] font-medium">{dbSoil?.drainage}</span>
                          </div>
                        </div>
                        {soil.bestCrops?.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{isTe ? "అనుకూల పంటలు:" : "Best for:"}</span>
                            {soil.bestCrops.slice(0, 3).map((crop) => (
                              <span key={crop} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">{translateCrop(crop, i18n.language)}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Irrigation & Water */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label={t('farm_page.info.irrigation_method', 'Irrigation Method')} value={irrigationMethod} onChange={(e) => setIrrigationMethod(e.target.value)}
                  options={[
                    { value: 'Drip', label: t('farm_page.info.irrigation.drip', 'Drip Irrigation') },
                    { value: 'Sprinkler', label: t('farm_page.info.irrigation.sprinkler', 'Sprinkler System') },
                    { value: 'Flood', label: t('farm_page.info.irrigation.flood', 'Flood / Furrow') },
                    { value: 'Manual', label: t('farm_page.info.irrigation.manual', 'Manual Watering') }
                  ]} />
                <Select label={t('farm_page.info.water_source', 'Water Source')} value={waterSource} onChange={(e) => setWaterSource(e.target.value)}
                  options={[
                    { value: 'Borewell', label: t('farm_page.info.water.borewell', 'Borewell') },
                    { value: 'Canal', label: t('farm_page.info.water.canal', 'Canal') },
                    { value: 'Rain Water', label: t('farm_page.info.water.rain', 'Rain Water Tank') },
                    { value: 'River', label: t('farm_page.info.water.river', 'River / Reservoir') }
                  ]} />
              </div>
            </Card>

            <div className="flex justify-end pt-1">
              <Button type="submit" isLoading={loading} leftIcon={<Save className="w-4 h-4" />}>
                {t('farm_page.save_changes', 'Save All Changes')}
              </Button>
            </div>
          </form>
        </motion.div>
      )}


      {/* ═══════ DRILL: Farm Intelligence & Routine ═══════ */}
      {activeTab === 'farm-intelligence' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <FarmRoutineWidget />
            </div>
            <LiveWeatherWidget />
            <SprayAdvisorWidget />
          </div>
        </motion.div>
      )}

      {/* ═══════ DRILL: Crop Lifecycle & Spray Calendar ═══════ */}
      {activeTab === 'crop-lifecycle' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
          <CropGrowthTimeline
            farmName={farmName || activeFarm?.farm_name || 'My Farm'}
            cropName={cropName || 'Tomato'}
            plantingDate={plantingDate || '2026-08-15'}
            acreage={parseFloat(farmSize) || 2.0}
            village={village || activeFarm?.village || 'Pasupugallu'}
            onClose={() => setActiveTab('modules')}
          />

          <form onSubmit={handleSaveFarm} className="space-y-5">
            <Card glass className="p-5 space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isTe ? 'పంట వివరాల ఎడిటర్' : 'Crop Stage & Sowing Date Settings'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTe ? 'పంట రకం, దశ, నాటే తేదీ సెట్ చేయండి' : 'Specify active crop type, growth stage, and planting date.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={t('farm_page.crop.primary_crop', 'Primary Crop')}
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  options={[
                    { value: 'Tomato', label: `🍅 ${translateCrop('Tomato', i18n.language)}` },
                    { value: 'Potato', label: `🥔 ${translateCrop('Potato', i18n.language)}` },
                    { value: 'Corn', label: `🌽 ${translateCrop('Corn', i18n.language)}` },
                    { value: 'Rice', label: `🌾 ${translateCrop('Rice', i18n.language)}` },
                    { value: 'Wheat', label: `🌾 ${translateCrop('Wheat', i18n.language)}` },
                    { value: 'Cotton', label: `🧶 ${translateCrop('Cotton', i18n.language)}` },
                    { value: 'Chilli', label: `🌶️ ${translateCrop('Chilli', i18n.language)}` },
                    { value: 'Sugarcane', label: `🎋 ${translateCrop('Sugarcane', i18n.language)}` },
                    { value: 'Soybean', label: `🫘 ${translateCrop('Soybean', i18n.language)}` },
                    { value: 'Onion', label: `🧅 ${translateCrop('Onion', i18n.language)}` },
                    { value: 'Grape', label: `🍇 ${translateCrop('Grape', i18n.language)}` },
                    { value: 'Apple', label: `🍎 ${translateCrop('Apple', i18n.language)}` },
                    { value: 'Mango', label: `🥭 ${translateCrop('Mango', i18n.language)}` },
                    { value: 'Banana', label: `🍌 ${translateCrop('Banana', i18n.language)}` },
                    { value: 'Citrus', label: `🍊 ${translateCrop('Citrus', i18n.language)}` },
                    { value: 'Strawberry', label: `🍓 ${translateCrop('Strawberry', i18n.language)}` },
                    { value: 'Peach', label: `🍑 ${translateCrop('Peach', i18n.language)}` },
                    { value: 'Cucumber', label: `🥒 ${translateCrop('Cucumber', i18n.language)}` }
                  ]}
                />
                <Input label={t('farm_page.crop.variety', 'Crop Variety / Hybrid')} placeholder={t('farm_page.crop.variety_placeholder', 'e.g. Arka Rakshak / Hybrid 88')} value={cropVariety} onChange={(e) => setCropVariety(e.target.value)} />
                <Select
                  label={t('farm_page.crop.growth_stage', 'Current Growth Stage')}
                  value={growthStage}
                  onChange={(e) => setGrowthStage(e.target.value)}
                  options={[
                    { value: 'Nursery', label: t('farm_page.crop.stages.nursery', 'Nursery / Seedling') },
                    { value: 'Vegetative', label: t('farm_page.crop.stages.vegetative', 'Vegetative Growth') },
                    { value: 'Flowering', label: t('farm_page.crop.stages.flowering', 'Flowering & Budding') },
                    { value: 'Fruiting', label: t('farm_page.crop.stages.fruiting', 'Fruiting & Maturation') },
                    { value: 'Harvesting', label: t('farm_page.crop.stages.harvesting', 'Harvesting Phase') }
                  ]}
                />
                <Input label={t('farm_page.crop.planting_date', 'Planting / Sowing Date')} type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
              </div>
            </Card>

            <div className="flex justify-end pt-1">
              <Button type="submit" isLoading={loading} leftIcon={<Save className="w-4 h-4" />}>
                {t('farm_page.save_changes', 'Save All Changes')}
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ═══════ DRILL: Digital Farm Khata & Passbook ═══════ */}
      {activeTab === 'farm-khata' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <DigitalFarmKhata
            farmName={farmName || activeFarm?.farm_name || 'My Farm'}
            acreage={parseFloat(farmSize) || 2.0}
            cropName={cropName || 'Tomato'}
            village={village || activeFarm?.village || 'Pasupugallu'}
            onClose={() => setActiveTab('modules')}
          />
        </motion.div>
      )}

      {/* ═══════ DRILL: Government Scheme & Subsidy Navigator ═══════ */}
      {activeTab === 'government-schemes' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <GovernmentSchemeNavigator
            farmName={farmName || activeFarm?.farm_name || 'My Farm'}
            acreage={parseFloat(farmSize) || 2.0}
            cropName={cropName || 'Tomato'}
            district={district || activeFarm?.district || 'Prakasam'}
            village={village || activeFarm?.village || 'Pasupugallu'}
            onClose={() => setActiveTab('modules')}
          />
        </motion.div>
      )}

      {/* ═══════ DRILL: WhatsApp Bot Photo Diagnosis ═══════ */}
      {activeTab === 'whatsapp-diagnosis' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <WhatsAppDiagnosisHub
            farmName={farmName || activeFarm?.farm_name || 'My Farm'}
            village={village || activeFarm?.village || 'Pasupugallu'}
            cropName={cropName || 'Tomato'}
            onClose={() => setActiveTab('modules')}
          />
        </motion.div>
      )}

      {/* ═══════ DRILL: Soil Health & NPK Calculator ═══════ */}
      {activeTab === 'soil-npk' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <SoilNPKCalculatorModal
            isOpen={true}
            onClose={() => setActiveTab('modules')}
            initialCrop={cropName || 'Tomato'}
            initialAcres={parseFloat(farmSize) || 2.0}
          />
        </motion.div>
      )}
    </div>
  );
};

export default FarmPage;
