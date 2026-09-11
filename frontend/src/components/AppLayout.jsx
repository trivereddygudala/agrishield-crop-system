import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import NavbarSceneRenderer from './animations/NavbarSceneRenderer';
import { useNavbarTheme } from '../hooks/useNavbarTheme';
import { 
  Leaf, 
  Menu,
  Camera, 
  X, 
  LayoutDashboard, 
  History, 
  User, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader as LoaderIcon,
  Bell,
  BellRing,
  Bot,
  BarChart2,
  Cpu,
  FileText,
  Sprout,
  AlertTriangle,
  TrendingUp,
  Store,
  Globe,
  CloudRain,
  Droplets,
  BatteryWarning,
  WifiOff,
  Wifi,
  Bluetooth,
  BluetoothOff,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  BatteryCharging,
  CheckCheck,
  Activity,
  Sun,
  Moon,
  HelpCircle,
  ShieldCheck,
  Search,
  Sparkles,
  Users,
  HardDrive,
  Sliders, 
  UploadCloud,
  Radio,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useHardwareMode } from '../hooks/useHardwareMode';
import API from '../services/api';
import Breadcrumbs from './Breadcrumbs';
import LogoutOverlay from './animations/LogoutOverlay';

// Import primitive UI helpers for backwards compatibility
import { 
  Button as UIPrimitiveButton, 
  Card as UIPrimitiveCard, 
  Badge as UIPrimitiveBadge,
  Alert as UIPrimitiveAlert,
  Skeleton as UIPrimitiveSkeleton,
  Spinner as UIPrimitiveSpinner
} from './ui/index';

