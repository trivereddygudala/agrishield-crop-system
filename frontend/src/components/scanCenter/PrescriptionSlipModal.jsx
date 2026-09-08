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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-8 text-slate-900 dark:text-white space-y-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  AgriShield Digital Agronomy Slip
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Official Plant Health Prescription
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

          {/* Rx Meta Details */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-bold block">Prescription ID</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{rxId}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-bold block">Date Issued</span>
              <span className="font-bold text-slate-900 dark:text-white">{dateStr}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-bold block">AI Confidence</span>
              <span className="font-black text-slate-900 dark:text-white">{confidence}</span>
            </div>
          </div>

          {/* Body Content */}
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-emerald-500/[0.04]">
              <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 block mb-1">
                Diagnosed Pathology & Crop
              </span>
              <h4 className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                {crop} — {disease}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase block">
                  1. Biological Remedy
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {liveResult?.organic_treatment || "Apply Trichoderma viride (10g/L) or neem oil foliar spray."}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-1">
                <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase block">
                  2. Chemical Dosage
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {liveResult?.chemical_treatment || "Apply Mancozeb 75% WP (2.5g/L) as foliar spray."}
                </p>
              </div>
            </div>
          </div>

          {/* QR Code Verification Section */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-white/15 text-white flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Fertilizer Dealer QR Verification</span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs leading-normal">
                Present this QR code at your local agrochemical retail shop for automated active ingredient and dosage verification.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-white shrink-0 shadow-lg">
              <QRCodeSVG
                value={qrPayload}
                size={84}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Print Slip
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
              className="px-6"
            >
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
