import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, RefreshCw, Terminal, CheckCircle2, Play, Power,
  SkipBack, SkipForward, Server, Activity, Thermometer, Droplets,
  Sun, Wifi, Clock, RotateCw, Moon, Battery, ChevronRight
} from 'lucide-react';
import { Card, Button, Badge } from '../components/ui/index';
import API from '../services/api';

const NodeControlPage = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [nodeIp, setNodeIp] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [nodeId, setNodeId] = useState('ESP32-NODE-ALPHA');
  const [liveData, setLiveData] = useState({ t: '--', h: '--', l: '--', p: '--', a: 0 });
  const [isDetecting, setIsDetecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  
  const failCountRef = useRef(0);
  const isFetchingRef = useRef(false);
  const timeSyncedRef = useRef(false);

  // Wi-Fi config
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiApi, setWifiApi] = useState('');

  // Screen Stay-On Time
  const [timeoutMin, setTimeoutMin] = useState('0');
  const [timeoutSec, setTimeoutSec] = useState('30');

  // Night Sleep Interval
  const [sleepInt, setSleepInt] = useState('10');

  // Day Sleep Interval
  const [daySleepInt, setDaySleepInt] = useState('0');

  // Data Upload Interval
  const [advInterval, setAdvInterval] = useState('60000');

  // Temp calibration
  const [advTempOff, setAdvTempOff] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const fetchStatus = async () => {
    const ip = manualIp || nodeIp;
    if (!ip || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      let data = null;
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (isLocal) {
        try {
          const res = await fetch(`http://${ip}/status`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) data = await res.json();
        } catch (e) {
          console.warn('Direct fetch failed, falling back to proxy...', e);
        }
      }

      if (!data) {
        const res = await API.post('/api/v1/devices/proxy', { ip, endpoint: '/status', method: 'GET' });
        data = res.data;
      }

      if (data) {
        setLiveData(data);
        setIsConnected(true);
        failCountRef.current = 0;

        if (!timeSyncedRef.current) {
          timeSyncedRef.current = true;
          const epochSec = Math.floor(Date.now() / 1000);
          API.post('/api/v1/devices/proxy', { ip, endpoint: `/settime?epoch=${epochSec}`, method: 'GET' })
            .then(() => console.log('Auto-synced time on first connection.'))
            .catch((err) => {
              console.warn('Failed to auto-sync time:', err);
              timeSyncedRef.current = false;
            });
        }
      }
    } catch (err) {
      failCountRef.current += 1;
      if (failCountRef.current >= 3) {
        setIsConnected(false);
        timeSyncedRef.current = false;
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  const discoverDevice = useCallback(async () => {
    try {
      const res = await API.get('/api/v1/devices/status');
      if (res.data && Array.isArray(res.data)) {
        const withIp = res.data.filter(d => d.ip);
        const best = withIp.sort((a, b) =>
          (a.seconds_since_seen ?? 999999) - (b.seconds_since_seen ?? 999999)
        )[0];
        if (best) {
          setNodeIp(best.ip);
          setNodeId(best.device_id || 'ESP32-NODE-ALPHA');
        }
      }
    } catch (err) {
      console.error('IP discovery failed:', err);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    discoverDevice();
    const discoveryInterval = setInterval(discoverDevice, 30000);
    return () => clearInterval(discoveryInterval);
  }, [discoverDevice]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [nodeIp, manualIp]);

  const sendCommand = async (cmd, msg) => {
    const ip = manualIp || nodeIp;
    if (!ip) { showToast('⚠️ No ESP32 IP detected. Enter IP manually below.', 'error'); return; }
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      let success = false;
      if (isLocal) {
        try {
          const res = await fetch(`http://${ip}${cmd}`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) success = true;
        } catch (e) {
          console.warn('Direct command failed, falling back to proxy...', e);
        }
      }
      if (!success) {
        await API.post('/api/v1/devices/proxy', { ip, endpoint: cmd, method: 'GET' });
      }
      showToast(msg + ' ✓');
    } catch {
      showToast('⚠️ Failed to send command to ESP32', 'error');
    }
  };

  const saveWifiConfig = async () => {
    if (!wifiSsid) { showToast('⚠️ Enter Wi-Fi name first', 'error'); return; }
    try {
      const cmdStr = `/save-node?ssid=${encodeURIComponent(wifiSsid)}&pass=${encodeURIComponent(wifiPass)}&api=${encodeURIComponent(wifiApi)}`;
      await API.post('/api/v1/devices/proxy', { ip: nodeIp, endpoint: cmdStr, method: 'POST' });
      showToast('✅ Wi-Fi Saved! Node rebooting...');
    } catch {
      showToast('⚠️ Failed to save Wi-Fi config', 'error');
    }
  };

  const saveHardwareConfig = async () => {
    try {
      const cmdStr = `/save-adv?min=${timeoutMin}&sec=${timeoutSec}&sleepInt=${sleepInt}&daySleepInt=${daySleepInt}&interval=${advInterval}&tempOff=${advTempOff}`;
      await API.post('/api/v1/devices/proxy', { ip: nodeIp, endpoint: cmdStr, method: 'POST' });
      showToast('✅ Hardware Settings Saved! Node rebooting...');
    } catch {
      showToast('⚠️ Failed to save hardware settings', 'error');
    }
  };

  const syncSystemTime = async () => {
    try {
      const epochSec = Math.floor(Date.now() / 1000);
      await API.post('/api/v1/devices/proxy', { ip: nodeIp, endpoint: `/settime?epoch=${epochSec}`, method: 'GET' });
      showToast('✅ Time synced to device!');
    } catch {
      showToast('⚠️ Failed to sync time', 'error');
    }
  };

  const toggleStrictOffline = async (enable) => {
    try {
      await API.post('/api/v1/devices/proxy', { ip: nodeIp, endpoint: `/api/strict_offline?state=${enable ? '1' : '0'}`, method: 'GET' });
      showToast(`✅ Strict Offline Mode ${enable ? 'Enabled' : 'Disabled'}! Node rebooting...`);
    } catch {
      showToast('⚠️ Failed to toggle Strict Offline Mode', 'error');
    }
  };

  const animNames = ['', 'Rain Warn', 'Hot Warn', 'Sunrise', 'Sunset', 'Growing', 'Watering', 'Night Mode', 'Syncing'];

  const tabs = [
    { id: 'dashboard', label: 'Live Dashboard', icon: Activity },
    { id: 'connectivity', label: 'Connectivity', icon: Wifi },
    { id: 'hardware', label: 'Hardware Config', icon: Settings },
    { id: 'power', label: 'Data & Power', icon: Battery }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-6xl mx-auto w-full pb-16"
    >
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5" style={{ fontFamily: 'var(--font-display)' }}>
            <Terminal className="w-8 h-8 text-emerald-500" />
            Node Control Panel
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
            Directly configure and trigger diagnostic testing on your paired ESP32 hardware device.
          </p>
        </div>
        <Badge variant={isDetecting ? 'warning' : (isConnected ? 'healthy' : 'diseased')} className="text-xs font-black py-1.5 px-3.5 uppercase shrink-0">
          {isDetecting ? '🔍 SCANNING...' : (isConnected ? 'ONLINE' : 'OFFLINE')}
        </Badge>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast.msg && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-20 left-1/2 transform px-6 py-3 rounded-full font-bold shadow-2xl z-50 text-white flex items-center text-xs ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Menu */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-none flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all border ${
                isActive 
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' 
                  : 'bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/5'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Live screen monitor preview */}
            <div className="lg:col-span-5 h-full">
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-emerald-555" />
                    Live Screen Monitor
                  </h3>
                  
                  <div className="bg-[#0b1019] border border-white/5 rounded-2xl p-6 flex flex-col justify-center min-h-[220px] items-center relative overflow-hidden shadow-inner">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
                    
                    {!nodeIp ? (
                      <p className="text-white/40 font-mono text-xs animate-pulse relative z-10">
                        {isDetecting ? "Searching local network for ESP32..." : "No Local IP Configured"}
                      </p>
                    ) : !isConnected ? (
                      <p className="text-white/40 font-mono text-xs animate-pulse relative z-10">
                        Attempting direct node handshake...
                      </p>
                    ) : liveData.a > 0 ? (
                      <div className="text-center font-mono relative z-10">
                        <span className="text-xl font-black text-emerald-450 tracking-wide animate-pulse">
                          {animNames[liveData.a] || 'ANIMATION'}
                        </span>
                        <p className="text-white/30 text-[10px] uppercase font-black tracking-widest mt-2">Playing Active Frame</p>
                      </div>
                    ) : (
                      <pre className="font-mono text-xs leading-relaxed text-emerald-400 text-left w-full max-w-[240px] m-0 relative z-10">
                        {liveData.p === 1 && `Temp  : ${liveData.t} °C\nHumid : ${liveData.h} %RH\nLight : ${liveData.l} Lux`}
                        {liveData.p === 2 && `Soil  : ${liveData.sm ?? '--'} %\nRain  : ${liveData.rn === true ? 'YES' : 'NO'}\nPress : ${liveData.pr ?? '--'} hPa`}
                        {liveData.p === 3 && `Batt  : ${liveData.bp ?? '--'} %\nVolt  : ${liveData.bv ?? '--'} V\nState : ${Number(liveData.l) < 10 ? 'Night' : 'Day'}`}
                        {liveData.p === 4 && `WiFi  : ${liveData.wf || 'CONNECTED'}\nBT    : ${liveData.bt || 'READY'}\nNode  : AgriShield_01`}
                        {liveData.p === 5 && `SD Card:\nStatus: ${liveData.sd || 'MOUNTED'}\nSize  : ${liveData.sz || 0} MB`}
                        {liveData.p > 5 && `PAGE ${liveData.p}`}
                      </pre>
                    )}
                  </div>
                </div>

                {isConnected && (
                  <p className="text-[10px] text-slate-400 dark:text-white/30 font-bold mt-4 text-center">
                    OLED Wake: <span className="text-slate-800 dark:text-white font-mono">{liveData.sc ?? '--'}s</span> &nbsp;|&nbsp; Screen Page: <span className="text-slate-800 dark:text-white font-mono">{liveData.p}</span>/5
                  </p>
                )}
              </Card>
            </div>

            {/* Display Controls and Diagnostic tools */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Screen actions */}
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md">
                <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Power className="w-4 h-4 text-emerald-500" />
                  Screen Wake Controls
                </h3>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button 
                    onClick={() => sendCommand('/screen-on', 'Screen ON')} 
                    className="flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 rounded-2xl py-3.5 text-xs font-extrabold transition-all"
                  >
                    💡 Turn Screen On
                  </button>
                  <button 
                    onClick={() => sendCommand('/screen-off', 'Screen OFF')} 
                    className="flex items-center justify-center bg-slate-500/10 hover:bg-slate-500/15 text-slate-500 border border-slate-500/25 rounded-2xl py-3.5 text-xs font-extrabold transition-all"
                  >
                    🌑 Sleep Screen
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => sendCommand('/page-prev', 'Page Back')} 
                    className="flex items-center justify-center bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/5 rounded-2xl py-3 text-xs font-bold transition-all"
                  >
                    <SkipBack className="w-4 h-4 mr-2" /> Prev Page
                  </button>
                  <button 
                    onClick={() => sendCommand('/page-next', 'Page Fwd')} 
                    className="flex items-center justify-center bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/5 rounded-2xl py-3 text-xs font-bold transition-all"
                  >
                    Next Page <SkipForward className="w-4 h-4 ml-2" />
                  </button>
                </div>
              </Card>

              {/* Weather Animations diagnostics */}
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md">
                <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Play className="w-4 h-4 text-emerald-500" />
                  Trigger Test Weather Animations
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ['/anim-rain', '🌧️ Rain'],
                    ['/anim-hot', '☀️ Hot'],
                    ['/anim-sunrise', '🌅 Sunrise'],
                    ['/anim-sunset', '🌇 Sunset'],
                    ['/anim-grow', '🌿 Grow'],
                    ['/anim-water', '💦 Water'],
                    ['/anim-night', '🌙 Night'],
                    ['/anim-sync', '🔄 Sync']
                  ].map(([cmd, label]) => (
                    <button
                      key={cmd}
                      onClick={() => sendCommand(cmd, `Playing ${label}`)}
                      className="py-2.5 px-2 bg-white dark:bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-slate-800 dark:text-white/70 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold transition-all text-center"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'connectivity' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* IP Address Setup */}
            <Card glass className="p-6 space-y-5 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md">
              <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-500" />
                Direct IP Connection Setup
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                Connect this interface directly to the ESP32 hardware using its local network IP allocation.
              </p>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">ESP32 LOCAL IP ADDRESS</label>
                  <input
                    type="text" 
                    value={nodeIp} 
                    onChange={(e) => setNodeIp(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                    placeholder="e.g. 192.168.1.45"
                  />
                </div>
                
                <button 
                  onClick={fetchStatus} 
                  className="w-full flex items-center justify-center bg-emerald-500 text-white rounded-xl py-3 text-xs font-black shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Connect Handshake
                </button>
              </div>
            </Card>

            {/* WiFi Credentials paired saved */}
            <Card glass className="p-6 space-y-5 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md">
              <h3 className="text-xs font-black text-slate-555 dark:text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-500" />
                Remote Wi-Fi Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                Save network credentials directly to ESP32 flash memory. The device will reboot to apply.
              </p>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">SSID Network Name</label>
                  <input 
                    type="text" 
                    value={wifiSsid} 
                    onChange={(e) => setWifiSsid(e.target.value)} 
                    placeholder="e.g. AgriNet_Field"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Network Password</label>
                  <input 
                    type="password" 
                    value={wifiPass} 
                    onChange={(e) => setWifiPass(e.target.value)} 
                    placeholder="••••••••"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Backend Server URL (API)</label>
                  <input 
                    type="text" 
                    value={wifiApi} 
                    onChange={(e) => setWifiApi(e.target.value)} 
                    placeholder="http://192.168.1.100:8000"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-850 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono" 
                  />
                </div>
              </div>

              <button 
                onClick={saveWifiConfig} 
                className="w-full flex items-center justify-center bg-slate-800 dark:bg-slate-950 text-white rounded-xl py-3 text-xs font-black shadow-md transition-colors border border-white/5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Save Config & Reboot
              </button>
            </Card>
          </div>
        )}

        {activeTab === 'hardware' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="space-y-6">
              {/* Screen Timeout presets */}
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md space-y-4">
                <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  OLED Sleep Timeout Settings
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-450 dark:text-white/30 uppercase tracking-wider">Minutes</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={timeoutMin} 
                      onChange={(e) => setTimeoutMin(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-mono" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-450 dark:text-white/30 uppercase tracking-wider">Seconds</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="59" 
                      value={timeoutSec} 
                      onChange={(e) => setTimeoutSec(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-mono" 
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button onClick={() => { setTimeoutMin('0'); setTimeoutSec('5'); }} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold rounded-lg">5s</button>
                  <button onClick={() => { setTimeoutMin('0'); setTimeoutSec('15'); }} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold rounded-lg">15s</button>
                  <button onClick={() => { setTimeoutMin('0'); setTimeoutSec('30'); }} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold rounded-lg">30s</button>
                  <button onClick={() => { setTimeoutMin('1'); setTimeoutSec('0'); }} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold rounded-lg">1m</button>
                </div>
              </Card>

              {/* Day Sleep Intervals */}
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md space-y-4">
                <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  Deep Sleep Cycle Settings
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-450 dark:text-white/30 uppercase tracking-wider">Night sleep (Min)</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={sleepInt} 
                      onChange={(e) => setSleepInt(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-mono" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-450 dark:text-white/30 uppercase tracking-wider">Day Sleep (0=Off)</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={daySleepInt} 
                      onChange={(e) => setDaySleepInt(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-center font-mono" 
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button onClick={() => setDaySleepInt('0')} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-extrabold rounded-lg">Off</button>
                  <button onClick={() => setDaySleepInt('2')} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-extrabold rounded-lg">2m</button>
                  <button onClick={() => setDaySleepInt('5')} className="px-2.5 py-1 bg-indigo-500/10 text-indigo-500 text-[10px] font-extrabold rounded-lg">5m</button>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Daytime upload speed select */}
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md space-y-4">
                <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Telemetry Log Frequency
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                  Adjust target log interval frequency to save flash storage write wear.
                </p>
                <select 
                  value={advInterval} 
                  onChange={(e) => setAdvInterval(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                >
                  <option value="15000">15 Seconds (Real-time)</option>
                  <option value="30000">30 Seconds</option>
                  <option value="60000">1 Minute (Standard)</option>
                  <option value="300000">5 Minutes (Power saving)</option>
                </select>
              </Card>

              {/* Sensor Temperature offset value calibration */}
              <Card glass className="p-6 border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.02] backdrop-blur-md space-y-4">
                <h3 className="text-xs font-black text-slate-550 dark:text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-rose-500" />
                  Temperature Sensor Offset
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                  Calibrate BME280/AHT20 board error temperature readings.
                </p>
                <input 
                  type="number" 
                  step="0.1" 
                  value={advTempOff} 
                  onChange={(e) => setAdvTempOff(e.target.value)}
                  placeholder="e.g. -1.5°C"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20" 
                />
              </Card>
            </div>

            {/* Strict Offline warning alert */}
            <Card glass className="lg:col-span-2 p-6 border border-rose-500/20 bg-rose-500/[0.03] space-y-4">
              <div className="flex items-center gap-2">
                <Power className="w-5 h-5 text-rose-500 animate-pulse" />
                <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Strict Offline Logging Mode</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/45 leading-relaxed">
                Reconfigure the ESP32 to permanently close the Wi-Fi transceiver, strictly recording all weather parameters to the local SD storage pipeline to minimize power drain.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={() => toggleStrictOffline(true)} 
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl py-3 text-xs font-black transition-all shadow-md shadow-rose-500/20"
                >
                  Enable Strict Offline
                </button>
                <button 
                  onClick={() => toggleStrictOffline(false)} 
                  className="flex-1 bg-slate-800 dark:bg-slate-950 text-white rounded-xl py-3 text-xs font-black transition-all border border-white/5"
                >
                  Disable (Return to Online Mode)
                </button>
              </div>
            </Card>

            {/* Config Apply Action */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <button 
                onClick={saveHardwareConfig} 
                className="w-full flex items-center justify-center bg-emerald-500 text-white rounded-xl py-4 text-xs font-black shadow-lg shadow-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Save Hardware Config & Reboot
              </button>

              <Card glass className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200/85 dark:border-white/5 bg-white/50 dark:bg-white/[0.01]">
                <div className="text-center sm:text-left">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 justify-center sm:justify-start">
                    <Clock className="w-3.5 h-3.5 text-sky-500" />
                    Time Sync
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">
                    Push current PC clock timestamp.
                  </p>
                </div>
                
                <button 
                  onClick={syncSystemTime} 
                  className="w-full sm:w-auto bg-slate-800 dark:bg-slate-950 border border-white/5 text-white px-5 py-3 rounded-xl text-xs font-black transition-all shrink-0"
                >
                  Sync Time
                </button>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'power' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Erase Logs card */}
            <Card hover className="p-6 flex flex-col justify-between h-56 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
              <div className="space-y-2">
                <h3 className="text-xs font-black text-purple-500 uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  MicroSD Queue Wipe
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                  Clear the cache logs from the hardware microSD card to clean up memory space.
                </p>
              </div>

              <button 
                onClick={() => sendCommand('/api/erase-logs', 'Erasing SD Logs')}
                className="w-full bg-purple-500/10 hover:bg-purple-500/15 text-purple-550 border border-purple-500/25 py-3 rounded-xl text-xs font-black transition-all"
              >
                Erase logs.txt
              </button>
            </Card>

            {/* Offline Mode card */}
            <Card hover className="p-6 flex flex-col justify-between h-56 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
              <div className="space-y-2">
                <h3 className="text-xs font-black text-sky-500 uppercase tracking-widest flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-sky-500" />
                  Toggle Antenna Standby
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                  Disable WiFi antenna and toggle to local offline mode to double device run duration.
                </p>
              </div>

              <button 
                onClick={() => sendCommand('/api/strict_offline', 'Enabling Strict Offline')} 
                className="w-full bg-sky-500/10 hover:bg-sky-500/15 text-sky-500 border border-sky-500/25 py-3 rounded-xl text-xs font-black transition-all"
              >
                Go Offline
              </button>
            </Card>

            {/* Shutdown card */}
            <Card hover className="p-6 flex flex-col justify-between h-56 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
              <div className="space-y-2">
                <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                  <Power className="w-4 h-4" />
                  Device Sleep Standby
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                  Put ESP32 chip into absolute sleep state. Press Button 1 on board to boot.
                </p>
              </div>

              <button 
                onClick={() => sendCommand('/api/shutdown', 'Shutting down')} 
                className="w-full bg-rose-500/10 hover:bg-rose-500/15 text-rose-550 border border-rose-500/25 py-3 rounded-xl text-xs font-black transition-all"
              >
                Shutdown Chip
              </button>
            </Card>

            {/* Soft Reset */}
            <Card glass className="sm:col-span-2 lg:col-span-3 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02]">
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                  <RotateCw className="w-4 h-4 text-slate-400" />
                  Soft Reset Node
                </h3>
                <p className="text-[10px] text-slate-450 dark:text-white/30 mt-1 text-center sm:text-left">
                  Perform a safe CPU restart on the ESP32 node without wiping any permanent configuration params.
                </p>
              </div>
              
              <button 
                onClick={() => sendCommand('/reset', 'Rebooting...')} 
                className="w-full sm:w-auto bg-slate-800 dark:bg-slate-950 border border-white/5 text-white px-8 py-3 rounded-xl text-xs font-black transition-all shrink-0"
              >
                Reboot Node
              </button>
            </Card>

          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default NodeControlPage;
