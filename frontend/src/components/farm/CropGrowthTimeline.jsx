import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, CheckCircle2, Clock, AlertTriangle, 
  Sparkles, Share2, ArrowRight, ShieldCheck, 
  Leaf, Flower2, Apple, Sprout, CheckSquare, Square
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CROP_STAGES_DATA = {
  Tomato: [
    { id: 'stage-1', nameEn: 'Nursery & Seedling', nameTe: 'నర్సరీ & మొలక దశ', minDas: 0, maxDas: 20, icon: '🌱', tasksEn: ['Trichoderma viride root drenching', 'Light moisture maintenance', 'Inspect for damping-off fungus'], tasksTe: ['ట్రైకోడెర్మా విరిడేతో వేరు ముంచడం', 'తేలికపాటి తేమ నిర్వహణ', 'కుళ్లు తెగులు రాకుండా జాగ్రత్తలు'] },
    { id: 'stage-2', nameEn: 'Vegetative Canopy', nameTe: 'శాఖీయ ఎదుగుదల దశ', minDas: 21, maxDas: 45, icon: '🌿', tasksEn: ['Apply 2nd split Nitrogen + Potash', 'Scout lower leaves for Whitefly & Aphids', 'Prune lower soil-touching suckers'], tasksTe: ['రెండవ విడత యూరియా + పొటాష్ వేయడం', 'ఆకుల అడుగున తెల్లదోమ, పేనుబంక పరిశీలన', 'నేలను తాకే పిలకలను కత్తిరించడం'] },
    { id: 'stage-3', nameEn: 'Flowering & Budding', nameTe: 'పూత & మొగ్గ దశ', minDas: 46, maxDas: 65, icon: '🌼', tasksEn: ['Foliar spray: Boron 20% @ 1g/L to prevent flower drop', 'Install yellow sticky traps for Thrips', 'Avoid water stress during peak bloom'], tasksTe: ['పూత రాలకుండా బోరాన్ 20% @ 1 గ్రా/లీ స్ప్రే', 'తామర పురుగుల నివారణకు పసుపు జిగురు బోర్డులు', 'పూత సమయంలో నీటి ఎద్దడి లేకుండా చూడటం'] },
    { id: 'stage-4', nameEn: 'Fruit Set & Sizing', nameTe: 'కాయ ఎదుగుదల దశ', minDas: 66, maxDas: 90, icon: '🍅', tasksEn: ['Spray 0-0-50 Potassium Sulphate for fruit shine & weight', 'Install Pheromone traps for Fruit Borer', 'Inspect for Early Blight leaf spots'], tasksTe: ['కాయ బరువు & రంగు కోసం 0-0-50 స్ప్రే', 'కాయతొలుచు పురుగుకు లింగాకర్షక బుట్టలు', 'ముందస్తు ఎండు తెగులు మచ్చల పరిశీలన'] },
    { id: 'stage-5', nameEn: 'Harvest & Picking', nameTe: 'కోత & మార్కెట్ దశ', minDas: 91, maxDas: 120, icon: '🧺', tasksEn: ['Pick fruits at breaker stage for long transport', 'Maintain 3-day harvest picking intervals', 'Grade by size for premium mandi price'], tasksTe: ['రవాణాకు అనువుగా దోర పండ్ల కోత', 'ప్రతి 3-4 రోజులకు క్రమబద్ధమైన కోత', 'మంచి మార్కెట్ ధర కోసం గ్రేడింగ్ చేయడం'] }
  ],
  Default: [
    { id: 'stage-1', nameEn: 'Sowing & Germination', nameTe: 'విత్తనం & మొలక దశ', minDas: 0, maxDas: 20, icon: '🌱', tasksEn: ['Seed treatment with bio-fungicide', 'Ensure proper soil moisture'], tasksTe: ['విత్తన శుద్ధి చేసుకోవడం', 'నేలలో తేమ సమపాళ్లలో ఉంచడం'] },
    { id: 'stage-2', nameEn: 'Active Vegetative', nameTe: 'క్రియాశీల ఎదుగుదల', minDas: 21, maxDas: 45, icon: '🌿', tasksEn: ['First weeding & inter-cultivation', 'Top-dress Nitrogen fertilizer'], tasksTe: ['మొదటి కలుపు తీత', 'పైపాటుగా నత్రజని ఎరువులు'] },
    { id: 'stage-3', nameEn: 'Flowering & Reproductive', nameTe: 'పూత & కాత దశ', minDas: 46, maxDas: 75, icon: '🌼', tasksEn: ['Micronutrient foliar spray', 'Monitor for pest attacks'], tasksTe: ['సూక్ష్మ పోషకాల పిచికారీ', 'పురుగుల దాడిని నివారించడం'] },
    { id: 'stage-4', nameEn: 'Maturity & Harvest', nameTe: 'పక్వత & కోత దశ', minDas: 76, maxDas: 110, icon: '🧺', tasksEn: ['Stop irrigation 7 days before harvest', 'Timely harvesting & storage'], tasksTe: ['కోతకు వారం రోజుల ముందు నీరు ఆపడం', 'సకాలంలో కోత & నిల్వ'] }
  ]
};

