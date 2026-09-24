import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, ShieldCheck, Zap, Satellite, Compass, Sparkles, CheckCircle2 } from 'lucide-react';

export default function AuthWorkstationIllustration({ role = 'farmer', isTe = false }) {
  return (
    <div className="relative w-full h-full min-h-[460px] lg:min-h-[580px] rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-50/80 via-purple-50/60 to-emerald-50/70 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between p-6 sm:p-8">
      {/* Background Soft Blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-300/20 dark:bg-emerald-600/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Top Floating Badge Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 shadow-sm border border-slate-200/80 dark:border-slate-700 backdrop-blur-md"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wide">
            {isTe ? 'అగ్రిషీల్డ్ AI ఇంటెలిజెన్స్' : 'AgriShield Autonomous AI'}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="px-3 py-1 rounded-full text-[11px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 flex items-center gap-1"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>{role === 'equipment_provider' ? (isTe ? 'యంత్రాల అద్దె హబ్' : 'CHC Rental Network') : (isTe ? '99.4% AI ఖచ్చితత్వం' : '99.4% AI Accuracy')}</span>
        </motion.div>
      </div>

      {/* Centerpiece Vector Illustration (Matching the modern workstation reference) */}
      <div className="relative z-10 flex-1 flex items-center justify-center my-4">
        <svg
          viewBox="0 0 520 400"
          className="w-full max-w-[440px] drop-shadow-xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Floor Shadow */}
          <ellipse cx="260" cy="370" rx="220" ry="18" fill="rgba(0, 0, 0, 0.05)" />

          {/* Table Legs */}
          <path d="M110 240L95 365" stroke="#6366F1" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
          <path d="M410 240L425 365" stroke="#6366F1" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
          <path d="M125 240L145 365" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          <path d="M395 240L375 365" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" opacity="0.5" />

          {/* Table Top Surface */}
          <rect x="70" y="230" width="380" height="12" rx="6" fill="#818CF8" />
          <rect x="75" y="238" width="370" height="4" fill="#6366F1" opacity="0.4" />

          {/* Computer Stand & Base */}
          <rect x="235" y="220" width="50" height="10" rx="3" fill="#94A3B8" />
          <path d="M255 190L260 220H265L260 190" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />

          {/* Desktop Monitor Screen */}
          <rect x="175" y="65" width="170" height="125" rx="14" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="4" />
          <rect x="183" y="73" width="154" height="100" rx="8" fill="#F8FAFC" />

          {/* Screen Content: Crop Diagnostic Dashboard */}
          <rect x="190" y="80" width="50" height="8" rx="4" fill="#10B981" opacity="0.8" />
          <circle cx="260" cy="115" r="24" fill="#ECFDF5" stroke="#10B981" strokeWidth="2" strokeDasharray="3 3" />
          <path d="M255 110C255 106 265 104 265 104C265 104 268 114 263 118C258 122 255 116 255 110Z" fill="#059669" />
          <rect x="195" y="146" width="130" height="6" rx="3" fill="#E2E8F0" />
          <rect x="195" y="156" width="80" height="6" rx="3" fill="#10B981" />

          {/* Floating UI Notification Bubbles above Monitor */}
          <g>
            <circle cx="215" cy="50" r="14" fill="#EF4444" opacity="0.9" />
            <path d="M211 48L215 52L220 46" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="255" cy="35" r="16" fill="#3B82F6" opacity="0.95" />
            <path d="M251 35H259M255 31V39" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="295" cy="48" r="14" fill="#10B981" opacity="0.95" />
            <path d="M291 48L294 51L300 45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* Office Desk Accessories: Mug, Folders */}
          <rect x="365" y="175" width="12" height="55" rx="3" fill="#F59E0B" />
          <rect x="380" y="170" width="12" height="60" rx="3" fill="#10B981" />
          <rect x="395" y="180" width="12" height="50" rx="3" fill="#6366F1" />
          <circle cx="345" cy="225" r="8" fill="#EC4899" />
          <rect x="340" y="215" width="10" height="15" rx="2" fill="#F43F5E" />

          {/* Modern Ergonomic Chair */}
          <path d="M125 180C125 170 135 160 148 160H160C170 160 178 168 178 178V285H125V180Z" fill="#A855F7" opacity="0.85" />
          <path d="M140 285L120 370" stroke="#7E22CE" strokeWidth="6" strokeLinecap="round" />
          <path d="M165 285L175 370" stroke="#7E22CE" strokeWidth="6" strokeLinecap="round" />

          {/* User Figure (Seated at Workstation) */}
          {/* Legs & Torso */}
          <path d="M145 230L170 230L195 285L165 285Z" fill="#4B5563" />
          <path d="M195 285L210 355L190 355" stroke="#374151" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M145 185C145 170 170 170 170 185V245H145V185Z" fill="#9333EA" />

          {/* Arm typing on keyboard */}
          <path d="M160 195L195 220L215 225" stroke="#9333EA" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="218" cy="225" r="4" fill="#FBCFE8" />

          {/* Head & Hair */}
          <circle cx="160" cy="145" r="14" fill="#FBCFE8" />
          <path d="M145 138C145 125 175 120 175 135C175 145 168 160 148 160C140 160 140 148 145 138Z" fill="#1E1B4B" />

          {/* Potted Crop Plant next to Desk */}
          <path d="M430 310L425 365H455L450 310H430Z" fill="#D97706" />
          <path d="M440 310C440 270 415 260 415 260C415 260 445 275 440 310Z" fill="#10B981" />
          <path d="M440 300C440 265 470 250 470 250C470 250 445 275 440 300Z" fill="#059669" />
          <path d="M440 290C430 250 440 235 440 235C440 235 455 255 440 290Z" fill="#34D399" />
        </svg>
      </div>

      {/* Bottom Value Badges Grid */}
      <div className="relative z-10 grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-100 dark:border-slate-700/60">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Leaf className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isTe ? 'పంట ఆరోగ్యం' : 'Crop Health'}</p>
            <p className="text-xs font-black text-slate-800 dark:text-slate-100">{isTe ? 'తక్షణ నిర్ధారణ' : 'Real-Time AI Scan'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xs border border-slate-100 dark:border-slate-700/60">
          <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isTe ? 'అద్దె యంత్రాలు' : 'Custom Hiring'}</p>
            <p className="text-xs font-black text-slate-800 dark:text-slate-100">{isTe ? 'ట్రాక్టర్ & డ్రోన్లు' : 'Tractors & Drones'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
