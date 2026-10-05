import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout, Calendar, TrendingUp, DollarSign, Package, Scale,
  CheckCircle2, Clock, AlertCircle, Plus, ChevronRight, X,
  ShieldCheck, FileText, ArrowRight, RefreshCw, Archive, Award, HelpCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HarvestMarketReconciler from './HarvestMarketReconciler';

export default function HarvestSeasonManager({ farmId, farmName, cropName, farmSize, onSeasonChanged }) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('subtab') === 'market') return 'market';
    } catch {}
    return 'scorecard';
  }); // 'scorecard' | 'harvests' | 'sales' | 'market' | 'history'
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data states
  const [activeSeason, setActiveSeason] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [harvests, setHarvests] = useState([]);
  const [sales, setSales] = useState([]);
  const [seasonHistory, setSeasonHistory] = useState([]);

  // Modals
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Harvest Form
  const [harvestForm, setHarvestForm] = useState({
    harvest_date: new Date().toISOString().split('T')[0],
    quantity: '',
    unit: 'quintal',
    grade: 'Grade A',
    picking_number: '',
    notes: ''
  });

  // Sale Form
  const [saleForm, setSaleForm] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    quantity_sold: '',
    unit: 'quintal',
    price_per_unit: '',
    buyer: '',
    mandi: '',
    record_in_khata: true,
    notes: ''
  });

  // Close Season Form
  const [closeForm, setCloseForm] = useState({
    season_end_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // New Season Form
  const [newSeasonForm, setNewSeasonForm] = useState({
    crop_name: cropName || 'Tomato',
    variety: '',
    area: farmSize || '',
    area_unit: 'acres',
    planting_date: new Date().toISOString().split('T')[0],
    season_name: ''
  });

  const fetchData = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [activeRes, scoreRes, harvRes, saleRes, histRes] = await Promise.allSettled([
        API.get(`/api/farms/${farmId}/seasons/active`),
        API.get(`/api/farms/${farmId}/season-summary`),
        API.get(`/api/farms/${farmId}/harvests`),
        API.get(`/api/farms/${farmId}/sales`),
        API.get(`/api/farms/${farmId}/seasons`)
      ]);

      if (activeRes.status === 'fulfilled') setActiveSeason(activeRes.value.data);
      if (scoreRes.status === 'fulfilled') setScorecard(scoreRes.value.data);
      if (harvRes.status === 'fulfilled') setHarvests(harvRes.value.data || []);
      if (saleRes.status === 'fulfilled') setSales(saleRes.value.data || []);
      if (histRes.status === 'fulfilled') setSeasonHistory(histRes.value.data || []);

      if (activeRes.status === 'rejected' && harvRes.status === 'rejected') {
        setErrorMsg(isTe ? 'సీజన్ డేటా లోడ్ చేయడంలో విఫలమైంది.' : 'Failed to load season data.');
      }
    } catch (err) {
      console.warn('Error loading season data:', err);
      setErrorMsg(isTe ? 'సీజన్ డేటా లోడ్ చేయడంలో విఫలమైంది.' : 'Failed to load season data.');
    } finally {
      setLoading(false);
    }
  }, [farmId, isTe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Submit Harvest
  const handleLogHarvest = async (e) => {
    e.preventDefault();
    if (!harvestForm.quantity || parseFloat(harvestForm.quantity) <= 0) {
      setErrorMsg(isTe ? 'సరైన దిగుబడి పరిమాణం నమోదు చేయండి.' : 'Enter a valid positive quantity.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        harvest_date: harvestForm.harvest_date,
        quantity: parseFloat(harvestForm.quantity),
        unit: harvestForm.unit,
        grade: harvestForm.grade || null,
        picking_number: harvestForm.picking_number ? parseInt(harvestForm.picking_number) : undefined,
        notes: harvestForm.notes || null,
        idempotency_key: `client-harv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      };
      await API.post(`/api/farms/${farmId}/harvests`, payload);
      setSuccessMsg(isTe ? 'దిగుబడి రికార్డు విజయవంతంగా నమోదైంది!' : 'Harvest logged successfully!');
      setShowHarvestModal(false);
      setHarvestForm({
        harvest_date: new Date().toISOString().split('T')[0],
        quantity: '',
        unit: 'quintal',
        grade: 'Grade A',
        picking_number: '',
        notes: ''
      });
      await fetchData();
      if (onSeasonChanged) onSeasonChanged();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to log harvest.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Sale
  const handleRecordSale = async (e) => {
    e.preventDefault();
    if (!saleForm.quantity_sold || parseFloat(saleForm.quantity_sold) <= 0) {
      setErrorMsg(isTe ? 'సరైన అమ్మకం పరిమాణం నమోదు చేయండి.' : 'Enter a valid sold quantity.');
      return;
    }
    if (saleForm.price_per_unit === '' || parseFloat(saleForm.price_per_unit) < 0) {
      setErrorMsg(isTe ? 'సరైన ధర నమోదు చేయండి.' : 'Enter a valid price.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        sale_date: saleForm.sale_date,
        quantity_sold: parseFloat(saleForm.quantity_sold),
        unit: saleForm.unit,
        price_per_unit: parseFloat(saleForm.price_per_unit),
        buyer: saleForm.buyer || null,
        mandi: saleForm.mandi || null,
        record_in_khata: Boolean(saleForm.record_in_khata),
        notes: saleForm.notes || null,
        idempotency_key: `client-sale-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      };
      await API.post(`/api/farms/${farmId}/sales`, payload);
      setSuccessMsg(isTe ? 'అమ్మకం వివరాలు రికార్డయ్యాయి!' : 'Crop sale recorded successfully!');
      setShowSaleModal(false);
      setSaleForm({
        sale_date: new Date().toISOString().split('T')[0],
        quantity_sold: '',
        unit: 'quintal',
        price_per_unit: '',
        buyer: '',
        mandi: '',
        record_in_khata: true,
        notes: ''
      });
      await fetchData();
      if (onSeasonChanged) onSeasonChanged();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to record crop sale.');
    } finally {
      setSubmitting(false);
    }
  };

  // Close Season
  const handleCloseSeason = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      await API.post(`/api/farms/${farmId}/close-season`, {
        season_end_date: closeForm.season_end_date,
        notes: closeForm.notes || null
      });
      setSuccessMsg(isTe ? 'సీజన్ విజయవంతంగా ముగిసింది & ఆర్కైవ్ చేయబడింది!' : 'Season successfully closed & archived!');
      setShowCloseModal(false);
      await fetchData();
      if (onSeasonChanged) onSeasonChanged();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to close season.');
    } finally {
      setSubmitting(false);
    }
  };

  // Start New Season
  const handleStartNewSeason = async (e) => {
    e.preventDefault();
    if (!newSeasonForm.crop_name.trim()) {
      setErrorMsg(isTe ? 'పంట పేరు అవసరం.' : 'Crop name is required.');
      return;
    }
    const parsedArea = parseFloat(newSeasonForm.area);
    if (!parsedArea || isNaN(parsedArea) || parsedArea <= 0) {
      setErrorMsg(isTe ? 'దయచేసి సరైన పొలం విస్తీర్ణం నమోదు చేయండి.' : 'Please enter a valid positive land area.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      await API.post(`/api/farms/${farmId}/seasons/start`, {
        crop_name: newSeasonForm.crop_name.trim(),
        variety: newSeasonForm.variety.trim() || null,
        area: parsedArea,
        area_unit: newSeasonForm.area_unit,
        planting_date: newSeasonForm.planting_date,
        season_name: newSeasonForm.season_name.trim() || undefined,
        close_previous_active: true
      });
      setSuccessMsg(isTe ? 'కొత్త పంట సీజన్ విజయవంతంగా ప్రారంభమైంది!' : 'New crop season started successfully!');
      setShowNewSeasonModal(false);
      await fetchData();
      if (onSeasonChanged) onSeasonChanged();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to start new season.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Alert Messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="p-1 text-emerald-600 hover:text-emerald-800"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-500" />{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="p-1 text-rose-600 hover:text-rose-800"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Season Overview Banner Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-emerald-950/20 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {activeSeason?.status === 'active' ? (isTe ? 'ప్రస్తుత చురుకైన సీజన్' : 'Active Season') : (isTe ? 'ముగిసిన సీజన్' : 'Closed')}
              </span>
              {activeSeason?.area && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {activeSeason.area} {activeSeason.area_unit || 'acres'}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sprout className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              {activeSeason?.season_name || `${cropName || 'Crop'} Season`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isTe ? 'నాటిన తేదీ:' : 'Planting Date:'} {activeSeason?.planting_date || 'N/A'} • {isTe ? 'పంట రకం:' : 'Crop:'} {activeSeason?.crop_name || cropName || 'General'}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setShowHarvestModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Package className="w-4 h-4" />
              {isTe ? 'దిగుబడి నమోదు' : 'Log Harvest'}
            </button>
            <button
              type="button"
              onClick={() => setShowSaleModal(true)}
              className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              {isTe ? 'అమ్మకం నమోదు' : 'Record Sale'}
            </button>
            {activeSeason?.status === 'active' && (
              <button
                type="button"
                onClick={() => setShowCloseModal(true)}
                className="px-3 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isTe ? 'సీజన్ ముగించు' : 'Close Season'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewSeasonModal(true)}
              className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isTe ? 'కొత్త సీజన్' : 'New Season'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('scorecard')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'scorecard'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📊 {isTe ? 'సీజన్ స్కోర్‌కార్డ్' : 'Season Scorecard'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('harvests')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'harvests'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          🌾 {isTe ? 'దిగుబడులు' : 'Harvest Pickings'} ({harvests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'sales'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          💰 {isTe ? 'అమ్మకాలు' : 'Crop Sales'} ({sales.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('market')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'market'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          🏪 {isTe ? 'మార్కెట్ & అమ్మకాలు' : 'Market Intelligence'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📜 {isTe ? 'గత సీజన్ల చరిత్ర' : 'Season History'} ({seasonHistory.length})
        </button>
      </div>

      {/* ── TAB 1: SEASON PERFORMANCE SCORECARD ── */}
      {activeTab === 'scorecard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Total Harvest */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{isTe ? 'మొత్తం దిగుబడి' : 'Total Harvest'}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${scorecard?.harvest_status === 'actual' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  {scorecard?.harvest_status === 'actual' ? (isTe ? 'వాస్తవ' : 'Actual') : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {scorecard?.total_harvest_quintals !== null && scorecard?.total_harvest_quintals !== undefined
                  ? `${scorecard.total_harvest_quintals} Qtl`
                  : (scorecard?.total_harvest_quantity ? `${scorecard.total_harvest_quantity}` : '—')}
              </p>
              <p className="text-[10px] text-slate-400">
                {scorecard?.total_pickings_count || 0} {isTe ? 'దఫాలుగా కోత' : 'pickings recorded'}
              </p>
            </div>

            {/* Metric 2: Yield per Acre */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{isTe ? 'ఎకరాకు దిగుబడి' : 'Yield / Acre'}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${scorecard?.yield_status === 'actual' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  {scorecard?.yield_status === 'actual' ? (isTe ? 'వాస్తవ' : 'Actual') : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {scorecard?.yield_per_acre_quintal !== null && scorecard?.yield_per_acre_quintal !== undefined
                  ? `${scorecard.yield_per_acre_quintal} Qtl/ac`
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400">
                {scorecard?.historical_area
                  ? `${scorecard.historical_area} ${scorecard?.area_unit || 'acres'} ${isTe ? 'పొలం విస్తీర్ణం' : 'historical area'}`
                  : (isTe ? 'విస్తీర్ణం అందుబాటులో లేదు' : 'Area not available')}
              </p>
            </div>

            {/* Metric 3: Actual Sales Income */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{isTe ? 'అమ్మకాల ఆదాయం' : 'Actual Sales'}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${scorecard?.revenue_status === 'actual' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  {scorecard?.revenue_status === 'actual' ? (isTe ? 'వాస్తవ' : 'Actual') : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {scorecard?.actual_sales_income !== null && scorecard?.actual_sales_income !== undefined
                  ? `₹${scorecard.actual_sales_income.toLocaleString('en-IN')}`
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400">
                {sales.length} {isTe ? 'అమ్మకాలు రికార్డయ్యాయి' : 'recorded sale batches'}
              </p>
            </div>

            {/* Metric 4: Actual Cultivation Expenses */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{isTe ? 'సాగు ఖర్చులు' : 'Actual Expenses'}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${scorecard?.expense_status === 'actual' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  {scorecard?.expense_status === 'actual' ? (isTe ? 'ఖాతా నుంచి' : 'From Khata') : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                {scorecard?.actual_cultivation_cost !== null && scorecard?.actual_cultivation_cost !== undefined
                  ? `₹${scorecard.actual_cultivation_cost.toLocaleString('en-IN')}`
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isTe ? 'డిజిటల్ ఖాతా ఖర్చులు' : 'Actual expenses from Khata'}
              </p>
            </div>
          </div>

          {/* Unit Economics Detailed Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Net Profit */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {isTe ? 'నికర లాభం / నష్టం' : 'Net Profit / Loss'}
              </span>
              <p className={`text-xl font-black ${(scorecard?.net_profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {scorecard?.net_profit !== null && scorecard?.net_profit !== undefined
                  ? `₹${scorecard.net_profit.toLocaleString('en-IN')}`
                  : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
              </p>
              <span className="text-[10px] text-slate-400">Sales − Cultivation Cost</span>
            </div>

            {/* Profit per Acre */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {isTe ? 'ఎకరాకు నికర లాభం' : 'Profit / Acre'}
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">
                {scorecard?.profit_per_acre !== null && scorecard?.profit_per_acre !== undefined
                  ? `₹${scorecard.profit_per_acre.toLocaleString('en-IN')}/ac`
                  : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
              </p>
              <span className="text-[10px] text-slate-400">Net Profit ÷ Season Area</span>
            </div>

            {/* Cost per Quintal */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {isTe ? 'క్వింటాల్‌కు ఉత్పత్తి ఖర్చు' : 'Cost / Quintal'}
              </span>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">
                {scorecard?.cost_per_quintal !== null && scorecard?.cost_per_quintal !== undefined
                  ? `₹${scorecard.cost_per_quintal.toLocaleString('en-IN')}/Qtl`
                  : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
              </p>
              <span className="text-[10px] text-slate-400">Total Cost ÷ Total Quintals</span>
            </div>

            {/* Actual ROI */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {isTe ? 'పెట్టుబడిపై రాబడి (ROI)' : 'Return on Investment'}
              </span>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                {scorecard?.actual_roi_percentage !== null && scorecard?.actual_roi_percentage !== undefined
                  ? `${scorecard.actual_roi_percentage}%`
                  : (isTe ? 'అందుబాటులో లేదు' : 'Not available')}
              </p>
              <span className="text-[10px] text-slate-400">(Net Profit ÷ Cost) × 100</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: HARVEST PICKINGS LIST ── */}
      {activeTab === 'harvests' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              {isTe ? 'నమోదైన దిగుబడి దఫాలు' : 'Recorded Harvest Batches'}
            </h3>
            <button
              type="button"
              onClick={() => setShowHarvestModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isTe ? '+ కొత్త కోత నమోదు' : '+ Log Harvest'}
            </button>
          </div>

          {harvests.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <Package className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                {isTe ? 'ఈ సీజన్‌లో ఇంకా ఎటువంటి దిగుబడులు నమోదు కాలేదు.' : 'No harvest pickings recorded for this season yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {harvests.map((h, idx) => (
                <div key={h.harvest_id || idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {isTe ? `దఫా #${h.picking_number || idx + 1}` : `Picking #${h.picking_number || idx + 1}`}
                    </span>
                    <span className="text-xs text-slate-400">{h.harvest_date}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {h.quantity} {h.unit}
                    </h4>
                    {h.normalized_quintals && (
                      <span className="text-xs font-bold text-slate-500">({h.normalized_quintals} Qtl)</span>
                    )}
                  </div>
                  {h.grade && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      {h.grade}
                    </span>
                  )}
                  {h.notes && <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{h.notes}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: CROP SALES LIST ── */}
      {activeTab === 'sales' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              {isTe ? 'పంట అమ్మకాల రికార్డులు' : 'Recorded Crop Sales'}
            </h3>
            <button
              type="button"
              onClick={() => setShowSaleModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isTe ? '+ కొత్త అమ్మకం నమోదు' : '+ Record Sale'}
            </button>
          </div>

          {sales.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <DollarSign className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                {isTe ? 'ఈ సీజన్‌లో ఇంకా ఎటువంటి అమ్మకాలు నమోదు కాలేదు.' : 'No crop sales recorded for this season yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sales.map((s, idx) => (
                <div key={s.sale_id || idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{s.buyer || s.mandi || 'Market Sale'}</span>
                    <span className="text-xs text-slate-400">{s.sale_date}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ₹{(s.total_sale_value || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {s.quantity_sold} {s.unit} @ ₹{s.price_per_unit}/{s.unit}
                      </p>
                    </div>
                    {s.record_in_khata && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {isTe ? 'ఖాతాలో ఉంది' : 'In Khata'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SEASON HISTORY ARCHIVE ── */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            {isTe ? 'గత పంట సీజన్ల ఆర్కైవ్' : 'Archived Historical Crop Seasons'}
          </h3>

          {seasonHistory.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <Archive className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">
                {isTe ? 'గతంలో ముగిసిన సీజన్లు లేవు.' : 'No archived past seasons yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {seasonHistory.map((s) => (
                <div key={s.season_id || s.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {s.status}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.season_name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      {s.crop_name} • {s.area} {s.area_unit || 'acres'} • {s.season_start_date} {s.season_end_date ? `to ${s.season_end_date}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {s.scorecard?.yield_per_acre_quintal && (
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTe ? 'దిగుబడి' : 'Yield'}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{s.scorecard.yield_per_acre_quintal} Qtl/ac</span>
                      </div>
                    )}
                    {s.scorecard?.net_profit !== undefined && s.scorecard?.net_profit !== null && (
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTe ? 'లాభం' : 'Net Profit'}</span>
                        <span className={`font-bold ${(s.scorecard.net_profit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          ₹{s.scorecard.net_profit.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: B25 HARVEST-TO-MARKET SELLING RECONCILER ── */}
      {activeTab === 'market' && (
        <HarvestMarketReconciler
          farmId={farmId}
          onInitiateSale={({ mandi, price_per_unit, quantity_sold, unit }) => {
            setSaleForm(prev => ({
              ...prev,
              mandi: mandi || prev.mandi,
              price_per_unit: price_per_unit != null ? price_per_unit : prev.price_per_unit,
              quantity_sold: quantity_sold != null && quantity_sold !== '' ? quantity_sold : prev.quantity_sold,
              unit: unit || prev.unit
            }));
            setShowSaleModal(true);
          }}
        />
      )}

      {/* ── MODAL 1: LOG HARVEST ── */}
      {showHarvestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {isTe ? 'పంట కోత / దిగుబడి నమోదు' : 'Log Harvest Output'}
              </h3>
              <button type="button" onClick={() => setShowHarvestModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleLogHarvest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'కోత తేదీ' : 'Harvest Date'}</label>
                  <input
                    type="date"
                    required
                    value={harvestForm.harvest_date}
                    onChange={(e) => setHarvestForm({ ...harvestForm, harvest_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'దఫా నంబర్' : 'Picking Number'}</label>
                  <input
                    type="number"
                    min="1"
                    placeholder={`e.g. ${harvests.length + 1}`}
                    value={harvestForm.picking_number}
                    onChange={(e) => setHarvestForm({ ...harvestForm, picking_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'దిగుబడి పరిమాణం' : 'Quantity'}</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="e.g. 25"
                    value={harvestForm.quantity}
                    onChange={(e) => setHarvestForm({ ...harvestForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'కొలత యూనిట్' : 'Unit'}</label>
                  <select
                    value={harvestForm.unit}
                    onChange={(e) => setHarvestForm({ ...harvestForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="quintal">Quintal (Qtl)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="tonne">Tonne / Ton</option>
                    <option value="crates">Crates</option>
                    <option value="bags">Bags</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'నాణ్యత గ్రేడ్' : 'Quality Grade'}</label>
                <select
                  value={harvestForm.grade}
                  onChange={(e) => setHarvestForm({ ...harvestForm, grade: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <option value="Grade A">Grade A (Premium / Export)</option>
                  <option value="Grade B">Grade B (Standard Market)</option>
                  <option value="Grade C">Grade C (Local Mandi)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'గమనికలు (ఐచ్ఛికం)' : 'Notes (Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. First picking, good fruit shine"
                  value={harvestForm.notes}
                  onChange={(e) => setHarvestForm({ ...harvestForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowHarvestModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  {isTe ? 'రద్దు' : 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50">
                  {submitting ? '...' : (isTe ? 'దిగుబడి భద్రపరచు' : 'Save Harvest')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── MODAL 2: RECORD SALE ── */}
      {showSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {isTe ? 'పంట అమ్మకం నమోదు' : 'Record Crop Sale'}
              </h3>
              <button type="button" onClick={() => setShowSaleModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleRecordSale} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'అమ్మకం తేదీ' : 'Sale Date'}</label>
                <input
                  type="date"
                  required
                  value={saleForm.sale_date}
                  onChange={(e) => setSaleForm({ ...saleForm, sale_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'అమ్మిన పరిమాణం' : 'Quantity Sold'}</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="e.g. 20"
                    value={saleForm.quantity_sold}
                    onChange={(e) => setSaleForm({ ...saleForm, quantity_sold: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'యూనిట్' : 'Unit'}</label>
                  <select
                    value={saleForm.unit}
                    onChange={(e) => setSaleForm({ ...saleForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="quintal">Quintal (Qtl)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="tonne">Tonne</option>
                    <option value="crates">Crates</option>
                    <option value="bags">Bags</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  {isTe ? 'యూనిట్ ధర (₹)' : 'Price Per Unit (₹)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="e.g. 1800"
                  value={saleForm.price_per_unit}
                  onChange={(e) => setSaleForm({ ...saleForm, price_per_unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
                {saleForm.quantity_sold && saleForm.price_per_unit && (
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {isTe ? 'మొత్తం అమ్మకం విలువ:' : 'Total Value:'} ₹{(parseFloat(saleForm.quantity_sold) * parseFloat(saleForm.price_per_unit)).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'కొనుగోలుదారుడు / వ్యాపారి' : 'Buyer / Trader'}</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Trader"
                    value={saleForm.buyer}
                    onChange={(e) => setSaleForm({ ...saleForm, buyer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'మార్కెట్ / మండి' : 'APMC Mandi'}</label>
                  <input
                    type="text"
                    placeholder="e.g. Guntur APMC"
                    value={saleForm.mandi}
                    onChange={(e) => setSaleForm({ ...saleForm, mandi: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Explicit Farm Khata Checkbox */}
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    {isTe ? 'డిజిటల్ ఖాతాలో ఆదాయంగా జోడించాలా?' : 'Add to Farm Khata Income?'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isTe ? 'ఆటోమేటిక్‌గా ఖాతాలో లాభం లెక్కింపుకు కలుస్తుంది' : 'Automatically logs this sale under Farm Khata income'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={saleForm.record_in_khata}
                  onChange={(e) => setSaleForm({ ...saleForm, record_in_khata: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowSaleModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  {isTe ? 'రద్దు' : 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50">
                  {submitting ? '...' : (isTe ? 'అమ్మకం భద్రపరచు' : 'Save Sale')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── MODAL 3: CLOSE SEASON ── */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
                {isTe ? 'పంట సీజన్ ముగించు' : 'Close Current Season'}
              </h3>
              <button type="button" onClick={() => setShowCloseModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isTe
                ? 'సీజన్ ముగిసిన తర్వాత అన్ని దిగుబడులు, ఖర్చులు మరియు లాభం స్కోర్‌కార్డ్ చరిత్రలో శాశ్వతంగా భద్రపరచబడతాయి.'
                : 'Closing the season will calculate the final Performance Scorecard and safely archive all harvest, sale, and Khata records in your history.'}
            </p>

            <form onSubmit={handleCloseSeason} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'సీజన్ ముగింపు తేదీ' : 'Season End Date'}</label>
                <input
                  type="date"
                  required
                  value={closeForm.season_end_date}
                  onChange={(e) => setCloseForm({ ...closeForm, season_end_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'సీజన్ ముగింపు గమనికలు' : 'Season Conclusion Notes'}</label>
                <input
                  type="text"
                  placeholder="e.g. Excellent yield, minimal pest damage"
                  value={closeForm.notes}
                  onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowCloseModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  {isTe ? 'రద్దు' : 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50">
                  {submitting ? '...' : (isTe ? 'సీజన్ ముగించి ఆర్కైవ్ చేయి' : 'Complete & Archive Season')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── MODAL 4: START NEW SEASON ── */}
      {showNewSeasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                {isTe ? 'కొత్త పంట సీజన్ ప్రారంభం' : 'Start New Crop Season'}
              </h3>
              <button type="button" onClick={() => setShowNewSeasonModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleStartNewSeason} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'పంట పేరు' : 'Crop Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tomato, Rice, Chilli"
                  value={newSeasonForm.crop_name}
                  onChange={(e) => setNewSeasonForm({ ...newSeasonForm, crop_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'పంట రకం / వెరైటీ' : 'Variety'}</label>
                  <input
                    type="text"
                    placeholder="e.g. US 440, Sona Masoori"
                    value={newSeasonForm.variety}
                    onChange={(e) => setNewSeasonForm({ ...newSeasonForm, variety: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'విస్తీర్ణం (ఎకరాలు)' : 'Area (Acres)'}</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={newSeasonForm.area}
                    onChange={(e) => setNewSeasonForm({ ...newSeasonForm, area: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'నాటిన తేదీ' : 'Planting Date'}</label>
                <input
                  type="date"
                  value={newSeasonForm.planting_date}
                  onChange={(e) => setNewSeasonForm({ ...newSeasonForm, planting_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">{isTe ? 'సీజన్ పేరు (ఐచ్ఛికం)' : 'Season Name (Optional)'}</label>
                <input
                  type="text"
                  placeholder="e.g. Rabi 2026-27"
                  value={newSeasonForm.season_name}
                  onChange={(e) => setNewSeasonForm({ ...newSeasonForm, season_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowNewSeasonModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  {isTe ? 'రద్దు' : 'Cancel'}
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50">
                  {submitting ? '...' : (isTe ? 'సీజన్ ప్రారంభించు' : 'Launch New Season')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
