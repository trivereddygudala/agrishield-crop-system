import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ShieldCheck, Globe, Fingerprint, ScanFace, Truck, Sprout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/index';
import { useToast } from '../../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../../data/languages';
import LoginSuccessOverlay from '../../components/animations/LoginSuccessOverlay';
import { authenticateWithBiometrics, isBiometricSupported } from '../../utils/biometricAuth';
import FarmerBiometricModal from '../../components/common/FarmerBiometricModal';
import AgriShieldWatermark from '../../components/auth/AgriShieldWatermark';
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

  const handleSuccessDone = useCallback(() => {
    setShowSuccess(false);
    isLoggingInRef.current = false;
    navigateToDestination(successUser || user);
  }, [successUser, user, navigateToDestination]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!email || !password) {
      const msg = isTe ? 'దయచేసి మీ యూజర్‌నేమ్ మరియు పాస్‌వర్డ్ నమోదు చేయండి.' : 'Please enter your username and password.';
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return;
    }

    setLoading(true);
    setErrorMsg('');
    isLoggingInRef.current = true;

    try {
      const loggedUser = await login(email, password, rememberMe, botTrap);
      setSuccessUser(loggedUser);
      toast.success(
        t('auth.login.welcome_back_toast', 'Welcome Back!'),
        t('auth.login.login_success', 'Authentication successful.')
      );
      navigateToDestination(loggedUser);
    } catch (err) {
      isLoggingInRef.current = false;
      console.error(err);
      const raw = err.response?.data?.detail;
      const detail = Array.isArray(raw)
        ? raw.map(e => e.msg || JSON.stringify(e)).join(', ')
        : (typeof raw === 'string' ? raw : (isTe ? 'యూజర్‌నేమ్ లేదా పాస్‌వర్డ్ తప్పుగా ఉంది. దయచేసి మళ్ళీ ప్రయత్నించండి.' : 'Incorrect username or password. Please try again.'));
      setErrorMsg(detail);
      toast.error(t('auth.login.login_failed', 'Login Failed'), detail);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    if (loading || biometricLoading || showSuccess) return;
    
    const accountToUse = (email || savedBiometricUser?.email || '').trim();
    if (!accountToUse) {
      const msg = isTe 
        ? 'దయచేసి మీ యూజర్‌నేమ్ పైన నమోదు చేయండి.' 
        : 'Please enter your username above first.';
      setErrorMsg(msg);
      toast.warning(isTe ? 'యూజర్‌నేమ్ అవసరం' : 'Username Required', msg);
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
            ? `ఈ ఖాతా (${accountToUse}) లో బయోమెట్రిక్ ఇంకా సక్రియం చేయబడలేదు. దయచేసి ముందుగా పాస్‌వర్డ్‌తో లాగిన్ అయ్యి సెట్టింగ్స్‌లో మీ వేలిముద్రను ప్రారంభించండి.`
            : `Biometric sign-in is not yet enabled for this account (${accountToUse}). Please sign in with your password first, then enable Fingerprint in Settings.`;
          setErrorMsg(setupNeededMsg);
          toast.info(isTe ? 'బయోమెట్రిక్ ప్రారంభించండి' : 'Biometric Setup Required', setupNeededMsg);
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
          : 'No registered biometric passkey found. Please sign in with your password.';
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
            ? 'బయోమెట్రిక్ రద్దు చేయబడింది. దయచేసి మళ్ళీ ప్రయత్నించండి.'
            : 'Biometric scan was cancelled. Please try again.';
          setBioModalError(cancelMsg);
          return;
        }

        setBioModalError(result.error || (isTe ? 'బయోమెట్రిక్ విఫలమైంది.' : 'Biometric authentication failed.'));
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
      const msg = typeof raw === 'string' ? raw : (isTe ? 'బయోమెట్రిక్ లాగిన్ విఫలమైంది.' : 'Biometric sign-in failed.');
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

      {/* Fullscreen Golden Dawn Agricultural Backdrop (Concept 1) */}
      <div 
        className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-cover bg-center select-none overflow-x-hidden"
        style={{ backgroundImage: `url('/images/farmer_auth_bg.jpg')` }}
      >
        {/* Scenic Darkening Scrim for High Outdoor Contrast & Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-slate-950/75 backdrop-blur-[2px] pointer-events-none" />

        {/* Top-Right Language Switcher */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30">
          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/30 text-xs font-black text-white transition-all backdrop-blur-md shadow-lg"
          >
            <Globe className="w-4 h-4 text-emerald-300" />
            <span>{currentLang?.nativeName || 'English'}</span>
          </button>
        </div>

        <LanguageSelectModal isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} />

        {/* ── Central Frosted Glass Card with Transparent AgriShield Watermark ── */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-3xl bg-slate-950/85 backdrop-blur-2xl border-2 border-emerald-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.85)] p-6 sm:p-8 relative overflow-hidden z-10 my-4 text-white"
        >
          {/* Subtle Transparent AgriShield Emblem Watermark in Card Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
            <AgriShieldWatermark className="w-96 h-96 opacity-[0.14] text-emerald-400" />
          </div>

          <div className="relative z-10">
            {/* Header: Logo & Role Badge */}
            <div className="flex items-center justify-between mb-4">
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <Sprout className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-black text-white tracking-tight text-xl font-display block drop-shadow-sm">
                    AgriShield <span className="text-emerald-400">AI</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300/80 block -mt-0.5">
                    {isTe ? 'స్మార్ట్ వ్యవసాయ సేవలు' : 'Smart Agriculture Portal'}
                  </span>
                </div>
              </Link>

              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all ${
                role === 'equipment_provider'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/50 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              }`}>
                {role === 'equipment_provider' ? (isTe ? 'ప్రదాత' : 'Provider') : (isTe ? 'రైతు' : 'Farmer')}
              </span>
            </div>

            {/* Welcoming Heading */}
            <div className="mt-2 mb-5">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-sm">
                {isTe ? 'స్వాగతం / లాగిన్' : 'Welcome Back'}
              </h1>
              <p className="text-xs font-semibold text-slate-300 mt-1">
                {isTe ? 'ఖాతా లేదా?' : "Don't have an account yet?"}{' '}
                <Link to="/register" className="font-black text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                  {isTe ? 'ఇప్పుడే నమోదు చేయండి (Sign Up)' : 'Create Account'}
                </Link>
              </p>
            </div>

            {/* ── ROLE SWITCHER WITH COLOR GLOW (Farmer vs Equipment Provider) ── */}
            <div className="mb-5 p-1.5 rounded-2xl bg-black/40 border border-white/15 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('farmer')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  role === 'farmer'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-2 border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.7)] scale-[1.02]'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                <Sprout className={`w-4 h-4 ${role === 'farmer' ? 'text-white' : 'text-slate-400'}`} />
                <span>{isTe ? 'రైతు (Farmer)' : 'Farmer'}</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('equipment_provider')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  role === 'equipment_provider'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-2 border-indigo-300 shadow-[0_0_25px_rgba(99,102,241,0.7)] scale-[1.02]'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                <Truck className={`w-4 h-4 ${role === 'equipment_provider' ? 'text-white' : 'text-slate-400'}`} />
                <span>{isTe ? 'యంత్రాల ప్రదాత' : 'Equipment Provider'}</span>
              </button>
            </div>

            {/* Quick Biometric 1-Tap Sign-In Box (If Device Supports) */}
            {biometricSupported && (
              <div className="mb-5">
                <button
                  type="button"
                  disabled={biometricLoading || loading}
                  onClick={handleBiometricSignIn}
                  className="w-full p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border-2 border-emerald-400/50 text-white font-black text-xs flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/50">
                      {biometricLoading ? <ScanFace className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                    </div>
                    <span className="font-extrabold text-white text-sm">
                      {isTe ? '1-ట్యాప్ వేలిముద్రతో లాగిన్' : '1-Tap Biometric Sign In'}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 shadow-xs">
                    Fast
                  </span>
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="w-full border-t border-white/20" />
                  <span className="absolute px-3 bg-slate-950 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    {isTe ? 'లేదా పాస్‌వర్డ్‌తో' : 'OR WITH PASSWORD'}
                  </span>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 text-rose-200 text-xs font-bold leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Bot Trap */}
              <input
                type="text"
                name="website"
                value={botTrap}
                onChange={(e) => setBotTrap(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Username Input (Replaced Mobile Number word with Username) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                  {isTe ? 'యూజర్‌నేమ్ (Username)' : 'Username'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isTe ? 'ఉదా: farmer1 లేదా మీ యూజర్‌నేమ్' : 'e.g. farmer1 or your username'}
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                    {isTe ? 'పాస్‌వర్డ్ (Password)' : 'Password'}
                  </label>
                  <Link to="/forgot-password" tabIndex={-1} className="text-xs font-extrabold text-emerald-400 hover:text-emerald-300">
                    {isTe ? 'మర్చిపోయారా?' : 'Forgot Password?'}
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3.5 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 accent-emerald-500"
                  />
                  <span>{isTe ? 'నన్ను గుర్తుంచుకో' : 'Remember me on this phone'}</span>
                </label>
              </div>

              {/* Submit Action Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  loading={loading}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white shadow-xl transition-all duration-300 cursor-pointer active:scale-[0.99] border ${
                    role === 'equipment_provider'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-[0_0_25px_rgba(99,102,241,0.55)] border-indigo-300/40'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_0_25px_rgba(16,185,129,0.55)] border-emerald-300/40'
                  }`}
                >
                  {loading
                    ? (isTe ? 'ధృవీకరిస్తోంది...' : 'Signing in...')
                    : (isTe ? 'లాగిన్ అవ్వండి (Login)' : 'LOGIN TO FIELD')}
                </Button>
              </div>
            </form>

            {/* Bottom Footer Info (Cleaned: removed '256-bit SSL Protected') */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                AgriShield Guard v2.0
              </span>
            </div>
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
