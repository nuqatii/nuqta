// Apple Wallet: builds signed .pkpass files and runs Apple's pass web service
// (devices register for updates; we push a silent notification when a card changes).
//
//   GET    /apple/pass?t=<cardToken>                                   → download the pass
//   POST   /apple/v1/devices/:device/registrations/:passType/:serial   → device registers
//   GET    /apple/v1/devices/:device/registrations/:passType           → which passes changed
//   GET    /apple/v1/passes/:passType/:serial                          → latest version of a pass
//   DELETE /apple/v1/devices/:device/registrations/:passType/:serial   → device unregisters
//   POST   /apple/v1/log                                               → Apple's error log
import { X509Certificate } from 'node:crypto';
import http2 from 'node:http2';
import * as L from './shared/loyalty.js';
import { ICON_PATHS } from './shared/icons.js';
import { stampsSvg } from './stamps.js';

const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/;
const SAFE = /^[A-Za-z0-9._-]{1,128}$/;
const TXT = {
  en: { points: 'Points', stamps: 'Stamps', visits: 'Visits', spend: 'Spent', ready: 'Rewards ready', tier: 'Tier', member: 'Member', number: 'Member no.', open: 'Open my card', chg: 'Updated: %@', readyChg: 'Rewards ready: %@', desc: 'loyalty card' },
  ar: { points: 'النقاط', stamps: 'الأختام', visits: 'الزيارات', spend: 'الإنفاق', ready: 'مكافآت جاهزة', tier: 'المستوى', member: 'العضو', number: 'رقم العضوية', open: 'افتح بطاقتي', chg: 'تحديث: %@', readyChg: 'مكافآت جاهزة: %@', desc: 'بطاقة ولاء' },
};
const hex = (c, f) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : f);
const rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
export const serialFor = (card) => `${card.businessId}_${card.customerId}`.replace(/[^A-Za-z0-9._-]/g, '_');

// Reads the signing material: pass certificate + key from env (set by the deploy), Apple's WWDR cert from a file.
export function loadAppleCerts({ env = process.env, wwdr } = {}) {
  const dec = (v) => (v ? Buffer.from(v, 'base64').toString('utf8') : '');
  const signerCert = dec(env.APPLE_CERT_B64), signerKey = dec(env.APPLE_KEY_B64);
  if (!signerCert || !signerKey || !wwdr) return null;
  const wwdrPem = String(wwdr).includes('BEGIN CERTIFICATE') ? String(wwdr) : new X509Certificate(wwdr).toString();
  return { wwdr: wwdrPem, signerCert, signerKey };
}

// ── Pass contents (pure) ────────────────────────────────
export function buildPassJson({ config, token, card, business, rewards, siteUrl, webServiceURL }) {
  const A = config.APPLE_WALLET;
  const main = business.lang === 'en' ? 'en' : 'ar';
  const T = TXT[main];
  const d = business.design || {};
  const prog = business.program || { type: 'points' };
  const live = (rewards || []).filter((r) => L.rewardIsLive(r));
  const points = Math.max(0, Math.floor(card.points || 0));
  const bg = hex(business.colors?.bg, '#0F6E5C'), ink = hex(business.colors?.text, '#FFFFFF');
  const programName = (main === 'ar' ? d.programNameAr || d.programName : d.programName) || business.name;
  const ready = L.readyCount(prog, live, points);
  const st = L.isStampy(prog) ? L.stampState(prog, live, points) : null;
  const tiers = business.tiers || [];
  const tier = tiers.length > 1 ? L.tierFor(tiers, card.lifetimePoints || 0) : null;

  const s = { headerFields: [], primaryFields: [], secondaryFields: [], auxiliaryFields: [], backFields: [] };
  const name = { key: 'name', label: T.member, value: card.deleted ? '' : String(card.firstName || '') };
  const readyF = { key: 'ready', label: T.ready, value: ready, changeMessage: T.readyChg };
  if (st) {
    s.headerFields.push({ key: 'bal', label: prog.type === 'visits' ? T.visits : T.stamps, value: `${st.progress}/${st.goal}`, changeMessage: T.chg });
    s.secondaryFields.push(name, { ...readyF, textAlignment: 'PKTextAlignmentRight' });
  } else {
    s.headerFields.push(readyF);
    s.primaryFields.push({ key: 'bal', label: prog.type === 'spend' ? T.spend : T.points, value: points, changeMessage: T.chg });
    s.secondaryFields.push(name);
  }
  if (tier) s.auxiliaryFields.push({ key: 'tier', label: T.tier, value: main === 'ar' ? tier.nameAr || tier.name : tier.name });
  s.backFields.push({ key: 'num', label: T.number, value: String(card.memberNumber || '') });
  if (!card.deleted) s.backFields.push({ key: 'link', label: T.open, value: `${siteUrl}rewards.html?c=${token}` });

  return {
    formatVersion: 1,
    passTypeIdentifier: A.passTypeId,
    teamIdentifier: A.teamId,
    serialNumber: serialFor(card),
    authenticationToken: token,
    webServiceURL,
    organizationName: String(business.name || '').slice(0, 60),
    description: `${programName} ${T.desc}`,
    logoText: programName.slice(0, 30),
    backgroundColor: rgb(bg),
    foregroundColor: rgb(ink),
    labelColor: rgb(ink),
    sharingProhibited: true,
    voided: !!card.deleted,
    barcodes: card.deleted ? [] : [{ format: 'PKBarcodeFormatQR', message: String(card.qrValue || card.memberNumber || ''), messageEncoding: 'iso-8859-1', altText: String(card.memberNumber || '') }],
    storeCard: s,
  };
}

