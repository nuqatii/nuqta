// Nuqta server functions. Deployed automatically by .github/workflows/firebase-deploy.yml.
//
//   GET  /gwallet/save?t=<cardToken>   → creates/updates the pass and opens "Save to Google Wallet"
//   POST /gwallet/sync?t=<cardToken>   → refreshes a saved pass after points change (called by the site)
//   POST /gwallet/sync?b=<businessId>  → refreshes the business's pass design (name, colours, logo)
//   GET  /gwallet/logo?b=<businessId>  → the business logo as an image Google can download
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CONFIG } from './shared/config.js';
import { createGoogle } from './google.js';
import { createHandler } from './handler.js';

initializeApp();

export const gwallet = onRequest(
  { region: CONFIG.GOOGLE_WALLET?.region || 'europe-west1', memory: '256MiB', maxInstances: 5, timeoutSeconds: 30 },
  createHandler({ firestore: getFirestore(), google: createGoogle(), config: CONFIG }),
);
