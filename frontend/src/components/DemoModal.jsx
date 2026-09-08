import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  X, CheckCircle2, Leaf, ChevronRight, Activity,
  Bot, Cpu, Sprout, ScanLine, Send, Sparkles, Zap,
  MapPin, Droplets, Thermometer, Sun, Battery, Wifi,
  AlertTriangle, BarChart3, Eye, Clock, Signal
} from 'lucide-react';

/* ─── Sensor value that animates randomly ─── */
const LiveValue = ({ base, range, unit, decimals = 1 }) => {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const t = setInterval(() => {
      const noise = (Math.random() - 0.5) * range;
      setVal(+(base + noise).toFixed(decimals));
    }, 1800);
    return () => clearInterval(t);
  }, [base, range, decimals]);
  return <span>{val}{unit}</span>;
};

/* ─── Circular gauge ─── */
const Gauge = ({ value, max, color, label, icon: Icon, unit }) => {
  const pct = Math.min(value / max, 1);
  const r = 28, circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          <motion.circle
            cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-white">{value}{unit}</p>
        <p className="text-[10px] text-white/35 font-medium">{label}</p>
      </div>
    </div>
  );
};

/* ─── Chat bubble ─── */
const ChatBubble = ({ role, text, delay }) => {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => {
      setVisible(true);
      if (role === 'ai') {
        setTyping(true);
        let i = 0;
        const t = setTimeout(() => {
          setTyping(false);
          const iv = setInterval(() => {
            i++;
            setTyped(text.slice(0, i));
            if (i >= text.length) clearInterval(iv);
          }, 18);
        }, 900);
        return () => clearTimeout(t);
      } else {
        setTyped(text);
      }
    }, delay);
    return () => clearTimeout(show);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex items-end gap-2 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {role === 'ai' && (
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mb-0.5">
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      )}
      <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
        role === 'user'
          ? 'bg-emerald-500 text-white rounded-br-sm'
          : 'bg-white/8 border border-white/10 text-white/85 rounded-bl-sm'
      }`}>
        {typing ? (
          <span className="flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : typed}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── DEMO PANELS ──────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════ */

const ScanDemo = () => {
  const [scanPct, setScanPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScanPct(94.7), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
      {/* Left: Leaf visual */}
      <div className="relative rounded-2xl bg-[#0a1018] border border-white/8 overflow-hidden flex flex-col items-center justify-center gap-4 p-6 min-h-[240px]">
        {/* Scan beam */}
        <motion.div
          animate={{ top: ['8%', '88%', '8%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent z-20 pointer-events-none"
        />
        {/* Leaf placeholder */}
        <div className="relative w-32 h-32 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-emerald-700 to-teal-900" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Leaf className="w-16 h-16 text-emerald-300/60" />
          </div>
          {/* Heatmap overlay */}
          <div className="absolute inset-0 opacity-50"
            style={{ background: 'radial-gradient(circle at 60% 40%, rgba(239,68,68,0.7) 0%, rgba(251,146,60,0.4) 30%, transparent 65%)' }} />
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-500/80 rounded text-[9px] font-bold text-white">
            BLIGHT
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Grad-CAM Heatmap</p>
          <p className="text-xs text-white/50">Disease region highlighted</p>
        </div>
        {/* Scan status */}
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Scan Complete
        </div>
      </div>

      {/* Right: Results */}
      <div className="space-y-3">
        {/* Disease header */}
        <div className="rounded-xl bg-white/[0.04] border border-white/8 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Diagnosis Result</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20 font-bold">Infected</span>
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white leading-tight">Tomato — Late Blight</h3>
            <p className="text-xs text-white/35 mt-0.5">Phytophthora infestans</p>
          </div>
          {/* Confidence bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/40 font-medium">Confidence</span>
              <span className="text-emerald-400 font-bold">{scanPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                animate={{ width: `${scanPct}%` }}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
              />
            </div>
          </div>
        </div>

        {/* Treatment */}
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3.5 space-y-2">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Recommended Treatment</p>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-white/70 leading-relaxed">Copper Bio-Fungicide (Bordeaux 1%) — spray every 7 days in early morning</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-white/70 leading-relaxed">Remove infected lower leaves immediately. Improve row spacing.</p>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-2.5 text-center">
            <p className="text-[10px] text-white/25 font-medium">Model</p>
            <p className="text-xs text-white/70 font-bold mt-0.5">EfficientNetV2-S</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/6 p-2.5 text-center">
            <p className="text-[10px] text-white/25 font-medium">Scan Time</p>
            <p className="text-xs text-white/70 font-bold mt-0.5">1.3 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── */
const FarmDemo = () => {
  const sectors = [
    { name: 'Tomato Sector A', crop: '🍅', stage: 'Flowering', pct: 65, status: 'healthy', area: '1.2 ha' },
    { name: 'Rice Paddy B', crop: '🌾', stage: 'Tillering', pct: 40, status: 'healthy', area: '2.0 ha' },
    { name: 'Wheat Field C', crop: '🌿', stage: 'Harvesting', pct: 92, status: 'warning', area: '0.8 ha' },
    { name: 'Chilli Sector D', crop: '🌶️', stage: 'Germination', pct: 15, status: 'healthy', area: '0.4 ha' },
  ];
  return (
    <div className="space-y-4 h-full">
      {/* Farm header */}
      <div className="rounded-xl bg-white/[0.04] border border-white/8 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Green Valley Farm</h3>
            <p className="text-[11px] text-white/35">17.3850°N, 78.4867°E · Hyderabad, Telangana</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-extrabold text-white">4.4 ha</p>
          <p className="text-[10px] text-white/35">Total Area</p>
        </div>
      </div>

      {/* Sectors grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sectors.map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="rounded-xl bg-white/[0.03] border border-white/8 p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{s.crop}</span>
                <div>
                  <p className="text-xs font-bold text-white/85">{s.name}</p>
                  <p className="text-[10px] text-white/30">{s.area}</p>
                </div>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                s.status === 'warning'
                  ? 'bg-amber-500/12 text-amber-400 border-amber-500/25'
                  : 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25'
              }`}>
                {s.status === 'warning' ? 'Attention' : 'Healthy'}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-white/35 font-medium">{s.stage}</span>
                <span className="text-white/55 font-bold">{s.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  animate={{ width: `${s.pct}%` }}
                  transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${s.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Crops', value: '4', icon: '🌱' },
          { label: 'Healthy Rate', value: '87%', icon: '✅' },
          { label: 'Next Spray', value: '3 days', icon: '💧' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/6 p-3 text-center">
            <p className="text-base">{icon}</p>
            <p className="text-sm font-extrabold text-white mt-1">{value}</p>
            <p className="text-[10px] text-white/30 font-medium">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── */
const IoTDemo = () => {
  const nodes = [
    { name: 'Node Alpha', id: 'ESP-A3F2', online: true, battery: 82, signal: 4 },
    { name: 'Node Beta', id: 'ESP-B7C1', online: true, battery: 61, signal: 3 },
    { name: 'Node Gamma', id: 'ESP-C9D4', online: false, battery: 0, signal: 0 },
  ];
  return (
    <div className="space-y-4 h-full">
      {/* Live sensor gauges */}
      <div className="rounded-xl bg-white/[0.04] border border-white/8 p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Live Sensor Readings</p>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 justify-items-center">
          <Gauge value={29.4} max={50} color="#f97316" label="Temp" icon={Thermometer} unit="°C" />
          <Gauge value={71} max={100} color="#0ea5e9" label="Humidity" icon={Droplets} unit="%" />
          <Gauge value={43} max={100} color="#10b981" label="Soil" icon={Leaf} unit="%" />
          <Gauge value={78} max={100} color="#eab308" label="Light" icon={Sun} unit="%" />
          <Gauge value={82} max={100} color="#22c55e" label="Battery" icon={Battery} unit="%" />
        </div>
      </div>

      {/* Node status */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1">Field Nodes</p>
        {nodes.map((node, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.35 }}
            className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
              node.online ? 'bg-white/[0.03] border-white/8' : 'bg-white/[0.01] border-white/4 opacity-40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center ${
                node.online ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-white/5 border border-white/8'
              }`}>
                <Cpu className={`w-4 h-4 ${node.online ? 'text-emerald-400' : 'text-white/20'}`} />
                {node.online && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#060a10]" />}
              </div>
              <div>
                <p className="text-xs font-bold text-white/80">{node.name}</p>
                <p className="text-[10px] text-white/30 font-mono">{node.id}</p>
              </div>
            </div>
            {node.online ? (
              <div className="flex items-center gap-3 text-[11px] text-white/40">
                <span className="flex items-center gap-1">
                  <Battery className="w-3 h-3" /> {node.battery}%
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4].map(b => (
                    <div key={b} className={`w-0.5 rounded-full ${b <= node.signal ? 'bg-emerald-400' : 'bg-white/15'}`}
                      style={{ height: b * 4 + 2 }} />
                  ))}
                </div>
                <span className="text-emerald-400 font-bold">Online</span>
              </div>
            ) : (
              <span className="text-[11px] text-white/25 font-medium">Offline</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* System health bar */}
      <div className="rounded-xl bg-white/[0.03] border border-white/6 p-3.5 flex items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/40 font-medium">System Health</span>
            <span className="text-emerald-400 font-bold">87% Optimal</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div animate={{ width: '87%' }} transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className="text-xs font-bold text-white/60">Last Sync</p>
          <p className="text-[11px] text-emerald-400 font-bold">12s ago</p>
        </div>
      </div>
    </div>
  );
};

/* ─── */
const AIDemo = () => {
  const conversation = [
    { role: 'user', text: 'My tomato leaves have yellow and dark brown spots. What disease is this?', delay: 300 },
    { role: 'ai', text: 'Based on your description, this sounds like Early Blight (Alternaria solani). It\'s very common in tomatoes during humid weather. I recommend spraying Mancozeb 75% WP at 2.5g/litre every 10 days.', delay: 900 },
    { role: 'user', text: 'Is there an organic option?', delay: 3200 },
    { role: 'ai', text: 'Yes! Neem oil spray (5ml/litre) works well as an organic alternative. Apply in the early morning or evening. Also remove and burn infected leaves to stop the spread.', delay: 4000 },
  ];
  const suggestions = ['How to improve soil NPK?', 'Best time to irrigate?', 'Fertilizer schedule for rice'];

  return (
    <div className="flex flex-col h-full gap-3" style={{ minHeight: 340 }}>
      {/* Header */}
      <div className="rounded-xl bg-white/[0.04] border border-white/8 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white/85">AgriShield AI Advisor</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" /> Online · Powered by NVIDIA NIM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
          <span className="text-[10px] font-bold text-white/50">🇬🇧 English</span>
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 rounded-xl bg-[#080d14] border border-white/6 p-3.5 space-y-3 overflow-y-auto min-h-[200px] max-h-[240px]">
        {conversation.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.text} delay={msg.delay} />
        ))}
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map(s => (
          <button key={s} className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all duration-150">
            {s}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex items-center gap-3">
        <input disabled placeholder="Ask about crops, diseases, soil, or treatment..."
          className="flex-1 bg-transparent text-xs text-white/40 placeholder-white/25 focus:outline-none" />
        <button disabled className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <Send className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
/* ─── MAIN MODAL ─────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════ */

const DEMOS = [
  {
    id: 'scan', icon: ScanLine, label: 'AI Scan', badge: 'AI Scan Center',
    title: 'Real-Time AI Disease Diagnosis',
    subtitle: 'Upload a leaf photo and get an instant diagnosis with 98.4% accuracy',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    accentColor: '#10b981',
    component: ScanDemo,
  },
  {
    id: 'farm', icon: Sprout, label: 'My Farm', badge: 'Farm Operations',
    title: 'Agronomic Sector & Crop Lifecycle',
    subtitle: 'Manage sectors, track crop growth stages and GPS-tagged field data',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    accentColor: '#0ea5e9',
    component: FarmDemo,
  },
  {
    id: 'iot', icon: Cpu, label: 'IoT Nodes', badge: 'ESP32 Telemetry',
    title: 'Real-Time Sensor Hardware Sync',
    subtitle: 'Live field metrics streamed from your ESP32 sensor network',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    accentColor: '#f59e0b',
    component: IoTDemo,
  },
  {
    id: 'ai', icon: Bot, label: 'AI Advisor', badge: 'AI Agronomist',
    title: 'Multilingual Smart Chat Advisor',
    subtitle: '24/7 AI guidance on soil health, treatments and spray schedules',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    accentColor: '#a855f7',
    component: AIDemo,
  },
];

export default function DemoModal({ open, onClose, initialTab = 0 }) {
  const [active, setActive] = useState(initialTab);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setActive(initialTab);
    setKey(k => k + 1);
  }, [initialTab, open]);

  // Keyboard close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const demo = DEMOS[active];
  const DemoComponent = demo.component;

  const handleTab = (idx) => {
    setActive(idx);
    setKey(k => k + 1);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0a1018] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="shrink-0 border-b border-white/6 p-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${demo.color} border`}>
                    <demo.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-white text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        {demo.title}
                      </h2>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-white/40 border border-white/8 tracking-wide hidden sm:inline-flex">
                        DEMO
                      </span>
                    </div>
                    <p className="text-xs text-white/35 mt-0.5">{demo.subtitle}</p>
                  </div>
                </div>
                <button onClick={onClose}
                  className="shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all duration-150">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* ── Tab bar ── */}
              <div className="shrink-0 border-b border-white/6 px-5 flex gap-1 overflow-x-auto no-scrollbar">
                {DEMOS.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => handleTab(i)}
                    className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all duration-200 ${
                      active === i
                        ? 'border-emerald-400 text-white'
                        : 'border-transparent text-white/35 hover:text-white/60'
                    }`}
                  >
                    <d.icon className="w-3.5 h-3.5" />
                    {d.label}
                  </button>
                ))}
              </div>

              {/* ── Demo content ── */}
              <div className="flex-1 overflow-y-auto p-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <DemoComponent />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── Footer CTA ── */}
              <div className="shrink-0 border-t border-white/6 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.015]">
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>This is a live preview. Sign up to use with real data.</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={onClose}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:text-white hover:border-white/20 transition-all duration-150">
                    Close Preview
                  </button>
                  <Link to="/register" onClick={onClose} className="flex-1 sm:flex-none">
                    <button className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all duration-150 shadow-lg shadow-emerald-500/25">
                      Get Started Free
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
