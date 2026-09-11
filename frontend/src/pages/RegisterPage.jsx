import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Eye, EyeOff, MapPin, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/index';
import { useToast } from '../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../data/languages';
import NatureParticles from '../components/animations/NatureParticles';

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [village, setVillage] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(i18n.language || 'en');
  const [activeStep, setActiveStep] = useState(0); // Onboarding slides index
  const [langModalOpen, setLangModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentLang = getLanguageByCode(i18n.language);

  // Sync preferredLanguage if i18n language changes
  useEffect(() => {
    if (i18n.language) {
      setPreferredLanguage(i18n.language);
    }
  }, [i18n.language]);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const onboardingSlides = [
    { 
      title: t('auth.register.step1_title', '📸 Step 1: Snap Leaf Photo'), 
      desc: t('auth.register.step1_desc', 'Take a clear, close-up picture of the infected crop leaf using your phone camera.') 
    },
    { 
      title: t('auth.register.step2_title', '🟢 Step 2: Instant AI Scan'), 
      desc: t('auth.register.step2_desc', 'AgriShield AI uses NIM endpoints to scan and detect symptoms in under 5 seconds.') 
    },
    { 
      title: t('auth.register.step3_title', '🌾 Step 3: Treatment & Spray Advice'), 
      desc: t('auth.register.step3_desc', 'Get organic & chemical recommendations, water guidance, and spray dosages.') 
    }
  ];

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % onboardingSlides.length);
    }, 4500);
    return () => clearInterval(slideTimer);
  }, [onboardingSlides.length]);

  const handleLanguageChange = (code) => {
    setPreferredLanguage(code);
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    const trimmedName = name.trim();
    if (!trimmedName || !password || !confirmPassword || !village) {
      const msg = t('auth.register.validation_all_required', 'All fields are required.');
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return;
    }

    if (password.length < 4) {
      const msg = t('auth.register.validation_password_length', 'Password must be at least 4 characters long.');
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = t('auth.register.validation_password_mismatch', 'Passwords do not match. Please re-enter.');
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return;
    }

    // Auto-generate clean login email/identifier from username if not already an email
    const email = trimmedName.includes('@')
      ? trimmedName.toLowerCase()
      : `${trimmedName.toLowerCase().replace(/\s+/g, '')}@agrishield.com`;

    setLoading(true);
    
    try {
      await register(trimmedName, email, password, preferredLanguage);
      // Store village details in localStorage to save farmer metadata locally
      localStorage.setItem('farmer_village', village);
      toast.success(
        t('auth.register.success_title', 'Account Created!'), 
        t('auth.register.success_desc', 'Welcome to AgriShield AI.')
      );
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      const raw = err.response?.data?.detail;
      const detail = Array.isArray(raw)
        ? raw.map(e => e.msg || JSON.stringify(e)).join(', ')
        : (typeof raw === 'string' ? raw : 'Failed to create account. Please check your information.');
      setErrorMsg(detail);
      toast.error('Registration Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark relative min-h-screen bg-[#030a06] text-white flex items-center justify-center px-4 py-12 overflow-hidden select-none">

      {/* Nature particle background */}
      <NatureParticles count={18} />

      {/* Deep green radial background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(5,30,14,0.85) 0%, rgba(3,10,6,1) 70%)',
        }}
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(52,211,153,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(52,211,153,0.025)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)] pointer-events-none" />

      {/* Slow radar scan line */}
      <motion.div
        className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent pointer-events-none z-0"
        animate={{ y: ['-10vh', '110vh'] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
      />

      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 -z-10 h-[500px] w-[500px] rounded-full bg-emerald-500/6 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 -z-10 h-[400px] w-[400px] rounded-full bg-teal-500/5 blur-3xl" />

      {/* Floating Language Switcher in Top-Right Corner */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          type="button"
          onClick={() => setLangModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-200 transition-all backdrop-blur-md shadow-lg hover:border-emerald-500/40"
        >
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>{currentLang?.nativeName || 'English'}</span>
        </button>
      </div>

      <LanguageSelectModal isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} />

      <motion.div
        initial={{ opacity: 0, y: 35, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-5 group">
            {/* Scan ring logo */}
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-2xl border border-emerald-500/40"
                animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-2xl border border-teal-400/25"
                animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              />
              <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-3.5 rounded-2xl shadow-[0_0_40px_rgba(52,211,153,0.5)] relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                <motion.div
                  className="absolute left-0 right-0 h-[2px] bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  animate={{ y: [0, 44, 0] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  style={{ top: 0 }}
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 relative z-10">
                  <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
                  <path d="M2 22 C2 22 8 16 12 12" />
                </svg>
              </div>
            </div>
            <span className="font-black text-white tracking-tight text-2xl">
              AgriShield <span className="text-emerald-400">AI</span>
            </span>
          </Link>
          
          <h2 className="font-display font-black text-white text-3xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {t('auth.register.title', 'Create Account')}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
            {t('auth.register.subtitle', 'Start protecting your crops with machine intelligence')}
          </p>
        </div>
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="p-8 border border-emerald-500/15 bg-[#040d07]/70 backdrop-blur-xl relative overflow-hidden rounded-[24px] shadow-[0_0_60px_-12px_rgba(52,211,153,0.2)]"
        >
          {/* Animated top accent line */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
          {/* Corner decoration */}
          <div className="absolute top-3 right-4 opacity-10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(52,211,153,1)">
              <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
            </svg>
          </div>
          
          {/* Illustrated Picture-Based Onboarding Slides */}
          <div className="mb-6 bg-white/[0.03] border border-white/5 p-4 rounded-2xl overflow-hidden relative min-h-[90px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="space-y-1 text-center"
              >
                <h4 className="text-xs font-black text-emerald-450 tracking-wide uppercase">
                  {onboardingSlides[activeStep].title}
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  {onboardingSlides[activeStep].desc}
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {onboardingSlides.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    idx === activeStep ? 'w-4 bg-emerald-500' : 'w-1 bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {errorMsg && (
              <div className="p-3.5 bg-rose-500/15 border border-rose-500/25 text-rose-450 text-xs font-bold rounded-2xl flex items-center gap-2">
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="name" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.register.full_name', 'Full Name or Username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.register.full_name_placeholder', 'e.g. Ramesh or farmer1')}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.register.password', 'Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.register.password_placeholder', 'Enter password (e.g. 1234)')}
                  className="block w-full pl-10 pr-10 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.register.confirm_password', 'Confirm Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.register.confirm_password_placeholder', 'Re-enter password')}
                  className="block w-full pl-10 pr-10 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="village" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.register.village', 'Village / District')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  id="village"
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder={t('auth.register.village_placeholder', 'e.g. Rampur, Bihar')}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="language" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.register.preferred_language', 'Preferred Language')}
              </label>
              <select
                id="language"
                value={preferredLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="block w-full px-3 py-3 border border-white/10 rounded-2xl bg-[#0d1527] text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
              >
                <option value="en">English (English)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="ml">മലയാളം (Malayalam)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                <option value="ur">اردو (Urdu)</option>
                <option value="or">ଓଡ଼ିଆ (Odia)</option>
                <option value="as">অসমীয়া (Assamese)</option>
              </select>
            </div>

            <Button 
              type="submit" 
              loading={loading} 
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all mt-2"
            >
              {t('auth.register.register_btn', 'Register & Start Scanning')}
            </Button>
          </form>

          {/* Project thematic details panel */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {t('auth.login.agrishield_secure', 'AgriShield Secure')}</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> {t('auth.login.pytorch_diagnostic', 'PyTorch Diagnostic')}</span>
          </div>

          <p className="text-center text-xs text-slate-500 mt-5 font-bold">
            {t('auth.register.already_have_account', 'Already have an account?')}{' '}
            <Link to="/login" className="font-extrabold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors">
              {t('auth.register.sign_in', 'Sign In')}
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
