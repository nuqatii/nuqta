// Apple Wallet tests (no network). Run: npm --prefix functions install && node --test tests/apple.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';

mkdirSync('functions/shared', { recursive: true });
for (const [a, b] of [['assets/js/core/loyalty.js', 'loyalty.js'], ['assets/js/config.js', 'config.js'], ['assets/js/ui/icons.js', 'icons.js']]) copyFileSync(a, 'functions/shared/' + b);

const { buildPassJson, buildPkpass, passImages, createApple, loadAppleCerts, serialFor } = await import('../functions/apple.js');
const { createHandler } = await import('../functions/handler.js');
const forge = createRequire(import.meta.url)('../functions/node_modules/node-forge');

// A throwaway CA + signer standing in for Apple's WWDR and the pass certificate.
function makeCerts() {
  const mk = (subject, issuer, signKey, pub, ca) => {
    const c = forge.pki.createCertificate(); c.publicKey = pub; c.serialNumber = String(Math.floor(Math.random() * 1e9));
    c.validity.notBefore = new Date(Date.now() - 864e5); c.validity.notAfter = new Date(Date.now() + 864e5 * 30);
    c.setSubject([{ name: 'commonName', value: subject }]); c.setIssuer([{ name: 'commonName', value: issuer }]);
    c.setExtensions([{ name: 'basicConstraints', cA: ca }]); c.sign(signKey, forge.md.sha256.create()); return c;
  };
  const caKeys = forge.pki.rsa.generateKeyPair(2048), keys = forge.pki.rsa.generateKeyPair(2048);
  const ca = mk('Test WWDR', 'Test WWDR', caKeys.privateKey, caKeys.publicKey, true);
  const cert = mk('Pass Type ID: pass.test.nuqta', 'Test WWDR', caKeys.privateKey, keys.publicKey, false);
  return { wwdr: forge.pki.certificateToPem(ca), signerCert: forge.pki.certificateToPem(cert), signerKey: forge.pki.privateKeyToPem(keys.privateKey) };
}
const CERTS = makeCerts();
const CONFIG = { SITE_URL: 'https://nuqatii.github.io/nuqta/', FIREBASE: { projectId: 'nuqati-39894' }, GOOGLE_WALLET: { issuerId: '', region: 'europe-west1' }, APPLE_WALLET: { passTypeId: 'pass.test.nuqta', teamId: 'ABCDE12345' } };
const BIZ = { name: 'Pizza New', lang: 'ar', colors: { bg: '#B3201B', text: '#FFFFFF', secondary: '#F4C542' }, design: { icon: 'pizza', programName: 'Pizza Club' }, program: { type: 'stamps', goal: 6 }, tiers: [] };
const REWARDS = [{ id: 'r', cost: 6, active: true }];
const TOKEN = 'cardTokenAbc123XYZ456qwer';
const CARD = { businessId: 'biz1', customerId: 'cust1', memberNumber: '100001', qrValue: 'NQABC', firstName: 'Maya', points: 8, lifetimePoints: 8 };

test('pass.json: stamps show progress, rewards ready, web service and auth token', () => {
  const p = buildPassJson({ config: CONFIG, token: TOKEN, card: CARD, business: BIZ, rewards: REWARDS, siteUrl: CONFIG.SITE_URL, webServiceURL: 'https://x/gwallet/apple' });
  assert.equal(p.serialNumber, 'biz1_cust1');
  assert.equal(p.authenticationToken, TOKEN);
  assert.equal(p.storeCard.headerFields[0].value, '2/6');
  assert.equal(p.storeCard.secondaryFields.find((f) => f.key === 'ready').value, 1);
  assert.equal(p.backgroundColor, 'rgb(179, 32, 27)');
  assert.equal(p.barcodes[0].message, 'NQABC');
  const pts = buildPassJson({ config: CONFIG, token: TOKEN, card: { ...CARD, points: 640 }, business: { ...BIZ, lang: 'en', program: { type: 'points' } }, rewards: [{ cost: 500, active: true }], siteUrl: CONFIG.SITE_URL, webServiceURL: 'w' });
  assert.equal(pts.storeCard.primaryFields[0].value, 640);
  assert.equal(pts.storeCard.headerFields[0].label, 'Rewards ready');
  const gone = buildPassJson({ config: CONFIG, token: TOKEN, card: { ...CARD, deleted: true }, business: BIZ, rewards: REWARDS, siteUrl: CONFIG.SITE_URL, webServiceURL: 'w' });
  assert.equal(gone.voided, true); assert.equal(gone.barcodes.length, 0);
});

test('a signed .pkpass is produced with images, manifest and signature', async () => {
  const passJson = buildPassJson({ config: CONFIG, token: TOKEN, card: CARD, business: BIZ, rewards: REWARDS, siteUrl: CONFIG.SITE_URL, webServiceURL: 'https://x/gwallet/apple' });
  const images = await passImages({ business: BIZ, st: { progress: 2, goal: 6, ready: 1 } });
  assert.ok(images['strip@3x.png'] && images['icon.png'] && images['logo@2x.png']);
  const buf = await buildPkpass({ certs: CERTS, passJson, images });
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
  const s = buf.toString('latin1');
  for (const f of ['pass.json', 'manifest.json', 'signature', 'strip@2x.png', 'icon.png']) assert.ok(s.includes(f), f);
});

