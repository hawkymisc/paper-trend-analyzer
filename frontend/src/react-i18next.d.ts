import 'react-i18next';

// Define the translation resources type
interface I18nNamespaces {
  common: typeof import('./locales/en/common.json');
}

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: I18nNamespaces;
    returnNull: false;
  }
}