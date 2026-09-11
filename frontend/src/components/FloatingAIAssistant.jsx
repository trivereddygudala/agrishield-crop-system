import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  Maximize2, 
  Send, 
  Mic, 
  MicOff, 
  Bot, 
  Loader2, 
  TrendingUp,
  Droplets,
  Building2,
  Clock,
  Menu,
  Plus,
  RefreshCw,
  Volume2,
  VolumeX,
  Camera,
  Paperclip,
  Share2,
  PhoneCall,
  Leaf,
  CloudRain,
  Globe,
  MapPin,
  Compass,
  FileText,
  Bug,
  FlaskConical,
  Sun,
  Wind,
  Thermometer,
  Calculator,
  Navigation
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
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

    // Left accent block (| Callout)
    if (trimmed.startsWith('| ') && !trimmed.endsWith('|')) {
      nodes.push(
        <div key={i} className="my-2 pl-3 py-1 border-l-2 border-emerald-400 font-semibold text-slate-100 text-xs tracking-wide">
          <InlineText text={trimmed.slice(2)} />
        </div>
      );
      i++; continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      nodes.push(<h4 key={i} className="text-xs font-bold text-slate-100 mt-2.5 mb-1"><InlineText text={trimmed.slice(5)} /></h4>);
      i++; continue;
    }
    if (trimmed.startsWith('### ')) {
      nodes.push(<h3 key={i} className="text-sm font-bold text-emerald-300 mt-2.5 mb-1.5"><InlineText text={trimmed.slice(4)} /></h3>);
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={i} className="text-sm font-bold text-emerald-400 mt-3 mb-1.5"><InlineText text={trimmed.slice(3)} /></h2>);
      i++; continue;
    }
    if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={i} className="text-base font-black text-emerald-300 mt-2 mb-1.5"><InlineText text={trimmed.slice(2)} /></h1>);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-=]{3,}$/.test(trimmed)) {
      nodes.push(<hr key={i} className="my-2 border-slate-700" />);
      i++; continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      nodes.push(
        <div key={i} className="my-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 text-slate-200">
          <pre className="p-2.5 text-[11px] font-mono overflow-x-auto leading-relaxed">
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
        <div key={i} className="my-2 overflow-x-auto rounded-lg border border-slate-700 shadow-sm">
          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-800">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-2 py-1.5 font-bold text-slate-200 border-b border-slate-700 whitespace-nowrap">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-slate-900' : 'bg-slate-850'}>
                  {parseCells(row).map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 text-slate-300 border-b border-slate-800">
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

    // Bullet list
    if (/^[-*]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-1.5 space-y-1 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
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
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      nodes.push(
        <ol key={i} className="my-1.5 space-y-1 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
              <span className="text-[11px] font-bold text-emerald-400 mt-0.5 shrink-0">{ii + 1}.</span>
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Normal paragraph
    nodes.push(
      <p key={i} className="my-1 text-xs leading-relaxed text-slate-200">
        <InlineText text={trimmed} />
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

const QUICK_PROMPTS = [
  { label: '🌾 Paddy Rate', prompt: 'What is the paddy price today?', icon: TrendingUp },
  { label: '💧 Soil Moisture', prompt: 'What is my current soil moisture reading?', icon: Droplets },
  { label: '🏛️ Govt Schemes', prompt: 'What are the government schemes for farmers?', icon: Building2 },
  { label: '⏱️ Time Now', prompt: 'What is the time now?', icon: Clock }
];

export default function FloatingAIAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('agrishield_floating_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((m, idx) => {
            let msgId = typeof m.id === 'number' ? m.id : parseFloat(m.id);
            if (isNaN(msgId) || !msgId) msgId = Date.now() + idx;
            return {
              id: msgId,
              role: m.role || 'assistant',
              content: m.content || '',
              timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load floating chat history:", e);
    }
    return [
      {
        id: 1,
        role: 'assistant',
        content: `### 🌾 Hello ${user?.name ? user.name.split(' ')[0] : 'Farmer'}!\nI am your **AgriShield AI Assistant**. How can I help your farm today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => {
    return localStorage.getItem('agrishield_floating_session_id') || null;
  });

  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem('agrishield_kisan_autospeak') === 'true';
    } catch {
      return false;
    }
  });
  const [attachedPhoto, setAttachedPhoto] = useState(null);
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [dosageAcreage, setDosageAcreage] = useState({});
  const [inspectionMode, setInspectionMode] = useState('leaf'); // 'leaf' | 'pest' | 'bottle'
  const [locationLoading, setLocationLoading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

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
      console.warn("Compression failed, using original:", err);
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
    const text = `🌾 *AgriShield Kisan Prescription*:\n\n${clean}...\n\n(Prescribed via AgriShield AI Agronomist)`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadPrescription = (msgId, content) => {
    const acres = dosageAcreage[msgId] || 1;
    const detectedCrop = /tomato|paddy|rice|cotton|chilli|groundnut|maize|wheat|potato|onion|grape|banana/i.exec(content)?.[0] || 'Field Crop';
    const detectedDisease = /early blight|late blight|leaf spot|blast|powdery mildew|downy mildew|wilt|armyworm|stem borer|bollworm|aphid|whitefly|thrips/i.exec(content)?.[0] || 'Crop Pathology Condition';
    
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

  // Sync activeSessionId to localStorage
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('agrishield_floating_session_id', activeSessionId);
    } else {
      localStorage.removeItem('agrishield_floating_session_id');
    }
  }, [activeSessionId]);

  // Sync messages to localStorage
  useEffect(() => {
    try {
      if (messages.length > 1 || (messages.length === 1 && messages[0].id !== 1)) {
        localStorage.setItem('agrishield_floating_messages', JSON.stringify(messages));
      } else {
        localStorage.removeItem('agrishield_floating_messages');
      }
    } catch (e) {
      console.warn("Failed to save floating chat history:", e);
    }
  }, [messages]);

  const [isSyncing, setIsSyncing] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/api/ai/chat/sessions');
      if (res.data) {
        setSessions(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions in floating window:", err);
    }
  };

  const handleRefreshSession = async () => {
    setIsSyncing(true);
    if (showSessionList) {
      await fetchSessions();
      setIsSyncing(false);
      return;
    }

    if (!activeSessionId) {
      setIsSyncing(false);
      return;
    }
    
    try {
      const res = await api.get('/api/ai/chat/sessions');
      if (res.data) {
        const found = res.data.find(s => s.id === activeSessionId);
        if (found && found.messages) {
          const sanitized = found.messages.map((m, idx) => {
            let msgId = typeof m.id === 'number' ? m.id : parseFloat(m.id);
            if (isNaN(msgId) || !msgId) msgId = Date.now() + idx;
            return {
              id: msgId,
              role: m.role || 'assistant',
              content: m.content || '',
              timestamp: m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
          });
          setMessages(sanitized);
        }
      }
    } catch (err) {
      console.error("Failed to refresh active session in floating window:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (showSessionList) {
      fetchSessions();
    }
  }, [showSessionList]);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Hide widget on full assistant page and auth pages
  const cleanPath = location.pathname.replace(/\/+$/, '');
  const isHidden = cleanPath === '/assistant' || cleanPath === '/login' || cleanPath === '/register';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        const bcpMap = { te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ur: 'ur-IN', or: 'or-IN', as: 'as-IN', en: 'en-IN' };
        const activeLangKey = (i18n.language || 'en').split('-')[0];
        recognition.lang = bcpMap[activeLangKey] || 'en-IN';

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputValue(transcript);
            handleSend(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [i18n.language]);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser. Please use Google Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      const bcpMap = { te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', pa: 'pa-IN', ur: 'ur-IN', or: 'or-IN', as: 'as-IN', en: 'en-IN' };
      const activeLangKey = (i18n.language || 'en').split('-')[0];
      recognitionRef.current.lang = bcpMap[activeLangKey] || 'en-IN';
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Recognition start:", err);
      }
    }
  };

  const handleSend = async (textToSend) => {
    const raw = (textToSend || inputValue).trim();
    const photoToUpload = attachedPhoto;
    if (!raw && !photoToUpload) return;
    if (loading) return;

    setAttachedPhoto(null);
    let text = raw;
    if (!text && photoToUpload) {
      if (inspectionMode === 'pest') {
        text = "Please identify this farm insect/pest/caterpillar from the photo and advise integrated pest management (IPM pheromone lures, sticky traps, neem oil) and targeted chemical sprays.";
      } else if (inspectionMode === 'bottle') {
        text = "Please inspect this agrochemical pesticide bottle / fertilizer bag label. Check active ingredients, CIB&RC registration safety, toxicity triangle color, and 16L knapsack sprayer dilution.";
      } else {
        text = "Please diagnose this attached crop leaf photo and advise exact remedies and 16L pump spray dosage.";
      }
    }

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      image: photoToUpload ? photoToUpload.preview : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessagesWithUser = [...messages, userMsg];
    setMessages(updatedMessagesWithUser);
    setInputValue('');
    setLoading(true);

    try {
      // Build history payload
      const history = messages
        .filter((m) => m.id !== 1)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post('/api/ai/chat', {
        message: text,
        history: history,
        language: i18n.language || 'en',
        image_base64: photoToUpload ? photoToUpload.base64 : null,
        context: {
          current_route: location.pathname,
          language: i18n.language || 'en',
          inspection_mode: inspectionMode
        }
      });

      const reply = res.data?.reply || res.data?.response || "I couldn't process that response. Please try again.";
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessagesWithUser, assistantMsg];
      setMessages(finalMessages);

      // Auto-Voice Readout (Kisan Audio Mode with audioSpeed)
      if (autoSpeak && reply) {
        speak(reply, assistantMsg.id, i18n.language || 'en', audioSpeed);
      }

      // Real-time synchronization to MongoDB backend
      let currentId = activeSessionId;
      const title = text.slice(0, 30);
      
      const sanitizedMessages = finalMessages.map((m, idx) => {
        let msgId = typeof m.id === 'number' ? m.id : parseFloat(m.id);
        if (isNaN(msgId) || !msgId) msgId = Date.now() + idx;
        return {
          id: msgId,
          role: m.role || 'assistant',
          content: m.content || ''
        };
      });

      if (!currentId) {
        currentId = 'chat_' + Date.now();
        setActiveSessionId(currentId);
        
        const newSession = {
          id: currentId,
          title: title,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
          messages: sanitizedMessages
        };
        await api.post('/api/ai/chat/sessions', newSession).catch(console.warn);
      } else {
        await api.put(`/api/ai/chat/sessions/${currentId}`, {
          title: title,
          messages: sanitizedMessages
        }).catch(console.warn);
      }

    } catch (err) {
      console.error('Floating AI assistant error:', err);
      const fallbackMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: "### 🌾 AgriShield Advisory\nPlease ask about Mandi prices, Soil telemetry, or Government schemes.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExpandChat = async () => {
    if (messages.length <= 1) {
      navigate('/assistant');
      return;
    }

    try {
      let targetSessionId = activeSessionId;
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || "Floating Consultation";
      const title = firstUserMsg.slice(0, 30);
      
      // Ensure all message IDs are strictly floats/numbers for database schema compliance
      const sanitizedMessages = messages.map((m, idx) => {
        let msgId = typeof m.id === 'number' ? m.id : parseFloat(m.id);
        if (isNaN(msgId) || !msgId) msgId = Date.now() + idx;
        return {
          id: msgId,
          role: m.role || 'assistant',
          content: m.content || ''
        };
      });

      if (!targetSessionId) {
        // Create new session
        targetSessionId = 'chat_' + Date.now();
        const newSession = {
          id: targetSessionId,
          title: title,
          createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
          messages: sanitizedMessages
        };
        await api.post('/api/ai/chat/sessions', newSession);
        setActiveSessionId(targetSessionId);
      } else {
        // Update existing session
        await api.put(`/api/ai/chat/sessions/${targetSessionId}`, {
          title: title,
          messages: sanitizedMessages
        });
      }
      
      // Keep the chat in the floating window, just close it and navigate
      setIsOpen(false);
      navigate(`/assistant?session_id=${targetSessionId}`);
    } catch (err) {
      console.error("Failed to migrate floating session to full screen:", err);
      navigate('/assistant');
    }
  };

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  if (isHidden) return null;

  return (
    <div 
      className="fixed z-50 bottom-[85px] right-3.5 sm:bottom-6 sm:right-6"
      style={{ zIndex: 9999 }}
    >
      <AnimatePresence>
        {isOpen ? (
          /* ── Floating Chat Window ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[94vw] sm:w-[420px] h-[520px] max-h-[80vh] rounded-2xl border border-emerald-500/25 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 ring-1 ring-emerald-500/20 origin-bottom-right"
          >
            {/* Header */}
            <div className="p-3.5 px-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-white">{isAdmin ? 'AgriShield Copilot' : 'AgriShield AI'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-slate-400 block leading-tight">{isAdmin ? 'System Administrator Intelligence' : 'Farm Agronomist'}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Auto-Speak Toggle */}
                <button
                  onClick={() => {
                    setAutoSpeak(prev => {
                      const next = !prev;
                      localStorage.setItem('agrishield_kisan_autospeak', String(next));
                      if (!next && speakingId) stopSpeech();
                      return next;
                    });
                  }}
                  className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                    autoSpeak
                      ? 'bg-emerald-600 text-white shadow-xs animate-pulse'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={autoSpeak ? "Auto-speak is ON (Answers read aloud)" : "Enable Kisan Voice (Read answers aloud)"}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>

                {/* Audio Playback Speed Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setAudioSpeed(prev => (prev === 1.0 ? 0.75 : prev === 0.75 ? 1.25 : 1.0));
                  }}
                  className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-emerald-400 border border-slate-700 transition-colors"
                  title="Change voice speech rate (0.75x, 1.0x, 1.25x)"
                >
                  {audioSpeed}x
                </button>

                {(showSessionList || activeSessionId) && (
                  <button
                    onClick={handleRefreshSession}
                    disabled={isSyncing}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
                    title="Sync with database"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                )}
                <button
                  onClick={() => setShowSessionList(prev => !prev)}
                  className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${showSessionList ? 'bg-slate-800 text-white' : ''}`}
                  title="Past Consultations"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <button
                  onClick={handleExpandChat}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Expand to Full Page"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showSessionList ? (
              /* Session List View Overlay */
              <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto overscroll-contain touch-pan-y scrollbar-thin scrollbar-thumb-slate-800">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Past Consultations</span>
                  <button
                    onClick={() => {
                      setMessages([
                        {
                          id: 1,
                          role: 'assistant',
                          content: isAdmin 
                            ? `### 🛡️ Hello Administrator ${user?.name ? user.name.split(' ')[0] : ''}!\nI am your **AgriShield System Copilot**. I can assist with server health, broadcast dispatch, audit logs, and farmer analytics.`
                            : `### 🌾 Hello ${user?.name ? user.name.split(' ')[0] : 'Farmer'}!\nI am your **AgriShield AI Assistant**. How can I help your farm today?`,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      ]);
                      setActiveSessionId(null);
                      setShowSessionList(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black transition-colors shadow-md shadow-emerald-600/20"
                  >
                    <Plus className="w-3 h-3" /> New Chat
                  </button>
                </div>
                
                {sessions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-center space-y-2">
                    <Bot className="w-8 h-8 opacity-40 animate-pulse" />
                    <p className="text-[11px] font-semibold">No consultations found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60 p-2 space-y-1">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setMessages(s.messages || []);
                          setActiveSessionId(s.id);
                          setShowSessionList(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 border ${activeSessionId === s.id ? 'bg-emerald-950/20 border-emerald-500/30' : 'hover:bg-slate-800/80 border-transparent hover:border-slate-800'}`}
                      >
                        <span className={`text-xs font-bold line-clamp-1 ${activeSessionId === s.id ? 'text-emerald-400' : 'text-slate-200'}`}>{s.title || "Consultation"}</span>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 w-full">
                          <span>{s.messages?.length || 0} messages</span>
                          <span>{s.createdAt || "Recent"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Messages Body */
              <div className="flex-1 min-h-0 p-3.5 overflow-y-auto overscroll-contain touch-pan-y space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
                {messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  const prevUserMsg = idx > 0 ? messages[idx - 1] : null;
                  const prevUserText = (prevUserMsg?.content || '').toLowerCase();
                  const isUserWeatherQuery = /weather|forecast|rain|spray today|safe to spray|వాతావరణం|వర్షం|పిచికారీ చేయడం సురక్షితమేనా|స్ప్రే చేయవచ్చా|పిచికారీ సురక్షితమేనా|సురక్షితమేనా/i.test(prevUserText);
                  const isUserMarketQuery = /mandi|price|rate|cost|bhav|ధర|ధరలు|రేటు|మార్కెట్|మండి/i.test(prevUserText);
                  const isUserTreatmentQuery = /dosage|dose|how much|treatment|medicine|cure|spray pump|వాడాలి|మోతాదు|ఎంత కలపాలి|ఏ మందు|పురుగు మందు|నివారణ|చికిత్స/i.test(prevUserText);

                  const hasExplicitPrescription = /per 16L|16L pump|16 లీటర్ల పంపు|గ్రాములు.*16.*లీటర్ల|ml.*per.*16L|g.*per.*16L/i.test(m.content);
                  const isAgronomyAdvice = !isUser && !isUserWeatherQuery && !isUserMarketQuery && (isUserTreatmentQuery || hasExplicitPrescription);

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      {/* Attached Photo Thumbnail */}
                      {isUser && m.image && (
                        <div className="mb-1.5 rounded-xl overflow-hidden border border-emerald-500/40 shadow-sm max-w-[200px]">
                          <img src={m.image} alt="Crop Leaf" className="w-full h-28 object-cover" />
                        </div>
                      )}

                      <div
                        className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-br-xs shadow-md shadow-emerald-600/20'
                            : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-bl-xs shadow-md'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        ) : (
                          <>
                            <MarkdownMessage text={m.content} />
                            
                            {/* 1. Feature 4 & 5: Knapsack Spray Calibration + Acreage Calculator + Prescription Slip */}
                            {isAgronomyAdvice && (() => {
                              const currentAcres = dosageAcreage[m.id] || 1.0;
                              const pumpsNeeded = Math.round(currentAcres * 10);
                              const chemMl = Math.round(currentAcres * 250);
                              const approxCost = Math.round(currentAcres * 320);

                              return (
                                <div className="mt-2.5 p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-1.5 text-slate-100">
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                                      🚜 16L Pump Mix ({currentAcres} Ac)
                                    </span>
                                    {/* Acreage Selector */}
                                    <div className="flex items-center gap-1 bg-slate-900 px-1 py-0.5 rounded-lg border border-emerald-500/30 text-[9px] font-bold">
                                      {[0.5, 1.0, 2.0, 5.0].map((ac) => (
                                        <button
                                          key={ac}
                                          type="button"
                                          onClick={() => setDosageAcreage(prev => ({ ...prev, [m.id]: ac }))}
                                          className={`px-1.5 py-0.5 rounded transition-all ${currentAcres === ac ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                          {ac}A
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="px-2 py-1 rounded-lg bg-emerald-900/40 text-[10px] text-emerald-200 flex items-center justify-between font-semibold">
                                    <span>🚜 <strong>{pumpsNeeded} pumps</strong> (16L)</span>
                                    <span>🧪 <strong>~{chemMl} ml/g</strong></span>
                                    <span>💰 <strong>~₹{approxCost}</strong></span>
                                  </div>

                                  <div className="flex items-center justify-end gap-1.5 pt-0.5 text-[10px]">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadPrescription(m.id, m.content)}
                                      className="px-2 py-0.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                                      title="Doctor-Style Prescription Slip for Dealer"
                                    >
                                      <FileText className="w-2.5 h-2.5" /> Prescription
                                    </button>
                                    <button
                                      onClick={() => handleWhatsAppShare(m.content)}
                                      className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                                      title="Share with pesticide shop on WhatsApp"
                                    >
                                      <Share2 className="w-2.5 h-2.5" /> WhatsApp
                                    </button>
                                    <a
                                      href="tel:18001801551"
                                      className="px-2 py-0.5 rounded-md bg-cyan-700 hover:bg-cyan-800 text-white font-bold flex items-center gap-1"
                                      title="Call Kisan Call Center (1800-180-1551)"
                                    >
                                      <PhoneCall className="w-2.5 h-2.5" /> 1800
                                    </a>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 2. Feature 1: Google Maps Near-Me Hub Card */}
                            {(() => {
                              const isRbkOrStore = /rbk|rythu bharosa|sachivalayam|agro store|fertilizer shop|fertilizer store|pesticide store|pesticide shop|pacs|markfed|mao|ada|jda|రైతు భరోసా|ఎరువుల దుకాణం|పురుగు మందుల దుకాణం|వ్యవసాయ అధికారి/i.test(m.content);
                              if (!isRbkOrStore) return null;
                              return (
                                <div className="mt-2 p-2 rounded-xl bg-teal-950/60 border border-teal-500/40 space-y-1.5 text-slate-100">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-teal-300 font-extrabold flex items-center gap-1">
                                      📍 Andhra Pradesh Agriculture Hubs
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenGpsMaps('Rythu Bharosa Kendram near me')}
                                      disabled={locationLoading}
                                      className="px-1.5 py-0.5 rounded bg-teal-700 hover:bg-teal-600 text-white text-[9px] font-bold flex items-center gap-0.5 disabled:opacity-50"
                                    >
                                      <Compass className={`w-2.5 h-2.5 ${locationLoading ? 'animate-spin' : ''}`} />
                                      <span>GPS</span>
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1 text-[10px] font-semibold">
                                    <a
                                      href="https://www.google.com/maps/search/Rythu+Bharosa+Kendram+near+me"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-teal-900 border border-teal-500/30 text-teal-200 flex items-center gap-1"
                                    >
                                      <Building2 className="w-2.5 h-2.5" /> Nearest RBK
                                    </a>
                                    <a
                                      href="https://www.google.com/maps/search/Agro+chemical+pesticide+fertilizer+store+near+me"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-teal-900 border border-teal-500/30 text-teal-200 flex items-center gap-1"
                                    >
                                      🏪 Agro Stores
                                    </a>
                                    <a
                                      href="https://www.google.com/maps/search/Mandal+Agriculture+Office+near+me"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-teal-900 border border-teal-500/30 text-teal-200 flex items-center gap-1"
                                    >
                                      <MapPin className="w-2.5 h-2.5" /> MAO Office
                                    </a>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 3. Feature 3: Dynamic Spraying Safety Window */}
                            {(() => {
                              const isWeatherAdvice = isUserWeatherQuery || /weather|forecast|rain|spray window|safe to spray|foliar spray weather|వాతావరణం|వర్షం|స్ప్రే సమయం|పిచికారీ చేయడం సురక్షితమేనా/i.test(m.content);
                              if (!isWeatherAdvice) return null;

                              const isUnsafe = /సురక్షితం కాదు|చేయకూడదు|ఆపండి|వద్దు|వాయిదా|not safe|unsafe|do not spray|avoid spraying|వర్షం పడే|వర్ష సూచన|వర్ష సెన్సార్\s*=\s*1/i.test(m.content);

                              return (
                                <div className={`mt-2 p-2 rounded-xl border space-y-1 text-[10px] ${
                                  isUnsafe ? 'bg-rose-950/60 border-rose-500/40 text-rose-200' : 'bg-sky-950/60 border-sky-500/40 text-sky-200'
                                }`}>
                                  <div className="flex items-center justify-between font-extrabold">
                                    <span className="flex items-center gap-1">
                                      {isUnsafe ? '🌧️ పిచికారీ హెచ్చరిక' : '🌤️ Spraying Safety Window'}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-white text-[9px] font-bold ${
                                      isUnsafe ? 'bg-rose-600' : 'bg-emerald-600'
                                    }`}>
                                      {isUnsafe ? '⚠️ DO NOT SPRAY' : '✓ SAFE TO SPRAY'}
                                    </span>
                                  </div>
                                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-[9px] font-semibold">
                                    {isUnsafe ? (
                                      <span className="text-rose-300">⚠️ వర్షం / తేమ సూచన ఉంది. మందు కొట్టుకుపోయే ప్రమాదం ఉన్నందున స్ప్రే వాయిదా వేయండి.</span>
                                    ) : (
                                      <span className="text-sky-300">✓ వాతావరణం అనుకూలంగా ఉంది. ఉదయం 6-9 AM లేదా సాయంత్రం 4:30-6:30 PM స్ప్రే చేయండి.</span>
                                    )}
                                  </div>
                                  <div className="text-[9px] flex items-center gap-1 font-semibold pt-0.5">
                                    <Wind className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                    <span><strong>4-Hour Dry Rule:</strong> కనీసం 4 గంటలు వర్షం పడకుండా ఉండాలి. గాలి &lt; 12 km/h.</span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 4. Feature 6: Crop Pest & Insect Management Card */}
                            {(() => {
                              const isPestAdvice = /pest|caterpillar|armyworm|stem borer|bollworm|aphid|whitefly|thrips|mite|borer|పురుగు|కీటకాలు|లద్దె/i.test(m.content) && !/fungicide|mancozeb|carbendazim|early blight|late blight|leaf spot/i.test(m.content);
                              if (!isPestAdvice) return null;
                              return (
                                <div className="mt-2 p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 space-y-1 text-[10px]">
                                  <div className="flex items-center gap-1 font-extrabold text-amber-300">
                                    <span>🐛</span>
                                    <span>Integrated Pest Management (IPM)</span>
                                  </div>
                                  <div className="p-1.5 rounded bg-slate-900 border border-amber-500/30 text-[9px] text-slate-200 space-y-0.5 font-semibold">
                                    <div>• <strong>Pheromone Traps:</strong> 5 traps/acre for armyworm / borer moths.</div>
                                    <div>• <strong>Sticky Sheets:</strong> 10 yellow/blue cards per acre for aphids & thrips.</div>
                                    <div>• <strong>Bio-Spray:</strong> Neem Oil 10,000 PPM @ 50ml per 16L spray pump.</div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 5. Feature 2: Agrochemical Bottle & Label Verification */}
                            {(() => {
                              const isBottleAdvice = /bottle|chemical label|pesticide label|active ingredient|cib&rc|toxicity triangle|సీసా|ప్యాకెట్|బాటిల్|లేబుల్/i.test(m.content);
                              if (!isBottleAdvice) return null;
                              return (
                                <div className="mt-2 p-2 rounded-xl bg-purple-950/60 border border-purple-500/40 space-y-1 text-[10px]">
                                  <div className="flex items-center gap-1 font-extrabold text-purple-300">
                                    <span>🧪</span>
                                    <span>Agrochemical Bottle Label Verification</span>
                                  </div>
                                  <div className="p-1.5 rounded bg-slate-900 border border-purple-500/30 text-[9px] text-slate-200 space-y-0.5 font-semibold">
                                    <div>• <strong>CIB&RC:</strong> Verify CIR registration number on bottle.</div>
                                    <div>• <strong>Toxicity:</strong> 🟢 Green (Slight), 🔵 Blue (Mod), 🟡 Yellow (High), 🔴 Red (Toxic).</div>
                                    <div>• <strong>Standard Mix:</strong> 20–30ml liquid or 8–30g powder per 16L pump.</div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Interactive APMC Mandi Action Card */}
                            {!isUser && /mandi|modal price|quintal|\/qtl|ధర|ధరలు|రేటు|మార్కెట్|మండి|మండీ|భావ|apmc/i.test(m.content) && (
                              <div className="mt-2 p-2 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                                  <span>📈</span>
                                  <span>Live APMC Mandi Rates</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setIsOpen(false); navigate('/market'); }}
                                  className="px-2 py-0.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1 text-[10px]"
                                >
                                  <TrendingUp className="w-2.5 h-2.5" /> View /market
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[9px] text-slate-500">{m.timestamp}</span>
                        {!isUser && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => speak(m.content, m.id, i18n.language || 'en', audioSpeed)}
                              className={`text-[9px] flex items-center gap-0.5 transition-colors ${speakingId === m.id ? 'text-emerald-400 font-bold animate-pulse' : 'text-slate-400 hover:text-slate-200'}`}
                              title="Listen to advice"
                            >
                              {speakingId === m.id ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                              <span>{speakingId === m.id ? 'Stop' : 'Listen'}</span>
                            </button>

                            {/* Feature 7: Voice Speed Indicator & WhatsApp Waveform */}
                            <button
                              type="button"
                              onClick={() => setAudioSpeed(prev => (prev === 1.0 ? 0.75 : prev === 0.75 ? 1.25 : 1.0))}
                              className="px-1 py-0.2 rounded bg-slate-800 text-[8px] font-bold text-slate-400 hover:text-emerald-300"
                              title="Speed rate"
                            >
                              {audioSpeed}x
                            </button>

                            {speakingId === m.id && (
                              <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0s]" />
                                <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-3 bg-slate-800/50 rounded-xl w-fit border border-slate-700/50">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Analyzing your request...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Quick Suggestion Chips */}
            <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { label: '🏛️ Nearest RBK', query: 'Where is the nearest Rythu Bharosa Kendram (RBK) and agrochemical store in Andhra Pradesh?' },
                { label: '🌧️ Spray Window', query: "Check today's farm spraying weather window and 4-hour rain safety forecast" },
                { label: '🐛 Pest Alert', query: 'How do I identify and trap stem borer, armyworm, or sucking pest insects using IPM?' },
                { label: '🌾 Scan Advice', query: 'Explain treatments and 16L spray pump dosage for my latest crop scan.' },
                { label: '🧪 16L Pump Mix', query: 'How many grams of medicine should I mix in a 16-litre spray pump for my crop?' },
                { label: '💰 Mandi Rates', query: 'What are today wholesale Mandi market prices for major crops in my district?' },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip.query)}
                  className="flex-none px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-700 text-[10px] font-semibold transition-all whitespace-nowrap"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Attached Photo Preview with Multimodal Mode Switcher */}
            {attachedPhoto && (
              <div className="px-3 py-2 bg-slate-900 border-t border-emerald-500/40 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={attachedPhoto.preview} alt="Target" className="w-9 h-9 rounded-lg object-cover border border-emerald-500/40 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-200 font-bold truncate">Photo ready</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          inspectionMode === 'pest' ? 'bg-amber-900/80 text-amber-300' :
                          inspectionMode === 'bottle' ? 'bg-purple-900/80 text-purple-300' :
                          'bg-emerald-900/80 text-emerald-300'
                        }`}>
                          {inspectionMode === 'pest' ? '🐛 Pest' : inspectionMode === 'bottle' ? '🧪 Bottle' : '🌿 Leaf'}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400">⚡ Multimodal AI Vision</span>
                    </div>
                  </div>
                  <button onClick={() => setAttachedPhoto(null)} className="text-slate-400 hover:text-rose-400 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Scan Mode Quick Selector */}
                <div className="flex items-center gap-1 text-[9px] font-bold">
                  <span className="text-slate-500 uppercase tracking-wider text-[8px]">Mode:</span>
                  <button
                    type="button"
                    onClick={() => setInspectionMode('leaf')}
                    className={`px-1.5 py-0.5 rounded transition-all ${inspectionMode === 'leaf' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    🌿 Crop Leaf
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionMode('pest')}
                    className={`px-1.5 py-0.5 rounded transition-all ${inspectionMode === 'pest' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    🐛 Pest
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionMode('bottle')}
                    className={`px-1.5 py-0.5 rounded transition-all ${inspectionMode === 'bottle' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    🧪 Bottle / Bag
                  </button>
                </div>
              </div>
            )}

            {/* Footer Input */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelected} className="hidden" />
              <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoSelected} className="hidden" />

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 focus-within:border-emerald-500/50 rounded-xl px-2.5 py-1.5 transition-all">
                
                {/* Camera Shutter */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Snap leaf photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>

                {/* Photo Gallery Picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Attach leaf photo"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>

                {/* Voice Mic Button */}
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`p-1 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                      : 'text-slate-400 hover:text-emerald-400'
                  }`}
                  title={isListening ? 'Stop Listening' : 'Voice Input (Telugu, Hindi, English)'}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? 'Listening...' : attachedPhoto ? 'Press send to diagnose...' : 'Ask AgriShield AI...'}
                  className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none min-w-0"
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={(!inputValue.trim() && !attachedPhoto) || loading}
                  className={`p-1.5 rounded-lg transition-all ${
                    (inputValue.trim() || attachedPhoto) && !loading
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 hover:scale-105'
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                  title="Send"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Floating Action Button (FAB) ── */
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center justify-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-xl shadow-emerald-600/30 hover:shadow-emerald-500/40 border border-emerald-400/40 transition-all duration-300"
            title="Ask AgriShield AI Assistant"
          >
            {/* Glowing Ring Effect */}
            <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 opacity-40 blur group-hover:opacity-75 transition duration-500 animate-pulse" />
            
            <div className="relative flex items-center gap-1.5">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
              <span className="font-bold text-xs tracking-wide">Ask AI</span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
