import React from 'react';

/**
 * AgriShieldWatermark
 * Renders a subtle, transparent vector watermark of the AgriShield AI dual-leaf shield emblem.
 */
const AgriShieldWatermark = ({ className = "w-80 h-80 opacity-[0.07] dark:opacity-[0.10] text-emerald-600 dark:text-emerald-400" }) => {
  return (
    <svg 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`${className} transition-opacity duration-300 pointer-events-none select-none`}
      aria-hidden="true"
    >
      {/* Outer Protective Shield */}
      <path 
        d="M100 16 C145 16 182 32 182 74 C182 134 140 172 100 190 C60 172 18 134 18 74 C18 32 55 16 100 16 Z" 
        stroke="currentColor" 
        strokeWidth="7" 
        strokeLinejoin="round"
        fill="currentColor" 
        fillOpacity="0.06"
      />
      {/* Inner Decorative Contour */}
      <path 
        d="M100 26 C138 26 170 40 170 76 C170 128 134 162 100 178 C66 162 30 128 30 76 C30 40 62 26 100 26 Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeDasharray="4 4"
        fill="none" 
        opacity="0.5"
      />
      {/* Left Leaflet */}
      <path 
        d="M100 145 C100 115 78 86 52 76 C72 102 82 126 100 145 Z" 
        fill="currentColor" 
        fillOpacity="0.45"
      />
      {/* Central Majestic Sprout Leaf */}
      <path 
        d="M100 145 C100 102 122 62 152 46 C152 88 132 120 100 145 Z" 
        fill="currentColor" 
        fillOpacity="0.65"
      />
      {/* Base Stem Root */}
      <path 
        d="M100 145 L100 162" 
        stroke="currentColor" 
        strokeWidth="6" 
        strokeLinecap="round"
      />
    </svg>
  );
};

export default AgriShieldWatermark;
