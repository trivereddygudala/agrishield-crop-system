import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Sparkles, CheckCircle2, AlertTriangle, Droplets,
  Calendar, ShieldAlert, ShoppingBag, CreditCard,
  Truck, ArrowRight, Check, X, RefreshCw, ChevronDown,
  ChevronUp, ExternalLink, Radio, Cloud, Info, RotateCcw, Clock
} from 'lucide-react';
import { Card, Badge, Button, Skeleton } from '../ui/index';
import API from '../../services/api';
import { useTranslation } from 'react-i18next';

const PRIORITY_CONFIG = {
  P0: {
    labelEn: 'Urgent',
    labelTe: 'తక్షణమే',
    badgeVariant: 'critical',
    borderClass: 'border-rose-500/80 dark:border-rose-500/70',
    bgClass: 'bg-rose-50/70 dark:bg-rose-950/30',
    dotClass: 'bg-rose-500 animate-ping'
  },
  P1: {
    labelEn: 'High',
    labelTe: 'ముఖ్యమైనది',
    badgeVariant: 'warning',
    borderClass: 'border-amber-500/80 dark:border-amber-500/70',
    bgClass: 'bg-amber-50/70 dark:bg-amber-950/30',
    dotClass: 'bg-amber-500'
  },
  P2: {
    labelEn: 'Normal',
    labelTe: 'సాధారణం',
    badgeVariant: 'healthy',
    borderClass: 'border-emerald-500/60 dark:border-emerald-500/50',
    bgClass: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    dotClass: 'bg-emerald-500'
  },
  P3: {
    labelEn: 'Info',
    labelTe: 'సమాచారం',
    badgeVariant: 'default',
    borderClass: 'border-slate-300 dark:border-slate-700',
    bgClass: 'bg-slate-50 dark:bg-slate-800/40',
    dotClass: 'bg-slate-400'
  }
};

const ACTION_TYPE_ICONS = {
  WATER: Droplets,
  CROP_TASK: Calendar,
  SPRAY: Sparkles,
  FERTILIZE: Sparkles,
  DISEASE_CHECK: ShieldAlert,
  INSPECT: ShieldAlert,
  HARVEST: Calendar,
  BUY_INPUT: ShoppingBag,
  PAYMENT: CreditCard,
  EQUIPMENT: Truck,
  MARKET: ArrowRight,
  WEATHER: Cloud,
  DEVICE: Radio
};

