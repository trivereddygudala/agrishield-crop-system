/**
 * AgriShield 7-Language Dynamic Localization Helper
 * Official supported languages: en, te, ta, kn, hi, ml, or
 */

export const SUPPORTED_LANGUAGES = ['en', 'te', 'ta', 'kn', 'hi', 'ml', 'or'];

export const SPEECH_LANG_MAP = {
  en: 'en-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
  ml: 'ml-IN',
  or: 'or-IN'
};

/**
 * Normalizes language string to one of the 7 supported languages.
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
    if (fb != null && fb !== '') return fb;
  }

  return '';
}

export const MEASUREMENT_UNITS = {
  ml: { en: 'ml', te: 'మి.లీ', ta: 'மி.லி', kn: 'ಮಿ.ಲೀ', hi: 'मि.ली', ml: 'മി.ലി', or: 'ମି.ଲି' },
  g: { en: 'g', te: 'గ్రా', ta: 'கி', kn: 'ಗ್ರಾಂ', hi: 'ग्रा', ml: 'ഗ്രാം', or: 'ଗ୍ରା' },
  kg: { en: 'kg', te: 'కి.గ్రా', ta: 'கிலோ', kn: 'ಕೆ.ಜಿ', hi: 'कि.ग्रा', ml: 'കി.ഗ്രാം', or: 'କି.ଗ୍ରା' },
  l: { en: 'L', te: 'లీ', ta: 'லி', kn: 'ಲೀ', hi: 'ली', ml: 'ലി', or: 'ଲି' },
  acre: { en: 'acre', te: 'ఎకరం', ta: 'ஏக்கர்', kn: 'ಎಕರೆ', hi: 'एकड़', ml: 'ഏക്കർ', or: 'ଏକର' },
  hectare: { en: 'hectare', te: 'హెక్టారు', ta: 'ஹெக்டேர்', kn: 'ಹೆಕ್ಟೇರ್', hi: 'हेक्टेयर', ml: 'ഹെക്ടർ', or: 'ହେକ୍ଟର' }
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
