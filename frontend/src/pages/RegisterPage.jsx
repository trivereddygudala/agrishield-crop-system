import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Eye, EyeOff, MapPin, ShieldCheck, Sparkles, Globe, Sprout, Truck, ArrowRight, ArrowLeft, Check, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/index';
import { useToast } from '../components/ui/toast';
import { useTranslation } from 'react-i18next';
import LanguageSelectModal from '../components/common/LanguageSelectModal';
import { getLanguageByCode } from '../data/languages';
import NatureParticles from '../components/animations/NatureParticles';
import FarmerCropPicker from '../components/auth/FarmerCropPicker';
import AuthWorkstationIllustration from '../components/auth/AuthWorkstationIllustration';

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

  // Multi-step registration flow: Step 1 = Account Credentials, Step 2 = Role Configuration (Crops for Farmer / Fleet for Provider)
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
        toast.info('At least one machinery type is required');
      }
    } else {
      setEquipmentTypes([...equipmentTypes, typeId]);
    }
  };

  const validateStep1 = () => {
    setErrorMsg('');
    const trimmedName = name.trim();
    if (!trimmedName || !password || !confirmPassword || !village) {
      const msg = t('auth.register.validation_all_required', 'All credential and location fields are required.');
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return false;
    }

    if (password.length < 4) {
      const msg = t('auth.register.validation_password_length', 'Password must be at least 4 characters long.');
      setErrorMsg(msg);
      toast.error('Validation Error', msg);
      return false;
    }

    if (password !== confirmPassword) {
      const msg = t('auth.register.validation_password_mismatch', 'Passwords do not match. Please re-enter.');
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
      const msg = isTe ? 'దయచేసి కనీసం 1 యంత్రాల రకాన్ని ఎంచుకోండి.' : 'Please select at least 1 machinery category.';
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
        : (typeof raw === 'string' ? raw : 'Failed to create account. Please check your information.');
      setErrorMsg(detail);
      toast.error('Registration Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
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

      {/* ── Modern Split-Card Presentation Container ── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-5xl rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.55)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 my-4"
      >
        {/* ══ LEFT SIDE: Clean Elevated Auth Form Card ══ */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white dark:bg-[#070e17] text-slate-900 dark:text-white border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800">
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
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  step === 1 ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  Step {step} of 2
                </span>
              </div>
            </div>

            <div className="mt-3 mb-5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {step === 1 ? (isTe ? 'కొత్త ఖాతా సృష్టించండి' : 'Create Account') : (role === 'farmer' ? (isTe ? 'మీ 8 పంటల ఎంపిక' : 'Your 8 AI Crops') : (isTe ? 'యంత్రాల వివరాలు' : 'Machinery Fleet Setup'))}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isTe ? 'ఇప్పటికే ఖాతా ఉందా?' : 'Already have an account?'}{' '}
                <Link to="/login" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  {t('auth.register.login_link', 'Sign In')}
                </Link>
              </p>
            </div>

            {/* ── ROLE SELECTOR (Always visible so user knows their portal type) ── */}
            {step === 1 && (
              <div className="mb-5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-1.5">
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
                  <span>{isTe ? 'రైతు (Farmer)' : 'Farmer (రైతు)'}</span>
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
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-2xl flex items-center gap-2">
                <span>⚠️</span> {errorMsg}
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
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {role === 'equipment_provider' ? (isTe ? 'ప్రదాత / ఏజెన్సీ పేరు' : 'Provider / Business Name') : t('auth.register.full_name', 'Full Name')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={role === 'equipment_provider' ? 'e.g. Balaji Agro Machinery Hub' : 'e.g. Ramesh Reddy'}
                      className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Optional Email / Username */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {t('auth.login.username_or_email', 'Mobile / Email')}
                  </label>
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g. 9876543210 or name@agrishield.com"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Passwords in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('auth.register.password', 'Password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('auth.register.confirm_password', 'Confirm')}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Location: Village & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{role === 'equipment_provider' ? (isTe ? 'బేస్ హబ్ గ్రామం / నగరం' : 'Base Hub Village / Town') : (isTe ? 'గ్రామం' : 'Village')}</span>
                    </label>
                    <input
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Pasupugallu"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {isTe ? 'జిల్లా' : 'District'}
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="e.g. Prakasam"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Next Step Button */}
                <div className="pt-3">
                  <Button
                    type="submit"
                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                      role === 'equipment_provider'
                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    }`}
                  >
                    <span>{role === 'farmer' ? (isTe ? 'పంటల ఎంపికకు వెళ్లండి' : 'Next: Select 8 Crops') : (isTe ? 'యంత్రాల వివరాలకు వెళ్లండి' : 'Next: Setup Fleet')}</span>
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
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {isTe ? 'మీరు అద్దెకు అందించే యంత్రాల రకాలను ఎంచుకోండి' : 'Select Equipment Categories You Provide for Rent'}
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {isTe ? 'రైతు బుకింగ్‌లు ఈ కేటగిరీల ప్రకారం మీ ప్రొఫైల్‌కు వస్తాయి.' : 'Farmers in your area will send rental booking orders for these categories.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {PROVIDER_EQUIPMENT_OPTIONS.map((item) => {
                        const isSelected = equipmentTypes.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleEquipmentType(item.id)}
                            className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-950 dark:text-white shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <span className="text-2xl">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-black truncate">{isTe ? item.teluguName : item.name}</p>
                                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{item.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Operational Coverage Radius */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                          {isTe ? 'కార్యాచరణ సేవా పరిధి' : 'Service Coverage Radius'}
                        </label>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
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
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>5 km (Local Village)</span>
                        <span>50 km (Mandal)</span>
                        <span>100 km (District)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Back and Final Submit Actions */}
                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{isTe ? 'వెనుకకు' : 'Back'}</span>
                  </button>

                  <Button
                    type="submit"
                    loading={loading}
                    className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-lg transition-all ${
                      role === 'equipment_provider'
                        ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    }`}
                  >
                    {loading
                      ? (isTe ? 'ఖాతా సృష్టిస్తోంది...' : 'Creating Account...')
                      : (isTe ? 'ఖాతా నమోదు పూర్తి చేయండి' : 'COMPLETE REGISTRATION')}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Bottom Footer Info */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              AgriShield Verified Platform
            </span>
            <span>Zero Brokerage &bull; Direct Connect</span>
          </div>
        </div>

        {/* ══ RIGHT SIDE: Modern Workstation Vector Illustration ══ */}
        <div className="lg:col-span-5 p-4 sm:p-6 lg:p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900/40">
          <AuthWorkstationIllustration role={role} isTe={isTe} />
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
