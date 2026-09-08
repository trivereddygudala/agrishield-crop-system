import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, TrendingDown, MapPin, Search, Calendar, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Filter, Store,
  CheckCircle2, Sparkles, AlertCircle, Sun, CloudRain, Snowflake,
  Tag, Info, Calculator, DollarSign, Download, ArrowRight, ShieldCheck,
  ChevronRight, BarChart3, HelpCircle, Layers, Grid, List
} from 'lucide-react';
import { Card, Button, Badge, Input, Select, Dialog } from '../components/ui/index';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { INDIA_STATES, getDistricts } from '../data/indiaLocations';
import API from '../services/api';
import { useTranslation } from 'react-i18next';
import { translateCrop } from '../utils/diseaseAdvisoryData';

// Crop Icons & Metadata Mapping
const CROP_ICONS = {
  "All": "🌱",
  "Paddy (Rice)": "🌾",
  "Wheat": "🌾",
  "Tomato": "🍅",
  "Red Chilli": "🌶️",
  "Cotton": "⚪",
  "Onion": "🧅",
  "Potato": "🥔",
  "Maize (Corn)": "🌽",
  "Soybean": "🟡",
  "Groundnut (Peanut)": "🥜",
  "Turmeric": "🌿",
  "Tur / Arhar (Red Gram)": "🫘",
  "Gram (Chana / Chickpea)": "🫘",
  "Mustard (Sarson)": "🌻",
  "Green Chilli": "🌶️"
};

// Seasonal intelligence helper
const getCurrentAgriculturalSeason = () => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 6 && month <= 10) {
    return {
      name: 'Kharif Season (Monsoon / Rainfed Crops)',
      code: 'Kharif 2026',
      icon: CloudRain,
      color: 'bg-emerald-500 text-white',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
      description: 'Sown during June–July with monsoon arrival, harvested Sept–Oct.',
      keyCrops: ['Paddy (Rice)', 'Cotton', 'Maize', 'Soybean', 'Groundnut', 'Red Chilli', 'Tur / Arhar']
    };
  } else if (month >= 11 || month <= 3) {
    return {
      name: 'Rabi Season (Winter / Irrigated Crops)',
      code: 'Rabi 2026',
      icon: Snowflake,
      color: 'bg-sky-500 text-white',
      badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800',
      description: 'Sown in Oct–Dec after monsoon, harvested in March–April.',
      keyCrops: ['Wheat', 'Gram (Chana)', 'Mustard', 'Barley', 'BPT 5204 Rice', 'Sunflower']
    };
  } else {
    return {
      name: 'Zaid Season (Summer / Short Cash Crops)',
      code: 'Zaid 2026',
      icon: Sun,
      color: 'bg-amber-500 text-white',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800',
      description: 'Sown March–April during dry summer, harvested May–June.',
      keyCrops: ['Watermelon', 'Tomato', 'Cucumber', 'Green Chilli', 'Moong Dal', 'Vegetables']
    };
  }
};

