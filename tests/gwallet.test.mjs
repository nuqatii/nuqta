// Google Wallet function tests (no network). Run: npm --prefix functions install && node --test tests/gwallet.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, copyFileSync } from 'node:fs';
import { generateKeyPairSync, createVerify } from 'node:crypto';

mkdirSync('functions/shared', { recursive: true });
copyFileSync('assets/js/core/loyalty.js', 'functions/shared/loyalty.js');
copyFileSync('assets/js/config.js', 'functions/shared/config.js');

const { buildClass, buildObject, objectIdFor } = await import('../functions/pass.js');
const { createHandler } = await import('../functions/handler.js');
const { createGoogle } = await import('../functions/google.js');
const { GoogleAuth } = await import('../functions/node_modules/google-auth-library/build/src/index.js');

const ISS = '3388000000022222222';
const BIZ = { name: 'Urban Coffee', lang: 'ar', currency: 'SYP', colors: { bg: '#3B2A20' }, design: { programName: 'Coffee Club', programNameAr: 'نادي القهوة' }, designVersion: 3,
  program: { type: 'stamps', goal: 8 }, tiers: [{ id: 'r', name: 'Regular', nameAr: 'عادي', min: 0 }, { id: 'g', name: 'Gold', nameAr: 'ذهبي', min: 20 }],
  logo: 'data:image/png;base64,' + Buffer.from('PNGDATA').toString('base64') };
const REWARDS = [{ id: 'free', cost: 8, active: true }, { id: 'old', cost: 2, active: false }];
const TOKEN = 'demoMayaCoffee3Hn8Vd5Rk2Wq';
const CARD = { businessId: 'urban01', customerId: 'cust_maya', memberNumber: '100007', qrValue: 'NQMAYA2026', firstName: 'مايا', points: 19, lifetimePoints: 23 };

test('stamp card pass shows progress, rewards ready, tier and a link back', () => {
  const o = buildObject({ issuerId: ISS, token: TOKEN, card: CARD, business: BIZ, rewards: REWARDS, siteUrl: 'https://x.io/nuqta/' });
  assert.equal(o.id, `${ISS}.card_urban01_cust_maya`);
  assert.equal(o.classId, `${ISS}.biz_urban01`);
  assert.deepEqual(o.loyaltyPoints.balance, { string: '3/8' });
  assert.equal(o.loyaltyPoints.localizedLabel.defaultValue.language, 'ar');
  assert.deepEqual(o.secondaryLoyaltyPoints.balance, { int: 2 });
  assert.equal(o.barcode.value, 'NQMAYA2026');
  assert.equal(o.textModulesData[0].body, 'ذهبي');
  assert.equal(o.linksModuleData.uris[0].uri, `https://x.io/nuqta/rewards.html?c=${TOKEN}`);
});

test('points and spend programs show a number; deleted cards go inactive and anonymous', () => {
  const pts = buildObject({ issuerId: ISS, token: TOKEN, card: { ...CARD, points: 640 }, business: { ...BIZ, lang: 'en', program: { type: 'points' }, tiers: [] }, rewards: [{ cost: 500, active: true }, { cost: 1000, active: true }], siteUrl: 'https://x.io/' });
  assert.deepEqual(pts.loyaltyPoints.balance, { int: 640 });
  assert.equal(pts.loyaltyPoints.label, 'Points');
  assert.deepEqual(pts.secondaryLoyaltyPoints.balance, { int: 1 });
  assert.equal(pts.textModulesData.length, 0);
  const spend = buildObject({ issuerId: ISS, token: TOKEN, card: CARD, business: { ...BIZ, lang: 'en', program: { type: 'spend' } }, rewards: [], siteUrl: 'https://x.io/' });
  assert.equal(spend.loyaltyPoints.label, 'Spent (SYP)');
  const gone = buildObject({ issuerId: ISS, token: TOKEN, card: { ...CARD, deleted: true }, business: BIZ, rewards: REWARDS, siteUrl: 'https://x.io/' });
  assert.equal(gone.state, 'INACTIVE');
  assert.equal(gone.accountName, '');
  assert.equal(gone.linksModuleData.uris.length, 0);
});

test('class carries brand colour, both program names and a versioned logo url', () => {
  const c = buildClass({ issuerId: ISS, bid: 'urban01', business: BIZ, logoUrl: 'https://fn/logo?b=urban01&v=3' });
  assert.equal(c.hexBackgroundColor, '#3B2A20');
  assert.equal(c.programName, 'نادي القهوة');
  assert.deepEqual(c.localizedProgramName.translatedValues, [{ language: 'en', value: 'Coffee Club' }]);
  assert.equal(c.reviewStatus, 'UNDER_REVIEW');
  assert.equal(buildClass({ issuerId: ISS, bid: 'b', business: { ...BIZ, colors: { bg: 'red' } }, logoUrl: 'u' }).hexBackgroundColor, '#0F6E5C');
});

