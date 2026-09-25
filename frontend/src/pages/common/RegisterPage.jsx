import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, MapPin, ShieldCheck, Globe, Sprout, Truck, ArrowRight, ArrowLeft, Check, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/index';
import { useToast } from '../../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../../data/languages';
import FarmerCropPicker from '../../components/auth/FarmerCropPicker';
import AgriShieldWatermark from '../../components/auth/AgriShieldWatermark';

const PROVIDER_EQUIPMENT_OPTIONS = [
  { id: 'tractor', name: 'Tractor & Implements', teluguName: 'ట్రాక్టర్ & నాగలి', icon: '🚜', desc: 'Ploughing, rotavating, sowing & hauling' },
  { id: 'drone', name: 'AI Spraying Drone', teluguName: 'స్ప్రేయింగ్ డ్రోన్', icon: '🛸', desc: 'Ultra-low volume pesticide & fertilizer spray' },
  { id: 'irrigation', name: 'Irrigation & Borewell Pumps', teluguName: 'నీటి పంపులు', icon: '💧', desc: 'Diesel/solar pumps, drip & sprinkler lines' },
  { id: 'harvester', name: 'Combine Harvester', teluguName: 'కోత యంత్రం', icon: '🌾', desc: 'Paddy, maize, wheat & sugarcane harvesting' }
];

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Multi-step registration flow: Step 1 = Account Credentials, Step 2 = Role Configuration
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('farmer'); // 'farmer' | 'equipment_provider'

  // Step 1: Identity & Credentials
  const [name, setName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('Prakasam');
  const [botTrap, setBotTrap] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState(i18n.language || 'en');
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Step 2 (Farmer): 8 Selected Crops
  const [selectedCrops, setSelectedCrops] = useState(['Tomato', 'Chilli', 'Rice', 'Cotton']);

  // Step 2 (Equipment Provider): Fleet Types & Hub
  const [equipmentTypes, setEquipmentTypes] = useState(['tractor']);
  const [providerRadiusKm, setProviderRadiusKm] = useState(25);

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
      if (user.role === 'equipment_provider') {
        navigate('/provider/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const toggleEquipmentType = (typeId) => {
    if (equipmentTypes.includes(typeId)) {
      if (equipmentTypes.length > 1) {
        setEquipmentTypes(equipmentTypes.filter(t => t !== typeId));
      } else {
        toast.info('At least one machinery category is required');
      }
    } else {
      setEquipmentTypes([...equipmentTypes, typeId]);
    }
  };

  const validateStep1 = () => {
    setErrorMsg('');
    const trimmedName = name.trim();
    if (!trimmedName || !password || !confirmPassword || !village) {
      const msg = isTe ? 'దయచేసి పేరు, పాస్‌వర్డ్ మరియు గ్రామం వివరాలను నమోదు చేయండి.' : 'Please enter your name, password and village.';
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return false;
    }

    if (password.length < 4) {
      const msg = isTe ? 'పాస్‌వర్డ్ కనీసం 4 అక్షరాలు లేదా అంకెలు ఉండాలి.' : 'Password must be at least 4 characters long.';
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return false;
    }

    if (password !== confirmPassword) {
      const msg = isTe ? 'పాస్‌వర్డ్‌లు సరిపోలలేదు. దయచేసి సరిచూసుకోండి.' : 'Passwords do not match. Please re-enter.';
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return false;
    }

    return true;
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    // Ensure step 1 is valid
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    // Role-specific step 2 validation
    if (role === 'farmer' && selectedCrops.length === 0) {
      const msg = isTe ? 'దయచేసి కనీసం 1 పంటను ఎంచుకోండి.' : 'Please select at least 1 crop.';
      setErrorMsg(msg);
      toast.warning('Crop Selection Required', msg);
      return;
    }

    if (role === 'equipment_provider' && equipmentTypes.length === 0) {
      const msg = isTe ? 'దయచేసి కనీసం 1 యంత్రాల కేటగిరీని ఎంచుకోండి.' : 'Please select at least 1 machinery category.';
      setErrorMsg(msg);
      toast.warning('Equipment Category Required', msg);
      return;
    }

    const trimmedName = name.trim();
    let email = emailInput.trim();
    if (!email) {
      email = trimmedName.includes('@')
        ? trimmedName.toLowerCase()
        : `${trimmedName.toLowerCase().replace(/\s+/g, '')}@agrishield.com`;
    }

    setLoading(true);

    try {
      const farmLocation = {
        village,
        district,
        state: 'Andhra Pradesh',
        radius_km: role === 'equipment_provider' ? providerRadiusKm : undefined
      };

      await register(
        trimmedName,
        email,
        password,
        preferredLanguage,
        botTrap,
        role,
        role === 'farmer' ? selectedCrops : [],
        role === 'equipment_provider' ? equipmentTypes : [],
        farmLocation
      );

      localStorage.setItem('farmer_village', village);
      localStorage.setItem('farmer_district', district);
      localStorage.setItem('user_role', role);

      if (role === 'farmer') {
        localStorage.setItem('agrishield_selected_crops', JSON.stringify(selectedCrops));
      }

      toast.success(
        t('auth.register.success_title', 'Account Created!'),
        role === 'equipment_provider'
          ? (isTe ? 'యంత్రాల ప్రదాత పోర్టల్‌కి స్వాగతం!' : 'Welcome to the Equipment Provider Hub!')
          : (isTe ? 'అగ్రిషీల్డ్ రైతు వేదికకు స్వాగతం!' : 'Welcome to AgriShield AI!')
      );

      if (role === 'equipment_provider') {
        navigate('/provider/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error(err);
      const raw = err.response?.data?.detail;
      const detail = Array.isArray(raw)
        ? raw.map(e => e.msg || JSON.stringify(e)).join(', ')
        : (typeof raw === 'string' ? raw : (isTe ? 'ఖాతా నమోదు విఫలమైంది. దయచేసి వివరాలను సరిచూసుకోండి.' : 'Failed to create account. Please check your information.'));
      setErrorMsg(detail);
      toast.error('Registration Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        className="w-full max-w-lg rounded-3xl bg-slate-950/85 backdrop-blur-2xl border-2 border-emerald-500/40 shadow-[0_25px_70px_rgba(0,0,0,0.85)] p-6 sm:p-8 relative overflow-hidden z-10 my-4 text-white"
      >
        {/* Subtle Transparent AgriShield Emblem Watermark in Card Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
          <AgriShieldWatermark className="w-96 h-96 opacity-[0.14] text-emerald-400" />
        </div>

        <div className="relative z-10">
          {/* Header: Logo, Brand & Step Indicator */}
          <div className="flex items-center justify-between mb-3">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-black text-white tracking-tight text-xl font-display block drop-shadow-sm">
                  AgriShield <span className="text-emerald-400">AI</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-300/80 block -mt-0.5">
                  {isTe ? 'రైతు నమోదు వేదిక' : 'Farmer Registration'}
                </span>
              </div>
            </Link>

            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              Step {step} of 2
            </span>
          </div>

          {/* Heading */}
          <div className="mt-2 mb-4">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-sm">
              {step === 1 
                ? (isTe ? 'కొత్త ఖాతా తెరవండి' : 'Create Account') 
                : (role === 'farmer' ? (isTe ? 'మీ 8 పంటల ఎంపిక' : 'Your 8 AI Crops') : (isTe ? 'యంత్రాల వివరాలు' : 'Machinery Fleet Setup'))}
            </h1>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              {isTe ? 'ఇప్పటికే ఖాతా ఉందా?' : 'Already have an account?'}{' '}
              <Link to="/login" className="font-black text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                {isTe ? 'లాగిన్ అవ్వండి (Sign In)' : 'Sign In'}
              </Link>
            </p>
          </div>

          {/* ── ROLE SWITCHER WITH COLOR GLOW (Step 1) ── */}
          {step === 1 && (
            <div className="mb-4 p-1.5 rounded-2xl bg-black/40 border border-white/15 grid grid-cols-2 gap-2">
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
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border-2 border-rose-500/50 text-rose-200 text-xs font-bold leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* ══ STEP 1: Account Credentials & Farm Location ══ */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-3.5">
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

              {/* Name */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                  {role === 'equipment_provider' ? (isTe ? 'ప్రదాత / ఏజెన్సీ పేరు' : 'Provider / Business Name') : (isTe ? 'రైతు పూర్తి పేరు' : 'Full Name')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'equipment_provider' ? 'e.g. Balaji Agro Machinery Hub' : (isTe ? 'ఉదా: రమేష్ రెడ్డి' : 'e.g. Ramesh Reddy')}
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                  />
                </div>
              </div>

              {/* Username (Replaced Mobile Number with Username) */}
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                  {isTe ? 'యూజర్‌నేమ్ (Username)' : 'Username'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={isTe ? 'ఉదా: farmer1 లేదా మీ యూజర్‌నేమ్' : 'e.g. farmer1 or your username'}
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                  />
                </div>
              </div>

              {/* Passwords in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                    {isTe ? 'పాస్‌వర్డ్' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 pr-9 py-3 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                    {isTe ? 'పాస్‌వర్డ్ సరిచూడండి' : 'Confirm Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 pr-9 py-3 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Location: Village & District */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{role === 'equipment_provider' ? (isTe ? 'హబ్ గ్రామం/నగరం' : 'Hub Village/Town') : (isTe ? 'గ్రామం' : 'Village')}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Pasupugallu"
                    className="w-full px-3.5 py-3 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-white tracking-wide drop-shadow-sm">
                    {isTe ? 'జిల్లా' : 'District'}
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Prakasam"
                    className="w-full px-3.5 py-3 rounded-2xl bg-white text-slate-950 font-bold text-sm placeholder-slate-400 border-2 border-white/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 shadow-md transition-all outline-none"
                  />
                </div>
              </div>

              {/* Next Step Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] border ${
                    role === 'equipment_provider'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-[0_0_25px_rgba(99,102,241,0.55)] border-indigo-300/40'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_0_25px_rgba(16,185,129,0.55)] border-emerald-300/40'
                  }`}
                >
                  <span>{role === 'farmer' ? (isTe ? 'తదుపరి: పంటల ఎంపిక' : 'Next: Select Crops') : (isTe ? 'తదుపరి: యంత్రాల వివరాలు' : 'Next: Setup Fleet')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          )}

          {/* ══ STEP 2: Role Configuration ══ */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 2A: For Farmer -> 8 Selected Crops Picker */}
              {role === 'farmer' ? (
                <div>
                  <FarmerCropPicker
                    selectedCrops={selectedCrops}
                    onChange={setSelectedCrops}
                    isTe={isTe}
                    maxCrops={8}
                  />
                </div>
              ) : (
                /* 2B: For Equipment Provider -> Fleet Categories */
                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-black text-white">
                      {isTe ? 'మీరు అద్దెకు అందించే యంత్రాల కేటగిరీలను ఎంచుకోండి' : 'Select Machinery Categories You Provide for Rent'}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PROVIDER_EQUIPMENT_OPTIONS.map((item) => {
                      const isSelected = equipmentTypes.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleEquipmentType(item.id)}
                          className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-2 border-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.6)]'
                              : 'bg-slate-900/80 border-white/15 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-2xl">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black truncate">{isTe ? item.teluguName : item.name}</p>
                              {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                            </div>
                            <p className="text-[10px] text-slate-300/80 mt-0.5 line-clamp-1">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Operational Coverage Radius */}
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/15">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black text-white">
                        {isTe ? 'సేవా పరిధి' : 'Service Radius'}
                      </label>
                      <span className="text-xs font-black text-indigo-300">
                        {providerRadiusKm} km
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={providerRadiusKm}
                      onChange={(e) => setProviderRadiusKm(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>5 km (Local)</span>
                      <span>50 km (Mandal)</span>
                      <span>100 km (District)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Back and Final Submit Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3.5 rounded-2xl border border-white/20 text-xs font-bold text-slate-200 hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{isTe ? 'వెనుకకు' : 'Back'}</span>
                </button>

                <Button
                  type="submit"
                  loading={loading}
                  className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-xl transition-all cursor-pointer active:scale-[0.99] border ${
                    role === 'equipment_provider'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-[0_0_25px_rgba(99,102,241,0.55)] border-indigo-300/40'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_0_25px_rgba(16,185,129,0.55)] border-emerald-300/40'
                  }`}
                >
                  {loading
                    ? (isTe ? 'నమోదు చేస్తోంది...' : 'Creating Account...')
                    : (isTe ? 'ఖాతా నమోదు పూర్తి చేయండి' : 'COMPLETE REGISTRATION')}
                </Button>
              </div>
            </form>
          )}

          {/* Bottom Footer Info (Cleaned: removed '256-bit Secure') */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              AgriShield Verified Platform
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
