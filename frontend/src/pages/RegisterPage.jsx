import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, User, Lock, Eye, EyeOff, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/index';
import { useToast } from '../components/ui/toast';

const RegisterPage = () => {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [village, setVillage] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [activeStep, setActiveStep] = useState(0); // Onboarding slides index

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const onboardingSlides = [
    { title: "📸 Step 1: Snap Leaf Photo", desc: "Take a clear, close-up picture of the infected crop leaf using your phone camera." },
    { title: "🟢 Step 2: Instant AI Scan", desc: "AgriShield AI uses NIM endpoints to scan and detect symptoms in under 5 seconds." },
    { title: "🌾 Step 3: Treatment & Spray Advice", desc: "Get organic & chemical recommendations, water guidance, and spray dosages." }
  ];

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % onboardingSlides.length);
    }, 4500);
    return () => clearInterval(slideTimer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    const trimmedName = name.trim();
    if (!trimmedName || !password || !confirmPassword || !village) {
      setErrorMsg('All fields are required.');
      toast.error('Validation Error', 'All fields are required.');
      return;
    }

    if (password.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      toast.error('Validation Error', 'Password must be at least 4 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      toast.error('Validation Error', 'Passwords do not match.');
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
      toast.success('Account Created!', 'Welcome to AgriShield AI.');
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
            Create Account
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
            Start protecting your crops with machine intelligence
          </p>
        </div>
        {/* Custom styled transparent card to bypass default light bg styles */}
        <div 
          className="p-8 border border-white/10 bg-[#0c1220]/60 backdrop-blur-xl relative overflow-hidden rounded-[24px] shadow-[0_0_50px_-12px_rgba(16,185,129,0.15)]"
        >
          {/* Laser scanning strip at top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          
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
                Full Name or Username
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
                  placeholder="e.g. Ramesh or farmer1"
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Password
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
                  placeholder="Enter password (e.g. 1234)"
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
                Confirm Password
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
                  placeholder="Re-enter password"
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
                Village / District
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
                  placeholder="e.g. Rampur, Bihar"
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-2xl bg-white/[0.02] text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="language" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Preferred Language
              </label>
              <select
                id="language"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="block w-full px-3 py-3 border border-white/10 rounded-2xl bg-[#0d1527] text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
              >
                <option value="en">English (English)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="ml">മലയാളം (Malayalam)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="mr">மরাঠী (Marathi)</option>
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
              Register & Start Scanning
            </Button>
          </form>

          {/* Project thematic details panel */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> AgriShield Secure</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> PyTorch Diagnostic</span>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6 font-bold">
            Already have an account?{' '}
            <Link to="/login" className="font-extrabold text-emerald-500 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
