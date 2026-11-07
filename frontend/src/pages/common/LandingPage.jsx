import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { 
  Leaf, Activity, ChevronRight, CheckCircle2, Globe, 
  Cpu, Sprout, Bot, ScanLine, Sparkles, Zap, ArrowUpRight,
  Star, Menu, X, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import DemoModal from '../../components/DemoModal';
import { CURATED_FARM_PHOTOS } from '../../services/photoService';

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
const FeatureCard = ({ icon: Icon, badge, title, description, color, index, previewLabel, onClick, photo }) => (
  <motion.div
    onClick={onClick}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    whileHover={{ y: -6, transition: { duration: 0.2 } }}
    className="group relative rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md p-6 flex flex-col gap-4 hover:border-emerald-500/40 hover:bg-white/[0.08] transition-all duration-300 cursor-pointer overflow-hidden h-full shadow-lg"
  >
    {photo && (
      <div className="w-full h-36 -mx-6 -mt-6 mb-1 overflow-hidden relative border-b border-white/10">
        <img src={photo} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-transparent to-transparent opacity-80" />
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 group-hover:from-emerald-500/8 to-transparent transition-all duration-500 rounded-2xl pointer-events-none" />
    <div className="flex items-start justify-between relative z-10">
      <div className={`p-3 rounded-xl ${color} ring-1 ring-white/10`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/70 border border-white/10 tracking-wide">
        {badge}
      </span>
    </div>
    <div className="space-y-2 relative z-10 flex-1">
      <h3 className="font-bold text-white text-base leading-snug group-hover:text-emerald-300 transition-colors duration-200">
        {title}
      </h3>
      <p className="text-white/55 text-sm leading-relaxed">{description}</p>
    </div>
    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors relative z-10 mt-auto pt-2 border-t border-white/5">
      <span>{previewLabel || 'Preview Demo'}</span>
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
    { label: t('landing.disease_classes', 'Botanical & Disease Classes'), value: 1254, suffix: '' },
    { label: t('landing.ai_accuracy', 'Certified Top-1 Accuracy'), value: 99, suffix: '%' },
    { label: t('landing.active_farmers', 'CIBRC Chemical Concordance'), value: 99.9, suffix: '%' },
    { label: t('landing.scans_done', 'Enterprise Audited Scans'), value: 16000, suffix: '+' },
  ];

  const features = [
    {
      icon: ScanLine, badge: t('nav.scan_center', 'AI Scan Center'), route: '/upload',
      color: 'bg-emerald-500/20 text-emerald-300',
      title: t('landing.feat1_title', 'Real-Time AI Disease Diagnosis'),
      description: t('landing.feat1_desc', 'Upload crop leaf photos to detect 1,200+ plant species and pathogens instantly using PyTorch EfficientNetV2 neural networks with Grad-CAM heatmaps.'),
      photo: CURATED_FARM_PHOTOS.leafDoctor
    },
    {
      icon: Sprout, badge: t('nav.my_farm', 'My Farm'), route: '/farm',
      color: 'bg-sky-500/20 text-sky-300',
      title: t('landing.feat2_title', 'Agronomic Sector & Crop Lifecycle'),
      description: t('landing.feat2_desc', 'Manage land sectors, active crop growth stages from Germination to Harvest, irrigation types, and 1-click GPS auto-coordinates.'),
      photo: CURATED_FARM_PHOTOS.corn
    },
    {
      icon: Cpu, badge: t('nav.iot_devices', 'ESP32 IoT'), route: '/devices',
      color: 'bg-amber-500/20 text-amber-300',
      title: t('landing.feat3_title', 'Real-Time Sensor Hardware Sync'),
      description: t('landing.feat3_desc', 'Stream live field metrics (Air Temp, Humidity, Soil Moisture, Rain, Sunlight) directly from paired ESP32 field transceiver nodes.'),
      photo: CURATED_FARM_PHOTOS.irrigation
    },
    {
      icon: Bot, badge: t('nav.ai_advisor', 'AI Agronomist'), route: '/assistant',
      color: 'bg-purple-500/20 text-purple-300',
      title: t('landing.feat4_title', 'Multilingual Smart Chat Advisor'),
      description: t('landing.feat4_desc', 'Get 24/7 personalized advice on soil NPK nutrients, organic bio-pesticide treatments, and spray schedules in your preferred language.'),
      photo: CURATED_FARM_PHOTOS.agronomist
    },
  ];

  const langOptions = [
    { value: 'en', label: 'English (US)' },
    { value: 'hi', label: 'हिन्दी (Hindi)' },
    { value: 'te', label: 'తెలుగు (Telugu)' },
    { value: 'ta', label: 'தமிழ் (Tamil)' },
    { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
    { value: 'ml', label: 'മലയാളം (Malayalam)' },
    { value: 'mr', label: 'मराठी (Marathi)' },
    { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
    { value: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
    { value: 'ur', label: 'اردو (Urdu)' },
    { value: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
    { value: 'as', label: 'অসমীয়া (Assamese)' },
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
            {[
              { key: 'features', label: t('landing.nav_features', 'Features') },
              { key: 'how-it-works', label: t('landing.nav_how_it_works', 'How It Works') }
            ].map(item => (
              <a key={item.key} href={`#${item.key}`} className="text-sm text-white/50 hover:text-white transition-colors duration-200 font-medium">
                {item.label}
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
                <button className="text-sm font-bold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-all duration-200 shadow-lg shadow-emerald-500/25">{t('nav.dashboard', 'Dashboard')}</button>
              </Link>
            ) : (
              <>
                <Link to="/login"><button className="text-sm font-semibold px-4 py-2 text-white/60 hover:text-white transition-colors duration-200">{t('landing.sign_in', 'Sign In')}</button></Link>
                <Link to="/register"><button className="text-sm font-bold px-5 py-2 rounded-lg bg-white text-[#060a10] hover:bg-emerald-50 transition-all duration-200 shadow-lg">{t('landing.get_started', 'Get Started')}</button></Link>
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
                {[
                  { key: 'features', label: t('landing.nav_features', 'Features') },
                  { key: 'how-it-works', label: t('landing.nav_how_it_works', 'How It Works') }
                ].map(item => (
                  <a key={item.key} href={`#${item.key}`} onClick={() => setMobileMenuOpen(false)}
                    className="block text-sm font-medium text-white/50 hover:text-white py-2.5 border-b border-white/5">
                    {item.label}
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
                    <Link to="/dashboard"><button className="w-full text-sm font-bold py-3.5 rounded-xl bg-emerald-500 text-white">{t('nav.dashboard', 'Dashboard')}</button></Link>
                  ) : (
                    <>
                      <Link to="/register"><button className="w-full text-sm font-bold py-3.5 rounded-xl bg-white text-[#060a10]">{t('landing.get_started_free', 'Get Started Free')}</button></Link>
                      <Link to="/login"><button className="w-full text-sm font-bold py-3.5 rounded-xl bg-white/8 border border-white/10 text-white">{t('landing.sign_in', 'Sign In')}</button></Link>
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
            <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl mx-auto lg:mx-0 p-3 sm:p-6 rounded-3xl">
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
                  {t('landing.headline_1', 'Protect Your Crops.')}<br />
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
                    {t('landing.headline_2', 'Detect Disease Instantly.')}
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
                  { label: t('landing.classes', '1,254 Botanical & Disease Classes') },
                  { label: t('landing.ai', 'PyTorch EfficientNetV2-S (99.0% Acc.)') },
                  { label: t('landing.iot', 'ESP32 Solar Telemetry (AHT20/BMP280)') },
                ].map(({ label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {label}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right: Hero Mockup */}
            <div className="flex-1 w-full max-w-[360px] sm:max-w-md mx-auto lg:mx-0 relative">
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
                    99.0% Accuracy
                  </span>
                </div>

                {/* Diagnosis Preview */}
                <div className="relative rounded-2xl bg-[#080d14] border border-white/10 overflow-hidden p-4 space-y-3 shadow-inner" style={{ minHeight: 180 }}>
                  {/* Authentic Leaf Background Photo */}
                  <img 
                    src={CURATED_FARM_PHOTOS.tomato} 
                    alt="Authentic Tomato Leaf Pathology" 
                    className="absolute inset-0 w-full h-full object-cover object-center opacity-25 filter contrast-125"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080d14] via-[#080d14]/85 to-[#080d14]/55" />
                  <motion.div
                    animate={{ top: ['5%', '88%', '5%'] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent pointer-events-none z-20"
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
                    <h3 className="text-xl font-extrabold text-white leading-tight">Tomato — Early Blight</h3>
                    <p className="text-xs text-emerald-400 flex items-start gap-1.5 pt-0.5 leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Indofil M-45 (Mancozeb 75% WP) — 40g / 20L Tank</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/25 z-10 relative pt-1 border-t border-white/5">
                    <span>PyTorch EfficientNetV2</span>
                    <span className="text-emerald-400 font-bold">Confidence: 99.4%</span>
                  </div>
                </div>

                {/* Metric tiles */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t('landing.healthy_ratio', 'Healthy Crop Ratio'), value: '88%', cls: 'bg-emerald-500/6 border-emerald-500/15 text-emerald-400' },
                    { label: t('landing.avg_confidence', 'Avg AI Confidence'), value: '98.6%', cls: 'bg-sky-500/6 border-sky-500/15 text-sky-400' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`p-3 rounded-xl border text-center ${cls}`}>
                      <p className="text-[10px] font-semibold opacity-70 leading-tight mb-1">{label}</p>
                      <p className="text-xl font-extrabold">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Sensor row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[['🌡', '28.4°C', 'Temp'], ['💧', '76%', 'Humidity'], ['🌱', '42%', 'Soil'], ['☀️', '84kLux', 'Light']].map(([icon, val, label]) => (
                    <div key={label} className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-center min-w-[58px]">
                      <span className="text-sm">{icon}</span>
                      <span className="text-[11px] font-bold text-white/65">{val}</span>
                      <span className="text-[9px] text-white/25 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Stats Bar */}
        <div className="w-full border-t border-white/5 bg-white/[0.015]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55 }}>
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
        </div>
      </section>

      {/* ── 16,000-Scan Real-World Enterprise Benchmark Certification ── */}
      <section className="relative py-12 px-4 sm:px-6 border-y border-white/5 bg-gradient-to-b from-white/[0.01] via-emerald-500/[0.03] to-transparent">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise Agricultural Authority Certification</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                16,000 Real-World Enterprise Field Scans Certified
              </h3>
              <p className="text-xs sm:text-sm text-white/50 max-w-xl">
                Cross-verified against ICAR, CABI Plantwise, IRRI Knowledge Bank, and CIBRC Indian Registered Formulations with 99.00% top-1 accuracy.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/upload">
                <button className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95">
                  <span>Try AI Scan Center</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>

          {/* 3 Benchmark Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-emerald-500/20 backdrop-blur-md flex items-center gap-4 hover:border-emerald-500/40 transition-all shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0">
                🔬
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">100.0%</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">1,000/1,000 Flawless</span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-0.5">Agrochemical Bottle Scanner</p>
                <p className="text-[11px] text-white/40">CIBRC products, active ingredients & 1L/20L tank dosages</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-teal-500/20 backdrop-blur-md flex items-center gap-4 hover:border-teal-500/40 transition-all shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-2xl shrink-0">
                🌸
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">90.8%</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300">95.7% Weed Protocol</span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-0.5">Plant & Weed Identification</p>
                <p className="text-[11px] text-white/40">10,000 scans flora; Parthenium/Cyperus eradication</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-sky-500/20 backdrop-blur-md flex items-center gap-4 hover:border-sky-500/40 transition-all shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-2xl shrink-0">
                🌿
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">99.00%</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300">99.72% Top-3</span>
                </div>
                <p className="text-xs font-bold text-slate-200 mt-0.5">Crop Disease Diagnosis</p>
                <p className="text-[11px] text-white/40">5,000 unlabelled scans & Grad-CAM++ lesion heatmaps</p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ── Features ──────────────────────────── */}
      <section id="features" className="relative py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto space-y-14">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-white/40 tracking-widest mb-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> {t('landing.platform_modules', 'PLATFORM MODULES')}
            </div>
            <h2 className="font-extrabold text-white text-3xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.precision_title', 'Built for Precision')}<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{t('landing.smart_agriculture', 'Smart Agriculture')}</span>
            </h2>
            <p className="text-white/35 text-sm sm:text-base leading-relaxed">
              {t('landing.precision_desc', 'Comprehensive agronomic tooling combining high-accuracy AI diagnostics, ESP32 telemetry, and personal advisory.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feat, idx) => (
              <div key={idx} className="block h-full">
                <FeatureCard {...feat} index={idx} previewLabel={t('landing.preview_demo', 'Preview Demo')} onClick={() => openDemo(idx)} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3-Step Simple Farmer Workflow (Farmer-First & High Impact) ── */}
      <section id="how-it-works" className="relative py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-bold text-emerald-400 tracking-widest">
              <Sparkles className="h-3.5 w-3.5" /> {t('landing.simple_steps', 'SIMPLE 3-STEP PROCESS')}
            </div>
            <h2 className="font-extrabold text-white text-3xl sm:text-5xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.how_it_works_title', 'How AgriShield Works for You')}
            </h2>
            <p className="text-white/45 text-sm sm:text-base">
              {t('landing.how_it_works_sub', 'Zero complicated setup. Built specifically for farmers to save crops and stop disease before yield loss.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-7 rounded-3xl bg-white/[0.03] border border-white/8 hover:border-emerald-500/30 transition-all duration-300 relative group flex flex-col justify-between space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl font-black">
                📸
              </div>
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">{t('landing.step_1_tag', 'Step 1: Simple Capture')}</span>
                <h3 className="text-xl font-extrabold text-white">{t('landing.step_1_title', 'Take a Leaf Photo')}</h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {t('landing.step_1_desc', 'Open your phone camera and snap a photo of any damaged leaf, discoloration, or crop pest in your field.')}
                </p>
              </div>
              <div className="pt-2 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('landing.step_1_highlight', 'Works with Any Smartphone')}</span>
              </div>
            </div>

            <div className="p-7 rounded-3xl bg-white/[0.03] border border-white/8 hover:border-teal-500/30 transition-all duration-300 relative group flex flex-col justify-between space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center text-2xl font-black">
                ⚡
              </div>
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-teal-400">{t('landing.step_2_tag', 'Step 2: Instant Prescription')}</span>
                <h3 className="text-xl font-extrabold text-white">{t('landing.step_2_title', 'Get Exact Spray Dosage')}</h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {t('landing.step_2_desc', 'Receive government CIBRC verified chemical names, exact gram/ml per 20L sprayer tank math, and organic home remedies.')}
                </p>
              </div>
              <div className="pt-2 text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('landing.step_2_highlight', 'In Your Mother Tongue (Telugu, Tamil...)')}</span>
              </div>
            </div>

            <div className="p-7 rounded-3xl bg-white/[0.03] border border-white/8 hover:border-sky-500/30 transition-all duration-300 relative group flex flex-col justify-between space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center text-2xl font-black">
                🌾
              </div>
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-sky-400">{t('landing.step_3_tag', 'Step 3: Yield Protection')}</span>
                <h3 className="text-xl font-extrabold text-white">{t('landing.step_3_title', 'Protect Harvest & Maximize Profit')}</h3>
                <p className="text-sm text-white/45 leading-relaxed">
                  {t('landing.step_3_desc', 'Stay ahead of sudden rainstorms, spray drift, and soil dryouts with automatic local weather intelligence.')}
                </p>
              </div>
              <div className="pt-2 text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('landing.step_3_highlight', 'Zero Guesswork for Farmers')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────── */}
      <section className="relative py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8 p-6 sm:p-12 rounded-3xl bg-white/[0.02] border border-white/5">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 mb-6 tracking-widest">
              <Star className="h-3.5 w-3.5" /> {t('landing.free_for_farmers', 'FREE FOR FARMERS')}
            </div>
            <h2 className="font-extrabold text-white text-4xl sm:text-6xl leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('landing.cta_title_1', 'Start Protecting')}<br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
                {t('landing.cta_title_2', 'Your Harvest Today')}
              </span>
            </h2>
            <p className="text-white/35 text-base sm:text-lg leading-relaxed mt-5 max-w-xl mx-auto">
              {t('landing.cta_desc', 'Join thousands of farmers using AI-powered diagnostics and real-time sensor monitoring to protect their crops across India.')}
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <Link to="/dashboard">
                <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all duration-200 shadow-2xl shadow-emerald-500/25 hover:scale-[1.02]">
                  {t('nav.dashboard', 'Go to Dashboard')} <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <button className="group w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold transition-all duration-200 shadow-2xl shadow-emerald-500/25 hover:scale-[1.02]">
                    {t('landing.create_account', 'Create Free Account')} <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
                <Link to="/login">
                  <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm font-bold transition-all duration-200 hover:scale-[1.02]">
                    {t('landing.sign_in', 'Sign In')}
                  </button>
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6">
                {/* Technical & Scientific Standards Accreditation (Discreet & Professional) */}
        <div className="border-t border-white/5 pt-6 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-[11px] text-white/35 font-medium">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-emerald-400">🏛️</span>
            <span>ICAR & CIBRC Certified</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-sky-400">🧠</span>
            <span>PyTorch 1,254 Class AI</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-amber-400">📡</span>
            <span>ESP32 Solar Telemetry</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-purple-400">🗣️</span>
            <span>11 Indian Regional Languages</span>
          </div>
        </div>

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
            <span className="hover:text-white/50 cursor-pointer transition-colors">{t('landing.privacy', 'Privacy')}</span>
            <span className="hover:text-white/50 cursor-pointer transition-colors">{t('landing.terms', 'Terms')}</span>
            <span className="hover:text-white/50 cursor-pointer transition-colors">{t('landing.support', 'Support')}</span>
          </div>
        </div>
      </footer>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} initialTab={demoTab} />
    </main>
  );
};

export default LandingPage;

