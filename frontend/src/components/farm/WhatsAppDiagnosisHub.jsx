import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Camera, Send, Mic, Play, Pause, 
  CheckCheck, Share2, Sparkles, PhoneCall, ExternalLink, 
  ShieldCheck, AlertCircle, Bot
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SAMPLE_SIMULATIONS = [
  {
    id: 'tomato-blight',
    labelEn: '🍅 Tomato Leaf Spot Photo',
    labelTe: '🍅 టమోటా ఆకు మచ్చల ఫోటో',
    userMessage: 'నా టమోటా ఆకులపై నల్లటి వలయాల మచ్చలు వస్తున్నాయి. ఏ మందు పిచికారీ చేయాలి?',
    hasImage: true,
    imagePlaceholder: '🍅 Early Blight Leaf Image',
    botReplyTe: '🌿 *అగ్రిషీల్డ్ నిర్ధారణ:* టమోటా ముందస్తు ఎండు తెగులు (Early Blight - 97.2% ఖచ్చితత్వం).\n\n🧪 *సిఫార్సు చేసిన మందు:* మాంకోజెబ్ 75% WP (Mancozeb) @ 2.5 గ్రాములు 1 లీటరు నీటికి కలిపి పిచికారీ చేయండి.\n\n⚠️ *స్ప్రే హెచ్చరిక:* మీ పొలంలో గాలి వేగం 18 km/h ఉంది. సాయంత్రం 5:30 PM తర్వాత మాత్రమే పిచికారీ చేయండి.',
    botReplyEn: '🌿 *AgriShield Diagnosis:* Tomato Early Blight (97.2% Confidence).\n\n🧪 *Prescription:* Spray Mancozeb 75% WP @ 2.5g per 1 Liter water.\n\n⚠️ *Spray Safety Window:* Wind speed is currently 18 km/h. Spray only after 5:30 PM this evening.',
    audioDuration: '0:18'
  },
  {
    id: 'chilli-curl',
    labelEn: '🌶️ Chilli Leaf Curl Photo',
    labelTe: '🌶️ మిరప ఆకు ముడుత ఫోటో',
    userMessage: 'మిరప తోటలో ఆకులు పైకి దోనెలా ముడుచుకుపోతున్నాయి. పరిష్కారం చెప్పండి.',
    hasImage: true,
    imagePlaceholder: '🌶️ Chilli Leaf Curl Image',
    botReplyTe: '🌿 *అగ్రిషీల్డ్ నిర్ధారణ:* మిరప ఆకు ముడుత తెగులు (Chilli Thrips & Mites - 95.8% ఖచ్చితత్వం).\n\n🧪 *సిఫార్సు:* పెగాసస్ (Diafenthiuron 50% WP) @ 1.25 గ్రాములు లేదా ఫిప్రోనిల్ 5% SC @ 2 మి.లీ లీటరు నీటికి.\n\n🌿 *సేంద్రీయ నివారణ:* వేప నూనె (Neem Oil 10,000 ppm) @ 2.5 మి.లీ లీటరు నీటికి కలపండి.',
    botReplyEn: '🌿 *AgriShield Diagnosis:* Chilli Leaf Curl (Thrips/Mite Infestation - 95.8% Confidence).\n\n🧪 *Prescription:* Diafenthiuron 50% WP @ 1.25g/L or Fipronil 5% SC @ 2ml/L water.\n\n🌿 *Organic Alternative:* Neem Oil 10,000 ppm @ 2.5ml/L.',
    audioDuration: '0:22'
  },
  {
    id: 'weather-query',
    labelEn: '🌦️ Pasupugallu Spray Safety',
    labelTe: '🌦️ పసుపుగల్లు స్ప్రే భద్రత',
    userMessage: 'పసుపుగల్లులో ఈరోజు స్ప్రే చేయడానికి వాతావరణం అనుకూలమా?',
    hasImage: false,
    botReplyTe: '🌦️ *పసుపుగల్లు ప్రత్యక్ష ఉపగ్రహ వాతావరణం:*\n• ఉష్ణోగ్రత: 27.5°C\n• గాలి తేమ: 78% (ఆప్టిమల్)\n• గాలి వేగం: 17 km/h\n• వర్ష సూచన: రాబోయే 6 గంటల్లో వర్షం లేదు (0% అవకాశం)\n\n✅ *తీర్పు:* ఈరోజు సాయంత్రం పిచికారీ చేయడానికి వాతావరణం పూర్తిగా అనుకూలం.',
    botReplyEn: '🌦️ *Pasupugallu Live Satellite Weather:*\n• Temperature: 27.5°C\n• Humidity: 78% (Optimal)\n• Wind Speed: 17 km/h\n• Rain Chance: 0% in next 6 hours\n\n✅ *Verdict:* Safe to spray this evening between 4:30 PM and 6:30 PM.',
    audioDuration: '0:14'
  }
];

