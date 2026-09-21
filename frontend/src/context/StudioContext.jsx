import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

const StudioContext = createContext(null);

const STORAGE_KEY = 'agrishield_studio_state_v2';

// Default card sequences for each key page / diagnostic tab
export const DEFAULT_CARD_ORDERS = {
  'disease-diag': [
    { key: 'hybrid_hero', label: '50/50 Hybrid AI-Agronomist Hero & Status', visible: true },
    { key: 'symptoms_severity', label: 'Pathology Symptoms & Severity Index', visible: true },
    { key: 'chemical_rx', label: 'Clinical Chemical Treatment & 1L Dilution', visible: true },
    { key: 'organic_rx', label: 'Organic Remedies & Biological Controls', visible: true },
    { key: 'pathology_photos', label: 'Dataset Visual Comparison & Reference Photos', visible: true },
    { key: 'action_bar', label: 'Action Toolbar & Prescription Download', visible: true }
  ],
  'plant-id': [
    { key: 'specimen_hero', label: 'Botanical Specimen Hero & Confidence', visible: true },
    { key: 'taxonomy_morphology', label: 'Taxonomy, Genus & Foliage Morphology', visible: true },
    { key: 'agronomic_advisory', label: 'Agronomic Care & Cultivation Matrix', visible: true },
    { key: 'soil_nutrition', label: 'Soil Fertility & Balanced NPK Formulation', visible: true },
    { key: 'disease_pest', label: 'Vulnerable Diseases & Target Pests', visible: true }
  ],
  'agro-scan': [
    { key: 'agro_hero', label: 'Chemical Identification Hero', visible: true },
    { key: 'product_details', label: 'Product Details & Classification', visible: true },
    { key: 'application_guide', label: 'User Instructions & Dilution Guide', visible: true },
    { key: 'mode_of_action', label: 'Utility, Benefits & Action Mode', visible: true }
  ],
  'dashboard': [
    { key: 'stats_overview', label: 'Active Farm Health & Quick Metrics', visible: true },
    { key: 'farm_alert_banner', label: 'Real-Time Agronomic Advisory Banner', visible: true },
    { key: 'quick_actions', label: 'Quick Diagnostic Scan Launchers', visible: true },
    { key: 'sensor_telemetry', label: 'IoT Sensor Node Telemetry & Moisture', visible: true },
    { key: 'recent_history', label: 'Recent Diagnostic Records & Prescriptions', visible: true }
  ],
  'landing': [
    { key: 'landing-hero', label: 'Main Hero & Headline Banner', visible: true },
    { key: 'landing-stats', label: 'Platform Statistics & Impact Counters', visible: true },
    { key: 'landing-feat-scan', label: 'Feature 1: Real-Time AI Disease Diagnosis', visible: true },
    { key: 'landing-feat-farm', label: 'Feature 2: Agronomic Lifecycle & Sectors', visible: true },
    { key: 'landing-feat-iot', label: 'Feature 3: ESP32 IoT Edge Telemetry', visible: true },
    { key: 'landing-feat-ai', label: 'Feature 4: AI Voice Crop Doctor & Chat', visible: true },
    { key: 'landing-mission', label: 'Architecture & Farm Protection Mission', visible: true },
    { key: 'landing-cta', label: 'Get Started & Sign In / Register Action', visible: true }
  ]
};

