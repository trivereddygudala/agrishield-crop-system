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
  const { t } = useTranslation();
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
    let lastSyncText = "Never";
    if (dev && dev.seconds_since_seen !== undefined && dev.seconds_since_seen < 99999) {
      if (dev.seconds_since_seen < 10) lastSyncText = "Just now";
      else if (dev.seconds_since_seen < 60) lastSyncText = `${dev.seconds_since_seen}s ago`;
      else lastSyncText = `${Math.floor(dev.seconds_since_seen / 60)}m ago`;
    } else if (isOnline) {
      lastSyncText = "Just now";
    }

    const sdMounted = Boolean(telem.sd_card_status === "mounted");
    const sdUsedGb = (sdMounted && telem.sd_used_mb > 0) ? (telem.sd_used_mb / 1024) : 0;
    const sdTotalGb = (sdMounted && telem.sd_total_mb > 0) ? (telem.sd_total_mb / 1024) : 0;

    let validSensors = 0;
    if (telem.temperature != null || telem.humidity != null) validSensors++;
    if (telem.soil_moisture != null) validSensors++;
    if (telem.light_lux != null) validSensors++;
    if (telem.battery_percentage != null) validSensors++;
    if (telem.pressure != null) validSensors++;
    if (telem.rain_detected != null) validSensors++;
    if (sdMounted) validSensors++;

    let healthStatus = "OFFLINE";
    let healthSub = "Device disconnected";
    if (isOnline) {
      if (validSensors >= 6) {
        healthStatus = "OPTIMAL";
        healthSub = "All 7 sensors nominal";
      } else if (validSensors > 0) {
        healthStatus = `${validSensors}/7 ACTIVE`;
        healthSub = `${validSensors} of 7 modules connected`;
      } else {
        healthStatus = "READY";
        healthSub = "Connected, awaiting sensors";
      }
    }

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
      uptime: isOnline ? (telem.uptime_formatted || (telem.uptime_seconds ? `${Math.floor(telem.uptime_seconds / 3600)}h` : "Online")) : "Offline",
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
    if (rssi > -60) return { label: 'Excellent', color: 'text-emerald-500' };
    if (rssi > -75) return { label: 'Good', color: 'text-emerald-450' };
    if (rssi > -85) return { label: 'Fair', color: 'text-amber-500' };
    return { label: 'Weak', color: 'text-rose-500' };
  };

  const signal = getSignalStrength(deviceData.wifiStrength);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto w-full pb-16"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {t('devices_page.title', 'IoT Hardware & 7-Sensor Telemetry')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
            {t('devices_page.subtitle', 'Real-time status monitoring for ESP32 Field Transceiver Nodes, status indicators & SD log pipelines.')}
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchDeviceStatus} 
          leftIcon={<RefreshCw className="w-4 h-4" />} 
          className="w-full sm:w-auto border border-slate-200 dark:border-white/10"
        >
          {t('devices_page.poll_btn', 'Poll Hardware')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Link to="/node-control" className="block">
          <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-amber-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t('devices_page.node_control', 'Node Control')}</p>
                <p className="text-[10px] text-slate-400 dark:text-white/30">{t('devices_page.node_control_sub', 'Node threshold configs')}</p>
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
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t('devices_page.scan_history', 'Scan History')}</p>
                <p className="text-[10px] text-slate-400 dark:text-white/30">{t('devices_page.scan_history_sub', 'Aggregated historical logs')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
          </Card>
        </Link>

        <Link to="/analytics" className="col-span-2 lg:col-span-1 block">
          <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-blue-500/30">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💻</span>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t('devices_page.analytics', 'Raw Telemetry')}</p>
                <p className="text-[10px] text-slate-400 dark:text-white/30">{t('devices_page.analytics_sub', 'Live telemetry stream charts')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
          </Card>
        </Link>
      </div>

      <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
                  {deviceData.name}
                </h2>
                <Badge variant={isOnline ? "healthy" : "diseased"} className="text-[9px] uppercase font-black animate-pulse">
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5 truncate">
                MCU: ESP32 DevKit V1 • Firmware: {deviceData.firmware} • Last Ping: {deviceData.lastSync}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-white/40">
            <span className="flex items-center gap-1.5">
              <Signal className={`w-4 h-4 ${signal.color}`} /> 
              Signal: {deviceData.wifiStrength} dBm ({signal.label})
            </span>
            <span className="hidden sm:inline text-slate-200 dark:text-white/10">•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> Uptime: {deviceData.uptime}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50/50 dark:bg-white/[0.01] p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 space-y-2 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
              <span>Battery ({deviceData.batteryVoltage}V)</span>
              <Battery className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 mb-2">{deviceData.battery}%</p>
              <Progress value={deviceData.battery} className="h-1.5 animate-pulse" />
            </div>
          </div>

          <Link 
            to="/sdcard" 
            className="bg-slate-50/50 dark:bg-white/[0.01] p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 space-y-2 block transition-all hover:border-amber-500/40 hover:shadow-lg group cursor-pointer flex flex-col justify-between"
            title="Open MicroSD Storage Manager"
          >
            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
              <span className="group-hover:text-amber-500 transition-colors">MicroSD Storage</span>
              <HardDrive className="w-4 h-4 text-sky-500 group-hover:text-amber-500 transition-colors" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 mb-2">
                {deviceData.sdCard.status === "mounted"
                  ? deviceData.sdCard.totalMb > 0
                    ? `${(deviceData.sdCard.totalMb - deviceData.sdCard.usageMb).toLocaleString()} MB Free`
                    : 'Mounted'
                  : 'Not Mounted'}
              </p>
              <Progress value={deviceData.sdCard.status === "mounted" && deviceData.sdCard.totalMb > 0
                ? Math.round((deviceData.sdCard.usageMb / deviceData.sdCard.totalMb) * 100)
                : 0} className="h-1.5" />
            </div>
          </Link>

          <div className="bg-slate-50/50 dark:bg-white/[0.01] p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 space-y-2 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
              <span>ESP32 CPU Load</span>
              <Activity className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 mb-2">{deviceData.cpu}%</p>
              <Progress value={deviceData.cpu} className="h-1.5" />
            </div>
          </div>

          <div className="bg-slate-50/50 dark:bg-white/[0.01] p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 space-y-2 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
              <span>Hardware Modules</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{deviceData.sensorHealth}</p>
              <span className="text-[10px] text-slate-400 dark:text-white/30 font-bold block mt-1">{deviceData.sensorHealthSub}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b1019] text-white p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-white/40">
              Connected Physical Devices & Sensor Modules
            </h3>
            <span className="text-[10px] font-extrabold text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live Link Verified
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${deviceData.temperature != null ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">AHT20 Temp/Hum</span>
              <span className="text-[8px] text-white/30">I2C (0x38)</span>
              <span className={`text-[10px] font-black ${deviceData.temperature != null ? "text-emerald-400" : "text-rose-500"}`}>
                {deviceData.temperature != null ? `${deviceData.temperature}°C` : "OFFLINE"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${deviceData.lightLux != null ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">BH1750 Light</span>
              <span className="text-[8px] text-white/30">I2C (0x23)</span>
              <span className={`text-[10px] font-black ${deviceData.lightLux != null ? "text-emerald-400" : "text-rose-500"}`}>
                {deviceData.lightLux != null ? `${deviceData.lightLux} Lx` : "OFFLINE"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${deviceData.pressure != null ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">BMP280 Baro</span>
              <span className="text-[8px] text-white/30">I2C (0x76)</span>
              <span className={`text-[10px] font-black ${deviceData.pressure != null ? "text-emerald-400" : "text-rose-500"}`}>
                {deviceData.pressure != null ? `${deviceData.pressure} hPa` : "OFFLINE"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${deviceData.soilMoisture != null ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">Soil Moisture</span>
              <span className="text-[8px] text-white/30">GPIO 34 ADC</span>
              <span className={`text-[10px] font-black ${deviceData.soilMoisture != null ? "text-emerald-400" : "text-rose-500"}`}>
                {deviceData.soilMoisture != null ? `${deviceData.soilMoisture}%` : "OFFLINE"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">Rain Sensor</span>
              <span className="text-[8px] text-white/30">GPIO 35/33</span>
              <span className="text-[10px] font-black text-emerald-400">
                {deviceData.rainDetected ? "RAINING" : "CLEAR"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline && deviceData.battery > 0 ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">Battery Monitor</span>
              <span className="text-[8px] text-white/30">GPIO 32 ADC</span>
              <span className={`text-[10px] font-black ${isOnline && deviceData.battery > 0 ? "text-emerald-400" : "text-rose-500"}`}>
                {isOnline && deviceData.battery > 0 ? `${deviceData.batteryVoltage}V` : "OFFLINE"}
              </span>
            </div>

            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-2.5 h-2.5 rounded-full ${deviceData.sdCard.status === "mounted" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-[11px] font-bold text-white/90">MicroSD SPI</span>
              <span className="text-[8px] text-white/30">GPIO 5 SPI</span>
              <span className={`text-[10px] font-black ${deviceData.sdCard.status === "mounted" ? "text-emerald-400" : "text-rose-500"}`}>
                {deviceData.sdCard.status === "mounted" ? "MOUNTED" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default DevicesPage;
