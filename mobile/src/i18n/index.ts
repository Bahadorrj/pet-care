import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import fa from './fa.json';

// Apply RTL layout direction. On a real device this takes effect after reload;
// in the jest-expo mock the flag does not flip synchronously, so tests spy on
// these calls rather than reading I18nManager.isRTL directly.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

i18n.use(initReactI18next).init({
  lng: 'fa',
  fallbackLng: 'fa',
  // Disable key separators so dotted keys like "auth.error.network" are
  // treated as literal flat keys rather than nested object paths.
  keySeparator: false,
  nsSeparator: false,
  resources: {
    fa: {
      translation: fa,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