// ── Images (PNG via resvg) ──────────────────────────────
async function png(svg, width) {
  const { Resvg } = await import('@resvg/resvg-js');
  return Buffer.from(new Resvg(svg, { fitTo: width ? { mode: 'width', value: width } : { mode: 'original' } }).render().asPng());
}
const dataLogo = (b) => (/^data:image\/(png|jpeg);base64,/.test(b?.logo || '') ? b.logo : null);
function squareSvg(business, size) {
  const bg = hex(business.colors?.bg, '#0F6E5C'), ink = hex(business.colors?.text, '#FFFFFF');
  const logo = dataLogo(business);
  const inner = logo
    ? `<image href="${logo}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"/>`
    : `<g transform="translate(${size * 0.2} ${size * 0.2}) scale(${(size * 0.6) / 24})" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[business.design?.icon] || ICON_PATHS.star}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="${bg}"/>${inner}</svg>`;
}
export async function passImages({ business, st }) {
  const files = {};
  for (const [n, s] of [['icon.png', 29], ['icon@2x.png', 58], ['icon@3x.png', 87]]) files[n] = await png(squareSvg(business, s));
  for (const [n, s] of [['logo.png', 50], ['logo@2x.png', 100], ['logo@3x.png', 150]]) files[n] = await png(squareSvg(business, s));
  if (st) {
    const svg = stampsSvg({ business, progress: st.progress, goal: st.goal, ready: st.ready > 0 ? 1 : 0 });
    for (const [n, w] of [['strip.png', 375], ['strip@2x.png', 750], ['strip@3x.png', 1125]]) files[n] = await png(svg, w);
  }
  return files;
}

export async function buildPkpass({ certs, passJson, images }) {
  const { PKPass } = await import('passkit-generator');
  const pass = new PKPass({ 'pass.json': Buffer.from(JSON.stringify(passJson)), ...images }, certs);
  return pass.getAsBuffer();
}

// ── APNs: tell devices a pass changed (empty payload, topic = pass type id) ──
export function createPusher({ certs, topic }) {
  return async function push(tokens) {
    if (!tokens.length) return [];
    const client = http2.connect('https://api.push.apple.com', { cert: certs.signerCert, key: certs.signerKey });
    client.on('error', (e) => console.error('apns', e.message));
    const one = (tok) => new Promise((resolve) => {
      const req = client.request({ ':method': 'POST', ':path': `/3/device/${tok}`, 'apns-topic': topic, 'content-type': 'application/json' });
      let status = 0;
      req.on('response', (h) => { status = h[':status']; });
      req.on('error', () => resolve({ tok, status: 0 }));
      req.on('close', () => resolve({ tok, status }));
      req.setTimeout(10000, () => req.close());
      req.end('{}');
    });
    try { return await Promise.all(tokens.map(one)); } finally { client.close(); }
  };
}

