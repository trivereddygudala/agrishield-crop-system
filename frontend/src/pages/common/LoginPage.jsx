import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ShieldCheck, Sparkles, Globe, Fingerprint, ScanFace, Truck, Sprout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/index';
import { useToast } from '../../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../../data/languages';
import NatureParticles from '../../components/animations/NatureParticles';
import LoginSuccessOverlay from '../../components/animations/LoginSuccessOverlay';
import { authenticateWithBiometrics, isBiometricSupported } from '../../utils/biometricAuth';
import FarmerBiometricModal from '../../components/common/FarmerBiometricModal';
import AuthWorkstationIllustration from '../../components/auth/AuthWorkstationIllustration';
import API from '../../services/api';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const { login, biometricLogin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('farmer'); // 'farmer' | 'equipment_provider'
  const [rememberMe, setRememberMe] = useState(true);
  const [botTrap, setBotTrap] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successUser, setSuccessUser] = useState(null);
  const isLoggingInRef = useRef(false);

  // ── Biometric 1-Tap Sign-In State ──
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [savedBiometricUser, setSavedBiometricUser] = useState(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showBioLoginModal, setShowBioLoginModal] = useState(false);
  const [bioModalTargetCid, setBioModalTargetCid] = useState(null);
  const [bioModalAccount, setBioModalAccount] = useState('');
  const [bioModalError, setBioModalError] = useState('');

  useEffect(() => {
    const checkBio = async () => {
      const supported = await isBiometricSupported();
      setBiometricSupported(supported);
      const savedEmail = localStorage.getItem('agrishield_biometric_email');
      const savedCid = localStorage.getItem('agrishield_biometric_cid');
      if (savedEmail && savedCid) {
        setSavedBiometricUser({ email: savedEmail, credentialId: savedCid });
        setEmail(prev => prev || savedEmail);
      }
    };
    checkBio();
  }, []);

  const from = location.state?.from || null;
  const currentLang = getLanguageByCode(i18n.language);

  // Redirect only if user was ALREADY logged in before visiting /login
  useEffect(() => {
    if (user && !isLoggingInRef.current && !showSuccess) {
      if (user.role === 'equipment_provider') {
        navigate('/provider/dashboard', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
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

  // Immediate destination navigation helper
  const navigateToDestination = useCallback((targetUser) => {
    const userRole = targetUser?.role || (targetUser?.user?.role) || role;
    if (userRole === 'equipment_provider') {
      navigate('/provider/dashboard', { replace: true });
    } else if (userRole === 'admin') {
      navigate('/admin', { replace: true });
    } else {
      navigate(from || '/dashboard', { replace: true });
    }
  }, [navigate, from, role]);

  // Navigate after success overlay finishes
  const handleSuccessDone = useCallback(() => {
    setShowSuccess(false);
    isLoggingInRef.current = false;
    navigateToDestination(successUser || user);
  }, [successUser, user, navigateToDestination]);

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
    setScanProgress(25);
    isLoggingInRef.current = true;

    try {
      const loggedUser = await login(email, password, rememberMe, botTrap);
      setScanProgress(100);
      setSuccessUser(loggedUser);
      toast.success(
        t('auth.login.welcome_back_toast', 'Welcome Back!'),
        t('auth.login.login_success', 'Authentication successful.')
      );
      // Immediately navigate without hanging
      navigateToDestination(loggedUser);
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

  const handleBiometricSignIn = async () => {
    if (loading || biometricLoading || showSuccess) return;
    
    const accountToUse = (email || savedBiometricUser?.email || '').trim();
    if (!accountToUse) {
      const msg = isTe 
        ? 'దయచేసి మీ యూజర్‌నేమ్ లేదా ఈమెయిల్ పైన నమోదు చేయండి.' 
        : 'Please enter your username or email above first.';
      setErrorMsg(msg);
      toast.warning(isTe ? 'ఖాతా వివరాలు అవసరం' : 'Account Identifier Required', msg);
      return;
    }

    setBiometricLoading(true);
    setErrorMsg('');

    try {
      let targetCredentialId = savedBiometricUser?.credentialId || null;
      try {
        const checkRes = await API.get('/api/auth/biometric/check', {
          params: { account: accountToUse }
        });
        const bioInfo = checkRes.data;

        if (bioInfo && !bioInfo.biometric_enabled) {
          const setupNeededMsg = isTe
            ? `ఈ ఖాతా (${accountToUse}) లో బయోమెట్రిక్ ఇంకా సక్రియం చేయబడలేదు. దయచేసి ముందుగా పాస్‌వర్డ్‌తో లాగిన్ అయ్యి సెట్టింగ్స్‌లో మీ వేలిముద్ర లేదా ఫేస్ లాక్‌ని ప్రారంభించండి.`
            : `Biometric sign-in is not yet enabled for this account (${accountToUse}). Please sign in with your password first, then enable Fingerprint / Face ID in Settings.`;
          setErrorMsg(setupNeededMsg);
          toast.info(isTe ? 'బయోమెట్రిక్ ఇంకా ప్రారంభం కాలేదు' : 'Biometric Setup Required', setupNeededMsg);
          setBiometricLoading(false);
          return;
        }

        if (bioInfo?.credential_ids?.length > 0) {
          targetCredentialId = bioInfo.credential_ids[0];
        }
      } catch (checkErr) {
        console.warn('Biometric account check failed, trying local credential:', checkErr);
      }

      if (!targetCredentialId) {
        const noCredMsg = isTe
          ? 'ఈ ఖాతాకి నమోదు చేసిన బయోమెట్రిక్ కీ కనుగొనబడలేదు. దయచేసి పాస్‌వర్డ్‌తో లాగిన్ అవ్వండి.'
          : 'No registered biometric passkey found for this account. Please sign in with your password.';
        setErrorMsg(noCredMsg);
        toast.info(isTe ? 'పాస్‌వర్డ్‌తో లాగిన్ అవ్వండి' : 'Password Login Required', noCredMsg);
        setBiometricLoading(false);
        return;
      }

      setBioModalAccount(accountToUse);
      setBioModalTargetCid(targetCredentialId);
      setBioModalError('');
      setShowBioLoginModal(true);
      await executeBiometricAuth(accountToUse, targetCredentialId);
    } catch (err) {
      console.error(err);
      setBiometricLoading(false);
    }
  };

  const executeBiometricAuth = async (accountToUse, targetCid) => {
    setBiometricLoading(true);
    setBioModalError('');
    try {
      const result = await authenticateWithBiometrics(targetCid);
      
      if (!result.success) {
        setBiometricLoading(false);
        if (result.noCredential) {
          const noCredMsg = isTe
            ? 'ఈ పరికరంలో బయోమెట్రిక్ కనుగొనబడలేదు. దయచేసి పాస్‌వర్డ్‌తో లాగిన్ అవ్వండి.'
            : 'No passkey found on this device. Please sign in with your password.';
          setBioModalError(noCredMsg);
          return;
        }

        if (result.cancelled) {
          const cancelMsg = isTe
            ? 'బయోమెట్రిక్ ధృవీకరణ రద్దు చేయబడింది లేదా ఈ ఫోన్ ఇంకా ఖాతాకి లింక్ కాలేదు. గూగుల్ బాక్స్‌లో Continue నొక్కి వేలిని సెన్సార్‌పై ఉంచండి.'
            : 'Biometric scan was cancelled. Tap Continue on the Google prompt and touch your fingerprint sensor.';
          setBioModalError(cancelMsg);
          return;
        }

        setBioModalError(result.error || (isTe ? 'బయోమెట్రిక్ ధృవీకరణ విఫలమైంది.' : 'Biometric authentication failed.'));
        return;
      }

      setShowBioLoginModal(false);
      isLoggingInRef.current = true;
      const loggedUser = await biometricLogin(accountToUse, result.credential_id);
      setSuccessUser(loggedUser);
      toast.success(
        t('auth.login.welcome_back_toast', 'Welcome Back!'),
        t('auth.login.login_success', 'Biometric identity verified successfully.')
      );
      navigateToDestination(loggedUser);
    } catch (err) {
      isLoggingInRef.current = false;
      console.error('Biometric authentication failed:', err);
      const raw = err.response?.data?.detail;
      const msg = typeof raw === 'string' ? raw : (isTe ? 'బయోమెట్రిక్ ధృవీకరణ విఫలమైంది.' : 'Biometric sign-in failed.');
      setBioModalError(msg);
      toast.error('Biometric Login Failed', msg);
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <>
      {showSuccess && (
        <LoginSuccessOverlay
          userName={successUser?.username || email.split('@')[0]}
          userRole={successUser?.role || role}
          isBiometric={Boolean(bioModalAccount)}
          onAnimationDone={handleSuccessDone}
        />
      )}

      <div className="relative min-h-screen bg-gradient-to-br from-indigo-900/40 via-[#030a06] to-slate-950 text-white flex items-center justify-center p-4 sm:p-6 lg:p-10 select-none overflow-x-hidden">
        <NatureParticles count={18} />

        {/* Deep ambient backdrop circles */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 -z-10 h-[550px] w-[550px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Language switcher */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30">
          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-100 transition-all backdrop-blur-md shadow-lg hover:border-emerald-400/50"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>{currentLang?.nativeName || 'English'}</span>
          </button>
        </div>

        <LanguageSelectModal isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} />

        {/* ── Modern Split-Card Presentation Container (Reference Aesthetic) ── */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-5xl rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 my-4"
        >
          {/* ══ LEFT SIDE: Clean Elevated Auth Form Card ══ */}
          <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between bg-white dark:bg-[#070e17] text-slate-900 dark:text-white border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800">
            <div>
              {/* Header: Title & Switch Link */}
              <div className="flex items-center justify-between mb-2">
                <Link to="/" className="inline-flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
                    <Sprout className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-black text-slate-900 dark:text-white tracking-tight text-lg">
                    AgriShield <span className="text-emerald-500">AI</span>
                  </span>
                </Link>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {role === 'equipment_provider' ? 'Provider Portal' : 'Farmer Access'}
                </span>
              </div>

              <div className="mt-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t('auth.login.title', 'Sign In')}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isTe ? 'ఖాతా లేదా?' : "Don't have an account yet?"}{' '}
                  <Link to="/register" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                    {t('auth.login.create_account', 'Sign Up')}
                  </Link>
                </p>
              </div>

              {/* ── ROLE SELECTOR (Farmer vs Equipment Provider) ── */}
              <div className="mb-6 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRole('farmer')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    role === 'farmer'
                      ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-sm border border-slate-200/80 dark:border-transparent'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sprout className="w-4 h-4" />
                  <span>{isTe ? 'రైతు (Farmer)' : 'Farmer'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('equipment_provider')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    role === 'equipment_provider'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm border border-slate-200/80 dark:border-transparent'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>{isTe ? 'యంత్రాల ప్రదాత' : 'Equipment Provider'}</span>
                </button>
              </div>

              {/* Quick Biometric 1-Tap Sign-In Box */}
              {biometricSupported && (
                <div className="mb-5">
                  <button
                    type="button"
                    disabled={biometricLoading || loading}
                    onClick={handleBiometricSignIn}
                    className="w-full p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200/90 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500 text-white">
                        {biometricLoading ? <ScanFace className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                      </div>
                      <span className="font-extrabold">
                        {isTe ? 'వేలిముద్ర లేదా ఫేస్ లాగిన్' : '1-Tap Biometric Sign In'}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Fast
                    </span>
                  </button>

                  <div className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    </div>
                    <span className="relative px-3 bg-white dark:bg-[#070e17] text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {isTe ? 'లేదా పాస్‌వర్డ్' : 'OR WITH PASSWORD'}
                    </span>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot Bot Trap */}
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

                {errorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-2xl flex items-center gap-2">
                    <span>⚠️</span> {errorMsg}
                  </div>
                )}

                {/* Email / Username Input */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {role === 'equipment_provider' 
                      ? (isTe ? 'ప్రదాత ఈమెయిల్ లేదా యూజర్‌నేమ్' : 'Provider Email or Username')
                      : t('auth.login.username_or_email', 'Email Address or Username')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role === 'equipment_provider' ? 'e.g. provider@agrishield.com' : 'you@example.com or farmer1'}
                      className="w-full pl-10 pr-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('auth.login.password', 'Password')}
                    </label>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
                      {isTe ? 'పాస్‌వర్డ్ మర్చిపోయారా?' : 'Forgot Password?'}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter 4 characters or more"
                      className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span>{t('auth.login.remember_me', 'Remember me')}</span>
                  </label>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={loading}
                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all duration-300 ${
                      role === 'equipment_provider'
                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    }`}
                  >
                    {loading
                      ? (isTe ? 'ధృవీకరిస్తోంది...' : 'Signing in...')
                      : (isTe ? 'లాగిన్ అవ్వండి' : 'LOGIN')}
                  </Button>
                </div>
              </form>
            </div>

            {/* Bottom Footer Info */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                AgriShield Guard v2.0
              </span>
              <span>256-bit SSL Protected</span>
            </div>
          </div>

          {/* ══ RIGHT SIDE: Modern Workstation Vector Illustration ══ */}
          <div className="lg:col-span-6 p-4 sm:p-6 lg:p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900/40">
            <AuthWorkstationIllustration role={role} isTe={isTe} />
          </div>
        </motion.div>
      </div>

      {/* Biometric Guidance Modal */}
      <FarmerBiometricModal
        isOpen={showBioLoginModal}
        onClose={() => setShowBioLoginModal(false)}
        mode="login"
        accountName={bioModalAccount}
        onStartScan={() => executeBiometricAuth(bioModalAccount, bioModalTargetCid)}
        isScanning={biometricLoading}
        errorMsg={bioModalError}
      />
    </>
  );
};

export default LoginPage;
