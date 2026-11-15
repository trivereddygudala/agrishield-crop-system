import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Plus, MessageSquare, Trash2, Menu, Copy, Check, Sparkles, X,
  Search, Pin, Share2, ThumbsUp, ThumbsDown, Volume2, VolumeX, Mic, MicOff,
  ArrowUp, ChevronDown, MoreVertical, Image as ImageIcon, BookOpen, Cpu, 
  ExternalLink, Edit3, Globe, Layers, CheckCircle2, ShieldCheck, Leaf, RefreshCw,
  Camera, Paperclip, PhoneCall, AlertTriangle, Droplets, CloudRain, TrendingUp, Building2, Store,
  MapPin, Compass, FileText, Bug, FlaskConical, Sun, Wind, Thermometer, Calculator, Navigation,
  Stethoscope, Download, ChevronRight, SlidersHorizontal, ArrowUpRight, Wrench, Fuel, Gauge,
  Radio, ShieldAlert, Bell, Activity, Server, Database, Key, HelpCircle, CheckSquare, Square
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import API from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { compressImageForUpload } from '../../utils/imageCompression';
import { printPrescriptionSlip } from '../../utils/prescriptionShare';
import { generateAndDownloadPrescriptionPDF } from '../../utils/pdfPrescriptionGenerator';
import { processSpeechRecognitionEvent } from '../../utils/speechSanitizer';
import VoiceCropDoctorModal from '../../components/intelligence/VoiceCropDoctorModal';

