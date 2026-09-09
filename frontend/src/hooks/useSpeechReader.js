import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeechReader = () => {
  const [speakingId, setSpeakingId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text, id = 'default', lang = 'en', rate = 1.0) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Voice readout (Text-to-Speech) is not supported on this browser.');
      return;
    }

    const synth = window.speechSynthesis;

    // If clicking on current playing item, toggle stop
    if (speakingId === id) {
      synth.cancel();
      setSpeakingId(null);
      setIsPaused(false);
      return;
    }

    synth.cancel();

    // Clean formatting for natural speech
    const cleanText = (text || '')
      .replace(/[*_#`~[\]()<>]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    const langMap = {
      te: 'te-IN',
      hi: 'hi-IN',
      ta: 'ta-IN',
      kn: 'kn-IN',
      en: 'en-IN'
    };
    const primaryLang = (lang || 'en').split('-')[0];
    utterance.lang = langMap[primaryLang] || 'en-IN';
    utterance.rate = rate || 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingId(null);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      setSpeakingId(null);
      setIsPaused(false);
    };

    setSpeakingId(id);
    setIsPaused(false);
    synth.speak(utterance);
  }, [speakingId]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      setIsPaused(false);
    }
  }, []);

  return { speak, stop, speakingId, isPaused };
};
