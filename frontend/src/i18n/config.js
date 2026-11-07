import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './translations';
import { extendedResources } from './extendedTranslations';

// Merge official 7-language extended resources into translations
if (extendedResources && typeof extendedResources === 'object') {
  for (const [lang, domains] of Object.entries(extendedResources)) {
    if (resources && resources[lang] && resources[lang].translation) {
      Object.assign(resources[lang].translation, domains);
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
    supportedLngs: ['en', 'te', 'hi', 'ta', 'kn', 'ml', 'or'],
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
