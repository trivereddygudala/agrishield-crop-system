// AgriShield Multi-Language Configuration
// 12 Supported Indian Regional Languages + English
export const SUPPORTED_LANGUAGES = [
  { 
    code: 'te', 
    name: 'Telugu', 
    nativeName: 'తెలుగు', 
    flag: '🌾', 
    greeting: 'నమస్కారం', 
    region: 'ఆంధ్రప్రదేశ్ & తెలంగాణ (AP & TS)' 
  },
  { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English (US)', 
    flag: '🌐', 
    greeting: 'Welcome', 
    region: 'Global / All Regions' 
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
    flag: '🌾', 
    greeting: 'नमस्कार', 
    region: 'महाराष्ट्र (Maharashtra)' 
  },
  { 
    code: 'gu', 
    name: 'Gujarati', 
    nativeName: 'ગુજરાતી', 
    flag: '🌾', 
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
    code: 'ur', 
    name: 'Urdu', 
    nativeName: 'اردو', 
    flag: '🌾', 
    greeting: 'سلام', 
    region: 'National' 
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
    code: 'as', 
    name: 'Assamese', 
    nativeName: 'অসমীয়া', 
    flag: '🍃', 
    greeting: 'নমস্কাৰ', 
    region: 'অসম (Assam)' 
  }
];

export const getLanguageByCode = (code) => {
  if (!code) return SUPPORTED_LANGUAGES[0];
  const normalized = code.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.find(l => l.code === normalized) || SUPPORTED_LANGUAGES[1]; // default English
};