export default function SmartFarmerActionCenter({ farmId, onActionComplete }) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [activeBucket, setActiveBucket] = useState('today'); // 'today' | 'overdue' | 'upcoming' | 'completed'
  const [actionFilter, setActionFilter] = useState('ALL'); // 'ALL' | 'URGENT' | 'WATER' | 'CROP' | 'INPUT' | 'KHATA'
  const [showAll, setShowAll] = useState(false);
  const [actionLoadingMap, setActionLoadingMap] = useState({});
  const [completedMap, setCompletedMap] = useState({});

  const fetchActions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {
        bucket: activeBucket
      };
      if (farmId && farmId !== 'default') params.farm_id = farmId;
      params.limit = 30;

      const res = await API.get('/api/v1/farmer/actions', { params });
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('[ActionCenter] Failed to fetch actions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [farmId, activeBucket]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const handleCompleteAction = async (action) => {
    const aId = action.action_id;
    setActionLoadingMap(prev => ({ ...prev, [aId]: true }));
    setCompletedMap(prev => ({ ...prev, [aId]: true }));

    try {
      const params = {};
      if (farmId && farmId !== 'default') params.farm_id = farmId;
      await API.post(`/api/v1/farmer/actions/${encodeURIComponent(aId)}/complete`, null, { params });
      if (onActionComplete) onActionComplete(action);
      fetchActions(true);
    } catch (err) {
      console.warn('[ActionCenter] Error completing action:', err);
      setCompletedMap(prev => {
        const next = { ...prev };
        delete next[aId];
        return next;
      });
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [aId]: false }));
    }
  };

  const handleReopenAction = async (action) => {
    const aId = action.action_id;
    setActionLoadingMap(prev => ({ ...prev, [aId]: true }));

    try {
      const params = {};
      if (farmId && farmId !== 'default') params.farm_id = farmId;
      await API.post(`/api/v1/farmer/actions/${encodeURIComponent(aId)}/reopen`, null, { params });
      fetchActions(true);
    } catch (err) {
      console.warn('[ActionCenter] Error reopening action:', err);
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [aId]: false }));
    }
  };

  const handleDismissAction = async (action) => {
    const aId = action.action_id;
    setActionLoadingMap(prev => ({ ...prev, [aId]: true }));
    setCompletedMap(prev => ({ ...prev, [aId]: 'dismissed' }));

    try {
      const params = {};
      if (farmId && farmId !== 'default') params.farm_id = farmId;
      await API.post(`/api/v1/farmer/actions/${encodeURIComponent(aId)}/dismiss`, null, { params });
      fetchActions(true);
    } catch (err) {
      console.warn('[ActionCenter] Error dismissing action:', err);
      setCompletedMap(prev => {
        const next = { ...prev };
        delete next[aId];
        return next;
      });
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [aId]: false }));
    }
  };

  // Filter actions by category
  const filteredActions = useMemo(() => {
    if (!data?.actions) return [];
    return data.actions.filter(item => {
      // For active buckets, exclude completed/dismissed in local session
      if (activeBucket !== 'completed' && completedMap[item.action_id]) return false;

      if (actionFilter === 'URGENT') return item.priority === 'P0' || item.priority === 'P1';
      if (actionFilter === 'WATER') return item.action_type === 'WATER';
      if (actionFilter === 'CROP') return ['CROP_TASK', 'SPRAY', 'FERTILIZE'].includes(item.action_type);
      if (actionFilter === 'INPUT') return item.action_type === 'BUY_INPUT';
      if (actionFilter === 'KHATA') return item.action_type === 'PAYMENT';
      return true;
    });
  }, [data, completedMap, actionFilter, activeBucket]);

  const visibleActions = showAll ? filteredActions : filteredActions.slice(0, 4);

  if (loading) {
    return (
      <Card glass className="p-5 sm:p-6 border-2 border-slate-200/90 dark:border-slate-800 rounded-3xl space-y-4 animate-pulse">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200/70 dark:border-slate-800">
          <Skeleton className="h-6 w-56 rounded-xl" />
          <Skeleton className="h-6 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </Card>
    );
  }

  const isIoT = data?.operating_mode === 'smart_iot';

  return (
    <Card glass className="p-4 sm:p-6 border-2 border-emerald-500/40 dark:border-emerald-500/30 rounded-3xl space-y-4 shadow-md bg-white/95 dark:bg-[#07111e]/95 backdrop-blur-xl">
      {/* ─── Header: Title, Two-Mode Badge & Refresh ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
            🎯
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {isTe ? 'వ్యవసాయ కార్యాచరణ కేంద్రం' : 'Smart Farm Operations'}
              </h2>
              {filteredActions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {filteredActions.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {isTe ? 'నేడు, గడువు దాటిన మరియు రాబోయే పొలం పనుల నిర్వహణ' : 'Daily, overdue, and upcoming field work synthesized in one place'}
            </p>
          </div>
        </div>

        {/* Operating Mode Indicator & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isIoT ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isTe ? 'స్మార్ట్ IoT మోడ్ (ప్రత్యక్ష సమాచారం)' : 'Smart IoT Mode'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-700 dark:text-sky-300 text-xs font-bold">
              <span>☁️</span>
              <span>{isTe ? 'సాఫ్ట్‌వేర్ AI మోడ్' : 'Software AI Mode'}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchActions(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
            title={isTe ? 'రిఫ్రెష్ చేయండి' : 'Refresh actions'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Operational Segmented Tabs (Today / Overdue / Upcoming / Completed) ─── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 overflow-x-auto text-xs font-bold scrollbar-none">
        {[
          { id: 'today', labelEn: 'Today', labelTe: 'నేడు', count: data?.today_count ?? 0, badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
          { id: 'overdue', labelEn: 'Overdue', labelTe: 'గడువు దాటినవి', count: data?.overdue_count ?? 0, badgeCls: (data?.overdue_count || 0) > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
          { id: 'upcoming', labelEn: 'Next 7 Days', labelTe: 'రాబోయే 7 రోజులు', count: data?.upcoming_count ?? 0, badgeCls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
          { id: 'completed', labelEn: 'Completed', labelTe: 'పూర్తయినవి', count: data?.completed_count ?? 0, badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveBucket(tab.id);
              setShowAll(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeBucket === tab.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{isTe ? tab.labelTe : tab.labelEn}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.badgeCls}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Category Filter Pills ─── */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        {[
          { id: 'ALL', labelEn: 'All Types', labelTe: 'అన్ని' },
          { id: 'URGENT', labelEn: 'Urgent', labelTe: 'అత్యవసరం' },
          { id: 'WATER', labelEn: 'Water', labelTe: 'నీటి తడులు' },
          { id: 'CROP', labelEn: 'Crop Tasks', labelTe: 'పంట పనులు' },
          { id: 'INPUT', labelEn: 'Inventory', labelTe: 'ఇన్వెంటరీ' },
          { id: 'KHATA', labelEn: 'Finances', labelTe: 'ఖాతా' },
        ].map(filter => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActionFilter(filter.id)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              actionFilter === filter.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isTe ? filter.labelTe : filter.labelEn}
          </button>
        ))}
      </div>

      {/* ─── Actions Cards Grid ─── */}
      {filteredActions.length === 0 ? (
        <div className="p-6 text-center rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl">
            ✨
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            {activeBucket === 'completed'
              ? (isTe ? 'ఇటీవల పూర్తయిన పనులేవీ లేవు' : 'No Completed Operations Yet')
              : activeBucket === 'overdue'
              ? (isTe ? 'అద్భుతం! గడువు దాటిన పనులేవీ లేవు' : 'Great! No Overdue Work')
              : activeBucket === 'upcoming'
              ? (isTe ? 'రాబోయే 7 రోజుల్లో పనులేవీ లేవు' : 'No Upcoming Operations Scheduled')
              : (isTe ? 'అన్ని ముఖ్యమైన పనులు పూర్తయ్యాయి!' : 'All Caught Up! No Pending Actions Today')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {activeBucket === 'overdue'
              ? (isTe ? 'మీ పొలంలో అన్ని పనులు సమయానికి నడుస్తున్నాయి.' : 'All farm activities and liabilities are on track.')
              : (isTe ? 'మీ పంట పొలం పరిస్థితి స్థిరంగా ఉంది.' : 'Field conditions, inventory, and operations are in optimal order.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <AnimatePresence>
            {visibleActions.map(action => {
              const prioCfg = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.P2;
              const IconComp = ACTION_TYPE_ICONS[action.action_type] || Sparkles;
              const isWorking = actionLoadingMap[action.action_id];
              const isCompletedTab = activeBucket === 'completed';

              return (
                <motion.div
                  key={action.action_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 rounded-2xl border-2 ${prioCfg.borderClass} ${prioCfg.bgClass} flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md transition-all relative overflow-hidden`}
                >
                  <div className="space-y-2">
                    {/* Top Row: Priority Badge + Source Tag + Dismiss Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          action.priority === 'P0'
                            ? 'bg-rose-600 text-white'
                            : action.priority === 'P1'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${prioCfg.dotClass}`} />
                          {isTe ? prioCfg.labelTe : prioCfg.labelEn}
                        </span>

                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                          {action.source}
                        </span>

                        {action.badge_text && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            action.operational_bucket === 'overdue'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            {action.badge_text}
                          </span>
                        )}
                      </div>

                      {/* Dismiss (X) */}
                      {!isCompletedTab && action.priority !== 'P0' && (
                        <button
                          type="button"
                          onClick={() => handleDismissAction(action)}
                          disabled={isWorking}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
                          title={isTe ? 'తీసివేయండి' : 'Dismiss'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* FIELD & CROP CONTEXT BADGES */}
                    {(action.crop_name || action.growth_stage || action.field_name) && (
                      <div className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-lg w-fit">
                        <span>🌱</span>
                        <span>
                          {[action.crop_name, action.growth_stage, action.field_name].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    )}

                    {/* WHAT: Title */}
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                          {action.what}
                        </h3>
                      </div>
                    </div>

                    {/* WHY: Plain Reasoning */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug pl-8">
                      {action.why}
                    </p>

                    {/* WHEN: Due time */}
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 pl-8 flex items-center gap-1.5">
                      <span>⏱️</span>
                      <span className={action.operational_bucket === 'overdue' ? 'text-rose-600 dark:text-rose-400 font-black' : ''}>
                        {action.when}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Call to Action + Complete/Reopen Button */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                    <Link
                      to={action.action_url}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      <span>{action.action_label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    {isCompletedTab ? (
                      /* Undo / Reopen Button for Completed Items */
                      <button
                        type="button"
                        onClick={() => handleReopenAction(action)}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 hover:border-amber-300 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title={isTe ? 'మళ్ళీ తెరవండి' : 'Reopen Action'}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isTe ? 'మళ్ళీ చేయండి' : 'Undo / Reopen'}</span>
                      </button>
                    ) : (
                      /* Mark Done Button for Pending Items */
                      <button
                        type="button"
                        onClick={() => handleCompleteAction(action)}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 hover:border-emerald-300 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title={isTe ? 'పూర్తయినట్లు గుర్తించండి' : 'Mark Completed'}
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isTe ? 'పూర్తయింది' : 'Done'}</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Expand / Collapse Toggle if > 4 actions ─── */}
      {filteredActions.length > 4 && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setShowAll(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <span>
              {showAll
                ? (isTe ? 'తక్కువ పనులు చూపించు' : 'Show Fewer Actions')
                : (isTe ? `అన్ని పనులు చూడండి (${filteredActions.length})` : `View All ${filteredActions.length} Actions`)}
            </span>
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </Card>
  );
}
