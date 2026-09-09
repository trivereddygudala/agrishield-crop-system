import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Cpu, Wifi, Battery, HardDrive, Clock, Activity,
  RefreshCw, AlertTriangle, CheckCircle2, Radio, Server, Compass, Signal, ChevronRight
} from 'lucide-react';
import { Card, Button, Badge, Progress } from '../components/ui/index';
import { useWebSocket } from '../context/WebSocketContext';
import { useTranslation } from 'react-i18next';

const DevicesPage = () => {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const [deviceData, setDeviceData] = useState({
    name: "ESP32-NODE-ALPHA",
    status: "offline",
    firmware: "v2.0-main",
    battery: 0,
    batteryCharging: false,
    wifiStrength: -100,
    sensorHealth: "OFFLINE",
    sensorHealthSub: "Device disconnected",
    lastSync: "Never",
    sdCard: { status: "unmounted", usage: 0, total: 32 },
    uptime: "Offline",
    memory: { used: 0, total: 320 },
    cpu: 0,
    temperature: null,
    humidity: null,
    pressure: null,
    soilMoisture: null,
    rainDetected: false
  });

  const { connectionStatus, lastTelemetry, deviceStatusMap } = useWebSocket();

  const processDeviceTelemetry = (dev, telem) => {
    const isOnline = dev && dev.status === "online";
    let lastSyncText = isTe ? "ఎప్పుడూ లేదు" : "Never";
    if (dev && dev.seconds_since_seen !== undefined && dev.seconds_since_seen < 99999) {
      if (dev.seconds_since_seen < 10) lastSyncText = isTe ? "ఇప్పుడే" : "Just now";
      else if (dev.seconds_since_seen < 60) lastSyncText = isTe ? `${dev.seconds_since_seen} సెకన్ల క్రితం` : `${dev.seconds_since_seen}s ago`;
      else lastSyncText = isTe ? `${Math.floor(dev.seconds_since_seen / 60)} నిమిషాల క్రితం` : `${Math.floor(dev.seconds_since_seen / 60)}m ago`;
    } else if (isOnline) {
      lastSyncText = isTe ? "ఇప్పుడే" : "Just now";
    }

    const sdMounted = Boolean(telem.sd_card_status === "mounted");

    let validSensors = 0;
    if (telem.temperature != null || telem.humidity != null) validSensors++;
    if (telem.soil_moisture != null) validSensors++;
    if (telem.light_lux != null) validSensors++;
    if (telem.battery_percentage != null) validSensors++;
    if (telem.pressure != null) validSensors++;
    if (telem.rain_detected != null) validSensors++;
    if (sdMounted) validSensors++;

    let healthStatus = isOnline ? (validSensors >= 6 ? (isTe ? "అన్నీ సక్రమం (7/7)" : "OPTIMAL (7/7)") : `${validSensors}/7 ACTIVE`) : (isTe ? "ఆఫ్‌లైన్" : "OFFLINE");
    let healthSub = isOnline ? (isTe ? "పొలంలోని అన్ని సెన్సార్లు పనిచేస్తున్నాయి" : "All sensors nominal") : (isTe ? "సెన్సార్ డిస్‌కనెక్ట్ అయింది" : "Device disconnected");

    const rawBattery = isOnline ? (telem.battery_percentage ?? telem.battery ?? dev.battery ?? 0) : 0;
    const roundedBattery = Math.round(Number(rawBattery) || 0);
    const formattedVoltage = isOnline && telem.battery_voltage ? telem.battery_voltage.toFixed(2) : "0.00";

    setDeviceData({
      name: dev.device_name || dev.device_id || "ESP32-NODE-ALPHA",
      status: dev.status || "offline",
      firmware: dev.firmware_version || "v2.5.0-main",
      battery: roundedBattery,
      batteryVoltage: formattedVoltage,
      batteryCharging: isOnline ? Boolean(telem.charging) : false,
      batteryLow: isOnline ? Boolean(telem.battery_low) : false,
      wifiStrength: isOnline && telem.wifi_rssi !== undefined ? telem.wifi_rssi : (isOnline ? (telem.rssi ?? -65) : -100),
      sensorHealth: healthStatus,
      sensorHealthSub: healthSub,
      lastSync: lastSyncText,
      sdCard: {
        status: isOnline && sdMounted ? "mounted" : "unmounted",
        usageMb: isOnline ? (telem.sd_used_mb || 0) : 0,
        freeMb: isOnline ? (telem.sd_free_mb || (sdMounted ? 14850 : 0)) : 0,
        totalMb: isOnline ? (telem.sd_total_mb || (sdMounted ? 16384 : 0)) : 0,
        pendingRecords: isOnline ? (telem.sd_pending_records || 0) : 0,
        logFile: isOnline ? (telem.current_log_file || "/logs/2026/07") : "N/A"
      },
      uptime: isOnline ? (telem.uptime_formatted || (telem.uptime_seconds ? `${Math.floor(telem.uptime_seconds / 3600)}h` : (isTe ? "ఆన్లైన్" : "Online"))) : (isTe ? "ఆఫ్‌లైన్" : "Offline"),
      memory: {
        used: isOnline && telem.free_heap_kb ? (320 - telem.free_heap_kb) : 0,
        total: 320
      },
      cpu: isOnline ? (telem.cpu_load || 12) : 0,
      temperature: isOnline && telem.temperature != null ? Number(telem.temperature).toFixed(1) : null,
      humidity: isOnline && telem.humidity != null ? Number(telem.humidity).toFixed(1) : null,
      pressure: isOnline && telem.pressure != null ? Number(telem.pressure).toFixed(0) : null,
      soilMoisture: isOnline && telem.soil_moisture != null ? Number(telem.soil_moisture).toFixed(1) : (isOnline && telem.soil_percentage != null ? Number(telem.soil_percentage).toFixed(1) : null),
      lightLux: isOnline && (telem.light_lux != null || telem.light_intensity != null)
        ? Number(telem.light_lux ?? telem.light_intensity).toFixed(0)
        : null,
      rainDetected: isOnline ? Boolean(telem.rain_detected || telem.rain_sensor) : false,
      bluetoothConnected: isOnline ? Boolean(telem.bluetooth_connected || telem.ble_connected) : false
    });
  };

  const fetchDeviceStatus = async () => {
    try {
      const res = await fetch('/api/v1/devices/status');
      if (res.ok) {
        const devices = await res.json();
        if (Array.isArray(devices) && devices.length > 0) {
          const sorted = [...devices].sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (b.status === 'online' && a.status !== 'online') return 1;
            return (a.seconds_since_seen ?? 999999) - (b.seconds_since_seen ?? 999999);
          });
          const dev = sorted[0];
          let telem = (dev && dev.latest_telemetry) ? dev.latest_telemetry : {};
          
          if (dev && dev.ip && dev.status === 'online') {
            try {
              const proxyRes = await fetch('/api/v1/devices/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ip: dev.ip,
                  endpoint: '/status',
                  method: 'GET'
                })
              });
              if (proxyRes.ok) {
                const statusData = await proxyRes.json();
                if (statusData && statusData.sd) {
                  telem = {
                    ...telem,
                    temperature: statusData.t !== undefined ? statusData.t : telem.temperature,
                    humidity: statusData.h !== undefined ? statusData.h : telem.humidity,
                    light_lux: statusData.l !== undefined ? statusData.l : telem.light_lux,
                    pressure: statusData.pr !== undefined ? statusData.pr : telem.pressure,
                    soil_moisture: statusData.sm !== undefined ? statusData.sm : telem.soil_moisture,
                    rain_detected: statusData.rn !== undefined ? (statusData.rn === true || statusData.rn === "true") : telem.rain_detected,
                    battery_percentage: statusData.bp !== undefined ? statusData.bp : telem.battery_percentage,
                    battery_voltage: statusData.bv !== undefined ? statusData.bv : telem.battery_voltage,
                    sd_card_status: statusData.sd !== undefined ? statusData.sd.toLowerCase() : telem.sd_card_status,
                    sd_total_mb: statusData.sz !== undefined ? statusData.sz : telem.sd_total_mb,
                    sd_used_mb: statusData.su !== undefined ? statusData.su : telem.sd_used_mb
                  };
                }
              }
            } catch (proxyErr) {
              console.warn("Failed to fetch live status via proxy, using telemetry cache:", proxyErr);
            }
          }
          processDeviceTelemetry(dev, telem);
        }
      }
    } catch (err) {
      console.warn("Device status fetch error:", err);
    }
  };

  useEffect(() => {
    if (lastTelemetry || Object.keys(deviceStatusMap).length > 0) {
      const devIds = Object.keys(deviceStatusMap);
      if (devIds.length > 0) {
        const dev = deviceStatusMap[devIds[0]];
        const telem = lastTelemetry && lastTelemetry.device_id === devIds[0] ? (lastTelemetry.telemetry || {}) : (dev.latest_telemetry || {});
        processDeviceTelemetry(dev, telem);
      } else if (lastTelemetry) {
        const telem = lastTelemetry.telemetry || lastTelemetry;
        processDeviceTelemetry({ status: "online", device_id: lastTelemetry.device_id }, telem);
      }
    }
  }, [lastTelemetry, deviceStatusMap]);

  useEffect(() => {
    fetchDeviceStatus();
    if (connectionStatus !== 'connected') {
      const interval = setInterval(fetchDeviceStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [connectionStatus]);

  const isOnline = deviceData.status === "online";

  const getSignalStrength = (rssi) => {
    if (rssi > -60) return { label: isTe ? 'చాలా బాగుంది (బలమైన సిగ్నల్)' : 'Excellent (Strong)', color: 'text-emerald-500', bar: '100%' };
    if (rssi > -75) return { label: isTe ? 'బాగుంది (నార్మల్ సిగ్నల్)' : 'Good Signal', color: 'text-emerald-400', bar: '75%' };
    if (rssi > -85) return { label: isTe ? 'మధ్యస్థం (కొద్దిగా బలహీనం)' : 'Fair Signal', color: 'text-amber-500', bar: '50%' };
    return { label: isTe ? 'సిగ్నల్ బలహీనంగా ఉంది' : 'Weak Signal', color: 'text-rose-500', bar: '25%' };
  };

  const signal = getSignalStrength(deviceData.wifiStrength);

  const getBatteryEstimate = (pct) => {
    const b = Number(pct) || 0;
    if (b >= 75) return isTe ? "సుమారు 14+ రోజులు వస్తుంది" : "~14+ days runtime";
    if (b >= 45) return isTe ? "సుమారు 7-10 రోజులు వస్తుంది" : "~7-10 days runtime";
    if (b >= 25) return isTe ? "సుమారు 3-4 రోజులు వస్తుంది" : "~3-4 days runtime";
    return isTe ? "వెంటనే రీచార్జ్ చేయండి" : "Recharge soon";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto w-full pb-16"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {isTe ? "🌾 పొలం ఐవోటీ సెన్సార్లు & పరికరాలు" : t('devices_page.title', 'IoT Hardware & 7-Sensor Telemetry')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mt-1">
            {isTe 
              ? "మీ పొలంలో అమర్చిన సెన్సార్ పరికరం నుండి నేల తేమ, ఉష్ణోగ్రత, బ్యాటరీ లైవ్ వివరాలు."
              : t('devices_page.subtitle', 'Real-time status monitoring for ESP32 Field Transceiver Nodes & crop sensors.')}
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchDeviceStatus} 
          leftIcon={<RefreshCw className="w-4 h-4" />} 
          className="w-full sm:w-auto border border-slate-200 dark:border-white/10 font-bold"
        >
          {isTe ? "తాజా సమాచారం చూడండి" : t('devices_page.poll_btn', 'Poll Hardware')}
        </Button>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Link to="/node-control" className="block">
          <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-amber-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isTe ? "సెన్సార్ సెట్టింగ్స్" : t('devices_page.node_control', 'Node Control')}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/40">
                  {isTe ? "హెచ్చరికల పరిమితులు" : t('devices_page.node_control_sub', 'Node threshold configs')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
          </Card>
        </Link>

        <Link to="/history" className="block">
          <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-emerald-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isTe ? "స్కాన్ల చరిత్ర" : t('devices_page.scan_history', 'Scan History')}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/40">
                  {isTe ? "గత రికార్డులు & నివేదికలు" : t('devices_page.scan_history_sub', 'Aggregated historical logs')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
          </Card>
        </Link>

        <Link to="/analytics" className="col-span-2 lg:col-span-1 block">
          <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-blue-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌾</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {isTe ? "పొలం అనలిటిక్స్" : t('devices_page.analytics', 'Crop Analytics')}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/40">
                  {isTe ? "నేల & వాతావరణ గ్రాఫ్‌లు" : t('devices_page.analytics_sub', 'Live telemetry stream charts')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
          </Card>
        </Link>
      </div>

      {/* Main Device Status Card */}
      <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md space-y-6">
        
        {/* Device Header with Farmer-Friendly Online Indicator */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className={`p-3.5 rounded-2xl ${isOnline ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"} shrink-0`}>
              <Cpu className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
                  {isOnline 
                    ? (isTe ? "🟢 పొలంలో సెన్సార్ పరికరం పనిచేస్తుంది" : "🟢 Field Sensor Node Active")
                    : (isTe ? "🔴 సెన్సార్ ఆఫ్‌లైన్ / ఆగిపోయింది" : "🔴 Field Sensor Offline")}
                </h2>
                <Badge variant={isOnline ? "healthy" : "diseased"} className="text-[10px] uppercase font-black tracking-wide">
                  {isOnline ? (isTe ? "లైవ్ ఆన్లైన్" : "ONLINE") : (isTe ? "ఆఫ్‌లైన్" : "OFFLINE")}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                {isOnline 
                  ? (isTe ? `పరికర ఐడీ: ${deviceData.name} • చివరి సింక్: ${deviceData.lastSync}` : `Node ID: ${deviceData.name} • Last sync: ${deviceData.lastSync}`)
                  : (isTe ? "పరికరానికి బ్యాటరీ లేదా సిగ్నల్ చెక్ చేయండి • చివరి సింక్: " + deviceData.lastSync : `Awaiting sensor ping • Last sync: ${deviceData.lastSync}`)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-600 dark:text-white/60 bg-slate-100/60 dark:bg-white/[0.04] px-3.5 py-2 rounded-xl">
            <span className="flex items-center gap-1.5">
              <Signal className={`w-4 h-4 ${signal.color}`} /> 
              <span>{signal.label}</span>
            </span>
            <span className="text-slate-300 dark:text-white/20">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> 
              <span>{isTe ? `నడుస్తున్న సమయం: ${deviceData.uptime}` : `Uptime: ${deviceData.uptime}`}</span>
            </span>
          </div>
        </div>

        {/* 4 Farmer-Friendly High-Level Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* 1. Battery Runtime Card */}
          <div className="bg-slate-50/70 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-2 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-white/50">
              <span>{isTe ? "🔋 బ్యాటరీ ఛార్జ్" : "Battery Runtime"}</span>
              <Battery className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 mb-1">{deviceData.battery}%</p>
              <Progress value={deviceData.battery} className="h-2 mb-2" />
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {getBatteryEstimate(deviceData.battery)}
              </p>
            </div>
          </div>

          {/* 2. SD Card / Data Storage Card */}
          <Link 
            to="/sdcard" 
            className="bg-slate-50/70 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-2 block transition-all hover:border-amber-500/40 hover:shadow-md group cursor-pointer flex flex-col justify-between"
            title="Open MicroSD Storage Manager"
          >
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-white/50">
              <span className="group-hover:text-amber-500 transition-colors">
                {isTe ? "💾 డేటా మెమరీ కార్డ్" : "MicroSD Storage"}
              </span>
              <HardDrive className="w-4 h-4 text-sky-500 group-hover:text-amber-500 transition-colors" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 mb-1">
                {deviceData.sdCard.status === "mounted"
                  ? (isTe ? "భద్రంగా రికార్డ్ అవుతోంది" : "Recording Safe")
                  : (isTe ? "కార్డ్ లేదు" : "Not Mounted")}
              </p>
              <Progress value={deviceData.sdCard.status === "mounted" && deviceData.sdCard.totalMb > 0
                ? Math.round((deviceData.sdCard.usageMb / deviceData.sdCard.totalMb) * 100)
                : 0} className="h-2 mb-2" />
              <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                {deviceData.sdCard.status === "mounted"
                  ? `${(deviceData.sdCard.totalMb - deviceData.sdCard.usageMb).toLocaleString()} MB ఖాళీగా ఉంది`
                  : (isTe ? "మెమరీ కార్డ్ తనిఖీ చేయండి" : "Check SD card slot")}
              </p>
            </div>
          </Link>

          {/* 3. Signal & Connection Range */}
          <div className="bg-slate-50/70 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-2 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-white/50">
              <span>{isTe ? "📶 సిగ్నల్ నాణ్యత" : "WiFi / Field Signal"}</span>
              <Wifi className="w-4 h-4 text-sky-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 mb-1">
                {isOnline ? (isTe ? "సిగ్నల్ బాగుంది" : "Connected") : (isTe ? "కనెక్షన్ లేదు" : "Disconnected")}
              </p>
              <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className={`h-full ${signal.color.replace('text-', 'bg-')}`} 
                  style={{ width: isOnline ? signal.bar : '0%' }}
                />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-white/50">
                {isOnline ? `${deviceData.wifiStrength} dBm (${signal.label})` : (isTe ? "సిగ్నల్ రేంజ్ తనిఖీ చేయండి" : "Out of range")}
              </p>
            </div>
          </div>

          {/* 4. Active Sensor Count */}
          <div className="bg-slate-50/70 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-2 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-white/50">
              <span>{isTe ? "🌾 సెన్సార్ల పనితీరు" : "Active Field Sensors"}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 mb-1">
                {isOnline ? (isTe ? "7/7 సిద్ధంగా ఉన్నాయి" : "7/7 Active") : (isTe ? "0/7 ఆఫ్‌లైన్" : "0/7 Offline")}
              </p>
              <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: isOnline ? '100%' : '0%' }} />
              </div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {isOnline ? (isTe ? "మొక్కలకు పూర్తి రక్షణగా ఉన్నాయి" : "Continuous live crop monitoring") : (isTe ? "డేటా వేచి ఉంది" : "Awaiting sensor handshake")}
              </p>
            </div>
          </div>
        </div>

        {/* 7 Farm Sensors - Visual Farmer Card Grid */}
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                {isTe ? "🌱 7 పొలం సెన్సార్ల లైవ్ రీడింగ్స్ (Live Field Sensor Status)" : "🌱 Live Field Sensor Status"}
              </h3>
              <p className="text-[11px] text-white/50 mt-0.5">
                {isTe ? "మీ పంట వద్ద అమర్చిన అన్ని సెన్సార్ల ప్రస్తుత పరిస్థితి" : "Real-time readings from installed crop health sensors"}
              </p>
            </div>
            <span className="text-[11px] font-extrabold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              {isOnline ? (isTe ? "లైవ్ డేటా అందుతోంది" : "Live Streaming") : (isTe ? "ఆఫ్‌లైన్" : "Offline")}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* 1. Temp & Humidity */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">🌡️</span>
                <span className={`w-2 h-2 rounded-full ${deviceData.temperature != null ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "గాలి ఉష్ణోగ్రత" : "Air Temperature"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.temperature != null ? `${deviceData.temperature}°C` : "--"}
              </p>
              <p className="text-[10px] text-white/40">{isTe ? "వాతావరణ ఉష్ణోగ్రత" : "Ambient air temp"}</p>
            </div>

            {/* 2. Soil Moisture */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">💧</span>
                <span className={`w-2 h-2 rounded-full ${deviceData.soilMoisture != null ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "నేల తేమ" : "Soil Moisture"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.soilMoisture != null ? `${deviceData.soilMoisture}%` : "--"}
              </p>
              <p className="text-[10px] text-white/40">
                {Number(deviceData.soilMoisture) < 30 ? (isTe ? "నీరు అవసరం" : "Needs water") : (isTe ? "నేలలో తేమ బాగుంది" : "Adequate moisture")}
              </p>
            </div>

            {/* 3. Sunlight / Lux */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">☀️</span>
                <span className={`w-2 h-2 rounded-full ${deviceData.lightLux != null ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "ఎండ తీవ్రత" : "Sunlight (Lux)"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.lightLux != null ? `${deviceData.lightLux} Lx` : "--"}
              </p>
              <p className="text-[10px] text-white/40">{isTe ? "సూర్యరశ్మి తీవ్రత" : "Sunlight intensity"}</p>
            </div>

            {/* 4. Rain Sensor */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">🌧️</span>
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "వర్షం పరిస్థితి" : "Rain Detection"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.rainDetected ? (isTe ? "వర్షం పడుతోంది 🌧️" : "Raining 🌧️") : (isTe ? "వర్షం లేదు ☀️" : "Clear ☀️")}
              </p>
              <p className="text-[10px] text-white/40">
                {deviceData.rainDetected ? (isTe ? "పిచికారీ చేయవద్దు" : "Hold spraying") : (isTe ? "పొడిగా ఉంది" : "Safe to spray")}
              </p>
            </div>

            {/* 5. Air Humidity */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">💨</span>
                <span className={`w-2 h-2 rounded-full ${deviceData.humidity != null ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "గాలిలో తేమ" : "Air Humidity"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.humidity != null ? `${deviceData.humidity}%` : "--"}
              </p>
              <p className="text-[10px] text-white/40">{isTe ? "మంచు & గాలి తేమ" : "Relative humidity"}</p>
            </div>

            {/* 6. Atmospheric Pressure */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">🧭</span>
                <span className={`w-2 h-2 rounded-full ${deviceData.pressure != null ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "వాతావరణ పీడనం" : "Barometer (Pressure)"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.pressure != null ? `${deviceData.pressure} hPa` : "--"}
              </p>
              <p className="text-[10px] text-white/40">{isTe ? "గాలి పీడనం స్థిరంగా ఉంది" : "Barometric reading"}</p>
            </div>

            {/* 7. Battery Voltage */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">⚡</span>
                <span className={`w-2 h-2 rounded-full ${isOnline && deviceData.battery > 0 ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "బ్యాటరీ వోల్టేజ్" : "Battery Voltage"}</p>
              <p className="text-lg font-black text-emerald-400">
                {isOnline && deviceData.battery > 0 ? `${deviceData.batteryVoltage} V` : "--"}
              </p>
              <p className="text-[10px] text-white/40">{isTe ? "సోలార్ / లిథియం సెల్" : "Li-Ion power rail"}</p>
            </div>

            {/* 8. MicroSD Storage */}
            <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-base">💾</span>
                <span className={`w-2 h-2 rounded-full ${deviceData.sdCard.status === "mounted" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
              </div>
              <p className="text-xs font-bold text-white/90">{isTe ? "ఆఫ్‌లైన్ మెమరీ" : "MicroSD Storage"}</p>
              <p className="text-lg font-black text-emerald-400">
                {deviceData.sdCard.status === "mounted" ? (isTe ? "ఆక్టివ్" : "MOUNTED") : "OFFLINE"}
              </p>
              <p className="text-[10px] text-white/40">{isTe ? "డేటా భద్రపరుస్తోంది" : "Continuous log buffer"}</p>
            </div>
          </div>
        </div>

        {/* Collapsible Technical Engineering Details for Agronomists & Technicians */}
        <details className="mt-4 bg-slate-100 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs text-slate-700 dark:text-white/70">
          <summary className="cursor-pointer font-bold text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between select-none">
            <span className="flex items-center gap-2">
              <span>🛠️</span>
              <span>{isTe ? "ఇంజనీరింగ్ & హార్డ్‌వేర్ పిన్స్ వివరాలు (Hardware Diagnostics & Pinouts)" : "Hardware Diagnostics & Pinout Specifications"}</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-white/40">{isTe ? "క్లిక్ చేసి చూడండి ▼" : "Expand ▼"}</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono text-[11px]">
            <div>
              <span className="font-bold text-slate-500 dark:text-white/40 block">MCU Hardware:</span>
              <span>ESP32 DevKit V1 (320KB RAM)</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 dark:text-white/40 block">Firmware Version:</span>
              <span>{deviceData.firmware}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 dark:text-white/40 block">WiFi RSSI & Heap:</span>
              <span>{deviceData.wifiStrength} dBm • CPU: {deviceData.cpu}%</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 dark:text-white/40 block">I2C Bus (SDA 21 / SCL 22):</span>
              <span>AHT20 (0x38), BH1750 (0x23), BMP280 (0x76)</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 dark:text-white/40 block">Analog ADC Pins:</span>
              <span>Soil Moisture: GPIO 34 • Battery: GPIO 32</span>
            </div>
            <div>
              <span className="font-bold text-slate-500 dark:text-white/40 block">SPI & Digital Pins:</span>
              <span>MicroSD: GPIO 5 CS (SPI) • Rain: GPIO 35/33</span>
            </div>
          </div>
        </details>
      </Card>
    </motion.div>
  );
};

export default DevicesPage;


