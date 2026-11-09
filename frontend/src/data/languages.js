// AgriShield Multi-Language Configuration
// 7 Supported Regional Languages with English as Fallback
export const SUPPORTED_LANGUAGES = [
  { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English (US)', 
    flag: '🌐', 
    greeting: 'Welcome', 
    region: 'Global / All Regions' 
  },
  { 
    code: 'te', 
    name: 'Telugu', 
    nativeName: 'తెలుగు', 
    flag: '🌾', 
    greeting: 'నమస్కారం', 
    region: 'ఆంధ్రప్రదేశ్ & తెలంగాణ (AP & TS)' 
  },
  { 
    code: 'ta', 
    name: 'Tamil', 
    nativeName: 'தமிழ்', 
    flag: '🌾', 
    greeting: 'வணக்கம்', 
    region: 'தமிழ்நாடு (Tamil Nadu)' 
  },
  { 
    code: 'kn', 
    name: 'Kannada', 
    nativeName: 'ಕನ್ನಡ', 
    flag: '🌾', 
    greeting: 'ನಮಸ್ಕಾರ', 
    region: 'ಕರ್ನಾಟಕ (Karnataka)' 
  },
  { 
    code: 'hi', 
    name: 'Hindi', 
    nativeName: 'हिंदी', 
    flag: '🇮🇳', 
    greeting: 'नमस्ते', 
    region: 'उत्तर भारत (North India)' 
  },
  { 
    code: 'ml', 
    name: 'Malayalam', 
    nativeName: 'മലയാളം', 
    flag: '🌴', 
    greeting: 'നമസ്കാരം', 
    region: 'കേരളം (Kerala)' 
  },
  { 
    code: 'mr', 
    name: 'Marathi', 
    nativeName: 'मराठी', 
    flag: '🌿', 
    greeting: 'नमस्कार', 
    region: 'महाराष्ट्र (Maharashtra)' 
  },
  { 
    code: 'bn', 
    name: 'Bengali', 
    nativeName: 'বাংলা', 
    flag: '🍃', 
    greeting: 'নমস্কার', 
    region: 'পশ্চিমবঙ্গ (West Bengal)' 
  },
  { 
    code: 'gu', 
    name: 'Gujarati', 
    nativeName: 'ગુજરાતી', 
    flag: '🚜', 
    greeting: 'નમસ્તે', 
    region: 'ગુજરાત (Gujarat)' 
  },
  { 
    code: 'pa', 
    name: 'Punjabi', 
    nativeName: 'ਪੰਜਾਬੀ', 
    flag: '🌾', 
    greeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 
    region: 'ਪੰਜਾਬ (Punjab)' 
  },
  { 
    code: 'or', 
    name: 'Odia', 
    nativeName: 'ଓଡ଼ିଆ', 
    flag: '🌾', 
    greeting: 'ନମସ୍କାର', 
    region: 'ଓଡ଼ିଶା (Odisha)' 
  },
  { 
    code: 'ur', 
    name: 'Urdu', 
    nativeName: 'اردو', 
    flag: '✨', 
    greeting: 'آداب', 
    region: 'تہذیبی خطہ (National)' 
  },
  { 
    code: 'as', 
    name: 'Assamese', 
    nativeName: 'অসমীয়া', 
    flag: '🍵', 
    greeting: 'নমস্কাৰ', 
    region: 'অসম (Assam)' 
  }
];

export const getLanguageByCode = (code) => {
  if (!code) return SUPPORTED_LANGUAGES[0]; // English fallback
  const normalized = code.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.find(l => l.code === normalized) || SUPPORTED_LANGUAGES[0];
};
