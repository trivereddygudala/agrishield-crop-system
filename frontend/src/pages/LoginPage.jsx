import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, User, Mail, Lock, Eye, EyeOff, ShieldCheck, Sparkles, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/index';
import { useToast } from '../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../data/languages';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentLang = getLanguageByCode(i18n.language);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      const targetPath = user.role === 'admin' ? '/admin' : '/dashboard';
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate]);

  // Show session expired notification if forwarded with query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      toast.warning(
        t('auth.login.session_expired_title', 'Session Expired'),
        t('auth.login.session_expired_desc', 'Please sign in again to access your dashboard.')
      );
    }
  }, [location, toast, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!email || !password) {
      setErrorMsg(t('auth.login.validation_required', 'Please fill in all credentials.'));
      toast.error('Validation Error', t('auth.login.validation_required', 'Please fill in all credentials.'));
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      const loggedUser = await login(email, password, rememberMe);
      toast.success(
        t('auth.login.welcome_back_toast', 'Welcome Back!'),
        t('auth.login.login_success', 'Authentication successful.')
      );
      const userRole = loggedUser?.role || (loggedUser?.user && loggedUser.user.role);
      const defaultPath = userRole === 'admin' ? '/admin' : '/dashboard';
      navigate(defaultPath, { replace: true });
    } catch (err) {
      console.error(err);
      const raw = err.response?.data?.detail;
      const detail = Array.isArray(raw)
        ? raw.map(e => e.msg || JSON.stringify(e)).join(', ')
        : (typeof raw === 'string' ? raw : 'Incorrect email or password. Please try again.');
      setErrorMsg(detail);
      toast.error(t('auth.login.login_failed', 'Login Failed'), detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark relative min-h-screen bg-[#070b13] text-white flex items-center justify-center px-4 py-12 overflow-hidden select-none">
      
      {/* Background Matrix Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />

      {/* Pulsing Radar Scanning Line across screen background */}
      <motion.div 
        className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent pointer-events-none z-0"
        animate={{ y: ['-10vh', '110vh'] }}
        transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
      />

      {/* Decorative Neon Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 -z-10 h-[450px] w-[450px] rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 -z-10 h-[450px] w-[450px] rounded-full bg-cyan-500/5 blur-3xl" />

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
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group relative">
            <div className="bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 p-3.5 rounded-2xl shadow-lg shadow-emerald-500/10 relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
              <Leaf className="h-7 w-7 text-emerald-400" />
              {/* Pulsating Scanner Line */}
              <motion.div 
                className="absolute left-0 right-0 h-[2px] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]"
                animate={{ y: [0, 48, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
            </div>
            <span className="font-display font-black text-white tracking-tight text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
              AgriShield <span className="text-emerald-500 font-bold">AI</span>
            </span>
          </Link>
          
          <h2 className="font-display font-black text-white text-3xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {t('auth.login.title', 'Welcome Back')}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
            {t('auth.login.subtitle', 'Enter credentials to access your AI Farm Sentinel dashboard')}
          </p>
        </div>

        {/* Custom styled transparent card to bypass default light bg styles */}
        <div 
          className="p-8 border border-white/10 bg-[#0c1220]/60 backdrop-blur-xl relative overflow-hidden rounded-[24px] shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)]"
        >
          {/* Laser scanning strip at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            {errorMsg && (
              <div className="p-3.5 bg-rose-500/15 border border-rose-500/25 text-rose-450 text-xs font-bold rounded-2xl flex items-center gap-2">
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.login.username_or_email', 'Username or Email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.login.username_placeholder', 'e.g. farmer1 or your email')}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                {t('auth.login.password', 'Password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-emerald-500 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 font-bold text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/10 text-emerald-500 focus:ring-0 bg-[#0d1527] cursor-pointer"
                />
                {t('auth.login.remember_me', 'Remember Me')}
              </label>
            </div>

            <Button 
              type="submit" 
              loading={loading} 
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all mt-2"
            >
              {t('auth.login.sign_in_btn', 'Sign In to Account')}
            </Button>
          </form>

          {/* Project thematic details panel */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> {t('auth.login.agrishield_secure', 'AgriShield Secure')}</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> {t('auth.login.pytorch_diagnostic', 'PyTorch Diagnostic')}</span>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6 font-bold">
            {t('auth.login.new_to_agrishield', 'New to AgriShield?')}{' '}
            <Link to="/register" className="font-extrabold text-emerald-500 hover:underline">
              {t('auth.login.create_account', 'Create an account')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
