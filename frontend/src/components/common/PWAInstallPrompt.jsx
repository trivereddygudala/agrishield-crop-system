import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X, Share2, PlusSquare, Smartphone, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // 2. Check 24-hour snooze
    try {
      const dismissedUntil = localStorage.getItem('agrishield_pwa_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch (_) {}

    // 3. Detect iOS Safari
    const isAppleDevice = typeof navigator !== 'undefined' && (
      /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window).MSStream
    );
    const isSafari = typeof navigator !== 'undefined' && (
      /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS/i.test(navigator.userAgent)
    );

    if (isAppleDevice && isSafari) {
      setIsIOS(true);
      // Delay prompt slightly for great user experience
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }

    // 4. Android & Desktop Chrome/Edge beforeinstallprompt listener
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install banner after 2 seconds
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Installed listener
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSTip(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback instruction
      alert(isTe 
        ? 'మీ బ్రౌజర్ మెను (మూడు చుక్కలు ⋮) తెరిచి "Install app" లేదా "Add to Home screen" క్లిక్ చేయండి.'
        : 'Open your browser menu (⋮) and tap "Install app" or "Add to Home screen".'
      );
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Snooze prompt for 24 hours
    try {
      localStorage.setItem('agrishield_pwa_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
    } catch (_) {}
  };

  if (!isVisible || installed) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ y: 80, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        aria-label={isTe ? 'అగ్రిషీల్డ్ యాప్ ఇన్‌స్టాలేషన్' : 'AgriShield App Installation'}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 pointer-events-auto"
      >
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 border border-emerald-500/40 shadow-2xl shadow-emerald-950/60 backdrop-blur-xl text-white">
          <div className="flex items-start gap-3">
            {/* App Icon */}
            <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/50 bg-slate-900 shadow-md">
              <img 
                src="/icon-192.png" 
                alt="AgriShield App" 
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-700/80 text-white font-black text-xs">
                🌾
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm text-white tracking-tight">
                  {isTe ? 'అగ్రిషీల్డ్ యాప్' : 'AgriShield AI App'}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {isTe ? 'ఉచితం' : 'Free / PWA'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-snug">
                {isTe
                  ? 'మొబైల్ నోటిఫికేషన్ బార్ అలర్ట్‌లు మరియు ఆఫ్‌లైన్ పంట రక్షణ పొందండి.'
                  : 'Get instant alerts in your notification bar and offline crop disease diagnosis.'}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              aria-label={isTe ? 'మూసివేయి' : 'Dismiss'}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* iOS Safari Guided Helper */}
          {showIOSTip && isIOS && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2.5 p-2.5 rounded-xl bg-slate-800/90 border border-emerald-500/30 text-[11px] text-slate-200 space-y-1.5"
            >
              <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Smartphone size={13} />
                <span>{isTe ? 'ఐఫోన్ ఇన్‌స్టాలేషన్ విధానం:' : 'Install on iPhone / iPad:'}</span>
              </p>
              <p className="flex items-center gap-1.5 text-slate-300">
                <span>1.</span>
                <span>{isTe ? 'Safari దిగువన உள்ள షేర్ బటన్' : 'Tap Safari bottom Share button'}</span>
                <Share2 size={13} className="text-emerald-400 inline" />
                <span>{isTe ? 'నొక్కండి.' : ''}</span>
              </p>
              <p className="flex items-center gap-1.5 text-slate-300">
                <span>2.</span>
                <span>{isTe ? '"Add to Home Screen"' : 'Select "Add to Home Screen"'}</span>
                <PlusSquare size={13} className="text-emerald-400 inline" />
                <span>{isTe ? 'ఎంచుకోండి.' : ''}</span>
              </p>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Download size={13} />
              <span>{isTe ? 'యాప్‌ను ఇన్‌స్టాల్ చేయండి' : 'Install App'}</span>
            </button>

            <button
              onClick={handleDismiss}
              className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {isTe ? 'తర్వాత' : 'Later'}
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
