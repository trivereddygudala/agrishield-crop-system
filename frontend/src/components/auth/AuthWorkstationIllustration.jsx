import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Zap, Activity, CheckCircle2 } from 'lucide-react';
import authIllustrationImg from '../../assets/agrishield_auth_showcase.jpg';

export default function AuthWorkstationIllustration({ role = 'farmer', isTe = false }) {
  return (
    <div className="relative w-full h-full min-h-[460px] lg:min-h-[580px] rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-emerald-50/70 dark:from-[#0b1329] dark:via-[#0e1726] dark:to-[#081b14] border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between p-4 sm:p-6 lg:p-7 shadow-xl">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-purple-400/15 dark:bg-purple-600/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/15 dark:bg-emerald-600/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Top Floating Telemetry Status Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-md border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-md"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wide">
            {isTe ? 'అగ్రిషీల్డ్ AI ఇంటెలిజెన్స్' : 'AgriShield Autonomous AI'}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="px-3 py-1.5 rounded-full text-[11px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 flex items-center gap-1.5 backdrop-blur-md"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>
            {role === 'equipment_provider'
              ? (isTe ? 'యంత్రాల అద్దె హబ్' : 'CHC Rental Fleet Network')
              : (isTe ? '99.4% AI నిర్ధారణ ఖచ్చితత్వం' : '99.4% Scan Precision')}
          </span>
        </motion.div>
      </div>

      {/* ── High-Definition Smart Agriculture AI Workstation Artwork ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center my-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-white/60 dark:border-white/10 group"
        >
          <img
            src={authIllustrationImg}
            alt="AgriShield Smart Agriculture AI Workstation"
            className="w-full h-auto max-h-[360px] lg:max-h-[400px] object-cover object-center group-hover:scale-[1.02] transition-transform duration-700 ease-out"
            loading="eager"
          />

          {/* Subtle Scanning Radar Line Overlay */}
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />

          {/* Floating Pill on bottom left of image */}
          <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/15 text-white flex items-center gap-2 shadow-lg">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold">
              {role === 'equipment_provider' ? 'CHC Fleet GPS Active' : 'Edge PyTorch Model v2.0'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Info Footnote */}
      <div className="relative z-10 mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{isTe ? 'రైతులకు ఉచితం & భద్రత' : 'Direct Connect & Zero Brokerage'}</span>
        </span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {isTe ? 'వ్యవసాయ స్మార్ట్ వేదిక' : 'Precision Farming Ecosystem'}
        </span>
      </div>
    </div>
  );
}
