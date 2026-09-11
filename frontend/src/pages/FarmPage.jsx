import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sprout, MapPin, Droplets, Cpu, Bell, Save, Navigation, 
  Check, AlertCircle, RefreshCw, ShieldCheck, Thermometer, Radio, Archive, Layers,
  Calendar, Leaf, ScanLine, Clock, ChevronRight, Sun, CloudRain, TrendingUp, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { Card, Button, Input, Select, Switch, Badge, Skeleton } from '../components/ui/index';
import API from '../services/api';
import { INDIA_STATES, getDistricts, getMandals, getVillages } from '../data/indiaLocations';
import { getSoilOptions, getLocalizedSoilName, SOIL_TYPES_DATABASE } from '../data/indiaSoilTypes';
import { useTranslation } from 'react-i18next';
import { translateCrop } from '../utils/diseaseAdvisoryData';

const FarmPage = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const { 
    activeFarm, farms, archivedFarms, createFarm, 
    updateFarm: saveFarmEdit, deleteFarm, unarchiveFarm,
    loading: contextLoading 
  } = useFarm();
  
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [activeTab, setActiveTab] = useState('modules');

  // Farm Info
  const [farmName, setFarmName] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [farmUnit, setFarmUnit] = useState('acres');
  const [fieldsCount, setFieldsCount] = useState(1);
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
      setState(activeFarm.state || '');
      setDistrict(activeFarm.district || '');
      setMandal(activeFarm.mandal || '');
      setVillage(activeFarm.village || '');
      setLatitude(activeFarm.latitude !== undefined && activeFarm.latitude !== null ? activeFarm.latitude.toString() : '');
      setLongitude(activeFarm.longitude !== undefined && activeFarm.longitude !== null ? activeFarm.longitude.toString() : '');
      setIrrigationMethod(activeFarm.irrigation_method || 'Manual');
      setWaterSource(activeFarm.water_source || 'Rain Water');
      setSoilType(activeFarm.soil_type || 'red_loamy');
      setDeviceId(activeFarm.device_id || '');
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

  const handleFetchGeolocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lon = position.coords.longitude.toFixed(4);
        setLatitude(lat);
        setLongitude(lon);
        setGeoLoading(false);
        setToastMsg(`Live coordinates detected: ${lat}°N, ${lon}°E`);
      },
      (err) => {
        console.warn(err);
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
        district: district || 'Anantapur',
        mandal: mandal || '',
        village: village || 'Sector 1',
        latitude: latitude ? parseFloat(latitude) : 16.5062,
        longitude: longitude ? parseFloat(longitude) : 80.6480,
        irrigation_method: irrigationMethod || 'Manual',
        water_source: waterSource || 'Rain Water',
        soil_type: soilType || 'red_loamy',
        device_id: deviceId || ''
      };

      if (activeFarm && activeFarm.id) {
        await saveFarmEdit(activeFarm.id, payload);
      } else {
        await createFarm(payload);
      }

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
      id: 'field-setup', 
      title: isTe ? 'పొలం సెటప్ & లొకేషన్' : 'Field Setup & Location', 
      subtitle: isTe ? 'ఎకరాలు, గ్రామం, నేల రకం, GPS' : 'Acreage, village, soil type, GPS',
      action: 'inline'
    },
    { 
      id: 'scan-history', 
      title: isTe ? 'స్కాన్ & వ్యాధి చరిత్ర' : 'Scan & Disease History', 
      subtitle: isTe ? 'AI ఆకు రోగ నిర్ధారణలు & చికిత్సలు' : 'AI leaf diagnoses & prescriptions',
      action: 'navigate', route: '/history'
    },
    { 
      id: 'weather-advisory', 
      title: isTe ? 'వ్యవసాయ వాతావరణం & బీజాణు సలహా' : 'Agro-Weather & Spore Advisory', 
      subtitle: isTe ? 'స్థానిక వాతావరణం & ఫంగల్ రిస్క్' : 'Local weather & fungal risk',
      action: 'navigate', route: '/crop-advisory'
    },
    { 
      id: 'crop-lifecycle', 
      title: isTe ? 'పంట జీవితచక్రం & స్ప్రే క్యాలెండర్' : 'Crop Lifecycle & Spray Calendar', 
      subtitle: isTe ? 'దశ టైమ్‌లైన్ & స్ప్రే షెడ్యూల్' : 'Stage timeline & spray schedule',
      action: 'inline'
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
    <div className="space-y-6 max-w-5xl mx-auto w-full pb-16">
      {/* Top Page Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 dark:border-white/10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {activeFarm?.farm_name || t('farm_page.title', 'My Farm')}
                {activeFarm?.is_archived && (
                  <Badge variant="warning">{t('farm_page.archived_badge', 'Archived')}</Badge>
                )}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {farms.length} {farms.length === 1 ? t('farm_page.single_field', 'registered field sector') : t('farm_page.multi_field', 'registered field sectors')}
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <Badge variant="outline" className="text-[10px]">
                  {activeFarm?.crop_name ? `${translateCrop(activeFarm.crop_name, i18n.language)} (${activeFarm.growth_stage || 'Active'})` : t('farm_page.no_crop', 'No Crop Set')}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Button 
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await createFarm({ 
                    farm_name: `${t('farm_page.new_farm_prefix', 'New Farm Sector')} ${farms.length + 1}`,
                    soil_type: 'red_loamy'
                  });
                } catch (e) { console.error(e); }
              }} 
              isLoading={loading} 
              className="w-full sm:w-auto border-dashed border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
            >
              {t('farm_page.add_field', '+ Add New Field')}
            </Button>
            <Button onClick={handleSaveFarm} isLoading={loading} leftIcon={<Save className="w-4 h-4" />} className="w-full sm:w-auto">
              {t('farm_page.save_changes', 'Save All Changes')}
            </Button>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {t('farm_page.subtitle', 'Configure your farm sector coordinates, crop growth stages, and operational notification rules.')}
        </p>
      </div>

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

      {/* ═══════ PREMIUM FARM HERO BANNER ═══════ */}
      {activeFarm && (() => {
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="rounded-3xl overflow-hidden mb-2"
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

            {/* 3 Glass Metric Cards */}
            <div className="grid grid-cols-3 gap-2 px-3 -mt-3 relative z-20">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg shadow-black/5 dark:shadow-black/20 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{isTe ? 'పంట' : 'Crop'}</span>
                </div>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">{translateCrop(activeFarm.crop_name || 'Tomato', i18n.language)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{activeFarm.crop_variety || 'Standard'}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg shadow-black/5 dark:shadow-black/20 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{isTe ? 'దశ' : 'Stage'}</span>
                </div>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">{activeFarm.growth_stage || 'Vegetative'}</p>
                <span className="inline-flex items-center gap-0.5 mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <Check className="w-2.5 h-2.5" />{isTe ? 'ఆరోగ్యం' : 'Healthy'}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg shadow-black/5 dark:shadow-black/20 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{isTe ? 'భూమి' : 'Land'}</span>
                </div>
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">{activeFarm.farm_size || '1'} {activeFarm.farm_unit || 'Acres'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{soilLabel}</p>
              </div>
            </div>

            {/* Quick Action Row */}
            <div className="flex gap-2 px-3 pt-3 pb-1">
              <button type="button" onClick={() => setActiveTab('crop-lifecycle')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all active:scale-[0.97]">
                <Leaf className="w-3.5 h-3.5" />{isTe ? 'పంట వివరాలు' : 'Crop Details'}
              </button>
              <button type="button" onClick={() => navigate('/upload')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/60 dark:border-sky-800/40 text-sky-700 dark:text-sky-300 text-[11px] font-bold hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-all active:scale-[0.97]">
                <ScanLine className="w-3.5 h-3.5" />{isTe ? 'AI స్కాన్' : 'AI Scan'}
              </button>
              <button type="button" onClick={() => navigate('/history')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 text-violet-700 dark:text-violet-300 text-[11px] font-bold hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-all active:scale-[0.97]">
                <Clock className="w-3.5 h-3.5" />{isTe ? 'చరిత్ర' : 'History'}
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* ═══════ FIELD MODULES — Clean Vertical Cards ═══════ */}
      {activeTab === 'modules' && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 px-1 pt-1">
            {isTe ? 'ఫీల్డ్ మాడ్యూల్స్' : 'Field Modules'}
          </h3>
          {FIELD_MODULES.map((mod, idx) => (
            <motion.button
              key={mod.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.07 }}
              onClick={() => {
                if (mod.action === 'navigate') {
                  navigate(mod.route);
                } else {
                  setActiveTab(mod.id);
                }
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-md hover:shadow-emerald-500/5 transition-all active:scale-[0.98] text-left group cursor-pointer"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                  {mod.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {mod.subtitle}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 shrink-0 ml-3 transition-colors" />
            </motion.button>
          ))}
        </div>
      )}

      {/* ═══════ DRILL: Field Setup & Location ═══════ */}
      {activeTab === 'field-setup' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <button type="button" onClick={() => setActiveTab('modules')}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors py-1">
            <ChevronRight className="w-4 h-4 rotate-180" />
            {isTe ? '← ఫీల్డ్‌కు తిరిగి' : '← Back to Field'}
          </button>

          <form onSubmit={handleSaveFarm} className="space-y-5">
            <Card glass className="p-5 space-y-5">
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
                    <select value={state} onChange={(e) => { setState(e.target.value); setDistrict(''); setMandal(''); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" required>
                      <option value="">{t('farm_page.info.select_state', '-- Select State / UT --')}</option>
                      {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.district', 'District')} <span className="text-rose-500">*</span></label>
                    <select value={district} onChange={(e) => { setDistrict(e.target.value); setMandal(''); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" disabled={!state} required>
                      <option value="">{state ? t('farm_page.info.select_district', '-- Select District --') : t('farm_page.info.select_state_first', '-- Select State first --')}</option>
                      {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.mandal', 'Mandal / Taluka')}</label>
                    <select value={mandal} onChange={(e) => { setMandal(e.target.value); setVillage(''); setCustomVillage(false); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50" disabled={!district}>
                      <option value="">{district ? t('farm_page.info.select_mandal', '-- Select Mandal --') : t('farm_page.info.select_district_first', '-- Select District first --')}</option>
                      {availableMandals.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{t('farm_page.info.village', 'Village / Town')}</label>
                    <select value={village} onChange={(e) => setVillage(e.target.value)}
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

      {/* ═══════ DRILL: Crop Lifecycle & Spray Calendar ═══════ */}
      {activeTab === 'crop-lifecycle' && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <button type="button" onClick={() => setActiveTab('modules')}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors py-1">
            <ChevronRight className="w-4 h-4 rotate-180" />
            {isTe ? '← ఫీల్డ్‌కు తిరిగి' : '← Back to Field'}
          </button>

          <form onSubmit={handleSaveFarm} className="space-y-5">
            <Card glass className="p-5 space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isTe ? 'పంట జీవితచక్రం & స్ప్రే క్యాలెండర్' : 'Crop Lifecycle & Spray Calendar'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isTe ? 'పంట రకం, దశ, నాటే తేదీ సెట్ చేయండి' : 'Specify active crop type, growth stage, and spray schedule.'}
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
    </div>
  );
};

export default FarmPage;
