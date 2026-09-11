import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/index';
import { useToast } from '../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../data/languages';
import NatureParticles from '../components/animations/NatureParticles';
import LoginSuccessOverlay from '../components/animations/LoginSuccessOverlay';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [botTrap, setBotTrap] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanProgress, setScanProgress] = useState(0); // 0–100 while loading
  const [showSuccess, setShowSuccess] = useState(false);
  const [successUser, setSuccessUser] = useState(null);
  const isLoggingInRef = useRef(false);

  // Destination after login
  const from = location.state?.from || null;
  const currentLang = getLanguageByCode(i18n.language);

  // Redirect only if user was ALREADY logged in before visiting /login (not during active login animation)
  useEffect(() => {
    if (user && !isLoggingInRef.current && !showSuccess) {
      const targetPath = user.role === 'admin' ? '/admin' : '/dashboard';
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate, showSuccess]);

  // Session-expired toast
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      toast.warning(
        t('auth.login.session_expired_title', 'Session Expired'),
        t('auth.login.session_expired_desc', 'Please sign in again to access your dashboard.')
      );
    }
  }, [location, toast, t]);

  // Animated scan progress bar while loading
  useEffect(() => {
    if (!loading) { setScanProgress(0); return; }
    setScanProgress(5);
    const intervals = [
      setTimeout(() => setScanProgress(30), 200),
      setTimeout(() => setScanProgress(60), 600),
      setTimeout(() => setScanProgress(85), 1200),
    ];
    return () => intervals.forEach(clearTimeout);
  }, [loading]);

  // Navigate after success overlay finishes
  const handleSuccessDone = useCallback(() => {
    setShowSuccess(false);
    isLoggingInRef.current = false;
    const userRole = successUser?.role || (successUser?.user?.role) || user?.role;
    const defaultPath = userRole === 'admin' ? '/admin' : (from || '/dashboard');
    navigate(defaultPath, { replace: true });
  }, [successUser, user, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || showSuccess) return;

    if (!email || !password) {
      setErrorMsg(t('auth.login.validation_required', 'Please fill in all credentials.'));
      toast.error('Validation Error', t('auth.login.validation_required', 'Please fill in all credentials.'));
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setScanProgress(15);
    isLoggingInRef.current = true; // Lock redirection so overlay can play

    try {
      const loggedUser = await login(email, password, rememberMe, botTrap);
      setScanProgress(100);
      setSuccessUser(loggedUser);
      // Immediately display the full-screen cinematic overlay
      setShowSuccess(true);
      toast.success(
        t('auth.login.welcome_back_toast', 'Welcome Back!'),
        t('auth.login.login_success', 'Authentication successful.')
      );
    } catch (err) {
      isLoggingInRef.current = false;
      console.error(err);
      const raw = err.response?.data?.detail;
      const detail = Array.isArray(raw)
        ? raw.map(e => e.msg || JSON.stringify(e)).join(', ')
        : (typeof raw === 'string' ? raw : 'Incorrect email or password. Please try again.');
      setErrorMsg(detail);
      toast.error(t('auth.login.login_failed', 'Login Failed'), detail);
      setScanProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Login Success Overlay ── */}
      {showSuccess && (
        <LoginSuccessOverlay
          userName={successUser?.name || successUser?.user?.name || user?.name || email.split('@')[0] || 'Farmer'}
          onDone={handleSuccessDone}
        />
      )}

      <div className="dark relative min-h-screen bg-[#030a06] text-white flex items-center justify-center px-4 py-12 overflow-hidden select-none">

        {/* ── Nature particle background ── */}
        <NatureParticles count={22} />

        {/* ── Deep green radial background ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(5,30,14,0.85) 0%, rgba(3,10,6,1) 70%)',
          }}
        />

        {/* ── Background grid overlay ── */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(52,211,153,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(52,211,153,0.025)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)] pointer-events-none" />

        {/* ── Slow pulsing radar scan line ── */}
        <motion.div
          className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent pointer-events-none z-0"
          animate={{ y: ['-10vh', '110vh'] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
        />

        {/* ── Ambient glow orbs ── */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 -z-10 h-[500px] w-[500px] rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 -z-10 h-[400px] w-[400px] rounded-full bg-teal-500/5 blur-3xl" />

        {/* ── Language switcher ── */}
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

        {/* ── Main card ── */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo + Title */}
          <div className="text-center mb-8 flex flex-col items-center">
            <Link to="/" className="inline-flex items-center gap-3 mb-5 group">
              {/* Scan ring logo */}
              <div className="relative">
                {/* Pulsing outer ring */}
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
                  {/* Interior scan line */}
                  <motion.div
                    className="absolute left-0 right-0 h-[2px] bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    animate={{ y: [0, 44, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    style={{ top: 0 }}
                  />
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7 relative z-10"
                  >
                    <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
                    <path d="M2 22 C2 22 8 16 12 12" />
                  </svg>
                </div>
              </div>
              <span className="font-black text-white tracking-tight text-2xl">
                AgriShield <span className="text-emerald-400">AI</span>
              </span>
            </Link>

            <motion.h2
              className="font-black text-white text-3xl tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              {t('auth.login.title', 'Welcome Back')}
            </motion.h2>
            <motion.p
              className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {t('auth.login.subtitle', 'Enter credentials to access your AI Farm Sentinel dashboard')}
            </motion.p>
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="p-8 border border-emerald-500/15 bg-[#040d07]/70 backdrop-blur-xl relative overflow-hidden rounded-[24px] shadow-[0_0_60px_-12px_rgba(52,211,153,0.2)]"
          >
            {/* Top accent line */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />

            {/* Corner leaf decorations */}
            <div className="absolute top-3 right-4 opacity-10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(52,211,153,1)">
                <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
              </svg>
            </div>
            <div className="absolute bottom-3 left-4 opacity-8 rotate-180">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(20,184,166,1)">
                <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
              </svg>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              {/* Wall 4: Ghost Honeypot Bot Trap */}
              <input
                type="text"
                name="bot_trap"
                value={botTrap}
                onChange={(e) => setBotTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }}
              />

              {/* Error message */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    className="p-3.5 bg-rose-500/12 border border-rose-500/25 text-rose-400 text-xs font-bold rounded-2xl flex items-center gap-2"
                  >
                    <span>⚠️</span> {errorMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email / Username */}
              <div className="space-y-1">
                <label htmlFor="email" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  {t('auth.login.username_or_email', 'Username or Email')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.login.username_placeholder', 'e.g. farmer1 or your email')}
                    className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all hover:border-white/20"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="password" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  {t('auth.login.password', 'Password')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-10 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono hover:border-white/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-emerald-400 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 font-bold text-slate-500 cursor-pointer select-none hover:text-slate-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 text-emerald-500 focus:ring-0 bg-[#0d1527] cursor-pointer accent-emerald-500"
                  />
                  {t('auth.login.remember_me', 'Remember Me')}
                </label>
              </div>

              {/* Submit button with scan progress bar */}
              <div className="relative mt-2">
                <Button
                  type="submit"
                  loading={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:shadow-[0_0_40px_rgba(52,211,153,0.5)] transition-all duration-300"
                >
                  {loading
                    ? t('auth.login.scanning', '🔍 Scanning Field...')
                    : t('auth.login.sign_in_btn', 'Sign In to Account')}
                </Button>

                {/* Scan progress sweep under button */}
                <AnimatePresence>
                  {loading && (
                    <motion.div
                      className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400"
                      initial={{ width: '0%' }}
                      animate={{ width: `${scanProgress}%` }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </form>

            {/* Footer badges */}
            <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {t('auth.login.agrishield_secure', 'AgriShield Secure')}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                {t('auth.login.pytorch_diagnostic', 'PyTorch Diagnostic')}
              </span>
            </div>

            <p className="text-center text-xs text-slate-500 mt-5 font-bold">
              {t('auth.login.new_to_agrishield', 'New to AgriShield?')}{' '}
              <Link to="/register" className="font-extrabold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors">
                {t('auth.login.create_account', 'Create an account')}
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;