test('certificates load from base64 env + WWDR file; missing pieces turn Apple off', () => {
  const env = { APPLE_CERT_B64: Buffer.from(CERTS.signerCert).toString('base64'), APPLE_KEY_B64: Buffer.from(CERTS.signerKey).toString('base64') };
  const c = loadAppleCerts({ env, wwdr: CERTS.wwdr });
  assert.ok(c.signerCert.includes('BEGIN CERTIFICATE'));
  assert.equal(loadAppleCerts({ env: {}, wwdr: CERTS.wwdr }), null);
  assert.equal(loadAppleCerts({ env, wwdr: null }), null);
});

// ── Web service with a fake Firestore ────────────────
function fakeFirestore(docs) {
  const doc = (path) => ({
    async get() { const d = docs[path]; return { exists: !!d, id: path.split('/').pop(), data: () => d }; },
    async set(data, opt) { docs[path] = opt?.merge ? { ...(docs[path] || {}), ...data } : data; },
    async delete() { delete docs[path]; },
  });
  const listed = (path) => Object.keys(docs).filter((k) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/'));
  const collection = (path) => ({
    async get() { return { docs: listed(path).map((k) => ({ id: k.split('/').pop(), data: () => docs[k] })) }; },
    where(f, _op, v) { return { async get() { return { docs: listed(path).filter((k) => docs[k][f] === v).map((k) => ({ id: k.split('/').pop(), data: () => docs[k] })) }; } }; },
  });
  return { doc, collection };
}
function req(method, path, { query = {}, body, auth } = {}) {
  const headers = auth ? { authorization: auth } : {};
  return { method, path, query, body, headers, get: (h) => headers[h.toLowerCase()] };
}
function res() {
  const r = { headers: {}, statusCode: 200 };
  r.set = (k, v) => { r.headers[k] = v; return r; }; r.status = (s) => { r.statusCode = s; return r; };
  r.send = (b) => { r.body = b; return r; }; r.json = (b) => { r.body = b; return r; }; r.redirect = (s, u) => { r.statusCode = s; r.location = u; return r; };
  return r;
}

test('download → register → purchase sync pushes → device fetches the new pass → unregister', async () => {
  let t = 1_000_000;
  const docs = { [`cards/${TOKEN}`]: CARD, 'businesses/biz1': BIZ, 'businesses/biz1/rewards/r': REWARDS[0], 'businesses/biz1/customers/cust1': { firstName: 'Maya' } };
  const pushed = [];
  const fs = fakeFirestore(docs);
  const apple = createApple({ firestore: fs, config: CONFIG, certs: CERTS, push: async (toks) => { pushed.push(...toks); return toks.map((tok) => ({ tok, status: 200 })); }, now: () => t });
  const h = createHandler({ firestore: fs, google: {}, config: CONFIG, apple });
  const call = async (r) => { const out = res(); await h(r, out); return out; };

  const dl = await call(req('GET', '/gwallet/apple/pass', { query: { t: TOKEN } }));
  assert.equal(dl.statusCode, 200);
  assert.equal(dl.headers['Content-Type'], 'application/vnd.apple.pkpass');
  assert.equal(docs[`cards/${TOKEN}`].walletApple, true);
  assert.equal(docs['applePasses/biz1_cust1'].token, TOKEN);

  const base = '/apple/v1/devices/dev123/registrations/pass.test.nuqta';
  assert.equal((await call(req('POST', `${base}/biz1_cust1`, { body: { pushToken: 'ab'.repeat(32) }, auth: 'ApplePass wrong' }))).statusCode, 401);
  assert.equal((await call(req('POST', `${base}/biz1_cust1`, { body: { pushToken: 'ab'.repeat(32) }, auth: `ApplePass ${TOKEN}` }))).statusCode, 201);
  assert.equal((await call(req('POST', `${base}/biz1_cust1`, { body: { pushToken: 'ab'.repeat(32) }, auth: `ApplePass ${TOKEN}` }))).statusCode, 200);
  assert.equal((await call(req('GET', base, { query: { passesUpdatedSince: String(t) } }))).statusCode, 204);

  t += 5000; docs[`cards/${TOKEN}`].points = 9;
  assert.equal((await call(req('POST', '/gwallet/sync', { query: { t: TOKEN } }))).statusCode, 204);
  assert.deepEqual(pushed, ['ab'.repeat(32)]);
  const changed = await call(req('GET', base, { query: { passesUpdatedSince: String(t - 5000) } }));
  assert.deepEqual(changed.body.serialNumbers, ['biz1_cust1']);
  const latest = await call(req('GET', '/apple/v1/passes/pass.test.nuqta/biz1_cust1', { auth: `ApplePass ${TOKEN}` }));
  assert.equal(latest.statusCode, 200);
  assert.equal((await call(req('GET', '/apple/v1/passes/pass.test.nuqta/biz1_cust1', { auth: 'ApplePass nope' }))).statusCode, 401);
  assert.equal((await call(req('DELETE', `${base}/biz1_cust1`, { auth: `ApplePass ${TOKEN}` }))).statusCode, 200);
  assert.equal(docs['appleRegs/dev123__biz1_cust1'], undefined);
  assert.equal((await call(req('POST', '/apple/v1/log', { body: { logs: ['x'] } }))).statusCode, 200);
  assert.equal(serialFor(CARD), 'biz1_cust1');
});

test('Apple stays off until configured', async () => {
  const apple = createApple({ firestore: fakeFirestore({}), config: { ...CONFIG, APPLE_WALLET: { passTypeId: '', teamId: '' } }, certs: CERTS, push: async () => [] });
  const out = res(); await apple.route(req('GET', '/pass', { query: { t: TOKEN } }), out, '/pass');
  assert.equal(out.statusCode, 503);
});
