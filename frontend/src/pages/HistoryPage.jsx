import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, Download, FileText, FileSpreadsheet, Trash2, Calendar, Eye, 
  ChevronLeft, ChevronRight, ChevronDown, Activity, Cpu, RefreshCw,
  Info as InfoIcon, ShieldAlert, CheckCircle2, Leaf as LeafIcon, Volume2, Sparkles,
  Printer, MessageCircle, Calculator
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useHardwareMode } from '../hooks/useHardwareMode';
import { getDiseaseDetails, translateCrop, translateDisease } from '../utils/diseaseAdvisoryData';
import { shareDiagnosticToWhatsApp, printPrescriptionSlip } from '../utils/prescriptionShare';
import { AcreageDosageCalculator } from '../components/intelligence/AcreageDosageCalculator';
import { parseServerDate, formatDateTime } from '../utils/dateUtils';
import { Card, Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Dialog, EmptyState, Skeleton, Progress } from '../components/ui/index';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const HistoryPage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const { hardwareMode } = useHardwareMode();
  const wsCtx = useWebSocket();
  const subscribe = wsCtx?.subscribe;
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('prediction');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const backendBaseUrl = import.meta.env.VITE_API_URL || '';

  const [predictionData, setPredictionData] = useState([]);
  const [sensorData, setSensorData] = useState([]);

  const [search, setSearch] = useState('');
  const [layoutMode, setLayoutMode] = useState('grid'); // Default to grid for visual farmer-first aesthetic
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [selectedFarmer, setSelectedFarmer] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState('all');

  const uniqueFarmers = useMemo(() => {
    const list = activeTab === 'prediction' ? predictionData : sensorData;
    const farmers = new Set();
    list.forEach(item => {
      if (item.farmer_name) farmers.add(item.farmer_name);
    });
    return Array.from(farmers).sort();
  }, [predictionData, sensorData, activeTab]);

  const uniqueDevices = useMemo(() => {
    const devices = new Set();
    sensorData.forEach(item => {
      if (item.device || item.device_id) devices.add(item.device || item.device_id);
    });
    return Array.from(devices).sort();
  }, [sensorData]);

  const itemsPerPage = 10;

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectRecord, setInspectRecord] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const toggleExpand = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    API.get('/api/v1/devices/status').then(res => {
      const nodes = Array.isArray(res.data) ? res.data : (res.data?.nodes || []);
      setIsOnline(nodes.some(n => n.status === 'online'));
    }).catch(() => setIsOnline(false));
  }, []);

  const fetchData = useCallback(async (isManual = false) => {
    if (!predictionData.length && !sensorData.length && !isManual) setLoading(true);
    if (isManual) setIsRefreshing(true);
    try {
      const res = await API.get('/api/history', { params: { limit: 5000, page: 1 } });
      const rawPreds = res.data.predictions || [];
      const formattedPreds = rawPreds.map(p => {
        const pDate = p.created_at || p.prediction_date;
        const pTs = pDate ? parseServerDate(pDate) : null;
        return {
          ...p,
          displayDate: pTs && !isNaN(pTs.getTime()) ? pTs.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : (p.prediction_date || 'N/A'),
          displayTime: pTs && !isNaN(pTs.getTime()) ? pTs.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : (p.prediction_time || 'N/A')
        };
      });
      setPredictionData(formattedPreds);
      
      if (hardwareMode) {
        try {
          const telRes = await API.get('/api/v1/iot/telemetry/history', { params: { limit: 5000, timeframe: 'raw' } });
          let rawData = telRes.data || [];
          
          const parseDateTime = (raw) => {
            if (!raw || raw === 'null') return null;
            if (typeof raw === 'string') {
              let s = raw.trim();
              if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
                s = s.replace(' ', 'T');
              }
              // Naive ISO strings from backend (UTC) need 'Z' appended to parse correctly in browser local time
              if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) && !s.includes('+') && !s.includes('Z') && !s.includes('z')) {
                s = s + 'Z';
              }
              const d = new Date(s);
              if (!isNaN(d.getTime())) return d;
            }
            const d = new Date(raw);
            return !isNaN(d.getTime()) ? d : null;
          };

          // Sort newest first based on true sensor reading timestamp (falls back to received_at)
          rawData.sort((a, b) => {
            const timeA = parseDateTime(a.timestamp || a.received_at)?.getTime() || 0;
            const timeB = parseDateTime(b.timestamp || b.received_at)?.getTime() || 0;
            return timeB - timeA;
          });
          
          const now = new Date();
          const rows = rawData.map((n, i) => {
            let ts = parseDateTime(n.timestamp);
            const recTs = parseDateTime(n.received_at);
            if (!ts || (ts.getTime() > now.getTime() + 900000 && recTs)) {
              ts = recTs;
            }
            let isoDateStr = '';
            if (ts) {
              const year = ts.getFullYear();
              const month = String(ts.getMonth() + 1).padStart(2, '0');
              const day = String(ts.getDate()).padStart(2, '0');
              isoDateStr = `${year}-${month}-${day}`;
            }

            return {
              id: n.id || `sens-${i}`,
              rawDate: isoDateStr,
              rawTimestamp: n.timestamp,
              date: ts ? ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'N/A',
              time: ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : 'N/A',
              temperature: n.temperature ?? '--',
              humidity: n.humidity ?? '--',
              light: n.light_intensity ?? '--',
              soil: n.soil_moisture ?? '--',
              rain: n.rain_sensor ? '1' : '0',
              battery: n.battery_percentage ?? '--',
              device: n.device_id || 'ESP32-Node-1',
              farmer_name: n.farmer_name || 'Unknown',
              sleep_interval_min: n.sleep_interval_min ?? null,
              is_night_mode: n.is_night_mode ?? null,
            };
          });
          setSensorData(rows);
          if (isManual) {
            setToastMsg('✅ Sensor telemetry and logs refreshed!');
          }
        } catch (err) {
          console.warn("Sensor data fetch failed", err);
          setSensorData([]);
        }
      } else {
        setSensorData([]);
      }
    } catch (err) {
      console.error(err);
      if (!predictionData.length) setToastMsg('Failed to load history data.');
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [predictionData.length, sensorData.length, hardwareMode]);

  // If hardware mode is turned off while on sensor tab, immediately switch to prediction tab
  useEffect(() => {
    if (!hardwareMode && activeTab === 'sensor') {
      setActiveTab('prediction');
    }
  }, [hardwareMode, activeTab]);

  useEffect(() => {
    fetchData();
    let interval;
    if (isOnline && hardwareMode) {
      interval = setInterval(() => fetchData(), 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline, fetchData, hardwareMode]);

  // Auto-refresh logs when offline field scans are synchronized
  useEffect(() => {
    const handleSyncFinished = () => {
      fetchData(true);
    };
    window.addEventListener('agrishield-sync-completed', handleSyncFinished);
    return () => {
      window.removeEventListener('agrishield-sync-completed', handleSyncFinished);
    };
  }, [fetchData]);

  // Real-time auto-refresh when ESP32 flushes its offline SD queue or live telemetry arrives
  useEffect(() => {
    if (!subscribe) return;
    const unsubBatch = subscribe('prediction_batch', () => {
      fetchData(false);
    });
    let unsubTelemBatch = null;
    let unsubTelem = null;
    if (hardwareMode) {
      unsubTelemBatch = subscribe('telemetry_batch_synced', (data) => {
        fetchData(false);
        setToastMsg(`🚀 Synced ${data?.count || 'batch'} historical sensor records from device!`);
        setTimeout(() => setToastMsg(''), 4500);
      });
      unsubTelem = subscribe('telemetry_update', () => {
        fetchData(false);
      });
    }
    return () => {
      if (unsubBatch) unsubBatch();
      if (unsubTelemBatch) unsubTelemBatch();
      if (unsubTelem) unsubTelem();
    };
  }, [subscribe, fetchData, hardwareMode]);


  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, activeTab]);

  const setQuickDate = (type) => {
    const now = new Date();
    const getIso = (d) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };
    
    if (type === 'today') {
      const todayStr = getIso(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(getIso(past));
      setEndDate(getIso(now));
    } else if (type === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(getIso(past));
      setEndDate(getIso(now));
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const getItemIsoDate = (item, tab) => {
    if (tab === 'prediction') {
      const raw = item.prediction_date || item.created_at || item.timestamp || '';
      if (!raw) return '';
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10);
      }
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
      }
      return '';
    } else {
      return item.rawDate || '';
    }
  };

  const processedData = useMemo(() => {
    let data = activeTab === 'prediction' ? [...predictionData] : [...sensorData];

    if (search) {
      const lowerSearch = search.toLowerCase();
      data = data.filter(item => {
        if (activeTab === 'prediction') {
          return (
            (item.crop_name || '').toLowerCase().includes(lowerSearch) ||
            (item.disease_name || '').toLowerCase().includes(lowerSearch) ||
            (item.prediction_status || '').toLowerCase().includes(lowerSearch)
          );
        } else {
          return (item.device || '').toLowerCase().includes(lowerSearch);
        }
      });
    }

    if (startDate) {
      data = data.filter(item => {
        const itemDate = getItemIsoDate(item, activeTab);
        return itemDate && itemDate >= startDate;
      });
    }
    if (endDate) {
      data = data.filter(item => {
        const itemDate = getItemIsoDate(item, activeTab);
        return itemDate && itemDate <= endDate;
      });
    }

    
    if (selectedFarmer !== 'all') {
      data = data.filter(item => item.farmer_name === selectedFarmer);
    }
    if (activeTab === 'sensor' && selectedDevice !== 'all') {
      data = data.filter(item => (item.device || item.device_id) === selectedDevice);
    }

    return data;
  }, [predictionData, sensorData, activeTab, search, startDate, endDate, selectedFarmer, selectedDevice]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage) || 1;
  const currentItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, page, itemsPerPage]);

  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Are you sure you want to delete this scan record?")) return;
    try {
      await API.delete(`/api/history/${id}`);
      setPredictionData(prev => prev.filter(item => item.id !== id));
      setToastMsg('Record deleted successfully.');
    } catch {
      setToastMsg('Failed to delete record.');
    }
  };

  const handleExportCSV = () => {
    if (processedData.length === 0) return;
    let headers = [];
    let rows = [];

    if (activeTab === 'prediction') {
      headers = ["ID", "Farmer", "Date", "Time", "Crop", "Disease", "Confidence (%)", "Status"];
      rows = processedData.map(p => [
        p.id,
        p.farmer_name || 'N/A',
        p.displayDate || p.prediction_date || 'N/A',
        p.displayTime || p.prediction_time || 'N/A',
        p.crop_name,
        p.disease_name,
        (p.confidence * 100).toFixed(1),
        p.prediction_status
      ]);
    } else {
      headers = ["ID", "Device", "Farmer", "Date", "Time", "Temp (C)", "Humidity (%)", "Soil (%)", "Light (lux)", "Rain", "Battery (%)", "Sleep Interval (min)", "Mode"];
      rows = processedData.map(s => [
        s.id,
        s.device,
        s.farmer_name || 'N/A',
        s.date,
        s.time,
        s.temperature,
        s.humidity,
        s.soil,
        s.light,
        s.rain === '1' ? 'Wet' : 'Dry',
        s.battery,
        s.sleep_interval_min ?? 'N/A',
        s.is_night_mode === true ? 'Night' : s.is_night_mode === false ? 'Day' : 'N/A'
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agrishield_${activeTab}_history_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-28 sm:pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-sm font-medium flex items-center gap-2"
        >
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="ml-2 text-slate-400 hover:text-white">&times;</button>
        </motion.div>
      )}

      {/* Title Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('history.title', 'Scan & Diagnostic History')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('history.subtitle', 'Searchable, paginated audit records for crop health scans and diagnostic history.')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            leftIcon={<RefreshCw className={`w-4 h-4 text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="w-full sm:w-auto font-semibold border-emerald-500/40 hover:border-emerald-500/80 text-emerald-700 dark:text-emerald-300"
          >
            {isRefreshing ? t('history.refreshing', 'Refreshing...') : t('history.reload', 'Reload')}
          </Button>

          <Button variant="sky" size="sm" onClick={handleExportCSV} leftIcon={<Download className="w-4 h-4" />} className="w-full sm:w-auto font-bold">
            {t('history.export_csv', 'Export CSV Log')}
          </Button>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <Card glass className="p-3 sm:p-4 border-slate-200/90 dark:border-slate-800 space-y-3 shadow-sm sticky top-16 sm:static z-30 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 rounded-2xl border border-slate-300/80 dark:border-slate-800 shrink-0 flex-1 sm:flex-none">
            <Button
              variant={activeTab === 'prediction' ? 'gradient' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('prediction')}
              className="text-xs font-bold rounded-xl flex-1 sm:flex-none justify-center"
            >
              {t('history.tabs.predictions', 'AI Predictions')} ({predictionData.length})
            </Button>
            {hardwareMode && (
              <Button
                variant={activeTab === 'sensor' ? 'gradient' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('sensor')}
                className="text-xs font-bold rounded-xl flex-1 sm:flex-none justify-center"
              >
                {t('history.tabs.telemetry', 'Sensor Telemetry')} ({sensorData.length})
              </Button>
            )}
          </div>

          {/* Layout Mode Toggler (Desktop/Mobile) */}
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 rounded-2xl border border-slate-300/80 dark:border-slate-800">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all ${
                layoutMode === 'grid'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
              }`}
            >
              🖼️ {t('history.views.grid', 'Grid')}
            </button>
            <button
              onClick={() => setLayoutMode('table')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-all ${
                layoutMode === 'table'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
              }`}
            >
              📋 {t('history.views.table', 'Table')}
            </button>
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0 active:scale-95 transition-all"
          >
            <Filter className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('history.filters.filter_btn', 'Filter')}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMobileFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Quick Presets (Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">{t('history.filters.quick_label', 'Quick:')}</span>
            <button
              onClick={() => setQuickDate('today')}
              className="px-3 py-1 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs transition-all"
            >
              {t('history.filters.today', 'Today')}
            </button>
            <button
              onClick={() => setQuickDate('7days')}
              className="px-3 py-1 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs transition-all"
            >
              {t('history.filters.days_7', '7 Days')}
            </button>
            <button
              onClick={() => setQuickDate('30days')}
              className="px-3 py-1 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs transition-all"
            >
              {t('history.filters.days_30', '30 Days')}
            </button>
            <button
              onClick={() => setQuickDate('all')}
              className="px-3 py-1 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs transition-all"
            >
              {t('history.filters.all_time', 'All Time')}
            </button>
          </div>
        </div>

        {/* Search and Date Pickers (Always visible on desktop, collapsible on mobile) */}
        <div className={`${showMobileFilters ? 'flex' : 'hidden sm:flex'} flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 transition-all`}>
          {/* Quick Presets for Mobile */}
          <div className="flex sm:hidden items-center gap-1.5 flex-wrap w-full mb-1">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">{t('history.filters.quick_label', 'Quick:')}</span>
            {['today', '7days', '30days', 'all'].map((preset) => (
              <button
                key={preset}
                onClick={() => setQuickDate(preset)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 active:bg-emerald-50 dark:active:bg-emerald-950/50"
              >
                {preset === 'today' ? t('history.filters.today', 'Today') : preset === '7days' ? t('history.filters.days_7', '7 Days') : preset === '30days' ? t('history.filters.days_30', '30 Days') : t('history.filters.all_time', 'All')}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-60">
            <Input
              placeholder={t('history.filters.search_placeholder', 'Search crop, disease, status...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="text-xs"
            />
          </div>

          {/* Clean Inline Date Range Box */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 w-full sm:w-auto justify-between sm:justify-start">
            <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-400 uppercase">{t('history.filters.from', 'From')}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            />
            <span className="text-[11px] font-bold text-slate-400 uppercase">{t('history.filters.to', 'To')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            />
          </div>

          {(startDate || endDate || search || selectedFarmer !== 'all' || selectedDevice !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); setSelectedFarmer('all'); setSelectedDevice('all'); }}
              className="text-xs text-rose-500 hover:bg-rose-500/10 font-medium px-2.5"
            >
              {t('history.filters.reset_filters', 'Reset Filters')}
            </Button>
          )}

          {isAdmin && (
            <select
              value={selectedFarmer}
              onChange={(e) => setSelectedFarmer(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium w-full sm:w-auto"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t('history.filters.all_farmers', 'All Farmers')}</option>
              {uniqueFarmers.map(f => (
                <option key={f} value={f} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{f}</option>
              ))}
            </select>
          )}
          {isAdmin && activeTab === 'sensor' && (
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium w-full sm:w-auto"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t('history.filters.all_devices', 'All Devices')}</option>
              {uniqueDevices.map(d => (
                <option key={d} value={d} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{d}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* Main Data Section */}
      {processedData.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={t('history.empty_title', 'No History Records Found')}
          description={t('history.empty_desc', 'Try broadening your search keywords or adjusting date range filters.')}
        />
      ) : (
        <div className="space-y-4">

          {/* ══ MOBILE CARD VIEW (visible only on mobile, hidden sm+) ══ */}
          <div className="block sm:hidden space-y-3">
            {currentItems.map((item) => {
              const isExpanded = expandedCards.has(item.id);
              if (activeTab === 'prediction') {
                const isHealthy = item.prediction_status === 'healthy';
                return (
                  <div
                    key={item.id}
                    className="sensor-card-mobile bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                  >
                    <div className="p-3.5 flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {item.image_path ? (
                          <img
                            src={`${backendBaseUrl}/${item.image_path.replace(/\\/g, '/')}`}
                            alt="Scan"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] font-semibold">{t('history.no_photo', 'No Photo')}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {translateCrop(item.crop_name, i18n.language)}
                          </span>
                          <Badge variant={isHealthy ? 'healthy' : 'diseased'} className="shrink-0 text-[10px]">
                            {translateDisease(item.disease_name, i18n.language)}
                          </Badge>
                        </div>
                        {isAdmin && <p className="text-[11px] font-semibold text-sky-500 mt-0.5">{item.farmer_name || 'Unknown'}</p>}
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.displayDate || item.prediction_date} · {item.displayTime || item.prediction_time}</p>
                        <p className="text-xs font-black text-emerald-500 dark:text-emerald-400 mt-1 font-mono">
                          {(item.confidence * 100).toFixed(1)}% {t('history.table_headers.confidence', 'confidence')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3.5 pb-3">
                      <button
                        onClick={() => { setInspectRecord(item); setInspectModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" /> {t('history.table_headers.details', 'View Details')}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteRecord(item.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-all active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t('history.table_headers.delete', 'Delete')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else {
                // Sensor log card
                return (
                  <div
                    key={item.id}
                    className="sensor-card-mobile bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Card header — tap to expand */}
                    <button
                      className="w-full p-3.5 flex items-center justify-between text-left active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                          <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">{item.device}</p>
                          {isAdmin && <p className="text-[11px] font-semibold text-sky-500 truncate">{item.farmer_name}</p>}
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.date} · {item.time}</p>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Always-visible key metrics */}
                    <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50">🌡️ {item.temperature}°C</span>
                      <span className="text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50">💧 {item.humidity}%</span>
                      <span className="text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">🌱 {item.soil}%</span>
                      {item.sleep_interval_min != null && (
                        <span className={`text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full border ${item.is_night_mode ? 'sleep-badge-night' : 'sleep-badge-day'}`}>
                          {item.is_night_mode ? '🌙' : '☀️'} {item.sleep_interval_min}m
                        </span>
                      )}
                    </div>

                    {/* Expanded — full sensor details */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">{t('history.full_reading', 'Full Reading')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">☀️ {item.light} lx</span>
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">🌧️ {item.rain === '1' ? t('history.wet', 'Wet') : t('history.dry', 'Dry')}</span>
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/50">🔋 {item.battery}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
            })}

            {/* Mobile Pagination */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, processedData.length)} {t('history.pagination.of', 'of')} {processedData.length}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                  {t('history.pagination.prev', 'Prev')}
                </Button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">{page}/{totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight className="w-4 h-4" />}>
                  {t('history.pagination.next', 'Next')}
                </Button>
              </div>
            </div>
          </div>

          {/* ══ DESKTOP VIEWS (hidden on mobile, visible sm+) ══ */}
          <div className="hidden sm:block">
            {layoutMode === 'grid' ? (
              activeTab === 'prediction' ? (
                /* Visual Prediction Cards Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentItems.map((item) => {
                    const isHealthy = item.prediction_status === 'healthy';
                    return (
                      <Card key={item.id} className="overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all flex flex-col justify-between bg-white dark:bg-slate-900">
                        <div>
                          {/* Image Thumbnail */}
                          <div className="h-40 w-full bg-slate-100 dark:bg-slate-950 relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
                            {item.image_path ? (
                              <img
                                src={`${backendBaseUrl}/${item.image_path.replace(/\\/g, '/')}`}
                                alt="Leaf Scan"
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">{t('history.no_image', 'No Image')}</div>
                            )}
                            <div className="absolute top-2 right-2">
                              <Badge variant={isHealthy ? 'healthy' : 'diseased'} className="text-[10px] shadow-sm">
                                {isHealthy ? `🟢 ${t('common.healthy', 'HEALTHY')}` : `🔴 ${t('common.diseased', 'DISEASED')}`}
                              </Badge>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                                {translateCrop(item.crop_name, i18n.language)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono font-semibold">{item.displayDate || item.prediction_date}</span>
                            </div>

                            <h3 className="font-bold text-xs text-slate-700 dark:text-slate-350 leading-snug flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60">
                              <span className="truncate">🩺 {translateDisease(item.disease_name, i18n.language)}</span>
                              <button
                                onClick={() => {
                                  if ('speechSynthesis' in window) {
                                    const textToSpeak = translateDisease(item.disease_name, i18n.language);
                                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                                    if (i18n.language === 'te') utterance.lang = 'te-IN';
                                    else if (i18n.language === 'hi') utterance.lang = 'hi-IN';
                                    else if (i18n.language === 'ta') utterance.lang = 'ta-IN';
                                    window.speechSynthesis.speak(utterance);
                                  }
                                }}
                                className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors shrink-0"
                                title={t('history.modal.pronounce', 'Hear Pronunciation')}
                              >
                                🔊
                              </button>
                            </h3>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                <span>{t('history.table_headers.confidence', 'Confidence')}</span>
                                <span className="font-mono">{(item.confidence * 100).toFixed(1)}%</span>
                              </div>
                              <Progress value={item.confidence * 100} size="sm" />
                            </div>

                            {isAdmin && <p className="text-[10px] font-semibold text-sky-500">{t('history.table_headers.farmer', 'Farmer')}: {item.farmer_name || 'Unknown'}</p>}
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                          <Button 
                            size="xs" 
                            variant="ghost" 
                            onClick={() => { setInspectRecord(item); setInspectModalOpen(true); }} 
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            className="text-slate-600 dark:text-slate-300 font-semibold"
                          >
                            {t('history.table_headers.details', 'Details')}
                          </Button>
                          {isAdmin && (
                            <Button 
                              size="xs" 
                              variant="ghost" 
                              onClick={() => handleDeleteRecord(item.id)} 
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-bold"
                            >
                              {t('history.table_headers.delete', 'Delete')}
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                /* Visual Sensor Cards Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {currentItems.map((item) => (
                    <Card key={item.id} className="p-4 border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all space-y-3 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{item.device}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">{item.date} {item.time}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/50 text-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">{t('history.temp', 'Temp')}</span>
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-0.5 block">🌡️ {item.temperature}°C</span>
                        </div>
                        <div className="p-2 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/50 text-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">{t('history.humid', 'Humid')}</span>
                          <span className="text-xs font-bold text-sky-600 dark:text-sky-400 mt-0.5 block">💧 {item.humidity}%</span>
                        </div>
                        <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50 text-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">{t('history.soil', 'Soil')}</span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">🌱 {item.soil}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2 font-semibold">
                        <span>☀️ Light: {item.light} lx</span>
                        <span>🌧️ Rain: {item.rain === '1' ? t('history.wet', 'Wet') : t('history.dry', 'Dry')}</span>
                        <span>🔋 Batt: {item.battery}%</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              /* Tabular Table View */
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {activeTab === 'prediction' ? (
                        <>
                          <TableHead>{t('history.table_headers.thumbnail', 'Thumbnail')}</TableHead>
                          {isAdmin && <TableHead>{t('history.table_headers.farmer', 'Farmer / Owner')}</TableHead>}
                          <TableHead>{t('history.table_headers.date_time', 'Date & Time')}</TableHead>
                          <TableHead>{t('history.table_headers.crop', 'Crop Target')}</TableHead>
                          <TableHead>{t('history.table_headers.diagnosis', 'Diagnosis / Status')}</TableHead>
                          <TableHead>{t('history.table_headers.confidence', 'Confidence')}</TableHead>
                          <TableHead className="text-right">{t('history.table_headers.actions', 'Actions')}</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>{t('history.node', 'Device Node')}</TableHead>
                          {isAdmin && <TableHead>{t('history.table_headers.farmer', 'Farmer / Owner')}</TableHead>}
                          <TableHead>{t('history.table_headers.date_time', 'Date & Time')}</TableHead>
                          <TableHead>{t('history.temp', 'Temp')} (°C)</TableHead>
                          <TableHead>{t('history.humidity_pct', 'Humidity (%)')}</TableHead>
                          <TableHead>{t('history.soil_moisture', 'Soil Moisture')}</TableHead>
                          <TableHead>{t('history.light_lux', 'Light (lux)')}</TableHead>
                          <TableHead>{t('history.sleep_cycle', 'Sleep Cycle')}</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((item) => {
                      if (activeTab === 'prediction') {
                        const isHealthy = item.prediction_status === 'healthy';
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="w-10 h-10 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                                {item.image_path ? (
                                  <img
                                    src={`${backendBaseUrl}/${item.image_path.replace(/\\/g, '/')}`}
                                    alt="Scan"
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">{t('history.photo', 'Photo')}</div>
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && <TableCell className="text-xs font-bold text-sky-600 dark:text-sky-400">{item.farmer_name || 'Unknown'}</TableCell>}
                            <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.displayDate || item.prediction_date}</span>
                                <span className="text-[11px] text-slate-400 font-mono">{item.displayTime || item.prediction_time}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {translateCrop(item.crop_name, i18n.language)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={isHealthy ? 'healthy' : 'diseased'}>
                                {translateDisease(item.disease_name, i18n.language)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                              {(item.confidence * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => { setInspectRecord(item); setInspectModalOpen(true); }}
                                  title={t('history.table_headers.details', 'Inspect Details')}
                                >
                                  <Eye className="w-4 h-4 text-slate-500" />
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteRecord(item.id)}
                                    title={t('history.table_headers.delete', 'Delete Record')}
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-500" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      } else {
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-emerald-500" />
                                {item.device}
                              </div>
                            </TableCell>
                            {isAdmin && <TableCell className="text-xs font-bold text-sky-600 dark:text-sky-400">{item.farmer_name || 'Unknown'}</TableCell>}
                            <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.date}</span>
                                <span className="text-[11px] text-slate-400 font-mono">{item.time}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-orange-50/50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50 shadow-sm">
                                {item.temperature}°C
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-sky-50/50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50 shadow-sm">
                                {item.humidity}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50 shadow-sm">
                                {item.soil}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50 shadow-sm">
                                {item.light} lx
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.sleep_interval_min != null ? (
                                <div className="flex flex-col items-start gap-0.5">
                                  <Badge variant="outline" className={`text-[10px] font-bold shadow-sm ${
                                    item.is_night_mode
                                      ? 'bg-indigo-50/50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50'
                                      : 'bg-emerald-50/50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                                  }`}>
                                    {item.is_night_mode ? '🌙' : '☀️'} {item.sleep_interval_min}m
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      }
                    })}
                  </TableBody>
                </Table>
              </>
            )}

            {/* Desktop Pagination Controls */}
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {t('history.pagination.showing', 'Showing')} {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, processedData.length)} {t('history.pagination.of', 'of')} {processedData.length} {t('history.pagination.entries', 'entries')}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} leftIcon={<ChevronLeft className="w-4 h-4" />}>
                  {t('history.pagination.prev', 'Previous')}
                </Button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-2">
                  {t('history.pagination.page', 'Page')} {page} {t('history.pagination.of', 'of')} {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} rightIcon={<ChevronRight className="w-4 h-4" />}>
                  {t('history.pagination.next', 'Next')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Inspect Modal */}
      <Dialog
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        maxWidth="max-w-2xl"
        title={t('history.modal.title', 'Diagnostic Advisory & Crop Treatment Plan')}
      >
        {inspectRecord && (() => {
          const isHealthy = inspectRecord.prediction_status === 'healthy';
          const details = getDiseaseDetails(inspectRecord.crop_name, inspectRecord.disease_name, i18n.language);
          const localizedCrop = translateCrop(inspectRecord.crop_name, i18n.language);
          const localizedDisease = translateDisease(inspectRecord.disease_name, i18n.language);

          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Header Profile */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="w-16 h-16 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                  {inspectRecord.image_path ? (
                    <img
                      src={`${backendBaseUrl}/${inspectRecord.image_path.replace(/\\/g, '/')}`}
                      alt="Crop Scan"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">🌿</div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                      {localizedCrop}
                    </span>
                    <Badge variant={isHealthy ? 'healthy' : 'diseased'} className="text-xs font-bold">
                      {isHealthy ? `🟢 ${t('common.healthy', 'HEALTHY')}` : `🔴 ${t('common.diseased', 'DISEASED')}`}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {localizedDisease}
                    </h4>
                    <button
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          const utterance = new SpeechSynthesisUtterance(localizedDisease);
                          if (i18n.language === 'te') utterance.lang = 'te-IN';
                          else if (i18n.language === 'hi') utterance.lang = 'hi-IN';
                          else if (i18n.language === 'ta') utterance.lang = 'ta-IN';
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors"
                      title={t('history.modal.pronounce', 'Hear Pronunciation')}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-left sm:text-right w-full sm:w-auto shrink-0 space-y-1">
                  <span className="text-[11px] text-slate-400 block font-mono">
                    📅 {inspectRecord.displayDate || inspectRecord.prediction_date} {inspectRecord.displayTime || inspectRecord.prediction_time}
                  </span>
                  <div className="flex items-center sm:justify-end gap-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('history.modal.confidence_score', 'Confidence')}:</span>
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {(inspectRecord.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Disease Overview / What is this disease? */}
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold text-xs">
                  <InfoIcon className="w-4 h-4 shrink-0" />
                  <span>{t('history.modal.disease_overview', 'What is this Disease?')}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {details.overview || (isHealthy ? t('history.modal.healthy_desc') : 'Pathological fungal/bacterial spot infection observed on leaf blade.')}
                </p>
              </div>

              {/* Chemical Treatment & Dosages */}
              <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{t('history.modal.chemical_treatment', 'Chemical Fungicides & Dosages')}</span>
                </div>
                {isHealthy ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t('history.modal.healthy_chem', 'No chemical spray or pesticide intervention needed.')}
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {details.chemicals?.map((chem, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-500 font-bold mt-0.5">•</span>
                        <span>{chem}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Organic & Biological Solutions */}
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  <LeafIcon className="w-4 h-4 shrink-0" />
                  <span>{t('history.modal.organic_treatment', 'Organic & Biological Solutions')}</span>
                </div>
                {isHealthy ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t('history.modal.healthy_org', 'Maintain balanced bio-fertilizers and compost.')}
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {details.organic?.map((org, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>{org}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Preventive Guidance */}
              {details.prevention && (
                <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>{t('history.modal.preventive_measures', 'Preventive Guidance')}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {details.prevention}
                  </p>
                </div>
              )}

              {/* Field Spray & Chemical Dosage Calculator */}
              {!isHealthy && (
                <AcreageDosageCalculator 
                  cropName={inspectRecord.displayCrop || inspectRecord.crop_name}
                  diseaseName={inspectRecord.displayDisease || inspectRecord.disease_name}
                  chemicalName={details.chemicals?.[0]?.split('@')[0]?.trim() || "Mancozeb 75% WP"}
                  dosagePerLiter={2.5}
                  unit="g"
                  initialAcres={activeFarm?.total_area || 1.0}
                />
              )}

              {/* Action Buttons: WhatsApp, Prescription PDF, and Close */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button 
                    variant="solid" 
                    size="sm" 
                    onClick={() => {
                      shareDiagnosticToWhatsApp({
                        cropName: inspectRecord.displayCrop || inspectRecord.crop_name,
                        diseaseName: inspectRecord.displayDisease || inspectRecord.disease_name,
                        confidence: (inspectRecord.confidence * 100).toFixed(1),
                        severity: isHealthy ? 'Healthy' : 'Active Symptoms',
                        chemicals: details.chemicals || [],
                        organic: details.organic || [],
                        prevention: details.prevention || '',
                        acres: activeFarm?.total_area || 1.0,
                        farmLocation: activeFarm?.location || 'Pasupugallu Farm',
                        farmerName: user?.name || activeFarm?.farm_name || 'AgriShield Farmer',
                        language: i18n?.language || 'en'
                      });
                    }}
                    className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold shadow-md shadow-[#25D366]/20 border-0 active:scale-95"
                    leftIcon={<MessageCircle className="w-4 h-4 fill-white" />}
                  >
                    Send to WhatsApp
                  </Button>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      printPrescriptionSlip({
                        cropName: inspectRecord.displayCrop || inspectRecord.crop_name,
                        diseaseName: inspectRecord.displayDisease || inspectRecord.disease_name,
                        confidence: (inspectRecord.confidence * 100).toFixed(1),
                        severity: isHealthy ? 'Healthy' : 'Active Symptoms',
                        chemicals: details.chemicals || [],
                        organic: details.organic || [],
                        prevention: details.prevention || '',
                        acres: activeFarm?.total_area || 1.0,
                        farmLocation: activeFarm?.location || 'Pasupugallu Farm',
                        farmerName: user?.name || activeFarm?.farm_name || 'AgriShield Farmer',
                        language: i18n?.language || 'en'
                      });
                    }}
                    className="font-extrabold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 active:scale-95"
                    leftIcon={<Printer className="w-4 h-4 text-emerald-500" />}
                  >
                    Prescription (PDF)
                  </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => setInspectModalOpen(false)}>
                  {t('history.modal.close', 'Close')}
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>
    </div>
  );
};

export default HistoryPage;
