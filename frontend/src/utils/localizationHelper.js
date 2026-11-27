/**
 * AgriShield 8-Language Dynamic Localization Helper
 * Official supported languages: en, te, ta, kn, hi, ml, mr, or
 */

export const SUPPORTED_LANGUAGES = ['en', 'te', 'ta', 'kn', 'hi', 'ml', 'mr', 'or'];

export const SPEECH_LANG_MAP = {
  en: 'en-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  or: 'or-IN'
};

/**
 * Normalizes language string to one of the 8 supported languages.
 * Default is 'en'.
 */
export function normalizeLanguage(lang = 'en') {
  if (!lang) return 'en';
  const code = String(lang).split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.includes(code) ? code : 'en';
}

/**
 * Resolves localized field from dynamic entity objects.
 * Supports:
 * 1. Nested objects: entity[lang]?.[field], entity.translations?.[lang]?.[field]
 * 2. CamelCase suffix: entity[`${field}${Lang}`] (e.g. nameTe, nameTa, nameKn, etc.)
 * 3. Snake_case suffix: entity[`${field}_${lang}`] (e.g. name_te, name_ta, etc.)
 * 4. Legacy Telugu fields: entity[`telugu${Field}`], entity.teluguName, entity[`${field}Telugu`]
 * 5. English fallback: entity[field], entity[`${field}En`], entity[`${field}_en`]
 */
export function getLocalizedField(entity, fieldName, lang = 'en') {
  if (!entity || typeof entity !== 'object' || !fieldName) return '';
  const cleanLang = normalizeLanguage(lang);

  // 1. Nested language objects
  if (entity[cleanLang] && typeof entity[cleanLang] === 'object' && entity[cleanLang][fieldName] != null) {
    return entity[cleanLang][fieldName];
  }
  if (entity.translations?.[cleanLang]?.[fieldName] != null) {
    return entity.translations[cleanLang][fieldName];
  }
  if (entity.locales?.[cleanLang]?.[fieldName] != null) {
    return entity.locales[cleanLang][fieldName];
  }

  // 2. Direct language field with CamelCase (e.g. nameTe, nameTa, nameKn, etc.)
  const capLang = cleanLang.charAt(0).toUpperCase() + cleanLang.slice(1);
  const camelKey = `${fieldName}${capLang}`;
  if (entity[camelKey] != null && entity[camelKey] !== '') {
    return entity[camelKey];
  }

  // 3. Direct language field with snake_case (e.g. name_te, name_ta, etc.)
  const snakeKey = `${fieldName}_${cleanLang}`;
  if (entity[snakeKey] != null && entity[snakeKey] !== '') {
    return entity[snakeKey];
  }

  // 4. Legacy Telugu-specific fields (e.g. teluguName, telugu_name, nameTelugu, etc.)
  if (cleanLang === 'te') {
    const capField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    const legacyKeys = [
      `telugu${capField}`,
      `telugu_${fieldName}`,
      `${fieldName}Telugu`
    ];
    for (const k of legacyKeys) {
      if (entity[k] != null && entity[k] !== '') {
        return entity[k];
      }
    }
  }

  // 5. English direct check
  if (cleanLang === 'en') {
    if (entity[fieldName] != null && entity[fieldName] !== '') {
      return entity[fieldName];
    }
    const capField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    const enVariants = [`${fieldName}En`, `${fieldName}_en`, `english${capField}`];
    for (const k of enVariants) {
      if (entity[k] != null && entity[k] !== '') {
        return entity[k];
      }
    }
  }

  // 6. English Fallback
  const capField = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  const fallbacks = [
    entity[fieldName],
    entity[`${fieldName}En`],
    entity[`${fieldName}_en`],
    entity[`english${capField}`],
    entity.en?.[fieldName],
    entity.translations?.en?.[fieldName],
    // If only legacy Telugu exists and nothing else, return it as final resort
    entity[`${fieldName}Te`],
    entity[`telugu${capField}`]
  ];

  for (const fb of fallbacks) {
    if (fb != null && fb !== '') {
      if (fieldName === 'title' && typeof fb === 'string' && cleanLang !== 'en') {
        return localizeEquipmentText(fb, cleanLang);
      }
      return fb;
    }
  }

  return '';
}

