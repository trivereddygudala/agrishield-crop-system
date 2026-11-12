import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wrench, Clock, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, X, Hammer
} from 'lucide-react';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Custom event name for instant cross-tab / cross-component communication
const MAINTENANCE_EVENT = 'agrishield-maintenance-updated';

/**
 * Shared hook to query and subscribe to platform maintenance mode status.
 * Auto-detects expiry via ends_at timestamp.
 */
export const useMaintenanceMode = () => {
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    message: '',
    estimated_minutes: 30,
    ends_at: null,
    updated_at: null
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      let res;
      try { res = await API.get('/api/admin/maintenance/public'); }
      catch {
        try { res = await API.get('/api/maintenance'); }
        catch {
          try { res = await API.get('/api/v1/maintenance'); }
          catch { res = await API.get('/api/admin/maintenance'); }
        }
      }
      if (res.data?.maintenance) {
        const m = res.data.maintenance;
        if (m.ends_at && new Date(m.ends_at).getTime() <= Date.now()) {
          setMaintenance({ ...m, enabled: false });
        } else {
          setMaintenance(m);
        }
      }
    } catch (_) { /* graceful silence */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStatus();
    }, 10000);

    const handleLocalEvent = (e) => {
      if (e.detail) {
        setMaintenance(prev => ({
          ...prev,
          ...(typeof e.detail === 'boolean' ? { enabled: e.detail } : e.detail)
        }));
      } else { fetchStatus(); }
    };
    window.addEventListener(MAINTENANCE_EVENT, handleLocalEvent);
    window.addEventListener('maintenance-updated', handleLocalEvent);
    return () => {
      clearInterval(interval);
      window.removeEventListener(MAINTENANCE_EVENT, handleLocalEvent);
      window.removeEventListener('maintenance-updated', handleLocalEvent);
    };
  }, [fetchStatus]);

  // Derive remaining seconds from ends_at (if set by backend)
  const remainingSeconds = React.useMemo(() => {
    if (!maintenance?.enabled || !maintenance?.ends_at) return null;
    try {
      const endsAt = new Date(maintenance.ends_at).getTime();
      const diff = Math.floor((endsAt - Date.now()) / 1000);
      return diff > 0 ? diff : 0;
    } catch { return null; }
  }, [maintenance]);

  const isActuallyActive = Boolean(
    maintenance?.enabled && (!maintenance.ends_at || new Date(maintenance.ends_at).getTime() > Date.now())
  );

  return {
    isMaintenanceMode: isActuallyActive,
    maintenanceMessage: maintenance?.message || '',
    estimatedMinutes: maintenance?.estimated_minutes || 30,
    endsAt: maintenance?.ends_at || null,
    maintenance,
    refreshMaintenance: fetchStatus,
    remainingSeconds,
    loading
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Countdown timer hook — counts down from remainingSeconds, auto-fetches at 0
// ─────────────────────────────────────────────────────────────────────────────
function useCountdown(initialSeconds, onExpire) {
  const [secs, setSecs] = useState(initialSeconds);
  const ref = useRef(initialSeconds);

  useEffect(() => {
    ref.current = initialSeconds;
    setSecs(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!initialSeconds || initialSeconds <= 0) {
      if (initialSeconds === 0) {
        onExpire?.();
      }
      return;
    }
    const tick = setInterval(() => {
      ref.current = Math.max(0, ref.current - 1);
      setSecs(ref.current);
      if (ref.current === 0) {
        clearInterval(tick);
        window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: { enabled: false } }));
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [initialSeconds, onExpire]);

  return secs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Format seconds → "1h 20m 05s" or "24m 10s" or "45s"
// ─────────────────────────────────────────────────────────────────────────────
function formatCountdown(totalSecs) {
  if (totalSecs === null || totalSecs === undefined) return null;
  if (totalSecs <= 0) return null;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatDuration(minutes, t) {
  if (!minutes || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} ${t('maintenance_banner.mins', 'min')}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}${t('maintenance_banner.mins', 'min')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTAL-SPECIFIC SERVICE LISTS
// ─────────────────────────────────────────────────────────────────────────────
function usePortalContent(role, t) {
  const isFarmer   = !role || role === 'farmer' || role === 'user';
  const isProvider = role === 'equipment_provider' || role === 'provider';

  if (isProvider) {
    return {
      portalLabel: t('maintenance_banner.provider_portal', 'Equipment Provider Portal'),
      pausedItems: [
        t('maintenance_banner.prov_paused_bookings',  'New booking requests & acceptance'),
        t('maintenance_banner.prov_paused_fleet',     'Fleet status updates & availability toggle'),
        t('maintenance_banner.prov_paused_earnings',  'Earnings dashboard & payout requests'),
        t('maintenance_banner.prov_paused_uploads',   'Equipment photo & document uploads'),
      ],
      workingItems: [
        t('maintenance_banner.prov_works_view',       'Viewing existing orders & history'),
        t('maintenance_banner.prov_works_profile',    'Reading your provider profile'),
        t('maintenance_banner.prov_works_market',     'Checking market rates'),
        t('maintenance_banner.prov_works_support',    'WhatsApp support line'),
      ],
    };
  }

  // Default: farmer
  return {
    portalLabel: t('maintenance_banner.farmer_portal', 'Farmer Portal'),
    pausedItems: [
      t('maintenance_banner.paused_ai',      'AI crop disease scanning'),
      t('maintenance_banner.paused_edits',   'Profile & farm data edits'),
      t('maintenance_banner.paused_booking', 'Equipment & tractor booking'),
      t('maintenance_banner.paused_uploads', 'Leaf photo uploads'),
    ],
    workingItems: [
      t('maintenance_banner.works_view',    'Viewing farm data & past scan reports'),
      t('maintenance_banner.works_market',  'Checking mandi market prices'),
      t('maintenance_banner.works_weather', 'Weather & spray window forecast'),
      t('maintenance_banner.works_support', 'WhatsApp & helpdesk support'),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING MINI-PILL  (shown after banner is dismissed)
// ─────────────────────────────────────────────────────────────────────────────
const MiniPill = ({ countdownLabel, estimatedLabel, onClick, t }) => (
  <div className="fixed bottom-20 right-4 z-50 animate-bounce-slow">
    <button
      onClick={onClick}
      title={t('maintenance_banner.expand', 'Show maintenance details')}
      className="group flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
        boxShadow: '0 4px 20px rgba(146,64,14,0.55)'
      }}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-200" />
      </span>
      <Wrench className="w-3.5 h-3.5 text-amber-200" />
      <span className="text-[11px] font-bold text-amber-100 whitespace-nowrap">
        {t('maintenance_banner.back_soon', 'Maintenance')}
        {countdownLabel
          ? ` · ${countdownLabel}`
          : estimatedLabel ? ` · ~${estimatedLabel}` : ''}
      </span>
      <ChevronUp className="w-3 h-3 text-amber-300 group-hover:text-white transition-colors" />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BANNER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const MaintenanceModeBanner = () => {
  const {
    isMaintenanceMode, maintenanceMessage, estimatedMinutes,
    remainingSeconds, refreshMaintenance
  } = useMaintenanceMode();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [expanded, setExpanded]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed whenever maintenance flips back on
  useEffect(() => { if (isMaintenanceMode) setDismissed(false); }, [isMaintenanceMode]);

  // Countdown timer — when it hits 0, re-fetch to get the auto-expired state
  const secsLeft = useCountdown(remainingSeconds, refreshMaintenance);
  const countdownLabel = formatCountdown(secsLeft);
  const estimatedLabel = formatDuration(estimatedMinutes, t);

  // ── Admins have their own control panel — never show this banner to them ──
  if (user?.role === 'admin') return null;
  if (!isMaintenanceMode) return null;

  const { portalLabel, pausedItems, workingItems } = usePortalContent(user?.role, t);

  const customMessage = (maintenanceMessage || '').trim() ||
    t('maintenance_banner.message',
      'AgriShield is undergoing scheduled maintenance to bring you better features. All your farm data is safe.');

  // ── Dismissed → floating mini-pill ──
  if (dismissed) {
    return (
      <MiniPill
        countdownLabel={countdownLabel}
        estimatedLabel={estimatedLabel}
        onClick={() => setDismissed(false)}
        t={t}
      />
    );
  }

  // ── Full banner ──
  return (
    <div role="alert" aria-live="polite" className="w-full relative z-40 overflow-hidden">
      <div
        className="relative"
        style={{ background: 'linear-gradient(135deg, #451a03 0%, #78350f 40%, #92400e 70%, #78350f 100%)' }}
      >
        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fde68a 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        {/* Top glow line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, #fbbf24, #f59e0b, #fbbf24, transparent)' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">

          {/* ── Collapsed summary bar ── */}
          <div className="flex items-center gap-3 py-3">

            {/* Icon */}
            <div
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              <Hammer className="w-4.5 h-4.5 text-amber-300" style={{ width: '1.1rem', height: '1.1rem' }} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amber-100 font-bold text-sm">
                  {t('maintenance_banner.title', 'Platform Under Maintenance')}
                </span>

                {/* Portal label */}
                <span
                  className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(251,191,36,0.2)', color: '#fde68a' }}
                >
                  {portalLabel}
                </span>

                {/* Live countdown (if ends_at known) OR estimated duration */}
                {countdownLabel ? (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow tabular-nums"
                    style={{ background: '#fde68a', color: '#78350f' }}
                  >
                    <Clock className="w-3 h-3" />
                    {countdownLabel}
                  </span>
                ) : estimatedLabel ? (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow"
                    style={{ background: '#fde68a', color: '#78350f' }}
                  >
                    <Clock className="w-3 h-3" />
                    ~{estimatedLabel}
                  </span>
                ) : null}

                <span
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fef3c7' }}
                >
                  {t('maintenance_banner.back_soon', 'Back soon')} 🙏
                </span>
              </div>

              <p className="mt-0.5 text-[12px] text-amber-200 leading-snug truncate max-w-xl">
                {customMessage}
              </p>
            </div>

            {/* Controls */}
            <div className="shrink-0 flex items-center gap-1.5">
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-amber-200 hover:text-white transition-colors cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{expanded ? t('common.close', 'Less') : t('maintenance_banner.expand', 'Details')}</span>
              </button>

              <button
                onClick={() => setDismissed(true)}
                title={t('maintenance_banner.dismiss', 'Dismiss banner')}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-300 transition-all cursor-pointer"
                style={{ background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Expanded panel ── */}
          {expanded && (
            <div
              className="mb-4 rounded-2xl overflow-hidden border"
              style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(251,191,36,0.2)' }}
            >
              <div className="grid sm:grid-cols-2" style={{ borderBottom: '1px solid rgba(251,191,36,0.15)' }}>

                {/* Paused */}
                <div className="p-4" style={{ borderRight: '1px solid rgba(251,191,36,0.1)' }}>
                  <p className="flex items-center gap-2 text-xs font-bold text-amber-200 mb-3">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    {t('maintenance_banner.what_paused', 'Temporarily paused:')}
                  </p>
                  <ul className="space-y-2">
                    {pausedItems.map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[12px] text-amber-100">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#fb7185' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Still works */}
                <div className="p-4">
                  <p className="flex items-center gap-2 text-xs font-bold text-amber-200 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {t('maintenance_banner.still_works', 'Still working normally:')}
                  </p>
                  <ul className="space-y-2">
                    {workingItems.map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-[12px] text-amber-100">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#34d399' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 text-center text-[11px] text-amber-300">
                {t('maintenance_banner.sorry_note',
                  'We apologize for the inconvenience. Thank you for your patience! 🙏')}
              </div>
            </div>
          )}
        </div>

        {/* Bottom glow line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, #92400e, #b45309, #92400e, transparent)' }} />
      </div>
    </div>
  );
};

export default MaintenanceModeBanner;
