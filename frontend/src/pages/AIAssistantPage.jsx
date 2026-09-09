import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Plus, MessageSquare, Trash2, Menu, Copy, Check, Sparkles, X,
  Search, Pin, Share2, ThumbsUp, ThumbsDown, Volume2, VolumeX, Mic, MicOff,
  ArrowUp, ChevronDown, MoreVertical, Image as ImageIcon, BookOpen, Cpu, 
  ExternalLink, Edit3, Globe, Layers, CheckCircle2, ShieldCheck, Leaf, RefreshCw,
  Camera, Paperclip, PhoneCall, AlertTriangle, Droplets, CloudRain, TrendingUp, Building2, Store,
  MapPin, Compass, FileText, Bug, FlaskConical, Sun, Wind, Thermometer, Calculator, Navigation
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useSpeechReader } from '../hooks/useSpeechReader';
import { compressImageForUpload } from '../utils/imageCompression';
import { printPrescriptionSlip } from '../utils/prescriptionShare';

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
          return <code key={i} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[12px] font-mono text-emerald-700 dark:text-emerald-400">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* ───────────────────────────────────────
   Full Markdown → JSX renderer (ChatGPT Style)
─────────────────────────────────────── */
function MarkdownMessage({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip blank lines
    if (!trimmed) { i++; continue; }

    // Callout / Left accent quote block (e.g., | Highlight or > Quote)
    if (trimmed.startsWith('| ') && !trimmed.endsWith('|')) {
      nodes.push(
        <div key={i} className="my-3 pl-3.5 py-1 border-l-2 border-slate-900 dark:border-slate-100 font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-wide">
          <InlineText text={trimmed.slice(2)} />
        </div>
      );
      i++; continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      nodes.push(<h4 key={i} className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-4 mb-1.5"><InlineText text={trimmed.slice(5)} /></h4>);
      i++; continue;
    }
    if (trimmed.startsWith('### ')) {
      nodes.push(<h3 key={i} className="text-base font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2"><InlineText text={trimmed.slice(4)} /></h3>);
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={i} className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-4 mb-2"><InlineText text={trimmed.slice(3)} /></h2>);
      i++; continue;
    }
    if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={i} className="text-xl font-black text-emerald-600 dark:text-emerald-300 mt-3 mb-2"><InlineText text={trimmed.slice(2)} /></h1>);
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
      i++; // consume closing ```
      nodes.push(
        <div key={i} className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100">
          {lang && <div className="px-3 py-1 bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang}</div>}
          <pre className="p-3.5 text-xs font-mono overflow-x-auto leading-relaxed text-slate-200">
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
        <div key={i} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
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

    // Unordered list block
    if (/^[-*]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-2 space-y-1.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-2 shrink-0" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push({ num, text: lines[i].trim().replace(/^\d+\.\s+/, '') });
        num++;
        i++;
      }
      nodes.push(
        <ol key={i} className="my-2.5 space-y-2 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <span className="font-bold text-slate-900 dark:text-slate-100 w-5 shrink-0 text-sm">{item.num}.</span>
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
        <blockquote key={i} className="my-2 pl-3 border-l-2 border-emerald-500 text-slate-600 dark:text-slate-400 text-sm italic">
          <InlineText text={trimmed.slice(2)} />
        </blockquote>
      );
      i++; continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-2.5">
        <InlineText text={trimmed} />
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

/* ───────────────────────────────────────
   Main AI Assistant Page
─────────────────────────────────────── */
const AIAssistantPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const { t, i18n } = useTranslation();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedSessionIds, setPinnedSessionIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('agrishield_pinned_chats') || '[]');
    } catch {
      return [];
    }
  });

  const userRole = user?.role?.toLowerCase() || 'farmer';

  const roleConfigs = {
    admin: {
      title: "AgriShield System Copilot",
      modelTag: "Admin Intelligence Copilot",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300",
      welcomeMsg: `Hello **${user?.name || 'Administrator'}**! I am your **AgriShield System Intelligence Copilot**.\n\nI can analyze system health, MongoDB user analytics, ESP32 IoT node telemetry, security audit logs, and disease outbreak alerts across Indian states. How can I assist your administration today?`,
      suggestionCards: [
        { icon: ShieldCheck, title: "System Security Audit", prompt: "Summarize recent system security audit logs and failed login attempts" },
        { icon: Cpu, title: "IoT Hardware Fleet", prompt: "Inspect active ESP32 IoT hardware node telemetry, battery status & connectivity" },
        { icon: Layers, title: "User & Farmer Analytics", prompt: "Summarize registered user account roles, geographic distribution & farm statistics" },
        { icon: Globe, title: "Platform Health Check", prompt: "Check backend API health, MongoDB Atlas status, and PyTorch AI engine latency" }
      ]
    },
    tester: {
      title: "AgriShield QA & Test AI",
      modelTag: "QA Simulation Model",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300",
      welcomeMsg: `Hello **${user?.name || 'QA Tester'}**! I am your **AgriShield QA & Simulation AI Assistant**.\n\nI help you run automated test suites, simulate ESP32 sensor telemetry injection, benchmark PyTorch model confidence thresholds, and debug API endpoints!`,
      suggestionCards: [
        { icon: ShieldCheck, title: "Run test suite", prompt: "Run Phase 5 production polish test suite" },
        { icon: Cpu, title: "Simulate ESP32 telemetry", prompt: "Simulate ESP32 sensor telemetry injection (Soil, Temp, Rain)" },
        { icon: Sparkles, title: "PyTorch benchmark", prompt: "Benchmark PyTorch EfficientNetV2 confidence thresholds" },
        { icon: Globe, title: "Check API latency", prompt: "Check API response latency & HTTP status codes" }
      ]
    },
    farmer: {
      title: t('assistant_page.title', "AgriShield Smart Agronomist AI"),
      modelTag: t('assistant_page.tag', "Smart Agronomist Pro"),
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300",
      welcomeMsg: t('assistant_page.welcome', { name: user?.name || 'Farmer', defaultValue: `Hello **${user?.name || 'Farmer'}**! I am your **AgriShield Smart Agronomist AI**.\n\nI can help you diagnose crop diseases, calculate fertilizer dosages, optimize drip irrigation, and check daily market prices.` }),
      suggestionCards: [
        { icon: ImageIcon, title: "Diagnose crop leaf", prompt: "How do I prevent Tomato Early Blight — organic and chemical treatments?" },
        { icon: Leaf, title: "Fertilizer dosage", prompt: "Calculate exact NPK fertilizer dosage for my crop growth stage." },
        { icon: Globe, title: "Irrigation schedule", prompt: "What drip irrigation schedule is best for today's weather?" },
        { icon: Sparkles, title: "Crop leaf yellowing", prompt: "Why are my crop leaves turning yellow at this growth stage?" }
      ]
    }
  };

  const activeRoleConfig = roleConfigs[userRole] || roleConfigs.farmer;

  const createNewSession = (title = "New Consultation") => ({
    id: 'chat_' + Date.now(),
    title,
    createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    messages: [
      { id: Date.now(), role: 'assistant', content: activeRoleConfig.welcomeMsg }
    ]
  });

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isSessionsLoaded, setIsSessionsLoaded] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [copiedId, setCopiedId] = useState(null);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [isListening, setIsListening] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Kisan Usability States: Auto-Voice Readout & In-Chat Photo Attachment
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem('agrishield_kisan_autospeak') === 'true';
    } catch {
      return false;
    }
  });
  const [attachedPhoto, setAttachedPhoto] = useState(null); // { file, preview, base64 }
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [dosageAcreage, setDosageAcreage] = useState({});
  const [inspectionMode, setInspectionMode] = useState('leaf'); // 'leaf' | 'pest' | 'bottle'
  const [locationLoading, setLocationLoading] = useState(false);

  const chatContainerRef = useRef(null);
  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Regional 1-Tap Kisan Question Shortcuts
  const kisanQuickChips = [
    {
      icon: Leaf,
      label: {
        en: "🌾 My Recent Scan Treatment",
        te: "🌾 నా ఇటీవలి పంట స్కాన్ నివారణలు",
        hi: "🌾 मेरी हालिया फसल का इलाज",
        ta: "🌾 எனது பயிர் சிகிச்சை",
        kn: "🌾 ನನ್ನ ಬೆಳೆ ಚಿಕಿತ್ಸೆ"
      },
      query: "Explain the recommended treatments and exact 16L spray pump dosages for my most recent crop disease scan."
    },
    {
      icon: Droplets,
      label: {
        en: "🧪 16L Spray Pump Dosage",
        te: "🧪 16 లీటర్ల పంపుకి మందు మోతాదు",
        hi: "🧪 16L पंप में दवा की खुराक",
        ta: "🧪 16L தெளிப்பான் மருந்தளவு",
        kn: "🧪 16L ಪಂಪ್ ಔಷಧ ಪ್ರಮಾಣ"
      },
      query: "How many grams or ml of medicine should I mix in one 16-litre knapsack sprayer pump for my crop?"
    },
    {
      icon: CloudRain,
      label: {
        en: "🌦️ Rain & Spray Safety",
        te: "🌦️ వర్షం పడుతుందా? మందు కొట్టవచ్చా?",
        hi: "🌦️ बारिश होगी? क्या आज छिड़काव करें?",
        ta: "🌦️ மழை வருமா? மருந்து அடிக்கலாமா?",
        kn: "🌦️ ಮಳೆ ಬರುತ್ತಾ? ಔಷಧಿ ಸಿಂಪಡಿಸಬಹುದೇ?"
      },
      query: "Based on today's weather and rain forecast, is it safe to spray pesticides today?"
    },
    {
      icon: Globe,
      label: {
        en: "💰 Mandi Market Rates",
        te: "💰 నేటి మండి మార్కెట్ ధరలు",
        hi: "💰 आज के मंडी भाव",
        ta: "💰 இன்றைய மண்டி விலை",
        kn: "💰 ಇಂದಿನ ಮಂಡಿ ಮಾರುಕಟ್ಟೆ ದರಗಳು"
      },
      query: "What are today's wholesale Mandi prices for major agricultural crops in my region?"
    },
    {
      icon: Sparkles,
      label: {
        en: "🌿 Organic Neem / Jeevamrutha",
        te: "🌿 జీవామృతం / వేప కషాయం తయారీ",
        hi: "🌿 जीवामृत / नीम अर्क विधि",
        ta: "🌿 ஜீவாமிர்தம் தயாரிப்பு",
        kn: "🌿 ಜೀವಾಮೃತ ತಯಾರಿಕೆ"
      },
      query: "How do I prepare organic bio-pesticide using Neem leaves/oil and Jeevamrutha at home?"
    },
    {
      icon: Building2,
      label: {
        en: "🏛️ Rythu Bharosa Kendram (RBK)",
        te: "🏛️ రైతు భరోసా కేంద్రం (RBK సేవలు)",
        hi: "🏛️ रायथू भरोसा केंद्र (RBK सेवा)",
        ta: "🏛️ ரைத்து பரோசா மையம் (RBK)",
        kn: "🏛️ ರೈತ ಭರೋಸಾ ಕೇಂದ್ರ (RBK)"
      },
      query: "What services, subsidized seeds, fertilizers, e-crop booking, and schemes are provided at village Rythu Bharosa Kendrams (RBK) in Andhra Pradesh?"
    },
    {
      icon: Store,
      label: {
        en: "🏪 Agro Stores & Govt Offices",
        te: "🏪 ఎరువుల దుకాణాలు & వ్యవసాయ ఆఫీస్",
        hi: "🏪 खाद दुकान और कृषि कार्यालय",
        ta: "🏪 உரக் கடைகள் மற்றும் அலுவலகங்கள்",
        kn: "🏪 ರಸಗೊಬ್ಬರ ಅಂಗಡಿಗಳು ಮತ್ತು ಕಚೇರಿಗಳು"
      },
      query: "How do I find authorized agro-chemical pesticide stores, PACS societies, and the Mandal Agriculture Officer (MAO) office in Andhra Pradesh?"
    }
  ];

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
      console.warn("Photo compression failed, using original:", err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedPhoto({
          file,
          preview: URL.createObjectURL(file),
          base64: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleWhatsAppShare = (adviceText) => {
    const clean = adviceText.replace(/[*_#`|]/g, '').slice(0, 320);
    const text = `🌾 *AgriShield Kisan Prescription*:\n\n${clean}...\n\n(Generated via AgriShield AI Agronomist for local agro store purchase)`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadPrescription = (msgId, content) => {
    const acres = dosageAcreage[msgId] || 1;
    const detectedCrop = /tomato|paddy|rice|cotton|chilli|groundnut|maize|wheat|potato|onion|grape|banana/i.exec(content)?.[0] || 'Field Crop';
    const detectedDisease = /early blight|late blight|leaf spot|blast|powdery mildew|downy mildew|wilt|armyworm|stem borer|bollworm|aphid|whitefly|thrips/i.exec(content)?.[0] || 'Crop Pathology Condition';
    
    // Extract chemical lines or provide standard safe fallback
    const chemicals = [];
    const lines = (content || '').split('\n');
    for (const line of lines) {
      if (/option \d|spray |mancozeb|azoxystrobin|hexaconazole|chlorantraniliprole|emamectin|acetamiprid|metalaxyl/i.test(line)) {
        const cleanL = line.replace(/[*_#`|-]/g, '').trim();
        if (cleanL.length > 8 && cleanL.length < 90) {
          chemicals.push(cleanL);
        }
      }
    }
    if (chemicals.length === 0) {
      chemicals.push('Mancozeb 75% WP @ 2.5g/L (40g per 16L pump)');
      chemicals.push('Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1ml/L (16ml per 16L pump)');
    }

    printPrescriptionSlip({
      cropName: detectedCrop.toUpperCase(),
      diseaseName: detectedDisease.toUpperCase(),
      confidence: 98,
      severity: 'Moderate',
      chemicals: chemicals.slice(0, 3),
      organic: [
        'Neem Oil (10,000 PPM) @ 3ml/L (50ml per 16L pump)',
        'Trichoderma viride bio-fungicide foliar spray'
      ],
      prevention: 'Maintain 4-hour rain-free window. Apply foliar sprays early morning (6-9 AM) or late evening (4:30-6:30 PM).',
      acres: acres,
      farmerName: user?.name || 'Farmer',
      farmLocation: user?.district || 'Andhra Pradesh',
      language: (i18n.language || 'en').split('-')[0]
    });
  };

  const handleOpenGpsMaps = (query = 'Rythu Bharosa Kendram near me') => {
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
      (err) => {
        setLocationLoading(false);
        window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
      },
      { timeout: 7000 }
    );
  };

  // Sync pinned sessions to localStorage
  useEffect(() => {
    localStorage.setItem('agrishield_pinned_chats', JSON.stringify(pinnedSessionIds));
  }, [pinnedSessionIds]);

  const [isSyncing, setIsSyncing] = useState(false);

  const fetchSessions = async () => {
    setIsSyncing(true);
    try {
      const res = await API.get('/api/ai/chat/sessions');
      if (res.data && res.data.length > 0) {
        setSessions(res.data);
        
        // Check if session_id is passed in query parameters
        const queryParams = new URLSearchParams(location.search);
        const urlSessionId = queryParams.get('session_id') || queryParams.get('id');
        if (urlSessionId && res.data.some(s => s.id === urlSessionId)) {
          setActiveSessionId(urlSessionId);
        } else {
          setActiveSessionId(res.data[0].id);
        }
      } else {
        const s = createNewSession();
        setSessions([s]);
        setActiveSessionId(s.id);
        await API.post('/api/ai/chat/sessions', s).catch(console.warn);
      }
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
    } finally {
      setIsSessionsLoaded(true);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userRole, location.search]);

  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Auto scroll down on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, isTyping]);

  // Track scroll position to show scroll-to-bottom arrow
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight > 180) {
      setShowScrollBottom(true);
    } else {
      setShowScrollBottom(false);
    }
  };

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (queryText = inputQuery) => {
    const rawText = (queryText || '').trim();
    const photoToUpload = attachedPhoto;
    if (!rawText && !photoToUpload) return;
    if (isTyping) return;

    setAttachedPhoto(null);
    let defaultPhotoPrompt = "Please diagnose this attached crop leaf photo and advise exact remedies and 16L pump spray dosage.";
    if (inspectionMode === 'pest') {
      defaultPhotoPrompt = "Please identify this insect pest, its damage symptoms, biological IPM traps, and targeted treatment with exact 16L spray pump dilution.";
    } else if (inspectionMode === 'bottle') {
      defaultPhotoPrompt = "Please inspect this agrochemical bottle / fertilizer bag label, verify its active ingredients, CIB&RC toxicity triangle, authenticity, and standard 16L knapsack sprayer dilution.";
    }
    const effectiveText = rawText || (photoToUpload ? defaultPhotoPrompt : "");
    const currentMessages = sessions.find(s => s.id === activeSessionId)?.messages || [];
    const userMessage = { 
      id: Date.now(), 
      role: 'user', 
      content: effectiveText,
      image: photoToUpload ? photoToUpload.preview : null
    };
    const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
    
    // Auto name the session after the first real user query
    const newTitle = (currentSession.messages.length <= 1) ? effectiveText.slice(0, 30) : currentSession.title;
    const updatedMsgsWithUser = [...currentSession.messages, userMessage];
    
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, title: newTitle, messages: updatedMsgsWithUser };
      }
      return s;
    }));
    setInputQuery('');
    setIsTyping(true);

    try {
      await API.put(`/api/ai/chat/sessions/${activeSessionId}`, { title: newTitle, messages: updatedMsgsWithUser }).catch(console.warn);
      
      const historyPayload = currentMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await API.post('/api/ai/chat', {
        message: effectiveText,
        history: historyPayload,
        user_id: user?.id || 'demo_user',
        role: userRole,
        language: i18n.language || 'en',
        image_base64: photoToUpload ? photoToUpload.base64 : null,
        context: {
          language: i18n.language || 'en',
          current_time_ampm: (() => {
            const d = new Date();
            let h = d.getHours();
            const m = d.getMinutes().toString().padStart(2, '0');
            const s = d.getSeconds().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            return `${h}:${m}:${s} ${ampm}`;
          })(),
          current_date: new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })
        }
      });

      const replyContent = res.data.response || res.data.reply || res.data.answer || "I have processed your request.";
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: replyContent
      };
      const finalMsgs = [...updatedMsgsWithUser, assistantMessage];
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalMsgs } : s));
      
      // Auto-Voice Readout (Kisan Audio Mode)
      if (autoSpeak && replyContent) {
        speak(replyContent, assistantMessage.id, i18n.language || 'en', audioSpeed);
      }

      await API.put(`/api/ai/chat/sessions/${activeSessionId}`, { messages: finalMsgs }).catch(console.warn);
    } catch (err) {
      console.error("AI Assistant chat error:", err);
      const detailMsg = err?.response?.data?.detail;
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: detailMsg 
          ? `Connection issue (${detailMsg}). Please retry your question.`
          : "Sorry, I encountered a temporary connection issue. Please check your network connection and try again."
      };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s));
    } finally {
      setIsTyping(false);
    }
  };

  const createNewChat = async () => {
    const s = createNewSession();
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
    setSidebarOpen(false);
    try {
      await API.post('/api/ai/chat/sessions', s);
    } catch (err) {
      console.warn("Failed to save new session:", err);
    }
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation();
    if (sessions.length === 1) return;
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) setActiveSessionId(filtered[0].id);
    try {
      await API.delete(`/api/ai/chat/sessions/${id}`);
    } catch (err) {
      console.warn("Failed to delete session:", err);
    }
  };

  const togglePinSession = (e, id) => {
    e.stopPropagation();
    setPinnedSessionIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = (text) => {
    if (navigator.share) {
      navigator.share({
        title: 'AgriShield AI Advice',
        text: text,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert("Consultation copied to clipboard!");
    }
  };

  // Text-to-Speech (Audio Voice playback)
  const toggleSpeech = (text, id) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    } else {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`|]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const bcpMap = { te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ur: 'ur-IN', or: 'or-IN', as: 'as-IN', en: 'en-IN' };
      utterance.lang = bcpMap[i18n.language] || 'en-IN';
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(id);
    }
  };

  // Speech-to-Text (Microphone voice input with regional Indian language support)
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
      rec.continuous = false;
      rec.interimResults = true;
      const bcpMap = { te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ur: 'ur-IN', or: 'or-IN', as: 'as-IN', en: 'en-IN' };
      const activeLangKey = (i18n.language || 'en').split('-')[0];
      rec.lang = bcpMap[activeLangKey] || 'en-IN';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (e) => {
        const transcript = Array.from(e.results).map(res => res[0].transcript).join('');
        if (transcript) {
          setInputQuery(transcript);
        }
      };
      rec.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (err) {
        console.warn("Speech recognition start:", err);
      }
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinnedSessions = filteredSessions.filter(s => pinnedSessionIds.includes(s.id));
  const recentSessions = filteredSessions.filter(s => !pinnedSessionIds.includes(s.id));

  // Determine user initials for avatar
  const userInitials = (user?.name || 'Farmer').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-1 w-full bg-white dark:bg-[#0d0d0d] text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans select-text">

      {/* ── MOBILE BACKDROP FOR SIDEBAR ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── CHATGPT STYLE SIDEBAR DRAWER (Picture 1) ── */}
      <div className={`
        fixed top-0 bottom-0 left-0 z-50 w-[280px] sm:w-72 flex flex-col h-full
        bg-[#171717] text-[#ececec] border-r border-[#262626]
        transition-all duration-300 ease-in-out
        lg:relative lg:z-auto lg:h-full lg:shrink-0
        ${sidebarOpen ? 'translate-x-0 shadow-2xl lg:shadow-none lg:w-72 lg:opacity-100' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none'}
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold text-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">AgriShield AI</h1>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#262626] lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search in chats */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[#212121] text-xs text-white placeholder:text-slate-400 rounded-xl pl-9 pr-3 py-2 border border-[#2e2e2e] focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Quick App Shortcut Categories */}
        <div className="px-3 py-2 space-y-1 border-b border-[#262626]">
          <button 
            onClick={() => { navigate('/scan'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-[#212121] transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>Disease Diagnostics</span>
          </button>
          <button 
            onClick={() => { navigate('/sensors'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-[#212121] transition-colors"
          >
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>IoT Sensors & Telemetry</span>
          </button>
          <button 
            onClick={() => { navigate('/market'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-[#212121] transition-colors"
          >
            <Globe className="w-4 h-4 text-amber-400" />
            <span>Mandi Market Prices</span>
          </button>
        </div>

        {/* Conversations Scroll Area */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* Pinned Section */}
          {pinnedSessions.length > 0 && (
            <div>
              <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Pinned</p>
              <div className="space-y-0.5">
                {pinnedSessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                      s.id === activeSessionId
                        ? 'bg-[#212121] text-white font-semibold'
                        : 'text-slate-300 hover:bg-[#212121]/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => togglePinSession(e, s.id)} className="p-1 text-slate-400 hover:text-amber-400">
                        <Pin className="w-3 h-3 fill-amber-400 text-amber-400" />
                      </button>
                      <button onClick={(e) => deleteSession(e, s.id)} className="p-1 text-slate-400 hover:text-rose-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recents Section */}
          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Recents</p>
            <div className="space-y-0.5">
              {recentSessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                    s.id === activeSessionId
                      ? 'bg-[#212121] text-white font-semibold'
                      : 'text-slate-300 hover:bg-[#212121]/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => togglePinSession(e, s.id)} className="p-1 text-slate-400 hover:text-amber-400" title="Pin chat">
                      <Pin className="w-3 h-3" />
                    </button>
                    {sessions.length > 1 && (
                      <button onClick={(e) => deleteSession(e, s.id)} className="p-1 text-slate-400 hover:text-rose-400" title="Delete chat">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Bottom Drawer Bar (Picture 1) */}
        <div className="p-3 border-t border-[#262626] flex items-center justify-between bg-[#171717]">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#ec4899] text-white text-xs font-bold flex items-center justify-center shadow-sm">
              {userInitials}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ACTIVE CHAT VIEW (Pictures 2 & 3) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 bg-white dark:bg-[#0d0d0d] relative overflow-hidden">

        {/* ChatGPT Style Top Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md border-b border-slate-100 dark:border-[#1e1e1e] shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={() => setSidebarOpen(o => !o)} 
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Title / Model Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1e1e1e] text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="truncate max-w-[140px] sm:max-w-xs">{activeRoleConfig.modelTag}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Kisan Auto-Voice Readout Mode Toggle */}
            <button
              onClick={() => {
                setAutoSpeak(prev => {
                  const next = !prev;
                  localStorage.setItem('agrishield_kisan_autospeak', String(next));
                  if (!next && speakingId) stopSpeech();
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-xs ${
                autoSpeak
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20 ring-2 ring-emerald-400/40'
                  : 'bg-slate-100 dark:bg-[#1e1e1e] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#282828]'
              }`}
              title={autoSpeak ? "Auto-speak is ON (Answers read aloud automatically)" : "Enable Kisan Voice (Answers will be read aloud)"}
            >
              <Volume2 className={`w-3.5 h-3.5 ${autoSpeak ? 'animate-pulse text-white' : ''}`} />
              <span className="text-[11px] font-extrabold">{autoSpeak ? "Voice: ON" : "Auto-Speak"}</span>
            </button>

            {/* Playback Speed Controller */}
            <button
              onClick={() => setAudioSpeed(s => s === 1.0 ? 1.25 : s === 1.25 ? 0.75 : 1.0)}
              className="px-2 py-1 rounded-full text-xs font-black border border-slate-200 dark:border-[#2e2e2e] bg-slate-100 dark:bg-[#1e1e1e] text-slate-700 dark:text-slate-200 hover:border-emerald-500 transition-colors shadow-xs"
              title="Voice readout speed (0.75x slow, 1.0x normal, 1.25x fast)"
            >
              🔊 {audioSpeed}x
            </button>

            <button 
              onClick={fetchSessions}
              disabled={isSyncing}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors disabled:opacity-40"
              title="Sync with database"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <button 
              onClick={createNewChat}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1e1e1e] transition-colors"
              title="New Thread"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages List Area */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3.5 sm:px-6 py-4 space-y-6 max-w-3xl w-full mx-auto"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}
        >
          {/* Empty Chat State with Suggestion Cards (Picture 3) */}
          {currentSession?.messages.length <= 1 && (
            <div className="flex flex-col justify-end min-h-[50vh] pb-4">
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">How can I help you today?</h2>
                <p className="text-xs text-slate-400 mt-1">Smart agronomy advice, crop pathology & precision farming</p>
              </div>

              {/* Action suggestion rows (like Picture 3) */}
              <div className="space-y-2 max-w-md mx-auto w-full">
                {activeRoleConfig.suggestionCards.map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#171717] hover:bg-slate-100 dark:hover:bg-[#212121] border border-slate-200/60 dark:border-[#262626] text-left transition-all active:scale-[0.99] group"
                    >
                      <div className="p-2 rounded-xl bg-white dark:bg-[#262626] text-slate-600 dark:text-slate-300 shadow-sm group-hover:text-emerald-500 transition-colors">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Render Active Conversation (Picture 2) */}
          {currentSession?.messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && index === currentSession.messages.length - 1;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col ${isUser ? 'items-end max-w-[85%] sm:max-w-[75%]' : 'items-start max-w-[100%] w-full'}`}>
                  
                  {/* User Attached Photo Thumbnail */}
                  {isUser && msg.image && (
                    <div className="mb-2 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-md max-w-xs">
                      <img src={msg.image} alt="Attached crop leaf" className="w-full h-auto max-h-56 object-cover" />
                      <div className="bg-emerald-900/80 text-white text-[10px] font-bold px-2 py-0.5 text-center">
                        🌿 Crop Leaf Photo Sent for Diagnosis
                      </div>
                    </div>
                  )}

                  {/* Message Content Container */}
                  <div className={
                    isUser
                      ? 'px-4 py-2.5 rounded-3xl bg-[#2f2f2f] text-white text-sm leading-relaxed shadow-sm'
                      : 'w-full text-slate-900 dark:text-[#ececec] text-sm leading-relaxed'
                  }>
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <MarkdownMessage text={msg.content} />

                        {/* 1. Interactive Farmer Action Card for Treatments + Acreage Calculator + Prescription Slip (Features 4 & 5) */}
                        {(() => {
                          const isAgronomyAdvice = /spray|fungicide|pesticide|dosage|dose|neem|pump|litres|carbendazim|mancozeb|azoxystrobin|hexaconazole|మందు|స్ప్రే|దవా|दवा/i.test(msg.content);
                          if (!isAgronomyAdvice) return null;
                          const currentAcres = dosageAcreage[msg.id] || 1.0;
                          const pumpsNeeded = Math.ceil(currentAcres * 3);
                          const chemMl = pumpsNeeded * 30;
                          const approxCost = Math.round(currentAcres * 320);

                          return (
                            <div className="mt-3.5 p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-700/50 shadow-xs w-full space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    🚜
                                  </span>
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wide block">
                                      Knapsack Sprayer Calibration
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
                                      Standard 16-Litre Field Pump Mix
                                    </span>
                                  </div>
                                </div>

                                {/* Feature 4: Acreage Tank & Cost Calculator */}
                                <div className="flex items-center gap-1 bg-white/80 dark:bg-[#1a1a1a] p-1 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold">
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 px-1 hidden sm:inline">Acreage:</span>
                                  {[0.5, 1.0, 2.0, 5.0].map((ac) => (
                                    <button
                                      key={ac}
                                      type="button"
                                      onClick={() => setDosageAcreage(prev => ({ ...prev, [msg.id]: ac }))}
                                      className={`px-2 py-0.5 rounded-lg font-extrabold transition-all ${
                                        currentAcres === ac
                                          ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      {ac} Ac
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Dynamic Calculated Field Requirements */}
                              <div className="px-2.5 py-1.5 rounded-xl bg-emerald-100/60 dark:bg-emerald-900/30 border border-emerald-300/50 dark:border-emerald-800/40 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-1.5">
                                <span>🚜 Need: <strong>{pumpsNeeded} pumps (16L each)</strong></span>
                                <span>🧪 Medicine: <strong>~{chemMl} ml / g</strong></span>
                                <span>💰 Est. Cost: <strong>~₹{approxCost}</strong></span>
                              </div>

                              {/* Action Buttons: Download Slip, WhatsApp, Kisan Call */}
                              <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
                                {/* Feature 5: 1-Tap Kisan Prescription Slip */}
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPrescription(msg.id, msg.content)}
                                  className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                                  title="Download Doctor-Style Prescription Slip for Agro Dealer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-teal-200" />
                                  <span>📄 Prescription Slip</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleWhatsAppShare(msg.content)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                                  title="Send advice to pesticide/fertilizer shop on WhatsApp"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  <span>WhatsApp Dealer</span>
                                </button>
                                <a
                                  href="tel:18001801551"
                                  className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                                  title="Call Kisan Call Center (1800-180-1551 Free)"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>1800 Helpline</span>
                                </a>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 2. Feature 1: Interactive Google Maps Near-Me Hub Card (RBKs, Agro Stores, MAO) */}
                        {(() => {
                          const isRbkOrStore = /rbk|rythu bharosa|sachivalayam|agro store|fertilizer shop|fertilizer store|pesticide store|pesticide shop|pacs|markfed|mao|ada|jda|రైతు భరోసా|ఎరువుల దుకాణం|పురుగు మందుల దుకాణం|వ్యవసాయ అధికారి/i.test(msg.content);
                          if (!isRbkOrStore) return null;
                          return (
                            <div className="mt-3.5 p-3 rounded-2xl bg-teal-50/90 dark:bg-teal-950/40 border border-teal-300/60 dark:border-teal-700/50 shadow-xs w-full space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    📍
                                  </span>
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wide block">
                                      Andhra Pradesh Agriculture Hubs
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
                                      Find Nearest RBK, Agro Store & Govt Buildings
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGpsMaps('Rythu Bharosa Kendram near me')}
                                  disabled={locationLoading}
                                  className="px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                                  title="Pinpoint nearest centers using your live GPS location"
                                >
                                  <Compass className={`w-3 h-3 ${locationLoading ? 'animate-spin' : ''}`} />
                                  <span>{locationLoading ? 'Locating...' : '📍 Use GPS'}</span>
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <a
                                  href="https://www.google.com/maps/search/Rythu+Bharosa+Kendram+near+me"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1a1a1a] hover:bg-teal-50 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                                >
                                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                  <span>🏛️ Nearest RBK</span>
                                </a>
                                <a
                                  href="https://www.google.com/maps/search/Agro+chemical+pesticide+fertilizer+store+near+me"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1a1a1a] hover:bg-teal-50 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                                >
                                  <Store className="w-3.5 h-3.5 text-teal-600" />
                                  <span>🏪 Agro Chemical Stores</span>
                                </a>
                                <a
                                  href="https://www.google.com/maps/search/Mandal+Agriculture+Office+near+me"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1a1a1a] hover:bg-teal-50 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                                  <span>🏢 MAO Office (Mandal)</span>
                                </a>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 3. Feature 3: Interactive Farm Weather & Spray Window Card */}
                        {(() => {
                          const isWeatherAdvice = /weather|forecast|rain|spray window|safe to spray|foliar spray weather|వాతావరణం|వర్షం|స్ప్రే సమయం/i.test(msg.content);
                          if (!isWeatherAdvice) return null;
                          return (
                            <div className="mt-3.5 p-3 rounded-2xl bg-sky-50/90 dark:bg-sky-950/40 border border-sky-300/60 dark:border-sky-700/50 shadow-xs w-full space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                    🌤️
                                  </span>
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-sky-800 dark:text-sky-300 tracking-wide block">
                                      Spraying Safety Window
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
                                      Farm Weather & Foliar Spray Advisory
                                    </span>
                                  </div>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide">
                                  ✓ Safe to Spray
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold pt-1">
                                <div className="p-1.5 rounded-xl bg-white/80 dark:bg-[#1a1a1a] border border-sky-200 dark:border-sky-800/50">
                                  <span className="text-[10px] text-slate-400 block">Today</span>
                                  <span className="text-emerald-700 dark:text-emerald-300 block">28°C • Dry ☀️</span>
                                  <span className="text-[9px] text-slate-500 font-semibold">0% Rain</span>
                                </div>
                                <div className="p-1.5 rounded-xl bg-white/80 dark:bg-[#1a1a1a] border border-sky-200 dark:border-sky-800/50">
                                  <span className="text-[10px] text-slate-400 block">Tomorrow</span>
                                  <span className="text-slate-700 dark:text-slate-200 block">29°C • Clear ⛅</span>
                                  <span className="text-[9px] text-slate-500 font-semibold">10% Rain</span>
                                </div>
                                <div className="p-1.5 rounded-xl bg-white/80 dark:bg-[#1a1a1a] border border-sky-200 dark:border-sky-800/50">
                                  <span className="text-[10px] text-slate-400 block">Day 3</span>
                                  <span className="text-slate-700 dark:text-slate-200 block">27°C • Humid 🌤️</span>
                                  <span className="text-[9px] text-slate-500 font-semibold">15% Rain</span>
                                </div>
                              </div>
                              <div className="text-[11px] font-semibold text-sky-950 dark:text-sky-200 flex items-center gap-1.5 pt-0.5">
                                <Wind className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span><strong>4-Hour Rain Rule:</strong> Spray 6-9 AM or 4:30-6:30 PM. Ensure 4 hours of dry weather after spraying to avoid wash-off.</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 4. Feature 6: Crop Pest & Insect Alert Card */}
                        {(() => {
                          const isPestAdvice = /pest|caterpillar|armyworm|stem borer|bollworm|aphid|whitefly|thrips|mite|borer|పురుగు|కీటకాలు|లద్దె/i.test(msg.content) && !/fungicide|mancozeb|carbendazim|early blight|late blight|leaf spot/i.test(msg.content);
                          if (!isPestAdvice) return null;
                          return (
                            <div className="mt-3.5 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-700/50 shadow-xs w-full space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                  🐛
                                </span>
                                <div>
                                  <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wide block">
                                    Integrated Pest Management (IPM)
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
                                    Biological Lures, Sticky Traps & Targeted Sprays
                                  </span>
                                </div>
                              </div>
                              <div className="p-2 rounded-xl bg-white/80 dark:bg-[#1a1a1a] border border-amber-200 dark:border-amber-800/60 text-[11px] space-y-1 text-slate-700 dark:text-slate-200 font-semibold">
                                <div>• <strong>Pheromone Traps:</strong> Install 5 lure traps per acre for armyworm / bollworm moths.</div>
                                <div>• <strong>Yellow / Blue Cards:</strong> 10 sticky sheets per acre at canopy level for aphids & thrips.</div>
                                <div>• <strong>Bio-Spray:</strong> Neem Oil 10,000 PPM @ 50 ml per 16-litre spray pump (3ml/L).</div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 5. Feature 2: Agrochemical Bottle & Fertilizer Label Card */}
                        {(() => {
                          const isBottleAdvice = /bottle|chemical label|pesticide label|active ingredient|cib&rc|toxicity triangle|సీసా|ప్యాకెట్|బాటిల్|లేబుల్/i.test(msg.content);
                          if (!isBottleAdvice) return null;
                          return (
                            <div className="mt-3.5 p-3 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-300/60 dark:border-purple-700/50 shadow-xs w-full space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                  🧪
                                </span>
                                <div>
                                  <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300 tracking-wide block">
                                    Agrochemical Label Verification
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
                                    Active Ingredients, Toxicity Triangle & Authenticity
                                  </span>
                                </div>
                              </div>
                              <div className="p-2 rounded-xl bg-white/80 dark:bg-[#1a1a1a] border border-purple-200 dark:border-purple-800/60 text-[11px] space-y-1 text-slate-700 dark:text-slate-200 font-semibold">
                                <div>• <strong>CIB&RC Registration:</strong> Verify CIR number on bottle before paying.</div>
                                <div>• <strong>Toxicity Triangle:</strong> 🟢 Green (Slight), 🔵 Blue (Moderate), 🟡 Yellow (High), 🔴 Red (Extremely toxic).</div>
                                <div>• <strong>Standard Mix:</strong> 20–30ml liquid or 8–30g powder per 16L spray pump.</div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Interactive Farmer Action Card for APMC Mandi Market Rates */}
                        {(() => {
                          const isMarketAdvice = /mandi|modal price|quintal|\/qtl|ధర|ధరలు|రేటు|మార్కెట్|మండి|మండీ|భావ|apmc/i.test(msg.content);
                          if (!isMarketAdvice) return null;
                          return (
                            <div className="mt-3.5 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-700/50 flex flex-wrap items-center justify-between gap-2.5 shadow-xs w-full">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                  📈
                                </span>
                                <div>
                                  <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wide block">
                                    APMC Mandi Intelligence
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 block">
                                    Live APMC Market Rates & Charts
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate('/market')}
                                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>View Market Prices (మార్కెట్ ధరలు)</span>
                              </button>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* ChatGPT Style Message Action Toolbar under Assistant response (Picture 2) */}
                  {!isUser && (
                    <div className="flex items-center gap-1 mt-2.5 text-slate-400">
                      {/* Voice Readout Button with Feature 7 Speed and Equalizer */}
                      <button 
                        onClick={() => speak(msg.content, msg.id, i18n.language || 'en', audioSpeed)}
                        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold ${
                          speakingId === msg.id 
                            ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' 
                            : 'hover:bg-slate-100 dark:hover:bg-[#212121] hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                        title={speakingId === msg.id ? "Stop voice readout" : "Listen to answer"}
                      >
                        {speakingId === msg.id ? <VolumeX className="w-4 h-4 text-emerald-400" /> : <Volume2 className="w-4 h-4" />}
                        <span className="text-[10px] hidden sm:inline">{speakingId === msg.id ? 'Stop' : 'Listen'}</span>
                        {/* Feature 7: WhatsApp Style Sound Waveform */}
                        {speakingId === msg.id && (
                          <span className="flex items-center gap-0.5 ml-1 h-3">
                            <span className="w-0.5 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0s]" />
                            <span className="w-0.5 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                            <span className="w-0.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                          </span>
                        )}
                      </button>

                      {/* Speed Controller Badge */}
                      <button
                        type="button"
                        onClick={() => setAudioSpeed(s => s === 1.0 ? 1.25 : s === 1.25 ? 0.75 : 1.0)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-black border border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-300 hover:text-emerald-500 hover:border-emerald-500 transition-colors"
                        title="Voice speed"
                      >
                        {audioSpeed}x
                      </button>

                      <button 
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#212121] hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      
                      <button 
                        onClick={() => setFeedbackMap(prev => ({ ...prev, [msg.id]: prev[msg.id] === 'up' ? null : 'up' }))}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#212121] transition-colors ${feedbackMap[msg.id] === 'up' ? 'text-emerald-500' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}
                        title="Good response"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => setFeedbackMap(prev => ({ ...prev, [msg.id]: prev[msg.id] === 'down' ? null : 'down' }))}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#212121] transition-colors ${feedbackMap[msg.id] === 'down' ? 'text-rose-500' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}
                        title="Bad response"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => toggleSpeech(msg.content, msg.id)}
                        className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#212121] transition-colors ${speakingId === msg.id ? 'text-emerald-500 animate-pulse' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}
                        title="Read aloud"
                      >
                        {speakingId === msg.id ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      <button 
                        onClick={() => handleShare(msg.content)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#212121] hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        title="Share advice"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <span className="hidden sm:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-[#1a1a1a]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Sources & AI Validation</span>
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-1.5 text-slate-400 pt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]" />
            </div>
          )}

          <div ref={chatBottomRef} className="h-8 shrink-0" />
        </div>

        {/* Floating Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToBottom}
              className="absolute bottom-20 right-4 sm:right-6 p-2 rounded-full bg-slate-800 text-white shadow-xl hover:bg-slate-700 z-20"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── CHATGPT STYLE PILL SEARCH BAR (Pictures 2 & 3) ── */}
        <div className="px-3.5 sm:px-6 pt-1 pb-1 lg:pb-2.5 bg-white dark:bg-[#0d0d0d] shrink-0 z-20 max-w-3xl w-full mx-auto">
          
          {/* Hidden File & Camera Inputs for In-Chat Leaf Diagnosis */}
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelected} className="hidden" />
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoSelected} className="hidden" />

          {/* Quick Plus Attachments Modal */}
          <AnimatePresence>
            {quickMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-28 lg:bottom-24 left-3 sm:left-6 z-30 p-2 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2e2e2e] shadow-2xl space-y-1 w-64"
              >
                <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  AI Multimodal Camera
                </div>
                <button
                  onClick={() => { setInspectionMode('leaf'); cameraInputRef.current?.click(); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 transition-colors"
                >
                  <Camera className="w-4 h-4 text-emerald-500" />
                  <span>🌿 Scan Crop Leaf (Disease)</span>
                </button>
                <button
                  onClick={() => { setInspectionMode('pest'); cameraInputRef.current?.click(); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 transition-colors"
                >
                  <Bug className="w-4 h-4 text-amber-500" />
                  <span>🐛 Scan Pest / Insect / Borer</span>
                </button>
                <button
                  onClick={() => { setInspectionMode('bottle'); cameraInputRef.current?.click(); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 transition-colors"
                >
                  <FlaskConical className="w-4 h-4 text-purple-500" />
                  <span>🧪 Scan Bottle / Fertilizer Bag</span>
                </button>
                <button
                  onClick={() => { fileInputRef.current?.click(); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-teal-500" />
                  <span>🖼️ Choose from Gallery</span>
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1">
                  <div className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Kisan Quick Actions
                  </div>
                  <button
                    onClick={() => { handleSendMessage("Where is the nearest Rythu Bharosa Kendram (RBK) and agrochemical store in Andhra Pradesh?"); setQuickMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span>🏛️ Find Nearest RBK & Stores</span>
                  </button>
                  <button
                    onClick={() => { handleSendMessage("Check today's farm spraying weather window and 4-hour rain safety forecast"); setQuickMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                  >
                    <Sun className="w-4 h-4 text-sky-500" />
                    <span>🌧️ Spraying Weather Window</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── KISAN QUICK QUESTION CHIPS (1-TAP ACTION SHORTCUTS) ── */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-1 scrollbar-none no-scrollbar">
            {kisanQuickChips.map((chip, idx) => {
              const activeLang = (i18n.language || 'en').split('-')[0];
              const label = chip.label[activeLang] || chip.label.en;
              const IconComp = chip.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(chip.query)}
                  className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#1a1a1a] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-[#2b2b2b] hover:border-emerald-400/50 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all shadow-2xs active:scale-95 whitespace-nowrap"
                >
                  <IconComp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Voice Listening Banner */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg backdrop-blur-md"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                  </span>
                  <div className="flex items-center gap-0.5 px-0.5">
                    <span className="w-1 h-2.5 bg-rose-500 rounded-full animate-bounce [animation-delay:0s]" />
                    <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-2 bg-rose-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                    <span className="w-1 h-3.5 bg-rose-500 rounded-full animate-bounce [animation-delay:0.45s]" />
                  </div>
                  <span className="truncate text-[11px]">
                    {(() => {
                      const langKey = (i18n.language || 'en').split('-')[0];
                      const names = { te: 'తెలుగు', hi: 'हिन्दी', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', mr: 'मराठी', en: 'English' };
                      return `Listening in ${names[langKey] || 'voice'}... Speak now`;
                    })()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className="px-2 py-0.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 shadow-xs"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attached Leaf Photo Preview Thumbnail */}
          <AnimatePresence>
            {attachedPhoto && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                className="mb-2 p-2 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2b2b2b] shadow-md space-y-2"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={attachedPhoto.preview} alt="Attached Target" className="w-11 h-11 rounded-xl object-cover border border-emerald-500/50 shadow-2xs shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {attachedPhoto.file?.name || 'Farm Photo'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          inspectionMode === 'pest' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300' :
                          inspectionMode === 'bottle' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300' :
                          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                        }`}>
                          {inspectionMode === 'pest' ? '🐛 Pest / Insect' : inspectionMode === 'bottle' ? '🧪 Chemical / Label' : '🌿 Crop Leaf'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">
                        ⚡ Multimodal AI Vision Ready ({Math.round((attachedPhoto.file?.size || 0) / 1024)} KB)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedPhoto(null)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors"
                    title="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Switch Scan Mode Quick Pills */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider text-[9px] shrink-0">Scan Mode:</span>
                  <button
                    type="button"
                    onClick={() => setInspectionMode('leaf')}
                    className={`px-2 py-0.5 rounded-lg transition-all ${inspectionMode === 'leaf' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-[#252525] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                  >
                    🌿 Crop Leaf
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionMode('pest')}
                    className={`px-2 py-0.5 rounded-lg transition-all ${inspectionMode === 'pest' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-[#252525] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                  >
                    🐛 Pest / Insect
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionMode('bottle')}
                    className={`px-2 py-0.5 rounded-lg transition-all ${inspectionMode === 'bottle' ? 'bg-purple-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-[#252525] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                  >
                    🧪 Bottle / Bag
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ChatGPT Pill Input Box - Compact & Sleek */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100 dark:bg-[#212121] border border-slate-200/80 dark:border-[#2a2a2a] shadow-inner focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all min-h-[38px]">
            
            {/* Plus Button on Left */}
            <button
              type="button"
              onClick={() => setQuickMenuOpen(o => !o)}
              className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2e2e2e] transition-colors shrink-0"
              title="Add attachment / Quick tools"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Direct Camera Shutter Button */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-1.5 rounded-full text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-[#2e2e2e] transition-colors shrink-0"
              title="Snap photo with camera"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            {/* Input Textarea */}
            <textarea
              rows={1}
              value={inputQuery}
              onChange={e => {
                setInputQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={attachedPhoto ? "Add message or send..." : `Ask ${activeRoleConfig.title}...`}
              className="flex-1 resize-none bg-transparent px-1.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none leading-normal max-h-[80px] overflow-y-auto"
            />

            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-1.5 rounded-full transition-colors shrink-0 ${
                isListening 
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2e2e2e]'
              }`}
              title="Voice input (Speak in Telugu, Hindi, English)"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>

            {/* Send / Waveform Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={(!inputQuery.trim() && !attachedPhoto) || isTyping}
              className={`p-1.5 rounded-full transition-all shadow-sm shrink-0 ${
                (inputQuery.trim() || attachedPhoto)
                  ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8] scale-100 shadow-md shadow-blue-500/30 active:scale-90'
                  : 'bg-slate-300 dark:bg-[#333333] text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50'
              }`}
              title="Send message"
            >
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <p className="text-center text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 mb-0 leading-none">
            AgriShield AI can make mistakes. Verify advice with local experts.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