export const EQUIPMENT_TERMS = {
  'Spraying Drone': { te: 'స్ప్రేయింగ్ డ్రోన్', hi: 'स्प्रेइंग ड्रोन', ta: 'தெளிப்பு ட்ரோன்', kn: 'ಸಿಂಪಡಣೆ ಡ್ರೋನ್', ml: 'സ്പ്രേയിംഗ് ഡ്രോൺ', mr: 'फवारणी ड्रोन', or: 'ସ୍ପ୍ରେୟିଂ ଡ୍ରୋନ୍' },
  'Combine Harvester': { te: 'కంబైన్ హార్వెస్టర్', hi: 'कंबाइन हार्वेस्टर', ta: 'கம்பைன் அறுவடை இயந்திரம்', kn: 'ಕಂಬೈನ್ ಕೊಯ್ಲು ಯಂತ್ರ', ml: 'കംബൈൻ കൊയ്ത്തുയന്ത്രം', mr: 'कंबाईन हार्वेस्टर', or: 'କମ୍ବାଇନ୍ ହାର୍ଭେଷ୍ଟର' },
  'Irrigation Pump': { te: 'నీటిపారుదల పంపు', hi: 'सिंचाई पंप', ta: 'பாசன பம்ப்', kn: 'ನೀರಾವರಿ ಪಂಪ್', ml: 'ജലസേചന പമ്പ്', mr: 'सिंचन पंप', or: 'ଜଳସେଚନ ପମ୍ପ' },
  'Solar Pump': { te: 'సోలార్ పంప్', hi: 'सोलर पंप', ta: 'சோலார் பம்ப்', kn: 'ಸೋಲಾರ್ ಪಂಪ್', ml: 'സോളാർ പമ്പ്', mr: 'सौर पंप', or: 'ସୌର ପମ୍ପ' },
  'Diesel Pump': { te: 'డీజిల్ పంప్', hi: 'डीजल पंप', ta: 'டீசல் பம்ப்', kn: 'ಡೀಸೆಲ್ ಪಂಪ್', ml: 'ഡീസൽ പമ്പ്', mr: 'डिझेल पंप', or: 'ଡିଜେଲ୍ ପମ୍ପ' },
  'Laser Leveler': { te: 'లేజర్ లెవెలర్', hi: 'लेजर लेवलर', ta: 'லேசர் சமன்படுத்தி', kn: 'ಲೇಸರ್ ಲೆವೆಲರ್', ml: 'ലേസർ ലെവലർ', mr: 'लेझर लेव्हलर', or: 'ଲେଜର ଲେଭେଲର୍' },
  'Power Tiller': { te: 'పవర్ టిల్లర్', hi: 'पावर टिलर', ta: 'பவர் டில்லர்', kn: 'ಪವರ್ ಟಿಲ್ಲರ್', ml: 'പവർ ടില്ലർ', mr: 'पॉवर टिलर', or: 'ପାୱାର୍ ଟିଲର୍' },
  'Seed Drill': { te: 'విత్తన గొర్రు', hi: 'सीड ड्रिल', ta: 'விதைப்புக் கருவி', kn: 'ಸೀಡ್ ಡ್ರಿಲ್', ml: 'സീഡ് ഡ്രിൽ', mr: 'सीड ड्रिल', or: 'ସିଡ୍ ଡ୍ରିଲ୍' },
  'Tractor': { te: 'ట్రాక్టర్', hi: 'ट्रैक्टर', ta: 'டிராக்டர்', kn: 'ಟ್ರ್ಯಾಕ್ಟರ್', ml: 'ട്രാക്ടർ', mr: 'ट्रॅक्टर', or: 'ଟ୍ରାକ୍ଟର' },
  'Drone': { te: 'డ్రోన్', hi: 'ड्रोन', ta: 'ட்ரோன்', kn: 'ಡ್ರೋನ್', ml: 'ഡ്രോൺ', mr: 'ड्रोन', or: 'ଡ୍ରୋନ୍' },
  'Harvester': { te: 'హార్వెస్టర్', hi: 'हार्वेस्टर', ta: 'அறுவடை இயந்திரம்', kn: 'ಕೊಯ್ಲು ಯಂತ್ರ', ml: 'കൊയ്ത്തുയന്ത്രം', mr: 'हार्वेस्टर', or: 'ହାର୍ଭେଷ୍ଟର' },
  'Rotavator': { te: 'రోటవేటర్', hi: 'रोटावेटर', ta: 'ரோட்டவேட்டர்', kn: 'ರೋಟವೇಟರ್', ml: 'റോട്ടവേറ്റർ', mr: 'रोटाव्हेटर', or: 'ରୋଟାଭେଟର' },
  'Cultivator': { te: 'కల్టివేటర్', hi: 'कल्टीवेटर', ta: 'கல்டிவேட்டர்', kn: 'ಕಲ್ಟಿವೇಟರ್', ml: 'കൾട്ടിവേറ്റർ', mr: 'कल्टिव्हेटर', or: 'କଲ୍ଟିଭେଟର୍' },
  'Subsoiler': { te: 'సబ్‌సాయిలర్', hi: 'सबसॉइलर', ta: 'சப்சாயிலர்', kn: 'ಸಬ್‌ಸಾಯಿಲರ್', ml: 'സബ്സോയിലർ', mr: 'सबसॉइलर', or: 'ସବସଏଲର' },
  'Mulcher': { te: 'మల్చర్', hi: 'मल्चर', ta: 'மல்ச்சர்', kn: 'ಮಲ್ಚರ್', ml: 'മൽച്ചർ', mr: 'मल्चर', or: 'ମଲଚର' },
  'Trolley': { te: 'ట్రాలీ', hi: 'ट्रॉली', ta: 'டிராலி', kn: 'ಟ್ರಾಲಿ', ml: 'ട്രോളി', mr: 'ट्रॉली', or: 'ଟ୍ରଲି' }
};

