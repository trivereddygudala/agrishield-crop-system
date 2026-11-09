import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './translations.js';
import { extendedResources } from './extendedTranslations.js';
import { comprehensiveResources } from './comprehensiveTranslations.js';

// Deep merge helper so sub-objects and nested domains are never overwritten
function deepMerge(target, source) {
  if (!target || typeof target !== 'object') target = {};
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// 1. Deep merge extended resources (equipment_hub, support_center, etc.)
if (extendedResources && typeof extendedResources === 'object') {
  for (const [lang, domains] of Object.entries(extendedResources)) {
    if (resources && resources[lang]) {
      if (!resources[lang].translation) resources[lang].translation = {};
      deepMerge(resources[lang].translation, domains);
    }
  }
}

// 2. Deep merge comprehensive resources (all core nav, dashboard, weather, and scanner keys)
if (comprehensiveResources && typeof comprehensiveResources === 'object') {
  for (const [lang, domains] of Object.entries(comprehensiveResources)) {
    if (resources && resources[lang]) {
      if (!resources[lang].translation) resources[lang].translation = {};
      deepMerge(resources[lang].translation, domains);
    }
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: resources || {},
    fallbackLng: 'en',
    load: 'languageOnly',
    cleanCode: true,
    supportedLngs: ['en', 'te', 'hi', 'ta', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or', 'ur', 'as'],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
    detection: {
      order: ['localStorage', 'sessionStorage', 'navigator'],
      caches: ['localStorage', 'sessionStorage'],
    }
  });

export default i18n;
