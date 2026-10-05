import React, { useState, useMemo, useEffect, useRef } from 'react';
import API from '../../services/api';
import { motion } from 'framer-motion';
import {
  Calendar, CheckCircle2, Clock, AlertTriangle,
  Sparkles, Share2, ArrowRight, ShieldCheck,
  Leaf, Flower2, Apple, Sprout, CheckSquare, Square,
  CloudRain, Droplets, Sun, ChevronRight, XCircle, SkipForward, Hourglass
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { translateCrop } from '../../utils/diseaseAdvisoryData';

export default function CropGrowthTimeline({
  farmId,
  farmName = "My Farm",
  cropName = "Tomato",
  plantingDate = "2026-08-15",
  acreage = 2.0,
  village = "Pasupugallu",
  onClose
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  // 3-tab views: Today, Upcoming, Completed
  const [activeView, setActiveView] = useState('today'); // 'today' | 'upcoming' | 'completed'
  const [calendarState, setCalendarState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const storageKey = useMemo(() => farmId ? `agrishield_timeline_${farmId}` : `agrishield_timeline_${farmName.replace(/\s+/g, '_')}`, [farmId, farmName]);

  const [completedTasks, setCompletedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });

  const lastLocalUpdateRef = useRef(0);

  // Fetch full Smart Crop Calendar from B16 API
  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (farmId) params.farm_id = farmId;
      if (cropName) params.crop_name = cropName;
      if (plantingDate) params.planting_date = plantingDate;

      const res = await API.get('/api/intelligence/crop-calendar', { params });
      if (res.data) {
        setCalendarState(res.data);
      }
    } catch (err) {
      console.warn("Could not fetch smart crop calendar, falling back to local view:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [farmId, cropName, plantingDate]);

  // Sync tasks from backend
  useEffect(() => {
    let isMounted = true;
    const fetchTimelineTasks = async () => {
      if (!farmId) return;
      const fetchStartTime = Date.now();
      try {
        const res = await API.get(`/api/farms/${farmId}/timeline-tasks`);
        const serverTasks = res.data?.completed_tasks || {};
        if (isMounted && fetchStartTime >= lastLocalUpdateRef.current) {
          setCompletedTasks(serverTasks);
          try {
            localStorage.setItem(storageKey, JSON.stringify(serverTasks));
          } catch (_) {}
        }
      } catch (err) {
        console.warn("Could not fetch remote timeline tasks:", err);
      }
    };
    fetchTimelineTasks();
    return () => { isMounted = false; };
  }, [farmId, storageKey]);

  // Handle task status update (Complete, Skip, Delay)
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    lastLocalUpdateRef.current = Date.now();
    setActionLoading(prev => ({ ...prev, [taskId]: true }));

    const updatedTaskEntry = {
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const newMap = {
      ...completedTasks,
      [taskId]: newStatus === 'pending' ? false : updatedTaskEntry
    };

    setCompletedTasks(newMap);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newMap));
    } catch (_) {}

    if (farmId) {
      try {
        await API.put(`/api/farms/${farmId}/timeline-tasks`, { completed_tasks: newMap });
        // Refresh calendar list in background
        fetchCalendarData();
      } catch (err) {
        console.warn("Background timeline tasks sync failed, preserved in local cache:", err);
      }
    }
    setActionLoading(prev => ({ ...prev, [taskId]: false }));
  };

  const handleShareWhatsApp = () => {
    const activeStage = calendarState?.stages?.find(s => s.is_active) || { stage_name: 'Vegetative', min_das: 20, max_das: 45 };
    const todayList = calendarState?.today_tasks || [];

    const text = isTe
      ? `📅 *AgriShield స్మార్ట్ పంట క్యాలెండర్ & పనుల ప్రణాళిక*\n\n` +
        `📍 *పొలం:* ${farmName} (${village})\n` +
        `🌱 *పంట:* ${translateCrop(cropName, 'te')} · విస్తీర్ణం: ${acreage} ఎకరాలు\n` +
        `⏱️ *విత్తిన తర్వాత రోజులు (DAS):* ${calendarState?.days_since_sowing || '35'} రోజులు\n` +
        `🌟 *ప్రస్తుత దశ:* ${activeStage.stage_name}\n` +
        `📡 *ఆపరేటింగ్ మోడ్:* ${calendarState?.mode === 'smart_iot' ? 'Smart IoT Mode' : 'Software AI Mode'}\n\n` +
        `📋 *నేటి ముఖ్యమైన వ్యవసాయ పనులు:*\n` +
        (todayList.length > 0 ? todayList.map((t, idx) => `• ${idx + 1}. ${t.title}`).join('\n') : '• ప్రత్యేక పనులు లేవు. పంట ఆరోగ్యకరంగా ఉంది.') +
        `\n\n_AgriShield స్మార్ట్ వ్యవసాయ సలహాదారు._`
      : `📅 *AgriShield Smart Crop Calendar & Activity Planner*\n\n` +
        `📍 *Farm:* ${farmName} (${village})\n` +
        `🌱 *Crop:* ${cropName} · Area: ${acreage} Acres\n` +
        `⏱️ *Days After Sowing (DAS):* Day ${calendarState?.days_since_sowing || '35'}\n` +
        `🌟 *Growth Stage:* ${activeStage.stage_name}\n` +
        `📡 *Operating Mode:* ${calendarState?.mode === 'smart_iot' ? 'Smart IoT Mode' : 'Software AI Mode'}\n\n` +
        `📋 *Today's Actionable Tasks:*\n` +
        (todayList.length > 0 ? todayList.map((t, idx) => `• ${idx + 1}. ${t.title}`).join('\n') : '• No urgent tasks. Field conditions stable.') +
        `\n\n_Generated via AgriShield Precision Agronomy Engine._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Determine mode badges
  const isSmartIoT = calendarState?.mode === 'smart_iot';
  const isSensorOffline = calendarState?.sensor_status === 'offline';
  const weatherCtx = calendarState?.weather_context;

  return (
    <div className="rounded-3xl bg-[#060c14] border border-emerald-500/25 p-4 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden text-slate-100">
      {/* Background Atmosphere Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isSmartIoT
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {isSmartIoT
                  ? '📡 Smart IoT Mode'
                  : isSensorOffline
                  ? '⚠️ Sensor Offline · Software Mode'
                  : '🌱 Software AI Mode'}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                {plantingDate ? `Sown: ${plantingDate} · Day ${calendarState?.days_since_sowing || '--'}` : 'Planting Date Required'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {isTe ? 'స్మార్ట్ పంట క్యాలెండర్ & వ్యవసాయ పనుల ప్రణాళిక' : 'Smart Crop Calendar & Farm Activity Planner'}
            </h2>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShareWhatsApp}
          className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto justify-center"
        >
          <Share2 className="w-4 h-4 text-emerald-400" />
          <span>{isTe ? 'వాట్సాప్ షెడ్యూల్' : 'Share WhatsApp'}</span>
        </button>
      </div>

      {/* Mode & Weather Guidance Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
        isSmartIoT
          ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
          : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>
            {calendarState?.mode_description || (isTe ? 'పంట దశ మరియు వాతావరణ సమాచారం ఆధారంగా' : 'Based on crop phenology, field records and regional weather')}
          </span>
        </div>
        {weatherCtx?.note && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] font-medium text-white/80 shrink-0">
            {weatherCtx?.spray_delayed ? <CloudRain className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <span>{weatherCtx.note}</span>
          </div>
        )}
      </div>

      {/* Active Stage Big Milestone Badge */}
      {calendarState?.current_stage && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-900/20 to-sky-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl sm:text-3xl shrink-0">
              🌱
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                  {isTe ? 'ప్రస్తుత క్రియాశీల దశ' : 'Active Growth Phase'}
                </span>
                <span className="text-xs font-mono font-bold text-white/60">
                  Day {calendarState.days_since_sowing} of {calendarState.total_lifecycle_days || 120}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                {calendarState.current_stage}
              </h3>
              <p className="text-xs text-white/70">
                {isTe
                  ? `నాటిన తర్వాత ${calendarState.days_since_sowing}వ రోజు. ఈ దశలో పోషకాలు మరియు రసం పీల్చు పురుగుల నిఘా అత్యంత కీలకం.`
                  : `Day ${calendarState.days_since_sowing} after sowing. Nutrient splits, moisture consistency and pest scouting are primary priorities.`}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 shrink-0">
            {Math.min(100, Math.round(((calendarState.days_since_sowing || 1) / (calendarState.total_lifecycle_days || 120)) * 100))}% Cycle Complete
          </div>
        </div>
      )}

      {/* B24 Harvest & Season Scorecard Quick Callout */}
      {calendarState && (calendarState.current_stage?.toLowerCase().includes('harvest') || (calendarState.days_since_sowing || 0) >= 80) && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🧺</span>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                {isTe ? 'పంట కోత దశ — దిగుబడి & అమ్మకాలు నమోదు చేయండి' : 'Harvest Stage Active — Log Yield & Mandi Sales'}
              </h4>
              <p className="text-[11px] text-white/60">
                {isTe ? 'దిగుబడిని నమోదు చేసి పూర్తి సీజన్ లాభం స్కోర్‌కార్డ్ రూపొందించండి.' : 'Record harvest pickings and crop sales below to view your Season Scorecard.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('harvest-season-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold shrink-0 cursor-pointer"
          >
            {isTe ? 'దిగుబడి విభాగం చూడండి' : 'Go to Harvest & Seasons'}
          </button>
        </div>
      )}

      {/* 3 Main Action Views Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveView('today')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === 'today'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>{isTe ? 'నేటి పనులు' : "Today's Tasks"}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-white font-mono">
            {calendarState?.today_tasks?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('upcoming')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === 'upcoming'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{isTe ? 'రాబోవు పనులు' : 'Upcoming'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-white font-mono">
            {calendarState?.upcoming_activities?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('completed')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeView === 'completed'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isTe ? 'పూర్తయిన పనులు' : 'Completed / History'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-white font-mono">
            {calendarState?.completed_activities?.length || 0}
          </span>
        </button>
      </div>

      {/* VIEW 1: TODAY'S TASKS */}
      {activeView === 'today' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>{isTe ? 'ఈ రోజు నిర్వహించవలసిన పనులు మరియు సలహాలు' : 'Actionable farming tasks and alerts for today'}</span>
            <span>{calendarState?.today_tasks?.length || 0} {isTe ? 'పనులు ఉన్నాయి' : 'Items'}</span>
          </div>

          {calendarState?.today_tasks?.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-white">{isTe ? 'నేటికి పనులన్నీ పూర్తయ్యాయి!' : 'All Tasks Completed for Today!'}</p>
              <p className="text-xs text-white/50">{isTe ? 'పంట పరిస్థితులు నిలకడగా ఉన్నాయి.' : 'Your field condition is stable.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {calendarState?.today_tasks?.map((task) => {
                const taskId = task.task_id;
                const isB15Irrigation = taskId === 'b15-irrigation-action';
                const isDelayed = task.status === 'delayed';

                return (
                  <div
                    key={taskId}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                      isB15Irrigation
                        ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-100 shadow-md'
                        : isDelayed
                        ? 'bg-amber-950/20 border-amber-500/40 text-amber-100'
                        : 'bg-white/[0.03] border-white/10 hover:border-emerald-500/40 text-white'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          task.priority === 'Critical'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {task.category || 'Farm Care'} · {task.priority || 'Normal'}
                        </span>
                        {task.mode_badge && (
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-900/40 px-1.5 py-0.5 rounded border border-cyan-500/30">
                            {task.mode_badge}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-white leading-snug">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-xs text-white/70 leading-relaxed font-medium">
                          {task.description}
                        </p>
                      )}
                      {task.weather_warning && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 p-2 rounded-xl mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{task.weather_warning}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => handleUpdateTaskStatus(taskId, 'completed')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isTe ? 'పూర్తయింది' : 'Mark Done'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateTaskStatus(taskId, 'delayed')}
                        className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-amber-300 border border-white/10 font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                        title="Delay Task"
                      >
                        <Hourglass className="w-3.5 h-3.5" />
                        <span>{isTe ? 'వాయిదా' : 'Delay'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateTaskStatus(taskId, 'skipped')}
                        className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white border border-white/10 font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                        title="Skip Task"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        <span>{isTe ? 'దాటవేయి' : 'Skip'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: UPCOMING ACTIVITIES */}
      {activeView === 'upcoming' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>{isTe ? 'తదుపరి దశలలో రాబోవు ముఖ్యమైన పనులు' : 'Upcoming agronomic activities for subsequent growth stages'}</span>
            <span>{calendarState?.upcoming_activities?.length || 0} {isTe ? 'పనులు ఉన్నాయి' : 'Items'}</span>
          </div>

          <div className="space-y-2.5">
            {calendarState?.upcoming_activities?.map((task) => (
              <div
                key={task.task_id}
                className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70">
                      {task.due_date || 'Stage-based'}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      {task.stage_name}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {task.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleUpdateTaskStatus(task.task_id, 'completed')}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-emerald-600 hover:text-slate-950 text-white/70 border border-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    {isTe ? 'ముందే పూర్తి చేయండి' : 'Complete Early'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: COMPLETED / HISTORY */}
      {activeView === 'completed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>{isTe ? 'మీరు విజయవంతంగా పూర్తి చేసిన పనుల రికార్డు' : 'Record of completed, skipped, or delayed farming activities'}</span>
            <span>{calendarState?.completed_activities?.length || 0} {isTe ? 'రికార్డులు' : 'Records'}</span>
          </div>

          {calendarState?.completed_activities?.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <Clock className="w-8 h-8 text-white/30 mx-auto" />
              <p className="text-xs text-white/50">{isTe ? 'ఇంకా ఎటువంటి పనులు పూర్తి చేయలేదు.' : 'No completed activities recorded yet.'}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {calendarState?.completed_activities?.map((task) => (
                <div
                  key={task.task_id}
                  className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-white line-through text-white/60">
                        {task.title}
                      </h4>
                      <span className="text-[10px] text-white/40 block">
                        {task.completed_at ? `Done: ${new Date(task.completed_at).toLocaleDateString('en-IN')}` : 'Marked Completed'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateTaskStatus(task.task_id, 'pending')}
                    className="text-[11px] text-white/40 hover:text-white underline cursor-pointer"
                  >
                    {isTe ? 'రద్దు చేయి' : 'Undo'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
