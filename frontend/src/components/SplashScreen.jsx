import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AgriShield Boot Splash Screen
 * - Shows once per browser session (sessionStorage flag)
 * - Animates: logo icon → brand text → tagline → loader dots
 * - Fades out smoothly after 2.6 seconds, then calls onDone()
 */
const SplashScreen = ({ onDone }) => {
  const [phase, setPhase] = useState('visible'); // 'visible' | 'exit'

  useEffect(() => {
    // Phase 1: start fade-out at 2.4s
    const exitTimer = setTimeout(() => setPhase('exit'), 2400);
    // Phase 2: fully done at 3.0s (exit animation is 600ms)
    const doneTimer = setTimeout(() => onDone(), 3000);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase === 'visible' && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050911]"
        >
          {/* Radial glow behind logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <div className="relative flex flex-col items-center gap-5">

            {/* Animated Leaf Logo Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
              className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.5)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-10 h-10"
              >
                <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
                <path d="M2 22 C2 22 8 16 12 12" />
              </svg>
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
              className="flex items-baseline gap-1.5"
            >
              <span className="text-4xl font-black text-white tracking-tight">
                AgriShield
              </span>
              <span className="text-2xl font-light text-emerald-400 tracking-tight">
                AI
              </span>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="text-sm text-slate-400 font-medium tracking-wide"
            >
              Smart Farming · Disease Detection · IoT
            </motion.p>

            {/* Bouncing dot loader */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="flex items-center gap-2 mt-4"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    duration: 0.7,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </motion.div>

          </div>

          {/* Bottom version text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-10 text-[11px] text-slate-600 tracking-widest uppercase"
          >
            Precision Agriculture Engine · v1.0.0
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
