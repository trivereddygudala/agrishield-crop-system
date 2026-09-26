import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Trash2, Share2, ShieldCheck, CheckCheck,
  FileText, Sparkles, Volume2, VolumeX, ChevronRight,
  X, CheckCircle2, Pill, Sprout, AlertTriangle,
  Truck, Calendar, MapPin, Check, MessageSquare,
  Play, Pause, Paperclip, Send, Mic, ExternalLink,
  Clock, MoreVertical, Lock, ShieldAlert, Cpu, Activity,
  BatteryWarning, CloudRain, WifiOff, AlertOctagon, HelpCircle,
  Globe, Square, StopCircle
} from 'lucide-react';
import { formatDateTime, timeAgo } from '../../utils/dateUtils';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import {
  getDiseaseDetails,
  translateCrop,
  translateDisease,
  getDetailedAgronomicDescription
} from '../../utils/diseaseAdvisoryData';
import { translateNotification } from '../../utils/notificationTranslator';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';
import { VILLAGE_COORDINATES } from '../../data/indiaLocations';

export const READER_LANGUAGES = [
  { code: 'te', name: 'తెలుగు', flag: '🌾', label: 'తెలుగు (Telugu)' },
  { code: 'en', name: 'English', flag: '🌐', label: 'English' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳', label: 'हिंदी (Hindi)' },
  { code: 'ta', name: 'தமிழ்', flag: '🌾', label: 'தமிழ் (Tamil)' },
  { code: 'kn', name: 'ಕನ್ನಡ', flag: '🌾', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', name: 'മലയാളം', flag: '🌴', label: 'മലയാളം (Malayalam)' },
  { code: 'or', name: 'ଓଡ଼ିଆ', flag: '🌾', label: 'ଓଡ଼ିଆ (Odia)' }
];

/**
 * Intelligent crop & disease extractor supporting all 7 regional languages
 */
function extractCropDetails(item, lang = 'te') {
  const normLang = (lang || 'en').split('-')[0].toLowerCase();
  if (!item) {
    return {
      cropKey: 'crop',
      cropName: translateCrop('crop', normLang) || 'Crop',
      cropEmoji: '🌿',
      diseaseName: null,
      threadTitle: normLang === 'te' ? '🌿 పంట రక్షణ సలహా' : (normLang === 'hi' ? '🌿 फसल सुरक्षा सलाह' : '🌿 Crop Health Advisory')
    };
  }

  const rawText = `${item.crop_name || ''} ${item.crop || ''} ${item.crop_type || ''} ${item.title || ''} ${item.title_te || ''} ${item.message || ''} ${item.message_te || ''}`.toLowerCase();

  const CROPS = [
    { key: 'chilli', en: 'Chilli', te: 'మిరప', hi: 'मिर्च', ta: 'மிளகாய்', kn: 'ಮೆಣಸಿನಕಾಯಿ', ml: 'മുളക്', or: 'ଲଙ୍କା', emoji: '🌶️', regex: /(chilli|chili|pepper|మిరప|mirapa|मिर्च|மிளகாய்|ಮೆಣಸಿನಕಾಯಿ|മുളക്|ଲଙ୍କା)/i },
    { key: 'maize', en: 'Maize', te: 'మొక్కజొన్న', hi: 'मक्का', ta: 'மக்காச்சோளம்', kn: 'ಮೆಕ್ಕೆಜೋಳ', ml: 'ചോളം', or: 'ମକା', emoji: '🌽', regex: /(maize|corn|మొక్కజొన్న|mokkajonna|मक्का|மக்காச்சோளம்|ಮೆಕ್ಕೆಜೋಳ|ചോളം|ମକା)/i },
    { key: 'tomato', en: 'Tomato', te: 'టమాటా', hi: 'टमाटर', ta: 'தக்காளி', kn: 'ಟೊಮೆಟೊ', ml: 'തക്കാളി', or: 'ଟମାଟୋ', emoji: '🍅', regex: /(tomato|టమాటా|టమాట|tamata|टमाटर|தக்காளி|ಟೊಮೆಟೊ|തക്കാളി|ଟମାଟୋ)/i },
    { key: 'paddy', en: 'Paddy', te: 'వరి', hi: 'धान / चावल', ta: 'நெல்', kn: 'ಭತ್ತ', ml: 'നെല്ല്', or: 'ଧାନ', emoji: '🌾', regex: /(paddy|rice|వరి|vari|धान|चावल|நெல்|ಭತ್ತ|നെല്ല്|ଧାନ)/i },
    { key: 'cotton', en: 'Cotton', te: 'పత్తి', hi: 'कपास', ta: 'பருத்தி', kn: 'ಹತ್ತಿ', ml: 'പരുത്തി', or: 'କପା', emoji: '🧶', regex: /(cotton|పత్తి|patti|कपास|பருத்தி|ಹತ್ತಿ|പരുത്തി|କପା)/i },
    { key: 'groundnut', en: 'Groundnut', te: 'వేరుశనగ', hi: 'मूंगफली', ta: 'வேர்க்கடலை', kn: 'ಕಡಲೆಕಾಯಿ', ml: 'നിലക്കടല', or: 'ଚିନାବାଦାମ', emoji: '🥜', regex: /(groundnut|peanut|వేరుశనగ|verusanaga|मूंगफली|வேர்க்கடலை|ಕಡಲೆಕಾಯಿ|നിലക്കടല|ଚିନାବାଦାମ)/i },
    { key: 'sugarcane', en: 'Sugarcane', te: 'చెరకు', hi: 'गन्ना', ta: 'கரும்பு', kn: 'ಕಬ್ಬು', ml: 'കരിമ്പ്', or: 'ଆଖୁ', emoji: '🎋', regex: /(sugarcane|చెరకు|cheraku|गन्ना|கரும்பு|ಕಬ್ಬು|കരിമ്പ്|ଆଖୁ)/i },
    { key: 'banana', en: 'Banana', te: 'అరటి', hi: 'केला', ta: 'வாழை', kn: 'ಬಾಳೆ', ml: 'വാഴ', or: 'କଦଳୀ', emoji: '🍌', regex: /(banana|అరటి|arati|केला|வாழை|ಬಾಳೆ|വാഴ|କଦଳୀ)/i },
    { key: 'mango', en: 'Mango', te: 'మామిడి', hi: 'आम', ta: 'மாம்பழம்', kn: 'ಮಾವಿನ ಹಣ್ಣು', ml: 'മാങ്ങ', or: 'ଆମ୍ବ', emoji: '🥭', regex: /(mango|మామిడి|mamidi|आम|மாம்பழம்|ಮಾವಿನ ಹಣ್ಣು|മാങ്ങ|ଆମ୍ବ)/i },
    { key: 'onion', en: 'Onion', te: 'ఉల్లి', hi: 'प्याज', ta: 'வெங்காயம்', kn: 'ಈರುಳ್ಳಿ', ml: 'സவாള', or: 'ପିଆଜ', emoji: '🧅', regex: /(onion|ఉల్లి|ulli|प्याज|வெங்காயம்|ಈರುಳ್ಳಿ|സவாള|ପିଆଜ)/i },
    { key: 'potato', en: 'Potato', te: 'బంగాళాదుంప', hi: 'आलू', ta: 'உருளைக்கிழங்கு', kn: 'ಆಲೂಗಡ್ಡೆ', ml: 'ഉരുളക്കിഴങ്ങ്', or: 'ଆଳୁ', emoji: '🥔', regex: /(potato|బంగాళాదుంప|bangaladumpa|आलू|உருளைக்கிழங்கு|ಆಲೂಗಡ್ಡೆ|ഉരുളക്കിഴങ്ങ്|ଆଳୁ)/i },
    { key: 'soybean', en: 'Soybean', te: 'సోయాబీన్', hi: 'सोयाबीन', ta: 'சோயாபீன்', kn: 'ಸೋಯಾಬೀನ್', ml: 'സോയാബീൻ', or: 'ସୋୟାବିନ୍', emoji: '🫘', regex: /(soybean|soya|సోయా|सोयाबीन|சோயாபீன்|ಸೋಯಾಬೀನ್|സോയാബീൻ|ସୋୟାବିନ୍)/i },
    { key: 'wheat', en: 'Wheat', te: 'గోధుమ', hi: 'गेहूं', ta: 'கோதுமை', kn: 'ಗೋಧಿ', ml: 'ഗോതമ്പ്', or: 'ଗହମ', emoji: '🌾', regex: /(wheat|గోధుమ|godhuma|गेहूं|கோதுமை|ಗೋಧಿ|ഗോതമ്പ്|ଗହମ)/i },
    { key: 'grape', en: 'Grape', te: 'ద్రాక్ష', hi: 'अंगूर', ta: 'திராட்சை', kn: 'ದ್ರಾಕ್ಷಿ', ml: 'മുന്തിരി', or: 'ଅଙ୍ଗୁର', emoji: '🍇', regex: /(grape|ద్రాక్ష|draksha|अंगूर|திராட்சை|ದ್ರಾಕ್ಷಿ|മുന്തിരി|ଅଙ୍ଗୁର)/i },
    { key: 'citrus', en: 'Citrus', te: 'నిమ్మ', hi: 'नींबू', ta: 'எலுமிச்சை', kn: 'ನಿಂಬೆ', ml: 'നാരങ്ങ', or: 'ଲେମ୍ବୁ', emoji: '🍋', regex: /(citrus|lemon|lime|నిమ్మ|nimma|नींबू|எலுமிச்சை|ನಿಂಬೆ|നാരങ്ങ|ଲେମ୍ବୁ)/i },
  ];

  const matchedCrop = CROPS.find(c => c.regex.test(rawText));

  const DISEASES = [
    { key: 'early_blight', en: 'Early Blight', te: 'ఎర్లీ బ్లైట్', hi: 'अगेती झुलसा', ta: 'முன் கருகல்', kn: 'ಮುಂಗಾರು ರೋಗ', ml: 'ഏർലി ബ്ലൈറ്റ്', or: 'ଆଗୁଆ ଝାଉଁଳା', regex: /(early blight|ఎర్లీ బ్లైట్|अगेती झुलसा|முன் கருகல்|ಮುಂಗಾರು ರೋಗ|ഏർലി ബ്ലൈറ്റ്|ଆଗୁଆ ଝାଉଁଳା)/i },
    { key: 'late_blight', en: 'Late Blight', te: 'లేట్ బ్లైట్', hi: 'पछेती झुलसा', ta: 'பின் கருகல்', kn: 'ಹಿಂಗಾರು ರೋಗ', ml: 'ലേറ്റ് ബ്ലൈಟ್', or: 'ପଛୁଆ ଝାଉଁଳା', regex: /(late blight|లేట్ బ్లైట్|पछेती झुलसा|பின் கருகல்|ಹಿಂಗಾರು ರೋಗ|ലേറ്റ് ബ്ലൈറ്റ്|ପଛୁଆ ଝାଉଁଳା)/i },
    { key: 'leaf_spot', en: 'Leaf Spot', te: 'ఆకు మచ్చతెగులు', hi: 'पत्ती धब्बा रोग', ta: 'இலைப்புள்ளி நோய்', kn: 'ಎಲೆ ಚುಕ್ಕೆ ರೋಗ', ml: 'ഇലപ്പുള്ളി രോഗം', or: 'ପତ୍ର ଦାଗ ରୋଗ', regex: /(leaf spot|cercospora|ఆకు మచ్చ|మచ్చతెగులు|पत्ती धब्बा|இலைப்புள்ளி|ಎಲೆ ಚುಕ್ಕೆ|ഇലപ്പുള്ളി|ପତ୍ର ଦାଗ)/i },
    { key: 'powdery_mildew', en: 'Powdery Mildew', te: 'బూడిద తెగులు', hi: 'चूर्णी फफूंद (पाउडरी मिल्ड्यू)', ta: 'சாம்பல் நோய்', kn: 'ಬೂದಿ ರೋಗ', ml: 'ചാരപ്പൂപ്പ് രോഗം', or: 'ପାଉଡରି ମିଲ୍ଡ୍ୟୁ', regex: /(powdery mildew|బూడిద తెగులు|पाउडरी मिल्ड्यू|चूर्णी फफूंद|சாம்பல் நோய்|ಬೂದಿ ರೋಗ|ചാരപ്പൂപ്പ്|ପାଉଡରି)/i },
    { key: 'rust', en: 'Rust', te: 'తుప్పు తెగులు', hi: 'गेरुआ / रतुआ रोग', ta: 'துரு நோய்', kn: 'ತುಕ್ಕು ರೋಗ', ml: 'തുരുമ്പ് രോഗം', or: 'କଳଙ୍କି ରୋଗ', regex: /(rust|తుప్పు|रतुआ|गेरुआ|துரு நோய்|ತುಕ್ಕು|തുരുമ്പ്|କଳଙ୍କି)/i },
    { key: 'wilt', en: 'Wilt', te: 'ఎండు తెగులు', hi: 'उकठा / विल्ट रोग', ta: 'வாடல் நோய்', kn: 'ಸೊರಗು ರೋಗ', ml: 'വാട്ടം രോഗം', or: 'ଝାଉଁଳା ରୋଗ', regex: /(wilt|fusarium|ఎండు తెగులు|उकठा|வாடல்|ಸೊರಗು|വാട്ടം|ଝାଉଁଳା)/i },
    { key: 'bacterial_blight', en: 'Bacterial Blight', te: 'బాక్టీరియల్ బ్లైట్', hi: 'जीवाणु झुलसा', ta: 'பாக்டீரியா கருகல்', kn: 'ಬ್ಯಾಕ್ಟೀರಿಯಲ್ ರೋಗ', ml: 'ബാക്ടീരിയൽ ബ്ലൈറ്റ്', or: 'ଜୀବାଣୁ ଝାଉଁଳା', regex: /(bacterial blight|బాక్టీరియల్ బ్లైట్|जीवाणु झुलसा|பாக்டீரியா கருகல்|ಬ್ಯಾಕ್ಟೀರಿಯಲ್|ബാക്ടീരിയൽ)/i },
    { key: 'blast', en: 'Blast', te: 'అగ్గి తెగులు', hi: 'ब्लास्ट रोग', ta: 'குலை நோய்', kn: 'ಬೆಂಕಿ ರೋಗ', ml: 'കുലവാട്ടം', or: 'ବ୍ଲାଷ୍ଟ ରୋଗ', regex: /(blast|magnaporthe|అగ్గి తెగులు|ब्लास्ट|குலை நோய்|ಬೆಂಕಿ ರೋಗ|കുಲവാട്ടം)/i },
    { key: 'spodoptera', en: 'Caterpillar / Cutworm', te: 'లద్దెపురుగు', hi: 'तम्बाकू की इल्ली / कटवर्म', ta: 'புகையிலை வெட்டுப்புழு', kn: 'ತಂಬಾಕು ಕಂಬಳಿಹುಳು', ml: 'പുകയിലപ്പുഴു', or: 'ପୋକ / କଟ୍‌ୱର୍ମ', regex: /(spodoptera|caterpillar|cutworm|లద్దెపురుగు|इल्ली|कटवर्म|வெட்டுப்புழு|ಕಂಬಳಿಹುಳು|പുകയിലപ്പുഴു|ପୋକ)/i }
  ];

  const matchedDisease = DISEASES.find(d => d.regex.test(rawText));

  if (matchedCrop) {
    const cropName = matchedCrop[normLang] || translateCrop(matchedCrop.key, normLang) || matchedCrop.en;
    let title = '';
    if (matchedDisease) {
      const diseaseName = matchedDisease[normLang] || translateDisease(matchedDisease.key, normLang, matchedCrop.key) || matchedDisease.en;
      title = `${matchedCrop.emoji} ${cropName} • ${diseaseName}`;
    } else {
      const advisoryWord = {
        te: 'పంట సలహా',
        hi: 'फसल सलाह',
        ta: 'பயிர் ஆலோசனை',
        kn: 'ಬೆಳೆ ಸಲಹೆ',
        ml: 'വിള ഉപദേശം',
        or: 'ଫସଲ ପରାମର୍ଶ',
        en: 'Crop Advisory'
      }[normLang] || 'Crop Advisory';
      title = `${matchedCrop.emoji} ${cropName} ${advisoryWord}`;
    }
    return {
      cropKey: matchedCrop.key,
      cropName,
      cropEmoji: matchedCrop.emoji,
      diseaseName: matchedDisease ? (matchedDisease[normLang] || matchedDisease.en) : null,
      threadTitle: title
    };
  }

  const defaultAdvisory = {
    te: '🌿 పంట రక్షణ సలహా',
    hi: '🌿 फसल स्वास्थ्य सलाह',
    ta: '🌿 பயிர் சுகாதார ஆலோசனை',
    kn: '🌿 ಬೆಳೆ ಆರೋಗ್ಯ ಸಲಹೆ',
    ml: '🌿 വിള ആരോഗ്യ ഉപദേശം',
    or: '🌿 ଫସଲ ସୁରକ୍ଷା ପରାମର୍ଶ',
    en: '🌿 Crop Health Advisory'
  }[normLang] || '🌿 Crop Health Advisory';

  return {
    cropKey: 'crop',
    cropName: translateCrop('crop', normLang) || 'Crop',
    cropEmoji: '🌿',
    diseaseName: matchedDisease ? (matchedDisease[normLang] || matchedDisease.en) : null,
    threadTitle: defaultAdvisory
  };
}

/**
 * Modern voice note bubble with inline audio player and animated waveforms
 */
function VoiceNoteBubble({ msg, isMyMessage, isTelugu }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => {
    if (msg.duration && isFinite(msg.duration) && msg.duration > 0) return Math.round(msg.duration);
    // Parse duration from text like "🎤 Voice Message (5s)"
    const match = String(msg.text || '').match(/\((\d+)s\)/);
    if (match && match[1]) return parseInt(match[1], 10);
    return 3;
  });
  const audioRef = useRef(null);

  const getValidDuration = (aud) => {
    if (aud && aud.duration && isFinite(aud.duration) && !isNaN(aud.duration) && aud.duration > 0) {
      return aud.duration;
    }
    return duration || (msg.duration && isFinite(msg.duration) ? msg.duration : 3);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const validDur = getValidDuration(audio);
      if (validDur > 0) {
        setProgress(Math.min(100, (audio.currentTime / validDur) * 100));
        setCurrentTime(audio.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const onError = (e) => {
      console.warn("Audio element playback error, ready for fallback:", e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    if (msg.audioUrl) {
      try { audio.load(); } catch (_) {}
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [msg.audioUrl, msg.duration]);

  const togglePlay = () => {
    const audio = audioRef.current;

    // Graceful fallback: If audioUrl is missing or empty (e.g. from earlier stripped messages)
    if (!msg.audioUrl || !audio) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (isPlaying) {
          window.speechSynthesis.cancel();
          setIsPlaying(false);
        } else {
          window.speechSynthesis.cancel();
          const cleanText = (msg.text || '').replace(/🎤\s*|\(\d+s\)/g, '').trim() || (isTelugu ? 'వాయిస్ సందేశం' : 'Voice Message');
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = 0.85;
          utterance.onstart = () => setIsPlaying(true);
          utterance.onend = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
          };
          utterance.onerror = () => setIsPlaying(false);
          window.speechSynthesis.speak(utterance);
        }
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      document.querySelectorAll('audio').forEach(a => {
        if (a !== audio) {
          try { a.pause(); } catch (_) {}
        }
      });
      if (progress >= 99) {
        audio.currentTime = 0;
        setProgress(0);
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.warn('Native audio play error, falling back:', err);
            // Fallback to speech synthesis if browser audio decoder fails on codec
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              const cleanText = (msg.text || '').replace(/🎤\s*|\(\d+s\)/g, '').trim() || (isTelugu ? 'వాయిస్ సందేశం' : 'Voice Message');
              const utterance = new SpeechSynthesisUtterance(cleanText);
              utterance.rate = 0.85;
              utterance.onstart = () => setIsPlaying(true);
              utterance.onend = () => {
                setIsPlaying(false);
                setProgress(0);
              };
              utterance.onerror = () => setIsPlaying(false);
              window.speechSynthesis.speak(utterance);
            } else {
              setIsPlaying(false);
            }
          });
      }
    }
  };

  const formatSec = (sec) => {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[250px]">
      <audio ref={audioRef} src={msg.audioUrl} preload="auto" />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-90 cursor-pointer ${
          isMyMessage
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center gap-1 h-5 overflow-hidden">
          {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 45, 70].map((h, i) => {
            const barProgress = (i / 15) * 100;
            const isPlayed = progress >= barProgress;
            return (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isPlayed
                    ? (isMyMessage ? 'bg-white' : 'bg-emerald-600 dark:bg-emerald-400')
                    : (isMyMessage ? 'bg-blue-300/40' : 'bg-slate-300 dark:bg-slate-700')
                } ${isPlaying && isPlayed ? 'animate-pulse' : ''}`}
                style={{ height: `${Math.max(6, (h * (isPlaying ? 1.2 : 1)) / 4)}px` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className={isMyMessage ? 'text-blue-100 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
            {isPlaying ? formatSec(currentTime) : formatSec(duration)}
          </span>
          <span className={`flex items-center gap-1 ${isMyMessage ? 'text-blue-100 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}`}>
            <Mic className="w-3 h-3" />
            <span>{isTelugu ? 'వాయిస్ సందేశం' : 'Voice Message'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function GoogleMessageReader({
  message,
  translatedTitle,
  translatedBody,
  onBack,
  onDelete,
  lang = 'te'
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();

  // Active language state with dynamic switcher
  const [currentLang, setCurrentLang] = useState(() => {
    return lang || i18n?.language || localStorage.getItem('i18nextLng') || 'te';
  });

  useEffect(() => {
    if (lang && lang !== currentLang) {
      setCurrentLang(lang);
    }
  }, [lang]);

  const isTelugu = (currentLang || '').toLowerCase().startsWith('te');
  const isProvider = user?.role === 'equipment_provider';

  const [showFullReview, setShowFullReview] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const activeLangObj = READER_LANGUAGES.find(l => (currentLang || '').toLowerCase().startsWith(l.code)) || READER_LANGUAGES[0];

  // ── Voice Narration State for Disease/System Advisories ──
  const [currentlyPlayingAudioId, setCurrentlyPlayingAudioId] = useState(null);
  const activeAudioElementRef = useRef(null);

  const messagesEndRef = useRef(null);
  const { speak, stop, speakingId } = useSpeechReader();

  const messageId = message?.notification_id || message?.id || 'sms_active';

  // Stop speech synthesis & audio on unmount
  useEffect(() => {
    return () => {
      stop();
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
    };
  }, [stop]);

  // Synchronize playing ID with speech reader
  useEffect(() => {
    if (!speakingId && !activeAudioElementRef.current) {
      setCurrentlyPlayingAudioId(null);
    }
  }, [speakingId]);

  // ── Speech-to-Text Microphone Dictation State ──
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(isTelugu ? 'ఈ బ్రౌజర్‌లో మైక్రోఫోన్ వాయిస్ రికగ్నిషన్ సపోర్ట్ లేదు.' : 'Microphone speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      try { recognitionRef.current?.stop(); } catch (_) {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      const langMap = { te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', or: 'or-IN', en: 'en-IN' };
      recognition.lang = langMap[(currentLang || 'en').split('-')[0]] || 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (e) => {
        const transcript = e.results[0]?.[0]?.transcript;
        if (transcript) {
          setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  // ── Real Voice Note Audio Recording State (Hardware Mic + MediaRecorder) ──
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  const startVoiceRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert(isTelugu ? 'మీ బ్రౌజర్‌లో మైక్రోఫోన్ ఆడియో రికార్డింగ్ సపోర్ట్ లేదు.' : 'Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
          else mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone access error:', err);
      alert(isTelugu ? 'దయచేసి మైక్రోఫోన్ అనుమతి ఇవ్వండి.' : 'Please allow microphone access to record voice messages.');
      setIsRecordingVoice(false);
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (audioStreamRef.current) {
      try { audioStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = recordingSeconds || 1;

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      cancelVoiceRecording();
      return;
    }

    mediaRecorderRef.current.onstop = () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current.mimeType || 'audio/webm'
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result;
          handleSendVoiceNote(base64Audio, duration);
        };
        reader.readAsDataURL(audioBlob);
      } catch (e) {
        console.warn('Error processing audio recording:', e);
      } finally {
        if (audioStreamRef.current) {
          try { audioStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
        }
        audioChunksRef.current = [];
        setIsRecordingVoice(false);
        setRecordingSeconds(0);
      }
    };

    try {
      mediaRecorderRef.current.stop();
    } catch (_) {
      cancelVoiceRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioStreamRef.current) {
        try { audioStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
      }
    };
  }, []);

  if (!message) return null;

  // ── Determine Differentiated Notification Pattern ──
  const isBooking = message.category === 'booking' || message.type === 'booking' || Boolean(message.booking_id || message.bookingId);
  const isDisease = message.category === 'disease' || (!isBooking && Boolean(message.crop || message.disease || /(blight|spot|mildew|rust|wilt|blast|rot|caterpillar|లద్దెపురుగు|తెగులు|మచ్చ|झुलसा|धब्बा|रोग)/i.test(`${message.title || ''} ${message.message || ''}`)));
  const isSystemOrHardware = !isBooking && !isDisease;

  // ── Multilingual Dynamic Notification Translation ──
  const activeNotification = useMemo(() => {
    const normLang = (currentLang || 'en').split('-')[0].toLowerCase();
    const trans = translateNotification(message.title, message.message, normLang);
    return {
      title: (normLang === (lang || '').toLowerCase() && translatedTitle) || trans.title || message.title,
      message: (normLang === (lang || '').toLowerCase() && translatedBody) || trans.message || message.message
    };
  }, [message, currentLang, translatedTitle, translatedBody, lang]);

  // ── Multilingual Crop & Disease Extraction ──
  const cropInfo = useMemo(() => {
    return extractCropDetails(message, currentLang);
  }, [message, currentLang]);

  const parsedInfo = useMemo(() => {
    let crop = message.crop || cropInfo.cropKey || '';
    let disease = message.disease || cropInfo.diseaseName || '';
    let confidence = message.confidence_score != null ? (message.confidence_score > 1 ? message.confidence_score : message.confidence_score * 100).toFixed(1) : null;
    const fullText = `${message.title || ''} ${message.message || ''}`;
    if (!confidence) {
      const confMatch = fullText.match(/(\d+(?:\.\d+)?)\s*%\s*confidence/i);
      if (confMatch) confidence = parseFloat(confMatch[1]).toFixed(1);
    }
    const matched = getDiseaseDetails(crop, disease, currentLang);
    return {
      crop,
      localizedCrop: translateCrop(crop, currentLang),
      teluguCrop: translateCrop(crop, 'te'),
      disease,
      localizedDisease: translateDisease(disease, currentLang, crop),
      teluguDisease: translateDisease(disease, 'te', crop),
      confidence: confidence || '94.6',
      advisory: matched
    };
  }, [message, cropInfo, currentLang]);

  // ── 5–10 Lines Agronomic Pathology Description ──
  const detailedDescription = useMemo(() => {
    return getDetailedAgronomicDescription(
      cropInfo.cropKey,
      parsedInfo.disease,
      currentLang,
      parsedInfo.confidence,
      activeNotification.message
    );
  }, [cropInfo.cropKey, parsedInfo.disease, currentLang, parsedInfo.confidence, activeNotification.message]);

  // ── Multilingual Weather & System Hardware Audio Narration Text ──
  const systemAudioText = useMemo(() => {
    const normLang = (currentLang || 'en').split('-')[0].toLowerCase();
    const title = activeNotification.title;
    const body = activeNotification.message || '';
    let telemetry = '';
    if (message.node_id || message.battery != null || message.humidity != null) {
      if (normLang === 'te') {
        telemetry = ` పరికర వివరాలు: ${message.node_id ? `నోడ్ ఐడీ ${message.node_id}.` : ''} ${message.battery != null ? `బ్యాటరీ శాతం ${message.battery} శాతం.` : ''} ${message.humidity != null ? `గాలిలో తేమ ${message.humidity} శాతం.` : ''}`;
      } else if (normLang === 'hi') {
        telemetry = ` उपकरण विवरण: ${message.node_id ? `नोड आईडी ${message.node_id}.` : ''} ${message.battery != null ? `बैटरी स्तर ${message.battery} प्रतिशत.` : ''} ${message.humidity != null ? `हवा में नमी ${message.humidity} प्रतिशत.` : ''}`;
      } else if (normLang === 'ta') {
        telemetry = ` சாதன விவரங்கள்: ${message.node_id ? `நோட் ஐடி ${message.node_id}.` : ''} ${message.battery != null ? `பேட்டரி ${message.battery} சதவீதம்.` : ''} ${message.humidity != null ? `ஈரப்பதம் ${message.humidity} சதவீதம்.` : ''}`;
      } else if (normLang === 'kn') {
        telemetry = ` ಸಾಧನದ ವಿವರಗಳು: ${message.node_id ? `ನೋಡ್ ಐಡಿ ${message.node_id}.` : ''} ${message.battery != null ? `ಬ್ಯಾಟರಿ ${message.battery} ಪ್ರತಿಶತ.` : ''} ${message.humidity != null ? `ತೇವಾಂಶ ${message.humidity} ಪ್ರತಿಶತ.` : ''}`;
      } else if (normLang === 'ml') {
        telemetry = ` ഉപകരണ വിവരങ്ങൾ: ${message.node_id ? `നോഡ് ഐഡി ${message.node_id}.` : ''} ${message.battery != null ? `ബാറ്ററി ${message.battery} ശതമാനം.` : ''} ${message.humidity != null ? `ഈർപ്പം ${message.humidity} ശതമാനം.` : ''}`;
      } else if (normLang === 'or') {
        telemetry = ` ଉପକରଣ ବିବରଣୀ: ${message.node_id ? `ନୋଡ୍ ଆଇଡି ${message.node_id}.` : ''} ${message.battery != null ? `ବ୍ୟାଟେରୀ ${message.battery} ପ୍ରତିଶତ.` : ''} ${message.humidity != null ? `ଆର୍ଦ୍ରତା ${message.humidity} ପ୍ରତିଶତ.` : ''}`;
      } else {
        telemetry = ` Device telemetry: ${message.node_id ? `Node ID ${message.node_id}.` : ''} ${message.battery != null ? `Battery at ${message.battery} percent.` : ''} ${message.humidity != null ? `Relative humidity ${message.humidity} percent.` : ''}`;
      }
    }
    return `${title}. ${body}. ${telemetry}`;
  }, [activeNotification, message, currentLang]);

  // ── Equipment Booking State & Precise Village Details ──
  const rawBookingId = message.booking_id || message.bookingId || (message.id?.startsWith('notif-') ? message.id.replace('notif-', '') : message.id) || 'BK-21407';

  // Canonical normalized booking thread key (strips any notification prefixes and status suffixes)
  const canonicalBookingId = useMemo(() => {
    const raw = String(message.booking_id || message.bookingId || message.id || '').trim();
    const clean = raw
      .replace(/^notif-(?:stat-)?/, '')
      .replace(/^farmer-notif-/, '')
      .replace(/^notif-order-/, '')
      .replace(/^notif-chat-/, '')
      .replace(/^notif-/, '')
      .replace(/-(?:confirmed|rejected|declined|completed).*$/, '');
    if (clean.startsWith('BK-')) return clean;
    if (clean.length > 0) return `BK-${clean}`;
    return 'BK-21407';
  }, [message]);

  const savedBooking = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
      if (Array.isArray(saved)) {
        return saved.find(b => b && (b.id === rawBookingId || `BK-${b.id}` === rawBookingId || b.id === canonicalBookingId || (b.id && canonicalBookingId.includes(b.id))));
      }
    } catch (_) {}
    return null;
  }, [rawBookingId, canonicalBookingId]);

  const [bookingStatus, setBookingStatus] = useState(() => {
    return savedBooking?.status || message.status || 'pending';
  });

  useEffect(() => {
    if (savedBooking?.status) {
      setBookingStatus(savedBooking.status);
    }
  }, [savedBooking]);

  // Reactive listener for local bookings updates and cross-tab storage updates
  useEffect(() => {
    if (!isBooking) return;

    const syncStatusFromStorage = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
        if (Array.isArray(saved)) {
          const match = saved.find(b => b && (
            b.id === rawBookingId ||
            `BK-${b.id}` === rawBookingId ||
            b.id === canonicalBookingId ||
            (b.id && canonicalBookingId.includes(b.id))
          ));
          if (match && match.status) {
            setBookingStatus(match.status);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('agrishield_bookings_updated', syncStatusFromStorage);
    window.addEventListener('storage', syncStatusFromStorage);

    return () => {
      window.removeEventListener('agrishield_bookings_updated', syncStatusFromStorage);
      window.removeEventListener('storage', syncStatusFromStorage);
    };
  }, [isBooking, rawBookingId, canonicalBookingId]);

  // Sync latest booking status from server periodically for multi-device live consistency
  useEffect(() => {
    if (!isBooking) return;
    let isMounted = true;
    const fetchFreshBookingStatus = async () => {
      try {
        const res = await API.get('/api/v1/equipment/bookings');
        if (res.data?.bookings && Array.isArray(res.data.bookings) && isMounted) {
          const match = res.data.bookings.find(b => b && (
            b.id === rawBookingId ||
            `BK-${b.id}` === rawBookingId ||
            b.id === canonicalBookingId ||
            (b.id && canonicalBookingId.includes(b.id))
          ));
          if (match && match.status) {
            setBookingStatus(match.status);
          }
        }
      } catch (_) {}
    };

    fetchFreshBookingStatus();
    const interval = setInterval(fetchFreshBookingStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isBooking, rawBookingId, canonicalBookingId]);

  const bookingFarmerName = savedBooking?.farmerName || message.farmerName || message.farmer_name || 'Farmer';
  const bookingFarmerPhone = savedBooking?.farmerPhone || savedBooking?.phone || message.farmerPhone || message.farmer_phone || message.phone || '9440182736';
  const cleanFarmerPhone = String(bookingFarmerPhone).replace(/[^0-9]/g, '');

  const bookingProviderName = savedBooking?.provider_name || savedBooking?.providerName || message.provider_name || message.providerName || (isTelugu ? 'రమేష్ ఫార్మ్ సర్వీసెస్' : 'Ramesh Farm Services');
  const bookingProviderPhone = savedBooking?.provider_phone || savedBooking?.providerPhone || message.provider_phone || message.providerPhone || '9848012345';
  const cleanProviderPhone = String(bookingProviderPhone).replace(/[^0-9]/g, '');

  const bookingEquipmentTitle = savedBooking?.equipmentTitle || savedBooking?.title || message.equipmentTitle || message.equipment_title || 'Mahindra 575 DI 45HP Tractor';
  const bookingAcres = savedBooking?.acres || savedBooking?.acreage || message.acres || '1.5';
  const bookingFieldStatus = savedBooking?.fieldStatus || savedBooking?.crop || message.field_status || message.fieldStatus || 'Field';
  const bookingOperation = savedBooking?.operation || message.operation || 'Rotavator / Secondary Tillage';
  const bookingDate = savedBooking?.bookingDate || savedBooking?.date || message.date || 'Tomorrow';
  const bookingTimeSlot = savedBooking?.timeSlot || savedBooking?.slot || message.timeSlot || '6:00 AM - 10:00 AM';

  // Resolved Village, Mandal, and District
  const bookingVillage = savedBooking?.village ||
                         message.village ||
                         message.locationVillage ||
                         message.location?.village ||
                         user?.farm_location?.village ||
                         user?.village ||
                         'Pasupugallu';

  const bookingMandal = savedBooking?.mandal ||
                        message.mandal ||
                        message.location?.mandal ||
                        user?.farm_location?.mandal ||
                        user?.mandal ||
                        '';

  const bookingDistrict = savedBooking?.district ||
                          message.district ||
                          message.location?.district ||
                          user?.farm_location?.district ||
                          user?.district ||
                          '';

  const bookingLocationDisplay = `${bookingVillage}${bookingMandal ? `, ${bookingMandal}` : ''}${bookingDistrict ? ` (${bookingDistrict})` : ''}`;
  const bookingTotalCost = savedBooking?.totalCost || message.totalCost || message.total_cost || '1,200';

  // ── Canonical Booking Chat Thread (Shared by Farmer & Provider) ──
  const chatStorageKey = isBooking ? `agrishield_chat_thread_${canonicalBookingId}` : `agrishield_chat_thread_${messageId}`;

  const [chatMessages, setChatMessages] = useState(() => {
    if (!isBooking) return [];
    try {
      const stored = localStorage.getItem(chatStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strictly purge only legacy dummy mock messages
          return parsed.filter(m => m && m.id !== 'msg_f1' && m.id !== 'msg_p1');
        }
      }
    } catch (_) {}

    // Seed from threadItems if available from synthesized notifications
    if (Array.isArray(message?.threadItems) && message.threadItems.length > 0) {
      return message.threadItems
        .filter(item => item && (item.message || item.title))
        .map((item, idx) => ({
          id: item.notification_id || item.id || `thread_seed_${idx}`,
          sender: item.sender || (item.isFarmerDecision || item.type === 'booking_farmer_message' ? 'farmer' : (isProvider ? 'farmer' : 'provider')),
          text: item.message || item.title || '',
          timestamp: item.created_at || item.timestamp || new Date().toISOString()
        }));
    }
    return [];
  });

  useEffect(() => {
    if (isBooking) {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
      } catch (_) {}
    }
  }, [chatMessages, chatStorageKey, isBooking]);

  // Real-time live synchronization across tabs, browsers, and mobile devices
  useEffect(() => {
    if (!isBooking) return;

    let isMounted = true;
    let bc = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('agrishield_equipment_chat');
        bc.onmessage = (event) => {
          if (event.data?.canonicalBookingId === canonicalBookingId) {
            if (event.data?.nextStatus) {
              setBookingStatus(event.data.nextStatus);
            }
            if (event.data?.message) {
              setChatMessages(prev => {
                if (prev.some(m => m.id === event.data.message.id)) return prev;
                const next = [...prev, event.data.message];
                try { localStorage.setItem(chatStorageKey, JSON.stringify(next)); } catch (_) {}
                return next;
              });
            }
          }
        };
      }
    } catch (_) {}

    const fetchRemoteChat = async () => {
      if (!canonicalBookingId) return;
      try {
        const res = await API.get(`/api/v1/equipment/bookings/${canonicalBookingId}/messages`);
        if (res.data?.messages && Array.isArray(res.data.messages) && isMounted) {
          const serverMsgs = res.data.messages.filter(m => m && m.id !== 'msg_f1' && m.id !== 'msg_p1');
          setChatMessages(prev => {
            const map = new Map();
            prev.forEach(m => map.set(m.id, m));
            serverMsgs.forEach(m => {
              const existing = map.get(m.id);
              if (existing) {
                map.set(m.id, {
                  ...existing,
                  ...m,
                  audioUrl: m.audioUrl || existing.audioUrl,
                  duration: m.duration || existing.duration,
                  location: m.location || existing.location
                });
              } else {
                map.set(m.id, m);
              }
            });
            const merged = Array.from(map.values()).sort((a, b) => {
              const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return ta - tb;
            });
            try {
              localStorage.setItem(chatStorageKey, JSON.stringify(merged));
            } catch (_) {}
            return merged;
          });
        }
      } catch (_) {}
    };

    // Initial fetch on mount
    fetchRemoteChat();

    // Fast 2.5-second polling for multi-browser / multi-device instant sync
    const pollInterval = setInterval(fetchRemoteChat, 2500);

    const handleStorageChange = (e) => {
      if (e.key === chatStorageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(m => m && m.id !== 'msg_f1' && m.id !== 'msg_p1');
            setChatMessages(clean);
          }
        } catch (_) {}
      }
    };
    const handleCustomMsg = (e) => {
      if (e.detail?.storageKey === chatStorageKey && e.detail?.message) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === e.detail.message.id)) return prev;
          return [...prev, e.detail.message];
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('agrishield_chat_message_sent', handleCustomMsg);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('agrishield_chat_message_sent', handleCustomMsg);
    };
  }, [chatStorageKey, isBooking, canonicalBookingId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isBooking) scrollToBottom();
  }, [chatMessages, isBooking]);

  // ── Language Toggle Handler ──
  const handleToggleLanguage = (newLang) => {
    stop();
    setCurrentLang(newLang);
    if (i18n && typeof i18n.changeLanguage === 'function') {
      i18n.changeLanguage(newLang);
    }
    try {
      localStorage.setItem('i18nextLng', newLang);
      localStorage.setItem('agrishield_preferred_lang', newLang);
      window.dispatchEvent(new Event('languagechange'));
    } catch (_) {}
  };

  // ── Actions ──
  const handleBack = () => {
    stop();
    if (activeAudioElementRef.current) activeAudioElementRef.current.pause();
    if (onBack) onBack();
  };

  const handleDelete = () => {
    stop();
    if (activeAudioElementRef.current) activeAudioElementRef.current.pause();
    try {
      localStorage.removeItem(chatStorageKey);
    } catch (_) {}
    if (onDelete) onDelete(message.notification_id || message.id);
    if (onBack) onBack();
  };

  const handleShareWhatsApp = () => {
    let shareText = '';
    if (isDisease) {
      shareText = `*AgriShield Disease Alert / పంట తెగులు హెచ్చరిక*\n\n*${cropInfo.threadTitle}*\n${detailedDescription}\n\n*AI Confidence:* ${parsedInfo.confidence}%\n\n- AgriShield AI Crop Protection`;
    } else if (isSystemOrHardware) {
      shareText = `*AgriShield System Alert / సిస్టమ్ హెచ్చరిక*\n\n*${translatedTitle || message.title}*\n${translatedBody || message.message}\n\n- AgriShield Kisan Network`;
    } else {
      shareText = `*AgriShield Machinery Booking Voucher*\n\n*Machine:* ${bookingEquipmentTitle}\n*Location:* ${bookingLocationDisplay}\n*Date:* ${bookingDate} (${bookingTimeSlot})\n*Fare:* ₹${bookingTotalCost}\n\n- AgriShield Farm Hub`;
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  // Play disease advisory narration
  const isPlayingDiseaseAudio = speakingId === `disease_audio_${messageId}`;
  const isPlayingSystemAudio = speakingId === `sys_audio_${messageId}`;
  const isAnySpeaking = Boolean(speakingId);

  const handleToggleDiseaseAudio = () => {
    if (isPlayingDiseaseAudio) {
      stop();
    } else {
      speak(
        `${cropInfo.threadTitle}. ${detailedDescription}`,
        `disease_audio_${messageId}`,
        currentLang,
        0.8
      );
    }
  };

  const handleToggleSystemAudio = () => {
    if (isPlayingSystemAudio) {
      stop();
    } else {
      speak(
        systemAudioText,
        `sys_audio_${messageId}`,
        currentLang,
        0.8
      );
    }
  };

  const handleHeaderSpeak = () => {
    if (isAnySpeaking) {
      stop();
      return;
    }
    if (isDisease) {
      handleToggleDiseaseAudio();
    } else if (isSystemOrHardware) {
      handleToggleSystemAudio();
    }
  };

  // ── Role-Aware Two-Way Messenger Logic (No Bots, No Fake Audios) ──
  const isProviderViewer = user?.role === 'equipment_provider';
  const mySenderRole = isProviderViewer ? 'provider' : 'farmer';

  const handleSendMessage = (customText = null) => {
    const textToSend = (customText || inputText || '').trim();
    if (!textToSend) return;

    const newMsg = {
      id: `msg_${mySenderRole}_${Date.now()}`,
      sender: mySenderRole,
      senderName: user?.name || (isProviderViewer ? (isTelugu ? 'పరికర ప్రొవైడర్' : 'Equipment Provider') : (isTelugu ? 'రైతు' : 'Farmer')),
      type: 'text',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    if (!customText) setInputText('');

    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('agrishield_chat_message_sent', {
        detail: { storageKey: chatStorageKey, message: newMsg }
      }));

      // BroadcastChannel for instant same-browser cross-tab sync
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('agrishield_equipment_chat');
          bc.postMessage({ canonicalBookingId, message: newMsg });
          bc.close();
        }
      } catch (_) {}

      // Send to Backend API for cross-browser, cross-device real-time sync
      API.post(`/api/v1/equipment/bookings/${canonicalBookingId}/messages`, newMsg).catch(() => {});

      // Upsert a single unified conversation thread notification for the counterparty (prevents multiple duplicate notifications)
      const recipientRole = isProviderViewer ? 'farmer' : 'equipment_provider';
      const senderDisplayName = user?.name || (isProviderViewer ? (isTelugu ? 'పరికర ప్రొవైడర్' : 'Equipment Provider') : (isTelugu ? 'రైతు' : 'Farmer'));
      const notifObj = {
        id: `notif-chat-${canonicalBookingId}`,
        notification_id: `notif-chat-${canonicalBookingId}`,
        category: 'booking',
        type: 'booking_chat',
        priority: 'Medium',
        role: recipientRole,
        target_role: recipientRole,
        title: isTelugu ? `💬 కొత్త సందేశం - ${bookingEquipmentTitle}` : `💬 New Message - ${bookingEquipmentTitle}`,
        message: `${senderDisplayName}: "${textToSend.length > 60 ? textToSend.slice(0, 60) + '...' : textToSend}"`,
        booking_id: canonicalBookingId,
        bookingId: canonicalBookingId,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        read: false
      };
      try {
        const existingNotifs = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        const filteredExisting = Array.isArray(existingNotifs)
          ? existingNotifs.filter(n => n && n.booking_id !== canonicalBookingId && !String(n.id || '').startsWith(`notif-chat-${canonicalBookingId}`))
          : [];
        localStorage.setItem('agrishield_user_notifications', JSON.stringify([notifObj, ...filteredExisting]));
        window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: notifObj }));
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const nbc = new BroadcastChannel('agrishield_notifications_channel');
            nbc.postMessage(notifObj);
            nbc.close();
          }
        } catch (_) {}
      } catch (_) {}
    } catch (_) {}
  };

  const handleSendLiveLocation = () => {
    setShowAttachMenu(false);
    if (isProviderViewer) return; // Strict role restriction: Providers do not share location

    const defaultCoords = [15.8020, 79.8050]; // Pasupugallu village center
    const villageCoords = (typeof VILLAGE_COORDINATES !== 'undefined' && VILLAGE_COORDINATES[bookingVillage]) 
      ? VILLAGE_COORDINATES[bookingVillage] 
      : defaultCoords;

    const lat = villageCoords[0];
    const lng = villageCoords[1];
    const coordsStr = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

    const locationMsg = {
      id: `msg_farmer_loc_${Date.now()}`,
      sender: 'farmer',
      senderName: user?.name || (isTelugu ? 'రైతు' : 'Farmer'),
      type: 'location',
      text: isTelugu ? `📍 గ్రామ లొకేషన్ పంపాను (${bookingVillage} గ్రామం).` : `📍 Shared village location (${bookingVillage} Village).`,
      location: {
        name: `${bookingVillage} Village`,
        teluguName: `${bookingVillage} గ్రామం`,
        village: bookingVillage,
        mandal: bookingMandal || 'Mundlamuru',
        district: bookingDistrict || 'Prakasam',
        coords: coordsStr,
        lat: lat,
        lng: lng,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    const updated = [...chatMessages, locationMsg];
    setChatMessages(updated);
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('agrishield_chat_message_sent', {
        detail: { storageKey: chatStorageKey, message: locationMsg }
      }));
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('agrishield_equipment_chat');
          bc.postMessage({ canonicalBookingId, message: locationMsg });
          bc.close();
        }
      } catch (_) {}
      API.post(`/api/v1/equipment/bookings/${canonicalBookingId}/messages`, locationMsg).catch(() => {});

      // Dispatch real-time notification to equipment provider
      const notifObj = {
        id: `notif-chat-${canonicalBookingId}`,
        notification_id: `notif-chat-${canonicalBookingId}`,
        category: 'booking',
        type: 'booking_chat',
        priority: 'Medium',
        role: 'equipment_provider',
        target_role: 'equipment_provider',
        title: isTelugu ? `📍 గ్రామ లొకేషన్ - ${bookingEquipmentTitle}` : `📍 Village Location - ${bookingEquipmentTitle}`,
        message: `${user?.name || (isTelugu ? 'రైతు' : 'Farmer')}: 📍 ${bookingVillage} ${isTelugu ? 'గ్రామం లొకేషన్' : 'Village Location'}`,
        booking_id: canonicalBookingId,
        bookingId: canonicalBookingId,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        read: false
      };
      try {
        const existingNotifs = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        const filteredExisting = Array.isArray(existingNotifs)
          ? existingNotifs.filter(n => n && n.booking_id !== canonicalBookingId && !String(n.id || '').startsWith(`notif-chat-${canonicalBookingId}`))
          : [];
        localStorage.setItem('agrishield_user_notifications', JSON.stringify([notifObj, ...filteredExisting]));
        window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: notifObj }));
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const nbc = new BroadcastChannel('agrishield_notifications_channel');
          nbc.postMessage(notifObj);
          nbc.close();
        }
      } catch (_) {}
    } catch (_) {}
  };

  const handleSendVoiceNote = (audioDataUrl, durationSec) => {
    if (!audioDataUrl) return;

    const newMsg = {
      id: `msg_voice_${mySenderRole}_${Date.now()}`,
      sender: mySenderRole,
      senderName: user?.name || (isProviderViewer ? (isTelugu ? 'పరికర ప్రొవైడర్' : 'Equipment Provider') : (isTelugu ? 'రైతు' : 'Farmer')),
      type: 'voice_note',
      audioUrl: audioDataUrl,
      duration: durationSec || 1,
      text: isTelugu ? `🎤 వాయిస్ సందేశం (${durationSec}s)` : `🎤 Voice Message (${durationSec}s)`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);

    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('agrishield_chat_message_sent', {
        detail: { storageKey: chatStorageKey, message: newMsg }
      }));

      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('agrishield_equipment_chat');
          bc.postMessage({ canonicalBookingId, message: newMsg });
          bc.close();
        }
      } catch (_) {}

      API.post(`/api/v1/equipment/bookings/${canonicalBookingId}/messages`, newMsg).catch(() => {});

      const recipientRole = isProviderViewer ? 'farmer' : 'equipment_provider';
      const senderDisplayName = user?.name || (isProviderViewer ? (isTelugu ? 'పరికర ప్రొవైడర్' : 'Equipment Provider') : (isTelugu ? 'రైతు' : 'Farmer'));
      const notifObj = {
        id: `notif-chat-${canonicalBookingId}`,
        notification_id: `notif-chat-${canonicalBookingId}`,
        category: 'booking',
        type: 'booking_chat',
        priority: 'Medium',
        role: recipientRole,
        target_role: recipientRole,
        title: isTelugu ? `💬 కొత్త వాయిస్ సందేశం - ${bookingEquipmentTitle}` : `💬 New Voice Message - ${bookingEquipmentTitle}`,
        message: `${senderDisplayName}: 🎤 ${isTelugu ? 'వాయిస్ సందేశం' : 'Voice Message'} (${durationSec}s)`,
        booking_id: canonicalBookingId,
        bookingId: canonicalBookingId,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        read: false
      };
      try {
        const existingNotifs = JSON.parse(localStorage.getItem('agrishield_user_notifications') || '[]');
        const filteredExisting = Array.isArray(existingNotifs)
          ? existingNotifs.filter(n => n && n.booking_id !== canonicalBookingId && !String(n.id || '').startsWith(`notif-chat-${canonicalBookingId}`))
          : [];
        localStorage.setItem('agrishield_user_notifications', JSON.stringify([notifObj, ...filteredExisting]));
        window.dispatchEvent(new CustomEvent('agrishield_new_notification', { detail: notifObj }));
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const nbc = new BroadcastChannel('agrishield_notifications_channel');
            nbc.postMessage(notifObj);
            nbc.close();
          }
        } catch (_) {}
      } catch (_) {}
    } catch (_) {}
  };

  const handleUpdateBookingStatus = async (nextStatus) => {
    setBookingStatus(nextStatus);
    const bId = rawBookingId;
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
      if (Array.isArray(saved)) {
        const updated = saved.map(b => (b && (b.id === bId || `BK-${b.id}` === bId || b.id === canonicalBookingId)) ? { ...b, status: nextStatus, updatedAt: new Date().toISOString() } : b);
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
        window.dispatchEvent(new Event('agrishield_bookings_updated'));
      }
    } catch (_) {}

    // Add milestone confirmation message to the chat
    if (nextStatus === 'confirmed') {
      const noticeMsg = {
        id: `msg_sys_${Date.now()}`,
        sender: 'system',
        type: 'system_notice',
        text: isTelugu
          ? `✅ పరికర ప్రొవైడర్ మీ బుకింగ్‌ను ఆమోదించారు (${bookingDate} కోసం షెడ్యూల్ చేయబడింది)`
          : `✅ Booking Accepted by Provider (Scheduled for ${bookingDate})`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => {
        const next = [...prev, noticeMsg];
        try { localStorage.setItem(chatStorageKey, JSON.stringify(next)); } catch (_) {}
        return next;
      });
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('agrishield_equipment_chat');
          bc.postMessage({ canonicalBookingId, message: noticeMsg, nextStatus });
          bc.close();
        }
      } catch (_) {}
    }

    try {
      await API.patch(`/api/v1/equipment/bookings/${canonicalBookingId}/status`, { status: nextStatus });
    } catch (_) {}
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f1f3f9] dark:bg-[#0d1117] text-slate-900 dark:text-slate-100 overflow-hidden select-none">

      {/* ─── 1. TOP APP BAR ─── */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white dark:bg-[#161b22] border-b border-slate-200/90 dark:border-slate-800 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title={isTelugu ? "వెనుకకు" : "Back"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Differentiated Avatar */}
          <div className="relative shrink-0">
            {isDisease ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md">
                <Sprout className="w-5 h-5 text-white" />
              </div>
            ) : isBooking ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white font-black shadow-md">
                <Truck className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-slate-700 flex items-center justify-center text-white font-black shadow-md">
                <Cpu className="w-5 h-5 text-white" />
              </div>
            )}
            {isBooking && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#161b22] animate-pulse" />
            )}
          </div>

          {/* Header Title & Subtitle */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {isDisease
                  ? cropInfo.threadTitle
                  : isBooking
                    ? (isProviderViewer ? bookingFarmerName : bookingProviderName)
                    : (translatedTitle || message.title || (isTelugu ? 'సిస్టమ్ అలర్ట్' : 'System Alert'))}
              </h2>
              <span className="text-emerald-500 shrink-0">
                <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white dark:text-[#161b22]" />
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1">
              {isDisease ? (
                <span>{isTelugu ? 'ధృవీకరించబడిన వ్యాధి సలహా • స్వయంచాలక నివేదిక' : 'Verified AI Diagnostic Advisory • Automated Broadcast'}</span>
              ) : isBooking ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>
                    {isProviderViewer
                      ? (isTelugu ? `రైతు • ${bookingVillage}` : `Farmer • ${bookingVillage}`)
                      : (isTelugu ? 'ఆన్‌లైన్ • 2 నిమిషాల్లో ప్రత్యుత్తరం' : 'Online • Replies in 2 mins')}
                  </span>
                </span>
              ) : (
                <span>{isTelugu ? 'సిస్టమ్ టెలిమెట్రీ బ్రాడ్‌కాస్ట్' : 'System Telemetry Broadcast'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Header Action Buttons & In-Reader Language Switcher */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Multilingual In-Reader Language Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu(prev => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs mr-1"
              title="Change Reader Language / భాష మార్చండి"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{activeLangObj.name}</span>
            </button>

            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1 z-50 overflow-hidden">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    Select Language
                  </div>
                  {READER_LANGUAGES.map(l => {
                    const isSelected = (currentLang || '').toLowerCase().startsWith(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          handleToggleLanguage(l.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          isSelected
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{l.flag}</span>
                          <span>{l.label}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Audio TTS toggle button for Disease or System Advisories */}
          {(isDisease || isSystemOrHardware) && (
            <button
              type="button"
              onClick={handleHeaderSpeak}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                isAnySpeaking
                  ? 'bg-amber-500 text-white shadow-md animate-pulse'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
              title={isTelugu ? "వాయిస్ సలహా వినండి" : "Listen to Voice Advisory"}
            >
              {isAnySpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Quick Call Button for Equipment Booking Conversations */}
          {isBooking && (
            <a
              href={`tel:${isProviderViewer ? cleanFarmerPhone : cleanProviderPhone}`}
              className="p-2 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
              title={isProviderViewer ? (isTelugu ? 'రైతుకు కాల్ చేయండి' : 'Call Farmer') : (isTelugu ? 'ప్రొవైడర్‌కు కాల్ చేయండి' : 'Call Provider')}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            title={isTelugu ? "షేర్ చేయండి" : "Share"}
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            title={isTelugu ? "తొలగించండి" : "Delete Notification"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─── 2. MAIN BODY AREA: PATTERN-SPECIFIC RENDERING ─── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 bg-[#f3f5fa] dark:bg-[#0d1117] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]">

        {/* Date Divider Pill */}
        <div className="flex justify-center my-1">
          <div className="px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs backdrop-blur-sm">
            {isTelugu ? 'ఈ రోజు' : 'Today'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            PATTERN A: DISEASE DETECTION ALERTS
            5-10 lines agronomic pathology description, dynamic Telugu/English
            narration, chemical & organic treatments, leaf scan button.
           ══════════════════════════════════════════════════════════════ */}
        {isDisease && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4"
          >
            {/* Disease Pathology Card */}
            <div className="rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cropInfo.cropEmoji}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {cropInfo.cropName}
                  </span>
                  {parsedInfo.disease && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {parsedInfo.localizedDisease || parsedInfo.disease}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {message.priority || 'High'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {parsedInfo.confidence}% AI Accuracy
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {cropInfo.threadTitle}
                </h3>
                {/* 5-10 Lines Comprehensive Agronomic Pathology Briefing */}
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-normal leading-relaxed mt-2 whitespace-pre-line bg-slate-50/70 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  {detailedDescription}
                </p>
              </div>

              {/* Inline Audio Player Waveform */}
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleDiseaseAudio}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
                    isPlayingDiseaseAudio ? 'bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={isTelugu ? "వాయిస్ గైడ్ వినండి" : "Play Voice Guide"}
                >
                  {isPlayingDiseaseAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span>
                      {currentLang.startsWith('te') ? 'ఆడియో చికిత్సా సలహా (తెలుగు వాయిస్)' :
                       currentLang.startsWith('hi') ? 'ऑडियो उपचार सलाह (हिंदी आवाज)' :
                       currentLang.startsWith('ta') ? 'சிகிச்சை வழிகாட்டி (தமிழ் குரல்)' :
                       currentLang.startsWith('kn') ? 'ಚಿಕಿತ್ಸಾ ಸಲಹೆ (ಕನ್ನಡ ಧ್ವನಿ)' :
                       currentLang.startsWith('ml') ? 'ചികിത്സാ നിർദ്ദേശം (മലയാളം ശബ്ദം)' :
                       currentLang.startsWith('or') ? 'ଚିକିତ୍ସା ପରାମର୍ଶ (ଓଡ଼ିଆ ଭଏସ)' :
                       'Voice Treatment Advisory (English Speech)'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">0:28</span>
                  </div>

                  {/* Pulsing Audio Waves */}
                  <div className="flex items-center gap-1 h-5 mt-1">
                    {[40, 75, 50, 90, 65, 80, 45, 100, 70, 55, 85, 60, 40, 65, 90, 50, 30].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`w-1 rounded-full transition-all ${
                          isPlayingDiseaseAudio
                            ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment Recommendations Card */}
            <div className="rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{isTelugu ? 'సిఫార్సు చేయబడిన నివారణ చర్యలు & మోతాదు' : 'Recommended Treatments & Dosages'}</span>
              </h4>

              {/* Chemical Sprays */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                <span className="text-[11px] font-extrabold uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <span>🧪</span>
                  <span>{isTelugu ? 'రసాయన మందుల పిచికారీ (Chemical Spray)' : 'Chemical Foliar Protection'}</span>
                </span>
                <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1.5 list-disc list-inside">
                  {parsedInfo.advisory?.chemicals && parsedInfo.advisory.chemicals.length > 0 ? (
                    parsedInfo.advisory.chemicals.slice(0, 3).map((chem, idx) => (
                      <li key={idx} className="leading-relaxed">{chem}</li>
                    ))
                  ) : (
                    <>
                      <li>{isTelugu ? 'మాంకోజెబ్ 75% WP @ 2.5 గ్రా/లీటర్ నీటికి పిచికారీ చేయాలి.' : 'Mancozeb 75% WP @ 2.5 g/L of water foliar spray.'}</li>
                      <li>{isTelugu ? 'కాపర్ ఆక్సిక్లోరైడ్ 50% WP @ 3.0 గ్రా/లీటర్ నీటికి కలిపి పిచికారీ చేయాలి.' : 'Copper Oxychloride 50% WP @ 3.0 g/L of water.'}</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Organic Remedies */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                <span className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <span>🌿</span>
                  <span>{isTelugu ? 'సేంద్రీయ & జీవ నియంత్రణ (Organic Remedies)' : 'Organic & Biological Controls'}</span>
                </span>
                <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1.5 list-disc list-inside">
                  {parsedInfo.advisory?.organic && parsedInfo.advisory.organic.length > 0 ? (
                    parsedInfo.advisory.organic.slice(0, 2).map((org, idx) => (
                      <li key={idx} className="leading-relaxed">{org}</li>
                    ))
                  ) : (
                    <>
                      <li>{isTelugu ? 'వేప నూనె (10,000 ppm) @ 5 మి.లీ/లీటర్ నీటికి కొద్దిగా సబ్బు నీరు కలిపి పిచికారీ చేయాలి.' : 'Cold-pressed Neem Oil (10,000 ppm) @ 5 ml/L of water with mild emulsifier.'}</li>
                      <li>{isTelugu ? 'ట్రైకోడెర్మా విరిడే @ 5 గ్రా/లీటర్ నీటికి కలిపి భూమిలో తడపాలి.' : 'Trichoderma viride bio-fungicide soil drenching.'}</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Action Buttons for Disease */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/disease-detection')}
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <Sprout className="w-4 h-4" />
                  <span>{isTelugu ? '🌿 పంట ఆకును స్కాన్ చేయండి' : '🌿 Scan Leaf'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isTelugu ? '📢 వాట్సాప్‌లో షేర్ చేయండి' : '📢 Share Advisory'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PATTERN B: ESP32 IOT & WEATHER ALERTS
            Voice Audio Waveform Reader, sensor telemetry, and sharing.
           ══════════════════════════════════════════════════════════════ */}
        {isSystemOrHardware && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4"
          >
            <div className="rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
              {/* Badge & Timestamp */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {activeNotification.title || (isTelugu ? 'సిస్టమ్ అలర్ట్' : 'System Hardware Alert')}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {formatDateTime(message.lifecycle?.created_at || message.created_at)}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {message.priority || 'Normal'}
                </span>
              </div>

              {/* Alert Content Text */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                {activeNotification.message}
              </div>

              {/* Hardware Telemetry Snippet if present */}
              {(message.battery != null || message.humidity != null || message.node_id) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {message.node_id && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Node ID</span>
                      <span className="font-bold text-slate-900 dark:text-white">#{message.node_id}</span>
                    </div>
                  )}
                  {message.battery != null && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Battery</span>
                      <span className="font-bold text-amber-600">{message.battery}%</span>
                    </div>
                  )}
                  {message.humidity != null && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Humidity</span>
                      <span className="font-bold text-blue-600">{message.humidity}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Inline Audio Player Waveform for Weather & ESP32 Alerts */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSystemAudio}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
                    isPlayingSystemAudio ? 'bg-amber-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                  title={isTelugu ? "అలర్ట్ ఆడియో వినండి" : "Listen to Alert Audio"}
                >
                  {isPlayingSystemAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span>
                      {currentLang.startsWith('te') ? 'వాతావరణ / సెన్సార్ ఆడియో హెచ్చరిక' :
                       currentLang.startsWith('hi') ? 'मौसम / सेंसर ऑडियो चेतावनी' :
                       currentLang.startsWith('ta') ? 'வானிலை / சென்சார் குரல் எச்சரிக்கை' :
                       currentLang.startsWith('kn') ? 'ಹವಾಮಾನ / ಸಂವೇದಕ ಧ್ವನಿ ಎಚ್ಚರಿಕೆ' :
                       currentLang.startsWith('ml') ? 'കാലാവസ്ഥ / സെൻസർ ശബ്ദ മുന്നറിയിപ്പ്' :
                       currentLang.startsWith('or') ? 'ପାଣିପାଗ / ସେନ୍ସର ଭଏସ ସତର୍କତା' :
                       'Weather / Sensor Voice Alert'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">0:18</span>
                  </div>

                  {/* Pulsing Audio Waves */}
                  <div className="flex items-center gap-1 h-5 mt-1">
                    {[45, 80, 55, 95, 60, 85, 50, 90, 65, 75, 85, 50, 40, 70, 85, 45, 30].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`w-1 rounded-full transition-all ${
                          isPlayingSystemAudio
                            ? 'bg-blue-500 dark:bg-blue-400 animate-pulse'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Share Alert on WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{isTelugu ? '📢 వాట్సాప్‌లో షేర్ చేయండి' : '📢 Share Alert on WhatsApp'}</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PATTERN C: EQUIPMENT PROVIDER BOOKING & 2-WAY AUDIO MESSAGING
            Interactive 2-way conversation, ticket voucher with accurate
            village details, map preview, voice recording & audio notes.
           ══════════════════════════════════════════════════════════════ */}
        {isBooking && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Dynamic Status Resolution for Card */}
            {(() => {
              const normStatus = String(bookingStatus || message?.status || 'pending').toLowerCase();
              const isConfirmed = normStatus === 'confirmed' || normStatus === 'accepted';
              const isInquiry = normStatus === 'inquiry';
              const isRejected = normStatus === 'rejected' || normStatus === 'declined';
              const isCompleted = normStatus === 'completed';

              let statusText = isTelugu ? 'బుకింగ్ అభ్యర్థన పెండింగ్‌లో ఉంది' : 'Booking Request Pending';
              let statusBadgeText = isTelugu ? 'పెండింగ్‌లో ఉంది' : 'Pending';
              let statusTextColor = 'text-amber-600 dark:text-amber-400';
              let statusBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30';
              let statusIcon = <Clock className="w-3.5 h-3.5" />;
              let statusIconBoxClass = 'bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400';
              let cardBorderClass = 'border-slate-200/90 dark:border-slate-700/60 hover:border-amber-500/50';

              if (isConfirmed) {
                statusText = isTelugu ? 'బుకింగ్ ధృవీకరించబడింది' : 'Machinery Booking Confirmed';
                statusBadgeText = isTelugu ? 'ధృవీకరించబడింది' : 'Confirmed';
                statusTextColor = 'text-emerald-600 dark:text-emerald-400';
                statusBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30';
                statusIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
                statusIconBoxClass = 'bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
                cardBorderClass = 'border-slate-200/90 dark:border-emerald-500/30 hover:border-emerald-500/50';
              } else if (isInquiry) {
                statusText = isTelugu ? 'యంత్ర అద్దె విచారణ' : 'Machinery Rental Inquiry';
                statusBadgeText = isTelugu ? 'విచారణ' : 'Inquiry';
                statusTextColor = 'text-sky-600 dark:text-sky-400';
                statusBadgeClass = 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30';
                statusIcon = <MessageSquare className="w-3.5 h-3.5" />;
                statusIconBoxClass = 'bg-sky-500/15 dark:bg-sky-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-400';
                cardBorderClass = 'border-slate-200/90 dark:border-sky-500/30 hover:border-sky-500/50';
              } else if (isRejected) {
                statusText = isTelugu ? 'బుకింగ్ తిరస్కరించబడింది' : 'Booking Declined';
                statusBadgeText = isTelugu ? 'తిరస్కరించబడింది' : 'Declined';
                statusTextColor = 'text-rose-600 dark:text-rose-400';
                statusBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30';
                statusIcon = <AlertOctagon className="w-3.5 h-3.5" />;
                statusIconBoxClass = 'bg-rose-500/15 dark:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400';
                cardBorderClass = 'border-slate-200/90 dark:border-rose-500/30 hover:border-rose-500/50';
              } else if (isCompleted) {
                statusText = isTelugu ? 'పని పూర్తయింది' : 'Work Completed';
                statusBadgeText = isTelugu ? 'పూర్తయింది' : 'Completed';
                statusTextColor = 'text-indigo-600 dark:text-indigo-400';
                statusBadgeClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30';
                statusIcon = <ShieldCheck className="w-3.5 h-3.5" />;
                statusIconBoxClass = 'bg-indigo-500/15 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400';
                cardBorderClass = 'border-slate-200/90 dark:border-indigo-500/30 hover:border-indigo-500/50';
              }

              return (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setShowFullReview(true)}
                  className={`rounded-3xl bg-white dark:bg-gradient-to-br dark:from-[#16231e] dark:to-[#121921] border ${cardBorderClass} p-4 shadow-sm relative overflow-hidden cursor-pointer transition-all group`}
                >
                  {/* Top Row: Machine & Badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform ${statusIconBoxClass}`}>
                        <Truck className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                          {bookingEquipmentTitle}
                        </h3>
                        <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1 ${statusTextColor}`}>
                          {statusIcon}
                          <span>{statusText}</span>
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusBadgeClass}`}>
                      {statusBadgeText}
                    </span>
                  </div>

                  {/* Middle Divider with Ticket Cutouts */}
                  <div className="relative my-3 border-t border-dashed border-slate-200 dark:border-slate-700/60">
                    <div className="absolute -left-6 -top-2 w-4 h-4 rounded-full bg-[#f3f5fa] dark:bg-[#0d1117]" />
                    <div className="absolute -right-6 -top-2 w-4 h-4 rounded-full bg-[#f3f5fa] dark:bg-[#0d1117]" />
                  </div>

                  {/* Exact Village Location Details */}
                  <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 text-xs space-y-1 mb-2">
                    <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="text-[11px]">{isTelugu ? 'గ్రామ లొకేషన్:' : 'Village Location:'}</span>
                      <span className="text-[12px] font-black text-slate-900 dark:text-white">{bookingLocationDisplay}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 pl-5">
                      <span>{bookingAcres} Acres</span> • <span>⚙️ {bookingOperation}</span>
                    </div>
                  </div>

                  {/* Bottom Row: Date, Time & Cost */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="text-slate-600 dark:text-slate-300 font-medium">
                      <span>{bookingDate}</span> • <span className="text-emerald-600 dark:text-emerald-300 font-bold">{bookingTimeSlot}</span>
                    </div>
                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      ₹{bookingTotalCost}
                    </div>
                  </div>

                  {/* Voucher Subtext Footer */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>{isTelugu ? (isConfirmed ? 'ధృవీకరించబడిన వోచర్ • వివరాలు చూడండి' : 'బుకింగ్ సమాచారం • వివరాలు చూడండి') : (isConfirmed ? 'Confirmed voucher • Tap for details' : 'Booking status & review • Tap for details')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>{isTelugu ? 'వివరాలు' : 'Details'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </motion.div>
              );
            })()}

            {/* 2-Way Chat Stream Bubbles */}
            <div className="space-y-3 pt-2">
              {chatMessages.map((msg) => {
                if (msg.type === 'system_notice') {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-center my-2"
                    >
                      <div className="px-3.5 py-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700 shadow-xs flex items-center gap-1.5 max-w-[90%] text-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{msg.text}</span>
                        <span className="text-[9px] text-slate-400 font-mono ml-1">{msg.time}</span>
                      </div>
                    </motion.div>
                  );
                }

                const isMyMessage = msg.sender === mySenderRole;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    {!isMyMessage && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1">
                        {msg.senderName || (msg.sender === 'provider' ? (isTelugu ? 'పరికర ప్రొవైడర్' : 'Equipment Provider') : (isTelugu ? 'రైతు' : 'Farmer'))}
                      </span>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-md rounded-3xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                        isMyMessage
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-500/10'
                          : 'bg-white dark:bg-[#161b22] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {/* Message Content: Voice Note Audio Bubble OR Text with TTS */}
                      {msg.type === 'voice_note' || msg.audioUrl ? (
                        <VoiceNoteBubble msg={msg} isMyMessage={isMyMessage} isTelugu={isTelugu} />
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          {msg.text && (
                            <p className="whitespace-pre-line font-medium leading-relaxed flex-1">
                              {msg.text}
                            </p>
                          )}
                          {msg.text && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speak(msg.text, `msg_${msg.id}`, currentLang, 0.85);
                              }}
                              className={`p-1.5 rounded-full transition-all shrink-0 cursor-pointer ${
                                speakingId === `msg_${msg.id}`
                                  ? 'bg-amber-400 text-slate-950 animate-pulse'
                                  : (isMyMessage
                                      ? 'bg-blue-500/50 hover:bg-blue-500 text-white'
                                      : 'bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300')
                              }`}
                              title={isTelugu ? 'వినండి (ఆడియో)' : 'Listen to message'}
                            >
                              {speakingId === `msg_${msg.id}` ? (
                                <VolumeX className="w-3.5 h-3.5" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Map Location Card (Manual intentional attachment only) */}
                      {msg.location && (
                        <div className="mt-2.5 rounded-2xl bg-black/30 border border-white/10 p-2.5 overflow-hidden shadow-inner space-y-2">
                          <div className="h-24 rounded-xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950 flex flex-col items-center justify-center relative border border-emerald-500/20 group">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-md">
                              <MapPin className="w-4 h-4 fill-emerald-400 text-emerald-900" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-300 mt-1 relative z-10">
                              {isTelugu ? 'గ్రామ GPS' : 'Village GPS Location'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <span className="text-[11px] font-black text-white block">
                                {isTelugu
                                  ? (msg.location.teluguName || `${msg.location.village || bookingVillage} గ్రామం`)
                                  : (msg.location.name || `${msg.location.village || bookingVillage} Village`)}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {msg.location.coords}
                              </span>
                            </div>
                            <a
                              href={msg.location.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(msg.location.coords || msg.location.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{isTelugu ? 'మ్యాప్స్' : 'Maps'}</span>
                            </a>
                          </div>
                        </div>
                      )}

                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMyMessage ? 'text-blue-100' : 'text-slate-400'}`}>
                        <span>{msg.time}</span>
                        {isMyMessage && <CheckCheck className="w-3.5 h-3.5 text-blue-100 inline ml-0.5" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. BOTTOM FOOTER / INPUT CONTROLS ─── */}
      {isBooking ? (
        /* Real Two-Way Interactive Messenger Bar */
        <div className="bg-white dark:bg-[#161b22] border-t border-slate-200/90 dark:border-slate-800 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg">
          {/* Active Reply Composer Form */}
          <footer className="p-2 sm:p-3 relative">
            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-16 left-3 sm:left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-3 shadow-2xl space-y-1.5 z-30 text-xs w-68 sm:w-72"
                >
                  {/* Share Village Location (FARMER ONLY - completely hidden from provider side) */}
                  {!isProviderViewer && (
                    <button
                      type="button"
                      onClick={handleSendLiveLocation}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold block text-slate-900 dark:text-white">
                          {isTelugu ? 'గ్రామ లొకేషన్ పంపండి' : 'Share Village Location'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {bookingVillage} {isTelugu ? 'గ్రామం' : 'Village'}
                        </span>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowFullReview(true);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900 dark:text-white">{isTelugu ? 'బుకింగ్ వోచర్ చూడండి' : 'View Booking Voucher'}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{isTelugu ? 'ధర & బుకింగ్ రసీదు' : 'Rates, dates & machine info'}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      handleSendMessage(
                        isProviderViewer
                          ? (isTelugu ? 'ట్రాక్టర్ బయలుదేరింది, 20 నిమిషాల్లో చేరుకుంటుంది.' : 'Tractor is dispatched, reaching your field in 20 minutes.')
                          : (isTelugu ? 'ట్రాక్టర్ బయలుదేరినప్పుడు దయచేసి నాకు కాల్ చేయండి.' : 'Please call me when the tractor departs.')
                      );
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900 dark:text-white">
                        {isProviderViewer
                          ? (isTelugu ? 'రైతుకు వెంటనే తెలియజేయండి' : 'Notify farmer of departure')
                          : (isTelugu ? 'డ్రైవర్ బయలుదేరినప్పుడు కాల్' : 'Notify upon departure')}
                      </span>
                    </div>
                  </button>

                  {/* Call Contact (Farmer or Provider) */}
                  <a
                    href={`tel:${isProviderViewer ? cleanFarmerPhone : cleanProviderPhone}`}
                    onClick={() => setShowAttachMenu(false)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900 dark:text-white">
                        {isProviderViewer
                          ? (isTelugu ? 'రైతుకు కాల్ చేయండి' : 'Call Farmer')
                          : (isTelugu ? 'ప్రొవైడర్‌కు కాల్ చేయండి' : 'Call Provider')}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {isProviderViewer ? bookingFarmerPhone : bookingProviderPhone}
                      </span>
                    </div>
                  </a>

                  {/* Direct WhatsApp Message */}
                  <a
                    href={`https://wa.me/${isProviderViewer ? cleanFarmerPhone : cleanProviderPhone}?text=${encodeURIComponent(
                      isProviderViewer
                        ? `Hello ${bookingFarmerName}, regarding your machinery booking #${canonicalBookingId} on AgriShield...`
                        : `Hello ${bookingProviderName}, regarding my machinery booking #${canonicalBookingId} on AgriShield...`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowAttachMenu(false)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900 dark:text-white">
                        {isTelugu ? 'వాట్సాప్‌లో మాట్లాడండి' : 'Chat on WhatsApp'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isTelugu ? 'తక్షణ వాట్సాప్ సందేశం' : 'Direct WhatsApp chat'}
                      </span>
                    </div>
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 max-w-4xl mx-auto"
            >
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className={`p-2.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  showAttachMenu
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
                title={isTelugu ? "జోడించండి" : "Attach / Options"}
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {isRecordingVoice ? (
                <div className="flex-1 flex items-center justify-between py-2 px-3.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 shadow-inner">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-0.5 ml-1.5 shrink-0">
                      <span className="w-1 h-2.5 bg-rose-500 rounded-full animate-pulse" />
                      <span className="w-1 h-4 bg-rose-600 rounded-full animate-bounce" />
                      <span className="w-1 h-2 bg-rose-400 rounded-full animate-pulse" />
                      <span className="w-1 h-5 bg-rose-600 rounded-full animate-bounce" />
                      <span className="w-1 h-3 bg-rose-500 rounded-full animate-pulse" />
                    </div>
                    <span className="text-[11px] font-semibold text-rose-500 truncate hidden sm:inline ml-1">
                      {isTelugu ? 'వాయిస్ రికార్డ్ అవుతోంది...' : 'Recording voice note...'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="p-1.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
                      title={isTelugu ? 'రద్దు చేయండి' : 'Discard recording'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSendVoiceRecording}
                      className="py-1 px-3 sm:px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer transition-transform active:scale-95"
                      title={isTelugu ? 'వాయిస్ సందేశం పంపండి' : 'Send Voice Note'}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isTelugu ? 'పంపండి' : 'Send'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        isProviderViewer
                          ? (isTelugu ? 'రైతుకు సందేశం టైప్ చేయండి...' : 'Type message to Farmer...')
                          : (isTelugu ? 'ప్రొవైడర్‌కు సందేశం టైప్ చేయండి...' : 'Type message to Provider...')
                      }
                      className="w-full py-2.5 pl-4 pr-11 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      className={`absolute right-2 p-1.5 rounded-full transition-all cursor-pointer ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/40'
                          : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={isTelugu ? 'వాయిస్ టైపింగ్ (మైక్రోఫోన్)' : 'Voice typing (Microphone)'}
                    >
                      <Mic className={`w-4 h-4 ${isListening ? 'animate-bounce' : ''}`} />
                    </button>
                  </div>

                  {inputText.trim() ? (
                    <button
                      type="submit"
                      className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 cursor-pointer shrink-0"
                      title={isTelugu ? "పంపండి" : "Send"}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-transform active:scale-95 cursor-pointer shrink-0 flex items-center justify-center group"
                      title={isTelugu ? "వాయిస్ మెసేజ్ రికార్డ్ చేయండి" : "Record voice message"}
                    >
                      <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </>
              )}
            </form>
          </footer>
        </div>
      ) : (
        /* Pattern A & B Strictly Read-Only Footer Banner (No Reply Composer) */
        <footer className="p-3.5 bg-white dark:bg-[#161b22] border-t border-slate-200/90 dark:border-slate-800 shrink-0">
          <div className="max-w-md mx-auto py-2.5 px-4 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {isDisease
                ? (isTelugu ? 'స్వయంచాలక నిర్ధారణ సలహా • ప్రత్యుత్తరం సాధ్యం కాదు' : 'Automated diagnostic advisory. Replies are disabled.')
                : (isTelugu ? 'సిస్టమ్ నోటీస్ బ్రాడ్‌కాస్ట్ • ప్రత్యుత్తరం అనుమతించబడదు' : 'System notice broadcast. Replies are disabled.')}
            </span>
          </div>
        </footer>
      )}

      {/* ─── 4. FULL DETAIL REVIEW MODAL (Voucher & Order Scope) ─── */}
      <AnimatePresence>
        {showFullReview && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 bg-[#161b22] border-b border-slate-800 shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullReview(false)}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-sm font-black text-white">
                  {isBooking
                    ? (isTelugu ? '🚜 బుకింగ్ వోచర్ & పని వివరాలు' : '🚜 Machinery Booking Voucher')
                    : (isTelugu ? 'పూర్తి AI నిర్ధారణ నివేదిక' : 'Full Diagnostic Advisory')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullReview(false)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4">
              {isBooking ? (
                <>
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/30 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      {isTelugu ? 'ధృవీకరించబడిన బుకింగ్' : 'Verified Machinery Booking'}
                    </span>
                    <h2 className="text-lg font-black text-white">{bookingEquipmentTitle}</h2>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-400">Total Rental Fare</span>
                      <span className="text-xl font-black text-emerald-400">₹{bookingTotalCost}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-emerald-400" />
                      <span>{isTelugu ? 'యంత్రాల ప్రదాత సమాచారం' : 'Equipment Provider Details'}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'ప్రదాత / సేవా కేంద్రం' : 'Provider Service Hub'}</span>
                        <span className="text-sm font-black text-white mt-0.5 block">{bookingProviderName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'హబ్ హెల్ప్‌లైన్' : 'Hub Helpline'}</span>
                        <span className="text-sm font-black text-white mt-0.5 block">{bookingProviderPhone}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <a
                        href={`tel:${cleanProviderPhone}`}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{isTelugu ? 'ప్రొవైడర్‌కు కాల్' : 'Call Provider'}</span>
                      </a>
                      <a
                        href={`https://wa.me/${cleanProviderPhone}?text=${encodeURIComponent(`Hello, regarding booking #${rawBookingId}...`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{isTelugu ? 'పని వివరాలు & ఖచ్చితమైన స్థలం' : 'Field Work Scope & Exact Location'}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'గ్రామం / ప్రదేశం' : 'Village / Location'}</span>
                        <span className="text-xs font-black text-emerald-300 mt-0.5 block">{bookingLocationDisplay}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'పని రకం' : 'Operation'}</span>
                        <span className="text-xs font-black text-indigo-300 mt-0.5 block">⚙️ {bookingOperation}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'విస్తీర్ణం' : 'Total Area'}</span>
                        <span className="text-xs font-bold text-white mt-0.5 block">{bookingAcres} Acres</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'షెడ్యూల్' : 'Schedule'}</span>
                        <span className="text-xs font-bold text-white mt-0.5 block">{bookingDate} ({bookingTimeSlot})</span>
                      </div>
                    </div>
                  </div>

                  {isProvider && (
                    <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        {isTelugu ? 'ప్రొవైడర్ చర్యలు' : 'Provider Order Actions'}
                      </h4>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateBookingStatus('confirmed')}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isTelugu ? 'ఆమోదించండి' : 'Accept'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBookingStatus('rejected')}
                          className="py-2.5 px-4 rounded-xl border border-rose-800 text-rose-400 hover:bg-rose-950 font-bold text-xs cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>{isTelugu ? 'తిరస్కరించండి' : 'Decline'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!isProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFullReview(false);
                        navigate('/equipment');
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <Truck className="w-4 h-4" />
                      <span>{isTelugu ? 'నా బుకింగ్‌ల పేజీకి వెళ్లండి' : 'Open My Equipment Bookings'}</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {parsedInfo.disease && (
                    <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-400">Detected Pathology</h4>
                      <p className="text-base font-black text-rose-400">{parsedInfo.disease}</p>
                      {parsedInfo.confidence && (
                        <p className="text-xs text-emerald-400">{parsedInfo.confidence}% AI Neural Confidence</p>
                      )}
                    </div>
                  )}
                  {parsedInfo.advisory?.chemicals && (
                    <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-400">Chemical Spray Advisory</h4>
                      {parsedInfo.advisory.chemicals.map((c, i) => (
                        <p key={i} className="text-xs text-slate-200">• {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowFullReview(false)}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                {isTelugu ? 'వెనుకకు' : 'Back'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
