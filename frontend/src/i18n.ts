import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import jaCommon from './locales/ja/common.json';
import zhCommon from './locales/zh/common.json';
import koCommon from './locales/ko/common.json';
import deCommon from './locales/de/common.json';

// Language configuration
const resources = {
  en: {
    common: enCommon,
  },
  ja: {
    common: jaCommon,
  },
  zh: {
    common: zhCommon,
  },
  ko: {
    common: koCommon,
  },
  de: {
    common: deCommon,
  },
};

// Language metadata for UI display
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass the i18n instance to react-i18next
  .init({
    resources,
    
    // Default language and fallback
    lng: 'ja', // Default to Japanese
    fallbackLng: 'en', // Fallback to English if translation missing
    
    // Namespace configuration
    defaultNS: 'common',
    ns: ['common'],
    
    // Language detection options
    detection: {
      // Detection order
      order: ['localStorage', 'navigator', 'htmlTag'],
      
      // Cache user language preference
      caches: ['localStorage'],
      
      // localStorage key
      lookupLocalStorage: 'i18nextLng',
    },
    
    // Interpolation options
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    // Development options
    debug: process.env.NODE_ENV === 'development',
    
    // Missing key handling
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lng, ns, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation: ${lng}.${ns}.${key}`);
      }
    },
    
    // React options
    react: {
      useSuspense: false, // Disable suspense for better error handling
    },
    
    // TypeScript support
    returnNull: false,
  });

export default i18n;