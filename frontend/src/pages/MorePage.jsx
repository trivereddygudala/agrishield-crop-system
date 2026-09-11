import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useHardwareMode } from '../hooks/useHardwareMode';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Cpu,
  HardDrive,
  Radio,
  User,
  Settings,
  ShieldCheck,
  Sprout,
  BarChart2,
  FileText,
  ChevronRight,
  LogOut,
  Info,
  X,
  Leaf,
  TrendingUp,
  Bell,
  Globe,
  Ruler
} from 'lucide-react';
import LanguageSelectModal from '../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../data/languages';
import LogoutOverlay from '../components/animations/LogoutOverlay';

const SectionHeader = ({ title, first = false }) => (
  <p className={`text-[10.5px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 mb-2.5 ${first ? 'mt-0' : 'mt-6'}`}>
    {title}
  </p>
);

const MenuCard = ({ icon: Icon, label, description, path, iconColor, iconBg, accent, badge, onClick }) => (
  <button
    onClick={() => onClick ? onClick(path) : null}
    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border-l-4 ${accent} bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-xs active:scale-[0.98] active:shadow-none transition-all duration-150 text-left group cursor-pointer`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{label}</p>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug mt-0.5 line-clamp-1">{description}</p>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
  </button>
);

const MorePage = () => {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hardwareMode, setHardwareMode } = useHardwareMode();
  const isAdmin = user?.role === 'admin';
  const [aboutOpen, setAboutOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [showLogoutOverlay, setShowLogoutOverlay] = useState(false);

  const currentLang = getLanguageByCode(i18n.language);

  const FARMING_TOOLS = [
    { 
      icon: Sprout,    
      label: t('more.tools.farm.label', 'My Farm & Operations'), 
      description: t('more.tools.farm.desc', 'Farm sectors, soil types, and field boundaries'),  
      path: '/farm',          
      iconColor: 'text-emerald-600 dark:text-emerald-400', 
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800', 
      accent: 'border-l-emerald-500' 
    },
    { 
      icon: Ruler,    
      label: isTe ? 'పొలం విస్తీర్ణ కాలిక్యులేటర్' : 'Field Area Calculator', 
      description: isTe ? 'జీపీఎస్ వాక్ మోడ్ & మ్యాప్ ద్వారా ఖచ్చితమైన ఎకరాలు, గుంటలు, సెంట్లు కొలవండి' : 'GPS perimeter walk & map pin measuring for acres, cents & gunthas',  
      path: '/field-calculator',          
      iconColor: 'text-emerald-600 dark:text-emerald-400', 
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800', 
      accent: 'border-l-emerald-500',
      badge: isTe ? '1m ఖచ్చితత్వం' : '1m GPS'
    },
    { 
      icon: TrendingUp,
      label: t('more.tools.mandi.label', 'Live Mandi Prices'),    
      description: t('more.tools.mandi.desc', 'Today’s APMC rates, commodity arrivals & trends'), 
      path: '/market',        
      iconColor: 'text-amber-600 dark:text-amber-400',   
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',     
      accent: 'border-l-amber-500' 
    },
    { 
      icon: Leaf,      
      label: t('more.tools.advisory.label', 'Farming Tips & Advisory'), 
      description: t('more.tools.advisory.desc', 'Agronomy schedules, weather windows & spray alerts'), 
      path: '/crop-advisory', 
      iconColor: 'text-teal-600 dark:text-teal-400',   
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',       
      accent: 'border-l-teal-500' 
    },
    { 
      icon: Bot,       
      label: t('more.tools.assistant.label', 'AI Agronomist Chat'),   
      description: t('more.tools.assistant.desc', 'Voice & text consultation in Hindi, Telugu, Tamil'), 
      path: '/assistant',    
      iconColor: 'text-blue-600 dark:text-blue-400',     
      iconBg: 'bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800',         
      accent: 'border-l-blue-500' 
    },
    { 
      icon: BarChart2, 
      label: t('more.tools.analytics.label', 'Analytics & Insights'), 
      description: t('more.tools.analytics.desc', 'Telemetry charts, crop health index & forecasts'), 
      path: '/analytics',    
      iconColor: 'text-indigo-600 dark:text-indigo-400', 
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',   
      accent: 'border-l-indigo-500' 
    },
    { 
      icon: FileText,  
      label: t('more.tools.reports.label', 'Audit Reports'),        
      description: t('more.tools.reports.desc', 'Download PDF disease logs & telemetry reports'),   
      path: '/reports',      
      iconColor: 'text-purple-600 dark:text-purple-400', 
      iconBg: 'bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800', 
      accent: 'border-l-purple-500' 
    },
  ];

  const HARDWARE_TOOLS = [
    { 
      icon: Cpu,       
      label: t('more.tools.devices.label', 'Sensors & Devices'),    
      description: t('more.tools.devices.desc', 'View paired ESP32 nodes, battery & live stream'), 
      path: '/devices',      
      iconColor: 'text-cyan-600 dark:text-cyan-400',     
      iconBg: 'bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800',         
      accent: 'border-l-cyan-500' 
    },
    { 
      icon: Radio,     
      label: t('more.tools.node_control.label', 'Node Control Panel'),    
      description: t('more.tools.node_control.desc', 'Configure Wi-Fi, sensor calibration & deep sleep'), 
      path: '/node-control', 
      iconColor: 'text-sky-600 dark:text-sky-400',       
      iconBg: 'bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800',           
      accent: 'border-l-sky-500' 
    },
    { 
      icon: HardDrive, 
      label: t('more.tools.sdcard.label', 'MicroSD Storage'),       
      description: t('more.tools.sdcard.desc', 'Browse and download offline blackbox sensor logs'), 
      path: '/sdcard',       
      iconColor: 'text-slate-600 dark:text-slate-300',   
      iconBg: 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700',       
      accent: 'border-l-slate-400' 
    },
  ];

  const ACCOUNT_TOOLS = [
    { 
      icon: Globe,     
      label: t('more.tools.languages.label', 'Languages'), 
      description: t('more.tools.languages.desc', 'Change app language directly with 1-tap instant switch'),    
      path: '/languages', 
      onClick: () => setLanguageModalOpen(true),
      iconColor: 'text-teal-600 dark:text-teal-400', 
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800', 
      accent: 'border-l-teal-500',
      badge: currentLang.nativeName
    },
    { 
      icon: Bell,     
      label: t('more.tools.notifications.label', 'Notifications Inbox'), 
      description: t('more.tools.notifications.desc', 'Outbreak warnings, spray reminders & alerts'),    
      path: '/notifications', 
      iconColor: 'text-amber-600 dark:text-amber-400', 
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800', 
      accent: 'border-l-amber-500' 
    },
    { 
      icon: User,     
      label: t('more.tools.profile.label', 'My Profile'),          
      description: t('more.tools.profile.desc', 'Name, phone number, and farm location'), 
      path: '/profile',       
      iconColor: 'text-rose-600 dark:text-rose-400',   
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800',     
      accent: 'border-l-rose-500' 
    },
    { 
      icon: Settings, 
      label: t('more.tools.settings.label', 'System Settings'),     
      description: t('more.tools.settings.desc', 'Theme, display accessibility, and Hardware Mode switch'), 
      path: '/settings',      
      iconColor: 'text-emerald-600 dark:text-emerald-400', 
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800', 
      accent: 'border-l-emerald-500' 
    },
  ];

  const handleLogout = () => {
    // Show beautiful goodbye animation, then actually logout
    setShowLogoutOverlay(true);
  };

  const handleLogoutDone = async () => {
    setShowLogoutOverlay(false);
    await logout?.();
    window.location.href = '/login';
  };

  const ADMIN_COMMAND_TOOLS = [
    {
      icon: ShieldCheck,
      label: 'Admin Control Center',
      description: 'Manage users, system status, hardware & audit logs',
      path: '/admin',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500'
    },
    {
      icon: Radio,
      label: 'Global Broadcasts',
      description: 'Dispatch real-time emergency advisories to all farmers',
      path: '/admin?tab=broadcast',
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800',
      accent: 'border-l-rose-500'
    },
    {
      icon: FileText,
      label: 'Security Audit Logs',
      description: 'Review admin auth, diagnostic & access timestamps',
      path: '/admin?tab=logs',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800',
      accent: 'border-l-indigo-500'
    },
    {
      icon: Cpu,
      label: 'IoT Hardware Fleet',
      description: 'Inspect paired field nodes and telemetry health',
      path: '/admin?tab=iot',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800',
      accent: 'border-l-cyan-500'
    },
  ];

  const ADMIN_SYSTEM_TOOLS = [
    {
      icon: Globe,
      label: t('more.tools.languages.label', 'Languages'),
      description: t('more.tools.languages.desc', 'Change app language directly with 1-tap instant switch'),
      path: '/languages',
      onClick: () => setLanguageModalOpen(true),
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500',
      badge: currentLang.nativeName
    },
    {
      icon: Bell,
      label: 'Notifications Box',
      description: 'Review high-priority system alerts and broadcasts',
      path: '/notifications',
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800',
      accent: 'border-l-amber-500'
    },
    {
      icon: User,
      label: 'Admin Profile & Security',
      description: 'Admin username, email credentials & password reset',
      path: '/profile',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800',
      accent: 'border-l-emerald-500'
    },
    {
      icon: Settings,
      label: 'System Settings',
      description: 'Theme toggle, display accessibility & mode switches',
      path: '/settings',
      iconColor: 'text-teal-600 dark:text-teal-400',
      iconBg: 'bg-teal-100 dark:bg-teal-950/70 border border-teal-300 dark:border-teal-800',
      accent: 'border-l-teal-500'
    },
    {
      icon: Bot,
      label: 'AgriShield System Copilot',
      description: 'AI-assisted system diagnostics and query engine',
      path: '/assistant',
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800',
      accent: 'border-l-blue-500'
    },
  ];

  return (
    <>
      {/* Logout goodbye animation overlay */}
      {showLogoutOverlay && (
        <LogoutOverlay
          userName={user?.name || 'Farmer'}
          onDone={handleLogoutDone}
        />
      )}

      <div className="max-w-lg mx-auto w-full pb-28 animate-fade-in px-1 sm:px-0">
      {/* ─── CLEAN HEADER ─── */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isAdmin ? 'Settings & System Hub' : (isTe ? 'మరిన్ని సాధనాలు & సెట్టింగ్‌లు' : 'More Tools & Settings')}
          </h1>
        </div>
      </div>

      {/* ─── VISUAL SOFTWARE VS HARDWARE MODE SELECTOR ─── */}
      {!isAdmin && (
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {isTe ? "ఆపరేటింగ్ మోడ్" : "Operating Mode"}
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
              hardwareMode
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
            }`}>
              {hardwareMode ? "📡 Smart IoT Active" : "🌱 Software AI Active"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Mode 1: Software AI Mode */}
            <button
              type="button"
              onClick={() => setHardwareMode(false)}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                !hardwareMode
                  ? 'bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-white dark:to-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 opacity-65 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-xl shadow-xs">
                  🌱
                </div>
                {!hardwareMode && (
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {isTe ? "సాఫ్ట్‌వేర్ AI మోడ్" : "Software AI Mode"}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                  {isTe ? "మొబైల్ కెమెరా స్కాన్, వాతావరణం, మండి ధరలు" : "Camera scan, weather, satellite map & mandi rates"}
                </p>
              </div>
            </button>

            {/* Mode 2: Smart IoT Hardware Mode */}
            <button
              type="button"
              onClick={() => setHardwareMode(true)}
              className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                hardwareMode
                  ? 'bg-gradient-to-br from-cyan-500/15 via-sky-500/5 to-white dark:to-slate-900 border-cyan-500 ring-2 ring-cyan-500/30 shadow-md shadow-cyan-500/10'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 opacity-65 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800 flex items-center justify-center text-xl shadow-xs">
                  📡
                </div>
                {hardwareMode && (
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-xs font-black shadow-xs">
                    ✓
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  {isTe ? "స్మార్ట్ IoT హార్డ్‌వేర్" : "Smart IoT Hardware"}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-snug">
                  {isTe ? "ESP32 సెన్సార్ నోడ్స్, నేల ప్రోబ్స్ & మైక్రో-SD" : "ESP32 nodes, live telemetry & SD blackbox logs"}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {isAdmin ? (
        <>
          <SectionHeader title="🛡️ Admin Command Center" first />
          <div className="flex flex-col gap-2.5">
            {ADMIN_COMMAND_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={navigate} />)}
          </div>

          <SectionHeader title="⚙️ System & Preferences" />
          <div className="flex flex-col gap-2.5">
            {ADMIN_SYSTEM_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
          </div>
        </>
      ) : (
        <>
          <SectionHeader title={t('more.sections.farming', '🌾 Farming Tools')} first />
          <div className="flex flex-col gap-2.5">
            {FARMING_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
          </div>

          {hardwareMode && (
            <>
              <SectionHeader title={t('more.sections.hardware', '🔧 Hardware & Devices')} />
              <div className="flex flex-col gap-2.5">
                {HARDWARE_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
              </div>
            </>
          )}

          <SectionHeader title={t('more.sections.account', '👤 Account & Preferences')} />
          <div className="flex flex-col gap-2.5">
            {ACCOUNT_TOOLS.map((item) => <MenuCard key={item.path} {...item} onClick={item.onClick || navigate} />)}
          </div>
        </>
      )}

      {/* ── About Us ── */}
      <SectionHeader title={t('more.about_title', 'ℹ️ About AgriShield AI')} />
      <div className="flex flex-col gap-2.5">
        <MenuCard
          icon={Info}
          label={t('more.about_btn', 'About AgriShield')}
          description={t('more.about_desc', 'Learn about the system, technologies, and developers')}
          onClick={() => setAboutOpen(true)}
          iconColor="text-sky-600 dark:text-sky-400"
          iconBg="bg-sky-100 dark:bg-sky-900/50"
          accent="border-l-sky-500"
        />
      </div>

      {/* ── Log Out ── */}
      <button
        onClick={handleLogout}
        className="mt-8 w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-900/50 border-l-4 border-l-rose-500 text-rose-600 dark:text-rose-400 text-sm font-bold shadow-xs active:scale-[0.98] active:shadow-none transition-all duration-150"
      >
        <LogOut className="w-4 h-4" />
        {t('more.sign_out', 'Sign Out of AgriShield')}
      </button>

      {/* App version footer */}
      <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-6">
        AgriShield AI Platform · v1.0.0
      </p>

      {/* ── About Modal ── */}
      <AnimatePresence>
        {aboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/85 backdrop-blur-xs">
            <div className="fixed inset-0" onClick={() => setAboutOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 relative overflow-hidden z-10"
            >
              {/* Radial glow background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* Close Icon */}
              <button
                onClick={() => setAboutOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm shadow-emerald-600/10">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-50 tracking-tight">AgriShield AI</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Precision Agriculture Platform</p>
                </div>
              </div>

              {/* Modal Body */}
              <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  {t('more.about_desc', 'AgriShield is an intelligent crop disease detection and real-time telemetry mapping engine built to empower rural farmers.')}
                </p>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/80 space-y-2">
                  <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Core Technologies</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                    <li><strong className="text-slate-700 dark:text-slate-300">AI Diagnostics:</strong> INT8 Neural Networks with 98.4%+ crop pathology accuracy.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Hardware Mode:</strong> Optional ESP32 IoT micro-telemetry sensor network.</li>
                    <li><strong className="text-slate-700 dark:text-slate-300">Weather & Advisory:</strong> Live agro-meteorological forecasting & smart drip irrigation.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Smart Agriculture Digital Empowerment</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">Developed for farmers across India with multilingual support.</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>Version 1.0.0 (Release Build)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">© 2026 AgriShield</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ── Language Selection Modal ── */}
      <LanguageSelectModal 
        isOpen={languageModalOpen} 
        onClose={() => setLanguageModalOpen(false)} 
      />
    </div>
    </>
  );
};

export default MorePage;
