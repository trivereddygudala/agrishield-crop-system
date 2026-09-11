import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * NatureParticles — floating leaf + spore particles background
 * Reused on Login and Register pages for immersive nature atmosphere.
 */

const LEAF_PATH = "M12 2C12 2 20 6 20 14C20 18.4 16.4 22 12 22C7.6 22 4 18.4 4 14C4 6 12 2 12 2Z";
const WHEAT_PATH = "M12 22V10M12 10C12 10 8 8 6 4M12 10C12 10 16 8 18 4M12 10C12 10 8 6 8 2M12 10C12 10 16 6 16 2";
const SPROUT_PATH = "M12 22V14M12 14C12 14 7 12 5 7C8 8 12 10 12 14ZM12 14C12 14 17 12 19 7C16 8 12 10 12 14Z";
const DROP_PATH = "M12 2L19 14C19 17.87 15.87 21 12 21C8.13 21 5 17.87 5 14L12 2Z";

const SHAPES = [LEAF_PATH, WHEAT_PATH, SPROUT_PATH, DROP_PATH, LEAF_PATH, LEAF_PATH];

const COLORS = [
  'rgba(52,211,153,0.18)',   // emerald
  'rgba(20,184,166,0.15)',   // teal
  'rgba(34,197,94,0.13)',    // green
  'rgba(16,185,129,0.20)',   // emerald-500
  'rgba(110,231,183,0.12)',  // emerald-300
  'rgba(6,182,212,0.10)',    // cyan
];

function useParticles(count) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,          // % from left
      startY: 90 + Math.random() * 15, // start below screen
      endY: -15 - Math.random() * 20,  // end above screen
      size: 16 + Math.random() * 28,   // 16–44px
      duration: 8 + Math.random() * 14, // 8–22s
      delay: Math.random() * -18,       // stagger start
      drift: (Math.random() - 0.5) * 8, // horizontal sway %
      rotate: Math.random() * 360,
      rotateDelta: (Math.random() - 0.5) * 180,
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, [count]);
}

const NatureParticles = ({ count = 20, className = '' }) => {
  const particles = useParticles(count);

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: `${p.x}%`, top: `${p.startY}%` }}
          animate={{
            y: [`0px`, `${(p.endY - p.startY) * 12}px`],
            x: [`0%`, `${p.drift}vw`],
            rotate: [p.rotate, p.rotate + p.rotateDelta],
            opacity: [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.1, 0.85, 1],
          }}
        >
          <svg
            width={p.size}
            height={p.size}
            viewBox="0 0 24 24"
            fill={p.color}
            stroke={p.color.replace(/[\d.]+\)$/, '0.6)')}
            strokeWidth="0.8"
          >
            <path d={p.shape} />
          </svg>
        </motion.div>
      ))}

      {/* Subtle floating spore dots */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={`spore-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${80 + Math.random() * 20}%`,
            width: `${3 + Math.random() * 4}px`,
            height: `${3 + Math.random() * 4}px`,
            background: COLORS[i % COLORS.length],
            filter: 'blur(0.5px)',
          }}
          animate={{
            y: [0, -(200 + Math.random() * 400)],
            opacity: [0, 0.6, 0],
            scale: [0.5, 1, 0.2],
          }}
          transition={{
            duration: 5 + Math.random() * 8,
            delay: Math.random() * -15,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

export default NatureParticles;
