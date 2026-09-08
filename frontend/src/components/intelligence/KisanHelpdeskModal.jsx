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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 text-slate-900 dark:text-white space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <PhoneCall className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Government & Extension Support
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Kisan Call Centre & Agronomist Helpdesk
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* National Toll-Free Hotline Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                National Toll-Free 24x7
              </span>
              <span className="text-xs opacity-80">Govt. of India</span>
            </div>
            <div>
              <h4 className="text-2xl font-black tracking-tight">1800-180-1551</h4>
              <p className="text-xs opacity-90 mt-0.5">Kisan Call Centre — Free consultation with agronomists in 22 regional languages.</p>
            </div>
            <Button
              variant="white"
              size="md"
              onClick={() => handleKisanCall("18001801551")}
              leftIcon={<Phone className="w-4 h-4 text-emerald-700" />}
              className="w-full font-black text-emerald-800 justify-center shadow-md cursor-pointer"
            >
              Call National Kisan Helpline Now
            </Button>
          </div>

          {/* Regional Helplines */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              State Agricultural Extension Numbers
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleKisanCall("1907")}
                className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
              >
                <span className="font-extrabold text-slate-900 dark:text-white block">AP & Telangana</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm block mt-0.5">1907 (RBK)</span>
              </button>
              <button
                type="button"
                onClick={() => handleKisanCall("18004254444")}
                className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
              >
                <span className="font-extrabold text-slate-900 dark:text-white block">Tamil Nadu</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm block mt-0.5">1800-425-4444</span>
              </button>
              <button
                type="button"
                onClick={() => handleKisanCall("18004253553")}
                className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
              >
                <span className="font-extrabold text-slate-900 dark:text-white block">Karnataka</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm block mt-0.5">1800-425-3553</span>
              </button>
              <button
                type="button"
                onClick={() => handleKisanCall("18002334000")}
                className="p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] text-left transition-all cursor-pointer"
              >
                <span className="font-extrabold text-slate-900 dark:text-white block">Maharashtra</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm block mt-0.5">1800-233-4000</span>
              </button>
            </div>
          </div>

          {/* Direct WhatsApp Consultation to Extension Officer */}
          <Button
            variant="outline"
            size="md"
            onClick={handleWhatsAppConsult}
            leftIcon={<MessageCircle className="w-4 h-4 text-emerald-500" />}
            className="w-full justify-center border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-bold"
          >
            Forward Diagnostic Case via WhatsApp to KVK Scientist
          </Button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
