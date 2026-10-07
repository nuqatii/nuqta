// ─────────────────────────────────────────────────────────────
//  Platform configuration — the only file you need to edit to go live.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  // Product name (placeholder — change freely)
  APP_NAME: { en: 'Nuqta', ar: 'نقطة' },

  // 'demo'     → everything runs in this browser (localStorage), seeded with Joe's Pizza.
  // 'firebase' → real multi-tenant backend (fill FIREBASE below).
  // You can also force a mode per visit with ?mode=demo or ?mode=firebase.
  MODE: 'demo',

  FIREBASE: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  FIREBASE_SDK_VERSION: '12.19.0',

  DEFAULT_LANG: 'ar',          // 'ar' | 'en'
  DEFAULT_CURRENCY: 'SYP',     // per-business, editable in Settings
};

export function resolveMode() {
  const q = new URLSearchParams(location.search).get('mode');
  if (q === 'demo' || q === 'firebase') { sessionStorage.setItem('nuqta_mode', q); return q; }
  const s = sessionStorage.getItem('nuqta_mode');
  if (s) return s;
  if (CONFIG.MODE === 'firebase' && !CONFIG.FIREBASE.projectId) return 'demo';
  return CONFIG.MODE;
}

// Base URL of the deployed site (works on GitHub Pages sub-paths).
export function baseUrl() {
  return location.href.replace(/[^/]*([?#].*)?$/, '');
}
