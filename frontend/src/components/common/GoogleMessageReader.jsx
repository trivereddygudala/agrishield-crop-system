import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Trash2, Share2, ShieldCheck, CheckCheck,
  Send, Sparkles
} from 'lucide-react';
import { formatDateTime, timeAgo } from '../../utils/dateUtils';

export default function GoogleMessageReader({
  message,
  translatedTitle,
  translatedBody,
  onBack,
  onDelete,
  lang = 'te'
}) {
  const navigate = useNavigate();
  const [replyQuery, setReplyQuery] = useState('');
  const isTelugu = (lang || '').toLowerCase().startsWith('te');

  if (!message) return null;

  const handleSendToAI = (e) => {
    if (e) e.preventDefault();
    const query = replyQuery.trim() || translatedTitle || message.title;
    navigate(`/assistant?q=${encodeURIComponent(query)}`);
  };

  const handleShareWhatsApp = () => {
    const shareText = `*AgriShield Alert / నోటిఫికేషన్*\n\n*${translatedTitle || message.title}*\n${translatedBody || message.message}\n\n- AgriShield AI Crop Protection`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const isDisease = message.category === 'disease';
  const isWeather = message.category === 'weather';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] max-w-3xl mx-auto bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden"
    >
      {/* ─── GOOGLE MESSAGES TOP APP BAR ─── */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/90 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -ml-1 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title={isTelugu ? "వెనుకకు" : "Back"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
          </div>

          {/* Contact Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-white truncate">
                {isTelugu ? 'AgriShield హెచ్చరికలు' : 'AgriShield Alerts'}
              </h2>
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ✓ {isTelugu ? 'ధృవీకరించబడింది' : 'Verified'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {isTelugu ? 'అధికారిక SMS గేట్‌వే • కిసాన్ హెల్ప్‌లైన్' : 'Official SMS Gateway • Kisan Helpline'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href="tel:18001801551"
            className="p-2.5 rounded-full hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
            title={isTelugu ? "కిసాన్ కాల్ సెంటర్ (1800-180-1551)" : "Call Kisan Helpline"}
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            onClick={handleShareWhatsApp}
            className="p-2.5 rounded-full hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
            title={isTelugu ? "వాట్సాప్‌లో షేర్ చేయండి" : "Share via WhatsApp"}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (onDelete) onDelete(message.notification_id || message.id);
              onBack();
            }}
            className="p-2.5 rounded-full hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition-colors"
            title={isTelugu ? "సందేశాన్ని తొలగించండి" : "Delete Message"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── CHAT CONVERSATION STREAM ─── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gradient-to-b from-slate-950 to-slate-900">
        {/* Date Stamp Pill */}
        <div className="flex justify-center">
          <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-bold text-slate-400 shadow-xs">
            {formatDateTime(message.lifecycle?.created_at || message.created_at)}
          </div>
        </div>

        {/* End-to-End Encryption Note */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-medium">
          <span>🔒</span>
          <span>
            {isTelugu
              ? 'AgriShield క్లౌడ్ ద్వారా నేరుగా రైతుకు పంపబడిన అధికారిక సందేశం'
              : 'End-to-end encrypted notification delivered via AgriShield System'}
          </span>
        </div>

        {/* ─── GOOGLE MESSAGES SPEECH BUBBLE ─── */}
        <div className="flex items-start gap-2.5 max-w-xl">
          <div className="w-8 h-8 rounded-full bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
            <ShieldCheck className="w-4 h-4" />
          </div>

          <div className="relative bg-slate-800/90 text-slate-100 rounded-3xl rounded-tl-sm p-4 sm:p-5 border border-slate-700/80 shadow-lg space-y-3">
            {/* Header / Category & Priority */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  {message.category || 'System'}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {message.priority || 'Normal'} Priority
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-black text-white leading-snug">
              {translatedTitle || message.title}
            </h3>

            {/* Body Text (Farmer Readable) */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
              {translatedBody || message.message}
            </p>

            {/* Smart Action Buttons Inside Message */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {isDisease && (
                <button
                  onClick={() => navigate('/upload')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  <span>🌿</span>
                  <span>{isTelugu ? 'స్కాన్ & నివారణ మందులు చూడండి' : 'View AI Treatment & Remedies'}</span>
                </button>
              )}

              {isWeather && (
                <button
                  onClick={() => navigate('/crop-advisory')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  <span>🌦️</span>
                  <span>{isTelugu ? 'వాతావరణ నివేదిక చూడండి' : 'View Weather Advisory'}</span>
                </button>
              )}

              <a
                href="tel:18001801551"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-700/80 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-600 transition-all active:scale-95"
              >
                <span>📞</span>
                <span>{isTelugu ? 'కిసాన్ హెల్ప్‌లైన్: 1800-180-1551' : 'Call Kisan Helpline'}</span>
              </a>
            </div>

            {/* Message Delivery Status & Receipt */}
            <div className="flex items-center justify-end gap-1.5 pt-1 text-[11px] text-slate-400 font-medium">
              <span>{timeAgo(message.lifecycle?.created_at || message.created_at)}</span>
              <span>•</span>
              <span>SMS 1</span>
              <span>•</span>
              <span className="flex items-center text-emerald-400 font-bold">
                <CheckCheck className="w-3.5 h-3.5 inline mr-0.5" />
                {isTelugu ? 'చదివారు' : 'Read'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── GOOGLE MESSAGES BOTTOM REPLY / ASK AI BAR ─── */}
      <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSendToAI} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={replyQuery}
              onChange={(e) => setReplyQuery(e.target.value)}
              placeholder={
                isTelugu
                  ? 'ఈ హెచ్చరికపై AI నిపుణుడిని ప్రశ్న అడగండి...'
                  : 'Ask AI Assistant about this crop alert...'
              }
              className="w-full pl-4 pr-10 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <Sparkles className="w-4 h-4 text-emerald-400 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>

          <button
            type="submit"
            className="p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition-all active:scale-95 flex items-center justify-center shrink-0 shadow-md"
            title={isTelugu ? "ప్రశ్నించండి" : "Send to AI"}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
