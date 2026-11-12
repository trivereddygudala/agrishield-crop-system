import { useState, useEffect, useCallback, useRef } from 'react';
import { getSpeechLocale } from '../utils/regionalLocale';
import { sanitizeTextForSpeech } from '../utils/speechSanitizer';

export const useSpeechReader = () => {
  const [speakingId, setSpeakingId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef(null);
  const voicesRef = useRef([]);
  const audioRef = useRef(null);

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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
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

    // Male voice indicators across Microsoft, Google, Apple and Android TTS engines
    const maleKeywords = ['male', 'mohan', 'madhur', 'valluvar', 'gagan', 'midhun', 'manohar', 'niranjan', 'bashkar', 'salman', 'prabhat', 'david', 'mark', 'george', 'ravi', 'guy', 'kumar', 'deep', 'hemant', 'asad', 'pradeep'];
    const femaleKeywords = ['female', 'shruti', 'swara', 'pallavi', 'sapna', 'sobhana', 'aarohi', 'dhwani', 'tanishaa', 'gul', 'neerja', 'zira', 'heera', 'saranya', 'kani', 'venba', 'uzma', 'nabanita'];

    const isMaleVoice = (v) => {
      const name = (v.name || '').toLowerCase();
      if (femaleKeywords.some(fk => name.includes(fk))) return false;
      return maleKeywords.some(mk => name.includes(mk)) || !femaleKeywords.some(fk => name.includes(fk));
    };

    // 1. Natural / Neural / Online MALE voices preferred (e.g. Edge Natural Telugu Mohan / Hindi Madhur)
    let match = voices.find(v => (v.lang && v.lang.toLowerCase() === targetLocale) && 
      (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online')) && isMaleVoice(v));
    if (match) return match;

    // 2. Exact locale match with male voice (e.g. "te-IN", "hi-IN", "ta-IN")
    match = voices.find(v => v.lang && v.lang.toLowerCase() === targetLocale && isMaleVoice(v));
    if (match) return match;

    // 3. Exact locale match general
    match = voices.find(v => v.lang && v.lang.toLowerCase() === targetLocale);
    if (match) return match;

    // 4. Exact match replacing _ with -
    match = voices.find(v => v.lang && v.lang.toLowerCase().replace('_', '-') === targetLocale && isMaleVoice(v));
    if (match) return match;

    // 5. Primary language code prefix with male voice (e.g. starts with "te", "hi", "ta")
    match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(primaryCode) && isMaleVoice(v));
    if (match) return match;

    match = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(primaryCode));
    if (match) return match;

    // 6. Voice name containing the language name and male indicator
    const langNames = {
      te: 'telugu', hi: 'hindi', ta: 'tamil', kn: 'kannada',
      ml: 'malayalam', mr: 'marathi', gu: 'gujarati', pa: 'punjabi',
      ur: 'urdu', or: 'odia', as: 'assamese', en: 'english'
    };
    const targetName = langNames[primaryCode];
    if (targetName) {
      match = voices.find(v => v.name && v.name.toLowerCase().includes(targetName) && isMaleVoice(v));
      if (match) return match;
      match = voices.find(v => v.name && v.name.toLowerCase().includes(targetName));
      if (match) return match;
    }

    // Safety Gate: For Odia (or), never fall back to a Hindi or English voice engine
    if (primaryCode === 'or') {
      return null;
    }

    // 7. Fallback to an Indian English or local English male voice
    match = voices.find(v => v.lang && (v.lang.toLowerCase().includes('in') || v.name.toLowerCase().includes('india')) && isMaleVoice(v));
    if (match) return match;

    // 8. Any male voice
    match = voices.find(v => isMaleVoice(v));
    if (match) return match;

    // 9. System default
    return voices.find(v => v.default) || voices[0] || null;
  }, []);

  const playBrowserSpeech = useCallback((cleanText, id, lang, rate = 1.0) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const primaryCode = (lang || 'en').split('-')[0].toLowerCase();
    const matchedVoice = findBestVoice(lang);

    // Odia TTS Safety Check: If no native Odia voice exists on browser/OS, do not speak garbled phonemes
    if (primaryCode === 'or' && !matchedVoice) {
      window.dispatchEvent(new CustomEvent('agrishield-toast', {
        detail: {
          message: 'ଓଡ଼ିଆ ଭଏସ ରିଡର ଡିଭାଇସରେ ଉପଲବ୍ଧ ନାହିଁ। ଅନ-ସ୍କ୍ରିନ ଟେକ୍ସଟ ପ୍ରଦର୍ଶିତ ହେଉଛି।',
          type: 'info'
        }
      }));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;
    const targetLocale = getSpeechLocale(lang);
    utterance.lang = targetLocale;
    utterance.rate = rate || 1.0;
    utterance.pitch = 0.94;

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
      if (primaryCode === 'or') {
        setSpeakingId(null);
        setIsPaused(false);
        return;
      }
      if ((e.error === 'language-unavailable' || e.error === 'voice-unavailable' || e.error === 'synthesis-failed') && lang !== 'en') {
        try {
          const fallbackUtterance = new SpeechSynthesisUtterance(cleanText);
          fallbackUtterance.lang = 'en-IN';
          fallbackUtterance.rate = rate || 1.0;
          fallbackUtterance.onend = () => { setSpeakingId(null); setIsPaused(false); };
          fallbackUtterance.onerror = () => { setSpeakingId(null); setIsPaused(false); };
          synth.speak(fallbackUtterance);
          return;
        } catch { /* silent */ }
      }
      setSpeakingId(null);
      setIsPaused(false);
    };

    setSpeakingId(id);
    setIsPaused(false);

    try {
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch (err) {
      console.error('synth.speak failed:', err);
      setSpeakingId(null);
    }
  }, [findBestVoice]);

  const speak = useCallback((text, id = 'default', lang = 'en', rate = 1.0) => {
    // 0. Intelligent Parameter Order Guard: Auto-detect if caller passed (id, text, ...) instead of (text, id, ...)
    let targetText = text;
    let targetId = id;
    let targetLang = lang;
    let targetRate = rate || 1.0;

    if (typeof text === 'string' && typeof id === 'string') {
      const isTextAnId = (text.length < 40 && !text.includes(' ') && !/[ఀ-౿ऀ-ॿ]/.test(text));
      const isIdActualSentence = (id.includes(' ') || /[ఀ-౿ऀ-ॿ]/.test(id) || id.length > 50);
      if (isTextAnId && isIdActualSentence) {
        targetText = id;
        targetId = text;
      }
    }

    // 1. If clicking on current playing item, toggle stop
    if (speakingId === targetId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      setIsPaused(false);
      return;
    }

    // Stop any active audio before starting new playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Clean formatting for natural speech without reading brackets, punctuation or symbols
    const cleanText = sanitizeTextForSpeech(targetText, targetLang);
    if (!cleanText) return;

    // IMMEDIATE active state: activate UI button instantly on first tick
    setSpeakingId(targetId);
    setIsPaused(false);

    const primaryCode = (targetLang || 'en').split('-')[0].toLowerCase();

    // Default 1.0x reading speed (+0% delta) per farmer requirement
    let rateStr = '+0%';
    if (typeof targetRate === 'number' && !isNaN(targetRate)) {
      const diff = Math.round((targetRate - 1.0) * 100);
      rateStr = diff >= 0 ? `+${diff}%` : `${diff}%`;
    } else if (typeof targetRate === 'string' && targetRate.includes('%')) {
      rateStr = targetRate;
    }

    // 2. High-Fidelity Studio Neural Male Voice via Streaming (Instant playback)
    try {
      const audioUrl = `/api/speech/synthesize?lang=${encodeURIComponent(primaryCode)}&text=${encodeURIComponent(cleanText)}&rate=${encodeURIComponent(rateStr)}&gender=male`;
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audioRef.current = audio;

      audio.onplay = () => {
        setSpeakingId(targetId);
        setIsPaused(false);
      };

      audio.onended = () => {
        setSpeakingId(null);
        setIsPaused(false);
        audioRef.current = null;
      };

      audio.onerror = (err) => {
        console.warn('Server neural voice stream unavailable, falling back to local speech:', err);
        audioRef.current = null;
        playBrowserSpeech(cleanText, targetId, targetLang, targetRate || 1.0);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((playErr) => {
          console.warn('Audio play interrupted or blocked by browser autoplay policy, attempting browser fallback:', playErr);
          audioRef.current = null;
          playBrowserSpeech(cleanText, targetId, targetLang, targetRate || 1.0);
        });
      }
    } catch (err) {
      playBrowserSpeech(cleanText, targetId, targetLang, targetRate || 1.0);
    }
  }, [speakingId, playBrowserSpeech]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setIsPaused(false);
  }, []);

  return { speak, stop, speakingId, isPaused };
};
