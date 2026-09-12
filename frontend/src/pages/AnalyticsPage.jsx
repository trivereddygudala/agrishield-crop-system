import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  Calendar, Filter, BarChart2, Cpu, Thermometer, Droplets, Sun, CloudRain, Battery, 
  FileText, Download, AlertTriangle, CheckCircle, HelpCircle, HardDrive,
  Leaf, ShieldCheck, TrendingUp, AlertOctagon, Sparkles, Activity
} from 'lucide-react';
import API from '../services/api';
import { Card, Button, Spinner } from '../components/ui/index';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AnalyticsPage = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [timeframe, setTimeframe] = useState('today'); // 'today', '24h', '7d', '30d', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [notifAnalytics, setNotifAnalytics] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [viewMode, setViewMode] = useState('farmer'); // 'farmer' | 'detailed'
  const [analyticsDomain, setAnalyticsDomain] = useState('crop'); // 'crop' (AI Disease & Health) | 'sensors' (IoT Hardware)
  const [cropPredictions, setCropPredictions] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(true);

  // Chart Colors
  const colors = {
    temp: '#f97316', // Orange
    tempFill: '#ffedd5',
    humidity: '#0ea5e9', // Sky Blue
    humidityFill: '#e0f2fe',
    soil: '#10b981', // Emerald
    soilFill: '#d1fae5',
    light: '#eab308', // Amber/Yellow
    lightFill: '#fef3c7',
    rain: '#3b82f6', // Blue
    battery: '#22c55e', // Green
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Fetch crop disease scan history for AI Analytics
  useEffect(() => {
    const fetchCrops = async () => {
      try {
        setLoadingCrops(true);
        const res = await API.get('/api/history?limit=150');
        setCropPredictions(res.data.predictions || []);
      } catch (err) {
        console.warn('Failed to load crop history:', err);
      } finally {
        setLoadingCrops(false);
      }
    };
    fetchCrops();
  }, []);

  // Compute Crop Disease AI Statistics
  const cropStats = useMemo(() => {
    const total = cropPredictions.length;
    if (!total) {
      return {
        total: 0,
        healthy: 0,
        diseased: 0,
        healthScore: 100,
        avgConfidence: '98.5',
        topDisease: 'None',
        topDiseaseCount: 0,
        distribution: [
          { name: 'Healthy Crops', value: 1, color: '#10b981' }
        ],
        weekly: [],
        cropTypes: []
      };
    }

    const healthyCount = cropPredictions.filter(p => p.prediction_status === 'healthy' || p.disease_name?.toLowerCase().includes('healthy')).length;
    const diseasedCount = total - healthyCount;
    const healthScore = Math.round((healthyCount / total) * 100);
    const avgConfidence = (cropPredictions.reduce((acc, p) => acc + (p.confidence || 0.95), 0) / total * 100).toFixed(1);

    const diseaseMap = {};
    const cropMap = {};
    const dateMap = {};

    cropPredictions.forEach(p => {
      const dRaw = (p.disease_name || 'Healthy').split('___').pop().replace(/_/g, ' ');
      diseaseMap[dRaw] = (diseaseMap[dRaw] || 0) + 1;

      const cName = p.crop_name || (p.disease_name || '').split('___')[0].replace(/_/g, ' ') || 'Tomato';
      if (!cropMap[cName]) cropMap[cName] = { total: 0, healthy: 0 };
      cropMap[cName].total++;
      if (p.prediction_status === 'healthy' || p.disease_name?.toLowerCase().includes('healthy')) {
        cropMap[cName].healthy++;
      }

      const rawDate = p.created_at || p.prediction_date;
      if (rawDate) {
        const dObj = new Date(rawDate);
        if (!isNaN(dObj.getTime())) {
          const dKey = dObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          if (!dateMap[dKey]) dateMap[dKey] = { date: dKey, healthy: 0, diseased: 0, total: 0, ts: dObj.getTime() };
          dateMap[dKey].total++;
          if (p.prediction_status === 'healthy' || p.disease_name?.toLowerCase().includes('healthy')) {
            dateMap[dKey].healthy++;
          } else {
            dateMap[dKey].diseased++;
          }
        }
      }
    });

    const sortedDiseases = Object.entries(diseaseMap).sort((a, b) => b[1] - a[1]);
    const topDisease = sortedDiseases[0] ? sortedDiseases[0][0] : 'None';
    const topDiseaseCount = sortedDiseases[0] ? sortedDiseases[0][1] : 0;

    const PALETTE = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6', '#14b8a6'];
    const distribution = sortedDiseases.map(([name, val], idx) => ({
      name,
      value: val,
      color: name.toLowerCase().includes('healthy') ? '#10b981' : PALETTE[(idx + 1) % PALETTE.length]
    }));

    const weekly = Object.values(dateMap).sort((a, b) => a.ts - b.ts).slice(-8);

    const cropTypes = Object.entries(cropMap).map(([crop, stats]) => ({
      crop,
      total: stats.total,
      healthyPct: Math.round((stats.healthy / stats.total) * 100)
    })).sort((a, b) => b.total - a.total);

    return {
      total,
      healthy: healthyCount,
      diseased: diseasedCount,
      healthScore,
      avgConfidence,
      topDisease,
      topDiseaseCount,
      distribution,
      weekly,
      cropTypes
    };
  }, [cropPredictions]);

  // Fetch registered devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await API.get('/api/v1/devices/status');
        const devList = res.data || [];
        setDevices(devList);
        if (devList.length > 0) {
          setSelectedDevice(devList[0].device_id);
        } else {
          setSelectedDevice('');
        }
      } catch (err) {
        console.error('Failed to load devices:', err);
        setSelectedDevice('');
      }
    };
    fetchDevices();
  }, []);

  // Fetch telemetry history & summary when device/timeframe/custom-dates change
  useEffect(() => {
    if (!selectedDevice) {
      setLoading(false);
      return;
    }

    const selectedNode = devices.find(d => d.device_id === selectedDevice);
    const isOnline = selectedNode?.status === 'online';

    let interval;
    const fetchData = async () => {
      // Don't show loading on polling to prevent UI flicker
      if (!historyData.length) setLoading(true);
      try {
        let params = { device_id: selectedDevice, timeframe };
        if (timeframe === 'custom') {
          if (!startDate) {
            setLoading(false);
            return;
          }
          params.start_date = startDate;
          if (endDate) params.end_date = endDate;
        }

        const [historyRes, summaryRes, notifRes] = await Promise.all([
          API.get('/api/v1/iot/telemetry/history', { params }),
          API.get('/api/v1/iot/telemetry/summary', { params }),
          API.get('/api/v1/notifications/analytics').catch(err => {
            console.warn("Failed to load notifications analytics data:", err);
            return { data: null };
          })
        ]);

        let rawHistory = historyRes.data || [];
        
        // Sort oldest first for Recharts
        rawHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const uniqueHistory = Array.from(
          new Map(rawHistory.map(item => [item.timestamp, item])).values()
        );

        setHistoryData(uniqueHistory);
        setSummaryData(summaryRes.data || null);
        setNotifAnalytics(notifRes.data || null);
      } catch (err) {
        console.error('Failed to load telemetry stats:', err);
        if (!historyData.length) showToast('Error loading analytics telemetry data.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    if (isOnline) {
      interval = setInterval(fetchData, 60000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedDevice, timeframe, startDate, endDate, devices]);

  // Safe & Unique Date Formatting Helper for XAxis Ticks
  const formatDateTick = (t) => {
    if (!t) return '';
    try {
      const d = new Date(t);
      if (isNaN(d.getTime())) return '';
      
      const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' , timeZone: 'Asia/Kolkata'}); // Automatically includes AM/PM
      const month = d.toLocaleString('default', { month: 'short' });
      const day = d.getDate();
      
      if (timeframe === 'today' || timeframe === '24h') {
        return timeStr; // Just show '09:00 AM' for single day views
      }
      return `${month} ${day}, ${timeStr}`; // Show 'Aug 2, 09:00 AM' for multi-day views
    } catch (e) {
      return '';
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (historyData.length === 0) {
      return showToast('No data available to export.', 'warning');
    }

    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Soil Moisture (%)', 'Light Intensity (Lux)', 'Rain Status', 'Battery (%)', 'WiFi RSSI (dBm)'];
    const rows = historyData.map(d => [
      new Date(d.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      d.temperature ?? '',
      d.humidity ?? '',
      d.soil_moisture ?? '',
      d.light_intensity ?? '',
      d.rain_sensor ? 'Rain' : 'No Rain',
      d.battery_percentage ?? '',
      d.wifi_rssi ?? ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Telemetry_Report_${selectedDevice}_${timeframe}.csv`;
    link.click();
    showToast('CSV report downloaded successfully!');
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (historyData.length === 0 || !summaryData) {
      return showToast('No data available to generate PDF.', 'warning');
    }

    const doc = new jsPDF();
    const primaryColor = [16, 185, 129]; // Emerald 500

    // Title & Header Section
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Agri Shield Historical Analytics', 14, 25);
    doc.setFontSize(10);
    doc.text(`Report Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Device: ${selectedDevice} | Timeframe: ${timeframe.toUpperCase()}`, 14, 34);

    // Summary Statistics Grid
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFontSize(14);
    doc.text('1. Telemetry Summary Metrics', 14, 55);

    const summaryRows = [
      ['Metric', 'Value'],
      ['Average Temperature', summaryData.avg_temp !== null ? `${summaryData.avg_temp}°C` : 'N/A'],
      ['Maximum Temperature', summaryData.max_temp !== null ? `${summaryData.max_temp}°C` : 'N/A'],
      ['Minimum Temperature', summaryData.min_temp !== null ? `${summaryData.min_temp}°C` : 'N/A'],
      ['Average Humidity', summaryData.avg_humidity !== null ? `${summaryData.avg_humidity}%` : 'N/A'],
      ['Average Soil Moisture', summaryData.avg_soil !== null ? `${summaryData.avg_soil}%` : 'N/A'],
      ['Total Rain Events Recorded', `${summaryData.total_rain_events || 0}`],
      ['Latest Battery Level', summaryData.latest_battery !== null ? `${summaryData.latest_battery}%` : 'N/A'],
      ['Battery Health Status', `${summaryData.battery_status || 'Unknown'}`]
    ];

    autoTable(doc, {
      startY: 60,
      head: [summaryRows[0]],
      body: summaryRows.slice(1),
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 10 }
    });

    // Detailed Telemetry Table
    doc.setFontSize(14);
    doc.text('2. Historical Telemetry Logs', 14, (doc.lastAutoTable ? doc.lastAutoTable.finalY : 150) + 15);

    const headers = ['Timestamp', 'Temp (°C)', 'Hum (%)', 'Soil (%)', 'Light (lx)', 'Rain', 'Bat (%)'];
    const body = historyData.map(d => [
      new Date(d.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      d.temperature ?? 'N/A',
      d.humidity ?? 'N/A',
      d.soil_moisture ?? 'N/A',
      d.light_intensity ?? 'N/A',
      d.rain_sensor ? 'Rain' : 'Dry',
      d.battery_percentage ?? 'N/A'
    ]);

    autoTable(doc, {
      startY: (doc.lastAutoTable ? doc.lastAutoTable.finalY : 150) + 20,
      head: [headers],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 8 }
    });

    doc.save(`Telemetry_Analytics_${selectedDevice}_${timeframe}.pdf`);
    showToast('PDF report generated successfully!');
  };

  // Reusable Tooltip Component for Charts
  const CustomTooltip = ({ active, payload, label, unit }) => {
    if (active && payload && payload.length) {
      let formattedLabel = '';
      if (label) {
        try {
          const d = new Date(label);
          formattedLabel = isNaN(d.getTime()) ? String(label) : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        } catch (e) {
          formattedLabel = String(label);
        }
      }
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-200">
          <p className="font-bold text-xs text-slate-800 mb-1">
            {formattedLabel}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
              {entry.name}: {entry.value != null ? entry.value : 'N/A'} {unit}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full dark:text-slate-100">
      {/* Header and Control Bar */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl sm:text-3xl tracking-tight flex items-center gap-2">
            <BarChart2 className="text-primary-600 dark:text-primary-400 shrink-0" /> {t('nav.analytics', 'Historical Analytics')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            {t('analytics.subtitle', 'Analyze historical sensor trends, battery efficiency, and precipitation events.')}
          </p>
        </div>

        {/* Domain Switcher: Crop Disease AI vs Field Sensors */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl w-fit border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setAnalyticsDomain('crop')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              analyticsDomain === 'crop'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Leaf className="w-4 h-4" /> 🌾 Crop Disease AI Analytics
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsDomain('sensors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              analyticsDomain === 'sensors'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-4 h-4" /> 📡 Field Sensor Telemetry
          </button>
        </div>

        {/* Filters Panel (Only shown in sensors mode) */}
        {analyticsDomain === 'sensors' && (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-950 p-2.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Device Selector */}
            <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800 pr-3">
              <Cpu size={16} className="text-slate-400" />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="text-xs font-bold bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-300 py-1"
              >
                <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t('analytics.select_device', 'Select Device')}</option>
                {devices.map((d) => (
                  <option key={d.device_id} value={d.device_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {d.device_id} ({d.hardware_model})
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              {['today', '24h', '7d', '30d', 'custom'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    timeframe === tf 
                      ? 'bg-primary-600 text-white shadow-md' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tf === 'custom' ? t('analytics.custom', 'Custom') : tf}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            {timeframe === 'custom' && (
              <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs border-slate-200 dark:border-slate-800 rounded-lg p-1 dark:bg-slate-900 bg-white"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs border-slate-200 dark:border-slate-800 rounded-lg p-1 dark:bg-slate-900 bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* CROP DISEASE AI ANALYTICS VIEW */}
      {analyticsDomain === 'crop' ? (
        <div className="space-y-6">
          {/* Hero Banner: Farm Health Index Score */}
          <div className="p-6 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 dark:from-emerald-950/30 dark:via-slate-900/60 dark:to-teal-950/20 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-emerald-600/30 shrink-0">
                  🌿
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Farm Crop Health Index: {cropStats.healthScore}%
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide ${
                      cropStats.healthScore >= 80 ? 'bg-emerald-500 text-white' : cropStats.healthScore >= 60 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                    }`}>
                      {cropStats.healthScore >= 80 ? 'Optimal Vitality' : cropStats.healthScore >= 60 ? 'Moderate Threat' : 'Critical Outbreak'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                    Calculated from {cropStats.total} botanical scans analyzed by MobileNetV3 + Knowledge Distillation Engine.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.href = '/reports'}
                  leftIcon={<FileText size={14} className="text-emerald-500" />}
                  className="text-xs font-bold border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                >
                  Generate Audit PDF
                </Button>
              </div>
            </div>

            {/* 4 Stat Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Activity size={12} className="text-sky-500" /> Total Scans
                </span>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{cropStats.total}</p>
                <p className="text-[11px] text-slate-500 dark:text-white/50">Cumulative leaf diagnoses</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={12} className="text-emerald-500" /> Healthy Leaves
                </span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{cropStats.healthy}</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-bold">{cropStats.healthScore}% healthy rate</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-rose-500" /> Pathogens Detected
                </span>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{cropStats.diseased}</p>
                <p className="text-[11px] text-slate-500 dark:text-white/50">Required foliar treatment</p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles size={12} className="text-indigo-500" /> Model Confidence
                </span>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{cropStats.avgConfidence}%</p>
                <p className="text-[11px] text-slate-500 dark:text-white/50">Mean diagnostic certainty</p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Disease Distribution Donut */}
            <Card className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>🔬</span> Crop Disease Distribution
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                    Pathogen breakdown across all verified scan records
                  </p>
                </div>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cropStats.distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {cropStats.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(val, name) => [`${val} scans (${cropStats.total > 0 ? ((val / cropStats.total) * 100).toFixed(1) : 0}%)`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                {cropStats.distribution.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                    <span className="text-slate-400 ml-auto font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart 2: Daily Outbreak Activity */}
            <Card className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Daily Scan Activity &amp; Infection Spread
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                    Healthy vs Diseased trend over recent scans
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                {cropStats.weekly.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cropStats.weekly} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="healthy" name="Healthy" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="diseased" name="Diseased" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Scan more leaves to generate timeline trends
                  </div>
                )}
              </div>

              {/* Dominant Pathogen Alert */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold">Top Recurring Pathogen: </span>
                  <span className="font-semibold">{cropStats.topDisease} ({cropStats.topDiseaseCount} occurrences)</span>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                    Recommend early foliar fungicide/neem oil application and drip irrigation to avoid canopy wetting.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Crop Species Health Breakdown */}
          {cropStats.cropTypes.length > 0 && (
            <Card className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🌱</span> Crop Species Health Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cropStats.cropTypes.map((c, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>{c.crop}</span>
                      <span className={c.healthyPct >= 80 ? 'text-emerald-500' : 'text-amber-500'}>{c.healthyPct}% Healthy</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${c.healthyPct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                        style={{ width: `${c.healthyPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{c.total} total leaves evaluated</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* SENSOR TELEMETRY VIEW */
        <>
      {loading ? (
        <div className="flex h-[60vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : historyData.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-950">
          <HardDrive size={48} className="text-slate-300 dark:text-slate-700 animate-pulse" />
          <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-lg">No Telemetry Recorded</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            We couldn't find any telemetry records for {selectedDevice || 'your ESP32 device'} within the selected timeframe. Try choosing a different range.
          </p>
        </Card>
      ) : (
        /* Main Analytics Dashboard */
        <div className="space-y-6">
          
          {/* Farmer View vs Detailed Technical Graphs Toggle & Export Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setViewMode('farmer')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  viewMode === 'farmer'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <span>🌾 సాధారణ రైతు వ్యూ (Simple Farmer View)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  viewMode === 'detailed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <span>📊 డీప్ చార్ట్స్ వ్యూ (Detailed Graphs)</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="sky" size="sm" onClick={handleExportCSV} leftIcon={<Download size={14} />} className="font-bold text-xs py-1.5 px-3">
                {t('analytics.export_csv', 'Export CSV')}
              </Button>
              <Button variant="indigo" size="sm" onClick={handleExportPDF} leftIcon={<FileText size={14} />} className="font-bold text-xs py-1.5 px-3">
                {t('analytics.export_pdf', 'Export PDF')}
              </Button>
            </div>
          </div>

          {/* Farmer-Friendly Verdict Strip */}
          {summaryData && (
            <div className="p-4 sm:p-5 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/20 dark:via-slate-900/40 dark:to-emerald-950/10 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌿</span>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      పొలం ప్రస్తుత ఆరోగ్య తీర్పు (Field Health Verdict)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-white/45">
                      రైతుకు అర్థమయ్యే సులభమైన స్థితి • Real-time actionable agronomic status
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-black">
                  {summaryData.avg_soil >= 40 ? 'ఆప్టిమల్ (Optimal)' : 'శ్రద్ధ అవసరం (Attention)'}
                </span>
              </div>

              {/* 4 Big Color-Coded Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Crop Health */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center text-2xl shrink-0">
                    🌱
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">పంట పరిస్థితి (Crop)</span>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {summaryData.avg_soil >= 35 ? 'బాగుంది (Healthy)' : 'నీటి ఎద్దడి (Moisture Stress)'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40">ఆకుపచ్చగా ఎదుగుతోంది</p>
                  </div>
                </div>

                {/* 2. Soil Moisture Water */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                    (summaryData.avg_soil || 0) >= 45 
                      ? 'bg-blue-500/15 text-blue-600' 
                      : (summaryData.avg_soil || 0) >= 30 
                        ? 'bg-amber-500/15 text-amber-600' 
                        : 'bg-rose-500/15 text-rose-600'
                  }`}>
                    💧
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">నేల తేమ (Soil Water)</span>
                    <p className={`text-sm font-black ${
                      (summaryData.avg_soil || 0) >= 45 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : (summaryData.avg_soil || 0) >= 30 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {summaryData.avg_soil != null ? `${summaryData.avg_soil}% ` : ''}
                      {(summaryData.avg_soil || 0) >= 45 ? 'సరిపడా ఉంది' : (summaryData.avg_soil || 0) >= 30 ? 'తగ్గుతోంది' : 'తడి పెట్టండి!'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40">
                      {(summaryData.avg_soil || 0) >= 45 ? 'ఈరోజు నీరు అక్కర్లేదు' : '1-2 రోజుల్లో నీరు అవసరం'}
                    </p>
                  </div>
                </div>

                {/* 3. Temperature & Heat */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-2xl shrink-0">
                    ☀️
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">ఉష్ణోగ్రత & ఎండ (Heat)</span>
                    <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                      {summaryData.avg_temp != null ? `${summaryData.avg_temp}°C ` : ''}అనుకూలం
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40">సాధారణ పగటి ఉష్ణోగ్రత</p>
                  </div>
                </div>

                {/* 4. Rain & Spray window */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center text-2xl shrink-0">
                    🌧️
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">వర్షం & పిచికారీ (Spray Window)</span>
                    <p className="text-sm font-black text-teal-600 dark:text-teal-400">
                      {summaryData.total_rain_events > 0 ? 'వర్షం ఉంది (Rain Detected)' : 'పిచికారీకి అనుకూలం (Safe)'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/40">
                      {summaryData.total_rain_events > 0 ? 'మందు పిచికారీ వాయిదా వేయండి' : 'మందు కొట్టడానికి మంచి సమయం'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Row 1: Summary Statistics Cards */}
          {summaryData && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Card 1: Avg Temp */}
              <Card className="p-4 bg-white dark:bg-slate-950 flex items-start justify-between card-accent-amber shadow-xs border-slate-200/90 dark:border-slate-800">
                <div>
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block uppercase tracking-wider">{t('analytics.stat_avg_temp', 'Average Temp')}</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block mt-1">
                    {summaryData?.avg_temp != null ? `${summaryData.avg_temp}°C` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-2 block">
                    {t('analytics.stat_high', 'High')}: {summaryData?.max_temp != null ? `${summaryData.max_temp}°C` : 'N/A'} | {t('analytics.stat_low', 'Low')}: {summaryData?.min_temp != null ? `${summaryData.min_temp}°C` : 'N/A'}
                  </span>
                </div>
                <div className="bg-amber-100 dark:bg-amber-950/60 p-2 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Thermometer size={18} />
                </div>
              </Card>

              {/* Card 2: Avg Humidity */}
              <Card className="p-4 bg-white dark:bg-slate-950 flex items-start justify-between card-accent-sky shadow-xs border-slate-200/90 dark:border-slate-800">
                <div>
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block uppercase tracking-wider">{t('analytics.stat_avg_humidity', 'Avg Humidity')}</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100 block mt-1">
                    {summaryData?.avg_humidity != null ? `${summaryData.avg_humidity}%` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-2 block">{t('analytics.stat_relative', 'Relative Atmospheric')}</span>
                </div>
                <div className="bg-sky-100 dark:bg-sky-950/60 p-2 rounded-xl text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                  <Droplets size={18} />
                </div>
              </Card>

              {/* Card 3: Avg Soil Moisture */}
              <Card className="p-4 bg-white dark:bg-slate-950 flex items-start justify-between card-accent-emerald shadow-xs border-slate-200/90 dark:border-slate-800">
                <div>
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block uppercase tracking-wider">{t('analytics.stat_avg_soil', 'Avg Soil Moisture')}</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block mt-1">
                    {summaryData?.avg_soil != null ? `${summaryData.avg_soil}%` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-2 block">{t('analytics.stat_root_zone', 'Root zone condition')}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl text-emerald-500">
                  <Droplets size={18} />
                </div>
              </Card>

              {/* Card 4: Rain events */}
              <Card className="p-4 bg-white dark:bg-slate-950 flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block">{t('analytics.stat_rain_events', 'Rain Events')}</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block mt-1">
                    {summaryData?.total_rain_events || 0}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-2 block">{t('analytics.stat_precipitation', 'Precipitation readings')}</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded-xl text-blue-500">
                  <CloudRain size={18} />
                </div>
              </Card>

              {/* Card 5: Battery Health */}
              <Card className="p-4 bg-white dark:bg-slate-950 flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block">{t('analytics.stat_battery', 'Battery Status')}</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block mt-1">
                    {summaryData?.battery_status || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-2 block">
                    {t('analytics.stat_latest', 'Latest')}: {summaryData?.latest_battery != null ? `${summaryData.latest_battery}%` : t('analytics.stat_ext_power', 'Ext Power')}
                  </span>
                </div>
                <div className={`p-2 rounded-xl ${
                  summaryData?.battery_status === 'Good' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500' 
                    : summaryData?.battery_status === 'Fair' 
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-500' 
                      : 'bg-red-50 dark:bg-red-950/40 text-red-500'
                }`}>
                  <Battery size={18} />
                </div>
              </Card>
            </div>
          )}

          {/* Row 2: Visual Charts Grid (Visible in Detailed Mode or via button) */}
          {viewMode === 'detailed' ? (
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Chart 1: Temperature */}
              <Card className="p-6 bg-white dark:bg-slate-950">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                  <Thermometer size={16} className="text-orange-500" /> Temperature History
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.temp} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={colors.temp} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatDateTick} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="°C" />
                      <RechartsTooltip content={<CustomTooltip unit="°C" />} />
                      <Area type="monotone" dataKey="temperature" name="Temp" stroke={colors.temp} strokeWidth={2.5} fillOpacity={1} fill="url(#colorTempGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 2: Humidity */}
              <Card className="p-6 bg-white dark:bg-slate-950">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                  <Droplets size={16} className="text-sky-500" /> Humidity Trends
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorHumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.humidity} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={colors.humidity} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatDateTick} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                      <RechartsTooltip content={<CustomTooltip unit="%" />} />
                      <Area type="monotone" dataKey="humidity" name="Humidity" stroke={colors.humidity} strokeWidth={2.5} fillOpacity={1} fill="url(#colorHumGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 3: Soil Moisture */}
              <Card className="p-6 bg-white dark:bg-slate-950">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                  <Droplets size={16} className="text-emerald-500" /> Soil Moisture History
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSoilGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.soil} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={colors.soil} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatDateTick} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                      <RechartsTooltip content={<CustomTooltip unit="%" />} />
                      <Area type="monotone" dataKey="soil_moisture" name="Soil Moisture" stroke={colors.soil} strokeWidth={2.5} fillOpacity={1} fill="url(#colorSoilGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 4: Light Intensity */}
              <Card className="p-6 bg-white dark:bg-slate-950">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                  <Sun size={16} className="text-amber-500" /> Sunlight (Lux Intensity)
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.light} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={colors.light} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatDateTick} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} unit=" lx" />
                      <RechartsTooltip content={<CustomTooltip unit=" lx" />} />
                      <Area type="monotone" dataKey="light_intensity" name="Sunlight" stroke={colors.light} strokeWidth={2.5} fillOpacity={1} fill="url(#colorLightGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 5: Rain History */}
              <Card className="p-6 bg-white dark:bg-slate-950">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                  <CloudRain size={16} className="text-blue-500" /> Precipitation Logs
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatDateTick} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <RechartsTooltip content={<CustomTooltip unit="" />} />
                      <Bar dataKey="rain_sensor" name="Rain Detected" fill={colors.rain} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Chart 6: Battery Level */}
              <Card className="p-6 bg-white dark:bg-slate-950">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                  <Battery size={16} className="text-emerald-500" /> Battery Discharge Curve
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatDateTick} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                      <RechartsTooltip content={<CustomTooltip unit="%" />} />
                      <Line type="monotone" dataKey="battery_percentage" name="Battery" stroke={colors.battery} strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          ) : (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
                  📈
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                    టెక్నికల్ చార్ట్‌లు దాచబడ్డాయి (Technical Graphs Hidden for Simplicity)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    సాధారణ రైతు మోడ్‌లో చార్ట్‌లు క్లీన్‌గా ఉంచబడ్డాయి. పూర్తి సైంటిఫిక్ గ్రాఫ్‌లు చూడటానికి ఇక్కడ నొక్కండి.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('detailed')}
                className="font-bold text-xs shrink-0 cursor-pointer"
              >
                📊 షో టెక్నికల్ గ్రాఫ్‌లు (Show Graphs)
              </Button>
            </div>
          )}

            {/* SECTION: SMART NOTIFICATION PLATFORM HEALTH & ANALYTICS */}
            {notifAnalytics && (
              <div className="col-span-1 md:col-span-2 mt-8 pt-8 border-t border-slate-100">
                <h2 className="font-display font-extrabold text-xl text-slate-900 mb-6 flex items-center gap-2">
                  <AlertTriangle className="text-primary-600" size={22} /> Smart Notifications & Platform Health
                </h2>
                
                {/* Notification KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card className="p-4 flex flex-col justify-between" hover={false}>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Platform Effectiveness</span>
                    <span className={`inline-flex items-center justify-center font-extrabold text-sm px-2.5 py-1 rounded-full border mt-2 w-max capitalize ${
                      notifAnalytics?.platform_effectiveness_score === 'Excellent' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                      notifAnalytics?.platform_effectiveness_score === 'Good' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                      notifAnalytics?.platform_effectiveness_score === 'Fair' ? 'text-orange-700 bg-orange-50 border-orange-200' :
                      'text-red-700 bg-red-50 border-red-200'
                    }`}>
                      {notifAnalytics?.platform_effectiveness_score || 'Good'}
                    </span>
                  </Card>
                  
                  <Card className="p-4 flex flex-col justify-between" hover={false}>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Avg Reaction Time</span>
                    <span className="font-display font-extrabold text-2xl text-slate-900 mt-2">
                      {typeof notifAnalytics?.average_reaction_time_min === 'number' ? `${notifAnalytics.average_reaction_time_min.toFixed(1)}m` : 'N/A'}
                    </span>
                  </Card>
                  
                  <Card className="p-4 flex flex-col justify-between" hover={false}>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Ignored Alert Rate</span>
                    <span className="font-display font-extrabold text-2xl text-slate-900 mt-2">
                      {typeof notifAnalytics?.ignored_alerts_percentage === 'number' ? `${notifAnalytics.ignored_alerts_percentage.toFixed(1)}%` : '0.0%'}
                    </span>
                  </Card>
                  
                  <Card className="p-4 flex flex-col justify-between" hover={false}>
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Warnings</span>
                    <span className="font-display font-extrabold text-2xl text-slate-900 mt-2">
                      {notifAnalytics?.active_alerts || 0} <span className="text-xs text-slate-400 font-semibold">/ {notifAnalytics?.total_alerts || 0} total</span>
                    </span>
                  </Card>
                </div>
                
                {/* Notification Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Chart */}
                  <Card className="p-6 bg-white dark:bg-slate-950">
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4">Alerts by Category</h3>
                    <div className="h-64 w-full">
                      {Object.entries(notifAnalytics.alerts_by_category || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(notifAnalytics.alerts_by_category || {}).map(([cat, val]) => ({
                            name: cat.charAt(0).toUpperCase() + cat.slice(1),
                            Count: val
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <RechartsTooltip />
                            <Bar dataKey="Count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-400">No alert category data recorded yet.</div>
                      )}
                    </div>
                  </Card>
                  
                  {/* Priority Chart */}
                  <Card className="p-6 bg-white dark:bg-slate-950">
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 text-sm mb-4">Alerts by Severity</h3>
                    <div className="h-64 w-full">
                      {Object.entries(notifAnalytics.alerts_by_priority || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(notifAnalytics.alerts_by_priority || {}).map(([prio, val]) => ({
                            name: prio,
                            Count: val
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <RechartsTooltip />
                            <Bar dataKey="Count" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-400">No alert priority data recorded yet.</div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            )}

          </div>
        )}
        </>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
};

export default AnalyticsPage;
