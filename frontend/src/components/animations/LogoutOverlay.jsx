import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LogoutOverlay
 * 
 * Beautiful "field fading to dusk" goodbye animation shown when
 * a farmer logs out. Displays for ~1.8 seconds before calling onDone().
 * 
 * Props:
 *   userName  — farmer's display name
 *   onDone    — callback fired when animation completes (should call logout + navigate)
 */
const LogoutOverlay = ({ userName = 'Farmer', onDone }) => {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase('exit'), 1700);
    const doneTimer = setTimeout(() => onDone?.(), 2200);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase === 'enter' && (
        <motion.div
          key="logout-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: '#030a06' }}
        >
          {/* Warm sunset glow — starts emerald, fades to amber/dark */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6] }}
            transition={{ duration: 1.8, ease: 'easeInOut' }}
            style={{
              background: 'radial-gradient(ellipse 80% 55% at 50% 80%, rgba(251,191,36,0.14) 0%, rgba(16,185,129,0.08) 40%, rgba(3,10,6,1) 75%)',
            }}
          />

          {/* Horizon line — crop field silhouette */}
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
          >
            <svg
              viewBox="0 0 400 80"
              className="w-full"
              preserveAspectRatio="none"
              fill="none"
            >
              {/* Rolling field silhouette */}
              <path
                d="M0 80 L0 55 Q20 45 40 50 Q60 55 80 48 Q100 42 120 46 Q140 50 160 44 Q180 38 200 42 Q220 46 240 40 Q260 34 280 38 Q300 42 320 36 Q340 30 360 34 Q380 38 400 32 L400 80 Z"
                fill="rgba(16,185,129,0.08)"
              />
              {/* Foreground stalks */}
              {Array.from({ length: 18 }, (_, i) => {
                const x = 10 + i * 22;
                const h = 18 + Math.sin(i * 1.3) * 8;
                return (
                  <motion.line
                    key={i}
                    x1={x} y1={80}
                    x2={x + (Math.random() - 0.5) * 3} y2={80 - h}
                    stroke="rgba(52,211,153,0.25)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    initial={{ scaleY: 0, transformOrigin: 'bottom' }}
                    animate={{ scaleY: [0, 1, 0.6] }}
                    transition={{ duration: 1.6, delay: 0.2 + i * 0.03, ease: 'easeOut' }}
                  />
                );
              })}
            </svg>
          </motion.div>

          {/* Sunset disc */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 120,
              height: 120,
              bottom: '15%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, rgba(16,185,129,0.15) 50%, transparent 70%)',
              filter: 'blur(12px)',
            }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0.5], scale: [0.3, 1.4, 1] }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
          />

          {/* Fading wave ring */}
          <motion.div
            className="absolute rounded-full border border-emerald-500/20"
            style={{ width: 60, height: 60, bottom: '28%', left: '50%', transform: 'translate(-50%,-50%)' }}
            animate={{ width: [60, 320], height: [60, 320], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
          />

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center gap-5 text-center px-8">
            {/* Waving hand + sun icon */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.15 }}
              className="text-6xl"
              style={{ filter: 'drop-shadow(0 0 16px rgba(52,211,153,0.5))' }}
            >
              🌅
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <div className="text-2xl font-black text-white tracking-tight">
                Goodbye,{' '}
                <span className="text-emerald-400">{userName}</span>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 }}
                className="text-slate-400 text-sm mt-2 font-medium leading-relaxed"
              >
                Your crops are safe. See you tomorrow 🌾
              </motion.p>
            </motion.div>

            {/* Dimming indicator chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85 }}
              className="flex gap-2"
            >
              {['🔒 Securing session', '📴 Going offline'].map((label, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 0.3] }}
                  transition={{ delay: 0.9 + i * 0.2, duration: 1.2 }}
                  className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400"
                >
                  {label}
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Bottom drain progress */}
          <motion.div
            className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-emerald-600 to-amber-400"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 1.8, ease: 'easeIn' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LogoutOverlay;
