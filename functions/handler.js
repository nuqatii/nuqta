// Request handler for /gwallet/*. Firestore and Google are passed in so tests can fake them.
import { buildClass, buildObject, classIdFor, saveClaims } from './pass.js';
import { saveUrl } from './google.js';

const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/;
const ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

export function createHandler({ firestore, google, config }) {
  const siteUrl = config.SITE_URL.endsWith('/') ? config.SITE_URL : config.SITE_URL + '/';
  const issuerId = () => String(config.GOOGLE_WALLET?.issuerId || '');
  const fnBase = () => `https://${config.GOOGLE_WALLET.region}-${config.FIREBASE.projectId}.cloudfunctions.net/gwallet`;

  const get = async (path) => { const s = await firestore.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  const rewardsOf = async (bid) => (await firestore.collection(`businesses/${bid}/rewards`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const logoUrl = (bid, b) => `${fnBase()}/logo?b=${bid}&v=${b.designVersion || 1}`;

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
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nuqta</title>
<body style="font-family:system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;line-height:1.6">
<p dir="rtl">${ar}</p><p>${en}</p><p><a href="${siteUrl}rewards.html">${siteUrl}rewards.html</a></p></body>`);
  }

  async function save(req, res) {
    const token = String(req.query.t || '');
    const d = await loadCard(token);
    if (!d || d.card.deleted) return page(res, 404, 'This card was not found.', 'لم نجد هذه البطاقة.');
    const iss = issuerId();
    const bid = d.card.businessId;
    await google.upsertClass(buildClass({ issuerId: iss, bid, business: d.business, logoUrl: logoUrl(bid, d.business) }));
    const obj = buildObject({ issuerId: iss, token, ...d, siteUrl });
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
    if (token) {
      const d = await loadCard(token);
      if (d && d.card.walletGoogle) await google.updateObjectIfExists(buildObject({ issuerId: iss, token, ...d, siteUrl }));
    } else if (ID_RE.test(bid)) {
      const business = await get(`businesses/${bid}`);
      if (business && (await google.getClass(classIdFor(iss, bid)))) await google.upsertClass(buildClass({ issuerId: iss, bid, business, logoUrl: logoUrl(bid, business) }));
    }
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

  return async function handler(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!issuerId()) return page(res, 503, 'Google Wallet is not set up yet.', 'محفظة Google غير مفعّلة بعد.');
    const route = String(req.path || '/').replace(/\/+$/, '').split('/').pop();
    try {
      if (route === 'save') return await save(req, res);
      if (route === 'sync') return await sync(req, res);
      if (route === 'logo') return await logo(req, res);
      return page(res, 404, 'Not found.', 'غير موجود.');
    } catch (e) {
      console.error(route, e);
      if (route === 'sync') return res.status(204).send('');
      return page(res, 500, 'Could not add the card to Google Wallet. Please try again in a minute.', 'تعذّرت إضافة البطاقة إلى محفظة Google. حاول بعد دقيقة.');
    }
  };
}

