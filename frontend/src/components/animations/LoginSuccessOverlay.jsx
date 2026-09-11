import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LoginSuccessOverlay
 * 
 * Full-screen cinematic "scan success" animation shown for ~2.2 seconds
 * after a successful login, before navigating to the dashboard.
 * 
 * Props:
 *   userName  — farmer's display name (string)
 *   onDone    — callback fired when animation completes
 */
const LoginSuccessOverlay = ({ userName = 'Farmer', onDone }) => {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'exit'
  const [typedText, setTypedText] = useState('');
  const fullText = 'Field AI Connected';

  // Typewriter effect
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTypedText(fullText.slice(0, idx));
      if (idx >= fullText.length) clearInterval(interval);
    }, 55);
    return () => clearInterval(interval);
  }, []);

  // Exit phase
  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase('exit'), 2000);
    const doneTimer = setTimeout(() => onDone?.(), 2500);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase === 'enter' && (
        <motion.div
          key="login-success"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030a06] overflow-hidden"
        >
          {/* Deep green radial glow backdrop */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(16,185,129,0.18) 0%, rgba(3,10,6,1) 70%)',
            }}
          />

          {/* Scan ring 1 — slow pulse */}
          <motion.div
            className="absolute rounded-full border border-emerald-500/20"
            initial={{ width: 80, height: 80, opacity: 0.8 }}
            animate={{ width: 420, height: 420, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0 }}
            style={{ position: 'absolute' }}
          />

          {/* Scan ring 2 */}
          <motion.div
            className="absolute rounded-full border border-emerald-400/25"
            initial={{ width: 80, height: 80, opacity: 0.7 }}
            animate={{ width: 350, height: 350, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            style={{ position: 'absolute' }}
          />

          {/* Scan ring 3 */}
          <motion.div
            className="absolute rounded-full border border-teal-400/20"
            initial={{ width: 80, height: 80, opacity: 0.6 }}
            animate={{ width: 280, height: 280, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
            style={{ position: 'absolute' }}
          />

          {/* Central icon cluster */}
          <div className="relative flex flex-col items-center gap-6 z-10">
            {/* Leaf icon with glow */}
            <motion.div
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.1 }}
              className="relative"
            >
              {/* Outer glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{ boxShadow: ['0 0 0px rgba(52,211,153,0)', '0 0 60px rgba(52,211,153,0.6)', '0 0 0px rgba(52,211,153,0)'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ borderRadius: '50%', width: '100%', height: '100%' }}
              />
              <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_0_60px_rgba(52,211,153,0.7)]">
                {/* Checkmark that draws itself */}
                <motion.svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-12 h-12"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
                >
                  <motion.path
                    d="M20 6L9 17L4 12"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
                  />
                </motion.svg>
              </div>
            </motion.div>

            {/* Typewriter headline */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center"
            >
              <div className="text-2xl font-black text-white tracking-tight">
                {typedText}
                <motion.span
                  className="inline-block w-[2px] h-6 bg-emerald-400 ml-1 align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
                {' '}
                <span className="text-emerald-400">🌾</span>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-slate-400 text-sm mt-2 font-medium"
              >
                Welcome back, <span className="text-emerald-400 font-bold">{userName}</span>
              </motion.p>
            </motion.div>

            {/* Animated scan status chips */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex gap-3"
            >
              {['🛡️ Secure', '🌿 Farm Sync', '📡 AI Online'].map((label, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + i * 0.15 }}
                  className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400"
                >
                  {label}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Bottom progress bar */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-600 via-teal-400 to-emerald-600"
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2.0, ease: 'linear' }}
          />

          {/* Subtle scan line sweep */}
          <motion.div
            className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent pointer-events-none"
            animate={{ y: ['-50vh', '150vh'] }}
            transition={{ duration: 1.6, ease: 'linear', repeat: 1 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginSuccessOverlay;
