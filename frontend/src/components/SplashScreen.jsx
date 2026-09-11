import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AgriShield Boot Splash Screen — Cinematic 4-Second Nature + Scan Experience
 *
 * Phase Timeline:
 *   0.0 – 0.8s  → Crop field silhouette rises from bottom (farmland horizon)
 *   0.8 – 1.6s  → Sunrise radial glow blooms (amber → emerald)
 *   1.6 – 2.2s  → Full-screen emerald scan line sweeps top → bottom
 *   2.2 – 3.0s  → AgriShield logo springs in + brand name types in
 *   3.0 – 3.6s  → Three scan rings pulse outward from logo
 *   3.6 – 4.0s  → Smooth fade-out → onDone()
 */

const TAGLINE_WORDS = ['Smart Farming', '·', 'Disease Detection', '·', 'IoT'];

const SplashScreen = ({ onDone }) => {
  const [phase, setPhase] = useState('field');   // field | sunrise | scan | logo | rings | exit
  const [typedBrand, setTypedBrand] = useState('');
  const fullBrand = 'AgriShield';

  // Phase sequencer
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('sunrise'), 800),
      setTimeout(() => setPhase('scan'),    1600),
      setTimeout(() => setPhase('logo'),    2200),
      setTimeout(() => setPhase('rings'),   3000),
      setTimeout(() => setPhase('exit'),    3600),
      setTimeout(() => onDone?.(),          4100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  // Brand name typewriter starts at logo phase
  useEffect(() => {
    if (phase !== 'logo') return;
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTypedBrand(fullBrand.slice(0, idx));
      if (idx >= fullBrand.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [phase]);

  const showField    = ['field','sunrise','scan','logo','rings'].includes(phase);
  const showSunrise  = ['sunrise','scan','logo','rings'].includes(phase);
  const showScanLine = phase === 'scan';
  const showLogo     = ['logo','rings'].includes(phase);
  const showRings    = phase === 'rings';

  return (
    <AnimatePresence>
      {phase !== 'exit' && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#020906] overflow-hidden"
        >
          {/* ────── Background deep green → black gradient ────── */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 80% 80% at 50% 100%, rgba(5,30,14,1) 0%, rgba(2,9,6,1) 100%)',
            }}
          />

          {/* ────── Phase 1: Crop Field Silhouette ────── */}
          <AnimatePresence>
            {showField && (
              <motion.div
                key="field"
                className="absolute bottom-0 left-0 right-0"
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              >
                <svg
                  viewBox="0 0 800 160"
                  className="w-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {/* Far field hills */}
                  <path
                    d="M0 160 L0 100 Q100 75 200 90 Q300 105 400 80 Q500 55 600 72 Q700 88 800 65 L800 160 Z"
                    fill="rgba(16,185,129,0.06)"
                  />
                  {/* Mid-ground ridge */}
                  <path
                    d="M0 160 L0 120 Q50 108 100 115 Q150 122 200 112 Q250 102 300 108 Q350 114 400 104 Q450 94 500 100 Q550 106 600 96 Q650 86 700 92 Q750 98 800 88 L800 160 Z"
                    fill="rgba(16,185,129,0.10)"
                  />
                  {/* Foreground earth band */}
                  <path
                    d="M0 160 L0 138 Q200 130 400 135 Q600 140 800 132 L800 160 Z"
                    fill="rgba(16,185,129,0.16)"
                  />
                  {/* Wheat/crop stalks */}
                  {Array.from({ length: 30 }, (_, i) => {
                    const x = 10 + i * 27;
                    const h = 22 + Math.sin(i * 1.7) * 10;
                    const sway = (i % 2 === 0 ? 3 : -3);
                    return (
                      <motion.g key={i}>
                        <motion.line
                          x1={x} y1={160}
                          x2={x + sway} y2={160 - h}
                          stroke="rgba(52,211,153,0.35)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          style={{ transformOrigin: `${x}px 160px` }}
                          transition={{ duration: 0.7, delay: 0.05 + i * 0.02, ease: 'easeOut' }}
                        />
                        {/* grain head */}
                        <motion.ellipse
                          cx={x + sway}
                          cy={160 - h}
                          rx="2.5"
                          ry="4"
                          fill="rgba(52,211,153,0.3)"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          style={{ transformOrigin: `${x + sway}px ${160 - h}px` }}
                          transition={{ duration: 0.4, delay: 0.4 + i * 0.02 }}
                        />
                      </motion.g>
                    );
                  })}
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ────── Phase 2: Sunrise Radial Glow ────── */}
          <AnimatePresence>
            {showSunrise && (
              <motion.div
                key="sunrise"
                className="absolute"
                style={{
                  bottom: '12%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 600,
                  height: 300,
                  borderRadius: '50%',
                  filter: 'blur(40px)',
                }}
                initial={{ opacity: 0, scaleX: 0.2, scaleY: 0.2 }}
                animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(ellipse at 50% 100%, rgba(251,191,36,0.22) 0%, rgba(16,185,129,0.25) 35%, transparent 70%)',
                    borderRadius: '50%',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ────── Phase 3: Scan Line Sweep ────── */}
          <AnimatePresence>
            {showScanLine && (
              <motion.div
                key="scanline"
                className="absolute left-0 right-0 pointer-events-none"
                style={{ height: 3 }}
                initial={{ top: '-2%' }}
                animate={{ top: '102%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: 'linear' }}
              >
                {/* Main scan beam */}
                <div
                  style={{
                    height: '100%',
                    background: 'linear-gradient(to right, transparent, rgba(52,211,153,0.9) 40%, rgba(20,184,166,1) 50%, rgba(52,211,153,0.9) 60%, transparent)',
                    boxShadow: '0 0 20px 6px rgba(52,211,153,0.5)',
                  }}
                />
                {/* Trailing glow beneath */}
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: 0,
                    right: 0,
                    height: 60,
                    background: 'linear-gradient(to bottom, rgba(52,211,153,0.12), transparent)',
                    pointerEvents: 'none',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ────── Phase 4 & 5: Logo + Brand + Rings ────── */}
          <AnimatePresence>
            {showLogo && (
              <motion.div
                key="logo-section"
                initial={{ opacity: 0, scale: 0.6, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="relative flex flex-col items-center gap-5 z-10"
              >
                {/* Scan rings that pulse outward */}
                {showRings && [0, 1, 2].map((i) => (
                  <motion.div
                    key={`ring-${i}`}
                    className="absolute rounded-full border border-emerald-400/25"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
                    initial={{ width: 80, height: 80, opacity: 0.8 }}
                    animate={{ width: 320 + i * 60, height: 320 + i * 60, opacity: 0 }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.22 }}
                  />
                ))}

                {/* Logo Icon */}
                <motion.div
                  className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center relative"
                  style={{ boxShadow: '0 0 60px rgba(52,211,153,0.65), 0 0 120px rgba(52,211,153,0.2)' }}
                  animate={showRings ? { boxShadow: ['0 0 60px rgba(52,211,153,0.65)', '0 0 90px rgba(52,211,153,1)', '0 0 60px rgba(52,211,153,0.65)'] } : {}}
                  transition={{ duration: 1, repeat: 1, ease: 'easeInOut' }}
                >
                  {/* Scan line inside logo */}
                  <motion.div
                    className="absolute left-0 right-0 h-[2px] bg-white/50 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    animate={{ y: [0, 80, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ top: 0 }}
                  />
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-12 h-12 relative z-10"
                  >
                    <path d="M2 22 C2 22 7 17 12 12 C17 7 22 2 22 2 C22 2 22 9 18 14 C14 19 7 22 2 22 Z" />
                    <path d="M2 22 C2 22 8 16 12 12" />
                  </svg>
                </motion.div>

                {/* Brand name typewriter */}
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white tracking-tight">
                    {typedBrand}
                    {typedBrand.length < fullBrand.length && (
                      <motion.span
                        className="inline-block w-[3px] h-8 bg-emerald-400 ml-1 align-middle"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.4, repeat: Infinity }}
                      />
                    )}
                  </span>
                  <motion.span
                    className="text-2xl font-light text-emerald-400 tracking-tight"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: typedBrand.length >= fullBrand.length ? 1 : 0, x: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    AI
                  </motion.span>
                </div>

                {/* Tagline */}
                <motion.div
                  className="flex items-center gap-1.5 flex-wrap justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {TAGLINE_WORDS.map((word, i) => (
                    <motion.span
                      key={i}
                      className={`text-sm font-medium ${word === '·' ? 'text-emerald-600' : 'text-slate-400'}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.div>

                {/* Bouncing dot loader */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-2 mt-1"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom version */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: showLogo ? 1 : 0 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-8 text-[11px] text-slate-600 tracking-widest uppercase"
          >
            Precision Agriculture Engine · v1.0.0
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
