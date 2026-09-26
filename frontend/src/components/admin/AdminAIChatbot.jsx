/**
 * AdminAIChatbot — Private Admin Intelligence Chatbot (M2)
 * ─────────────────────────────────────────────────────────
 * Session-only floating chatbot wired to the AgriShield AI backend.
 * Tailored for admin-exclusive queries: user analytics, broadcast
 * advisory, IoT fleet summaries, and support escalation intelligence.
 * All chat history is session-scoped and cleared on page reload.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Loader,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import API from '../../services/api';

/* ── Quick-prompt suggestions shown on empty chat ── */
const QUICK_PROMPTS = [
  { icon: '📊', label: 'Summarize platform health', prompt: 'Give me a quick executive summary of AgriShield platform health — active users, IoT fleet status, and any critical support tickets.' },
  { icon: '📢', label: 'Draft a crop alert broadcast', prompt: 'Help me draft a professional, urgent broadcast alert about a Yellow Leaf Curl Virus outbreak detected in coastal districts. Make it clear and action-oriented for farmers.' },
  { icon: '🚜', label: 'Provider advisory message', prompt: 'Write an advisory broadcast for equipment providers about rising harvester demand in the Krishna district for the upcoming paddy season.' },
  { icon: '🔒', label: 'Security incident report', prompt: 'Generate a brief security incident report template for an IP brute-force attempt detected on the admin login endpoint.' },
  { icon: '🌾', label: 'Farmer onboarding tips', prompt: 'What are the top 5 tips I should broadcast to newly registered farmers to help them get the most from AgriShield?' },
  { icon: '📉', label: 'Low IoT adoption advice', prompt: 'Our IoT node activation rate is low. Suggest actionable steps I can take as an admin to increase farmer adoption of the ESP32 soil sensors.' },
];

/* ── System prompt injected as first message context ── */
const SYSTEM_PROMPT = `You are AgriShield Admin Intelligence — a private AI assistant exclusively for the AgriShield platform administrator. 
You specialize in:
• Agricultural crop disease analytics and broadcast messaging
• IoT hardware fleet (ESP32 nodes) management and diagnostics
• Farmer & equipment provider user management advice
• Support ticket escalation intelligence
• Security monitoring and audit log interpretation
• Platform growth strategy

Respond in a professional, concise manner. For broadcast drafts, output ready-to-use text. 
Always be factual and precise. Never fabricate user data. 
If asked about specific real-time data you don't have, say so clearly.`;

/* ── Individual chat message bubble ── */
function ChatBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isAdmin = msg.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-xs mt-0.5 ${
        isAdmin
          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
          : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white'
      }`}>
        {isAdmin ? 'A' : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div className={`relative max-w-[82%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
          isAdmin
            ? 'bg-emerald-600 text-white rounded-tr-sm'
            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
        }`}>
          {msg.content}
        </div>

        {/* Timestamp + copy */}
        <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-[9px] text-slate-400 font-medium">{msg.time}</span>
          {!isAdmin && (
            <button
              onClick={handleCopy}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Copy response"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Typing indicator ── */
function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-end">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello, Administrator! I'm your private AgriShield Intelligence assistant. I can help you draft broadcasts, analyze platform health, generate support escalation summaries, or advise on IoT fleet management.\n\nHow can I assist you today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id: 'welcome'
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
    if (!isOpen && messages.length > 1) {
      setHasUnread(true);
    }
  }, [messages, isOpen, scrollToBottom]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || isStreaming) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', content, time: now, id: `u-${Date.now()}` };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      // Build conversation history for context continuity
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      conversationHistory.push({ role: 'user', parts: [{ text: content }] });

      // Call the AgriShield AI crop-advisor endpoint (admin-context augmented)
      const res = await API.post('/api/crop-advisor', {
        message: content,
        system_context: SYSTEM_PROMPT,
        conversation_history: conversationHistory,
        mode: 'admin_intelligence'
      });

      const reply = res.data?.response || res.data?.message || res.data?.answer || 'I encountered an issue processing your request. Please try again.';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: `a-${Date.now()}`
      }]);
    } catch (err) {
      // Graceful fallback response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I'm unable to reach the AI backend right now (${err.response?.status || 'network error'}). Please check your connection or try again in a moment.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: `err-${Date.now()}`
      }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, isStreaming]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([{
      role: 'assistant',
      content: "Session cleared. I'm ready for a fresh conversation. How can I help you?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id: `reset-${Date.now()}`
    }]);
  };

  const showQuickPrompts = messages.length <= 1;

  return (
    <>
      {/* ── FLOATING TRIGGER BUTTON ── */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setHasUnread(false); }}
          className="fixed bottom-6 right-6 z-50 group w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 text-white shadow-2xl shadow-violet-600/40 hover:shadow-violet-600/60 transition-all duration-300 hover:scale-110 flex items-center justify-center cursor-pointer"
          aria-label="Open Admin AI Chatbot"
          title="Admin AI Intelligence"
        >
          <div className="relative">
            <Bot className="w-6 h-6" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            )}
          </div>
          {/* Glowing ring */}
          <span className="absolute inset-0 rounded-2xl ring-2 ring-violet-400/30 group-hover:ring-violet-400/60 transition-all" />
        </button>
      )}

      {/* ── CHATBOT PANEL ── */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col shadow-2xl shadow-slate-900/30 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 transition-all duration-300 ${
            isExpanded
              ? 'bottom-4 right-4 w-[min(92vw,680px)] h-[min(90vh,720px)]'
              : 'bottom-6 right-6 w-[min(92vw,400px)] h-[520px]'
          }`}
          style={{ background: 'var(--bg-surface, #fff)' }}
        >
          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-700 via-indigo-700 to-violet-700 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-sm font-extrabold leading-tight">Admin Intelligence</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-violet-200 font-semibold">Private · Session Only · Secure</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearHistory}
                className="p-1.5 rounded-lg hover:bg-white/15 text-violet-200 hover:text-white transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(e => !e)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-violet-200 hover:text-white transition-colors cursor-pointer"
                title={isExpanded ? 'Compact view' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 text-violet-200 hover:text-white transition-colors cursor-pointer"
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── SECURITY BADGE ── */}
          <div className="flex items-center justify-center gap-1.5 py-1.5 bg-violet-50 dark:bg-violet-950/40 border-b border-violet-100 dark:border-violet-900/50 shrink-0">
            <ShieldCheck className="w-3 h-3 text-violet-500" />
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
              Admin-only · Not logged · Cleared on session end
            </span>
          </div>

          {/* ── MESSAGES ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 dark:bg-[#0f1318]">
            {messages.map(msg => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}

            {isStreaming && <TypingIndicator />}

            {/* Quick Prompts */}
            {showQuickPrompts && !isStreaming && (
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Quick Actions</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp.prompt}
                      onClick={() => sendMessage(qp.prompt)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all hover:shadow-sm cursor-pointer flex items-center gap-2"
                    >
                      <span className="text-sm">{qp.icon}</span>
                      <span>{qp.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── INPUT BAR ── */}
          <div className="px-3 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-400/20 transition-all px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about analytics, broadcast, IoT, support..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 resize-none outline-none max-h-28 leading-relaxed py-0.5 disabled:opacity-60"
                style={{ minHeight: '20px' }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs shadow-violet-600/30"
              >
                {isStreaming
                  ? <Loader className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </button>
            </div>
            <p className="text-[9px] text-slate-400 text-center mt-1.5 font-medium">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
