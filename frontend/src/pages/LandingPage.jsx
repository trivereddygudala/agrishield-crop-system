import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { 
  Leaf, Activity, ChevronRight, CheckCircle2, Globe, 
  Cpu, Sprout, Bot, ScanLine, Sparkles, Zap, ArrowUpRight,
  Star, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import DemoModal from '../components/DemoModal';

/* ─── Animated Counter ──────────────────────────────────── */
const AnimatedCounter = ({ to, suffix = '', duration = 2 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); return; }
      setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, to, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

/* ─── Floating Orb ──────────────────────────────────── */
const FloatingOrb = ({ className }) => (
  <div className={`absolute rounded-full blur-3xl pointer-events-none select-none ${className}`} />
);

/* ─── Feature Card ──────────────────────────────────── */
const FeatureCard = ({ icon: Icon, badge, title, description, color, index, onClick }) => (
  <motion.div
    onClick={onClick}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    whileHover={{ y: -6, transition: { duration: 0.2 } }}
    className="group relative rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-6 flex flex-col gap-5 hover:border-emerald-500/40 hover:bg-white/10 transition-all duration-300 cursor-pointer overflow-hidden h-full"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 group-hover:from-emerald-500/8 to-transparent transition-all duration-500 rounded-2xl pointer-events-none" />
    <div className="flex items-start justify-between relative z-10">
      <div className={`p-3 rounded-xl ${color} ring-1 ring-white/10`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/50 border border-white/10 tracking-wide">
        {badge}
      </span>
    </div>
    <div className="space-y-2 relative z-10 flex-1">
      <h3 className="font-bold text-white text-base leading-snug group-hover:text-emerald-300 transition-colors duration-200">
        {title}
      </h3>
      <p className="text-white/45 text-sm leading-relaxed">{description}</p>
    </div>
    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors relative z-10 mt-auto">
      <span>Preview Demo</span>
      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
    </div>
  </motion.div>
);

/* ─── Main Component ──────────────────────────────────── */
const LandingPage = () => {
  const { user, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoTab, setDemoTab] = useState(0);

  const openDemo = (tabIndex) => { setDemoTab(tabIndex); setDemoOpen(true); };

  useEffect(() => {
    if (user && !loading) {
      navigate(user.role?.toLowerCase() === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLanguageChange = (e) => i18n.changeLanguage(e.target.value);

  const stats = [
    { label: 'Disease Classes', value: 1200, suffix: '+' },
    { label: 'AI Accuracy', value: 98, suffix: '%' },
    { label: 'Active Farmers', value: 5000, suffix: '+' },
    { label: 'Scans Done', value: 50000, suffix: '+' },
  ];

  const features = [
    {
      icon: ScanLine, badge: 'AI Scan Center', route: '/upload',
      color: 'bg-emerald-500/20 text-emerald-300',
      title: t('landing.feat1_title', 'Real-Time AI Disease Diagnosis'),
      description: t('landing.feat1_desc', 'Upload crop leaf photos to detect 1,200+ plant species and pathogens instantly using PyTorch EfficientNetV2 neural networks with Grad-CAM heatmaps.'),
    },
    {
      icon: Sprout, badge: 'My Farm', route: '/farm',
      color: 'bg-sky-500/20 text-sky-300',
      title: t('landing.feat2_title', 'Agronomic Sector & Crop Lifecycle'),
      description: t('landing.feat2_desc', 'Manage land sectors, active crop growth stages from Germination to Harvest, irrigation types, and 1-click GPS auto-coordinates.'),
    },
    {
      icon: Cpu, badge: 'ESP32 IoT', route: '/devices',
      color: 'bg-amber-500/20 text-amber-300',
      title: t('landing.feat3_title', 'Real-Time Sensor Hardware Sync'),
      description: t('landing.feat3_desc', 'Stream live field metrics (Air Temp, Humidity, Soil Moisture, Rain, Sunlight) directly from paired ESP32 field transceiver nodes.'),
    },
    {
      icon: Bot, badge: 'AI Agronomist', route: '/assistant',
      color: 'bg-purple-500/20 text-purple-300',
      title: t('landing.feat4_title', 'Multilingual Smart Chat Advisor'),
      description: t('landing.feat4_desc', 'Get 24/7 personalized advice on soil NPK nutrients, organic bio-pesticide treatments, and spray schedules in your preferred language.'),
    },
  ];

  const langOptions = [
    { value: 'en', label: 'English (US)' }, { value: 'hi', label: 'हिन्दी' },
    { value: 'te', label: 'తెలుగు' }, { value: 'ta', label: 'தமிழ்' },
    { value: 'mr', label: 'मराठी' }, { value: 'ml', label: 'മലയാളം' },
    { value: 'kn', label: 'ಕನ್ನಡ' }, { value: 'bn', label: 'বাংলা' },
    { value: 'gu', label: 'ગુજરાતી' }, { value: 'pa', label: 'ਪੰਜਾਬੀ' },
  ];

  return (
    <main className="relative min-h-screen bg-[#060a10] text-white overflow-x-hidden" style={{ fontFamily: 'var(--font-sans)' }}>

      {/* ── Background orbs ─────────────────── */}
      <FloatingOrb className="w-[600px] h-[600px] bg-emerald-600/15 top-[-180px] right-[-120px]" />
      <FloatingOrb className="w-[500px] h-[500px] bg-sky-600/10 top-[35%] left-[-200px]" />
      <FloatingOrb className="w-[350px] h-[350px] bg-violet-600/8 bottom-[15%] right-[5%]" />
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      {/* ── Navbar ──────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060a10]/90 backdrop-blur-2xl border-b border-white/5 shadow-xl shadow-black/30' : ''}`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Agri<span className="text-emerald-400">Shield</span> <span className="text-white/30 font-normal text-sm">AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Technology'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-white/50 hover:text-white transition-colors duration-200 font-medium">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
              <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <select value={i18n.language} onChange={handleLanguageChange} aria-label="Select Language"
                className="bg-transparent text-xs font-semibold text-white/60 focus:outline-none cursor-pointer appearance-none">
                {langOptions.map(o => <option key={o.value} value={o.value} className="bg-[#0d1117] text-white">{o.label}</option>)}
              </select>
            </div>
            {user ? (
              <Link to="/dashboard">
                <button className="text-sm font-bold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-all duration-200 shadow-lg shadow-emerald-500/25">Dashboard</button>
              </Link>
            ) : (
              <>
                <Link to="/login"><button className="text-sm font-semibold px-4 py-2 text-white/60 hover:text-white transition-colors duration-200">Sign In</button></Link>
                <Link to="/register"><button className="text-sm font-bold px-5 py-2 rounded-lg bg-white text-[#060a10] hover:bg-emerald-50 transition-all duration-200 shadow-lg">Get Started</button></Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#060a10]/98 backdrop-blur-2xl border-b border-white/5">
              <div className="px-4 py-5 space-y-2">
                {['Features', 'Technology'].map(item => (
                  <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                    className="block text-sm font-medium text-white/50 hover:text-white py-2.5 border-b border-white/5">
                    {item}
                  </a>
                ))}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-2.5 rounded-lg w-full mt-2">
                  <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <select value={i18n.language} onChange={handleLanguageChange}
                    className="bg-transparent text-xs font-semibold text-white/60 focus:outline-none cursor-pointer w-full">
                    {langOptions.map(o => <option key={o.value} value={o.value} className="bg-[#0d1117] text-white">{o.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2 pt-3">
                  {user ? (
                    <Link to="/dashboard"><button className="w-full text-sm font-bold py-3.5 rounded-xl bg-emerald-500 text-white">Dashboard</button></Link>
                  ) : (
                    <>
                      <Link to="/register"><button className="w-full text-sm font-bold py-3.5 rounded-xl bg-white text-[#060a10]">Get Started Free</button></Link>
                      <Link to="/login"><button className="w-full text-sm font-bold py-3.5 rounded-xl bg-white/8 border border-white/10 text-white">Sign In</button></Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ──────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center pt-16 px-4 sm:px-6 min-h-screen">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20 py-20 lg:py-28">

            {/* Left */}
            <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl mx-auto lg:mx-0">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs sm:text-sm font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {t('landing.tagline', 'Empowering Agriculture with PyTorch AI & ESP32 IoT')}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
                <h1 className="font-extrabold text-white text-4xl sm:text-6xl lg:text-7xl leading-[1.07] tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {t('landing.headline_1', 'Protect Your')}<br />
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
                    {t('landing.headline_2_alt', 'Crops with AI.')}
                  </span>
                </h1>
              </motion.div>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
                className="text-white/45 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                {t('landing.subheadline', 'Upload leaf photos to identify crop diseases instantly. Monitor real-time ESP32 soil & weather telemetry. Receive personalized agronomic guidance in your language.')}
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                {user ? (
                  <Link to="/dashboard">
                    <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all duration-200 shadow-2xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]">
                      {t('landing.go_dashboard', 'Go to Dashboard')}
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link to="/register">
                      <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all duration-200 shadow-2xl shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]">
                        {t('landing.get_started', 'Get Started Free')}
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </Link>
                    <Link to="/login">
                      <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
                        {t('landing.sign_in', 'Sign In Account')}
                      </button>
                    </Link>
                  </>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.45 }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-white/35 font-medium">
                {[
                  { label: t('landing.classes', '1,200+ Disease Classes') },
                  { label: t('landing.ai', 'PyTorch EfficientNetV2-S') },
                  { label: t('landing.iot', 'ESP32 Live Telemetry') },
                ].map(({ label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {label}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right: Hero Mockup */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex-1 w-full max-w-[360px] sm:max-w-md mx-auto lg:mx-0 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-sky-500/15 rounded-3xl blur-3xl scale-95 -z-10" />
              <div className="relative rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-2xl p-5 shadow-2xl space-y-4">
                {/* Card header */}
                <div className="flex items-center justify-between border-b border-white/6 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/12 border border-emerald-500/20">
                      <Activity className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{t('landing.scan_active', 'AI Scan Center & Telemetry')}</p>
                      <p className="text-[11px] text-white/35 flex items-center gap-1.5 mt-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        {t('landing.scanning_active', 'Live Diagnostic Scanning')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {t('landing.accuracy', '98.4% Acc.')}
                  </span>
                </div>

                {/* Diagnosis Preview */}
                <div className="relative rounded-2xl bg-[#080d14] border border-white/5 overflow-hidden p-4 space-y-3" style={{ minHeight: 170 }}>
                  <motion.div
                    animate={{ top: ['5%', '88%', '5%'] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none z-20"
                  />
                  <div className="flex items-center justify-between flex-wrap gap-2 z-10 relative">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-xs font-bold text-white/75">
                      <Leaf className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Tomato Sector A</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/12 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                      {t('landing.diseased_detected', 'Disease Detected')}
                    </span>
                  </div>
                  <div className="z-10 relative space-y-1">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{t('landing.pathology_result', 'AI Pathology Result')}</p>
                    <h3 className="text-xl font-extrabold text-white leading-tight">Tomato — Leaf Mold</h3>
                    <p className="text-xs text-emerald-400 flex items-start gap-1.5 pt-0.5 leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {t('landing.organic_treatment', 'Copper Bio-Fungicide (Bordeaux 1%)')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/25 z-10 relative pt-1 border-t border-white/5">
                    <span>PyTorch EfficientNetV2</span>
                    <span className="text-emerald-400 font-bold">Confidence: 97.4%</span>
                  </div>
                </div>

                {/* Metric tiles */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t('landing.healthy_ratio', 'Healthy Crop Ratio'), value: '84%', cls: 'bg-emerald-500/6 border-emerald-500/15 text-emerald-400' },
                    { label: t('landing.avg_confidence', 'Avg AI Confidence'), value: '94.8%', cls: 'bg-sky-500/6 border-sky-500/15 text-sky-400' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`p-3 rounded-xl border text-center ${cls}`}>
                      <p className="text-[10px] font-semibold opacity-70 leading-tight mb-1">{label}</p>
                      <p className="text-xl font-extrabold">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Sensor row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[['🌡', '28°C', 'Temp'], ['💧', '72%', 'Humidity'], ['🌱', '43%', 'Soil'], ['☀️', '82kLux', 'Light']].map(([icon, val, label]) => (
                    <div key={label} className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-center min-w-[58px]">
                      <span className="text-sm">{icon}</span>
                      <span className="text-[11px] font-bold text-white/65">{val}</span>
                      <span className="text-[9px] text-white/25 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Stats Bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55 }}
          className="w-full border-t border-white/5 bg-white/[0.015]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/5">
            {stats.map(({ label, value, suffix }) => (
              <div key={label} className="text-center px-4 sm:px-6 first:pl-0 last:pr-0 space-y-1">
                <p className="text-2xl sm:text-3xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  <AnimatedCounter to={value} suffix={suffix} />
                </p>
                <p className="text-xs text-white/35 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features ──────────────────────────── */}
      <section id="features" className="relative py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-14">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/40 tracking-widest mb-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> PLATFORM MODULES
            </div>
            <h2 className="font-extrabold text-white text-3xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.precision_title', 'Built for Precision')}<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Smart Agriculture</span>
            </h2>
            <p className="text-white/35 text-sm sm:text-base leading-relaxed">
              {t('landing.precision_desc', 'Comprehensive agronomic tooling combining high-accuracy AI diagnostics, ESP32 telemetry, and personal advisory.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feat, idx) => (
              <div key={idx} className="block h-full">
                <FeatureCard {...feat} index={idx} onClick={() => openDemo(idx)} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technology Strip ──────────────────────────── */}
      <section id="technology" className="relative py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/8 via-white/[0.02] to-sky-500/8 border border-white/8 p-8 sm:p-12">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/40 tracking-widest">
                  <Zap className="h-3.5 w-3.5 text-amber-400" /> TECHNOLOGY STACK
                </div>
                <h2 className="font-extrabold text-white text-3xl sm:text-4xl leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Enterprise-Grade AI<br />
                  <span className="text-emerald-400">for the Farm</span>
                </h2>
                <p className="text-white/35 text-sm sm:text-base leading-relaxed max-w-md">
                  Powered by state-of-the-art deep learning, real-time ESP32 hardware integration, and cloud-synced intelligence — built to scale.
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'PyTorch EfficientNetV2-S neural network', icon: '🧠', cls: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
                    { label: 'ESP32 multi-node sensor telemetry', icon: '📡', cls: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
                    { label: 'NVIDIA NIM LLM multilingual advisory', icon: '💬', cls: 'bg-sky-500/10 border-sky-500/20 text-sky-300' },
                    { label: 'Grad-CAM visual explainability heatmaps', icon: '🔥', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
                  ].map(({ label, icon, cls }, i) => (
                    <motion.div key={label} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${cls}`}>
                      <span className="text-base shrink-0">{icon}</span>
                      <span>{label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ESP32 node preview */}
              <div className="flex-1 w-full max-w-sm mx-auto lg:mx-0">
                <div className="rounded-2xl bg-[#060a10]/80 border border-white/8 p-4 space-y-3 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/50">ESP32 Field Nodes</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">LIVE</span>
                  </div>
                  {[
                    { name: 'Node Alpha', temp: '31.2°C', hum: '68%', soil: '41%', on: true },
                    { name: 'Node Beta', temp: '29.8°C', hum: '74%', soil: '55%', on: true },
                    { name: 'Node Gamma', temp: '—', hum: '—', soil: '—', on: false },
                  ].map((node) => (
                    <div key={node.name} className={`flex items-center justify-between p-3 rounded-xl border ${node.on ? 'bg-white/[0.03] border-white/8' : 'bg-white/[0.01] border-white/4 opacity-35'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${node.on ? 'bg-emerald-400' : 'bg-white/15'} shrink-0`} />
                        <span className="text-xs font-bold text-white/75">{node.name}</span>
                      </div>
                      {node.on && (
                        <div className="flex gap-3 text-[11px] text-white/35 font-medium">
                          <span>🌡 {node.temp}</span>
                          <span>💧 {node.hum}</span>
                          <span>🌱 {node.soil}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="space-y-1.5 mt-1">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div animate={{ width: ['0%', '73%'] }} transition={{ duration: 2, delay: 0.5, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/25 font-medium">
                      <span>System health</span>
                      <span className="text-emerald-400 font-bold">73% optimal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────── */}
      <section className="relative py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 mb-6 tracking-widest">
              <Star className="h-3.5 w-3.5" /> FREE FOR FARMERS
            </div>
            <h2 className="font-extrabold text-white text-4xl sm:text-6xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Start Protecting<br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
                Your Harvest Today
              </span>
            </h2>
            <p className="text-white/35 text-base sm:text-lg leading-relaxed mt-5 max-w-xl mx-auto">
              Join thousands of farmers using AI-powered diagnostics and real-time sensor monitoring to protect their crops across India.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <Link to="/dashboard">
                <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all duration-200 shadow-2xl shadow-emerald-500/25 hover:scale-[1.02]">
                  Go to Dashboard <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all duration-200 shadow-2xl shadow-emerald-500/25 hover:scale-[1.02]">
                    Create Free Account <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
                <Link to="/login">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm font-bold transition-all duration-200 hover:scale-[1.02]">
                    Sign In
                  </button>
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Leaf className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white/40" style={{ fontFamily: 'var(--font-display)' }}>AgriShield AI</span>
          </div>
          <p className="text-xs text-white/20 text-center">
            © 2026 AgriShield AI & IoT Crop Health Intelligence Platform. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-white/25 font-medium">
            <span className="hover:text-white/50 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-white/50 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-white/50 cursor-pointer transition-colors">Support</span>
          </div>
        </div>
      </footer>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} initialTab={demoTab} />
    </main>
  );
};

export default LandingPage;