const MarketPricesPage = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mandiPrices, setMandiPrices] = useState([]);
  const [marketSummary, setMarketSummary] = useState(null);
  const [syncTimestamp, setSyncTimestamp] = useState('');
  const [syncSource, setSyncSource] = useState('');
  
  // Cascading Location & Filter States
  const [selectedState, setSelectedState] = useState(() => activeFarm?.state || 'Andhra Pradesh');
  const [selectedDistrict, setSelectedDistrict] = useState(() => activeFarm?.district || activeFarm?.farm_location || 'Guntur');
  const [selectedMandi, setSelectedMandi] = useState('All');
  const [selectedCrop, setSelectedCrop] = useState('All');
  const [selectedVariety, setSelectedVariety] = useState('All Varieties');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic filter options from backend
  const [availableMandis, setAvailableMandis] = useState([]);
  const [cropsList, setCropsList] = useState([]);
  const [varietiesByCrop, setVarietiesByCrop] = useState({});
  const [marketYardsDB, setMarketYardsDB] = useState({});

  // Display Unit Mode: Quintal (100kg), kg (1kg), Crate (25kg), Bag (50kg)
  const [priceUnit, setPriceUnit] = useState('quintal'); 
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  // Revenue Calculator Modal
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcCrop, setCalcCrop] = useState(null);
  const [calcQuantity, setCalcQuantity] = useState(25);
  const [calcTransport, setCalcTransport] = useState(40);
  const [calcResult, setCalcResult] = useState(null);

  // Official MSP Benchmark Modal
  const [mspModalOpen, setMspModalOpen] = useState(false);
  const [mspDatabase, setMspDatabase] = useState({});

  const currentSeason = getCurrentAgriculturalSeason();
  const SeasonIcon = currentSeason.icon;

  const availableDistricts = useMemo(() => {
    return getDistricts(selectedState);
  }, [selectedState]);

  // Load Filter Taxonomy (Mandis, Crops, Varieties)
  const loadFilterTaxonomy = async () => {
    try {
      const res = await API.get('/api/v1/market/filters', {
        params: { state: selectedState, district: selectedDistrict }
      });
      if (res.data && res.data.status === 'success') {
        setCropsList(['All', ...res.data.crops]);
        setVarietiesByCrop(res.data.varieties_by_crop || {});
        setMarketYardsDB(res.data.market_yards_database || {});
        setAvailableMandis(['All', ...(res.data.mandis || [])]);
      }
    } catch (err) {
      console.warn("Taxonomy load error:", err);
    }
  };

  // Fetch Live Mandi Rates
  const fetchMarketPrices = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    try {
      const res = await API.get('/api/v1/market/prices', {
        params: {
          state: selectedState !== 'All' ? selectedState : undefined,
          district: selectedDistrict !== 'All' ? selectedDistrict : undefined,
          mandi: selectedMandi !== 'All' ? selectedMandi : undefined,
          crop: selectedCrop !== 'All' ? selectedCrop : undefined,
          variety: selectedVariety !== 'All Varieties' ? selectedVariety : undefined,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          search: searchQuery || undefined
        }
      });

      if (res.data && res.data.status === 'success') {
        setMandiPrices(res.data.data || []);
        setMarketSummary(res.data.market_summary || null);
        setSyncTimestamp(res.data.sync_timestamp || '');
        setSyncSource(res.data.sync_source || 'Agmarknet APMC Central Grid');
      }
    } catch (err) {
      console.warn("Market API fetch error:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch MSP Table
  const fetchMspTable = async () => {
    try {
      const res = await API.get('/api/v1/market/msp-table');
      if (res.data && res.data.msp_rates_per_quintal) {
        setMspDatabase(res.data.msp_rates_per_quintal);
      }
    } catch (err) {
      console.warn("MSP table load error:", err);
    }
  };

  useEffect(() => {
    loadFilterTaxonomy();
  }, [selectedState, selectedDistrict]);

  useEffect(() => {
    fetchMarketPrices();
  }, [selectedState, selectedDistrict, selectedMandi, selectedCrop, selectedVariety, selectedCategory]);

  useEffect(() => {
    fetchMspTable();
  }, []);

  // Recalculate profit in calculator
  const runCalculator = async () => {
    if (!calcCrop) return;
    try {
      const res = await API.post('/api/v1/market/calculate-revenue', {
        crop: calcCrop.crop,
        quantity_quintals: parseFloat(calcQuantity) || 1,
        price_per_quintal: calcCrop.modal_price,
        transport_cost_per_quintal: parseFloat(calcTransport) || 0,
        mandi_cess_pct: 1.5
      });
      setCalcResult(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (calcCrop) {
      runCalculator();
    }
  }, [calcQuantity, calcTransport, calcCrop]);

  // Format price according to selected unit
  const formatPrice = (quintalPrice) => {
    if (!quintalPrice) return '--';
    if (priceUnit === 'kg') {
      return `₹${(quintalPrice / 100).toFixed(2)}`;
    } else if (priceUnit === 'crate') {
      return `₹${(quintalPrice / 4).toFixed(0)}`; // 25 kg
    } else if (priceUnit === 'bag') {
      return `₹${(quintalPrice / 2).toFixed(0)}`; // 50 kg
    }
    return `₹${quintalPrice.toLocaleString('en-IN')}`;
  };

  const getUnitLabel = () => {
    if (priceUnit === 'kg') return '/ kg';
    if (priceUnit === 'crate') return '/ 25kg Crate';
    if (priceUnit === 'bag') return '/ 50kg Bag';
    return '/ Quintal (100kg)';
  };

  // Get active crop varieties list
  const currentVarietiesList = useMemo(() => {
    if (selectedCrop === 'All' || !varietiesByCrop[selectedCrop]) {
      return [];
    }
    return varietiesByCrop[selectedCrop];
  }, [selectedCrop, varietiesByCrop]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto space-y-6 pb-12 w-full dark:text-slate-100"
    >
      {/* 1. Header Bar with Live Agmarknet & e-NAM Sync Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/90 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('market_page.title', 'Mandi & Crop Market Price Intelligence')}
            </h1>
            <Badge variant="healthy" className="px-3 py-1 text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>{t('market_page.badge', 'Official Agmarknet Live Grid')}</span>
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Real daily APMC wholesale auction rates, crop variety premiums, 2025–2026 Govt MSP comparisons &amp; trade advisories for <strong className="text-emerald-700 dark:text-emerald-400">{selectedDistrict}, {selectedState}</strong>.
          </p>
        </div>

        {/* Sync Controls & View Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setMspModalOpen(true)}
            leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            className="font-bold text-xs"
          >
            Govt MSP Table
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMarketPrices(true)}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`w-4 h-4 text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="font-bold text-xs border-emerald-500/40 hover:border-emerald-500 text-emerald-700 dark:text-emerald-300"
          >
            {isRefreshing ? 'Syncing...' : 'Refresh Live Rates'}
          </Button>

          {/* Grid vs Table View */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`}
              title="Card Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'}`}
              title="APMC Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Ticker & Market Mood Bar */}
      {marketSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active Season Banner */}
          <div className={`p-4 rounded-2xl border flex items-center gap-3.5 shadow-xs ${currentSeason.badgeBg}`}>
            <div className={`p-3 rounded-2xl ${currentSeason.color} shadow-sm shrink-0`}>
              <SeasonIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-80">Season Cycle</span>
              <span className="text-sm font-bold block truncate">{currentSeason.name}</span>
            </div>
          </div>

          {/* Top Gainer Ticker */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white font-bold shrink-0">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">Top Gainer Today</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  {marketSummary.top_gainers[0]?.crop} ({marketSummary.top_gainers[0]?.variety?.split(' ')[0]})
                </span>
              </div>
            </div>
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-700">
              +{marketSummary.top_gainers[0]?.change_pct}%
            </span>
          </div>

          {/* Live Sync Timestamp */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold shrink-0 border border-slate-200 dark:border-slate-700">
                <Calendar className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">APMC Settlement Time</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block font-mono">
                  {syncTimestamp || '11 Aug 2026, 08:30 PM IST'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-2.5 py-1 rounded-xl border border-sky-300 dark:border-sky-800">
              e-NAM Live
            </span>
          </div>
        </div>
      )}

      {/* 3. Professional Hierarchical Filter Bar: State -> District -> Mandi Market Yard */}
      <Card glass className="p-5 border-slate-200/90 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Selector 1: State */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> 1. Select State
            </label>
            <select
              value={selectedState}
              onChange={(e) => { 
                setSelectedState(e.target.value); 
                setSelectedDistrict('All'); 
                setSelectedMandi('All'); 
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {INDIA_STATES.map(s => <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Selector 2: District */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-teal-600" /> 2. Select District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => { 
                setSelectedDistrict(e.target.value); 
                setSelectedMandi('All'); 
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="All">All Districts</option>
              {availableDistricts.map(d => <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Selector 3: APMC Market Yard */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Store className="w-3.5 h-3.5 text-amber-600" /> 3. Select APMC Market Yard
            </label>
            <select
              value={selectedMandi}
              onChange={(e) => setSelectedMandi(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="All">All APMC Mandis in {selectedDistrict || selectedState}</option>
              {availableMandis.filter(m => m !== 'All').map(m => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-sky-600" /> 4. Search Keyword
            </label>
            <Input
              placeholder={t('market_page.search_placeholder', 'Search crop, variety, mandi...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="text-xs"
            />
          </div>
        </div>

        {/* Display Unit Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Unit Conversion:</span>
            <button
              onClick={() => setPriceUnit('quintal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                priceUnit === 'quintal'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              ₹ / {t('market_page.units.quintal', 'Quintal (100kg)')}
            </button>
            <button
              onClick={() => setPriceUnit('kg')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                priceUnit === 'kg'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              ₹ / Kilogram (kg)
            </button>
            <button
              onClick={() => setPriceUnit('crate')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                priceUnit === 'crate'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              ₹ / 25kg Crate (Tomatoes/Veggies)
            </button>
            <button
              onClick={() => setPriceUnit('bag')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                priceUnit === 'bag'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              ₹ / 50kg Bag (Grains/Onions)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              Showing <strong className="text-slate-800 dark:text-slate-200">{mandiPrices.length}</strong> Live APMC Quotes
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Crop Names Filter Tabs Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-emerald-600" /> Filter by Crop Name:
          </span>
          {selectedCrop !== 'All' && (
            <button
              onClick={() => { setSelectedCrop('All'); setSelectedVariety('All Varieties'); }}
              className="text-xs font-bold text-rose-600 hover:underline"
            >
              Clear Crop Filter
            </button>
          )}
        </div>

        {/* Scrollable Horizontal Crop Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {cropsList.map((cropName) => {
            const isSelected = selectedCrop === cropName;
            const icon = CROP_ICONS[cropName] || '🌾';
            return (
              <button
                key={cropName}
                onClick={() => {
                  setSelectedCrop(cropName);
                  setSelectedVariety('All Varieties');
                }}
                className={`flex-none flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap border ${
                  isSelected 
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/25 scale-[1.02]' 
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-800'
                }`}
              >
                <span className="text-base">{icon}</span>
                <span>{cropName}</span>
              </button>
            );
          })}
        </div>

        {/* 5. Dynamic Crop Variety Filter Chips (Appears when a specific crop is selected) */}
        {currentVarietiesList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2"
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Select {selectedCrop} Variety in {selectedState}:</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {currentVarietiesList.map((varName) => {
                const isVarSelected = selectedVariety === varName;
                return (
                  <button
                    key={varName}
                    onClick={() => setSelectedVariety(varName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      isVarSelected
                        ? 'bg-emerald-700 text-white border-emerald-600 shadow-xs'
                        : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-slate-900 dark:hover:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    {varName}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {loading ? (
        /* Visual Animated Card Skeletons */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5 space-y-4 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-start">
                <div className="space-y-2 w-2/3">
                  <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
                  <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
                  <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
                </div>
                <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
              </div>
              <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
                <div className="h-3.5 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
              </div>
            </Card>
          ))}
        </div>
      ) : mandiPrices.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <Store className="w-12 h-12 text-slate-300 dark:text-slate-700" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">No Mandi Quotes Found for Selected Filter</h3>
          <p className="text-xs text-slate-500 max-w-sm">Try choosing 'All APMC Mandis' or 'All Varieties' to view other market arrivals in this region.</p>
        </Card>
      ) : viewMode === 'grid' ? (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mandiPrices.map((item, index) => {
            const isUp = item.change_pct >= 0;
            const isAboveMsp = item.msp_price ? item.modal_price >= item.msp_price : null;
            const diffFromMsp = item.msp_price ? Math.abs(item.modal_price - item.msp_price) : 0;

            return (
              <motion.div
                key={item.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <Card glass className="p-5 space-y-4 relative overflow-hidden transition-all duration-200 card-accent-emerald hover:shadow-lg border-slate-200/90 dark:border-slate-800">
                  {/* Mandi Yard & Category Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                          {item.category} • {item.grade}
                        </span>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                          {item.crop}
                        </h3>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                          Variety: <span className="text-emerald-700 dark:text-emerald-300">{item.variety}</span>
                        </p>
                      </div>

                      {/* Change % Badge */}
                      <div className={`px-2.5 py-1 rounded-xl flex items-center gap-1 text-xs font-extrabold border ${
                        isUp 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700' 
                          : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700'
                      }`}>
                        {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        <span>{isUp ? '+' : ''}{item.change_pct}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-2.5">
                      <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold">{item.mandi_name}</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono border border-slate-200 dark:border-slate-700">{item.distance_km}</span>
                    </div>
                  </div>

                  {/* Primary Price Block */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Today's Modal Rate</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
                            {formatPrice(item.modal_price)}
                          </span>
                          <span className="text-xs font-bold text-slate-500">{getUnitLabel()}</span>
                        </div>
                      </div>

                      {/* Arrivals volume */}
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Daily Arrivals</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{item.arrivals_tons} Tons</span>
                      </div>
                    </div>

                    {/* Min & Max Range */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Min Rate</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatPrice(item.min_price)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-semibold block">Max Rate</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatPrice(item.max_price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* MSP Benchmark Comparison */}
                  {item.msp_price && (
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      isAboveMsp 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    }`}>
                      <span className="text-[11px]">Govt MSP: ₹{item.msp_price.toLocaleString('en-IN')}/Qtl</span>
                      <span className="text-[11px] font-black">
                        {isAboveMsp ? `+₹${diffFromMsp} Above MSP 🟢` : `-₹${diffFromMsp} Below MSP 🔴`}
                      </span>
                    </div>
                  )}

                  {/* 7-Day Trend Visual Sparkline */}
                  {item.weekly_trend && item.weekly_trend.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase">
                        <span>7-Day Price Trajectory</span>
                        <span className={isUp ? 'text-emerald-600' : 'text-rose-600'}>
                          ₹{item.weekly_trend[0]} &rarr; ₹{item.weekly_trend[item.weekly_trend.length - 1]}
                        </span>
                      </div>
                      <div className="flex items-end gap-1 h-6 pt-1">
                        {item.weekly_trend.map((p, pIdx) => {
                          const minP = Math.min(...item.weekly_trend);
                          const maxP = Math.max(...item.weekly_trend);
                          const range = maxP - minP || 1;
                          const heightPct = Math.max(20, Math.round(((p - minP) / range) * 100));
                          return (
                            <div 
                              key={pIdx} 
                              className="flex-1 bg-emerald-500/20 dark:bg-emerald-500/30 hover:bg-emerald-500 rounded-xs transition-all"
                              style={{ height: `${heightPct}%` }}
                              title={`Day ${pIdx + 1}: ₹${p}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Market Recommendation */}
                  {item.ai_advice && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{item.ai_advice}</span>
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() => { setCalcCrop(item); setCalculatorOpen(true); }}
                      leftIcon={<Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      className="text-xs font-bold flex-1"
                    >
                      Calculate Profit
                    </Button>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(item.mandi_name + ' ' + item.district)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      <MapPin className="w-3.5 h-3.5 text-sky-500" />
                      <span>Route</span>
                    </a>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* HIGH DENSITY APMC TABLE VIEW */
        <Card className="p-0 overflow-hidden border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800 text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Commodity / Crop</th>
                  <th className="py-3 px-4">Variety &amp; Grade</th>
                  <th className="py-3 px-4">APMC Mandi Yard</th>
                  <th className="py-3 px-4">Modal Price ({priceUnit.toUpperCase()})</th>
                  <th className="py-3 px-4">Min / Max Spread</th>
                  <th className="py-3 px-4">Daily Arrivals</th>
                  <th className="py-3 px-4">Govt MSP Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 font-medium">
                {mandiPrices.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="text-base">{CROP_ICONS[item.crop] || '🌾'}</span>
                      <span>{item.crop}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                      {item.variety} <span className="text-[10px] text-slate-400 block font-normal">{item.grade}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <div className="font-bold">{item.mandi_name}</div>
                      <div className="text-[10px] text-slate-400">{item.district}, {item.state}</div>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white text-sm">
                      {formatPrice(item.modal_price)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {formatPrice(item.min_price)} - {formatPrice(item.max_price)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                      {item.arrivals_tons} Tons
                    </td>
                    <td className="py-3.5 px-4">
                      {item.msp_price ? (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.modal_price >= item.msp_price ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                          {item.modal_price >= item.msp_price ? 'Above MSP 🟢' : 'Below MSP 🔴'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">No MSP</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => { setCalcCrop(item); setCalculatorOpen(true); }}
                        className="text-xs font-bold"
                      >
                        Calculate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 7. Farmer Revenue & Profit Calculator Modal */}
      <Dialog
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        title={`Harvest Revenue & Mandi Payout: ${calcCrop?.crop || ''}`}
        description={`Calculate net profits for ${calcCrop?.variety || ''} at ${calcCrop?.mandi_name || ''}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Harvest Yield Quantity (Quintals)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={calcQuantity}
                onChange={(e) => setCalcQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">1 Quintal = 100 Kilograms</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Transport Cost (₹ / Quintal)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={calcTransport}
                onChange={(e) => setCalcTransport(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">Tractor/Mini-Truck freight fee</span>
            </div>
          </div>

          {/* Calculator Output Breakdown */}
          {calcResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-2.5 text-xs">
              <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                <span>Gross Market Value ({calcQuantity} Qtl @ ₹{calcCrop?.modal_price}/Qtl):</span>
                <span className="font-bold">₹{calcResult.gross_revenue_inr.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Transport Freight:</span>
                <span className="text-rose-600 font-semibold">- ₹{calcResult.transport_cost_inr.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>APMC Market Cess Fee (1.5%):</span>
                <span className="text-rose-600 font-semibold">- ₹{calcResult.mandi_cess_inr.toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2 border-t border-emerald-300 dark:border-emerald-700 flex justify-between items-baseline">
                <span className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">Net Farmer Cash Payout:</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                  ₹{calcResult.net_farmer_payout_inr.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="gradient" size="md" onClick={() => setCalculatorOpen(false)} className="w-full sm:w-auto font-bold">
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 8. Official MSP Benchmark Modal */}
      <Dialog
        isOpen={mspModalOpen}
        onClose={() => setMspModalOpen(false)}
        title="Official Government of India MSP Rates (2025–2026)"
        description="Minimum Support Prices declared by Ministry of Agriculture & CACP"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold uppercase sticky top-0">
              <tr>
                <th className="p-2.5">Crop / Commodity</th>
                <th className="p-2.5 text-right">Official MSP (₹/Quintal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {Object.entries(mspDatabase).map(([cName, rate]) => (
                <tr key={cName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{cName}</td>
                  <td className="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    ₹{rate.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-2">
            <Button variant="gradient" size="sm" onClick={() => setMspModalOpen(false)}>
              Close Benchmark Table
            </Button>
          </div>
        </div>
      </Dialog>
    </motion.div>
  );
};

export default MarketPricesPage;