// Priority colour helpers for notification system
const PRIORITY_COLORS = {
  Critical: { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', border: 'border-rose-200' },
  High:     { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', border: 'border-amber-200' },
  Medium:   { bg: 'bg-orange-100 dark:bg-orange-950/60', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', border: 'border-orange-200' },
  Low:      { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', border: 'border-emerald-200' },
};

const CATEGORY_ICONS = {
  disease:        AlertTriangle,
  weather:        CloudRain,
  soil:           Droplets,
  irrigation:     Droplets,
  battery:        BatteryWarning,
  device:         WifiOff,
  system:         Activity,
  recommendation: Activity,
  Disease:    AlertTriangle,
  Weather:    CloudRain,
  Irrigation: Droplets,
  Battery:    BatteryWarning,
  Device:     WifiOff,
  System:     Activity,
};

import { timeAgo, formatDateTime } from '../utils/dateUtils';

// 1. Button (Delegates to standardized UI primitive)
export const Button = ({ children, variant = 'primary', size = 'md', loading = false, disabled = false, className = '', ...props }) => (
  <UIPrimitiveButton variant={variant} size={size} isLoading={loading} disabled={disabled} className={className} {...props}>
    {children}
  </UIPrimitiveButton>
);

// 2. Card (Delegates to standardized UI primitive)
export const Card = ({ children, className = '', hover = true, glass = false, ...props }) => (
  <UIPrimitiveCard hover={hover} glass={glass} className={className} {...props}>
    {children}
  </UIPrimitiveCard>
);

// 3. Loader
export const Loader = ({ size = 'md', className = '' }) => (
  <UIPrimitiveSpinner size={size} className={className} />
);

// 4. LoadingScreen
export const LoadingScreen = ({ text = 'Verifying crop status...' }) => (
  <div className="fixed inset-0 bg-slate-950/30 backdrop-blur-md flex flex-col items-center justify-center z-50">
    <div className="bg-white/90 dark:bg-slate-900/90 p-8 rounded-3xl shadow-2xl border border-white/20 flex flex-col items-center max-w-sm text-center">
      <div className="relative flex items-center justify-center mb-4">
        <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-950/50 rounded-full animate-ping opacity-75 h-16 w-16" />
        <div className="relative bg-emerald-600 p-4 rounded-full text-white shadow-lg shadow-emerald-600/30">
          <Leaf className="h-8 w-8 animate-pulse" />
        </div>
      </div>
      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg mb-1">AgriShield AI</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  </div>
);

// 5. Modal
export const Modal = ({ isOpen, onClose, title, children, footerActions }) => {
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
        {footerActions && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
};

// 6. Toast Notification
export const Toast = ({ message, type = 'success', onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => { onClose(); }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const typeStyles = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800',
    error: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
    info: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800'
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center p-4 rounded-2xl border shadow-xl max-w-sm ${typeStyles[type]}`}>
      <span className="text-sm font-medium mr-6">{message}</span>
      <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 rounded-lg p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// 7. Navbar Component
export const Navbar = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout, updateProfile } = useAuth();
  const { theme } = useNavbarTheme();
  const { hardwareMode } = useHardwareMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { activeFarm, farms, setActiveFarm, createFarm, profileCompleted } = useFarm();
  
  // Local states
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync HTML lang attribute to activate regional fallback fonts in index.css
  useEffect(() => {
    const activeLang = i18n.language ? i18n.language.split('-')[0] : 'en';
    document.documentElement.lang = activeLang;
  }, [i18n.language]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [showNavbarScene, setShowNavbarScene] = useState(() => {
    const cached = localStorage.getItem('show_navbar_scene');
    return cached === null ? true : cached === 'true';
  });

  const toggleNavbarScene = () => {
    const nextVal = !showNavbarScene;
    setShowNavbarScene(nextVal);
    localStorage.setItem('show_navbar_scene', String(nextVal));
  };

  // Notification bell state
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [liveAlert, setLiveAlert] = useState(null);
  const bellRef = useRef(null);
  const userMenuRef = useRef(null);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get('/api/notifications/count');
      setUnreadCount(res.data.unread_count || 0);
    } catch { /* silently ignore */ }
  }, [user]);

  const fetchRecentAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get('/api/notifications/unread?limit=5');
      let alertData = res.data || [];

      const userRole = user?.role?.toLowerCase() || 'farmer';
      const isHardwareSimEnabled = localStorage.getItem('sim_hardware_alarms') !== 'false';
      if (userRole === 'tester' && isHardwareSimEnabled) {
        const mockAlarm = {
          notification_id: 'mock-sim-battery',
          title: '🚨 ESP32 Battery Critical',
          message: 'ESP32 field node battery dropped to 14%. Recharge solar/LiPo battery now to prevent telemetry dropout.',
          created_at: new Date().toISOString(),
          is_read: false
        };
        alertData = [mockAlarm, ...alertData.slice(0, 4)];
      }

      setRecentAlerts(alertData);
    } catch { /* silently ignore */ }
  }, [user]);

  // Global WebSocket Context hook
  const { connectionStatus, lastMessageTime, lastTelemetry, deviceStatusMap, unreadCount: wsUnreadCount, latestAlert } = useWebSocket();

  // ESP32 Live Hardware Status
  const [nodeStatus, setNodeStatus] = useState({ online: false, rssi: null, bluetoothConnected: false, batteryPercent: null, batteryCharging: false });

  const [hardwareSimActive, setHardwareSimActive] = useState(() => {
    return localStorage.getItem('sim_hardware_alarms') !== 'false';
  });

  useEffect(() => {
    const handleAlarmSimChange = (e) => {
      setHardwareSimActive(e.detail);
    };
    window.addEventListener('simHardwareAlarmsChange', handleAlarmSimChange);
    return () => window.removeEventListener('simHardwareAlarmsChange', handleAlarmSimChange);
  }, []);

  const displayedNodeStatus = (user?.role?.toLowerCase() === 'tester' && hardwareSimActive)
    ? { online: false, rssi: null, bluetoothConnected: false, batteryPercent: 14, batteryCharging: false }
    : nodeStatus;

  const fetchNodeStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await API.get('/api/v1/devices/status');
      if (res.data && res.data.length > 0) {
        const dev = res.data.find(d => d.status === "online") || res.data[0];
        const telem = dev.latest_telemetry || {};
        const isOnline = dev.status === "online";
        const rssi = telem.wifi_rssi !== undefined ? telem.wifi_rssi : telem.rssi;
        const btConnected = telem.bluetooth_connected === true || telem.bt_connected === true;
        const battPct = telem.battery_percentage !== undefined ? telem.battery_percentage : null;
        const battCharging = telem.battery_charging === true;
        setNodeStatus({
          online: isOnline,
          rssi: isOnline && rssi !== undefined ? rssi : null,
          bluetoothConnected: btConnected,
          batteryPercent: battPct,
          batteryCharging: battCharging
        });
      }
    } catch { /* silently ignore */ }
  }, [user]);

  // STEP 5 - FALLBACK: Adaptive REST polling ONLY when WebSocket is offline/reconnecting
  useEffect(() => {
    fetchNodeStatus();
    if (connectionStatus !== 'connected') {
      const timer = setInterval(fetchNodeStatus, 5000);
      return () => clearInterval(timer);
    }
  }, [fetchNodeStatus, connectionStatus]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Sync global WebSocket unread count
  useEffect(() => {
    if (wsUnreadCount !== null) {
      setUnreadCount(wsUnreadCount);
    }
  }, [wsUnreadCount]);

  // Sync recent alerts and trigger banner on new live alert over WebSocket
  useEffect(() => {
    if (latestAlert) {
      setRecentAlerts(prev => [latestAlert, ...prev].slice(0, 5));
      setLiveAlert(latestAlert);
      const t = setTimeout(() => { setLiveAlert(null); }, 6000);
      return () => clearTimeout(t);
    }
  }, [latestAlert]);

  // Sync hardware status bar in real-time without polling when telemetry updates arrive over WebSocket
  useEffect(() => {
    if (lastTelemetry || Object.keys(deviceStatusMap).length > 0) {
      const devIds = Object.keys(deviceStatusMap);
      if (devIds.length > 0) {
        const dev = deviceStatusMap[devIds[0]];
        const telem = lastTelemetry && lastTelemetry.device_id === devIds[0] ? (lastTelemetry.telemetry || {}) : (dev.latest_telemetry || {});
        const isOnline = dev.status === "online";
        const rssi = telem.wifi_rssi !== undefined ? telem.wifi_rssi : (telem.rssi !== undefined ? telem.rssi : null);
        const btConnected = telem.bluetooth_connected === true || telem.bt_connected === true;
        const battPct = telem.battery_percentage !== undefined ? telem.battery_percentage : (dev.battery !== undefined ? dev.battery : null);
        const battCharging = telem.battery_charging === true;
        setNodeStatus({
          online: isOnline,
          rssi: isOnline && rssi !== null ? rssi : null,
          bluetoothConnected: btConnected,
          batteryPercent: battPct,
          batteryCharging: battCharging
        });
      } else if (lastTelemetry) {
        const telem = lastTelemetry.telemetry || lastTelemetry;
        setNodeStatus(prev => ({
          ...prev,
          online: true,
          rssi: telem.wifi_rssi !== undefined ? telem.wifi_rssi : prev.rssi,
          bluetoothConnected: telem.bluetooth_connected !== undefined ? telem.bluetooth_connected : prev.bluetoothConnected,
          batteryPercent: telem.battery_percentage !== undefined ? telem.battery_percentage : prev.batteryPercent,
          batteryCharging: telem.battery_charging !== undefined ? telem.battery_charging : prev.batteryCharging
        }));
      }
    }
  }, [lastTelemetry, deviceStatusMap]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellClick = async () => {
    if (!bellOpen) await fetchRecentAlerts();
    setBellOpen(prev => !prev);
  };

  const handleMarkRead = async (id) => {
    try {
      await API.post(`/api/notifications/${id}/read`);
      setRecentAlerts(prev => prev.filter(n => n.notification_id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);

  const handleLogout = () => {
    setShowLogoutOverlay(true);
  };

  const handleLogoutDone = () => {
    setShowLogoutOverlay(false);
    logout();
    window.location.href = '/';
  };

  return (
    <>
      {showLogoutOverlay && (
        <LogoutOverlay
          userName={user?.name || 'Farmer'}
          onDone={handleLogoutDone}
        />
      )}
      <header className="fixed top-0 left-0 right-0 z-50 w-full h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#050911]/95 backdrop-blur-xl transition-colors">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 w-full gap-4">
        
        {/* Left Section: Menu, Brand, Breadcrumb — Hamburger hidden on mobile layout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button 
            type="button" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition-all"
            title="Toggle Menu"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
            <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-sm shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <Leaf className="h-5 w-5" />
            </div>
            {/* Desktop Brand Title */}
            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight hidden sm:inline text-lg">
              AgriShield <span className="text-emerald-600 dark:text-emerald-400 font-normal">AI</span>
            </span>
            {/* Mobile Dynamic Animated Title */}
            <span className="sm:hidden overflow-hidden h-7 relative flex items-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={location.pathname}
                  initial={{ y: -15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 15, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="font-bold text-slate-900 dark:text-slate-100 tracking-tight text-base block"
                >
                  {(() => {
                    const path = location.pathname;
                    if (path === '/dashboard') return t('nav.dashboard', 'AgriShield');
                    if (path === '/upload' || path === '/result') return t('nav.scan_crop', 'AI Crop Doctor');
                    if (path === '/history') return t('nav.scan_history', 'Scan History');
                    if (path === '/analytics') return t('nav.analytics', 'Sensor Analytics');
                    if (path === '/market') return t('nav.market', 'Mandi Prices');
                    if (path === '/farm') return t('nav.farm', 'My Farm');
                    if (path === '/notifications') return t('nav.notifications', 'Alerts');
                    if (path === '/settings') return t('nav.settings', 'Settings');
                    if (path === '/profile') return t('nav.profile', 'My Profile');
                    if (path === '/devices') return t('nav.devices', 'Devices');
                    if (path === '/node-control') return t('nav.node_control', 'Node Control');
                    if (path === '/sdcard') return t('nav.sd_card', 'MicroSD Storage');
                    if (path === '/assistant') return t('nav.assistant', 'AI Assistant');
                    if (path === '/crop-advisory') return t('nav.crop_advisory', 'Crop Advisory');
                    if (path === '/more') return t('nav.more_short', 'More');
                    return 'AgriShield';
                  })()}
                </motion.span>
              </AnimatePresence>
            </span>
          </Link>
 
          {/* Breadcrumb Hierarchy */}
          <div className="hidden md:block ml-4 pl-4 border-l border-slate-200 dark:border-slate-800">
            <Breadcrumbs />
          </div>
        </div>
 
        {/* Dynamic Animation Scene (Center) */}
        {showNavbarScene && (
          <div className="hidden lg:flex flex-1 min-w-0 justify-center px-4">
            <NavbarSceneRenderer theme={theme} isCompact={location.pathname !== '/dashboard'} />
          </div>
        )}
 
        {/* Right Section: Actions, Theme, Notifications, User */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {user && (
            <>
              {/* Active Farm Switcher Dropdown */}
              {profileCompleted && farms.length > 0 && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all font-semibold text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
                  >
                    <Sprout className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="max-w-[100px] truncate">{activeFarm ? activeFarm.farm_name : t('nav.select_farm', 'Select Farm')}</span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 z-20 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold px-2 py-1 uppercase tracking-wider">{t('nav.switch_farm', 'Switch Active Farm')}</p>
                        {farms.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => {
                              setActiveFarm(f.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-xl text-xs font-semibold transition-all ${
                              activeFarm && activeFarm.id === f.id
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="truncate">{f.farm_name}</span>
                            {activeFarm && activeFarm.id === f.id && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">●</span>}
                          </button>
                        ))}
                        <div className="h-[1px] bg-slate-200 dark:bg-slate-800 my-1"></div>
                        <button
                          onClick={async () => {
                            try {
                              setDropdownOpen(false);
                              await createFarm({ farm_name: `New Farm Sector ${farms.length + 1}` });
                              navigate('/farm');
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-center rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all border border-dashed border-emerald-200 dark:border-emerald-800/60"
                        >
                          <span className="text-[14px]">+</span> {t('nav.add_field', 'Add New Field')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ESP32 Hardware Status Bar: WiFi | Bluetooth | Battery - Shown ONLY when Hardware Mode is ON */}
              {hardwareMode && (
                <div className="hidden lg:flex items-center gap-1 px-1 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                  {/* WiFi Signal Indicator */}
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    displayedNodeStatus.online 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-rose-500 dark:text-rose-400'
                  }`} title={displayedNodeStatus.online ? `WiFi: ${displayedNodeStatus.rssi || '?'} dBm` : 'WiFi Disconnected'}>
                    {displayedNodeStatus.online ? (
                      <>
                        <Wifi className="w-3.5 h-3.5" />
                        <span>{displayedNodeStatus.rssi !== null ? `${displayedNodeStatus.rssi}` : ''}</span>
                      </>
                    ) : (
                      <WifiOff className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

                  {/* Bluetooth Status Indicator */}
                  <div className={`flex items-center px-1.5 py-1 rounded-lg transition-colors ${
                    displayedNodeStatus.bluetoothConnected 
                      ? 'text-blue-500 dark:text-blue-400' 
                      : 'text-slate-400 dark:text-slate-600'
                  }`} title={displayedNodeStatus.bluetoothConnected ? 'Bluetooth Connected' : 'Bluetooth Idle'}>
                    {displayedNodeStatus.bluetoothConnected ? (
                      <Bluetooth className="w-3.5 h-3.5" />
                    ) : (
                      <BluetoothOff className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

                  {/* Battery Percentage Indicator */}
                  {(() => {
                    const pct = displayedNodeStatus.batteryPercent;
                    const charging = displayedNodeStatus.batteryCharging;
                    let BattIcon = Battery;
                    let color = 'text-slate-400 dark:text-slate-500';
                    if (charging) {
                      BattIcon = BatteryCharging;
                      color = 'text-amber-500 dark:text-amber-400';
                    } else if (pct !== null) {
                      if (pct >= 75) { BattIcon = BatteryFull; color = 'text-emerald-500 dark:text-emerald-400'; }
                      else if (pct >= 40) { BattIcon = BatteryMedium; color = 'text-amber-500 dark:text-amber-400'; }
                      else if (pct >= 10) { BattIcon = BatteryLow; color = 'text-orange-500 dark:text-orange-400'; }
                      else { BattIcon = BatteryWarning; color = 'text-rose-500 dark:text-rose-400'; }
                    }
                    return (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${color}`}
                           title={pct !== null ? `Battery: ${pct}%${charging ? ' (Charging)' : ''}` : 'Battery N/A'}>
                        <BattIcon className="w-4 h-4" />
                        <span>{pct !== null ? `${pct}%` : '--'}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Real-time WebSocket Status Indicator Badge */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-[11px] font-semibold transition-all">
                {connectionStatus === 'connected' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-300 hidden sm:inline">{t('nav.live_ws', 'Live WS')}</span>
                    {lastMessageTime && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal hidden xl:inline">({lastMessageTime})</span>}
                  </>
                )}
                {connectionStatus === 'reconnecting' && (
                  <>
                    <UIPrimitiveSpinner size="xs" className="text-amber-500 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300 hidden sm:inline">{t('nav.reconnecting', 'Reconnecting...')}</span>
                  </>
                )}
                {connectionStatus === 'offline' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">{t('nav.rest_mode', 'REST')}</span>
                  </>
                )}
                {connectionStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-bounce" />
                    <span className="text-rose-600 dark:text-rose-400 hidden sm:inline">{t('nav.ws_error', 'WS Error')}</span>
                  </>
                )}
              </div>

              {/* Admin Panel Direct Access Badge Button - STRICTLY FOR ADMIN ONLY */}
              {user?.role?.toLowerCase() === 'admin' && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
                  title={t('nav.admin_panel', 'Admin Control Panel')}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('nav.admin_panel', 'Admin Panel')}</span>
                </Link>
              )}

              {/* Live Time Display - Hidden on smaller screens */}
              <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-xs font-bold text-slate-700 dark:text-slate-200 font-mono shadow-sm transition-all hover:border-emerald-500/30">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
                <span className="tabular-nums tracking-wide">{currentTime || '--:--:--'}</span>
              </div>

              {/* Global Language Selector - Hidden on smaller screens */}
              <div className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <select
                  value={i18n.language ? i18n.language.split('-')[0] : 'en'}
                  onChange={(e) => {
                    const lang = e.target.value;
                    i18n.changeLanguage(lang);
                    localStorage.setItem('i18nextLng', lang);
                    if (user && updateProfile) {
                      updateProfile({ preferred_language: lang }).catch(() => {});
                    }
                    window.dispatchEvent(new CustomEvent('agrishield-language-changed', { detail: { language: lang } }));
                  }}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[70px] sm:max-w-none"
                  aria-label="Select Application Language"
                >
                  <option value="en" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">EN</option>
                  <option value="hi" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">हिन्दी</option>
                  <option value="te" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">తెలుగు</option>
                  <option value="ta" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">தமிழ்</option>
                  <option value="kn" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">ಕನ್ನಡ</option>
                  <option value="ml" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">മലയാളം</option>
                  <option value="bn" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">বাংলা</option>
                  <option value="mr" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">मराठी</option>
                  <option value="gu" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">ગુજરાતી</option>
                  <option value="pa" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">ਪੰਜਾਬੀ</option>
                  <option value="ur" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">اردو</option>
                  <option value="or" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">ଓଡ଼ିଆ</option>
                  <option value="as" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">অসমীয়া</option>
                </select>
              </div>


              {/* Visual Scene Canvas Toggle — Hidden on mobile layout */}
              <button
                type="button"
                onClick={toggleNavbarScene}
                className="hidden lg:flex p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors relative"
                title={showNavbarScene ? "Hide Visual Scene Animations" : "Show Visual Scene Animations"}
                aria-label="Toggle Visual Scene"
              >
                <Sparkles className={`w-4 h-4 transition-all duration-300 ${
                  showNavbarScene 
                    ? 'text-emerald-500 dark:text-emerald-400 animate-pulse' 
                    : 'text-slate-400 dark:text-slate-600 scale-95 opacity-60'
                }`} />
                {showNavbarScene && (
                  <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                )}
              </button>

              {/* Theme Dark / Light Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              {/* Notification Bell Dropdown */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={handleBellClick}
                  className="relative p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  {unreadCount > 0 ? <BellRing size={18} className="text-emerald-600 dark:text-emerald-400 animate-pulse" /> : <Bell size={18} />}
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[9px] font-bold items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 mt-2 z-50 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{t('nav.notifications', 'Notifications')}</span>
                      <Link to="/notifications" onClick={() => setBellOpen(false)} className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
                        {t('nav.view_all_inbox', 'View All Inbox')}
                      </Link>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                      {recentAlerts.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          <Bell className="mx-auto mb-2 opacity-30" size={24} />
                          {t('nav.all_caught_up', 'All caught up!')}
                        </div>
                      ) : (
                        recentAlerts.map((alert) => {
                          const pc = PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.Low;
                          const CatIcon = CATEGORY_ICONS[alert.category] || Activity;
                          return (
                            <div key={alert.notification_id} className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!alert.read ? 'border-l-2 border-emerald-500' : ''}`}>
                              <div className="flex items-start gap-2.5">
                                <span className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${pc.bg}`}>
                                  <CatIcon size={13} className={pc.text} />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{alert.title}</p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 line-clamp-2">{alert.message}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">{timeAgo(alert.created_at)}</p>
                                </div>
                                <button onClick={() => handleMarkRead(alert.notification_id)} className="flex-shrink-0 text-slate-300 hover:text-emerald-600 p-1 rounded" title="Mark read">
                                  <CheckCheck size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* User Profile Dropdown Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 group p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'F'}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 space-y-1">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user?.role?.toLowerCase() === 'admin' ? t('nav.admin_profile', 'Admin Profile & Security') : t('nav.profile', 'User Profile')}</span>
                    </Link>

                    {user?.role?.toLowerCase() !== 'admin' && (
                      <Link
                        to="/farm"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Sprout className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t('nav.farm_operations', 'My Farm & Operations')}</span>
                      </Link>
                    )}

                    <Link
                      to="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('nav.notification_inbox', 'Notification Inbox')}</span>
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('nav.settings', 'Settings')}</span>
                    </Link>

                    {(user?.role?.toLowerCase() === 'admin') && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors border border-amber-200 dark:border-amber-900/50 my-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('nav.admin_panel', 'Admin Control Panel')}</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t('nav.log_out', 'Log Out')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Live Alert Toast Notification (Responsive for mobile & desktop) */}
      <AnimatePresence>
        {liveAlert && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-22 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-[9999] bg-white/95 dark:bg-slate-900/95 border border-emerald-500/30 dark:border-emerald-500/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3 backdrop-blur-xl"
          >
            <div className="flex-shrink-0 p-2.5 bg-emerald-100 dark:bg-emerald-950/80 rounded-xl text-emerald-600 dark:text-emerald-400">
              <BellRing size={20} className="animate-bounce" />
            </div>
            <div className="flex-grow min-w-0 pr-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t('nav.live_alert_tag', 'AI Diagnosis Alert')}</span>
              </div>
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 leading-snug">{liveAlert.title}</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{liveAlert.message}</p>
              <Link 
                to={liveAlert.action_url || "/notifications"} 
                onClick={() => setLiveAlert(null)}
                className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
              >
                <span>{t('nav.view_details', 'View Full Details')}</span>
                <span>&rarr;</span>
              </Link>
            </div>
            <button 
              onClick={() => setLiveAlert(null)} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
    </>
  );
};

// 8. Sidebar Component
export const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hardwareMode } = useHardwareMode();

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSidebarOpen]);

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isTester = user?.role?.toLowerCase() === 'tester';

  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'users';

  const navGroups = isAdmin ? [
    {
      title: "Admin Dashboard & Operations",
      items: [
        { key: "nav.admin_users", path: "/admin?tab=users", icon: Users, label: "Registered Users" },
        { key: "nav.admin_broadcast", path: "/admin?tab=broadcast", icon: Radio, label: "Global Broadcasts" },
        { key: "nav.admin_geography", path: "/admin?tab=geography", icon: Globe, label: "Farmer Geography" },
        { key: "nav.admin_iot", path: "/admin?tab=iot", icon: Cpu, label: "IoT Hardware Fleet" },
        { key: "nav.admin_firmware", path: "/admin?tab=firmware", icon: UploadCloud, label: "Firmware OTA" },
        { key: "nav.admin_logs", path: "/admin?tab=logs", icon: FileText, label: "Security Audit Logs" },
        { key: "nav.admin_settings", path: "/admin?tab=settings", icon: Activity, label: "System Health & Specs" },
      ]
    },
    {
      title: "System Services",
      items: [
        { key: "nav.assistant", path: "/assistant", icon: Bot, label: "AgriShield Copilot" },
        { key: "nav.notifications", path: "/notifications", icon: Bell, label: "Notification Center" },
      ]
    },
    {
      title: "Admin Account",
      items: [
        { key: "nav.profile", path: "/profile", icon: User, label: "Admin Profile" },
        { key: "nav.settings", path: "/settings", icon: SettingsIcon, label: "System Settings" },
      ]
    }
  ] : isTester ? [
    {
      title: "QA & Testing",
      items: [
        { key: "nav.dashboard", path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { key: "nav.scan_crop", path: "/upload", icon: Camera, label: "AI Scan Center" },
        { key: "nav.analytics", path: "/analytics", icon: Activity, label: "Telemetry & Logs" },
        { key: "nav.scan_history", path: "/history", icon: History, label: "Scan History" },
        { key: "nav.reports", path: "/reports", icon: FileText, label: "Reports" },
      ]
    },
    ...(hardwareMode ? [{
      title: "Device & Monitoring",
      items: [
        { key: "nav.devices", path: "/devices", icon: Cpu, label: "IoT Devices" },
        { key: "nav.node_control", path: "/node-control", icon: Sliders, label: "Node Control Panel" },
        { key: "nav.sd_card", path: "/sdcard", icon: HardDrive, label: "MicroSD Storage" },
        { key: "nav.notifications", path: "/notifications", icon: Bell, label: "Notifications" },
      ]
    }] : [{
      title: "Alerts & Notifications",
      items: [
        { key: "nav.notifications", path: "/notifications", icon: Bell, label: "Notifications" },
      ]
    }]),
    {
      title: "Intelligence & Assistance",
      items: [
        { key: "nav.assistant", path: "/assistant", icon: Bot, label: "AI Assistant" },
      ]
    },
    {
      title: "Account Settings",
      items: [
        { key: "nav.profile", path: "/profile", icon: User, label: "Profile" },
        { key: "nav.settings", path: "/settings", icon: SettingsIcon, label: "Settings" },
      ]
    }
  ] : [
    {
      title: "Main Menu",
      titleKey: "nav.group_main",
      items: [
        { key: "nav.dashboard", path: "/dashboard", icon: LayoutDashboard, label: "Home", color: "text-emerald-500" },
        { key: "nav.scan_crop", path: "/upload", icon: Camera, label: "AI Crop Doctor", color: "text-teal-500" },
        { key: "nav.farm", path: "/farm", icon: Sprout, label: "My Farm", color: "text-emerald-500" },
        { key: "nav.market", path: "/market", icon: TrendingUp, label: "Mandi Prices", color: "text-amber-500" },
      ]
    },
    ...(hardwareMode ? [{
      title: "My Sensors",
      titleKey: "nav.group_sensors",
      items: [
        { key: "nav.devices", path: "/devices", icon: Cpu, label: "View Sensors", color: "text-sky-500" },
        { key: "nav.node_control", path: "/node-control", icon: Sliders, label: "Sensor Settings", color: "text-indigo-500" },
        { key: "nav.sd_card", path: "/sdcard", icon: HardDrive, label: "MicroSD Storage", color: "text-purple-500" },
      ]
    }] : []),
    {
      title: "Data & Logs",
      titleKey: "nav.group_data",
      items: [
        { key: "nav.scan_history", path: "/history", icon: History, label: "Scan History", color: "text-emerald-500" },
        { key: "nav.telemetry", path: "/analytics", icon: Activity, label: "Telemetry Logs", color: "text-cyan-500" },
      ]
    },
    {
      title: "Help & Settings",
      titleKey: "nav.group_help",
      items: [
        { key: "nav.assistant", path: "/assistant", icon: Bot, label: "Ask AI Expert", color: "text-teal-500" },
        { key: "nav.profile", path: "/profile", icon: User, label: "My Profile", color: "text-violet-500" },
        { key: "nav.settings", path: "/settings", icon: SettingsIcon, label: "Settings", color: "text-slate-400" },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`fixed top-16 bottom-0 left-0 z-40 w-64 border-r border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-xl pt-2 transition-transform duration-300 flex flex-col justify-between ${
        sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
      }`}>
        <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                {group.titleKey ? t(group.titleKey, group.title) : group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isItemAdmin = item.path.startsWith('/admin');
                const itemTab = isItemAdmin ? (new URLSearchParams(item.path.split('?')[1] || '').get('tab') || 'users') : null;
                const isActive = isItemAdmin 
                  ? (currentPath === '/admin' && currentTab === itemTab)
                  : currentPath === item.path;
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={t(item.key, item.label)}
                    className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold min-h-[44px] transition-all duration-200 stagger-item ${
                      isActive 
                        ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/25 border-l-4 border-l-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/40 dark:border-l-4 dark:border-l-emerald-400' 
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white hover:translate-x-1'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-white dark:text-emerald-300' : (item.color || 'text-slate-400')}`} />
                      <span>{t(item.key, item.label)}</span>
                    </div>
                    {isActive && <ChevronRight className="h-4 w-4 text-white dark:text-emerald-300" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer System Health Badge */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/60">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">PyTorch AI</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
              v2.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

// 8.5 Mobile Bottom Navigation - Clean, Flush, Neatly Aligned Dock
export const BottomNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount } = useWebSocket() || {};
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  // Admin tabs vs Farmer tabs
  const adminTabs = [
    {
      key: 'dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      path: '/admin',
      Icon: LayoutDashboard,
      matchPaths: ['/admin'],
    },
    {
      key: 'alerts',
      label: t('nav.alerts_short', 'Alerts'),
      path: '/notifications',
      Icon: Bell,
      matchPaths: ['/notifications'],
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      key: 'assistant',
      label: t('nav.ai_copilot', 'AI Copilot'),
      path: '/assistant',
      Icon: Bot,
      isCenter: true,
      matchPaths: ['/assistant'],
    },
    {
      key: 'settings',
      label: t('nav.settings', 'Settings'),
      path: '/settings',
      Icon: SettingsIcon,
      matchPaths: ['/settings', '/more', '/profile'],
    },
  ];

  // Farmer tabs (5 tabs with Camera icon for leaf scan)
  const farmerTabs = [
    {
      key: 'home',
      label: t('nav.home_short', 'Home'),
      path: '/dashboard',
      Icon: LayoutDashboard,
      matchPaths: ['/dashboard'],
    },
    {
      key: 'field',
      label: t('nav.field_short', 'Field'),
      path: '/farm',
      Icon: Activity,
      matchPaths: ['/farm', '/crop-advisory', '/history', '/analytics', '/market', '/farm-analytics', '/reports'],
    },
    {
      key: 'scan',
      label: t('nav.scan_short', 'Scan'),
      path: '/upload',
      Icon: Camera,
      isCenter: true,
      matchPaths: ['/upload', '/result'],
    },
    {
      key: 'alerts',
      label: t('nav.alerts_short', 'Alerts'),
      path: '/notifications',
      Icon: Bell,
      matchPaths: ['/notifications'],
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      key: 'more',
      label: t('nav.more_short', 'More'),
      path: '/more',
      Icon: SettingsIcon,
      matchPaths: ['/more', '/settings', '/profile', '/admin', '/devices', '/node-control', '/sdcard', '/assistant'],
    },
  ];

  const bottomTabs = isAdmin ? adminTabs : farmerTabs;

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none bg-white/95 dark:bg-[#070d19]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_30px_rgba(0,0,0,0.6)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {bottomTabs.map((tab) => {
          const { Icon } = tab;
          const isActive =
            tab.matchPaths?.some((p) =>
              p === currentPath || currentPath.startsWith(p + '/')
            ) ?? currentPath === tab.path;

          /* ── CENTER ACTION BUTTON (Camera for Farmer, Copilot for Admin) ── */
          if (tab.isCenter) {
            return (
              <Link
                key={tab.key}
                to={tab.path}
                aria-label={tab.label}
                className="flex-1 flex flex-col items-center justify-center py-1 group active:scale-95 transition-transform"
              >
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm
                  ${isActive
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/40 scale-105 ring-2 ring-emerald-400/40'
                    : 'bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-500'}
                `}>
                  <Icon className="w-5 h-5 drop-shadow-xs" />
                </div>
                <span className={`text-[10px] font-bold tracking-tight mt-0.5 ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.label}
                </span>
              </Link>
            );
          }

          /* ── BALANCED STANDARD TABS ── */
          return (
            <Link
              key={tab.key}
              to={tab.path}
              aria-label={tab.label}
              className={`
                flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all duration-150 active:scale-95
                ${isActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}
              `}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-400'}`} />
                {tab.badge != null && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] tracking-tight mt-1 leading-none ${
                isActive ? 'font-extrabold text-emerald-600 dark:text-emerald-400' : 'font-medium text-slate-500 dark:text-slate-400'
              }`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// 9. Footer Component
export const Footer = () => {
  const { t } = useTranslation();
  const location = useLocation();
  if (location.pathname === '/assistant') return null;

  return (
    <footer className="hidden md:block border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm py-6 mt-auto">
      <div className="mx-auto flex flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 max-w-7xl">
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 sm:text-left">
          &copy; {new Date().getFullYear()} AgriShield AI Platform. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          <span>Version 1.0.0</span>
          <span>•</span>
          <span>{t('nav.precision_engine', 'Precision Agriculture Engine')}</span>
        </div>
      </div>
    </footer>
  );
};

// Re-export primitive components for backwards compatibility across older files
export { 
  UIPrimitiveSkeleton as Skeleton,
  UIPrimitiveBadge as Badge,
  UIPrimitiveAlert as Alert,
  UIPrimitiveSpinner as Spinner
};
export * from './ui/index';

