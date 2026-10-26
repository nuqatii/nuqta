// nuqatii server functions. Deployed automatically by .github/workflows/firebase-deploy.yml.
//
//   GET  /gwallet/save?t=<cardToken>   → creates/updates the pass and opens "Save to Google Wallet"
//   POST /gwallet/sync?t=<cardToken>   → refreshes a saved pass after points change (called by the site)
//   POST /gwallet/sync?b=<businessId>  → refreshes the business's pass design (name, colours, logo)
//   GET  /gwallet/logo?b=<businessId>  → the business logo as an image Google can download
//   /gwallet/apple/...                 → Apple Wallet download + Apple's pass web service (see apple.js)
//   POST /gwallet/receipt              → emails a subscription receipt to the owner (admin only, see EMAIL_SETUP.md)
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as L from './shared/loyalty.js';
import { CONFIG } from './shared/config.js';
import { createGoogle } from './google.js';
import { createHandler } from './handler.js';
import { createMailer } from './email.js';
import * as receipt from './shared/receipt.js';
import { createApple, createPusher, loadAppleCerts } from './apple.js';
import { readFileSync, existsSync } from 'node:fs';

initializeApp();

// Apple Wallet is on when config.js has the pass type + team id, the deploy put the
// certificate and key in .env, and Apple's WWDR certificate file is in functions/apple/.
const WWDR = new URL('./apple/AppleWWDRCAG4.cer', import.meta.url);
const certs = loadAppleCerts({ wwdr: existsSync(WWDR) ? readFileSync(WWDR) : null });
const firestore = getFirestore();
const apple = createApple({ firestore, config: CONFIG, certs, push: certs ? createPusher({ certs, topic: CONFIG.APPLE_WALLET?.passTypeId }) : async () => [] });

export const gwallet = onRequest(
  { region: CONFIG.GOOGLE_WALLET?.region || 'europe-west1', memory: '256MiB', maxInstances: 5, timeoutSeconds: 120 },
  createHandler({ firestore, google: createGoogle(), config: CONFIG, apple, verifyToken: (t) => getAuth().verifyIdToken(t), L, mailer: createMailer(), receipt }),
);
