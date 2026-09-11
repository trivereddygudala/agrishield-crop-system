import { useState, useEffect, useCallback, useRef } from 'react';
import { getSpeechLocale } from '../utils/regionalLocale';

export const useSpeechReader = () => {
  const [speakingId, setSpeakingId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef(null);
  const voicesRef = useRef([]);

  // Load and cache voices when available
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      try {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          voicesRef.current = available;
        }
      } catch (err) {
        console.warn('Error loading speech voices:', err);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const findBestVoice = useCallback((langCode) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    let voices = voicesRef.current;
    if ((!voices || voices.length === 0) && synth) {
      voices = synth.getVoices() || [];
      voicesRef.current = voices;
    }
    if (!voices || voices.length === 0) return null;

    const targetLocale = getSpeechLocale(langCode).toLowerCase();
    const primaryCode = (langCode || 'en').split('-')[0].toLowerCase();

    // 1. Exact locale match (e.g. "te-IN", "hi-IN", "ta-IN")
    let match = voices.find(v => v.lang && v.lang.toLowerCase() === targetLocale);
    if (match) return match;

    // 2. Exact match replacing _ with -
    match = voices.find(v => v.lang && v.lang.toLowerCase().replace('_', '-') === targetLocale);
    if (match) return match;

    // 3. Primary language code prefix (e.g. starts with "te", "hi", "ta")
    match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(primaryCode));
    if (match) return match;

    // 4. Voice name containing the language name (e.g. "Telugu", "Hindi", "Tamil")
    const langNames = {
      te: 'telugu', hi: 'hindi', ta: 'tamil', kn: 'kannada',
      ml: 'malayalam', mr: 'marathi', gu: 'gujarati', pa: 'punjabi',
      ur: 'urdu', or: 'odia', as: 'assamese', en: 'english'
    };
    const targetName = langNames[primaryCode];
    if (targetName) {
      match = voices.find(v => v.name && v.name.toLowerCase().includes(targetName));
      if (match) return match;
    }

    // 5. Fallback to an Indian English or local English voice if no regional voice exists
    match = voices.find(v => v.lang && (v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india')));
    if (match) return match;

    // 6. System default
    return voices.find(v => v.default) || voices[0] || null;
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

    const targetLocale = getSpeechLocale(lang);
    utterance.lang = targetLocale;
    utterance.rate = rate || 1.0;
    utterance.pitch = 1.0;

    const matchedVoice = findBestVoice(lang);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
    }

    utterance.onend = () => {
      setSpeakingId(null);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      // If the specific voice/language failed and was non-English, retry once with default voice
      if ((e.error === 'language-unavailable' || e.error === 'voice-unavailable' || e.error === 'synthesis-failed') && lang !== 'en') {
        try {
          const fallbackUtterance = new SpeechSynthesisUtterance(cleanText);
          fallbackUtterance.lang = 'en-IN';
          fallbackUtterance.rate = rate || 1.0;
          fallbackUtterance.onend = () => {
            setSpeakingId(null);
            setIsPaused(false);
          };
          fallbackUtterance.onerror = () => {
            setSpeakingId(null);
            setIsPaused(false);
          };
          synth.speak(fallbackUtterance);
          return;
        } catch { /* silent */ }
      }
      setSpeakingId(null);
      setIsPaused(false);
    };

    setSpeakingId(id);
    setIsPaused(false);

    // Chrome bug workaround: small delay after cancel() ensures utterance is not dropped
    setTimeout(() => {
      try {
        if (synth.paused) {
          synth.resume();
        }
        synth.speak(utterance);
      } catch (err) {
        console.error('synth.speak failed:', err);
        setSpeakingId(null);
      }
    }, 40);
  }, [speakingId, findBestVoice]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      setIsPaused(false);
    }
  }, []);

  return { speak, stop, speakingId, isPaused };
};