export function localizeEquipmentText(text = '', lang = 'en') {
  if (!text || typeof text !== 'string') return text;
  const cleanLang = normalizeLanguage(lang);
  if (cleanLang === 'en') return text;

  let localized = text;
  const sortedTerms = Object.keys(EQUIPMENT_TERMS).sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    const translation = EQUIPMENT_TERMS[term]?.[cleanLang];
    if (translation) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      localized = localized.replace(regex, translation);
    }
  }
  return localized;
}

export const MEASUREMENT_UNITS = {
  ml: { en: 'ml', te: 'మి.లీ', ta: 'மி.லி', kn: 'ಮಿ.ಲೀ', hi: 'मि.ली', ml: 'മി.ലി', mr: 'मि.ली', or: 'ମି.ଲି' },
  g: { en: 'g', te: 'గ్రా', ta: 'கி', kn: 'ಗ್ರಾಂ', hi: 'ग्रा', ml: 'ഗ്രാം', mr: 'ग्रॅम', or: 'ଗ୍ରା' },
  kg: { en: 'kg', te: 'కి.గ్రా', ta: 'கிலோ', kn: 'ಕೆ.ಜಿ', hi: 'कि.ग्रा', ml: 'കി.ഗ്രാം', mr: 'कि.ग्रॅ.', or: 'କି.ଗ୍ରା' },
  l: { en: 'L', te: 'లీ', ta: 'லி', kn: 'ಲೀ', hi: 'ली', ml: 'ലി', mr: 'ली', or: 'ଲି' },
  acre: { en: 'acre', te: 'ఎకరం', ta: 'ஏக்கர்', kn: 'ಎಕರೆ', hi: 'एकड़', ml: 'ഏക്കർ', mr: 'एकर', or: 'ଏକର' },
  hectare: { en: 'hectare', te: 'హెక్టారు', ta: 'ஹெக்டேர்', kn: 'ಹೆಕ್ಟೇರ್', hi: 'हेक्टेयर', ml: 'ഹെക്ടർ', mr: 'हेक्टर', or: 'ହେକ୍ଟର' }
};

/**
 * Localizes common measurement units across all 7 languages.
 */
export function formatMeasurementUnit(unit = '', lang = 'en') {
  if (!unit) return '';
  const cleanLang = normalizeLanguage(lang);
  const lowerUnit = String(unit).trim().toLowerCase();
  const entry = MEASUREMENT_UNITS[lowerUnit];
  if (entry && entry[cleanLang]) {
    return entry[cleanLang];
  }
  return unit;
}

/**
 * Returns BCP-47 speech tag and voice object matching available browser voices.
 * Includes graceful browser fallback if Odia voice is unavailable.
 */
export function getVoiceForLanguage(lang = 'en', availableVoices = []) {
  const cleanLang = normalizeLanguage(lang);
  const preferredTag = SPEECH_LANG_MAP[cleanLang] || 'en-IN';

  if (!Array.isArray(availableVoices) || availableVoices.length === 0) {
    return { bcp47: preferredTag, voice: null };
  }

  // 1. Direct tag match (e.g. 'te-IN')
  let matchedVoice = availableVoices.find(v => v.lang && v.lang.toLowerCase() === preferredTag.toLowerCase());

  // 2. Prefix match (e.g. 'te')
  if (!matchedVoice) {
    matchedVoice = availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith(`${cleanLang}-`));
  }

  // 3. Fallback for Odia ('or') if browser lacks Odia voice: fallback to Hindi (hi-IN) or English (en-IN)
  if (!matchedVoice && cleanLang === 'or') {
    matchedVoice = availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi-')) ||
                   availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-'));
  }

  // 4. Fallback to Indian English or any English voice
  if (!matchedVoice) {
    matchedVoice = availableVoices.find(v => v.lang && v.lang.toLowerCase() === 'en-in') ||
                   availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-'));
  }

  return {
    bcp47: matchedVoice ? matchedVoice.lang : preferredTag,
    voice: matchedVoice || null
  };
}
