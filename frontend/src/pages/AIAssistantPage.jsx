import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Bot, User, Plus, MessageSquare, Trash2, Menu, Copy, Check, Sparkles, X,
  Search, Pin, Share2, ThumbsUp, ThumbsDown, Volume2, VolumeX, Mic, MicOff,
  ArrowUp, ChevronDown, MoreVertical, Image as ImageIcon, BookOpen, Cpu, 
  ExternalLink, Edit3, Globe, Layers, CheckCircle2, ShieldCheck, Leaf, RefreshCw
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useSpeechReader } from '../hooks/useSpeechReader';

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

  const chatContainerRef = useRef(null);
  const chatBottomRef = useRef(null);
  const recognitionRef = useRef(null);

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
    if (!queryText || !queryText.trim() || isTyping) return;

    const currentMessages = sessions.find(s => s.id === activeSessionId)?.messages || [];
    const userMessage = { id: Date.now(), role: 'user', content: queryText };
    const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
    
    // Auto name the session after the first real user query
    const newTitle = (currentSession.messages.length <= 1) ? queryText.slice(0, 30) : currentSession.title;
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
        message: queryText,
        history: historyPayload,
        user_id: user?.id || 'demo_user',
        role: userRole,
        language: i18n.language || 'en',
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

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.response || res.data.reply || res.data.answer || "I have processed your system request."
      };
      const finalMsgs = [...updatedMsgsWithUser, assistantMessage];
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalMsgs } : s));
      
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

          <div className="flex items-center gap-1">
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
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-8 py-4 space-y-6 max-w-3xl w-full mx-auto"
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
                  
                  {/* Message Content Container */}
                  <div className={
                    isUser
                      ? 'px-4 py-2.5 rounded-3xl bg-[#2f2f2f] text-white text-sm leading-relaxed shadow-sm'
                      : 'w-full text-slate-900 dark:text-[#ececec] text-sm leading-relaxed'
                  }>
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <MarkdownMessage text={msg.content} />
                    )}
                  </div>

                  {/* ChatGPT Style Message Action Toolbar under Assistant response (Picture 2) */}
                  {!isUser && (
                    <div className="flex items-center gap-1 mt-2.5 text-slate-400">
                      {/* Voice Readout Button */}
                      <button 
                        onClick={() => speak(msg.content, msg.id, i18n.language || 'en')}
                        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold ${
                          speakingId === msg.id 
                            ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' 
                            : 'hover:bg-slate-100 dark:hover:bg-[#212121] hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                        title={speakingId === msg.id ? "Stop voice readout" : "Listen to answer"}
                      >
                        {speakingId === msg.id ? <VolumeX className="w-4 h-4 text-emerald-400" /> : <Volume2 className="w-4 h-4" />}
                        <span className="text-[10px] hidden sm:inline">{speakingId === msg.id ? 'Stop' : 'Listen'}</span>
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
              className="absolute bottom-44 lg:bottom-20 right-6 p-2 rounded-full bg-slate-800 text-white shadow-xl hover:bg-slate-700 z-20"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── CHATGPT STYLE PILL SEARCH BAR (Pictures 2 & 3) ── */}
        <div className="px-3 sm:px-6 pb-20 lg:pb-3 pt-1 bg-white dark:bg-[#0d0d0d] shrink-0 z-20 max-w-3xl w-full mx-auto">
          
          {/* Quick Plus Attachments Modal */}
          <AnimatePresence>
            {quickMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-40 lg:bottom-20 left-4 sm:left-6 z-30 p-2 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2e2e2e] shadow-2xl space-y-1 w-56"
              >
                <button
                  onClick={() => { navigate('/scan'); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  <span>Scan Crop Photo</span>
                </button>
                <button
                  onClick={() => { handleSendMessage("Check current soil moisture & telemetry"); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                >
                  <Cpu className="w-4 h-4 text-blue-500" />
                  <span>Inspect IoT Telemetry</span>
                </button>
                <button
                  onClick={() => { handleSendMessage("What are today's market rates for crops?"); setQuickMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors"
                >
                  <Globe className="w-4 h-4 text-amber-500" />
                  <span>Search Mandi Prices</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Voice Listening Banner */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-2.5 px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg backdrop-blur-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                  <span className="truncate">
                    {(() => {
                      const langKey = (i18n.language || 'en').split('-')[0];
                      const names = { te: 'తెలుగు (Telugu)', hi: 'हिन्दी (Hindi)', ta: 'தமிழ் (Tamil)', kn: 'ಕನ್ನಡ (Kannada)', ml: 'മലയാളം (Malayalam)', mr: 'मराठी (Marathi)', en: 'English' };
                      return `Listening in ${names[langKey] || 'your language'}... Speak your question`;
                    })()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 shadow-xs"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ChatGPT Pill Input Box */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-slate-100 dark:bg-[#212121] border border-slate-200/80 dark:border-[#2a2a2a] shadow-inner focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
            
            {/* Plus Button on Left */}
            <button
              type="button"
              onClick={() => setQuickMenuOpen(o => !o)}
              className="p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2e2e2e] transition-colors"
              title="Add attachment / Quick tools"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Input Textarea */}
            <textarea
              rows={1}
              value={inputQuery}
              onChange={e => {
                setInputQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Ask ${activeRoleConfig.title}...`}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none leading-relaxed max-h-[100px] overflow-y-auto"
            />

            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-full transition-colors ${
                isListening 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#2e2e2e]'
              }`}
              title="Voice input"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send / Waveform Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isTyping}
              className={`p-2 rounded-full transition-all shadow-sm ${
                inputQuery.trim()
                  ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8] scale-100'
                  : 'bg-slate-300 dark:bg-[#333333] text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50'
              }`}
              title="Send message"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-1 mb-0.5">
            AgriShield AI may make mistakes. Verify important farming advice with local experts.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