export const STUDIO_GRADIENTS = {
  'emerald-mesh': {
    id: 'emerald-mesh',
    name: 'Emerald Matrix',
    classes: 'bg-gradient-to-br from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-500/40 text-white shadow-xl',
    accentColor: '#10b981',
    pillColor: 'bg-emerald-500'
  },
  'royal-indigo': {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    classes: 'bg-gradient-to-br from-indigo-950/90 via-slate-900 to-purple-950/90 border border-indigo-500/40 text-white shadow-xl',
    accentColor: '#6366f1',
    pillColor: 'bg-indigo-500'
  },
  'cyber-cyan': {
    id: 'cyber-cyan',
    name: 'Cyber Cyan',
    classes: 'bg-gradient-to-br from-cyan-950/90 via-slate-900 to-blue-950/90 border border-cyan-500/40 text-white shadow-xl',
    accentColor: '#06b6d4',
    pillColor: 'bg-cyan-500'
  },
  'sunset-rose': {
    id: 'sunset-rose',
    name: 'Sunset Rose',
    classes: 'bg-gradient-to-br from-rose-950/90 via-slate-900 to-amber-950/90 border border-rose-500/40 text-white shadow-xl',
    accentColor: '#f43f5e',
    pillColor: 'bg-rose-500'
  },
  'golden-amber': {
    id: 'golden-amber',
    name: 'Golden Harvest',
    classes: 'bg-gradient-to-br from-amber-950/90 via-slate-900 to-yellow-950/90 border border-amber-500/40 text-white shadow-xl',
    accentColor: '#f59e0b',
    pillColor: 'bg-amber-500'
  },
  'neon-purple': {
    id: 'neon-purple',
    name: 'Neon Violet',
    classes: 'bg-gradient-to-br from-purple-950/90 via-slate-900 to-fuchsia-950/90 border border-purple-500/40 text-white shadow-xl',
    accentColor: '#a855f7',
    pillColor: 'bg-purple-500'
  },
  'obsidian-glass': {
    id: 'obsidian-glass',
    name: 'Obsidian Glass',
    classes: 'bg-slate-900/85 backdrop-blur-xl border border-slate-700/80 text-white shadow-2xl',
    accentColor: '#64748b',
    pillColor: 'bg-slate-600'
  },
  'frosted-light': {
    id: 'frosted-light',
    name: 'Frosted Crystal',
    classes: 'bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg',
    accentColor: '#e2e8f0',
    pillColor: 'bg-white'
  }
};

export const STUDIO_BORDERS = {
  'rounded-none': { id: 'rounded-none', name: 'Sharp Box (0px)', class: 'rounded-none' },
  'rounded-xl': { id: 'rounded-xl', name: 'Standard (12px)', class: 'rounded-xl' },
  'rounded-2xl': { id: 'rounded-2xl', name: 'Modern (16px)', class: 'rounded-2xl' },
  'rounded-3xl': { id: 'rounded-3xl', name: 'Ultra Pill (24px)', class: 'rounded-3xl' }
};

export const STUDIO_GLOWS = {
  'none': { id: 'none', name: 'No Glow', class: '' },
  'emerald': { id: 'emerald', name: 'Emerald Neon', class: 'ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/30' },
  'cyan': { id: 'cyan', name: 'Cyan Neon', class: 'ring-2 ring-cyan-400/60 shadow-lg shadow-cyan-500/30' },
  'rose': { id: 'rose', name: 'Rose Neon', class: 'ring-2 ring-rose-400/60 shadow-lg shadow-rose-500/30' },
  'purple': { id: 'purple', name: 'Purple Neon', class: 'ring-2 ring-purple-400/60 shadow-lg shadow-purple-500/30' },
  'amber': { id: 'amber', name: 'Amber Neon', class: 'ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/30' }
};

export const STUDIO_PADDINGS = {
  'compact': { id: 'compact', name: 'Compact Padding', class: 'p-3 sm:p-4' },
  'normal': { id: 'normal', name: 'Normal Padding', class: 'p-5 sm:p-6' },
  'spacious': { id: 'spacious', name: 'Spacious Padding', class: 'p-7 sm:p-9' }
};

export const STUDIO_SCALES = {
  'compact': { id: 'compact', name: 'Compact (95%)', class: 'scale-[0.96]' },
  'normal': { id: 'normal', name: 'Standard (100%)', class: 'scale-100' },
  'expanded': { id: 'expanded', name: 'Prominent (104%)', class: 'scale-[1.03]' }
};

export const DEFAULT_EFFECTS_CONFIG = {
  spotlightDim: true,
  slidingEffects: true,
  cardGlow: true,
  microTilt: true,
  glowIntensity: 75,
  animationSpeed: 'normal' // 'snappy' | 'normal' | 'smooth'
};

export const DEFAULT_AGRONOMIST_PROFILE = {
  name: 'Prof. Dr. K. Ramesh, Ph.D.',
  title: 'Senior Clinical Agronomist & Plant Pathologist',
  institution: 'State Agricultural University & ICAR-KVK Advisory Board',
  certId: 'ICAR-AP-AGR-2026-8841',
  date: new Date().toISOString().split('T')[0],
  isCertified: true,
  notes: 'Prescription verified with field micro-climate validation. Dilution strictly calibrated per 1 Litre of water to prevent crop phytotoxicity.'
};

