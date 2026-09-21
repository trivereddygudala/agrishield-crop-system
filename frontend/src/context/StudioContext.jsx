import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

const StudioContext = createContext(null);

const STORAGE_KEY = 'agrishield_studio_state_v1';

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
    { key: 'species_hero', label: 'Botanical Specimen Hero & Confidence', visible: true },
    { key: 'care_matrix', label: '4-Card Cultivation Care Matrix (Sun, Water, Soil, Temp)', visible: true },
    { key: 'narrative_desc', label: 'Agronomic Narrative & Botanical Overview', visible: true },
    { key: 'taxonomy_card', label: 'Taxonomy, Genus & Foliage Morphology', visible: true },
    { key: 'nutrition_card', label: 'Soil Fertility & Balanced NPK Formulation', visible: true },
    { key: 'pest_vigilance', label: 'Agricultural Pathogen & Pest Vigilance', visible: true },
    { key: 'weed_advisory', label: 'Weed Eradication Protocol (If Weed)', visible: true },
    { key: 'action_bar', label: 'Action Toolbar & Secondary Scans', visible: true }
  ],
  'agro-scan': [
    { key: 'product_hero', label: 'Agrochemical Product Classification Hero', visible: true },
    { key: 'product_details', label: 'Technical Chemical Details & Registration', visible: true },
    { key: 'dilution_guide', label: 'Manufacturer Dilution & 4-Step Mixing Protocol', visible: true },
    { key: 'growth_stages', label: 'Target Crops & Dynamic Growth Stages', visible: true },
    { key: 'safety_ppe', label: '4-Card Personal Protective Equipment (PPE) Grid', visible: true }
  ],
  'dashboard': [
    { key: 'stats_overview', label: 'Active Farm Health & Quick Metrics', visible: true },
    { key: 'farm_alert_banner', label: 'Real-Time Agronomic Advisory Banner', visible: true },
    { key: 'quick_actions', label: 'Quick Diagnostic Scan Launchers', visible: true },
    { key: 'sensor_telemetry', label: 'IoT Sensor Node Telemetry & Moisture', visible: true },
    { key: 'recent_history', label: 'Recent Diagnostic Records & Prescriptions', visible: true }
  ]
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
      effectsConfig: DEFAULT_EFFECTS_CONFIG,
      agronomistProfile: DEFAULT_AGRONOMIST_PROFILE
    };
  });

  // Drawer state (not persisted to storage)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('editor'); // 'editor' | 'layout' | 'effects' | 'map'
  const [activePageTab, setActivePageTab] = useState('disease-diag'); // which tab context is currently being inspected
  const [focusedCardKey, setFocusedCardKey] = useState(null); // for spotlight dim effect

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save studio state:', e);
    }
  }, [state]);

  // Open drawer with optional specific sub-tab
  const openDrawer = useCallback((tab = 'editor', pageTab = null) => {
    if (tab) setActiveDrawerTab(tab);
    if (pageTab) setActivePageTab(pageTab);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

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

  // Helper classes to inject on cards based on spotlight and sliding config
  const getCardClass = useCallback((cardKey, extraClasses = '') => {
    const classes = [extraClasses];

    if (state.effectsConfig.slidingEffects) {
      classes.push('studio-slide-in');
    }

    if (state.effectsConfig.cardGlow) {
      classes.push('studio-card-glow');
    }

    if (state.effectsConfig.spotlightDim) {
      if (focusedCardKey && focusedCardKey !== cardKey) {
        classes.push('opacity-45 scale-[0.985] blur-[0.3px] transition-all duration-300');
      } else if (focusedCardKey === cardKey) {
        classes.push('opacity-100 scale-[1.01] ring-2 ring-emerald-400/70 shadow-2xl shadow-emerald-500/20 z-20 transition-all duration-300');
      }
    }

    return classes.filter(Boolean).join(' ');
  }, [state.effectsConfig, focusedCardKey]);

  const value = useMemo(() => ({
    // State
    isDrawerOpen,
    activeDrawerTab,
    activePageTab,
    focusedCardKey,
    cardOrders: state.cardOrders,
    cardOverrides: state.cardOverrides,
    effectsConfig: state.effectsConfig,
    agronomistProfile: state.agronomistProfile,

    // Drawer controllers
    openDrawer,
    closeDrawer,
    setActiveDrawerTab,
    setActivePageTab,
    setFocusedCardKey,

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
    state,
    openDrawer,
    closeDrawer,
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
