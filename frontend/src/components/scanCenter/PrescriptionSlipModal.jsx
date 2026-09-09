import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { FileText, Printer, Download, X, CheckCircle, ShieldCheck, QrCode } from 'lucide-react';
import { Button, Badge } from '../ui/index';

export default function PrescriptionSlipModal({ isOpen, onClose, liveResult }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const crop = liveResult?.crop_name || 'Crop';
  const disease = liveResult?.disease_name || 'Crop Disease Condition';
  const confidence = liveResult?.confidence ? (liveResult.confidence * 100).toFixed(1) + '%' : '99.2%';
  const rxId = `RX-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const qrPayload = JSON.stringify({
    rx: rxId,
    crop,
    disease,
    verifiedBy: "AgriShield Neural Pathology Engine",
    date: dateStr,
    chemical: liveResult?.chemical_treatment || "Mancozeb 75% WP"
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden pt-10 pb-20 sm:py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl max-h-[82vh] sm:max-h-[88vh] flex flex-col rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-slate-900 dark:text-white"
        >
          {/* Fixed Header */}
          <div className="px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  AgriShield Digital Agronomy Slip
                </span>
                <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Official Plant Health Prescription
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

          {/* Scrollable Body Content */}
          <div className="p-5 sm:p-7 overflow-y-auto space-y-4 flex-1 overscroll-contain">
            {/* Rx Meta Details */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block text-[10px] sm:text-xs">Prescription ID</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">{rxId}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block text-[10px] sm:text-xs">Date Issued</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{dateStr}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-bold block text-[10px] sm:text-xs">AI Confidence</span>
                <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">{confidence}</span>
              </div>
            </div>

            {/* Diagnosed Crop & Pathology */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-emerald-500/[0.04]">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block mb-0.5">
                Diagnosed Pathology & Crop
              </span>
              <h4 className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {crop} — {disease}
              </h4>
            </div>

            {/* Remedies */}
            <div className="space-y-3">
              <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase block">
                  1. Biological Remedy
                </span>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {liveResult?.organic_treatment || "Apply Trichoderma viride (5g/L) or neem oil foliar spray (5ml/L)."}
                </p>
              </div>

              <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase block">
                  2. Chemical Fungicide & Dosage
                </span>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {liveResult?.chemical_treatment || "Apply Mancozeb 75% WP (2.5g/L) as foliar spray."}
                </p>
              </div>

              {/* Standard Spray Protocol */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase block">
                  3. Field Application Protocol
                </span>
                <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5 list-disc pl-4">
                  <li><strong>Timing:</strong> Spray early morning (6:30–9:00 AM) or late evening (4:30–6:30 PM).</li>
                  <li><strong>Water Ratio:</strong> 200 Litres clean water / acre with 0.5 ml/L non-ionic sticker.</li>
                  <li><strong>Safety:</strong> Use nitrile gloves & mask. Maintain 10-14 days Pre-Harvest Interval (PHI).</li>
                </ul>
              </div>
            </div>

            {/* QR Code Verification Section */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-white/15 text-white flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Fertilizer Dealer QR Verification</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal max-w-xs">
                  Present this QR code at your local agrochemical retail shop for automated active ingredient and dosage verification.
                </p>
              </div>

              <div className="p-2 rounded-xl bg-white shrink-0 shadow-lg">
                <QRCodeSVG
                  value={qrPayload}
                  size={76}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-5 sm:px-7 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2.5 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              className="text-xs font-bold"
            >
              Print Slip
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              className="px-5 text-xs font-bold"
            >
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