export default function WhatsAppDiagnosisHub({ 
  farmName = "My Farm", 
  village = "Pasupugallu",
  cropName = "Tomato",
  onClose 
}) {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';

  const [activeSimulation, setActiveSimulation] = useState(SAMPLE_SIMULATIONS[0]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'm-1',
      sender: 'user',
      text: SAMPLE_SIMULATIONS[0].userMessage,
      hasImage: true,
      imagePlaceholder: SAMPLE_SIMULATIONS[0].imagePlaceholder,
      time: '11:42 AM'
    },
    {
      id: 'm-2',
      sender: 'bot',
      text: isTe ? SAMPLE_SIMULATIONS[0].botReplyTe : SAMPLE_SIMULATIONS[0].botReplyEn,
      hasAudio: true,
      audioDuration: SAMPLE_SIMULATIONS[0].audioDuration,
      time: '11:42 AM'
    }
  ]);

  const handleSelectSimulation = (sim) => {
    setActiveSimulation(sim);
    setIsPlayingAudio(false);
    setMessages([
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: sim.userMessage,
        hasImage: sim.hasImage,
        imagePlaceholder: sim.imagePlaceholder,
        time: 'Just now'
      },
      {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        text: isTe ? sim.botReplyTe : sim.botReplyEn,
        hasAudio: true,
        audioDuration: sim.audioDuration,
        time: 'Just now'
      }
    ]);
  };

  const handleOpenRealWhatsApp = () => {
    const text = isTe
      ? `నమస్కారం అగ్రిషీల్డ్, నా పొలం ${village} లో ఉంది. నా ${cropName} పంట ఆకుల ఫోటో పంపుతున్నాను, తెగులును గుర్తించి మందుల సలహా ఇవ్వండి.`
      : `Hello AgriShield AI, my farm is located in ${village}. I am sending a photo of my ${cropName} crop leaf. Please diagnose the disease and prescribe treatment.`;
    window.open(`https://api.whatsapp.com/send?phone=919876543210&text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="rounded-3xl bg-[#060c14] border border-emerald-500/25 p-4 sm:p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Atmosphere Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                24/7 AI WhatsApp Bot
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                Direct Mobile Diagnosis
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {isTe ? 'వాట్సాప్ ఫోటో వ్యాధి నిర్ధారణ & లైవ్ బాట్' : 'Direct WhatsApp Bot Photo Diagnosis'}
            </h2>
          </div>
        </div>

        {/* 1-Tap Real WhatsApp Launch Button */}
        <button
          onClick={handleOpenRealWhatsApp}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer w-full sm:w-auto justify-center"
        >
          <MessageSquare className="w-4 h-4 fill-white" />
          <span>{isTe ? 'వాట్సాప్‌లో మాట్లాడండి' : 'Chat on WhatsApp Bot'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Value Explanation Banner */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            {isTe ? 'రైతులకు అత్యంత సులభమైన పద్ధతి — వెబ్‌సైట్ తెరవాల్సిన అవసరం లేదు!' : 'Easiest Way for Farmers — No Website Login Needed!'}
          </span>
          <p className="text-xs text-white/80">
            {isTe 
              ? 'మీ వాట్సాప్ నుండి ఆకు ఫోటో తీసి అగ్రిషీల్డ్ నంబర్‌కు పంపండి. వెంటనే తెలుగులో వాయిస్ నోట్ ఆడియో మరియు సరైన పురుగు మందుల మోతాదు కార్డు వస్తుంది.'
              : 'Farmers can simply snap a leaf photo and send it to AgriShield on WhatsApp. They receive an instant regional voice note and treatment prescription.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
            📞 +91 98765 43210
          </span>
        </div>
      </div>

      {/* Interactive Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Sample Scenario Selectors */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider block">
            {isTe ? 'లైవ్ వాట్సాప్ పరీక్ష దృశ్యాలు (Click to Test):' : 'Interactive Test Scenarios:'}
          </span>

          <div className="space-y-2">
            {SAMPLE_SIMULATIONS.map(sim => {
              const isSelected = activeSimulation.id === sim.id;
              return (
                <div
                  key={sim.id}
                  onClick={() => handleSelectSimulation(sim)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg text-white'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] text-white/70'
                  }`}
                >
                  <p className="text-xs font-black">{isTe ? sim.labelTe : sim.labelEn}</p>
                  <p className="text-[11px] text-white/50 truncate">"{sim.userMessage}"</p>
                </div>
              );
            })}
          </div>

          {/* 3 Step Instruction Card */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-xs text-white/70">
            <p className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isTe ? 'రైతు ఎలా ఉపయోగించాలి?' : 'How Farmers Use WhatsApp Bot:'}
            </p>
            <p>1. {isTe ? 'నెంబర్ +91 98765 43210 సేవ్ చేసుకోండి.' : 'Save AgriShield contact on phone.'}</p>
            <p>2. {isTe ? 'వ్యాధి సోకిన ఆకు స్పష్టమైన ఫోటో పంపండి.' : 'Send clear photo of infected crop leaf.'}</p>
            <p>3. {isTe ? 'తక్షణమే వాయిస్ నోట్ & మందుల చీటీ అందుకోండి.' : 'Instantly receive voice advice & recipe.'}</p>
          </div>
        </div>

        {/* Right: Realistic WhatsApp Mobile Simulator */}
        <div className="lg:col-span-8 flex justify-center">
          <div className="w-full max-w-md rounded-3xl bg-[#0b141a] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[520px]">
            {/* WhatsApp App Bar */}
            <div className="px-4 py-3 bg-[#1f2c34] flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                  🌱
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    AgriShield AI Bot
                    <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                  </h4>
                  <span className="text-[10px] text-emerald-400">online · Verified Agronomist</span>
                </div>
              </div>
              <PhoneCall className="w-4 h-4 text-white/70" />
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
              {messages.map(m => {
                const isUser = m.sender === 'user';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-xs space-y-2 shadow-md ${
                      isUser
                        ? 'bg-[#005c4b] text-white rounded-tr-none'
                        : 'bg-[#202c33] text-white rounded-tl-none border border-white/10'
                    }`}>
                      {/* Image Preview if present */}
                      {m.hasImage && (
                        <div className="w-full h-32 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center gap-1.5 text-emerald-300 font-bold">
                          <Camera className="w-6 h-6 text-emerald-400" />
                          <span className="text-[11px]">{m.imagePlaceholder}</span>
                        </div>
                      )}

                      {/* Text */}
                      <p className="whitespace-pre-line text-[11px] leading-relaxed">
                        {m.text}
                      </p>

                      {/* Audio Voice Note Bubble for Bot */}
                      {m.hasAudio && (
                        <div className="pt-1 border-t border-white/10 flex items-center gap-2">
                          <button
                            onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                            className="w-7 h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center cursor-pointer shrink-0"
                          >
                            {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                          </button>
                          <div className="flex-1 space-y-1">
                            <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                              <div className={`h-full bg-emerald-400 ${isPlayingAudio ? 'w-2/3 animate-pulse' : 'w-0'}`} />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-white/60">
                              <span>{isTe ? 'తెలుగు వాయిస్ నోట్' : 'Voice Advice'}</span>
                              <span>{m.audioDuration}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timestamp & Read ticks */}
                      <div className="flex items-center justify-end gap-1 text-[9px] text-white/50 pt-0.5">
                        <span>{m.time}</span>
                        {isUser && <CheckCheck className="w-3 h-3 text-sky-400" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* WhatsApp Input Bar */}
            <div className="px-3 py-2 bg-[#1f2c34] flex items-center gap-2 border-t border-white/10 shrink-0">
              <Camera className="w-5 h-5 text-white/50" />
              <input
                type="text"
                disabled
                value={isTe ? 'వాట్సాప్‌లో సందేశం పంపండి...' : 'Type message on WhatsApp...'}
                className="flex-1 px-3 py-1.5 rounded-full bg-[#2a3942] text-xs text-white/60 focus:outline-none"
              />
              <div className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
