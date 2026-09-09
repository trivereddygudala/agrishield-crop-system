import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, ShieldCheck, Globe, Key, Save, LogOut, Check, AlertCircle, Sprout, ArrowRight, ChevronRight,
  Sun, Type, Contrast, Monitor, Cpu
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHardwareMode } from '../hooks/useHardwareMode';
import { useTranslation } from 'react-i18next';
import { Card, Button, Input, Select } from '../components/ui/index';

const SettingsPage = () => {
  const { user, logout, updateProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const { hardwareMode, toggleHardwareMode } = useHardwareMode();
  const userRole = user?.role?.toLowerCase() || 'farmer';
  const isFarmer = userRole === 'farmer';
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const [fullName, setFullName] = useState(user?.name || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobile || '');
  const [email, setEmail] = useState(user?.email || '');
  const [language, setLanguage] = useState(user?.preferred_language || 'en');

  // ── Display Accessibility Modes ──
  const [fieldMode, setFieldMode] = useState(() => localStorage.getItem('fieldMode') === 'true');
  const [farmerMode, setFarmerMode] = useState(() => localStorage.getItem('farmerMode') === 'true');

  useEffect(() => {
    if (fieldMode) {
      document.documentElement.classList.add('field-mode');
      localStorage.setItem('fieldMode', 'true');
    } else {
      document.documentElement.classList.remove('field-mode');
      localStorage.setItem('fieldMode', 'false');
    }
  }, [fieldMode]);

  useEffect(() => {
    if (farmerMode) {
      document.documentElement.classList.add('farmer-mode');
      localStorage.setItem('farmerMode', 'true');
    } else {
      document.documentElement.classList.remove('farmer-mode');
      localStorage.setItem('farmerMode', 'false');
    }
  }, [farmerMode]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setMobileNumber(user.mobile || '');
      setEmail(user.email || '');
      setLanguage(user.preferred_language || 'en');
    }
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setToastMsg('');

    try {
      if (password) {
        if (password !== confirmPassword) {
          setErrorMsg('Password confirmation does not match.');
          setLoading(false);
          return;
        }
      }

      const payload = {
        name: fullName,
        mobile: mobileNumber,
        preferred_language: user?.preferred_language || i18n.language || 'en',
      };

      if (password) {
        payload.password = password;
      }

      await updateProfile(payload);
      setToastMsg('Account profile updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to save account settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-4xl mx-auto w-full pb-16"
    >
      {/* Title Header */}
      <div className="flex flex-col gap-1 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {t('settings_page.title', 'System Settings')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
          {t('settings_page.subtitle', 'Manage your account, preferences, and notifications.')}
        </p>
      </div>

      {/* Notifications Quick Link */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-500 dark:text-white/40 uppercase tracking-widest px-1">
          {userRole === 'admin' ? t('settings_page.admin_access', 'Administrative Quick Access') : t('settings_page.inbox_alerts', 'Inbox & Alerts')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/notifications" className="block">
            <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-emerald-500/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔔</span>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{t('settings_page.notifications_inbox', 'Notifications Inbox')}</p>
                  <p className="text-[10px] text-slate-450 dark:text-white/30">{t('settings_page.notifications_desc', 'View recent system alerts and broadcasts')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
            </Card>
          </Link>

          <Link to="/languages" className="block">
            <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-teal-500/40">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{t('more.tools.languages.label', 'Languages')}</p>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-teal-500/15 text-teal-700 dark:text-teal-300">
                      1-Tap
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 dark:text-white/30">{t('settings_page.language_desc', 'Switch Telugu, Hindi, Tamil & 9 more Indian languages')}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30 shrink-0" />
            </Card>
          </Link>

          {userRole === 'admin' && (
            <Link to="/admin" className="block">
              <Card hover className="p-4 flex items-center justify-between gap-3 h-20 border border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/60">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div className="text-left">
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{t('settings_page.admin_center', 'Admin Control Center')}</p>
                    <p className="text-[10px] text-slate-450 dark:text-white/30">{t('settings_page.admin_center_desc', 'Users, broadcast, OTA, logs & specs')}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
              </Card>
            </Link>
          )}
        </div>
      </div>

      {/* ── Display Accessibility Modes ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-500 dark:text-white/40 uppercase tracking-widest px-1">
          {t('settings_page.display_modes', 'Display Accessibility')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Field Mode Toggle */}
          <button
            type="button"
            id="field-mode-toggle"
            onClick={() => setFieldMode(v => !v)}
            className={`no-touch-target text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-3 min-h-0 ${
              fieldMode
                ? 'bg-amber-50 border-amber-400 dark:bg-amber-950/30 dark:border-amber-500'
                : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-amber-300/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                fieldMode
                  ? 'bg-amber-400/20 border-amber-400/40 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'
              }`}>
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-sm font-black leading-tight ${
                  fieldMode ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-white'
                }`}>
                  ☀️ {t('settings_page.field_mode', 'Field Mode')}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-white/35 mt-0.5 leading-relaxed">
                  {t('settings_page.field_mode_desc', 'High contrast • Max readability for outdoor sunlight')}
                </p>
              </div>
            </div>
            {/* Toggle Switch */}
            <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
              fieldMode ? 'bg-amber-400' : 'bg-slate-200 dark:bg-white/10'
            }`}>
              <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                fieldMode ? 'left-[23px]' : 'left-[3px]'
              }`} />
            </div>
          </button>

          {/* Farmer Mode Toggle */}
          <button
            type="button"
            id="farmer-mode-toggle"
            onClick={() => setFarmerMode(v => !v)}
            className={`no-touch-target text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-3 min-h-0 ${
              farmerMode
                ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-500'
                : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-emerald-300/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                farmerMode
                  ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'
              }`}>
                <Type className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-sm font-black leading-tight ${
                  farmerMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'
                }`}>
                  🌾 {t('settings_page.farmer_mode', 'Farmer Mode')}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-white/35 mt-0.5 leading-relaxed">
                  {t('settings_page.farmer_mode_desc', 'Larger text (120%) • Easier reading • Better accessibility')}
                </p>
              </div>
            </div>
            {/* Toggle Switch */}
            <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
              farmerMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
            }`}>
              <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                farmerMode ? 'left-[23px]' : 'left-[3px]'
              }`} />
            </div>
          </button>

        </div>

        {/* Status info */}
        {(fieldMode || farmerMode) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-[11px] font-bold">
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>
              {[fieldMode && `☀️ ${t('settings_page.field_mode', 'Field Mode')} ON`, farmerMode && `🌾 ${t('settings_page.farmer_mode', 'Farmer Mode')} ON`].filter(Boolean).join(' · ')}
              {' '}{t('settings_page.auto_saved', '— settings saved automatically.')}
            </span>
          </div>
        )}
      </div>

      {/* ── Hardware & IoT Integration Setup Mode ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-500 dark:text-white/40 uppercase tracking-widest px-1">
          {t('settings_page.iot_mode', 'Hardware & IoT Setup')}
        </h3>
        <button
          type="button"
          id="hardware-mode-toggle"
          onClick={toggleHardwareMode}
          className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            hardwareMode
              ? 'bg-cyan-500/10 border-cyan-400 dark:bg-cyan-950/40 dark:border-cyan-500 shadow-md shadow-cyan-500/5'
              : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-3 rounded-2xl border shrink-0 ${
              hardwareMode
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-600 dark:text-cyan-400'
                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'
            }`}>
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-base font-black leading-tight ${
                  hardwareMode ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-white'
                }`}>
                  {hardwareMode ? `🔌 ${t('settings_page.iot_enabled', 'Hardware / IoT Setup: ENABLED')}` : `🌱 ${t('settings_page.software_mode', 'Software-Only Mode (Farmer Testing)')}`}
                </p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  hardwareMode
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-400/40'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {hardwareMode ? t('settings_page.hw_active', 'All Hardware Features Active') : t('settings_page.hw_hidden', 'IoT Menus Hidden')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/45 mt-1 leading-relaxed max-w-xl">
                {hardwareMode
                  ? t('settings_page.hw_enabled_desc', 'Showing all ESP32 devices, Node Control Panel, MicroSD Storage, and live sensor telemetry streams.')
                  : t('settings_page.hw_disabled_desc', 'Farmer testing mode — hides ESP32 menus, battery statuses, and sensor gauges for a clean experience.')}
              </p>
            </div>
          </div>

          {/* Large Toggle Switch */}
          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-white/40 hidden sm:inline">
              {hardwareMode ? t('settings_page.turn_off', 'Turn OFF') : t('settings_page.turn_on', 'Turn ON')}
            </span>
            <div className={`relative w-14 h-8 rounded-full transition-colors duration-200 shrink-0 ${
              hardwareMode ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-white/15'
            }`}>
              <span className={`absolute top-[4px] w-[24px] h-[24px] rounded-full bg-white shadow-md transition-all duration-200 ${
                hardwareMode ? 'left-[26px]' : 'left-[4px]'
              }`} />
            </div>
          </div>
        </button>
      </div>

      {/* Redirect Banner to Dedicated Farm Tab — Farmer only */}
      {isFarmer && (
        <Card glass className="p-4 border border-emerald-500/20 bg-emerald-500/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/10 shrink-0">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">{t('settings_page.farm_redirect_title', 'Looking for Farm, Crop & IoT Settings?')}</h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-white/45 mt-1 leading-relaxed">
                {t('settings_page.farm_redirect_desc', 'Farm location, crop varieties, ESP32 pairing, and alert settings are in the dedicated')} <strong>{t('nav.farm', 'My Farm')}</strong> {t('settings_page.farm_redirect_tab', 'tab.')}
              </p>
            </div>
          </div>

          <Link to="/farm" className="w-full sm:w-auto shrink-0">
            <Button size="sm" leftIcon={<Sprout className="w-4 h-4" />} rightIcon={<ArrowRight className="w-3.5 h-3.5" />} className="w-full sm:w-auto shadow-sm">
              {t('settings_page.go_to_farm', 'Go to My Farm')}
            </Button>
          </Link>
        </Card>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Personal Details */}
        <Card glass className="p-6 space-y-6 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>{t('settings_page.personal_info', 'Personal Information')}</h2>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{t('settings_page.personal_info_desc', 'Update your account name and mobile number.')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('profile_page.form.full_name', 'Full Name')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-white dark:bg-slate-900 text-xs font-bold"
            />
            <Input
              label={t('settings_page.mobile_label', 'Mobile Phone Number')}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className="bg-white dark:bg-slate-900 text-xs font-bold"
            />
            <Input
              label={t('profile_page.form.email', 'Email Address')}
              value={email}
              disabled
              helperText="Email address cannot be changed."
              className="bg-white dark:bg-slate-900 text-xs font-bold"
            />
          </div>
        </Card>

        {/* Security / Password */}
        <Card glass className="p-6 space-y-6 border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>{t('settings_page.account_security', 'Account Security')}</h2>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{t('settings_page.password_hint', 'Update your login password (leave blank to keep current).')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('settings_page.new_password', 'New Password')}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white dark:bg-slate-900 text-xs font-bold"
            />
            <Input
              label={t('settings_page.confirm_password', 'Confirm Password')}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-white dark:bg-slate-900 text-xs font-bold"
            />
          </div>
        </Card>

        {/* Save Button & Logout */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            leftIcon={<LogOut className="w-4 h-4 text-rose-500" />}
            className="w-full sm:w-auto border-rose-200 dark:border-rose-950/40 text-rose-500 hover:bg-rose-500/10"
          >
            {t('settings_page.logout_btn', 'Log Out Account')}
          </Button>

          <Button
            type="submit"
            isLoading={loading}
            size="lg"
            leftIcon={<Save className="w-5 h-5 text-white" />}
            className="w-full sm:w-auto shadow-lg shadow-emerald-500/20"
          >
            {t('settings_page.save_btn', 'Save Account Settings')}
          </Button>
        </div>
      </form>
    </motion.div>
  );
};

export default SettingsPage;
