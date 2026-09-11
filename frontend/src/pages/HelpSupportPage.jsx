import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy,
  Phone,
  PhoneCall,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sprout,
  HelpCircle,
  FileText,
  X,
  ExternalLink,
  ChevronLeft,
  Headphones,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  MapPin,
  Bot
} from 'lucide-react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function HelpSupportPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active view tab: 'contact' | 'my-tickets' | 'faqs'
  const [activeSection, setActiveSection] = useState('contact');

  // Callback Modal State
  const [isCallbackOpen, setIsCallbackOpen] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState(user?.phone || '');
  const [callbackLang, setCallbackLang] = useState(isTe ? 'te' : 'en');
  const [callbackIssue, setCallbackIssue] = useState('');
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);
  const [callbackSuccess, setCallbackSuccess] = useState('');

  // Ticket Form State
  const [ticketCategory, setTicketCategory] = useState('hardware_iot');
  const [ticketPriority, setTicketPriority] = useState('medium');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketDeviceId, setTicketDeviceId] = useState('');
  const [ticketPhone, setTicketPhone] = useState(user?.phone || '');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState('');
  const [ticketError, setTicketError] = useState('');

  // My Tickets State
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Support Dynamic Config from Admin
  const [supportConfig, setSupportConfig] = useState({
    whatsapp_number: '+91 98765 43210',
    support_phone: '1800-180-1551',
    support_hours: '24x7 Emergency Assistance'
  });

  useEffect(() => {
    const fetchSupportConfig = async () => {
      try {
        const res = await API.get('/api/support/config');
        if (res.data && res.data.whatsapp_number) {
          setSupportConfig(res.data);
        }
      } catch (e) {
        console.warn('Could not fetch support config:', e);
      }
    };
    fetchSupportConfig();
  }, []);

  // Auto-fetch tickets when tab changes
  useEffect(() => {
    if (activeSection === 'my-tickets') {
      fetchMyTickets();
    }
  }, [activeSection]);

  const fetchMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await API.get('/api/support/tickets/my');
      setMyTickets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // 1-Tap WhatsApp Support Generator
  const handleWhatsAppSupport = () => {
    const farmerName = user?.name || user?.full_name || 'Farmer';
    const farmerPhone = user?.phone || 'Not provided';
    const location = user?.farm_location || user?.location || 'Field';

    const text = isTe
      ? `🌾 *అగ్రిషీల్డ్ రైతు మద్దతు హెల్ప్‌డెస్క్ సంప్రదింపు*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *రైతు పేరు:* ${farmerName}\n` +
        `📞 *ఫోన్ నంబర్:* ${farmerPhone}\n` +
        `📍 *ప్రాంతం:* ${location}\n` +
        `📅 *తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
        `💬 *నా సమస్య వివరాలు:*\n` +
        `నమస్కారం అగ్రిషీల్డ్ సపోర్ట్ టీమ్, నాకు వ్యవసాయం/సెన్సార్/యాప్ విషయంలో మీ సాంకేతిక సహాయం కావాలి.`
      : `🌾 *AgriShield Farmer Support Consultation Request*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Farmer Name:* ${farmerName}\n` +
        `📞 *Phone:* ${farmerPhone}\n` +
        `📍 *Location:* ${location}\n` +
        `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
        `💬 *Problem Summary:*\n` +
        `Hello AgriShield Support Team, I need technical/agronomic support regarding my farm setup.`;

    // AgriShield Official Support WhatsApp Desk (Dynamic Admin configured)
    const rawNumber = supportConfig.whatsapp_number || '';
    const cleanDigits = rawNumber.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const waUrl = phoneWithCode
      ? `https://api.whatsapp.com/send?phone=${phoneWithCode}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  // Submit 15-Minute Callback Request
  const handleCallbackSubmit = async (e) => {
    e.preventDefault();
    if (!callbackPhone.trim()) {
      alert(isTe ? 'దయచేసి సరైన ఫోన్ నంబర్ నమోదు చేయండి.' : 'Please enter a valid phone number.');
      return;
    }

    setCallbackSubmitting(true);
    setCallbackSuccess('');
    try {
      const res = await API.post('/api/support/callback-request', {
        phone: callbackPhone.trim(),
        farmer_name: user?.name || 'Farmer',
        language: callbackLang,
        issue_summary: callbackIssue.trim() || 'Urgent 15-minute farmer callback request',
        preferred_time: 'Within 15 minutes'
      });

      setCallbackSuccess(res.data?.message || (isTe ? 'కాల్‌బ్యాక్ అభ్యర్థన విజయవంతంగా నమోదయింది!' : 'Callback requested! Our officer will call you in 15 minutes.'));
      setCallbackIssue('');
      setTimeout(() => {
        setIsCallbackOpen(false);
        setCallbackSuccess('');
      }, 3500);
    } catch (err) {
      alert(err.response?.data?.detail || (isTe ? 'అభ్యర్థన నమోదు విఫలమైంది.' : 'Failed to register callback request.'));
    } finally {
      setCallbackSubmitting(false);
    }
  };

  // Submit In-App Technical Ticket
  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDesc.trim()) {
      setTicketError(isTe ? 'దయచేసి సమస్య శీర్షిక మరియు వివరాలు నమోదు చేయండి.' : 'Please provide a subject and detailed description.');
      return;
    }

    setTicketSubmitting(true);
    setTicketSuccess('');
    setTicketError('');

    try {
      const res = await API.post('/api/support/tickets', {
        category: ticketCategory,
        priority: ticketPriority,
        subject: ticketSubject.trim(),
        description: ticketDesc.trim(),
        device_id: ticketDeviceId.trim() || null,
        phone: ticketPhone.trim() || null,
        language: isTe ? 'te' : 'en'
      });

      setTicketSuccess(res.data?.message || (isTe ? 'సమస్య టికెట్ నమోదయింది! మా బృందం త్వరలో సంప్రదిస్తుంది.' : 'Ticket submitted successfully!'));
      setTicketSubject('');
      setTicketDesc('');
      setTicketDeviceId('');
      // Refresh tickets if on list
      fetchMyTickets();
    } catch (err) {
      setTicketError(err.response?.data?.detail || (isTe ? 'టికెట్ సమర్పణ విఫలమైంది.' : 'Failed to submit support ticket.'));
    } finally {
      setTicketSubmitting(false);
    }
  };

  const FAQS = [
    {
      q: isTe ? 'నా ESP32 ఫీల్డ్ సెన్సార్ ఆఫ్‌లైన్‌లో ఎందుకు చూపిస్తోంది?' : 'Why does my ESP32 field sensor show offline?',
      a: isTe
        ? '1) సెన్సార్ బ్యాటరీ లేదా సోలార్ పవర్ సరిగ్గా ఉందో లేదో చూడండి. 2) నోడ్ వై-ఫై లేదా సిమ్ కనెక్టివిటీ రేంజ్ లో ఉందో ధృవీకరించండి. 3) పరికరంపై ఉన్న చిన్న రీసెట్ (RST) బటన్‌ను 3 సెకన్లు నొక్కి పట్టుకోండి.'
        : '1) Verify that the solar panel / 18650 battery has sufficient charge. 2) Ensure the ESP32 node is within 2.4GHz Wi-Fi or hotspot range. 3) Press the RST button on the node for 3 seconds to reboot.'
    },
    {
      q: isTe ? 'భూమి విస్తీర్ణ కొలతలలో 1 మీటర్ ఖచ్చితత్వం ఎలా పొందాలి?' : 'How do I achieve 1-meter pinpoint GPS field measuring accuracy?',
      a: isTe
        ? 'పొలం సరిహద్దు వెంట నడిచేటప్పుడు ఫోన్‌ను చేతిలో పైకి పట్టుకోండి. చెట్ల కింద కాకుండా బహిరంగ ఆకాశం కింద GPS సిగ్నల్ "±1.8m" లేదా పచ్చటి సూచిక కనిపించిన తర్వాత మాత్రమే వాక్ మోడ్ ప్రారంభించండి.'
        : 'Hold your phone upright with an unobstructed view of the open sky. Wait for the GPS accuracy indicator on the screen to turn green (±1.8m) before beginning your perimeter walk.'
    },
    {
      q: isTe ? 'రోగ నిర్ధారణ స్కాన్ ఫలితంపై నాకు సందేహం ఉంటే ఏమి చేయాలి?' : 'What if I suspect an incorrect disease diagnosis on my scan?',
      a: isTe
        ? 'క్రింద ఉన్న "టికెట్ సమర్పించు" ఫారమ్‌లో "పంట వ్యాధి సమీక్ష" వర్గాన్ని ఎంచుకోండి. మా సీనియర్ వ్యవసాయ శాస్త్రవేత్తలు మీ పంట ఆకు ఫోటోను నేరుగా పరిశీలించి 24 గంటల్లో నిపుణుల సలహా అందిస్తారు.'
        : 'Select "Crop Disease Diagnosis & Scan Review" in the ticket form below. An AgriShield agronomist will manually inspect your leaf scan and provide a certified second opinion.'
    },
    {
      q: isTe ? 'కాల్‌బ్యాక్ అభ్యర్థన చేసిన తర్వాత అధికారులు ఎప్పుడు కాల్ చేస్తారు?' : 'How soon will a support officer call me after a callback request?',
      a: isTe
        ? 'సాధారణ పని వేళల్లో (ఉదయం 8:00 నుండి రాత్రి 8:00 వరకు) మా వ్యవసాయ లేదా సాంకేతిక నిపుణుడు 15 నిమిషాల్లోపు మీ ఫోన్‌కు నేరుగా కాల్ చేస్తారు.'
        : 'During operational hours (8:00 AM – 8:00 PM IST), an agricultural or technical specialist will call your phone directly within 15 minutes.'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
      {/* ═══════ 1. TOP NAVIGATION & HEADER ═══════ */}
      <div className="space-y-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/more')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4 stroke-[3]" />
            <span>{isTe ? '← ఇతర సేవలు (More)' : '← Back to More'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20">
              <Headphones className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isTe ? 'అగ్రిషీల్డ్ రైతు మద్దతు బృందం' : 'AgriShield Help & Support Team'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  24x7 Helpdesk
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isTe
                  ? 'హార్డ్‌వేర్, వ్యాధి నిర్ధారణ, వాతావరణం లేదా యాప్ సమస్యలపై సాంకేతిక & వ్యవసాయ నిపుణుల సహాయం'
                  : 'Direct technical, hardware, disease diagnosis & agronomic support for farmers'}
              </p>
            </div>
          </div>

          {/* Quick AI Assistant Shortcut */}
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
          >
            <Bot className="w-4 h-4" />
            <span>{isTe ? 'ఏఐ నిపుణుడిని అడగండి' : 'Ask AI Agronomist'}</span>
          </button>
        </div>
      </div>

      {/* ═══════ 2. EMERGENCY TOLL-FREE HELPLINES BANNER ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* National Kisan Call Centre */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-md flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-emerald-100">
              {isTe ? 'జాతీయ ఉచిత హెల్ప్‌లైన్' : 'National Toll-Free 24x7'}
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
              1800-180-1551
            </h3>
            <p className="text-xs text-emerald-100 font-medium">
              {isTe ? 'కిసాన్ కాల్ సెంటర్ (భారత ప్రభుత్వం)' : 'Kisan Call Centre (Govt. of India)'}
            </p>
          </div>
          <a
            href="tel:18001801551"
            className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-white/90 font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 shrink-0 transition-all"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>{isTe ? 'కాల్ చేయండి' : 'Call Free'}</span>
          </a>
        </div>

        {/* State RBK Agricultural Helpline */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-md border border-slate-700 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              {isTe ? 'ఆంధ్రప్రదేశ్ & తెలంగాణ' : 'AP & Telangana RBK'}
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1 text-emerald-400">
              1907
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              {isTe ? 'రైతు భరోసా కేంద్రం (ప్రత్యక్ష సహాయం)' : 'Rythu Bharosa Kendram Extension Line'}
            </p>
          </div>
          <a
            href="tel:1907"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 shrink-0 transition-all"
          >
            <PhoneCall className="w-4 h-4" />
            <span>{isTe ? '1907 కు కాల్' : 'Dial 1907'}</span>
          </a>
        </div>
      </div>

      {/* ═══════ 3. TAB SELECTOR: CONTACT CHANNELS | MY TICKETS | FAQS ═══════ */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveSection('contact')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'contact'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {isTe ? 'మద్దతు మార్గాలు (Contact)' : 'Contact Support'}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('my-tickets')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'my-tickets'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {isTe ? 'నా ఫిర్యాదులు (My Tickets)' : 'My Support Tickets'}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('faqs')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSection === 'faqs'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {isTe ? 'తరచుగా అడిగే ప్రశ్నలు (FAQ)' : 'Instant Help & FAQ'}
        </button>
      </div>

      {/* ═══════ SECTION A: CONTACT CHANNELS ═══════ */}
      {activeSection === 'contact' && (
        <div className="space-y-6">
          {/* Fast Support Cards (WhatsApp & 15-Min Callback) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. WhatsApp Instant Support Desk */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isTe ? 'వాట్సాప్ ఇన్‌స్టంట్ హెల్ప్‌డెస్క్' : 'WhatsApp Instant Helpdesk'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isTe
                    ? 'మీ సమస్య వివరాలతో ఆటో-ఫిల్ అయిన వాట్సాప్ మెసేజ్ ద్వారా మా సపోర్ట్ ఆఫీసర్‌తో నేరుగా చాట్ చేయండి.'
                    : 'Chat directly with an AgriShield agronomist on WhatsApp with pre-filled farm diagnostics.'}
                </p>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                  <span>📱 WA: {supportConfig.whatsapp_number}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWhatsAppSupport}
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isTe ? 'వాట్సాప్‌లో చాట్ చేయండి' : 'Chat on WhatsApp Now'}</span>
              </button>
            </div>

            {/* 2. Request a 15-Minute Phone Callback */}
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-600 flex items-center justify-center">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isTe ? '15 నిమిషాల్లో కాల్‌బ్యాక్ అభ్యర్థించండి' : 'Request a 15-Minute Callback'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isTe
                    ? 'టైప్ చేయడం కంటే మాట్లాడటం ఇష్టపడే రైతులకు. మా అధికారి 15 నిమిషాల్లో మీ ఫోన్‌కు నేరుగా కాల్ చేస్తారు.'
                    : 'Preferred by field farmers. An agricultural technician will call your phone within 15 minutes.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCallbackOpen(true)}
                className="w-full py-3 px-4 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isTe ? 'నాకు కాల్ చేయండి' : 'Request Callback'}</span>
              </button>
            </div>
          </div>

          {/* In-App Support Ticket Submission Form */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <FileText className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {isTe ? 'సాంకేతిక సమస్య లేదా సలహా టికెట్ నమోదు' : 'Submit a Technical or Agronomy Ticket'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isTe ? 'హార్డ్‌వేర్, సెన్సార్, పంట లేదా యాప్ సమస్యలపై వివరణాత్మక టికెట్ సమర్పించండి' : 'Report hardware faults, crop scan reviews, or account issues'}
                </p>
              </div>
            </div>

            {ticketSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{ticketSuccess}</span>
              </div>
            )}

            {ticketError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ticketError}</span>
              </div>
            )}

            <form onSubmit={handleTicketSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {isTe ? 'సమస్య వర్గం (Category):' : 'Issue Category:'}
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="hardware_iot">{isTe ? '🛰️ స్మార్ట్ ఐఓటీ నోడ్ / ESP32 సెన్సార్' : '🛰️ Smart IoT Node / ESP32 Hardware'}</option>
                    <option value="crop_disease">{isTe ? '🩺 పంట వ్యాధి స్కాన్ పునఃపరిశీలన' : '🩺 Crop Disease Scan Review'}</option>
                    <option value="weather_maps">{isTe ? '🗺️ పొలం విస్తీర్ణ కాలిక్యులేటర్ & మ్యాప్స్' : '🗺️ Field Area Calculator & Maps'}</option>
                    <option value="billing_account">{isTe ? '👤 ఖాతా, భాష & యాప్ సెట్టింగ్స్' : '👤 Account, Language & App Setup'}</option>
                    <option value="general">{isTe ? '🌾 సాధారణ వ్యవసాయ సలహా' : '🌾 General Agronomy Question'}</option>
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {isTe ? 'ప్రాధాన్యత (Priority):' : 'Priority Level:'}
                  </label>
                  <select
                    value={ticketPriority}
                    onChange={(e) => setTicketPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="low">{isTe ? '🟢 సాధారణం (Low - 48h)' : '🟢 Low (48h resolution)'}</option>
                    <option value="medium">{isTe ? '🟡 మధ్యస్థం (Medium - 24h)' : '🟡 Medium (24h resolution)'}</option>
                    <option value="high">{isTe ? '🟠 ఎక్కువ (High - 12h)' : '🟠 High (12h priority)'}</option>
                    <option value="urgent">{isTe ? '🔴 అత్యవసరం (Urgent - 4h)' : '🔴 Urgent (Field emergency)'}</option>
                  </select>
                </div>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">
                  {isTe ? 'సమస్య శీర్షిక (Subject):' : 'Subject Summary:'}
                </label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder={isTe ? 'ఉదా: ESP32 నోడ్ తేమ రీడింగ్ సరిగ్గా రావడం లేదు' : 'e.g., Soil moisture sensor fluctuating on ESP32 node'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Detailed Description */}
              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-700 dark:text-slate-300">
                  {isTe ? 'సమస్య పూర్తి వివరణ (Description):' : 'Detailed Description:'}
                </label>
                <textarea
                  rows={4}
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder={isTe ? 'మీ పొలం పరిస్థితి, ఎప్పటి నుండి సమస్య ఉంది, మరియు ఎలాంటి సహాయం కావాలో వివరించండి...' : 'Describe what happened, any error messages, and what assistance you require...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  required
                />
              </div>

              {/* Hardware Device ID (Optional) & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {isTe ? 'హార్డ్‌వేర్ పరికరం ID (ఐచ్ఛికం):' : 'Hardware Node ID (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={ticketDeviceId}
                    onChange={(e) => setTicketDeviceId(e.target.value)}
                    placeholder="e.g., ESP32-NODE-ALPHA"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-slate-700 dark:text-slate-300">
                    {isTe ? 'సంప్రదించాల్సిన ఫోన్ నంబర్:' : 'Contact Phone Number:'}
                  </label>
                  <input
                    type="tel"
                    value={ticketPhone}
                    onChange={(e) => setTicketPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={ticketSubmitting}
                className="px-6 py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{ticketSubmitting ? (isTe ? 'నమోదవుతోంది...' : 'Submitting Ticket...') : (isTe ? 'టికెట్ సమర్పించండి' : 'Submit Support Ticket')}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ SECTION B: MY TICKETS LIST ═══════ */}
      {activeSection === 'my-tickets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isTe ? 'నా ప్రస్తుత ఫిర్యాదులు & అభ్యర్థనలు' : 'My Support Tickets & Callback Status'}</span>
            </h3>
            <button
              type="button"
              onClick={fetchMyTickets}
              disabled={loadingTickets}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className={`w-3 h-3 ${loadingTickets ? 'animate-spin' : ''}`} />
              <span>{isTe ? 'రిఫ్రెష్' : 'Refresh'}</span>
            </button>
          </div>

          {loadingTickets ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {isTe ? 'టికెట్లు లోడ్ అవుతున్నాయి...' : 'Loading support tickets...'}
            </div>
          ) : myTickets.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {isTe ? 'ఎలాంటి పెండింగ్ సమస్యలు లేవు!' : 'No Open Support Tickets'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {isTe
                  ? 'మీకు ఏవైనా ప్రశ్నలు లేదా సమస్యలు ఉంటే పైనున్న "మద్దతు మార్గాలు" ట్యాబ్ ద్వారా కొత్త టికెట్ లేదా కాల్‌బ్యాక్ అభ్యర్థించండి.'
                  : 'You do not have any open support complaints. Submit a ticket or request a callback anytime you need assistance.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        #{tkt.ticket_number}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        tkt.status === 'resolved'
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                          : tkt.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                          : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                      }`}>
                        {tkt.status === 'resolved' ? (isTe ? 'పరిష్కరించబడింది' : 'Resolved') : (tkt.status === 'in_progress' ? (isTe ? 'పరిశీలనలో ఉంది' : 'In Progress') : (isTe ? 'ఓపెన్' : 'Open'))}
                      </span>
                      {tkt.is_callback_request && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-600 border border-sky-500/30">
                          15-Min Call
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(tkt.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {tkt.subject}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {tkt.description}
                    </p>
                  </div>

                  {tkt.device_id && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Device: <code>{tkt.device_id}</code></span>
                    </div>
                  )}

                  {/* Resolution Notes from Support Engineer */}
                  {tkt.resolution_notes && (
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                        {isTe ? 'సపోర్ట్ బృందం పరిష్కార వివరాలు (Support Resolution):' : 'Support Resolution Note:'}
                      </span>
                      <p className="font-medium leading-relaxed">{tkt.resolution_notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ SECTION C: FAQS ACCORDION ═══════ */}
      {activeSection === 'faqs' && (
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isTe ? 'రైతులకు తక్షణ సమాధానాలు & పరిష్కారాలు' : 'Instant Self-Help Solutions & FAQs'}</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? -1 : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-black text-slate-900 dark:text-white cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaqIndex === idx ? (
                    <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaqIndex === idx && (
                  <div className="p-4 pt-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ MODAL: 15-MINUTE PHONE CALLBACK ═══════ */}
      <AnimatePresence>
        {isCallbackOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 text-slate-900 dark:text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/15 text-sky-600">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black">
                      {isTe ? '15 నిమిషాల్లో కాల్‌బ్యాక్ అభ్యర్థించండి' : 'Request a 15-Minute Callback'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isTe ? 'మా వ్యవసాయ అధికారి మీతో నేరుగా మాట్లాడతారు' : 'Speak directly with our agricultural specialist'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCallbackOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {callbackSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p>{callbackSuccess}</p>
                </div>
              ) : (
                <form onSubmit={handleCallbackSubmit} className="space-y-3.5 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">
                      {isTe ? 'మీ ఫోన్ నంబర్:' : 'Your Phone Number:'}
                    </label>
                    <input
                      type="tel"
                      value={callbackPhone}
                      onChange={(e) => setCallbackPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">
                      {isTe ? 'మీరు మాట్లాడాలనుకునే భాష:' : 'Preferred Language for Call:'}
                    </label>
                    <select
                      value={callbackLang}
                      onChange={(e) => setCallbackLang(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="te">తెలుగు (Telugu)</option>
                      <option value="en">English</option>
                      <option value="hi">हिन्दी (Hindi)</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                      <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-extrabold text-slate-700 dark:text-slate-300">
                      {isTe ? 'సమస్య క్లుప్తంగా (ఐచ్ఛికం):' : 'Brief Issue (Optional):'}
                    </label>
                    <input
                      type="text"
                      value={callbackIssue}
                      onChange={(e) => setCallbackIssue(e.target.value)}
                      placeholder={isTe ? 'ఉదా: టమోటా పంట ఆకులపై మచ్చలు, పిచికారీ సలహా' : 'e.g., Tomato leaf blight, spray advice required'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={callbackSubmitting}
                    className="w-full py-3 px-4 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer mt-2"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{callbackSubmitting ? (isTe ? 'నమోదవుతోంది...' : 'Submitting...') : (isTe ? 'కాల్‌బ్యాక్ నిర్ధారించండి' : 'Confirm Callback Request')}</span>
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
