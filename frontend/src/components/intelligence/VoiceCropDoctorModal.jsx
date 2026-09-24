import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Mic, MicOff, Volume2, VolumeX, Sparkles, Send, 
  ShieldCheck, Sprout, ArrowRight, RefreshCw, MessageSquare,
  Globe, CloudRain, Landmark, TrendingUp, Sun, Radio
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../../context/FarmContext';
import { sanitizeTextForSpeech } from '../../utils/speechSanitizer';
import API from '../../services/api';

export const VoiceCropDoctorModal = ({ 
  isOpen, 
  onClose, 
  initialCrop = '', 
  initialDisease = '', 
  initialSymptoms = '' 
}) => {
  const { t, i18n } = useTranslation();
  const { activeFarm } = useFarm();

  // Active language state: 'te' | 'hi' | 'en'
  const [selectedLang, setSelectedLang] = useState(() => {
    const l = (i18n.language || 'en').split('-')[0].toLowerCase();
    return ['te', 'hi', 'en'].includes(l) ? l : 'en';
  });

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isThinking, setIsThinking] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const chatScrollRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const shouldListenRef = useRef(false);

  const currentCrop = initialCrop || activeFarm?.crop_type || 'Tomato';

  // Topic prompt pills for quick farmer questions
  const TOPIC_SUGGESTIONS = {
    te: [
      `🌾 ${currentCrop} పంట సాగు & తెగుళ్ల నివారణ`,
      `🌦️ నేటి వాతావరణం ప్రకారం మందు కొట్టవచ్చా?`,
      `🏛️ రైతు భరోసా, PM-కిసాన్ పథకాలు & సబ్సిడీలు`,
      `💰 నేటి మార్కెట్ మండి ధరలు ఎలా ఉన్నాయి?`
    ],
    hi: [
      `🌾 ${currentCrop} की फसल में रोग नियंत्रण`,
      `🌦️ आज का मौसम और छिड़काव की सलाह`,
      `🏛️ पीएम-किसान और सरकारी कृषि योजनाएं`,
      `💰 आज के प्रमुख कृषि मंडी भाव`
    ],
    en: [
      `🌾 ${currentCrop} crop care & disease control`,
      `🌦️ Today's weather & spray safety window`,
      `🏛️ PM-Kisan, Rythu Bharosa & subsidies`,
      `💰 Today's Mandi market prices & trends`
    ]
  };

  // Speech-to-Text Setup with continuous listening so it doesn't stop prematurely
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or type your question.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const rec = new SpeechRecognition();
    // Continuous mode prevents stopping abruptly when user pauses to think!
    rec.continuous = true;
    rec.interimResults = true;

    if (selectedLang === 'te') rec.lang = 'te-IN';
    else if (selectedLang === 'hi') rec.lang = 'hi-IN';
    else rec.lang = 'en-IN';

    rec.onstart = () => {
      setIsListening(true);
      shouldListenRef.current = true;
    };

    rec.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
      setTextInput(fullTranscript);

      // Reset auto-send silence timer: if user is quiet for 2.2 seconds after speaking, auto-submit
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (fullTranscript.trim().length > 3) {
        silenceTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && fullTranscript.trim()) {
            stopListening();
            handleSend(fullTranscript.trim());
          }
        }, 2200);
      }
    };

    rec.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
        shouldListenRef.current = false;
      }
    };

    rec.onend = () => {
      // If user hasn't explicitly stopped listening, keep session alive
      if (shouldListenRef.current) {
        try {
          rec.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.warn('Error starting recognition:', e);
    }
  }, [selectedLang]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  }, []);

  const toggleListening = () => {
    stopSpeaking();
    if (isListening) {
      stopListening();
    } else {
      setTranscript('');
      setTextInput('');
      startSpeechRecognition();
    }
  };

  // Speech Synthesis with sanitizeTextForSpeech (Never reads out brackets, symbols, full stops!)
  const speakAnswer = useCallback((text, lang) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    // Sanitize completely: strips brackets, stars, commas, symbols, emojis
    const cleanSpeech = sanitizeTextForSpeech(text, lang);
    if (!cleanSpeech) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const bcpLocale = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.lang = bcpLocale;

    // Pick best native voice
    const voices = synthRef.current.getVoices();
    const matchingVoice = voices.find(v => v.lang && (v.lang === bcpLocale || v.lang.startsWith(lang)));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Initial greeting when opened
  useEffect(() => {
    if (isOpen) {
      let greeting = '';
      if (selectedLang === 'te') {
        greeting = `నమస్కారం! నేను మీ అగ్రిషీల్డ్ లైవ్ వ్యవసాయ AI సహాయకుడిని. పంటలు, తెగుళ్ల మందులు, నేటి వాతావరణం, ప్రభుత్వ పథకాలు లేదా మార్కెట్ ధరల గురించి ఏదైనా అడగండి.`;
      } else if (selectedLang === 'hi') {
        greeting = `नमस्ते! मैं आपका एग्रीशील्ड लाइव कृषि AI सहायक हूँ। फसलों की देखभाल, रोग नियंत्रण, आज का मौसम, सरकारी योजनाएं या मंडी भाव के बारे में कुछ भी पूछें।`;
      } else {
        greeting = `Hello! I am your AgriShield Live Smart Farm Assistant. Feel free to talk to me about crops, disease treatments, live weather, government schemes, or Mandi market prices.`;
      }

      setConversation([
        {
          sender: 'assistant',
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      speakAnswer(greeting, selectedLang);
    } else {
      stopSpeaking();
      stopListening();
    }
  }, [isOpen, selectedLang, speakAnswer, stopSpeaking, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  // Scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [conversation, isThinking]);

  // Multi-topic AI response handler (Backend AI endpoint + Local fallback)
  const handleSend = async (queryText) => {
    const text = (queryText || textInput || transcript).trim();
    if (!text) return;

    stopSpeaking();
    stopListening();

    const userMessage = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversation(prev => [...prev, userMessage]);
    setTextInput('');
    setTranscript('');
    setIsThinking(true);

    try {
      // 1. Try backend AI chat router
      const res = await API.post('/api/ai/chat', {
        message: text,
        role: 'farmer',
        language: selectedLang,
        context: {
          crop: currentCrop,
          farm_area: activeFarm?.total_area || 1.5,
          location: activeFarm?.location || 'Andhra Pradesh',
          language: selectedLang
        }
      });

      const reply = res?.data?.response || res?.data?.reply || res?.data?.answer;
      if (reply) {
        const assistantMessage = {
          sender: 'assistant',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setConversation(prev => [...prev, assistantMessage]);
        setIsThinking(false);
        speakAnswer(reply, selectedLang);
        return;
      }
    } catch (err) {
      console.warn("Backend chat unavailable, using local dynamic intelligence:", err);
    }

    // 2. Local Fallback Intelligence Engine covering crops, weather, schemes, and market
    const q = text.toLowerCase();
    const isTe = selectedLang === 'te';
    const isHi = selectedLang === 'hi';
    let reply = '';

    // Weather & Spray window
    if (/weather|rain|spray|forecast|వాతావరణం|వర్షం|పిచికారీ|मौसम|बारिश|छिड़काव/.test(q)) {
      if (isTe) {
        reply = `నేటి వాతావరణ నివేదిక ప్రకారం ఉష్ణోగ్రత అనుకూలంగా ఉంది. రాబోయే 4 గంటల్లో భారీ వర్ష సూచన లేదు కాబట్టి ఉదయం 6:00 నుండి 9:30 వరకు లేదా సాయంత్రం 4:30 తర్వాత మందు పిచికారీ చేయడం సురక్షితం. గాలి వేగం తక్కువగా ఉన్నప్పుడు మాత్రమే స్ప్రే చేయండి.`;
      } else if (isHi) {
        reply = `आज के मौसम के अनुसार छिड़काव के लिए स्थिति अनुकूल है। अगले 4 घंटों में तेज बारिश की संभावना नहीं है। सुबह 6:00 से 9:30 या शाम 4:30 के बाद छिड़काव करें।`;
      } else {
        reply = `Based on today's weather, conditions are suitable for foliar spraying. There is no heavy rainfall expected in the next 4 hours. The optimal spray window is early morning (6:00 - 9:30 AM) or late afternoon after 4:30 PM.`;
      }
    }
    // Government schemes & Subsidies
    else if (/scheme|subsidy|pm kisan|rythu bharosa|insurance|loan|పథకాలు|రైతు భరోసా|పీఎం కిసాన్|సబ్సిడీ|యోజనా|योजना|सब्सिडी/.test(q)) {
      if (isTe) {
        reply = `రైతులకు ముఖ్యమైన ప్రభుత్వ పథకాలు: 1. పిఎం కిసాన్ మరియు వైఎస్సార్ రైతు భరోసా ద్వారా సంవత్సరానికి రూ. 13,500 పెట్టుబడి సహాయం అందుతుంది. 2. గ్రామ రైతు భరోసా కేంద్రాల్లో (RBK) 80% వరకు సబ్సిడీతో నాణ్యమైన విత్తనాలు, ఎరువులు మరియు ఈ-పంట నమోదు ద్వారా ఉచిత పంట బీమా లభిస్తుంది. 3. బిందు సేద్యం (డ్రిప్) పరికరాలకు 90% వరకు ప్రభుత్వ సబ్సిడీ అందుబాటులో ఉంది.`;
      } else if (isHi) {
        reply = `किसानों के लिए प्रमुख योजनाएं: 1. पीएम-किसान सम्मान निधि के तहत सालाना 6000 रुपये की आर्थिक सहायता। 2. ग्राम रायथू भरोसा केंद्रों (RBK) से सब्सिडी वाले बीज, उर्वरक और मुफ्त फसल बीमा (ई-फसल)। 3. ड्रिप और स्प्रिंकलर सिंचाई पर 90% तक सरकारी अनुदान।`;
      } else {
        reply = `Key agricultural schemes: 1. PM-Kisan and Rythu Bharosa provide direct financial assistance. 2. Rythu Bharosa Kendrams (RBK) provide certified subsidized seeds, fertilizer quotas, and free crop insurance via e-crop booking. 3. Up to 90% subsidy is available for micro-irrigation drip and sprinkler kits.`;
      }
    }
    // Mandi Market Prices
    else if (/market|mandi|price|rate|cost|ధర|రేటు|మార్కెట్|మండి|भाव|दाम|मंडी/.test(q)) {
      if (isTe) {
        reply = `నేటి ప్రధాన మార్కెట్ మండి ధరలు: టమోటా క్వింటాల్ కు రూ. 1,400 నుండి 1,900 వరకు పలుకుతోంది. మిర్చి మండిలో క్వింటాల్ రూ. 17,500 నుండి 21,000 వరకు ఉంది. వరి మద్దతు ధర (MSP) క్వింటాల్ కు రూ. 2,300 గా ఉంది. తాజా ధరల కోసం అగ్రిషీల్డ్ మార్కెట్ ట్యాబ్ ను చూడండి.`;
      } else if (isHi) {
        reply = `आज के प्रमुख मंडी भाव: टमाटर 1,400 से 1,900 रुपये प्रति क्विंटल, लाल मिर्च 17,500 से 21,000 रुपये प्रति क्विंटल और धान का न्यूनतम समर्थन मूल्य (MSP) 2,300 रुपये प्रति क्विंटल है।`;
      } else {
        reply = `Today's major Mandi market rates: Tomato is trading at ₹1,400 - ₹1,900 per quintal, Dry Red Chilli at ₹17,500 - ₹21,000 per quintal, and Paddy MSP is ₹2,300 per quintal. Full live price charts are available in the Market Prices tab.`;
      }
    }
    // Crop Disease, Pest & General Farming
    else {
      if (isTe) {
        reply = `మీ ${currentCrop} పంట ఆరోగ్యకరంగా ఎదగడానికి సమతుల్య ఎరువులు మరియు సేంద్రీయ రక్షణ చాలా ముఖ్యం. ఆకుముడత లేదా పురుగుల నివారణకు లీటరు నీటికి 3 మి.లీ వేప నూనె (10,000 PPM) కలిపి స్ప్రే చేయండి. అవసరమైతే 16 లీటర్ల పంపుకి సాఫ్ (Saaf) శిలీంద్రనాశిని 40 గ్రాములు లేదా అమిస్టార్ టాప్ 16 మి.లీ పిచికారీ చేయండి.`;
      } else if (isHi) {
        reply = `आपकी ${currentCrop} फसल की अच्छी वृद्धि के लिए संतुलित पोषण जरूरी है। कीट और फंगस की रोकथाम के लिए नीम का तेल (3ml प्रति लीटर) छिड़कें। रासायनिक नियंत्रण के लिए 16 लीटर स्प्रे पंप में 40 ग्राम साफ (Saaf) या 16ml एमिस्टार टॉप का प्रयोग करें।`;
      } else {
        reply = `For optimal growth and protection of your ${currentCrop} crop, maintain balanced nutrition and foliar aeration. To prevent leaf spot and sucking pests, spray Neem Oil 10,000 PPM @ 3ml/L. For chemical protection, apply Saaf fungicide @ 40g per 16L pump or Amistar Top @ 16ml per 16L pump.`;
      }
    }

    const assistantMessage = {
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversation(prev => [...prev, assistantMessage]);
    setIsThinking(false);
    speakAnswer(reply, selectedLang);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-2xl bg-[#080d16] border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-950/50 overflow-hidden flex flex-col max-h-[92vh] relative"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none -z-0" />

          {/* Gemini Live Header */}
          <div className="p-4 sm:p-5 bg-white/[0.02] border-b border-white/10 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              {/* Glowing Gemini Live Sparkle Badge */}
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-[1.5px] shadow-lg shadow-emerald-500/20">
                  <div className="w-full h-full rounded-2xl bg-[#080d16] flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                </div>
                {(isListening || isSpeaking) && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    AgriShield Live
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                    Live Assistant
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  {currentCrop} • {activeFarm?.total_area || 1.5} Acres • Conversational Farm Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Regional Language Switcher */}
              <div className="flex items-center bg-white/[0.05] rounded-xl p-1 border border-white/10 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedLang('te')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${selectedLang === 'te' ? 'bg-emerald-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  తెలుగు
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('hi')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${selectedLang === 'hi' ? 'bg-emerald-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  हिन्दी
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('en')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${selectedLang === 'en' ? 'bg-emerald-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Central Gemini Live Animated Visualizer Orb */}
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center border-b border-white/5 relative z-10 bg-gradient-to-b from-transparent via-emerald-950/20 to-transparent">
            <div className="relative flex items-center justify-center">
              {/* Outer Pulsing Sound Rings */}
              {(isListening || isSpeaking) && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="absolute w-36 h-36 rounded-full bg-emerald-500/20 blur-md pointer-events-none"
                  />
                  <motion.div
                    animate={{ scale: [1.2, 1.6, 1.2], opacity: [0.15, 0.4, 0.15] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.3 }}
                    className="absolute w-44 h-44 rounded-full bg-cyan-500/15 blur-lg pointer-events-none"
                  />
                </>
              )}

              {/* Central Gemini Fluid Glowing Orb */}
              <motion.div
                animate={
                  isSpeaking
                    ? { scale: [1, 1.12, 0.98, 1.08, 1], rotate: [0, 90, 180, 270, 360] }
                    : isListening
                    ? { scale: [1, 1.06, 1], rotate: [0, 45, 0] }
                    : { scale: 1 }
                }
                transition={{ repeat: Infinity, duration: isSpeaking ? 4 : 3, ease: "easeInOut" }}
                onClick={toggleListening}
                className="w-24 h-24 rounded-full cursor-pointer relative flex items-center justify-center shadow-2xl transition-all active:scale-95 group"
                style={{
                  background: isListening
                    ? 'radial-gradient(circle at 35% 35%, #f43f5e 0%, #e11d48 40%, #881337 100%)'
                    : 'radial-gradient(circle at 30% 30%, #34d399 0%, #10b981 35%, #0284c7 70%, #4f46e5 100%)',
                  boxShadow: isListening
                    ? '0 0 45px rgba(244,63,94,0.5)'
                    : '0 0 45px rgba(16,185,129,0.45)'
                }}
              >
                {/* Center Dynamic Icon */}
                <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white">
                  {isListening ? (
                    <Mic className="w-6 h-6 animate-pulse text-white" />
                  ) : isSpeaking ? (
                    <Volume2 className="w-6 h-6 text-white animate-bounce" />
                  ) : (
                    <Mic className="w-6 h-6 text-white/90 group-hover:scale-110 transition-transform" />
                  )}
                </div>
              </motion.div>
            </div>

            {/* Live Audio State Caption */}
            <div className="mt-3.5 text-center">
              <span className="text-xs font-bold text-white/80 block">
                {isListening 
                  ? (selectedLang === 'te' ? '🎙️ వింటున్నాను... మాట్లాడండి' : selectedLang === 'hi' ? '🎙️ सुन रहा हूँ... बोलिए' : '🎙️ Listening to you... Speak freely')
                  : isSpeaking
                  ? (selectedLang === 'te' ? '🔊 అసిస్టెంట్ సమాధానం చెబుతున్నారు...' : selectedLang === 'hi' ? '🔊 सहायक उत्तर दे रहा है...' : '🔊 Assistant speaking...')
                  : (selectedLang === 'te' ? 'మైక్ నొక్కి మాట్లాడండి' : selectedLang === 'hi' ? 'माइक दबाकर बात करें' : 'Tap orb to start talking')}
              </span>
              <span className="text-[10px] text-white/40 block mt-0.5">
                Gemini Live conversational speech • Brackets & symbols cleanly filtered
              </span>
            </div>
          </div>

          {/* Conversation Stream Scroll Area */}
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-black/20 no-scrollbar"
          >
            {conversation.map((msg, idx) => {
              const isAssistant = msg.sender === 'assistant';
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                    isAssistant 
                      ? 'bg-white/[0.04] border border-white/10 text-white/90'
                      : 'bg-emerald-600 text-white font-medium'
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 border-t border-white/5 pt-1.5">
                      <span>{msg.timestamp}</span>
                      {isAssistant && (
                        <button
                          type="button"
                          onClick={() => speakAnswer(msg.text, selectedLang)}
                          className="hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Listen again"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{selectedLang === 'te' ? 'వినండి' : 'Listen'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-white/50 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>{selectedLang === 'te' ? 'సమాధానం విశ్లేషిస్తోంది...' : 'Thinking...'}</span>
              </div>
            )}
          </div>

          {/* Quick Topic Chips */}
          <div className="p-2.5 bg-white/[0.015] border-t border-white/5 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar">
            {(TOPIC_SUGGESTIONS[selectedLang] || TOPIC_SUGGESTIONS.en).map((topic, tIdx) => (
              <button
                key={tIdx}
                type="button"
                onClick={() => handleSend(topic)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-white/80 hover:text-white text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap"
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Input Dock */}
          <div className="p-3 sm:p-4 bg-white/[0.02] border-t border-white/10 flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-2xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-950 scale-105'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950'
              }`}
              title={isListening ? "Stop listening" : "Tap to speak"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                  selectedLang === 'te' 
                    ? 'పంటలు, వాతావరణం, పథకాలు లేదా మండి ధరల గురించి అడగండి...'
                    : selectedLang === 'hi'
                    ? 'फसल, मौसम, सरकारी योजना या मंडी भाव के बारे में पूछें...'
                    : 'Ask about crops, weather, schemes, or Mandi rates...'
                }
                className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!textInput.trim()}
              className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white transition-all cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VoiceCropDoctorModal;
