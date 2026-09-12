import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, ScanFace, CheckCircle2, ShieldCheck, ArrowRight, X, Sparkles, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * FarmerBiometricModal
 * 
 * An ultra-intuitive, farmer-friendly visual biometric scanner and enrollment modal.
 * Guides rural farmers through the Android/Google passkey prompt with clear visual cues:
 * 1. Shows that tapping "Continue" on the Google sheet triggers the physical sensor.
 * 2. Visualizes the real-time fingerprint laser scan.
 * 3. Shows the cryptographic SHA-256 digital hash conversion and cloud cross-device sync.
 */
export default function FarmerBiometricModal({
  isOpen,
  onClose,
  mode = 'enroll', // 'enroll' | 'login'
  accountName = '',
  onStartScan,
  isScanning = false,
  errorMsg = '',
  successData = null, // { digital_key, biometric_hash, device_name }
  onSuccessDone
}) {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#041008] border border-emerald-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_60px_rgba(16,185,129,0.25)] text-white z-10 overflow-hidden select-none"
        >
          {/* Top glow accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
          
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ── STATE 1: SUCCESS VIEW ── */}
          {successData ? (
            <div className="text-center py-4 space-y-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.4)]"
              >
                <CheckCircle2 className="w-10 h-10" />
              </motion.div>

              <div>
                <h3 className="text-xl font-black text-white">
                  {isTe ? "వేలిముద్ర నమోదు విజయవంతమైంది!" : "Biometric Registered Successfully!"}
                </h3>
                <p className="text-xs text-emerald-300 font-bold mt-1">
                  {isTe ? "డిజిటల్ హాష్ రూపంలో ఖాతాలో భద్రపరచబడింది" : "Digitally Hashed & Linked to Your Cloud Account"}
                </p>
              </div>

              {/* Digital Hash Format Badge */}
              <div className="p-3.5 bg-emerald-950/50 border border-emerald-500/30 rounded-2xl text-left space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <KeyRound className="w-3.5 h-3.5" />
                    {isTe ? "డిజిటల్ కీ ఫార్మాట్:" : "Digital Key ID:"}
                  </span>
                  <span className="font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-black text-[10px]">
                    SHA-256
                  </span>
                </div>
                <div className="font-mono text-xs text-white font-bold bg-black/40 p-2 rounded-xl border border-white/5 break-all">
                  {successData.digital_key || `BIO-SHA256-${(successData.biometric_hash || '78AF902C').slice(0, 12).toUpperCase()}`}
                </div>
                <p className="text-[10px] text-slate-400">
                  {isTe
                    ? "ఈ డిజిటల్ కీ మీ గూగుల్ అకౌంట్ మరియు అగ్రిషీల్డ్ సర్వర్‌లో సురక్షితంగా ఉంటుంది. ఇతర పరికరాల్లో కూడా పని చేస్తుంది."
                    : "This digital passkey syncs with Google & AgriShield cloud, allowing 1-tap sign-in across your devices."}
                </p>
              </div>

              <button
                type="button"
                onClick={onSuccessDone || onClose}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-98 transition-all"
              >
                {isTe ? "పూర్తయింది (Continue)" : "Done & Ready for 1-Tap Sign-In"}
              </button>
            </div>
          ) : (

            /* ── STATE 2: ENROLLMENT & GUIDANCE VIEW ── */
            <div className="space-y-5 pt-2">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3" />
                  {isTe ? "రైతు బయోమెట్రిక్ గైడ్" : "Farmer Biometric Guide"}
                </div>
                <h3 className="text-xl font-black text-white">
                  {mode === 'login'
                    ? (isTe ? "ఖాతా వేలిముద్రతో లాగిన్" : "Sign In with Biometrics")
                    : (isTe ? "వేలిముద్ర లేదా ఫేస్ ఐడీ నమోదు" : "Register Fingerprint / Face ID")}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {accountName ? `${accountName} • ` : ''}
                  {isTe 
                    ? "పాస్‌వర్డ్ అవసరం లేకుండా 1-ట్యాప్‌తో వేగంగా లాగిన్ అవ్వండి"
                    : "Instant 1-tap account access with hardware fingerprint or Face ID"}
                </p>
              </div>

              {/* Central Glowing Scanner Visual */}
              <div className="relative py-4 flex flex-col items-center justify-center">
                {/* Radar Rings */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full border border-emerald-500/20"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full border border-teal-400/30"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0.2, 0.8] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', delay: 0.3 }}
                  />
                  
                  {/* Scanner Circle */}
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden transition-all ${
                    isScanning
                      ? 'bg-emerald-500/25 border-2 border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.5)]'
                      : 'bg-emerald-950/50 border border-emerald-500/40'
                  }`}>
                    <Fingerprint className={`w-11 h-11 transition-transform ${
                      isScanning ? 'text-emerald-300 scale-110' : 'text-emerald-400'
                    }`} />

                    {/* Animated Scanning Laser Line */}
                    {isScanning && (
                      <motion.div
                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_10px_#34d399]"
                        animate={{ y: [-40, 40, -40] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                      />
                    )}
                  </div>
                </div>

                <div className="text-center mt-2">
                  <p className="text-xs font-black text-emerald-400">
                    {isScanning
                      ? (isTe ? "సెన్సార్ పరిశీలిస్తోంది..." : "Waiting for Sensor Touch...")
                      : (isTe ? "సెన్సార్ తాకడానికి సిద్ధం" : "Ready to Scan")}
                  </p>
                </div>
              </div>

              {/* ── FARMER STEP-BY-STEP EXPLANATION ── */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3.5 space-y-2.5 text-left">
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  {isTe ? "ఇది ఎలా పని చేస్తుంది? (సులభమైన 2 దశలు)" : "How It Works (2 Simple Steps):"}
                </p>

                {/* Step 1 */}
                <div className="flex items-start gap-2.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="leading-snug">
                    <p className="font-bold text-white">
                      {isTe ? "గూగుల్ బాక్స్ వచ్చినప్పుడు 'Continue' నొక్కండి" : "Google Popup: Tap 'Continue'"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isTe
                        ? "ఫోన్ కింద గూగుల్ బాక్స్ కనిపించినప్పుడు నీలం రంగు [Continue] బటన్ నొక్కండి."
                        : "When Google displays 'Create a passkey', tap the blue 'Continue' button."}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-2.5 text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="leading-snug">
                    <p className="font-bold text-white">
                      {isTe ? "మీ ఫోన్ వేలిముద్ర సెన్సార్‌పై వేలిని తాకండి" : "Touch Your Fingerprint Sensor"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isTe
                        ? "ఫోన్ వెనుక లేదా స్క్రీన్‌పై ఉన్న ఫింగర్‌ప్రింట్ సెన్సార్‌పై మీ వేలిని ఉంచండి. అది వెంటనే స్కాన్ అవుతుంది!"
                        : "Place your thumb or finger on your phone's fingerprint reader."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error display if any */}
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2"
                >
                  <span>⚠️</span>
                  <span>{errorMsg}</span>
                </motion.div>
              )}

              {/* Main CTA Button */}
              <button
                type="button"
                disabled={isScanning}
                onClick={onStartScan}
                className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:brightness-110 text-slate-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.35)] active:scale-98 transition-all disabled:opacity-60"
              >
                {isScanning ? (
                  <>
                    <ScanFace className="w-5 h-5 animate-spin" />
                    <span>{isTe ? "స్కాన్ కోసం వేచి ఉంది..." : "Waiting for Fingerprint Touch..."}</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    <span>
                      {mode === 'login'
                        ? (isTe ? "వేలిముద్రతో లాగిన్ అవ్వండి" : "Touch Sensor to Sign In")
                        : (isTe ? "సెన్సార్ తాకి వేలిముద్ర నమోదు చేయండి" : "Start Fingerprint Scan")}
                    </span>
                  </>
                )}
              </button>

              {/* Safety guarantee */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {isTe
                    ? "మీ వేలిముద్ర ఎల్లప్పుడూ మీ ఫోన్‌లో సురక్షితంగా ఉంటుంది • అగ్రిషీల్డ్ ఎన్‌క్రిప్టెడ్ డిజిటల్ కీని మాత్రమే నిల్వ చేస్తుంది."
                    : "Encrypted SHA-256 Digital Hash • Hardware TPM Secure Enclave"}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