// ── Web service + download route ────────────────────────
export function createApple({ firestore, config, certs, push, now = () => Date.now() }) {
  const A = config.APPLE_WALLET || {};
  const enabled = () => !!(A.passTypeId && A.teamId && certs);
  const siteUrl = config.SITE_URL.endsWith('/') ? config.SITE_URL : config.SITE_URL + '/';
  const webServiceURL = () => `https://${config.GOOGLE_WALLET?.region || 'europe-west1'}-${config.FIREBASE.projectId}.cloudfunctions.net/gwallet/apple`;
  const get = async (path) => { const s = await firestore.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  const rewardsOf = async (bid) => (await firestore.collection(`businesses/${bid}/rewards`).get()).docs.map((x) => ({ id: x.id, ...x.data() }));

  async function loadByToken(token) {
    if (!TOKEN_RE.test(token || '')) return null;
    const card = await get(`cards/${token}`); if (!card) return null;
    const business = await get(`businesses/${card.businessId}`); if (!business) return null;
    return { token, card, business, rewards: await rewardsOf(card.businessId) };
  }
  async function pkpassFor(d) {
    const passJson = buildPassJson({ config, ...d, siteUrl, webServiceURL: webServiceURL() });
    const prog = d.business.program || {};
    const st = L.isStampy(prog) ? L.stampState(prog, d.rewards.filter((r) => L.rewardIsLive(r)), d.card.points || 0) : null;
    return buildPkpass({ certs, passJson, images: await passImages({ business: d.business, st: d.card.deleted ? null : st }) });
  }
  const sendPass = (res, buf, updatedAt) => res.status(200)
    .set('Content-Type', 'application/vnd.apple.pkpass')
    .set('Content-Disposition', 'attachment; filename="card.pkpass"')
    .set('Last-Modified', new Date(updatedAt || now()).toUTCString())
    .set('Cache-Control', 'no-store').send(buf);

  // Checks "Authorization: ApplePass <token>" against the pass's stored token.
  async function authorized(req, serial) {
    if (!SAFE.test(serial || '')) return null;
    const p = await get(`applePasses/${serial}`);
    const h = String(req.get?.('authorization') || req.headers?.authorization || '');
    return p && h === `ApplePass ${p.token}` ? p : null;
  }

  // Marks a card's pass as changed and pings every device that holds it.
  async function touch(token, card) {
    if (!enabled() || !card?.walletApple) return 0;
    const serial = serialFor(card);
    await firestore.doc(`applePasses/${serial}`).set({ updatedAt: now() }, { merge: true });
    const regs = (await firestore.collection('appleRegs').where('serial', '==', serial).get()).docs;
    const results = await push(regs.map((r) => r.data().pushToken));
    for (const r of results) if (r.status === 410) await firestore.doc(`appleRegs/${regs.find((x) => x.data().pushToken === r.tok).id}`).delete();
    return regs.length;
  }
  async function touchBusiness(bid) {
    if (!enabled()) return 0;
    const passes = (await firestore.collection('applePasses').where('businessId', '==', bid).get()).docs;
    let n = 0;
    for (const p of passes) { const card = await get(`cards/${p.data().token}`); if (card) n += await touch(p.data().token, card); }
    return n;
  }

  async function route(req, res, path) {
    if (!enabled()) return res.status(503).send('Apple Wallet is not set up yet.');
    const parts = path.split('/').filter(Boolean);         // e.g. ['v1','devices',dev,'registrations',ptid,serial]
    // Download from the card page
    if (parts[0] === 'pass' && req.method === 'GET') {
      const d = await loadByToken(String(req.query.t || ''));
      if (!d || d.card.deleted) return res.status(404).send('Card not found.');
      const serial = serialFor(d.card); const t = now();
      await firestore.doc(`applePasses/${serial}`).set({ token: d.token, businessId: d.card.businessId, updatedAt: t }, { merge: true });
      await firestore.doc(`cards/${d.token}`).set({ walletApple: true, walletAppleAt: t }, { merge: true });
      await firestore.doc(`businesses/${d.card.businessId}/customers/${d.card.customerId}`).set({ walletApple: true }, { merge: true }).catch(() => {});
      return sendPass(res, await pkpassFor(d), t);
    }
    if (parts[0] !== 'v1') return res.status(404).send('');
    if (parts[1] === 'log') { console.log('apple-wallet log', JSON.stringify(req.body || {}).slice(0, 2000)); return res.status(200).send(''); }
    if (parts[1] === 'devices' && parts[3] === 'registrations') {
      const device = parts[2], ptid = parts[4], serial = parts[5];
      if (!SAFE.test(device || '') || ptid !== A.passTypeId) return res.status(404).send('');
      if (!serial && req.method === 'GET') {
        const since = Number(req.query.passesUpdatedSince) || 0;
        const regs = (await firestore.collection('appleRegs').where('deviceId', '==', device).get()).docs.map((x) => x.data().serial);
        const changed = [];
        let last = since;
        for (const s of regs) { const p = await get(`applePasses/${s}`); if (p && (p.updatedAt || 0) > since) { changed.push(s); last = Math.max(last, p.updatedAt); } }
        return changed.length ? res.status(200).json({ serialNumbers: changed, lastUpdated: String(last) }) : res.status(204).send('');
      }
      if (!(await authorized(req, serial))) return res.status(401).send('');
      const id = `${device}__${serial}`;
      if (req.method === 'POST') {
        const pushToken = String(req.body?.pushToken || '');
        if (!/^[A-Fa-f0-9]{32,200}$/.test(pushToken)) return res.status(400).send('');
        const existed = (await firestore.doc(`appleRegs/${id}`).get()).exists;
        await firestore.doc(`appleRegs/${id}`).set({ deviceId: device, serial, pushToken, at: now() });
        return res.status(existed ? 200 : 201).send('');
      }
      if (req.method === 'DELETE') { await firestore.doc(`appleRegs/${id}`).delete(); return res.status(200).send(''); }
    }
    if (parts[1] === 'passes' && req.method === 'GET') {
      const ptid = parts[2], serial = parts[3];
      if (ptid !== A.passTypeId) return res.status(404).send('');
      const p = await authorized(req, serial); if (!p) return res.status(401).send('');
      const since = Date.parse(req.get?.('if-modified-since') || '') || 0;
      if (since && Math.floor((p.updatedAt || 0) / 1000) <= Math.floor(since / 1000)) return res.status(304).send('');
      const d = await loadByToken(p.token); if (!d) return res.status(404).send('');
      return sendPass(res, await pkpassFor(d), p.updatedAt);
    }
    return res.status(404).send('');
  }

  return { enabled, route, touch, touchBusiness, pkpassFor, loadByToken };
}
