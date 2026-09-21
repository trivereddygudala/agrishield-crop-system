import React from 'react';

/**
 * StudioEditableCard
 * Lightweight, clean component wrapper that renders cards in their authentic,
 * handcrafted human design with zero studio overlays or visual builder clutter.
 */
export default function StudioEditableCard({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