export default function CropGrowthTimeline({ 
  farmName = "My Farm", 
  cropName = "Tomato", 
  plantingDate = "2026-08-15",
  acreage = 2.0,
  village = "Pasupugallu",
  onClose 
}) {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';

  // Calculate Days After Sowing (DAS)
  const das = useMemo(() => {
    if (!plantingDate) return 38;
    const sDate = new Date(plantingDate);
    const now = new Date();
    const diffTime = Math.abs(now - sDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) ? 38 : Math.max(1, diffDays);
  }, [plantingDate]);

  const stages = useMemo(() => {
    return CROP_STAGES_DATA[cropName] || CROP_STAGES_DATA.Default;
  }, [cropName]);

  // Current active stage
  const activeStage = useMemo(() => {
    const found = stages.find(s => das >= s.minDas && das <= s.maxDas);
    return found || stages[1] || stages[0];
  }, [stages, das]);

  // Task checklist state
  const [completedTasks, setCompletedTasks] = useState({});

  const toggleTask = (taskId) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleShareWhatsApp = () => {
    const text = isTe
      ? `📅 *AgriShield పంట జీవితచక్రం & వారపు పనుల షెడ్యూల్*\n\n` +
        `📍 *పొలం:* ${farmName} (${village})\n🌱 *పంట:* ${cropName} · విస్తీర్ణం: ${acreage} ఎకరాలు\n` +
        `⏱️ *విత్తిన తర్వాత రోజులు (DAS):* ${das} రోజులు\n` +
        `🌟 *ప్రస్తుత పంట దశ:* ${activeStage.nameTe} (${activeStage.minDas}–${activeStage.maxDas} రోజులు)\n\n` +
        `📋 *ఈ వారంలో రైతు చేయవలసిన ముఖ్యమైన పనులు:*\n` +
        activeStage.tasksTe.map((t, idx) => `• ${idx + 1}. ${t}`).join('\n') +
        `\n\n_AgriShield AI స్మార్ట్ అగ్రికల్చర్ అసిస్టెంట్._`
      : `📅 *AgriShield Crop Growth Timeline & Weekly Tasks*\n\n` +
        `📍 *Farm:* ${farmName} (${village})\n🌱 *Crop:* ${cropName} · Area: ${acreage} Acres\n` +
        `⏱️ *Days After Sowing (DAS):* Day ${das}\n` +
        `🌟 *Current Growth Stage:* ${activeStage.nameEn} (DAS ${activeStage.minDas}–${activeStage.maxDas})\n\n` +
        `📋 *Agronomic Action Items for This Week:*\n` +
        activeStage.tasksEn.map((t, idx) => `• ${idx + 1}. ${t}`).join('\n') +
        `\n\n_Generated via AgriShield AI Precision Agronomy Engine._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="rounded-3xl bg-[#060c14] border border-emerald-500/25 p-4 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Atmosphere Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {isTe ? 'పంట ఫినాలజీ ఇంజిన్' : 'Crop Phenology Engine'}
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                Sown: {plantingDate || 'Aug 15'} · Day {das}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {isTe ? 'పంట జీవితచక్రం & వారపు పనుల క్యాలెండర్' : 'Crop Growth Stage Timeline & Task Calendar'}
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

      {/* Active Stage Big Milestone Badge */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-900/20 to-sky-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl shrink-0">
            {activeStage.icon}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                {isTe ? 'ప్రస్తుత క్రియాశీల దశ' : 'Active Growth Phase'}
              </span>
              <span className="text-xs font-mono font-bold text-white/60">
                DAS {activeStage.minDas}–{activeStage.maxDas}
              </span>
            </div>
            <h3 className="text-xl font-black text-white">
              {isTe ? activeStage.nameTe : activeStage.nameEn}
            </h3>
            <p className="text-xs text-white/70">
              {isTe 
                ? `నాటిన తర్వాత ${das}వ రోజు. ఈ దశలో పోషకాలు మరియు రసం పీల్చు పురుగుల నిఘా అత్యంత కీలకం.`
                : `Day ${das} after sowing. Nutrient splits and pest scouting are top priorities in this phase.`}
            </p>
          </div>
        </div>

        <div className="px-4 py-2 rounded-xl bg-black/40 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-300 shrink-0">
          Day {das} of 120 ({(Math.min(100, (das / 120) * 100)).toFixed(0)}% Cycle Complete)
        </div>
      </div>

      {/* Horizontal Multi-Stage Progression Timeline */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider block">
          {isTe ? 'పంట జీవితచక్ర ప్రగతి' : 'Crop Growth Progression Stages'}
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {stages.map((stg, idx) => {
            const isPassed = das > stg.maxDas;
            const isCurrent = das >= stg.minDas && das <= stg.maxDas;

            return (
              <div
                key={stg.id}
                className={`p-3 rounded-2xl border transition-all relative overflow-hidden ${
                  isCurrent
                    ? 'bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-950/40 text-white'
                    : isPassed
                    ? 'bg-white/[0.04] border-emerald-500/30 text-white/70'
                    : 'bg-white/[0.02] border-white/5 text-white/40'
                }`}
              >
                {/* Active Indicator Top Bar */}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse" />
                )}

                <div className="flex items-center justify-between">
                  <span className="text-lg">{stg.icon}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30">
                    {stg.minDas}-{stg.maxDas}d
                  </span>
                </div>
                <h4 className="text-xs font-black mt-2 leading-tight">
                  {isTe ? stg.nameTe : stg.nameEn}
                </h4>
                <div className="flex items-center gap-1 mt-1 text-[10px]">
                  {isPassed ? (
                    <span className="text-emerald-400 flex items-center gap-0.5 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> {isTe ? 'పూర్తయింది' : 'Completed'}
                    </span>
                  ) : isCurrent ? (
                    <span className="text-emerald-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {isTe ? 'క్రియాశీల దశ' : 'In Progress'}
                    </span>
                  ) : (
                    <span className="text-white/40">{isTe ? 'రాబోవు దశ' : 'Upcoming'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actionable Weekly Task Checklist */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>{isTe ? 'ఈ దశలో రైతు చేయవలసిన పనుల చెక్‌లిస్ట్' : 'Actionable Agronomic Tasks for Current Stage'}</span>
          </h3>
          <span className="text-xs text-white/50">
            {Object.values(completedTasks).filter(Boolean).length} of {(isTe ? activeStage.tasksTe : activeStage.tasksEn).length} {isTe ? 'పూర్తయ్యాయి' : 'Completed'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(isTe ? activeStage.tasksTe : activeStage.tasksEn).map((taskText, idx) => {
            const taskId = `${activeStage.id}-task-${idx}`;
            const isDone = !!completedTasks[taskId];

            return (
              <div
                key={taskId}
                onClick={() => toggleTask(taskId)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  isDone
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] text-white'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
                  ) : (
                    <Square className="w-5 h-5 text-white/40 hover:text-white" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className={`text-xs font-bold leading-snug ${isDone ? 'line-through text-white/60' : 'text-white'}`}>
                    {taskText}
                  </p>
                  <span className="text-[10px] text-white/40 block">
                    {isTe ? `పని #${idx + 1} · ప్రాధాన్యత: అత్యవసరం` : `Task #${idx + 1} · Priority: High`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
