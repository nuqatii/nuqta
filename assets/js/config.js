// ─────────────────────────────────────────────────────────────
//  Platform configuration — the only file you need to edit to go live.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  // Product name (placeholder — change freely)
  APP_NAME: { en: 'Nuqta', ar: 'نقطة' },

  // 'demo'     → everything runs in this browser (localStorage), seeded with Joe's Pizza.
  // 'firebase' → real multi-tenant backend (fill FIREBASE below).
  // You can also force a mode per visit with ?mode=demo or ?mode=firebase.
  MODE: 'firebase',

  FIREBASE: {
    apiKey: 'AIzaSyAy-odbhQa2gMRmXgFfLLZJVdkFCZ1X_CI',
    authDomain: 'nuqati-39894.firebaseapp.com',
    projectId: 'nuqati-39894',
    storageBucket: 'nuqati-39894.firebasestorage.app',
    messagingSenderId: '605724800372',
    appId: '1:605724800372:web:d0f79da23b9f04f9c1e821',
  },
  FIREBASE_SDK_VERSION: '12.19.0',

  // Public address of the site (used inside wallet passes to link back to the card).
  SITE_URL: 'https://nuqatii.github.io/nuqta/',

  // Google Wallet. Leave issuerId empty to hide the "Add to Google Wallet" button.
  // issuerId comes from pay.google.com/business/console (see GOOGLE_WALLET_SETUP.md).
  GOOGLE_WALLET: {
    issuerId: '',
    region: 'europe-west1',     // where the server function runs
    officialButton: false,      // true once Google's official button images are in assets/img (setup guide, part 6)
  },

  // Shown in the Privacy Policy and Terms of Service.
  LEGAL: {
    name: { en: 'Nuqta', ar: 'نقطة' },       // put the registered business name here once you have it
    country: { en: 'Syria', ar: 'سوريا' },
    whatsapp: '+963953667748',
    email: '',                                  // optional; leave empty to hide
    updated: '2026-10-14',                      // change when you edit the texts
    retentionDays: 90,
  },

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

// Address of the Google Wallet server function, or '' when Google Wallet is off.
export function walletFnUrl() {
  const g = CONFIG.GOOGLE_WALLET;
  if (!g?.issuerId || !CONFIG.FIREBASE.projectId) return '';
  return `https://${g.region}-${CONFIG.FIREBASE.projectId}.cloudfunctions.net/gwallet`;
}

// Base URL of the deployed site (works on GitHub Pages sub-paths).
export function baseUrl() {
  return location.href.replace(/[^/]*([?#].*)?$/, '');
}
