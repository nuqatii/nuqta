// ─────────────────────────────────────────────────────────────
//  Platform configuration — the only file you need to edit to go live.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  // Product name (placeholder — change freely)
  APP_NAME: { en: 'nuqatii', ar: 'نقاطي' },

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
  SITE_URL: 'https://nuqatii.com/',

  // Google Wallet. Leave issuerId empty to hide the "Add to Google Wallet" button.
  // issuerId comes from pay.google.com/business/console (see GOOGLE_WALLET_SETUP.md).
  GOOGLE_WALLET: {
    issuerId: '3388000000023205324',
    region: 'europe-west1',     // where the server function runs
    officialButton: true,       // Google's official button images in assets/img (gwallet-ar.svg, gwallet-en.svg)
  },

  // Apple Wallet. Leave passTypeId empty to hide the "Add to Apple Wallet" button (APPLE_WALLET_SETUP.md).
  APPLE_WALLET: {
    passTypeId: 'pass.com.nuqatii.cards', // e.g. 'pass.io.github.nuqatii.cards' (Apple Developer → Identifiers → Pass Type IDs)
    teamId: 'TNF54QZTNN',       // 10 characters, Apple Developer → Membership
    officialButton: false,      // true once Apple's badges are in assets/img (applewallet-ar.svg, applewallet-en.svg)
  },

  // Shown in the Privacy Policy and Terms of Service.
  LEGAL: {
    name: { en: 'nuqatii', ar: 'نقاطي' },  // the service name shown in the Privacy Policy and Terms
    country: { en: 'Syria', ar: 'سوريا' },
    whatsapp: '+963953667748',
    email: '',                                  // optional; leave empty to hide
    updated: '2026-10-19',                      // change when you edit the texts
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

// Address of the Apple Wallet download, or '' when Apple Wallet is off.
export function appleFnUrl() {
  const a = CONFIG.APPLE_WALLET;
  if (!a?.passTypeId || !a?.teamId || !CONFIG.FIREBASE.projectId) return '';
  return `https://${CONFIG.GOOGLE_WALLET?.region || 'europe-west1'}-${CONFIG.FIREBASE.projectId}.cloudfunctions.net/gwallet/apple`;
}

// Base URL of the deployed site (works on GitHub Pages sub-paths).
export function baseUrl() {
  return location.href.replace(/[^/]*([?#].*)?$/, '');
}
