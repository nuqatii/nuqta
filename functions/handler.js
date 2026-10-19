// Request handler for /gwallet/*. Firestore and Google are passed in so tests can fake them.
import { buildClass, buildObject, classIdFor, objectIdFor, saveClaims } from './pass.js';
import { saveUrl } from './google.js';
import { stampsPng } from './stamps.js';

const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/;
const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

export function createHandler({ firestore, google, config, apple = null, verifyToken = null, L = null }) {
  const siteUrl = config.SITE_URL.endsWith('/') ? config.SITE_URL : config.SITE_URL + '/';
  const issuerId = () => String(config.GOOGLE_WALLET?.issuerId || '');
  const fnBase = () => `https://${config.GOOGLE_WALLET.region}-${config.FIREBASE.projectId}.cloudfunctions.net/gwallet`;

  const get = async (path) => { const s = await firestore.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  const locationsOf = async (bid) => (await firestore.collection(`businesses/${bid}/locations`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const rewardsOf = async (bid) => (await firestore.collection(`businesses/${bid}/rewards`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const logoUrl = (bid, b) => `${fnBase()}/logo?b=${bid}&v=${b.designVersion || 1}`;
  // The image depends only on the business design and the numbers, so every customer at the same step shares one cached image.
  const heroUrlFor = (bid, b) => (st) => `${fnBase()}/stamps?b=${bid}&p=${st.progress}&g=${st.goal}&r=${st.ready > 0 ? 1 : 0}&v=${b.designVersion || 1}`;

  async function loadCard(token) {
    if (!TOKEN_RE.test(token || '')) return null;
    const card = await get(`cards/${token}`);
    if (!card) return null;
    const business = await get(`businesses/${card.businessId}`);
    if (!business) return null;
    return { card, business, rewards: await rewardsOf(card.businessId) };
  }

  function page(res, status, en, ar) {
    res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>nuqatii</title>
<body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;line-height:1.6">
<p dir="rtl">${ar}</p><p>${en}</p><p><a href="${siteUrl}rewards.html">${siteUrl}rewards.html</a></p></body>`);
  }

  async function save(req, res) {
    const token = String(req.query.t || '');
    const d = await loadCard(token);
    if (!d || d.card.deleted) return page(res, 404, 'This card was not found.', 'لم نجد هذه البطاقة.');
    const iss = issuerId();
    const bid = d.card.businessId;
    await google.upsertClass(buildClass({ issuerId: iss, bid, business: d.business, logoUrl: logoUrl(bid, d.business), locations: await locationsOf(bid) }));
    const obj = buildObject({ issuerId: iss, token, ...d, siteUrl, heroUrl: heroUrlFor(d.card.businessId, d.business) });
    await google.upsertObject(obj);
    const t = Date.now();
    await firestore.doc(`cards/${token}`).set({ walletGoogle: true, walletStatus: 'google', walletGoogleAt: t }, { merge: true });
    await firestore.doc(`businesses/${bid}/customers/${d.card.customerId}`).set({ walletGoogle: true }, { merge: true }).catch(() => {});
    const jwt = await google.signJwt(saveClaims({ serviceEmail: await google.serviceEmail(), objectId: obj.id, origins: [new URL(siteUrl).origin] }));
    res.set('Cache-Control', 'no-store').redirect(302, saveUrl(jwt));
  }

  async function sync(req, res) {
    const token = String(req.query.t || '');
    const bid = String(req.query.b || '');
    const iss = issuerId();
    const jobs = [];
    if (token) {
      const d = await loadCard(token);
      if (d && iss && d.card.walletGoogle) jobs.push(google.updateObjectIfExists(buildObject({ issuerId: iss, token, ...d, siteUrl, heroUrl: heroUrlFor(d.card.businessId, d.business) })));
      if (d && apple?.enabled() && d.card.walletApple) jobs.push(apple.touch(token, d.card));
    } else if (ID_RE.test(bid)) {
      const business = await get(`businesses/${bid}`);
      if (business && iss) jobs.push(google.getClass(classIdFor(iss, bid)).then(async (c) => c && google.upsertClass(buildClass({ issuerId: iss, bid, business, logoUrl: logoUrl(bid, business), locations: await locationsOf(bid) }))));
      if (business && apple?.enabled()) jobs.push(apple.touchBusiness(bid));
    }
    const out = await Promise.allSettled(jobs);
    for (const r of out) if (r.status === 'rejected') console.error('sync', r.reason);
    res.status(204).send('');
  }

  async function logo(req, res) {
    const bid = String(req.query.b || '');
    const fallback = `${siteUrl}assets/img/icon-512.png`;
    const b = ID_RE.test(bid) ? await get(`businesses/${bid}`) : null;
    const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(b?.logo || '');
    if (!m) return res.redirect(302, fallback);
    res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=86400').send(Buffer.from(m[2], 'base64'));
  }

  async function stamps(req, res) {
    const bid = String(req.query.b || '');
    const int = (v, lo, hi) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
    const goal = int(req.query.g, 2, 20); const progress = int(req.query.p, 0, 20); const ready = int(req.query.r, 0, 1);
    const b = ID_RE.test(bid) && goal !== null && progress !== null && progress < goal && ready !== null ? await get(`businesses/${bid}`) : null;
    if (!b) return page(res, 404, 'Not found.', 'غير موجود.');
    const png = await stampsPng({ business: b, progress, goal, ready });
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=604800').send(Buffer.from(png));
  }

  // Campaign messages to Google Wallet passes. Only signed-in owners/marketing staff of that business.
  async function message(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    const tok = String(req.get?.('authorization') || req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    let uid = null;
    try { uid = tok && verifyToken ? (await verifyToken(tok)).uid : null; } catch { uid = null; }
    if (!uid) return res.status(401).json({ error: 'unauthenticated' });
    const { bid, campaignId, items } = req.body || {};
    if (!ID_RE.test(String(bid || '')) || !Array.isArray(items) || !items.length || items.length > 500) return res.status(400).json({ error: 'invalid' });
    const member = await get(`businesses/${bid}/members/${uid}`);
    if (!member || !(L ? L.can(member.role, 'campaigns') : ['owner', 'marketing'].includes(member.role))) return res.status(403).json({ error: 'permission-denied' });
    const business = await get(`businesses/${bid}`);
    if (!business || (L && !L.canOperate(business))) return res.status(403).json({ error: 'subscription-ended' });
    const iss = issuerId(); const stamp = Date.now();
    const out = { sent: 0, silent: 0, notInWallet: 0, failed: 0 };
    const clip = (v, n) => String(v || '').trim().slice(0, n);
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const it = items[i++];
        try {
          const cid = String(it.customerId || '');
          const c = /^[A-Za-z0-9_-]{1,80}$/.test(cid) ? await get(`businesses/${bid}/customers/${cid}`) : null;
          if (!c || !c.walletGoogle || !c.cardToken) { out.notInWallet++; continue; }
          const card = await get(`cards/${c.cardToken}`);
          if (!card || card.deleted) { out.notInWallet++; continue; }
          const r = await google.addMessage(objectIdFor(iss, card), { id: `m${stamp}_${cid}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60), header: clip(it.header, 60), body: clip(it.body, 500) }, true);
          if (r === 'missing') out.notInWallet++; else out[r]++;
        } catch (e) { out.failed++; console.error('message', e.message); }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));
    if (campaignId && /^[A-Za-z0-9_-]{4,64}$/.test(String(campaignId))) {
      await firestore.doc(`businesses/${bid}/campaigns/${campaignId}`).set({ status: 'sent', sentAt: Date.now(), walletSent: out.sent, walletSilent: out.silent }, { merge: true }).catch(() => {});
    }
    res.status(200).json(out);
  }

  return async function handler(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    const path = String(req.path || '/').replace(/^\/gwallet(?=\/|$)/, '');
    if (path.startsWith('/apple/') || path === '/apple') {
      if (!apple) return res.status(503).send('Apple Wallet is not set up yet.');
      try { return await apple.route(req, res, path.slice('/apple'.length)); }
      catch (e) { console.error('apple', e); return res.status(500).send(''); }
    }
    const route = path.replace(/\/+$/, '').split('/').pop();
    if (route === 'message') { if (!issuerId()) return res.status(503).json({ error: 'wallet-off' }); try { return await message(req, res); } catch (e) { console.error('message', e); return res.status(500).json({ error: 'failed' }); } }
    if (route === 'sync') { try { return await sync(req, res); } catch (e) { console.error('sync', e); return res.status(204).send(''); } }
    if (!issuerId()) return page(res, 503, 'Google Wallet is not set up yet.', 'محفظة Google غير مفعّلة بعد.');
    try {
      if (route === 'save') return await save(req, res);
      if (route === 'logo') return await logo(req, res);
      if (route === 'stamps' || route === 'stamps.png') return await stamps(req, res);
      return page(res, 404, 'Not found.', 'غير موجود.');
    } catch (e) {
      console.error(route, e);
      if (route === 'sync') return res.status(204).send('');
      return page(res, 500, 'Could not add the card to Google Wallet. Please try again in a minute.', 'تعذّرت إضافة البطاقة إلى محفظة Google. حاول بعد دقيقة.');
    }
  };
}

