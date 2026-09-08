import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hardware_setup_mode';

export const useHardwareMode = () => {
  const [hardwareMode, setHardwareModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default to false (Software-Only Mode for general farmers)
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const setHardwareMode = useCallback((val) => {
    try {
      const nextVal = typeof val === 'function' ? val(hardwareMode) : Boolean(val);
      localStorage.setItem(STORAGE_KEY, String(nextVal));
      setHardwareModeState(nextVal);
      window.dispatchEvent(new CustomEvent('hardwareModeChange', { detail: nextVal }));
    } catch (err) {
      console.error('Failed to save hardware mode preference:', err);
    }
  }, [hardwareMode]);

  const toggleHardwareMode = useCallback(() => {
    setHardwareMode(prev => !prev);
  }, [setHardwareMode]);

  useEffect(() => {
    const handleCustomEvent = (e) => {
      setHardwareModeState(e.detail);
    };

    const handleStorageEvent = (e) => {
      if (e.key === STORAGE_KEY) {
        setHardwareModeState(e.newValue === 'true');
      }
    };

    window.addEventListener('hardwareModeChange', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('hardwareModeChange', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  return {
    hardwareMode,
    setHardwareMode,
    toggleHardwareMode,
    isHardwareEnabled: hardwareMode
  };
};

export default useHardwareMode;
