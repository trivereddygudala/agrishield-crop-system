import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Phone, PhoneCall, MessageCircle, X, ShieldCheck, MapPin, ExternalLink, UserCheck } from 'lucide-react';
import { Button, Badge } from '../ui/index';

export default function KisanHelpdeskModal({ isOpen, onClose, cropName = 'Crop', diseaseName = 'Crop Condition' }) {
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  const handleKisanCall = (number = "18001801551") => {
    window.location.href = `tel:${number}`;
  };

  const handleWhatsAppConsult = () => {
    const text = `*AgriShield Farmer Advisory Consultation Request*\n\n🌾 *Crop:* ${cropName}\n🩺 *Suspected Diagnosis:* ${diseaseName}\n📅 *Time:* ${new Date().toLocaleString('en-IN')}\n\n_Seeking urgent technical confirmation and recommended spray dosage from agricultural officer._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden pt-10 pb-20 sm:py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg max-h-[82vh] sm:max-h-[88vh] flex flex-col rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-slate-900 dark:text-white"
        >
          {/* Fixed Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <PhoneCall className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Government & Extension Support
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Kisan Call Centre & Helpdesk
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
            {/* National Toll-Free Hotline Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  National Toll-Free 24x7
                </span>
                <span className="text-[10px] text-emerald-100 font-bold">Free from any phone</span>
              </div>

              <div>
                <span className="text-xs text-emerald-100 block">Kisan Call Centre (Govt. of India)</span>
                <h4 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
                  1800-180-1551
                </h4>
              </div>

              <div className="pt-1">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleKisanCall("18001801551")}
                  leftIcon={<Phone className="w-4 h-4 text-emerald-700" />}
                  className="w-full bg-white hover:bg-white/90 text-emerald-800 font-black justify-center shadow-md text-xs sm:text-sm"
                >
                  Dial Kisan Helpline Toll-Free
                </Button>
              </div>
            </div>

            {/* State Agronomy Extension Lines */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                State Agricultural Helplines (Direct Connect)
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleKisanCall("1907")}
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
                >
                  <span className="font-extrabold text-slate-900 dark:text-white block">AP / Telangana</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs sm:text-sm block mt-0.5">1907 (RBK)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleKisanCall("18004254444")}
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
                >
                  <span className="font-extrabold text-slate-900 dark:text-white block">Tamil Nadu</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs sm:text-sm block mt-0.5">1800-425-4444</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleKisanCall("18004253553")}
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
                >
                  <span className="font-extrabold text-slate-900 dark:text-white block">Karnataka</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs sm:text-sm block mt-0.5">1800-425-3553</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleKisanCall("18002334000")}
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
                >
                  <span className="font-extrabold text-slate-900 dark:text-white block">Maharashtra</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-xs sm:text-sm block mt-0.5">1800-233-4000</span>
                </button>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-white/10 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsAppConsult}
              leftIcon={<MessageCircle className="w-4 h-4 text-emerald-500" />}
              className="w-full justify-center border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-bold text-xs"
            >
              Forward Case via WhatsApp to KVK Scientist
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
