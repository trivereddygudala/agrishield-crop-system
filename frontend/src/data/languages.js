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
    code: 'or', 
    name: 'Odia', 
    nativeName: 'ଓଡ଼ିଆ', 
    flag: '🌾', 
    greeting: 'ନମସ୍କାର', 
    region: 'ଓଡ଼ିଶା (Odisha)' 
  }
];

export const getLanguageByCode = (code) => {
  if (!code) return SUPPORTED_LANGUAGES[0]; // English fallback
  const normalized = code.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.find(l => l.code === normalized) || SUPPORTED_LANGUAGES[0];
};
