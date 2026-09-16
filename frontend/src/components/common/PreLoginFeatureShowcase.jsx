import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  ScanLine, 
  Cpu, 
  Store, 
  Bot, 
  Activity, 
  Droplets, 
  Thermometer, 
  Sun, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  ShieldCheck,
  Radio,
  BatteryCharging,
  Wifi
} from 'lucide-react';
import { Badge } from '../ui/index';

const PreLoginFeatureShowcase = () => {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const [activeTab, setActiveTab] = useState('iot'); // 'iot' | 'ai' | 'medicine' | 'voice'

  const tabs = [
    {
      id: 'iot',
      label: isTe ? '📡 ESP32 IoT హార్డ్‌వేర్' : '📡 ESP32 IoT Node',
      badge: 'Hardware Advantage',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    },
    {
      id: 'ai',
      label: isTe ? '🔬 పైటార్చ్ AI స్కాన్' : '🔬 PyTorch AI Vision',
      badge: '98.4% Precision',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    {
      id: 'medicine',
      label: isTe ? '🛒 20L పంపు మందులు' : '🛒 20L Sprayer Guide',
      badge: 'Indian Shop Brands',
      badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30'
    },
    {
      id: 'voice',
      label: isTe ? '🗣️ వాయిస్ అసిస్టెంట్' : '🗣️ Voice Doctor',
      badge: 'Telugu & Hindi',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    }
  ];

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-emerald-500/30 p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3.5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            {isTe ? 'అగ్రిషీల్డ్ ఇంటర్‌ఫేస్ ముందస్తు పరిచయం' : 'AgriShield System Overview & Interface'}
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            {isTe ? 'లాగిన్ అవ్వకముందే మా సిస్టమ్ సామర్థ్యాన్ని చూడండి' : 'Explore System Capabilities Before Signing In'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isTe ? 'కేవలం సాఫ్ట్‌వేర్ మాత్రమే కాదు — ESP32 ఫీల్డ్ హార్డ్‌వేర్ మరియు పైటార్చ్ ఏఐ యొక్క కలయిక.' : 'Not just an app — complete integration of ESP32 in-field IoT hardware and PyTorch deep neural vision.'}
          </p>
        </div>

        <Badge variant="success" className="self-start sm:self-auto text-[10px] font-black uppercase tracking-wider py-1 px-3">
          {isTe ? '1,254 పంట రకాలు' : '1,254 Crop Species'}
        </Badge>
      </div>

      {/* Feature Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                isActive
                  ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${tab.badgeColor}`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Interactive Feature Stage Display */}
      <AnimatePresence mode="wait">
        {/* ═══ TAB 1: ESP32 IOT HARDWARE ADVANTAGE ═══ */}
        {activeTab === 'iot' && (
          <motion.div
            key="iot"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-emerald-950/20 border border-amber-500/30 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {isTe ? 'అగ్రిషీల్డ్ ESP32 సోలార్ ఐఓటీ ట్రాన్సీవర్ నోడ్' : 'AgriShield ESP32 Solar Field Transceiver'}
                  </h4>
                  <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                    {isTe ? 'పొలంలో లైవ్ వైర్‌లెస్ టెలిమెట్రీ' : 'Real-Time In-Field Wireless Sensor Sync'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <BatteryCharging className="w-3.5 h-3.5" />
                <span>Solar 4.18V</span>
              </div>
            </div>

            {/* Live Sensor Probes Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center justify-center gap-1">
                  <Thermometer className="w-3 h-3 text-rose-400" /> {isTe ? 'గాలి ఉష్ణోగ్రత' : 'Air Temp'}
                </span>
                <span className="text-sm sm:text-base font-black text-white block">28.4°C</span>
                <span className="text-[9px] text-emerald-400 font-semibold">{isTe ? 'అనుకూలం' : 'Optimal'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center justify-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-400" /> {isTe ? 'గాలిలో తేమ' : 'Humidity'}
                </span>
                <span className="text-sm sm:text-base font-black text-white block">76%</span>
                <span className="text-[9px] text-teal-400 font-semibold">{isTe ? 'అధిక తేమ' : 'Fungal Watch'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> {isTe ? 'నేల తేమ' : 'Soil Moisture'}
                </span>
                <span className="text-sm sm:text-base font-black text-white block">42%</span>
                <span className="text-[9px] text-emerald-400 font-semibold">{isTe ? 'తగినంత తేమ' : 'Good Level'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center justify-center gap-1">
                  <Sun className="w-3 h-3 text-amber-400" /> {isTe ? 'సూర్యకాంతి' : 'Sunlight'}
                </span>
                <span className="text-sm sm:text-base font-black text-white block">84 kLux</span>
                <span className="text-[9px] text-amber-400 font-semibold">{isTe ? 'పూర్తి ఎండ' : 'Bright Sun'}</span>
              </div>
            </div>

            {/* Hardware Diagram Highlights */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/20 text-xs text-slate-300 space-y-1">
              <span className="font-extrabold text-amber-400 uppercase tracking-wider block text-[10px]">
                {isTe ? 'హార్డ్‌వేర్ ప్రత్యేకతలు (Plantix కంటే అగ్రగామి):' : 'Hardware Superiority over Software-Only Apps:'}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isTe 
                  ? 'ప్లాంటిక్స్ కేవలం ఫోటోలను మాత్రమే గుర్తిస్తుంది. అగ్రిషీల్డ్ మీ పొలంలో అమర్చిన ESP32 సెన్సార్లతో నేరుగా అనుసంధానమై వాతావరణంలో తెగులు వ్యాప్తి చెందే ప్రమాదాన్ని ముందే హెచ్చరిస్తుంది.'
                  : 'Plantix only analyzes camera leaf photos. AgriShield syncs with in-field ESP32 sensor hardware to forecast spore germination and leaf wetness hours before diseases visibly spread.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* ═══ TAB 2: PYTORCH VISION AI ═══ */}
        {activeTab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900 to-teal-950/20 border border-emerald-500/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {isTe ? 'పైటార్చ్ EfficientNetV2 న్యూరల్ నెట్‌వర్క్' : 'PyTorch EfficientNetV2 Deep Neural Vision'}
                  </h4>
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {isTe ? 'ఆకు పిక్సెల్స్ & నరాల విశ్లేషణ (0.55 సెకన్లలో)' : 'Sub-Second Leaf Pixel Analysis (< 0.6s)'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                98.4% Confidence
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{isTe ? 'నమూనా ఫలితం' : 'Sample Live Diagnosis'}</span>
                <span className="text-sm font-extrabold text-white block">
                  {isTe ? 'మిరప — ఆకుమచ్చ తెగులు (Chilli Leaf Spot)' : 'Chilli — Cercospora Leaf Spot'}
                </span>
                <span className="text-[11px] text-teal-400 font-semibold">
                  {isTe ? 'ఆకుపై గోధుమ రంగు మచ్చలు & పసుపు వలయాలు గుర్తించబడ్డాయి' : 'Concentric chlorotic halos identified across leaf margin'}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xs">
                98.4%
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ TAB 3: 20L BACKPACK SPRAYER & SHOP BRANDS ═══ */}
        {activeTab === 'medicine' && (
          <motion.div
            key="medicine"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/10 via-slate-900 to-sky-950/20 border border-teal-500/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {isTe ? '20 లీటర్ల పంపు మోతాదు & రైతు దుకాణాల బ్రాండ్లు' : '20L Field Sprayer Dilution & Shop Brands'}
                  </h4>
                  <span className="text-[11px] text-teal-400 font-semibold">
                    {isTe ? 'సాఫ్, అమిస్టార్ టాప్, కవచ్ (భారతీయ కంపెనీ బ్రాండ్లు)' : 'Saaf (UPL), Amistar Top (Syngenta), Kavach'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/30">
                20L Standard
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{isTe ? '20L బ్యాటరీ పంపు మోతాదు' : '20L Backpack Pump Dose'}</span>
                <span className="text-sm font-black text-emerald-400 block mt-0.5">40 Grams / 20 ml</span>
                <span className="text-[10px] text-slate-400">~2 full tablespoons per 20L tank</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{isTe ? '1 ఎకరానికి మొత్తం అవసరం' : 'Total 1-Acre Requirement'}</span>
                <span className="text-sm font-black text-teal-400 block mt-0.5">10 Pumps (200L Water)</span>
                <span className="text-[10px] text-slate-400">400g chemical dilution total</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ TAB 4: MULTILINGUAL VOICE DOCTOR ═══ */}
        {activeTab === 'voice' && (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-slate-900 to-indigo-950/20 border border-purple-500/30 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {isTe ? 'మాట్లాడే పంట డాక్టర్ (వాయిస్ రీడర్)' : 'Multilingual Smart Voice Doctor'}
                  </h4>
                  <span className="text-[11px] text-purple-400 font-semibold">
                    {isTe ? 'తెలుగు మరియు హిందీ గ్రామీణ భాషలలో ప్రత్యక్ష స్వరం' : 'Real-time audio readout in Telugu, Hindi & English'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/30">
                Audio Enabled
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-white/10">
              {isTe 
                ? 'చదవడం కష్టమైన రైతులకు పంట తెగులు పేరు, మందుల పేర్లు, మరియు పంపులో కలపవలసిన మోతాదును స్పష్టమైన తెలుగు స్వరంలో చదివి వినిపిస్తుంది.'
                : 'Empowering farmers with instant voice playback of disease diagnosis and exact measuring spoon directions directly in native mother tongues.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PreLoginFeatureShowcase;