test('save-link JWT is RS256 and verifies with the service account key', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const auth = new GoogleAuth({ credentials: { client_email: 'wallet@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) } });
  const G = createGoogle({ auth });
  assert.equal(await G.serviceEmail(), 'wallet@p.iam.gserviceaccount.com');
  const jwt = await G.signJwt({ iss: 'wallet@p.iam.gserviceaccount.com', aud: 'google', typ: 'savetowallet', payload: { loyaltyObjects: [{ id: 'x' }] } });
  const [h, b, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  assert.equal(JSON.parse(Buffer.from(b, 'base64url')).typ, 'savetowallet');
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${b}`);
  assert.ok(v.verify(publicKey, Buffer.from(s, 'base64url')));
});

// ── Handler with fake Firestore + fake Google ─────────────
function fakeFirestore(docs) {
  const doc = (path) => ({
    async get() { const d = docs[path]; return { exists: !!d, id: path.split('/').pop(), data: () => d }; },
    async set(data, opt) { docs[path] = opt?.merge ? { ...(docs[path] || {}), ...data } : data; },
  });
  const collection = (path) => ({ async get() { return { docs: Object.keys(docs).filter((k) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map((k) => ({ id: k.split('/').pop(), data: () => docs[k] })) }; } });
  return { doc, collection };
}
function fakeGoogle() {
  const store = { classes: {}, objects: {}, calls: [] };
  return Object.assign(store, {
    async getClass(id) { return store.classes[id] || null; },
    async upsertClass(c) { store.calls.push(['class', c.id]); store.classes[c.id] = c; },
    async getObject(id) { return store.objects[id] || null; },
    async upsertObject(o) { store.calls.push(['object', o.id]); store.objects[o.id] = o; },
    async updateObjectIfExists(o) { if (!store.objects[o.id]) return false; store.calls.push(['update', o.id]); store.objects[o.id] = o; return true; },
    async serviceEmail() { return 'sa@x'; },
    async signJwt(claims) { store.claims = claims; return 'h.b.s'; },
  });
}
function fakeRes() {
  const r = { headers: {}, statusCode: 200 };
  r.set = (k, v) => { r.headers[k] = v; return r; };
  r.status = (s) => { r.statusCode = s; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.redirect = (s, u) => { r.statusCode = s; r.location = u; return r; };
  return r;
}
const CFG = { SITE_URL: 'https://nuqatii.github.io/nuqta/', FIREBASE: { projectId: 'nuqati-39894' }, GOOGLE_WALLET: { issuerId: ISS, region: 'europe-west1' } };
const call = (h, path, query) => { const res = fakeRes(); return h({ method: 'GET', path, query }, res).then(() => res); };

test('save creates class + object, marks the card, and redirects to Google', async () => {
  const docs = { [`cards/${TOKEN}`]: CARD, 'businesses/urban01': BIZ, 'businesses/urban01/rewards/free': REWARDS[0], 'businesses/urban01/customers/cust_maya': { firstName: 'Maya' } };
  const g = fakeGoogle();
  const h = createHandler({ firestore: fakeFirestore(docs), google: g, config: CFG });
  const res = await call(h, '/gwallet/save', { t: TOKEN });
  assert.equal(res.statusCode, 302);
  assert.equal(res.location, 'https://pay.google.com/gp/v/save/h.b.s');
  assert.deepEqual(g.calls.map((c) => c[0]), ['class', 'object']);
  assert.equal(g.classes[`${ISS}.biz_urban01`].programLogo.sourceUri.uri, 'https://europe-west1-nuqati-39894.cloudfunctions.net/gwallet/logo?b=urban01&v=3');
  assert.deepEqual(g.claims.origins, ['https://nuqatii.github.io']);
  assert.deepEqual(g.claims.payload.loyaltyObjects, [{ id: objectIdFor(ISS, CARD) }]);
  assert.equal(docs[`cards/${TOKEN}`].walletGoogle, true);
  assert.equal(docs['businesses/urban01/customers/cust_maya'].walletGoogle, true);

  // After a purchase the site pings sync and the saved pass is updated.
  docs[`cards/${TOKEN}`].points = 25;
  const s = await call(h, '/gwallet/sync', { t: TOKEN });
  assert.equal(s.statusCode, 204);
  assert.deepEqual(g.objects[objectIdFor(ISS, CARD)].loyaltyPoints.balance, { string: '1/8' });
  assert.deepEqual(g.objects[objectIdFor(ISS, CARD)].secondaryLoyaltyPoints.balance, { int: 3 });

  // Design change refreshes the class.
  docs['businesses/urban01'] = { ...BIZ, name: 'Urban Coffee Co' };
  await call(h, '/gwallet/sync', { b: 'urban01' });
  assert.equal(g.classes[`${ISS}.biz_urban01`].issuerName, 'Urban Coffee Co');
});

test('sync never creates passes; bad tokens and deleted cards are refused; logo is served', async () => {
  const docs = { [`cards/${TOKEN}`]: CARD, 'businesses/urban01': BIZ, ['cards/deletedCardToken000000']: { ...CARD, deleted: true } };
  const g = fakeGoogle();
  const h = createHandler({ firestore: fakeFirestore(docs), google: g, config: CFG });
  assert.equal((await call(h, '/gwallet/sync', { t: TOKEN })).statusCode, 204);
  assert.equal(g.calls.length, 0, 'card not in wallet → nothing sent to Google');
  assert.equal((await call(h, '/gwallet/sync', { b: 'urban01' })).statusCode, 204);
  assert.equal(g.calls.length, 0, 'no class yet → nothing sent');
  assert.equal((await call(h, '/gwallet/save', { t: '../../etc' })).statusCode, 404);
  assert.equal((await call(h, '/gwallet/save', { t: 'deletedCardToken000000' })).statusCode, 404);
  const logo = await call(h, '/gwallet/logo', { b: 'urban01' });
  assert.equal(logo.headers['Content-Type'], 'image/png');
  assert.equal(String(logo.body), 'PNGDATA');
  const none = await call(h, '/gwallet/logo', { b: 'nologo1' });
  assert.equal(none.location, 'https://nuqatii.github.io/nuqta/assets/img/icon-512.png');
  const off = createHandler({ firestore: fakeFirestore(docs), google: g, config: { ...CFG, GOOGLE_WALLET: { issuerId: '', region: 'x' } } });
  assert.equal((await call(off, '/gwallet/save', { t: TOKEN })).statusCode, 503);
});