/* ───────────────────────────────────────
   Inline text renderer: **bold**, `code`
─────────────────────────────────────── */
function InlineText({ text }) {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* ───────────────────────────────────────
   Full Markdown → JSX renderer
─────────────────────────────────────── */
function MarkdownMessage({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { i++; continue; }

    // Callout / Accent block
    if (trimmed.startsWith('| ') && !trimmed.endsWith('|')) {
      nodes.push(
        <div key={i} className="my-2.5 pl-3 py-1 border-l-2 border-emerald-500 font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm tracking-wide">
          <InlineText text={trimmed.slice(2)} />
        </div>
      );
      i++; continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      nodes.push(<h4 key={i} className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mt-3 mb-1"><InlineText text={trimmed.slice(5)} /></h4>);
      i++; continue;
    }
    if (trimmed.startsWith('### ')) {
      nodes.push(<h3 key={i} className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-3.5 mb-1.5"><InlineText text={trimmed.slice(4)} /></h3>);
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={i} className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-3.5 mb-2"><InlineText text={trimmed.slice(3)} /></h2>);
      i++; continue;
    }
    if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={i} className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-300 mt-3 mb-2"><InlineText text={trimmed.slice(2)} /></h1>);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-=]{3,}$/.test(trimmed)) {
      nodes.push(<hr key={i} className="my-3 border-slate-200 dark:border-slate-800" />);
      i++; continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3);
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <div key={i} className="my-2.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100">
          {lang && <div className="px-3 py-1 bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang}</div>}
          <pre className="p-3 text-xs font-mono overflow-x-auto leading-relaxed text-slate-200">
            {codeLines.join('\n')}
          </pre>
        </div>
      );
      continue;
    }

    // Markdown table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i].trim());
        i++;
      }
      const headerRow = tableRows[0];
      const bodyRows = tableRows.slice(1).filter(r => !/^\|[\s|:-]+\|$/.test(r));
      const parseCells = row => row.split('|').slice(1, -1).map(c => c.trim());
      const headers = parseCells(headerRow);
      nodes.push(
        <div key={i} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800/80">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'}>
                  {parseCells(row).map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet items
    if (/^[-*]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-2 space-y-1 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push({ num, text: lines[i].trim().replace(/^\d+\.\s+/, '') });
        num++;
        i++;
      }
      nodes.push(
        <ol key={i} className="my-2 space-y-1 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 w-4 shrink-0 text-xs">{item.num}.</span>
              <span><InlineText text={item.text} /></span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className="my-2 pl-3 border-l-2 border-emerald-500 text-slate-600 dark:text-slate-400 text-xs sm:text-sm italic">
          <InlineText text={trimmed.slice(2)} />
        </blockquote>
      );
      i++; continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-2">
        <InlineText text={trimmed} />
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

/* ───────────────────────────────────────
   Main Component: AgriShield Chat Assistant (Portal-Specific Hybrid Architecture)
─────────────────────────────────────── */
const AIAssistantPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  // Determine user role and active portal view
  const baseUserRole = (user?.role?.toLowerCase() || 'farmer');
  const initialPortal = (baseUserRole === 'admin') ? 'admin' :
                        (baseUserRole === 'equipment_provider' || baseUserRole === 'provider') ? 'equipment_provider' :
                        'farmer';
  const [selectedPortal, setSelectedPortal] = useState(initialPortal);
  const isRoleSwitcherAllowed = baseUserRole === 'admin' || baseUserRole === 'tester';

  // Navigation & Drawer states
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat'); // 'chat' | 'toolkit'
  const [searchQuery, setSearchQuery] = useState('');
  const [commandCategory, setCommandCategory] = useState('all');

  // Equipment Provider Tool States
  const [selectedImplement, setSelectedImplement] = useState('rotavator'); // 'rotavator' | 'mb_plough' | 'cultivator' | 'harvester' | 'seed_drill'
  const [providerAcres, setProviderAcres] = useState(2.0);
  const [droneChecklist, setDroneChecklist] = useState({
    battery: true,
    wind: true,
    altitude: true,
    nozzle: false,
    failsafe: true
  });

  // Admin Tool States
  const [outbreakCrop, setOutbreakCrop] = useState('Tomato Early Blight');
  const [outbreakDistrict, setOutbreakDistrict] = useState('Guntur');

  // Farmer Tool States
  const [selectedAcres, setSelectedAcres] = useState(1.0);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showVoiceDoctor, setShowVoiceDoctor] = useState(false);

  // Portal Specific Configurations & Theming
  const portalThemes = {
    farmer: {
      accentColor: 'emerald',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      pillBg: 'bg-emerald-600 text-white',
      borderAccent: 'border-emerald-500',
      headerIcon: '🌾',
      title: isTe ? "అగ్రిషీల్డ్ చాట్ అసిస్టెంట్" : "AgriShield Chat Assistant",
      roleLabel: isTe ? "రైతు మిత్ర & క్రాప్ డాక్టర్" : "Crop Doctor & Smart Advisor",
      tagline: isTe ? "పంట తెగుళ్ల నివారణ, 16L పంపు మోతాదు, వాతావరణం మరియు మండి ధరలు" : "Crop Disease Prescriptions, 16L Calibrations, Weather Windows & Mandi Rates",
      welcomeMsg: isTe 
        ? `🌾 **నమస్కారం ${user?.name || 'రైతు సోదరులారా'}! నేను మీ అగ్రిషీల్డ్ చాట్ అసిస్టెంట్‌ని.**\n\nపంట తెగుళ్ల గుర్తింపు, 16 లీటర్ల పంపుకి మందు మోతాదు, నేటి వాతావరణంలో మందు కొట్టవచ్చా లేదా, మరియు తాజా మండి మార్కెట్ ధరల గురించి నన్ను అడగండి!`
        : `🌾 **Hello ${user?.name || 'Farmer'}! Welcome to the AgriShield Chat Assistant.**\n\nI can help you diagnose crop diseases, calculate exact 16L knapsack sprayer dilutions, check today's weather spray safety window, and look up real-time Mandi market prices!`,
      suggestionCards: [
        { icon: Leaf, title: "🌿 16L Sprayer Pump Dosage", prompt: "Explain the recommended treatments and exact 16L spray pump dosages for major crop diseases." },
        { icon: CloudRain, title: "🌦️ Today's Weather & Spray Safety", prompt: "Based on today's weather and rain forecast, is it safe to spray pesticides today?" },
        { icon: Building2, title: "🏛️ Govt Schemes & RBK Centers", prompt: "What government schemes, Rythu Bharosa subsidies, and certified inputs are available?" },
        { icon: Globe, title: "💰 Today's Mandi Market Rates", prompt: "What are today's wholesale Mandi prices for major agricultural crops in my region?" }
      ]
    },
    equipment_provider: {
      accentColor: 'indigo',
      badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
      pillBg: 'bg-indigo-600 text-white',
      borderAccent: 'border-indigo-500',
      headerIcon: '🚜',
      title: "AgriShield Chat Assistant",
      roleLabel: "Machinery Fleet & Operations Copilot",
      tagline: "Diesel Consumption, Maintenance Hours, Spray Drones & Dispatch Pricing",
      welcomeMsg: `🚜 **Hello ${user?.name || 'Machinery Provider'}! Welcome to the AgriShield Chat Assistant.**\n\nI am your dedicated Agricultural Machinery & Fleet Copilot. Ask me about diesel consumption per acre, tractor maintenance countdowns (oil change @ 250h), spray drone DGCA operating rules, and custom hiring dispatch rates.`,
      suggestionCards: [
        { icon: Fuel, title: "⛽ Diesel Consumption per Acre", prompt: "What is the recommended diesel consumption per acre for a 45HP tractor with a 6-foot rotavator?" },
        { icon: Wrench, title: "🔧 Tractor Engine Maintenance", prompt: "At how many operating hours should I change engine oil, oil filter, and diesel fuel filter?" },
        { icon: Radio, title: "🚁 Spray Drone Flight SOPs", prompt: "What are the standard operating procedures for agricultural spray drones regarding altitude, speed, and wind?" },
        { icon: TrendingUp, title: "💰 Custom Hiring Rental Pricing", prompt: "What are the standard per-acre and per-hour custom hiring benchmark rates for tractors and implements?" }
      ]
    },
    admin: {
      accentColor: 'violet',
      badgeBg: 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border-violet-300 dark:border-violet-800',
      pillBg: 'bg-violet-600 text-white',
      borderAccent: 'border-violet-500',
      headerIcon: '🛡️',
      title: "AgriShield Chat Assistant",
      roleLabel: "Admin Intelligence & Security Operations",
      tagline: "OWASP Top 10 Telemetry, Microservices Health, IoT Fleets & Outbreak Alerts",
      welcomeMsg: `🛡️ **Hello ${user?.name || 'Administrator'}! Welcome to the AgriShield Chat Assistant.**\n\nI am your Enterprise Admin Intelligence Copilot. I can assist with platform security audits, OWASP rate limiting compliance, IoT telemetry fleets, MongoDB health, and drafting 1-click regional disease outbreak broadcasts.`,
      suggestionCards: [
        { icon: ShieldCheck, title: "🔒 System & OWASP Security Audit", prompt: "Summarize recent system security audit logs, JWT expiry, and OWASP rate limiter compliance" },
        { icon: Server, title: "⚡ Microservices & API Health", prompt: "Check health status and response latency of FastAPI backend, PyTorch ML engine, and MongoDB" },
        { icon: Cpu, title: "📟 IoT Hardware Fleet Telemetry", prompt: "Inspect active ESP32 IoT node telemetry, battery status, Wi-Fi RSSI, and firmware version" },
        { icon: Bell, title: "📢 Draft Outbreak Alert Broadcast", prompt: "Draft an emergency WhatsApp and SMS advisory broadcast to farmers for an early blight outbreak" }
      ]
    }
  };

  const activeTheme = portalThemes[selectedPortal] || portalThemes.farmer;

  // Extensive Portal Commands List (14-16 commands per portal)
  const portalCommands = {
    farmer: [
      { id: 'f1', cat: 'spray', icon: Leaf, label: isTe ? "🌿 16L పంపు మోతాదు" : "🌿 16L Sprayer Dosage", prompt: isTe ? "16 లీటర్ల స్ప్రే పంపుకు సరైన పురుగుమందు మోతాదు ఎంత?" : "What is the standard 16L knapsack spray pump dosage for my crop?" },
      { id: 'f2', cat: 'weather', icon: CloudRain, label: isTe ? "🌦️ స్ప్రే చేయవచ్చా?" : "🌦️ Rain / Spray Window", prompt: isTe ? "ఈ రోజు తోటలో మందు పిచికారీ చేయడం సురక్షితమేనా?" : "Is it safe to spray pesticides today based on weather and rain?" },
      { id: 'f3', cat: 'mandi', icon: Globe, label: isTe ? "💰 మండి మార్కెట్ ధరలు" : "💰 Mandi Market Rates", prompt: isTe ? "ఈ రోజు మార్కెట్ మండిలో పంట ధరలు ఎలా ఉన్నాయి?" : "What are today's wholesale Mandi market prices for major crops in my region?" },
      { id: 'f4', cat: 'schemes', icon: Building2, label: isTe ? "🏛️ రైతు భరోసా & RBK" : "🏛️ RBK Subsidies & Seeds", prompt: isTe ? "రైతు భరోసా కేంద్రాల్లో (RBK) లభించే సబ్సిడీ విత్తనాలు మరియు ఎరువుల వివరాలు ఏమిటి?" : "Where is the nearest Rythu Bharosa Kendram (RBK) and what subsidized inputs are available?" },
      { id: 'f5', cat: 'spray', icon: Bug, label: isTe ? "🐛 జీవ నియంత్రణ & ఉచ్చులు" : "🐛 Biological IPM Traps", prompt: "What biological IPM traps, pheromone lures, and neem oil formulations should I use?" },
      { id: 'f6', cat: 'spray', icon: FlaskConical, label: isTe ? "🧪 లేబుల్ రంగు త్రిభుజం" : "🧪 Toxicity Color Triangle", prompt: "Explain the CIB&RC pesticide label color triangles and safe handling precautions." },
      { id: 'f7', cat: 'fertilizer', icon: Droplets, label: isTe ? "💧 డ్రిప్ ఎరువుల షెడ్యూల్" : "💧 Drip Fertigation Math", prompt: "How to calculate water requirement and venturi fertigation schedule for my farm?" },
      { id: 'f8', cat: 'fertilizer', icon: Sun, label: isTe ? "🌾 ఎన్పీకే ఎరువుల మోతాదు" : "🌾 NPK Fertilizer Schedule", prompt: "What is the recommended N-P-K fertilizer schedule and micronutrient dose per acre?" },
      { id: 'f9', cat: 'soil', icon: Compass, label: isTe ? "🧪 భూసార పరీక్ష ఫలితాలు" : "🧪 Soil Health Card Results", prompt: "How do I interpret my soil test results for pH, organic carbon, and electrical conductivity?" },
      { id: 'f10', cat: 'organic', icon: Leaf, label: isTe ? "🐄 జీవామృతం తయారీ" : "🐄 Jeevamrutha Recipe", prompt: "How to prepare authentic Jeevamrutha and Neemastra for organic pest management?" },
      { id: 'f11', cat: 'schemes', icon: FileText, label: isTe ? "📜 కౌలు రైతు CCRC కార్డ్" : "📜 Tenant CCRC Cards", prompt: "How can tenant farmers get CCRC cards for crop loan and e-Crop insurance benefits?" },
      { id: 'f12', cat: 'helpline', icon: Store, label: isTe ? "🏪 ఎరువుల దుకాణాలు" : "🏪 Nearest Agro Stores", prompt: "Where is the nearest authorized agro-chemical dealer and Rythu Bharosa Kendram?" },
      { id: 'f13', cat: 'helpline', icon: PhoneCall, label: isTe ? "📞 కిసాన్ కాల్ సెంటర్" : "📞 Kisan Call Center", prompt: "What is the official toll-free Kisan Call Center phone number and emergency working hours?" },
      { id: 'f14', cat: 'postharvest', icon: CheckCircle2, label: isTe ? "📦 నిల్వ తెగుళ్ల నివారణ" : "📦 Post-Harvest Storage", prompt: "How to prevent grain storage pests, aflatoxin contamination, and moisture spoilage?" }
    ],
    equipment_provider: [
      { id: 'e1', cat: 'diesel', icon: Fuel, label: "⛽ Rotavator Diesel / Acre", prompt: "What is the recommended diesel consumption per acre for a 45HP tractor with a 6-foot rotavator?" },
      { id: 'e2', cat: 'diesel', icon: Gauge, label: "🚜 MB Plough Fuel & Depth", prompt: "What is the fuel burn rate and ideal soil working depth for a 2-bottom or 3-bottom MB Plough?" },
      { id: 'e3', cat: 'maintenance', icon: Wrench, label: "⏳ Tractor Engine Oil (250h)", prompt: "At how many operating hours should I change engine oil, oil filter, and diesel fuel filter?" },
      { id: 'e4', cat: 'maintenance', icon: SlidersHorizontal, label: "🔧 Hydraulic & Trans Fluid", prompt: "When should tractor hydraulic and transmission oil be replaced, and how to bleed air?" },
      { id: 'e5', cat: 'maintenance', icon: Thermometer, label: "🛞 Tyre Pressure Guidelines", prompt: "What are the recommended front and rear tractor tyre pressures for dry plowing versus wet puddling?" },
      { id: 'e6', cat: 'drone', icon: Radio, label: "🚁 Drone Flight Altitude & Speed", prompt: "What are the standard operating procedures for agricultural spray drones regarding altitude, speed, and wind?" },
      { id: 'e7', cat: 'drone', icon: Activity, label: "🔋 Drone LiPo Battery Care", prompt: "How should I charge, store, and maintain 6S/12S drone LiPo smart batteries to maximize cycle life?" },
      { id: 'e8', cat: 'drone', icon: Droplets, label: "💧 Droplet Size & Micron VMD", prompt: "What micron droplet size (VMD) and spray nozzles are recommended for systemic fungicides vs contact insecticides?" },
      { id: 'e9', cat: 'pricing', icon: TrendingUp, label: "💰 Custom Hiring Rate Benchmarks", prompt: "What are the standard per-acre and per-hour custom hiring benchmark rates for tractors and implements?" },
      { id: 'e10', cat: 'diesel', icon: Layers, label: "🌾 Harvester Economics & Loss", prompt: "What is the diesel consumption, grain loss threshold, and per-acre rental rate for paddy combine harvesters?" },
      { id: 'e11', cat: 'maintenance', icon: Navigation, label: "📐 Laser Leveler Calibration", prompt: "How to operate and calibrate a laser land leveler transmitter and receiver for zero-slope field preparation?" },
      { id: 'e12', cat: 'pricing', icon: Building2, label: "🏛️ SMAM Machinery Subsidies", prompt: "What government subsidies (SMAM / YSR Yantra Seva) are available for buying tractors, drones, and implements?" },
      { id: 'e13', cat: 'dispatch', icon: MapPin, label: "🗺️ Multi-Farmer Route Scheduling", prompt: "How to optimize daily dispatch schedules for 5 farmers across neighboring villages to minimize dead-mile diesel?" },
      { id: 'e14', cat: 'maintenance', icon: AlertTriangle, label: "🌡️ Radiator Coolant & Overheating", prompt: "How to prevent tractor engine overheating in peak summer, clean dust fins, and mix coolant properly?" }
    ],
    admin: [
      { id: 'a1', cat: 'security', icon: ShieldCheck, label: "🔒 System & OWASP Audit", prompt: "Summarize recent system security audit logs, JWT expiry, and OWASP rate limiter compliance" },
      { id: 'a2', cat: 'security', icon: ShieldAlert, label: "🛡️ Prompt Injection Shield", prompt: "Inspect the AI prompt security validator, bleach HTML sanitizer, and regex guardrail filters" },
      { id: 'a3', cat: 'health', icon: Server, label: "⚡ Microservices & API Health", prompt: "Check health status and response latency of FastAPI backend, PyTorch ML engine, and MongoDB" },
      { id: 'a4', cat: 'health', icon: Database, label: "💾 Database Records & Health", prompt: "Check MongoDB database health, total registered users, active roles, and recent disease scan records" },
      { id: 'a5', cat: 'iot', icon: Cpu, label: "📟 IoT Fleet Telemetry Nodes", prompt: "Inspect active ESP32 IoT node telemetry, battery status, Wi-Fi RSSI, and firmware version" },
      { id: 'a6', cat: 'iot', icon: Radio, label: "📡 ESP32 Firmware OTA Push", prompt: "What is the procedure for pushing over-the-air (OTA) firmware updates to in-field ESP32 nodes?" },
      { id: 'a7', cat: 'outbreak', icon: MapPin, label: "🗺️ Outbreak Trend Analysis", prompt: "Analyze disease prediction trends across districts to identify emerging outbreak clusters" },
      { id: 'a8', cat: 'outbreak', icon: Bell, label: "📢 Draft Outbreak Alert Broadcast", prompt: "Draft an emergency WhatsApp and SMS advisory broadcast to farmers for an early blight outbreak" },
      { id: 'a9', cat: 'security', icon: Globe, label: "🌐 CORS & Security Headers", prompt: "Audit active CORS allowed origins, CSP headers, HSTS, and X-Content-Type-Options" },
      { id: 'a10', cat: 'security', icon: Key, label: "👥 User Roles & RBAC Matrix", prompt: "Audit system role definitions, permissions, and access controls for Farmer, Provider, and Admin" },
      { id: 'a11', cat: 'health', icon: Activity, label: "📈 AI Rate Limiter & Token Quota", prompt: "What are the active rate limits on AI endpoints and how is API token usage throttled?" },
      { id: 'a12', cat: 'health', icon: Layers, label: "🗄️ MongoDB Index Optimization", prompt: "Verify database indexes on predictions, users, telemetry, and collection storage efficiency" },
      { id: 'a13', cat: 'security', icon: FileText, label: "📋 Compliance Audit Logs", prompt: "How are critical administrative actions, deletions, and user role updates logged for compliance?" },
      { id: 'a14', cat: 'health', icon: RefreshCw, label: "🔄 Disaster Recovery Protocol", prompt: "Review MongoDB dump automated backup schedules, data retention, and recovery test procedures" }
    ]
  };

  const activeCommandsList = portalCommands[selectedPortal] || portalCommands.farmer;

  // Session & Message states
  const createNewSession = (title = "New Consultation") => ({
    id: 'chat_' + Date.now(),
    title,
    createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    messages: [
      { id: Date.now(), role: 'assistant', content: activeTheme.welcomeMsg }
    ]
  });

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [copiedId, setCopiedId] = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Kisan Usability States
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem('agrishield_kisan_autospeak') === 'true';
    } catch {
      return false;
    }
  });
  const [attachedPhoto, setAttachedPhoto] = useState(null);
  const [inspectionMode, setInspectionMode] = useState('leaf'); // 'leaf' | 'pest' | 'bottle'

  // References
  const chatContainerRef = useRef(null);
  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Fetch / Sync Sessions
  const fetchSessions = async () => {
    setIsSyncing(true);
    try {
      const res = await API.get('/api/ai/chat/sessions').catch(() => null);
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setSessions(res.data);
        if (!activeSessionId) setActiveSessionId(res.data[0].id);
      } else {
        const initial = createNewSession();
        setSessions([initial]);
        setActiveSessionId(initial.id);
      }
    } catch (err) {
      console.warn("Session fetch fallback:", err);
      const fallback = createNewSession();
      setSessions([fallback]);
      setActiveSessionId(fallback.id);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [selectedPortal]);

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Smooth auto-scroll with height observer
  useEffect(() => {
    const timer = setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentSession?.messages, isTyping]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 180);
  };

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send Message
  const handleSendMessage = async (queryText = inputQuery) => {
    const rawText = (queryText || '').trim();
    const photoToUpload = attachedPhoto;
    if (!rawText && !photoToUpload) return;
    if (isTyping) return;

    setAttachedPhoto(null);
    let effectiveText = rawText;
    if (!effectiveText && photoToUpload) {
      if (inspectionMode === 'pest') {
        effectiveText = "Please identify this insect pest, its damage symptoms, biological IPM traps, and targeted treatment with exact 16L spray pump dilution.";
      } else if (inspectionMode === 'bottle') {
        effectiveText = "Please inspect this agrochemical bottle / fertilizer bag label, verify its active ingredients, CIB&RC toxicity triangle, authenticity, and standard 16L knapsack sprayer dilution.";
      } else {
        effectiveText = "Please diagnose this attached crop leaf photo and advise exact remedies and 16L pump spray dosage.";
      }
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: effectiveText,
      image: photoToUpload ? photoToUpload.preview : null
    };

    const currentSess = sessions.find(s => s.id === activeSessionId) || sessions[0];
    const newTitle = (currentSess?.messages.length <= 1) ? effectiveText.slice(0, 30) : currentSess.title;
    const updatedMsgs = [...(currentSess?.messages || []), userMessage];

    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: newTitle, messages: updatedMsgs } : s));
    setInputQuery('');
    setIsTyping(true);

    try {
      const historyPayload = updatedMsgs
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await API.post('/api/ai/chat', {
        message: effectiveText,
        history: historyPayload,
        language: i18n.language || 'en',
        image_base64: photoToUpload ? photoToUpload.base64 : null,
        context: {
          user_role: selectedPortal,
          language: i18n.language || 'en',
          inspection_mode: inspectionMode
        }
      });

      const replyContent = res.data?.reply || res.data?.response || res.data?.answer || "I have processed your request.";
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: replyContent
      };
      const finalMsgs = [...updatedMsgs, assistantMessage];
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalMsgs } : s));

      // Auto-speech
      if (autoSpeak && replyContent) {
        speak(replyContent, assistantMessage.id, i18n.language || 'en', 1.0);
      }

      // Persist session
      API.put(`/api/ai/chat/sessions/${activeSessionId}`, { title: newTitle, messages: finalMsgs }).catch(() => {});
    } catch (err) {
      console.error("AI Assistant error:", err);
      const detailMsg = err?.response?.data?.detail;
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: detailMsg ? `Notice: ${detailMsg}. Please retry.` : "I encountered a temporary connection glitch. Please check your internet or retry."
      };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...updatedMsgs, errorMsg] } : s));
    } finally {
      setIsTyping(false);
    }
  };

  // Image Upload handler
  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const comp = await compressImageForUpload(file, { maxDimension: 1280, quality: 0.82 });
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedPhoto({
          file: comp.file,
          preview: URL.createObjectURL(comp.file),
          base64: reader.result
        });
      };
      reader.readAsDataURL(comp.file);
    } catch (err) {
      console.warn("Photo compression warning:", err);
    }
    e.target.value = '';
  };

  // Speech Recognition
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Google Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      const bcpMap = { te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', en: 'en-IN' };
      const langKey = (i18n.language || 'en').split('-')[0];
      rec.lang = bcpMap[langKey] || 'en-IN';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (e) => {
        const transcript = processSpeechRecognitionEvent(e);
        if (transcript) setInputQuery(transcript);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      try { rec.start(); } catch (err) { console.warn(err); }
    }
  };

  // Farmer Prescription Generator
  const handleDownloadPrescription = (content) => {
    const crop = activeFarm?.crop_type || 'Tomato';
    let disease = 'Early Blight';
    if (/powdery mildew/i.test(content)) disease = 'Powdery Mildew';
    else if (/late blight/i.test(content)) disease = 'Late Blight';
    else if (/blast/i.test(content)) disease = 'Blast';

    const chemicals = [
      'Mancozeb 75% WP @ 2.5g/L (40g per 16L pump)',
      'Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1ml/L'
    ];

    try {
      generateAndDownloadPrescriptionPDF({
        cropName: crop.toUpperCase(),
        diseaseName: disease.toUpperCase(),
        confidence: 96,
        severity: 'Moderate',
        chemicals: chemicals,
        organic: ['Neem Oil (10,000 PPM) @ 3ml/L (50ml / 16L pump)'],
        prevention: 'Apply early morning (6-9 AM). Maintain 4-hour rain-free window.',
        acres: selectedAcres,
        farmerName: user?.name || 'Farmer',
        farmLocation: user?.district || activeFarm?.location || 'Andhra Pradesh',
        language: currentLang
      });
    } catch {
      printPrescriptionSlip({
        cropName: crop.toUpperCase(),
        diseaseName: disease.toUpperCase(),
        confidence: 96,
        severity: 'Moderate',
        chemicals: chemicals,
        organic: ['Neem Oil (10,000 PPM) @ 3ml/L'],
        acres: selectedAcres,
        farmerName: user?.name || 'Farmer'
      });
    }
  };

  const handleWhatsAppShare = (content) => {
    const clean = (content || '').replace(/[*_#`|]/g, '').slice(0, 300);
    const text = `🌾 *AgriShield Kisan Prescription*:\n\n${clean}...\n\n(Generated via AgriShield Chat Assistant for local agro store purchase)`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Google Maps Helper
  const handleOpenGpsMaps = (query) => {
    if (!navigator.geolocation) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLoading(false);
        const { latitude, longitude } = pos.coords;
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}/@${latitude},${longitude},14z`, '_blank');
      },
      () => {
        setLocationLoading(false);
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
      },
      { timeout: 6000 }
    );
  };

  // Farmer Calculated Sprayer stats
  const calculatedPumps = Math.ceil(selectedAcres * 3);
  const calculatedMlLiquid = calculatedPumps * 30;
  const calculatedEstCost = Math.round(selectedAcres * 320);

  // Equipment Provider Calculation Formulas
  const implementConfigs = {
    rotavator: { name: "6ft Rotavator", dieselPerAcre: 5.0, hrsPerAcre: 1.1, ratePerAcre: 1300 },
    mb_plough: { name: "MB Plough (Deep)", dieselPerAcre: 7.0, hrsPerAcre: 1.6, ratePerAcre: 1600 },
    cultivator: { name: "9-Tyne Cultivator", dieselPerAcre: 3.0, hrsPerAcre: 0.7, ratePerAcre: 850 },
    harvester: { name: "Paddy Combine", dieselPerAcre: 9.5, hrsPerAcre: 1.0, ratePerAcre: 2600 },
    seed_drill: { name: "Zero-Till Drill", dieselPerAcre: 2.5, hrsPerAcre: 0.8, ratePerAcre: 800 }
  };
  const activeImp = implementConfigs[selectedImplement] || implementConfigs.rotavator;
  const totalDieselLitres = (activeImp.dieselPerAcre * providerAcres).toFixed(1);
  const totalWorkingHours = (activeImp.hrsPerAcre * providerAcres).toFixed(1);
  const totalFuelCost = Math.round(parseFloat(totalDieselLitres) * 98);
  const totalRentalCharge = Math.round(activeImp.ratePerAcre * providerAcres);

  // Admin Outbreak Alert Drafter
  const handleDraftOutbreakBroadcast = () => {
    const promptText = `Please draft an urgent SMS and WhatsApp notification advisory to all registered farmers in ${outbreakDistrict} district regarding an early ${outbreakCrop} outbreak alert. Include immediate preventive spray dosages per 16L pump, emergency contact numbers for the local Rythu Bharosa Kendram, and helpline guidance.`;
    handleSendMessage(promptText);
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-full min-h-0 flex-1 w-full bg-slate-50 dark:bg-[#0c0d0e] text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      
      {/* ── 1. SLIDE-OVER CONVERSATION HISTORY DRAWER ── */}
      <AnimatePresence>
        {historyDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
              onClick={() => setHistoryDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-72 sm:w-80 bg-white dark:bg-[#151619] border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl ${activeTheme.pillBg} flex items-center justify-center text-white shadow-xs font-bold text-sm`}>
                    {activeTheme.headerIcon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Chat History</h3>
                    <span className="text-[10px] text-slate-400">AgriShield Sessions</span>
                  </div>
                </div>
                <button 
                  onClick={() => setHistoryDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search in History */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search consultations..."
                    className="w-full bg-slate-100 dark:bg-[#1f2024] text-xs rounded-xl pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* New Thread Button */}
              <div className="p-3">
                <button
                  onClick={() => {
                    const s = createNewSession();
                    setSessions(prev => [s, ...prev]);
                    setActiveSessionId(s.id);
                    setHistoryDrawerOpen(false);
                    API.post('/api/ai/chat/sessions', s).catch(() => {});
                  }}
                  className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl ${activeTheme.pillBg} hover:opacity-90 text-white text-xs font-bold shadow-xs transition-transform active:scale-98`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Consultation</span>
                </button>
              </div>

              {/* Sessions List */}
              <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
                {filteredSessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); setHistoryDrawerOpen(false); }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                      s.id === activeSessionId
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/50'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{s.title || "Consultation"}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sessions.length <= 1) return;
                        setSessions(prev => prev.filter(x => x.id !== s.id));
                        if (activeSessionId === s.id) setActiveSessionId(sessions[0]?.id);
                        API.delete(`/api/ai/chat/sessions/${s.id}`).catch(() => {});
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 2. FULL COMMANDS CATALOG DRAWER / MODAL ── */}
      <AnimatePresence>
        {commandsModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
              onClick={() => setCommandsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-12 bottom-12 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[620px] z-50 bg-white dark:bg-[#151619] border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl ${activeTheme.pillBg} flex items-center justify-center text-white text-sm font-bold shadow-xs`}>
                    ⚡
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {selectedPortal.toUpperCase()} Portal Quick Commands
                    </h3>
                    <span className="text-[10px] text-slate-400">{activeCommandsList.length} High-Precision Commands Available</span>
                  </div>
                </div>
                <button 
                  onClick={() => setCommandsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Commands Grid */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeCommandsList.map((cmd) => {
                  const CmdIcon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        setCommandsModalOpen(false);
                        handleSendMessage(cmd.prompt);
                      }}
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-[#1b1c20] hover:bg-slate-100 dark:hover:bg-[#23242a] border border-slate-200/70 dark:border-slate-800 text-left transition-all flex items-start gap-3 group"
                    >
                      <div className={`p-2 rounded-xl bg-white dark:bg-[#25262c] border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform shrink-0`}>
                        <CmdIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white mb-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {cmd.label}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {cmd.prompt}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 3. HYBRID MAIN WORKSPACE ── */}
      <div className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden">
        
        {/* Sleek Top Navigation Bar with Dynamic Portal Accents */}
        <div className="h-14 sm:h-16 px-3.5 sm:px-6 bg-white/90 dark:bg-[#0c0d0e]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setHistoryDrawerOpen(true)}
              className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Open Chat History"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">{activeTheme.headerIcon}</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    {activeTheme.title}
                  </h1>
                  <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${activeTheme.badgeBg}`}>
                    {activeTheme.roleLabel}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 hidden md:block leading-tight">
                  {activeTheme.tagline}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Badges & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Interactive Portal Switcher for Admins/Testers */}
            {isRoleSwitcherAllowed && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl text-[10px] font-extrabold border border-slate-200 dark:border-slate-700/60">
                <button
                  onClick={() => setSelectedPortal('farmer')}
                  className={`px-2 py-1 rounded-lg transition-all ${selectedPortal === 'farmer' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-2xs' : 'text-slate-500'}`}
                  title="Preview Farmer Portal Assistant"
                >
                  🌾 Farmer
                </button>
                <button
                  onClick={() => setSelectedPortal('equipment_provider')}
                  className={`px-2 py-1 rounded-lg transition-all ${selectedPortal === 'equipment_provider' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs' : 'text-slate-500'}`}
                  title="Preview Equipment Provider Copilot"
                >
                  🚜 Machinery
                </button>
                <button
                  onClick={() => setSelectedPortal('admin')}
                  className={`px-2 py-1 rounded-lg transition-all ${selectedPortal === 'admin' ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-2xs' : 'text-slate-500'}`}
                  title="Preview Admin Intelligence Assistant"
                >
                  🛡️ Admin
                </button>
              </div>
            )}

            {/* Mobile Tab Switcher: Chat vs Toolkit */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl lg:hidden text-xs font-bold">
              <button
                onClick={() => setMobileTab('chat')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mobileTab === 'chat' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-2xs' : 'text-slate-500'}`}
              >
                💬 Chat
              </button>
              <button
                onClick={() => setMobileTab('toolkit')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mobileTab === 'toolkit' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-2xs' : 'text-slate-500'}`}
              >
                🛠️ Toolkit
              </button>
            </div>

            {/* All Commands Catalog Button */}
            <button
              onClick={() => setCommandsModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200/80 dark:border-slate-700/60"
              title="View all portal quick commands"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Commands ({activeCommandsList.length})</span>
            </button>

            {/* Auto-Voice Audio Toggle */}
            <button
              onClick={() => {
                setAutoSpeak(prev => {
                  const next = !prev;
                  localStorage.setItem('agrishield_kisan_autospeak', String(next));
                  if (!next && speakingId) stopSpeech();
                  return next;
                });
              }}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                autoSpeak
                  ? `${activeTheme.pillBg} shadow-xs`
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={autoSpeak ? "Voice reading is ON" : "Turn ON voice reading"}
            >
              {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">Audio</span>
            </button>

            {/* New Thread */}
            <button
              onClick={() => {
                const s = createNewSession();
                setSessions(prev => [s, ...prev]);
                setActiveSessionId(s.id);
                API.post('/api/ai/chat/sessions', s).catch(() => {});
              }}
              className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="New Consultation"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── CHAT COLUMN BODY ── */}
        <div className={`flex-1 min-h-0 flex flex-col relative overflow-hidden ${mobileTab === 'toolkit' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Scrollable Conversation Stream */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-6 py-4 space-y-4 max-w-3xl w-full mx-auto"
          >
            {/* Suggestion Cards for Fresh Chat */}
            {currentSession?.messages.length <= 1 && (
              <div className="flex flex-col justify-end min-h-[45vh] pb-2">
                <div className="text-center mb-6">
                  <div className={`w-12 h-12 rounded-2xl ${activeTheme.badgeBg} flex items-center justify-center mx-auto mb-3 shadow-xs text-xl`}>
                    {activeTheme.headerIcon}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {activeTheme.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    {activeTheme.tagline}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto w-full">
                  {activeTheme.suggestionCards.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.prompt)}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#151619] hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 text-left transition-all active:scale-98 shadow-2xs group"
                      >
                        <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:scale-105 transition-transform shrink-0`}>
                          <IconComp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {currentSession?.messages.map((msg) => {
              const isUser = msg.role === 'user';
              const hasPrescriptionMention = !isUser && /mancozeb|azoxystrobin|dosage|16L|neem oil|pump|మోతాదు|లీటర్ల/i.test(msg.content);

              return (
                <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col ${isUser ? 'items-end max-w-[85%] sm:max-w-[75%]' : 'items-start max-w-full w-full'}`}>
                    
                    {/* User Attached Photo */}
                    {isUser && msg.image && (
                      <div className="mb-2 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-sm max-w-xs">
                        <img src={msg.image} alt="Crop inspection" className="w-full h-auto max-h-52 object-cover" />
                        <div className="bg-emerald-900/90 text-white text-[9px] font-bold px-2 py-0.5 text-center">
                          🌿 Attached Photo
                        </div>
                      </div>
                    )}

                    {/* Bubble Content */}
                    <div className={
                      isUser
                        ? `px-4 py-2.5 rounded-2xl ${activeTheme.pillBg} text-white text-xs sm:text-sm leading-relaxed shadow-xs`
                        : 'w-full bg-white dark:bg-[#141518] border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 shadow-2xs text-slate-900 dark:text-slate-100'
                    }>
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div>
                          <MarkdownMessage text={msg.content} />

                          {/* Interactive Prescription Quick Action Bar (Farmer Portal) */}
                          {hasPrescriptionMention && selectedPortal === 'farmer' && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                <span>16L Knapsack Sprayer Prescription Available</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPrescription(msg.content)}
                                  className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>Prescription Slip</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleWhatsAppShare(msg.content)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                                >
                                  <Share2 className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Message Footer Actions */}
                          <div className="mt-2.5 pt-2 flex items-center justify-between text-slate-400 text-[11px]">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  setCopiedId(msg.id);
                                  setTimeout(() => setCopiedId(null), 1800);
                                }}
                                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                title="Copy advice"
                              >
                                {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => speak(msg.content, msg.id, currentLang)}
                                className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${speakingId === msg.id ? 'text-emerald-500' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}
                                title="Read aloud"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setFeedbackMap(prev => ({ ...prev, [msg.id]: prev[msg.id] === 'up' ? null : 'up' }))}
                                className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${feedbackMap[msg.id] === 'up' ? 'text-emerald-500' : ''}`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setFeedbackMap(prev => ({ ...prev, [msg.id]: prev[msg.id] === 'down' ? null : 'down' }))}
                                className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${feedbackMap[msg.id] === 'down' ? 'text-rose-500' : ''}`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400">Verified Agronomic Model</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-1.5 text-slate-400 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]" />
                <span className="text-xs font-semibold ml-1 text-slate-500">AgriShield is thinking...</span>
              </div>
            )}

            <div ref={chatBottomRef} className="h-4 shrink-0" />
          </div>

          {/* Floating Scroll to Bottom Arrow */}
          <AnimatePresence>
            {showScrollBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToBottom}
                className={`absolute bottom-24 right-6 p-2 rounded-full ${activeTheme.pillBg} text-white shadow-lg hover:opacity-90 z-20`}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── SLEEK BOTTOM INPUT CONTAINER (WITH PORTAL SPECIFIC QUICK COMMANDS) ── */}
          <div className="px-3.5 sm:px-6 pt-1 pb-2 sm:pb-3 bg-white/95 dark:bg-[#0c0d0e]/95 border-t border-slate-200/60 dark:border-slate-800/60 shrink-0 z-20 max-w-3xl w-full mx-auto">
            
            {/* Quick Commands Horizontal Scroller */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setCommandsModalOpen(true)}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20"
              >
                <Sparkles className="w-3 h-3" />
                <span>Commands</span>
              </button>
              {activeCommandsList.slice(0, 7).map((cmd) => {
                const ChipIcon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => handleSendMessage(cmd.prompt)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 border border-slate-200/60 dark:border-slate-700/50 transition-colors"
                  >
                    <ChipIcon className="w-3 h-3 text-emerald-500" />
                    <span>{cmd.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Hidden Inputs */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelected} className="hidden" />
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoSelected} className="hidden" />

            {/* Attachment Dropup Menu */}
            <AnimatePresence>
              {quickMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  className="absolute bottom-20 left-4 sm:left-6 z-30 p-1.5 rounded-2xl bg-white dark:bg-[#1a1b1e] border border-slate-200 dark:border-slate-700 shadow-xl space-y-0.5 w-60"
                >
                  <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Multimodal Camera
                  </div>
                  <button
                    onClick={() => { setInspectionMode('leaf'); cameraInputRef.current?.click(); setQuickMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-500" />
                    <span>🌿 Scan Crop Leaf</span>
                  </button>
                  <button
                    onClick={() => { setInspectionMode('pest'); cameraInputRef.current?.click(); setQuickMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600"
                  >
                    <Bug className="w-3.5 h-3.5 text-amber-500" />
                    <span>🐛 Scan Pest / Insect</span>
                  </button>
                  <button
                    onClick={() => { setInspectionMode('bottle'); cameraInputRef.current?.click(); setQuickMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                    <span>🧪 Scan Fertilizer / Bottle</span>
                  </button>
                  <button
                    onClick={() => { fileInputRef.current?.click(); setQuickMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-teal-500" />
                    <span>🖼️ Choose Photo from Gallery</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attached Photo Preview */}
            <AnimatePresence>
              {attachedPhoto && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mb-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={attachedPhoto.preview} alt="Target" className="w-8 h-8 rounded-lg object-cover" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {inspectionMode === 'pest' ? '🐛 Pest Photo' : inspectionMode === 'bottle' ? '🧪 Agrochemical Bottle' : '🌿 Crop Leaf'}
                    </span>
                  </div>
                  <button onClick={() => setAttachedPhoto(null)} className="p-1 text-slate-400 hover:text-rose-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Voice Wave Banner */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mb-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[11px]">Listening in {isTe ? 'తెలుగు' : 'your language'}... Speak now</span>
                  </div>
                  <button onClick={toggleSpeechRecognition} className="text-[10px] font-black uppercase text-rose-500">
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Pill Box */}
            <div className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-full bg-slate-100 dark:bg-[#1a1b1e] border border-slate-200/80 dark:border-slate-700/60 shadow-inner focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all min-h-[42px]">
              
              <button
                type="button"
                onClick={() => setQuickMenuOpen(o => !o)}
                className="p-1.5 rounded-full text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                title="Attach photo or tool"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-1.5 rounded-full text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0"
                title="Camera Shutter"
              >
                <Camera className="w-4 h-4" />
              </button>

              <textarea
                rows={1}
                value={inputQuery}
                onChange={e => {
                  setInputQuery(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 90) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={attachedPhoto ? "Add question or send photo..." : `Ask ${activeTheme.title}...`}
                className="flex-1 resize-none bg-transparent px-2 py-1 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none leading-normal max-h-[90px] overflow-y-auto"
              />

              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-1.5 rounded-full transition-colors shrink-0 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Speak question"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!inputQuery.trim() && !attachedPhoto) || isTyping}
                className={`p-2 rounded-full transition-all shadow-xs shrink-0 ${
                  (inputQuery.trim() || attachedPhoto)
                    ? `${activeTheme.pillBg} hover:opacity-90 scale-100 shadow-md active:scale-95`
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                }`}
                title="Send"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <p className="text-center text-[9px] text-slate-400 dark:text-slate-500 mt-1 mb-0 leading-none">
              AgriShield Chat Assistant · AI Intelligence Platform · Portal: {selectedPortal.toUpperCase()}
            </p>
          </div>
        </div>

        {/* ── 4. PORTAL-SPECIFIC RIGHT TOOLKIT TRAY ── */}
        <div className={`
          w-full lg:w-80 xl:w-[360px] shrink-0 h-full border-l border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#111215] flex flex-col overflow-y-auto p-4 space-y-4 shadow-xs
          ${mobileTab === 'toolkit' ? 'flex' : 'hidden lg:flex'}
        `}>
          
          {/* Toolkit Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg ${activeTheme.pillBg} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
                🛠️
              </span>
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {selectedPortal === 'farmer' ? "Field Toolkit" : selectedPortal === 'equipment_provider' ? "Fleet & Operations Hub" : "Admin Operations Hub"}
                </h3>
                <span className="text-[10px] text-slate-400">
                  {selectedPortal === 'farmer' ? "Live Farm Calibrations" : selectedPortal === 'equipment_provider' ? "Machinery & Fuel Economics" : "System Telemetry & Controls"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileTab('chat')}
              className="lg:hidden text-xs font-bold text-emerald-600 dark:text-emerald-400"
            >
              ← Back to Chat
            </button>
          </div>

          {/* ══════════════════════════════════════════
              PORTAL 1: FARMER TOOLKIT
             ══════════════════════════════════════════ */}
          {selectedPortal === 'farmer' && (
            <>
              {/* Module 1: Active Farm Profile */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191d] border border-slate-200/70 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    🌱 Active Farm Profile
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {activeFarm?.crop_type || 'Tomato'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {activeFarm?.farm_name || 'Green Valley Farm'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  <div>📍 Location: {activeFarm?.location || 'Andhra Pradesh'}</div>
                  <div>🌾 Sown Crop: {activeFarm?.crop_type || 'Tomato (Early Stage)'}</div>
                  <div>🌱 Soil Type: {activeFarm?.soil_type || 'Black Sandy Loam'}</div>
                </div>
              </div>

              {/* Module 2: 16L Knapsack Sprayer Pump Calculator */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300/60 dark:border-emerald-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">16L Sprayer Calculator</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">Standard Mix</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Select Farm Acreage:</span>
                  <div className="flex items-center gap-1.5">
                    {[0.5, 1.0, 2.0, 5.0].map((ac) => (
                      <button
                        key={ac}
                        onClick={() => setSelectedAcres(ac)}
                        className={`flex-1 py-1 rounded-xl text-xs font-black transition-all ${
                          selectedAcres === ac
                            ? 'bg-emerald-600 text-white shadow-xs scale-102'
                            : 'bg-white dark:bg-[#202126] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {ac} Ac
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-[#1a1b1f] border border-emerald-200 dark:border-emerald-800/50 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>🚜 Knapsack 16L Pumps:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black">{calculatedPumps} Pumps</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>🧪 Active Medicine:</span>
                    <span>~{calculatedMlLiquid} ml / grams</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>💰 Est. Spray Cost:</span>
                    <span>~₹{calculatedEstCost}</span>
                  </div>
                </div>
              </div>

              {/* Module 3: 1-Click Doctor Prescription Slip & Sharing */}
              <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-300/60 dark:border-teal-800/60 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 block">
                  📄 Official Prescription Slip
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Download clean prescription slip or send directly to the fertilizer/pesticide shop.
                </p>
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadPrescription("Mancozeb 75% WP @ 2.5g/L")}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-transform active:scale-98"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Prescription PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWhatsAppShare("Prescription for " + (activeFarm?.crop_type || "Tomato"))}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-transform active:scale-98"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp Local Agro Store</span>
                  </button>
                  <a
                    href="tel:18001801551"
                    className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Toll-Free Kisan Call 1800-180-1551</span>
                  </a>
                </div>
              </div>

              {/* Module 4: Live Satellite Weather & Spraying Window */}
              <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-300/60 dark:border-sky-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
                    🌦️ Spray Safety Window
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                    SAFE TO SPRAY
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Clear Weather Forecast (Dry)
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  4-Hour rain-free rule satisfied. Spray early morning (6:00 – 9:00 AM) or late evening to prevent leaf scorch.
                </p>
              </div>

              {/* Module 5: AP Agriculture Hubs (GPS Locator) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191d] border border-slate-200/70 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    📍 Nearby Agriculture Hubs
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenGpsMaps('Rythu Bharosa Kendram near me')}
                    disabled={locationLoading}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                  >
                    <Compass className={`w-3 h-3 ${locationLoading ? 'animate-spin' : ''}`} />
                    <span>{locationLoading ? 'Locating...' : 'GPS Search'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <a
                    href="https://www.google.com/maps/search/Rythu+Bharosa+Kendram+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800 hover:border-emerald-500 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-semibold text-xs truncate">🏛️ Nearest RBK Center</span>
                  </a>
                  <a
                    href="https://www.google.com/maps/search/Agro+chemical+pesticide+fertilizer+store+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800 hover:border-emerald-500 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    <Store className="w-3.5 h-3.5 text-teal-500" />
                    <span className="font-semibold text-xs truncate">🏪 Agro Chemical Stores</span>
                  </a>
                  <a
                    href="https://www.google.com/maps/search/Mandal+Agriculture+Office+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800 hover:border-emerald-500 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-500" />
                    <span className="font-semibold text-xs truncate">🏢 MAO Mandal Office</span>
                  </a>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              PORTAL 2: EQUIPMENT PROVIDER TOOLKIT
             ══════════════════════════════════════════ */}
          {selectedPortal === 'equipment_provider' && (
            <>
              {/* Module 1: Fleet Inventory Overview */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    🚜 Fleet Inventory Status
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black">
                    Active Fleet
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1b1c20] border border-indigo-100 dark:border-indigo-900/40">
                    <div className="font-bold text-slate-800 dark:text-slate-200">Mahindra 575 DI (45HP)</div>
                    <span className="text-[10px] font-bold text-emerald-600">Available</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1b1c20] border border-indigo-100 dark:border-indigo-900/40">
                    <div className="font-bold text-slate-800 dark:text-slate-200">Shaktiman 6ft Rotavator</div>
                    <span className="text-[10px] font-bold text-emerald-600">Available</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1b1c20] border border-indigo-100 dark:border-indigo-900/40">
                    <div className="font-bold text-slate-800 dark:text-slate-200">16L Hexacopter Spray Drone</div>
                    <span className="text-[10px] font-bold text-indigo-600">Ready for Flight</span>
                  </div>
                </div>
              </div>

              {/* Module 2: Interactive Diesel & Rental Estimator */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191d] border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">Diesel & Job Estimator</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">@ ₹98/L Diesel</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Select Implement:</span>
                  <select
                    value={selectedImplement}
                    onChange={e => setSelectedImplement(e.target.value)}
                    className="w-full bg-white dark:bg-[#202126] text-xs font-semibold rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="rotavator">6ft Rotavator (5.0 L/ac)</option>
                    <option value="mb_plough">MB Plough Deep Tillage (7.0 L/ac)</option>
                    <option value="cultivator">9-Tyne Cultivator (3.0 L/ac)</option>
                    <option value="harvester">Paddy Combine Harvester (9.5 L/ac)</option>
                    <option value="seed_drill">Zero-Till Seed Drill (2.5 L/ac)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Select Field Acreage:</span>
                  <div className="flex items-center gap-1.5">
                    {[1.0, 2.0, 5.0, 10.0].map((ac) => (
                      <button
                        key={ac}
                        onClick={() => setProviderAcres(ac)}
                        className={`flex-1 py-1 rounded-xl text-xs font-black transition-all ${
                          providerAcres === ac
                            ? 'bg-indigo-600 text-white shadow-xs scale-102'
                            : 'bg-white dark:bg-[#202126] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {ac} Ac
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation Output Cards */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#202126] border border-indigo-100 dark:border-indigo-900/50 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>⛽ Estimated Diesel:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">{totalDieselLitres} Litres</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>⏱️ Total Engine Hours:</span>
                    <span>~{totalWorkingHours} Hours</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                    <span>🔥 Fuel Cost (@ ₹98/L):</span>
                    <span>₹{totalFuelCost}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>💰 Recommended Quote:</span>
                    <span>₹{totalRentalCharge}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSendMessage(`Please verify my dispatch quote for ${providerAcres} acres with a ${activeImp.name}: Estimated diesel is ${totalDieselLitres} litres, working time ${totalWorkingHours} hours, fuel cost ₹${totalFuelCost}, and rental charge ₹${totalRentalCharge}.`)}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-98"
                >
                  Send Estimate to AI Copilot
                </button>
              </div>

              {/* Module 3: Tractor Maintenance Countdown */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                    ⏳ Service Interval Countdown
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Next Service</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span>Engine Oil (15W-40)</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">185 / 250 hrs</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '74%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span>Hydraulic Fluid</span>
                      <span className="font-bold text-emerald-600">620 / 1000 hrs</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '62%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span>Air Cleaner Clean</span>
                      <span className="font-bold text-rose-500">48 / 50 hrs (Due)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: '96%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Module 4: DGCA Spray Drone Pre-Flight Checklist */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191d] border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    🚁 Drone Pre-Flight Checklist
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600">DGCA SOP</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={droneChecklist.battery}
                      onChange={() => setDroneChecklist(p => ({ ...p, battery: !p.battery }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">LiPo Smart Battery @ 4.2V/cell</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={droneChecklist.wind}
                      onChange={() => setDroneChecklist(p => ({ ...p, wind: !p.wind }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Wind Speed &lt; 10 km/h (No Drift)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={droneChecklist.altitude}
                      onChange={() => setDroneChecklist(p => ({ ...p, altitude: !p.altitude }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Flight Altitude set 2.0 – 2.5m</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={droneChecklist.nozzle}
                      onChange={() => setDroneChecklist(p => ({ ...p, nozzle: !p.nozzle }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">Nozzle Flow Calibrated (150-250µ)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════
              PORTAL 3: ADMIN TOOLKIT
             ══════════════════════════════════════════ */}
          {selectedPortal === 'admin' && (
            <>
              {/* Module 1: Core Microservices & Engine Health */}
              <div className="p-3.5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">
                    ⚡ Core Platform Microservices
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                    ALL OPERATIONAL
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1b1c20] border border-violet-100 dark:border-violet-900/40">
                    <span className="font-bold text-slate-800 dark:text-slate-200">FastAPI API Engine</span>
                    <span className="text-[10px] font-bold text-emerald-600">200 OK (~18ms)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1b1c20] border border-violet-100 dark:border-violet-900/40">
                    <span className="font-bold text-slate-800 dark:text-slate-200">PyTorch ML Diagnostic Engine</span>
                    <span className="text-[10px] font-bold text-emerald-600">1226 Classes Loaded</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1b1c20] border border-violet-100 dark:border-violet-900/40">
                    <span className="font-bold text-slate-800 dark:text-slate-200">MongoDB Replica/Atlas</span>
                    <span className="text-[10px] font-bold text-emerald-600">Connected & Indexed</span>
                  </div>
                </div>
              </div>

              {/* Module 2: OWASP Top 10 Security Telemetry */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191d] border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    🔒 OWASP Protection Telemetry
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">Compliant</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800">
                    <div className="font-bold text-slate-700 dark:text-slate-300">AI Chat Rate Limit</div>
                    <div className="text-emerald-600 font-extrabold text-xs">60 req / min</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800">
                    <div className="font-bold text-slate-700 dark:text-slate-300">Auth Rate Limit</div>
                    <div className="text-emerald-600 font-extrabold text-xs">10 req / min</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800">
                    <div className="font-bold text-slate-700 dark:text-slate-300">JWT Rotation</div>
                    <div className="text-emerald-600 font-extrabold text-xs">24 Hours</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800">
                    <div className="font-bold text-slate-700 dark:text-slate-300">Prompt Sanitizer</div>
                    <div className="text-emerald-600 font-extrabold text-xs">Bleach Shield Active</div>
                  </div>
                </div>
              </div>

              {/* Module 3: 1-Click Outbreak Broadcast Drafter */}
              <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">Emergency Outbreak Alert</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-600">SMS / WhatsApp</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Target Crop / Outbreak:</span>
                  <select
                    value={outbreakCrop}
                    onChange={e => setOutbreakCrop(e.target.value)}
                    className="w-full bg-white dark:bg-[#202126] text-xs font-semibold rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Tomato Early Blight">Tomato Early Blight</option>
                    <option value="Rice Blast">Rice Blast (Magnaporthe)</option>
                    <option value="Cotton Whitefly & Leaf Curl">Cotton Whitefly & Leaf Curl</option>
                    <option value="Chilli Powdery Mildew">Chilli Powdery Mildew</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Target District:</span>
                  <select
                    value={outbreakDistrict}
                    onChange={e => setOutbreakDistrict(e.target.value)}
                    className="w-full bg-white dark:bg-[#202126] text-xs font-semibold rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="Guntur">Guntur District (AP)</option>
                    <option value="Chittoor">Chittoor District (AP)</option>
                    <option value="Kurnool">Kurnool District (AP)</option>
                    <option value="Krishna">Krishna District (AP)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleDraftOutbreakBroadcast}
                  className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Draft Farmer Alert Broadcast</span>
                </button>
              </div>

              {/* Module 4: In-Field ESP32 IoT Fleet Status */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#18191d] border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    📟 In-Field ESP32 Fleet
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">1 Node Online</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#202126] border border-slate-200/60 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>Node Alpha (ESP32-WROOM)</span>
                    <span className="text-emerald-500">Live</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    <div>📶 Wi-Fi RSSI: -65 dBm (Good)</div>
                    <div>🔋 Battery: 92% (Li-ion 4.1V)</div>
                    <div>🌱 Soil Moisture: 72% (Wet)</div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Multimodal Voice Crop Doctor Modal */}
      <VoiceCropDoctorModal 
        isOpen={showVoiceDoctor} 
        onClose={() => setShowVoiceDoctor(false)} 
        initialCrop={activeFarm?.crop_type || 'Tomato'} 
      />
    </div>
  );
};

export default AIAssistantPage;