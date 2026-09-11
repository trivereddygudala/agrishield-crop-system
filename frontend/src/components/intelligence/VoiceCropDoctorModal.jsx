import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Mic, MicOff, Volume2, VolumeX, Sparkles, Send, 
  Stethoscope, ShieldCheck, Sprout, ArrowRight, RefreshCw, MessageSquare
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../../context/FarmContext';
import { getDiseaseDetails, translateCrop, translateDisease } from '../../utils/diseaseAdvisoryData';

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
  const [isDoctorThinking, setIsDoctorThinking] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const chatScrollRef = useRef(null);

  const currentCrop = initialCrop || activeFarm?.crop_type || 'Tomato';
  const currentDisease = initialDisease || 'Crop Health';

  // Quick prompt suggestions based on language
  const PROMPT_SUGGESTIONS = {
    en: [
      `What is the best medicine dosage for ${currentCrop}?`,
      `How many spray pumps do I need for ${activeFarm?.total_area || 1.5} acres?`,
      `What organic remedies prevent ${currentDisease}?`,
      `When is the best time of day to spray?`
    ],
    te: [
      `${currentCrop} పంటకి సరైన మందు మోతాదు ఎంత?`,
      `${activeFarm?.total_area || 1.5} ఎకరాలకి ఎన్ని స్ప్రే పంపుల నీరు కావాలి?`,
      `సేంద్రీయ పద్ధతిలో తెగుళ్లను ఎలా అరికట్టాలి?`,
      `మందు పిచికారీ చేయడానికి సరైన సమయం ఏది?`
    ],
    hi: [
      `${currentCrop} की फसल के लिए अनुशंसित दवा की मात्रा क्या है?`,
      `${activeFarm?.total_area || 1.5} एकड़ के लिए कितने स्प्रे पंप पानी चाहिए?`,
      `जैविक तरीके से रोग को कैसे रोकें?`,
      `छिड़काव करने का सबसे सही समय कौन सा है?`
    ]
  };

  // Setup Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let currentText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript;
          }
          setTranscript(currentText);
          setTextInput(currentText);
        };

        recognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Update speech recognition language when changed
  useEffect(() => {
    if (recognitionRef.current) {
      if (selectedLang === 'te') recognitionRef.current.lang = 'te-IN';
      else if (selectedLang === 'hi') recognitionRef.current.lang = 'hi-IN';
      else recognitionRef.current.lang = 'en-IN';
    }
  }, [selectedLang]);

  // Initial greeting when opened
  useEffect(() => {
    if (isOpen) {
      const localizedCropName = translateCrop(currentCrop, selectedLang) || currentCrop;
      let greeting = '';

      if (selectedLang === 'te') {
        greeting = `నమస్కారం రైతు సోదరా! నేను డాక్టర్ అగ్రిషీల్డ్. మీ ${localizedCropName} పంట సమస్యలను అడగండి, నేను తక్షణ పరిష్కారం మరియు మందుల మోతాదును తెలియజేస్తాను.`;
      } else if (selectedLang === 'hi') {
        greeting = `नमस्ते किसान भाई! मैं डॉ. एग्रीशील्ड हूँ। अपनी ${localizedCropName} फसल की बीमारी या दवा की मात्रा के बारे में पूछें, मैं तुरंत समाधान बताऊंगा।`;
      } else {
        greeting = `Namaste Farmer! I am Dr. AgriShield, your AI Crop Pathologist. Ask me about chemical dosages, pump calculations, or organic cures for your ${currentCrop} crop.`;
      }

      setConversation([
        {
          sender: 'doctor',
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      speakAnswer(greeting, selectedLang);
    } else {
      if (synthRef.current) synthRef.current.cancel();
      setIsSpeaking(false);
      setIsListening(false);
    }
  }, [isOpen, selectedLang]);

  // Scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [conversation, isDoctorThinking]);

  // Speech Synthesis
  const speakAnswer = (text, lang) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    if (lang === 'te') utterance.lang = 'te-IN';
    else if (lang === 'hi') utterance.lang = 'hi-IN';
    else utterance.lang = 'en-IN';

    // Pick best available native voice
    const voices = synthRef.current.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(utterance.lang) || v.lang.includes(lang));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }
    stopSpeaking();
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  // Local Rule-Based Doctor Intelligence Engine
  const generateDoctorAdvice = (query, lang) => {
    const q = query.toLowerCase();
    const acres = parseFloat(activeFarm?.total_area) || 1.5;
    const waterLiters = Math.round(acres * 150);
    const pump15L = Math.ceil(waterLiters / 15);

    const isTe = lang === 'te';
    const isHi = lang === 'hi';

    // 1. Water & Pump Calculation
    if (q.includes('pump') || q.includes('water') || q.includes('పంపు') || q.includes('నీరు') || q.includes('लीटर') || q.includes('पंप')) {
      if (isTe) {
        return `మీ ${acres} ఎకరాల పొలానికి మొత్తం సుమారు ${waterLiters} లీటర్ల నీరు అవసరం. మీరు 15 లీటర్ల న్యాప్‌సాక్ పంపు వాడితే మొత్తం ${pump15L} పంపుల మందు ద్రావణం సరిపోతుంది.`;
      }
      if (isHi) {
        return `आपके ${acres} एकड़ खेत के लिए कुल लगभग ${waterLiters} लीटर पानी की आवश्यकता होगी। यदि आप 15 लीटर का नैपसैक पंप उपयोग कर रहे हैं, तो कुल ${pump15L} पंप घोल पर्याप्त रहेगा।`;
      }
      return `For your ${acres} acre(s) field, you need approximately ${waterLiters} liters of spray water. Using a standard 15-liter knapsack pump, this requires ${pump15L} full tanks.`;
    }

    // 2. Timing / Weather / Rain
    if (q.includes('time') || q.includes('rain') || q.includes('weather') || q.includes('సమయం') || q.includes('వర్షం') || q.includes('मौसम') || q.includes('समय')) {
      if (isTe) {
        return `మందు పిచికారీ చేయడానికి ఉదయం 9:00 గంటలలోపు లేదా సాయంత్రం 4:30 తర్వాత సరైన సమయం. రాబోయే 4 గంటల్లో వర్షం కురిసే అవకాశం ఉంటే పిచికారీ చేయవద్దు. గాలి వేగం తక్కువగా ఉన్నప్పుడు మాత్రమే స్ప్రే చేయండి.`;
      }
      if (isHi) {
        return `छिड़काव के लिए सबसे अच्छा समय सुबह 9:00 बजे से पहले या शाम 4:30 बजे के बाद का है। यदि अगले 4 घंटों में बारिश की संभावना हो तो छिड़काव न करें।`;
      }
      return `The optimal spray window is early morning (before 9:00 AM) or late afternoon (after 4:30 PM). Never spray if rain is predicted within 4 hours, and avoid windy conditions above 12 km/h.`;
    }

    // 3. Organic remedies
    if (q.includes('organic') || q.includes('natural') || q.includes('సేంద్రీయ') || q.includes('వేప') || q.includes('जैविक') || q.includes('नीम')) {
      if (isTe) {
        return `సేంద్రీయ నివారణకు 1 లీటరు నీటికి 5 మి.లీ వేప నూనె (1500 ppm) మరియు 1 మి.లీ లిక్విడ్ సబ్బు కలిపి ప్రతి 7 రోజులకు ఒకసారి పిచికారీ చేయండి. అలాగే ట్రైకోడెర్మా విరిడే జీవ శిలీంద్రనాశిని (5 గ్రా/లీ) వాడటం వలన మొక్కల రోగనిరోధక శక్తి పెరుగుతుంది.`;
      }
      if (isHi) {
        return `जैविक उपचार के लिए 5 मिली नीम का तेल (1500 ppm) प्रति लीटर पानी में 1 मिली तरल साबुन मिलाकर हर 7 दिन पर छिड़कें। साथ ही ट्राइकोडर्मा विरिडी (5 ग्राम/लीटर) का प्रयोग मिट्टी और पत्तियों पर करें।`;
      }
      return `For organic defense, apply Neem Oil (1500 ppm) @ 5 ml/L of water with 1 ml liquid soap every 7 days. Soil and foliar drenching with Trichoderma harzianum (5 g/L) significantly boosts plant immunity.`;
    }

    // 4. Chemical Dosage & Treatment for current crop/disease
    const kb = getDiseaseDetails(initialDisease || 'early blight', lang);
    const chem = kb.chemicals?.[0] || 'Mancozeb 75% WP @ 2.5 g/L';

    if (isTe) {
      return `మీ ${currentCrop} పంట కోసం సిఫార్సు చేసిన మందు: ${chem}. 15 లీటర్ల పంపుకి దాదాపు 35 నుండి 40 గ్రాములు కలపండి. వ్యాధి సోకిన ఆకులను తీసివేసి నాశనం చేయండి.`;
    }
    if (isHi) {
      return `आपकी ${currentCrop} फसल के लिए अनुशंसित दवा: ${chem}. 15 लीटर के पंप में लगभग 35 से 40 ग्राम दवा मिलाएं। गंभीर रूप से संक्रमित पत्तियों को काटकर नष्ट कर दें।`;
    }
    return `For ${currentCrop} (${currentDisease}), the recommended intervention is: ${chem}. For each 15-liter knapsack pump, mix 35–40 grams. Remove heavily infected lower leaves touching soil.`;
  };

  const handleSend = (queryText) => {
    const text = queryText || textInput;
    if (!text.trim()) return;

    const userMessage = {
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversation(prev => [...prev, userMessage]);
    setTextInput('');
    setTranscript('');
    setIsDoctorThinking(true);

    setTimeout(() => {
      const advice = generateDoctorAdvice(text, selectedLang);
      const doctorMessage = {
        sender: 'doctor',
        text: advice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setConversation(prev => [...prev, doctorMessage]);
      setIsDoctorThinking(false);
      speakAnswer(advice, selectedLang);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-b border-emerald-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-950">
                  <Stethoscope className="w-6 h-6" />
                </div>
                {isSpeaking && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">Dr. AgriShield</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                    AI Crop Pathologist
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {currentCrop} • {activeFarm?.total_area || 1.5} Acres • {activeFarm?.location || 'Pasupugallu'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Regional Language Switcher */}
              <div className="flex items-center bg-slate-950/80 rounded-xl p-1 border border-slate-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedLang('te')}
                  className={`px-2 py-1 rounded-lg transition-colors ${selectedLang === 'te' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  తెలుగు
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('hi')}
                  className={`px-2 py-1 rounded-lg transition-colors ${selectedLang === 'hi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  हिन्दी
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang('en')}
                  className={`px-2 py-1 rounded-lg transition-colors ${selectedLang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Audio Wave Visualizer Banner when speaking or listening */}
          {(isListening || isSpeaking) && (
            <div className="px-4 py-2 bg-emerald-950/50 border-b border-emerald-800/30 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="w-1 h-5 bg-emerald-300 rounded-full animate-pulse delay-75" />
                  <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse delay-150" />
                  <span className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse" />
                </div>
                <span className="font-bold">
                  {isListening ? 'Listening to your voice...' : 'Dr. AgriShield speaking...'}
                </span>
              </div>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700"
                >
                  <VolumeX className="w-3 h-3 text-rose-400" /> Stop Audio
                </button>
              )}
            </div>
          )}

          {/* Chat Messages */}
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-950/60"
          >
            {conversation.map((msg, idx) => {
              const isDoc = msg.sender === 'doctor';
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 ${isDoc ? 'justify-start' : 'justify-end'}`}
                >
                  {isDoc && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className={`max-w-[82%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isDoc 
                      ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                      : 'bg-emerald-600 text-white shadow-md font-medium'
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] opacity-60">
                      <span>{msg.timestamp}</span>
                      {isDoc && (
                        <button
                          type="button"
                          onClick={() => speakAnswer(msg.text, selectedLang)}
                          className="hover:opacity-100 flex items-center gap-1"
                          title="Listen again"
                        >
                          <Volume2 className="w-3 h-3" /> Listen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isDoctorThinking && (
              <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Dr. AgriShield analyzing pathology data...</span>
              </div>
            )}
          </div>

          {/* Suggested Quick Prompts */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider shrink-0 pl-1">
              Ask Doctor:
            </span>
            {(PROMPT_SUGGESTIONS[selectedLang] || PROMPT_SUGGESTIONS.en).map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleSend(prompt)}
                className="shrink-0 px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Voice & Input Footer */}
          <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2 sm:gap-3">
            {/* Big Voice Mic Button */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-3 rounded-2xl font-bold flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-950 scale-105'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950'
              }`}
              title={isListening ? "Stop listening" : "Tap to speak"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Input field */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                  selectedLang === 'te' 
                    ? 'మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి లేదా మైక్ నొక్కండి...'
                    : selectedLang === 'hi'
                    ? 'अपना प्रश्न यहाँ लिखें या माइक दबाएं...'
                    : 'Ask about dosages, spray pumps, or symptoms...'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!textInput.trim()}
              className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
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