export const StudioProvider = ({ children }) => {
  // Load initial state from LocalStorage or fall back to defaults
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          cardOrders: { ...DEFAULT_CARD_ORDERS, ...(parsed.cardOrders || {}) },
          cardOverrides: parsed.cardOverrides || {},
          cardStyles: parsed.cardStyles || {},
          effectsConfig: { ...DEFAULT_EFFECTS_CONFIG, ...(parsed.effectsConfig || {}) },
          agronomistProfile: { ...DEFAULT_AGRONOMIST_PROFILE, ...(parsed.agronomistProfile || {}) }
        };
      }
    } catch (e) {
      console.warn('Could not load studio state from localStorage:', e);
    }
    return {
      cardOrders: DEFAULT_CARD_ORDERS,
      cardOverrides: {},
      cardStyles: {},
      effectsConfig: DEFAULT_EFFECTS_CONFIG,
      agronomistProfile: DEFAULT_AGRONOMIST_PROFILE
    };
  });

  // Visual in-place touch/click editing mode permanently disabled per user requirements
  const isVisualEditMode = false;
  const setIsVisualEditMode = useCallback(() => {}, []);
  const [activeCardKey, setActiveCardKey] = useState(null);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'

  // Drawer state permanently closed
  const isDrawerOpen = false;
  const [activeDrawerTab, setActiveDrawerTab] = useState('editor');
  const [activePageTab, setActivePageTab] = useState('disease-diag');
  const [focusedCardKey, setFocusedCardKey] = useState(null);

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save studio state:', e);
    }
  }, [state]);

  // Visual Card Styling API
  const updateCardStyle = useCallback((cardKey, partialStyle) => {
    setState(prev => ({
      ...prev,
      cardStyles: {
        ...prev.cardStyles,
        [cardKey]: {
          ...(prev.cardStyles?.[cardKey] || {}),
          ...partialStyle
        }
      }
    }));
  }, []);

  const resetCardStyle = useCallback((cardKey) => {
    setState(prev => {
      const updated = { ...(prev.cardStyles || {}) };
      delete updated[cardKey];
      return {
        ...prev,
        cardStyles: updated
      };
    });
  }, []);

  const resetAllCardStyles = useCallback(() => {
    setState(prev => ({
      ...prev,
      cardStyles: {}
    }));
  }, []);

  const toggleCardHidden = useCallback((cardKey) => {
    setState(prev => {
      const current = prev.cardStyles?.[cardKey]?.isHidden || false;
      return {
        ...prev,
        cardStyles: {
          ...prev.cardStyles,
          [cardKey]: {
            ...(prev.cardStyles?.[cardKey] || {}),
            isHidden: !current
          }
        }
      };
    });
  }, []);

  const getCardStyle = useCallback((cardKey) => {
    return state.cardStyles?.[cardKey] || {};
  }, [state.cardStyles]);

  // Open drawer disabled permanently
  const openDrawer = useCallback(() => {}, []);
  const closeDrawer = useCallback(() => {}, []);

  // Card Reordering Logic
  const moveCard = useCallback((tabId, cardKey, direction) => {
    setState(prev => {
      const currentList = prev.cardOrders[tabId] || DEFAULT_CARD_ORDERS[tabId] || [];
      const idx = currentList.findIndex(c => c.key === cardKey);
      if (idx === -1) return prev;

      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= currentList.length) return prev;

      const updated = [...currentList];
      const [moved] = updated.splice(idx, 1);
      updated.splice(newIdx, 0, moved);

      return {
        ...prev,
        cardOrders: {
          ...prev.cardOrders,
          [tabId]: updated
        }
      };
    });
  }, []);

  const toggleCardVisibility = useCallback((tabId, cardKey) => {
    setState(prev => {
      const currentList = prev.cardOrders[tabId] || DEFAULT_CARD_ORDERS[tabId] || [];
      const updated = currentList.map(c => {
        if (c.key === cardKey) {
          return { ...c, visible: !c.visible };
        }
        return c;
      });

      return {
        ...prev,
        cardOrders: {
          ...prev.cardOrders,
          [tabId]: updated
        }
      };
    });
  }, []);

  const resetTabOrder = useCallback((tabId) => {
    setState(prev => ({
      ...prev,
      cardOrders: {
        ...prev.cardOrders,
        [tabId]: DEFAULT_CARD_ORDERS[tabId] || []
      }
    }));
  }, []);

  // Card Content Overrides (50% AI + 50% Human Live Editor)
  const setCardOverride = useCallback((tabId, fieldKey, value) => {
    setState(prev => {
      const tabOverrides = prev.cardOverrides[tabId] || {};
      return {
        ...prev,
        cardOverrides: {
          ...prev.cardOverrides,
          [tabId]: {
            ...tabOverrides,
            [fieldKey]: value,
            _lastModified: new Date().toISOString()
          }
        }
      };
    });
  }, []);

  const getCardOverride = useCallback((tabId, fieldKey, defaultValue = null) => {
    const tabOverrides = state.cardOverrides[tabId];
    if (tabOverrides && fieldKey in tabOverrides && tabOverrides[fieldKey] !== undefined && tabOverrides[fieldKey] !== null) {
      return tabOverrides[fieldKey];
    }
    return defaultValue;
  }, [state.cardOverrides]);

  const clearCardOverrides = useCallback((tabId) => {
    setState(prev => {
      const updated = { ...prev.cardOverrides };
      delete updated[tabId];
      return {
        ...prev,
        cardOverrides: updated
      };
    });
  }, []);

  // Effects Configuration
  const updateEffectsConfig = useCallback((updates) => {
    setState(prev => ({
      ...prev,
      effectsConfig: {
        ...prev.effectsConfig,
        ...updates
      }
    }));
  }, []);

  // Agronomist Credentials Profile
  const updateAgronomistProfile = useCallback((updates) => {
    setState(prev => ({
      ...prev,
      agronomistProfile: {
        ...prev.agronomistProfile,
        ...updates
      }
    }));
  }, []);

  // Reset all settings to factory default
  const resetAllToDefaults = useCallback(() => {
    setState({
      cardOrders: DEFAULT_CARD_ORDERS,
      cardOverrides: {},
      effectsConfig: DEFAULT_EFFECTS_CONFIG,
      agronomistProfile: DEFAULT_AGRONOMIST_PROFILE
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Clean card class helper without touch-to-edit or spotlight interference
  const getCardClass = useCallback((cardKey, extraClasses = '') => {
    return extraClasses || '';
  }, []);

  const value = useMemo(() => ({
    // State
    isDrawerOpen,
    activeDrawerTab,
    activePageTab,
    focusedCardKey,
    isVisualEditMode,
    activeCardKey,
    previewDevice,
    cardOrders: state.cardOrders,
    cardOverrides: state.cardOverrides,
    cardStyles: state.cardStyles || {},
    effectsConfig: state.effectsConfig,
    agronomistProfile: state.agronomistProfile,

    // Drawer controllers
    openDrawer,
    closeDrawer,
    setActiveDrawerTab,
    setActivePageTab,
    setFocusedCardKey,
    setIsVisualEditMode,
    setActiveCardKey,
    setPreviewDevice,

    // Visual Card Styling
    updateCardStyle,
    resetCardStyle,
    resetAllCardStyles,
    toggleCardHidden,
    getCardStyle,

    // Card Reordering
    moveCard,
    toggleCardVisibility,
    resetTabOrder,

    // Content Overrides
    setCardOverride,
    getCardOverride,
    clearCardOverrides,

    // Effects & Profile
    updateEffectsConfig,
    updateAgronomistProfile,
    resetAllToDefaults,

    // Utilities
    getCardClass
  }), [
    isDrawerOpen,
    activeDrawerTab,
    activePageTab,
    focusedCardKey,
    isVisualEditMode,
    activeCardKey,
    previewDevice,
    state,
    openDrawer,
    closeDrawer,
    setIsVisualEditMode,
    setActiveCardKey,
    setPreviewDevice,
    updateCardStyle,
    resetCardStyle,
    resetAllCardStyles,
    toggleCardHidden,
    getCardStyle,
    moveCard,
    toggleCardVisibility,
    resetTabOrder,
    setCardOverride,
    getCardOverride,
    clearCardOverrides,
    updateEffectsConfig,
    updateAgronomistProfile,
    resetAllToDefaults,
    getCardClass
  ]);

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
};

export default StudioContext;
