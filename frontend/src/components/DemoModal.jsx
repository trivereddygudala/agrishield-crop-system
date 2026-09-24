import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X, CheckCircle2, Leaf, ChevronRight, Activity,
  Bot, Cpu, Sprout, ScanLine, Send, Sparkles, Zap,
  MapPin, Droplets, Thermometer, Sun, Battery, Wifi,
  AlertTriangle, ShieldCheck, Volume2, ArrowUpRight
} from 'lucide-react';
import { CURATED_FARM_PHOTOS } from '../services/photoService';

/* ─── Circular gauge ─── */
const Gauge = ({ value, max, color, label, icon: Icon, unit }) => {
  const pct = Math.min(value / max, 1);
  const r = 26, circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4.5" />
          <motion.circle
            cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="4.5"
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-white">{value}{unit}</p>
        <p className="text-[10px] text-white/40 font-medium">{label}</p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── 1. REAL-TIME AI DISEASE DIAGNOSIS DEEP-DIVE ─────────── */
/* ═══════════════════════════════════════════════════════════ */
const ScanDemo = ({ onClose }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Authentic Diseased Specimen & Neural Scanner HUD */}
        <div className="lg:col-span-6 relative rounded-2xl bg-[#070d14] border border-emerald-500/20 overflow-hidden flex flex-col justify-between p-4 min-h-[300px] shadow-2xl">
          <img
            src={CURATED_FARM_PHOTOS.leafDoctor}
            alt="Authentic Tomato Leaf Pathology"
            className="absolute inset-0 w-full h-full object-cover object-center filter contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060a10] via-[#060a10]/75 to-transparent" />

          {/* Animated Laser Scanning Line */}
          <motion.div
            animate={{ top: ['6%', '90%', '6%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent z-20 pointer-events-none shadow-[0_0_15px_rgba(52,211,153,0.8)]"
          />

          {/* Top HUD Badges */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-bold text-white">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tomato Sector A · Target Specimen</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-500/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider">
              Early Blight Detected
            </span>
          </div>

          {/* Bottom HUD: Neural Classification Summary */}
          <div className="relative z-10 space-y-2 bg-black/70 backdrop-blur-md p-3.5 rounded-xl border border-white/10 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60 font-semibold">PyTorch EfficientNetV2-S</span>
              <span className="text-emerald-400 font-extrabold">99.4% Neural Confidence</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '99.4%' }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/50 pt-1">
              <span>Resolution: 512×512 Sub-patch</span>
              <span>Inference: 1.1s on GPU / 2.3s CPU</span>
            </div>
          </div>
        </div>

        {/* Right: Certified Agronomic Prescriptions & Tank Math */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          {/* Diagnostic Card */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-widest">
                Pathology Classification
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                16,000-Scan Certified
              </span>
            </div>
            <h3 className="text-xl font-black text-white">Tomato — Early Blight</h3>
            <p className="text-xs font-mono text-emerald-400">Alternaria solani Sorauer</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Produces concentric bullseye ring lesions on lower leaves. Spreads rapidly under humid weather and leaf wetness.
            </p>
          </div>

          {/* Official CIBRC Chemical Formulation */}
          <div className="p-4 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>CIBRC Certified Chemical Prescription</span>
              </span>
              <span className="text-[10px] font-bold text-white/50">PHI: 3 Days</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Indofil M-45 (Mancozeb 75% WP)</p>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                <span className="text-white/60">20L Backpack Knapsack Sprayer:</span>
                <span className="text-emerald-400 font-extrabold">40 grams / 20L Tank (2.0 g/L)</span>
              </div>
            </div>
          </div>

          {/* Organic Bio-Control Alternative */}
          <div className="p-3.5 rounded-2xl bg-sky-500/[0.06] border border-sky-500/20 space-y-1 text-xs">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
              Organic & Biological Treatment
            </span>
            <p className="text-white/80 font-medium">
              Trichoderma viride 1% WP (100g / 20L tank) or Bordeaux Mixture (1% copper sulfate + hydrated lime). Apply during early morning.
            </p>
          </div>
        </div>
      </div>

      {/* Enterprise Benchmark Seal Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shrink-0">
            🏆
          </div>
          <div>
            <h4 className="text-xs font-black text-white">99.00% Enterprise Top-1 Accuracy Certified</h4>
            <p className="text-[11px] text-white/50">Cross-verified against ICAR, CABI Plantwise & CIBRC Master Indian Database.</p>
          </div>
        </div>
        <Link to="/upload" onClick={onClose} className="w-full sm:w-auto shrink-0">
          <button className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all">
            <span>Launch Live AI Scan Center</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── 2. AGRONOMIC SECTOR & LIFECYCLE DEEP-DIVE ───────────── */
/* ═══════════════════════════════════════════════════════════ */
const FarmDemo = ({ onClose }) => {
  const sectors = [
    { name: 'Tomato Polyhouse A', crop: '🍅 Tomato (Heirloom)', stage: 'Flowering & Fruit Set', pct: 65, area: '1.20 Acres (48.5 Cents)', irrigation: 'Automated Drip', soil: 'NPK 140:60:120', status: 'optimal' },
    { name: 'Hybrid Maize Sector B', crop: '🌽 Maize (HQPM-1)', stage: 'Vegetative V6 Stage', pct: 42, area: '2.50 Acres (101 Cents)', irrigation: 'Sprinkler Gun', soil: 'NPK 120:60:40', status: 'optimal' },
    { name: 'Paddy Wetland Sector C', crop: '🌾 Paddy (BPT-5204)', stage: 'Active Tillering', pct: 82, area: '3.80 Acres (154 Cents)', irrigation: 'AWD Flood Canal', soil: 'NPK 100:50:50', status: 'attention' },
    { name: 'Guntur Chilli Sector D', crop: '🌶️ Chilli (Teja S17)', stage: 'Pod Maturation', pct: 70, area: '0.90 Acres (36.5 Cents)', irrigation: 'Micro-Drip', soil: 'NPK 150:75:75', status: 'optimal' },
  ];

  return (
    <div className="space-y-6">
      {/* Visual Header with Real Farmland Photo & Land Calculation Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-sky-500/20 p-5 shadow-2xl bg-[#070e17]">
        <img
          src={CURATED_FARM_PHOTOS.farmField}
          alt="Farmland Survey"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060b13] via-[#060b13]/85 to-transparent" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-bold">
              <MapPin className="w-3.5 h-3.5" />
              <span>WGS-84 Survey-Grade Land GPS Engine</span>
            </div>
            <h3 className="text-xl font-black text-white">Green Valley Farm Holding</h3>
            <p className="text-xs text-white/60">GPS: 17.3850°N, 78.4867°E · Ellipsoidal Patwari Diagonal Surveying (0.0002% margin)</p>
          </div>
          <div className="p-3 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md text-right shrink-0">
            <p className="text-2xl font-black text-white">8.40 Acres</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">3.40 Hectares · 340 Cents</p>
          </div>
        </div>
      </div>

      {/* 4 Active Crop Lifecycle Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {sectors.map((s, idx) => (
          <div key={idx} className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 hover:border-sky-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-white">{s.name}</p>
                <p className="text-[11px] text-white/50">{s.crop}</p>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                s.status === 'optimal'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {s.status === 'optimal' ? 'Optimal Health' : 'Fungal Watch'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/60 font-medium">{s.stage}</span>
                <span className="text-white font-extrabold">{s.pct}% Complete</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.status === 'optimal' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
              <div>
                <span className="text-white/40 block">Area:</span>
                <span className="text-white/80 font-bold">{s.area}</span>
              </div>
              <div>
                <span className="text-white/40 block">Irrigation:</span>
                <span className="text-sky-300 font-bold">{s.irrigation}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Footer */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sprout className="w-5 h-5 text-sky-400 shrink-0" />
          <p className="text-xs text-white/60">
            Track vegetative stages, Days After Sowing (DAS), Growing Degree Days (GDD), and satellite NDVI biomass health.
          </p>
        </div>
        <Link to="/farm" onClick={onClose} className="w-full sm:w-auto shrink-0">
          <button className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all">
            <span>Open My Farm Manager</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── 3. REAL-TIME SENSOR HARDWARE SYNC (ESP32 IoT) ───────── */
/* ═══════════════════════════════════════════════════════════ */
const IoTDemo = ({ onClose }) => {
  return (
    <div className="space-y-6">
      {/* Live Telemetry HUD Bar */}
      <div className="p-5 rounded-2xl bg-[#080d14] border border-amber-500/25 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">AgriShield ESP32-WROOM-32D Solar Node</h3>
              <p className="text-[11px] text-white/40">In-Field Wireless Transceiver · Firmware v3.4 Active</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Solar Battery: 4.18V (94%)</span>
            </span>
          </div>
        </div>

        {/* 5 Real Sensor Gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 justify-items-center py-2">
          <Gauge value={28.4} max={50} color="#f97316" label="Air Temp (AHT20)" icon={Thermometer} unit="°C" />
          <Gauge value={76} max={100} color="#0ea5e9" label="Humidity (BMP280)" icon={Droplets} unit="%" />
          <Gauge value={42} max={100} color="#10b981" label="Soil (Capacitive)" icon={Leaf} unit="%" />
          <Gauge value={84} max={100} color="#eab308" label="Sunlight (BH1750)" icon={Sun} unit="kLux" />
          <Gauge value={94} max={100} color="#22c55e" label="Solar Battery" icon={Battery} unit="%" />
        </div>
      </div>

      {/* Field Hardware Specification Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Power Architecture</p>
          <p className="text-xs font-bold text-white">3.7V 18650 Li-ion + 5V Solar</p>
          <p className="text-[11px] text-white/50">TP4056 MPPT controller with deep-sleep wake timer on GPIO 4.</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Sensor Bus Interface</p>
          <p className="text-xs font-bold text-white">I2C (SDA 21 / SCL 22)</p>
          <p className="text-[11px] text-white/50">AHT20 Temp/Hum + BH1750 Lux on hardware I2C bus.</p>
        </div>
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/8 space-y-1">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Transmission Protocol</p>
          <p className="text-xs font-bold text-white">WiFi / LoRa 868MHz Telemetry</p>
          <p className="text-[11px] text-white/50">15s telemetry heartbeat packets with CRC32 payload verification.</p>
        </div>
      </div>

      {/* Hardware Superiority Callout */}
      <div className="p-4 rounded-2xl bg-amber-500/[0.07] border border-amber-500/25 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">
            Hardware Advantage over Software-Only Apps
          </span>
          <p className="text-xs text-white/80">
            Plantix only analyzes camera leaf photos. AgriShield syncs with in-field ESP32 sensor hardware to forecast spore germination and leaf wetness hours before diseases visibly spread.
          </p>
        </div>
        <Link to="/devices" onClick={onClose} className="w-full sm:w-auto shrink-0">
          <button className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all">
            <span>Connect ESP32 Field Nodes</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── 4. MULTILINGUAL SMART CHAT ADVISOR (AI AGRONOMIST) ──── */
/* ═══════════════════════════════════════════════════════════ */
const AIDemo = ({ onClose }) => {
  const [selectedLang, setSelectedLang] = useState('English');

  return (
    <div className="space-y-6">
      {/* Top Banner with Agronomist Photo */}
      <div className="relative rounded-2xl overflow-hidden border border-purple-500/25 p-5 shadow-2xl bg-[#090b14]">
        <img
          src={CURATED_FARM_PHOTOS.agronomist}
          alt="Agronomist Advisory"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30 filter contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070912] via-[#070912]/85 to-transparent" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-bold">
              <Bot className="w-3.5 h-3.5" />
              <span>Google Gemini Flash & NVIDIA NIM · 1,000,000 TPM Bandwidth</span>
            </div>
            <h3 className="text-xl font-black text-white">Multilingual AI Crop Doctor</h3>
            <p className="text-xs text-white/60">Zero chat rate limits · 13 Indian regional languages + Voice Doctor playback</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
            <Volume2 className="w-4 h-4" />
            <span>Voice Audio Enabled</span>
          </div>
        </div>
      </div>

      {/* Simulated Live Dialogue Box */}
      <div className="rounded-2xl bg-[#070a10] border border-white/10 p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <span className="text-[10px] font-extrabold text-white/40 uppercase tracking-widest">
            Audited Agronomic Dialogue Transcript
          </span>
          <div className="flex gap-1.5">
            {['English', 'తెలుగు (Telugu)', 'हिन्दी (Hindi)'].map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                  selectedLang === lang ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Farmer Question */}
        <div className="flex justify-end">
          <div className="max-w-[85%] p-3.5 rounded-2xl rounded-tr-sm bg-emerald-500 text-white text-xs font-medium shadow-md">
            {selectedLang.includes('Telugu')
              ? 'నా టమోటా ఆకులపై పసుపు రింగులు మరియు నల్లని మచ్చలు ఉన్నాయి. దీనికి సరైన మందు మరియు మోతాదు చెప్పండి.'
              : selectedLang.includes('Hindi')
              ? 'मेरे टमाटर के पत्तों पर पीले छल्ले और गहरे भूरे धब्बे हैं। इसका सही इलाज और स्प्रे खुराक क्या है?'
              : 'My tomato leaves have yellow halos and target-like dark brown rings. What is the approved CIBRC fungicide and 20L tank dose?'}
          </div>
        </div>

        {/* AI Doctor Prescription Answer */}
        <div className="flex justify-start items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div className="max-w-[88%] p-4 rounded-2xl rounded-tl-sm bg-white/[0.05] border border-white/10 text-white space-y-2 text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="font-extrabold text-purple-400">AgriShield AI Agronomist</span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> CIBRC Verified
              </span>
            </div>
            <p className="text-slate-200">
              {selectedLang.includes('Telugu')
                ? 'రోగ నిర్ధారణ: టమోటా ముందస్తు తెగులు (Early Blight - Alternaria solani). ఆమోదించబడిన రసాయన చికిత్స: ఇండోఫిల్ M-45 (మాంకోజెబ్ 75% WP) ను 20 లీటర్ల స్ప్రేయర్ ట్యాంక్‌కు 40 గ్రాములు (2.0 గ్రా/లీ) కలిపి పిచికారీ చేయండి. సేంద్రీయ ప్రత్యామ్నాయం: ట్రైకోడెర్మా విరిడే 1% WP (100 గ్రా/20లీ).'
                : selectedLang.includes('Hindi')
                ? 'रोग निदान: टमाटर का अगेती झुलसा (Early Blight - Alternaria solani)। CIBRC स्वीकृत रासायनिक उपचार: इंडोफिल M-45 (मैनकोजेब 75% WP) को 20 लीटर के नैपसैक स्प्रेयर टैंक में 40 ग्राम (2.0 ग्राम/लीटर) मिलाकर छिड़काव करें। जैविक उपाय: ट्राइकोडर्मा विरिडी 1% WP (100 ग्राम/20L)।'
                : 'Diagnosis: Early Blight (Alternaria solani). CIBRC Approved Chemical Formulation: Indofil M-45 (Mancozeb 75% WP) diluted at 40 grams per 20-Litre Backpack Sprayer Tank (2.0g/L). Organic biological alternative: Trichoderma viride 1% WP (100g/20L tank). Safe Pre-Harvest Interval (PHI): 3 days.'}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 rounded-2xl bg-purple-500/[0.08] border border-purple-500/25 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg shrink-0">
            💬
          </div>
          <div>
            <h4 className="text-xs font-black text-white">Interactive Soil, NPK, Weather & Spray Advice</h4>
            <p className="text-[11px] text-white/50">Ask in your mother tongue with hands-free voice audio explanation.</p>
          </div>
        </div>
        <Link to="/assistant" onClick={onClose} className="w-full sm:w-auto shrink-0">
          <button className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all">
            <span>Start AI Agronomist Chat</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── DEDICATED MODULE REGISTRY ───────────────────────────── */
/* ═══════════════════════════════════════════════════════════ */
const MODULES = [
  {
    id: 'scan',
    icon: ScanLine,
    badge: 'AI Scan Center Deep-Dive',
    title: 'Real-Time AI Disease Diagnosis',
    subtitle: 'Upload leaf photos to detect pathogens instantly with PyTorch EfficientNetV2 & Grad-CAM',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    component: ScanDemo,
  },
  {
    id: 'farm',
    icon: Sprout,
    badge: 'My Farm Operations Deep-Dive',
    title: 'Agronomic Sector & Crop Lifecycle',
    subtitle: 'Manage farm parcels, active growth stages, automated irrigation and GPS coordinates',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    component: FarmDemo,
  },
  {
    id: 'iot',
    icon: Cpu,
    badge: 'ESP32 IoT Telemetry Deep-Dive',
    title: 'Real-Time Sensor Hardware Sync',
    subtitle: 'Stream live in-field weather, soil moisture, and solar battery telemetry from ESP32 nodes',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    component: IoTDemo,
  },
  {
    id: 'ai',
    icon: Bot,
    badge: 'AI Agronomist Deep-Dive',
    title: 'Multilingual Smart Chat Advisor',
    subtitle: '24/7 personal agronomic advisory across 13 Indian languages with Voice Doctor playback',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    component: AIDemo,
  },
];

export default function DemoModal({ open, onClose, initialTab = 0 }) {
  // Enforce index within bounds
  const activeIdx = Math.max(0, Math.min(initialTab, MODULES.length - 1));
  const activeModule = MODULES[activeIdx];
  const ActiveComponent = activeModule.component;

  // Keyboard escape handler
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[81] flex items-center justify-center p-3 sm:p-5 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#080d14] border border-white/10 shadow-2xl shadow-black/80 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header: Displays ONLY this module's info clearly */}
              <div className="shrink-0 border-b border-white/8 p-5 sm:p-6 flex items-start justify-between gap-4 bg-white/[0.015]">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-2xl ${activeModule.color} border shadow-lg`}>
                    <activeModule.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-emerald-400">
                        {activeModule.badge}
                      </span>
                    </div>
                    <h2 className="font-black text-white text-lg sm:text-xl tracking-tight mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                      {activeModule.title}
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5 max-w-xl">
                      {activeModule.subtitle}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body: Displays this module's deep-dive with photos and data only */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 no-scrollbar">
                <ActiveComponent onClose={onClose} />
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-white/8 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.01]">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Real Enterprise Data & CIBRC Certified Agricultural Calculations</span>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-bold hover:bg-white/10 transition-all cursor-pointer"
                  >
                    Close View
                  </button>
                  <Link to="/register" onClick={onClose} className="flex-1 sm:flex-none">
                    <button className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black transition-all shadow-lg shadow-emerald-500/25 cursor-pointer">
                      <span>Get Started Free</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
