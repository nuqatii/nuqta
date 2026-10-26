// The application service. Every read/write in every portal goes through here.
// It runs unchanged on the demo store and on Firestore; firestore.rules enforce the
// same tenant + role boundaries server-side.
import * as L from '../core/loyalty.js';
import { walletFnUrl, appleFnUrl } from '../config.js';
import { DEFAULT_FAQ, cleanFaq } from '../core/faq.js';
const walletBase = () => (walletFnUrl() || appleFnUrl().replace(/\/apple$/, ''));

const now = () => Date.now();
const fail = (code, extra) => { const e = new Error(code); e.code = code; Object.assign(e, extra); throw e; };

// Fields a customer may edit about themselves from their card page.
const SELF_EDITABLE = ['lastName', 'email', 'birthday', 'marketingConsent', 'preferredChannel'];
// The customer's own editable details, mirrored onto their (token-protected) card so the card page can show them.
const profileOf = (c) => ({ lastName: c.lastName || '', email: c.email || '', birthday: c.birthday || '', marketingConsent: !!c.marketingConsent, preferredChannel: c.preferredChannel || 'whatsapp' });
// Fields mirrored onto the public card document.
const cardFields = (c) => ({
  points: c.points || 0, lifetimePoints: c.lifetimePoints || 0, visits: c.visits || 0,
  tierId: c.tierId || null, firstName: c.firstName || '', updatedAt: now(),
});
// Public, non-sensitive part of an activity event.
const publicEvent = (e) => ({
  type: e.type, points: e.points || 0, amount: e.amount || 0, balance: e.balance ?? null,
  rewardName: e.rewardName || null, rewardNameAr: e.rewardNameAr || null, at: e.at,
});

export function createService({ db, auth, mode }) {
  const P = {
    biz: (b) => `businesses/${b}`,
    sub: (b, c, id) => (id ? `businesses/${b}/${c}/${id}` : `businesses/${b}/${c}`),
    card: (t) => `cards/${t}`,
    slug: (s) => `slugs/${s}`,
    stats: (b) => `stats/${b}`,
  };
  const roleCache = new Map();
  const user = () => auth.current();
  // Tells the Google Wallet function to refresh a saved pass (fire and forget; never blocks the cashier).
  function walletPing(query) {
    const base = mode === 'firebase' && (walletFnUrl() || appleFnUrl()) ? walletBase() : '';
    if (!base) return;
    const url = `${base}/sync?${query}`;
    try {
      if (globalThis.navigator?.sendBeacon?.(url)) return;
      globalThis.fetch?.(url, { method: 'POST', mode: 'no-cors', keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  }
  const pingCard = (c) => { if ((c?.walletGoogle || c?.walletApple) && c.cardToken) walletPing('t=' + encodeURIComponent(c.cardToken)); };

  async function roleIn(bid) {
    const u = user(); if (!u) return null;
    const key = bid + ':' + u.uid;
    if (roleCache.has(key)) return roleCache.get(key);
    const m = await db.get(P.sub(bid, 'members', u.uid));
    const r = m?.role || null; roleCache.set(key, r); return r;
  }
  async function need(bid, area) {
    const r = await roleIn(bid);
    if (!r || !L.can(r, area)) fail('permission-denied');
    return r;
  }
  async function audit(bid, action, details = {}) {
    const u = user();
    try {
      await db.set(P.sub(bid, 'audit', db.newId()), { action, details, actorUid: u?.uid || null, actorEmail: u?.email || null, at: now() });
    } catch { /* audit is best-effort on the client; server functions can harden this */ }
  }

  const S = {
    mode, db, auth,

    // ── Auth & memberships ─────────────────────────────────
    // Claiming staff invites must never block signing in (e.g. while a database index is still building).
    async signUp(email, password, name) {
      const u = await auth.signUp(email, password, name);
      await auth.sendVerification?.(globalThis.document?.documentElement?.lang).catch((e) => console.warn('verification email', e));
      return u;
    },
    async signIn(email, password) { const u = await auth.signIn(email, password); await S.claimInvites().catch((e) => console.warn('claimInvites', e)); return u; },
    // Email confirmation (once per account, before creating a business or joining one as staff).
    needsVerification() { const u = user(); return !!u && u.emailVerified === false; },
    async resendVerification() { await auth.sendVerification(globalThis.document?.documentElement?.lang); },
    async checkVerified() {
      const u = await auth.reload();
      if (u?.emailVerified) await S.claimInvites().catch((e) => console.warn('claimInvites', e));
      return !!u?.emailVerified;
    },
    async signOut() { roleCache.clear(); await auth.signOut(); },

    async myMemberships() {
      const u = user(); if (!u) return [];
      const rows = await db.listGroup('members', { where: [['uid', '==', u.uid]] });
      const out = [];
      for (const m of rows) {
        const b = await db.get(P.biz(m.businessId));
        if (b) { out.push({ businessId: m.businessId, role: m.role, name: b.name, logo: b.logo || null, status: b.status }); roleCache.set(m.businessId + ':' + u.uid, m.role); }
      }
      return out;
    },
    async claimInvites() {
      const u = user(); if (!u?.email || u.emailVerified === false) return;
      const inv = await db.listGroup('invites', { where: [['email', '==', u.email]] });
      for (const i of inv) {
        await db.batch([
          { op: 'set', path: P.sub(i.businessId, 'members', u.uid), data: { uid: u.uid, email: u.email, name: u.name || i.name || '', role: i.role, businessId: i.businessId, createdAt: now() } },
          { op: 'delete', path: P.sub(i.businessId, 'invites', i.email) },
        ]);
      }
    },
    async isPlatformAdmin() { const u = user(); return !!(u && (await db.get(`platformAdmins/${u.uid}`))); },

    // ── Businesses ─────────────────────────────────────────
    async slugAvailable(slug) { return !(await db.exists(P.slug(slug))); },
    async createBusiness(input) {
      const u = user(); if (!u) fail('unauthenticated');
      if (await S.isPlatformAdmin()) fail('admin-no-business');
      if (u.emailVerified === false) fail('email-not-verified');
      if (!input.termsAccepted) fail('terms-required');
      const name = L.clampStr(input.name, 60); if (!name) fail('invalid-name');
      const ownerPhone = input.ownerPhone ? L.normalizePhone(input.ownerPhone) : '';
      if (input.ownerPhone && !ownerPhone) fail('invalid-phone');
      const platform = await db.get('platform/settings');
      if (platform && platform.signupsOpen === false) fail('signups-closed');
      const trialDays = Math.min(365, Math.max(1, Number(platform?.trialDays) || L.DEFAULT_TRIAL_DAYS));
      let slug = L.slugify(input.slug || name);
      for (let i = 0; !(await S.slugAvailable(slug)); i++) slug = L.slugify(name).slice(0, 24) + '-' + L.randomString(3);
      const bid = db.newId();
      const currency = input.currency || 'SYP';
      const program = { ...L.defaultProgram(input.programType || 'points', currency), ...(input.program || {}) };
      const business = {
        name, slug, type: L.BUSINESS_TYPES.includes(input.type) ? input.type : 'other',
        currency, lang: input.lang || 'ar',
        logo: input.logo || null,
        colors: { primary: '#0F6E5C', secondary: '#E8A33D', bg: '#0F6E5C', text: '#FFFFFF', ...(input.colors || {}) },
        program,
        design: { style: 'gradient', layout: 'classic', programName: input.programName || '', cover: null, icon: 'star', codeFormat: 'qr', ...(input.design || {}) },
        tiers: input.tiers || L.defaultTiers(),
        terms: { version: L.clampStr(input.termsVersion || '', 20), acceptedAt: now(), acceptedBy: u.uid },
        status: 'active', plan: 'trial', trialEndsAt: now() + trialDays * L.DAY, paidUntil: null, ownerUid: u.uid, createdAt: now(),
        memberSeq: 0, designVersion: 1,
      };
      await db.batch([
        { op: 'set', path: P.biz(bid), data: business },
        { op: 'set', path: P.sub(bid, 'members', u.uid), data: { uid: u.uid, email: u.email, name: u.name || '', role: 'owner', businessId: bid, createdAt: now() } },
        { op: 'set', path: P.slug(slug), data: { businessId: bid } },
        { op: 'set', path: P.stats(bid), data: { businessId: bid, statCustomers: 0, statTxns: 0, statRevenue: 0, statPoints: 0, statRedeemed: 0, lastActivityAt: now() } },
        { op: 'set', path: P.sub(bid, 'private', 'settings'), data: { ownerEmail: u.email, ownerName: L.clampStr(u.name, 60), ownerPhone, limits: {} } },
      ]);
      roleCache.set(bid + ':' + u.uid, 'owner');
      const ops = [];
      if (input.firstReward?.name) {
        ops.push({ op: 'set', path: P.sub(bid, 'rewards', db.newId()), data: S._rewardDoc(input.firstReward) });
      }
      for (const t of L.defaultTemplates()) ops.push({ op: 'set', path: P.sub(bid, 'templates', t.id), data: t });
      ops.push({ op: 'set', path: P.sub(bid, 'locations', 'main'), data: { name: input.locationName || 'Main', address: '', createdAt: now() } });
      if (ops.length) await db.batch(ops);
      await audit(bid, 'business.create', { name, slug });
      return { id: bid, ...business };
    },
    async getBusiness(bid) { return db.get(P.biz(bid)); },
    async getBusinessBySlug(slug) {
      const s = await db.get(P.slug(String(slug || '').toLowerCase()));
      return s ? S.getBusiness(s.businessId) : null;
    },
    async updateBusiness(bid, patch, area = 'settings') {
      await need(bid, area);
      const allowed = ['name', 'type', 'currency', 'lang', 'logo', 'colors', 'program', 'design', 'tiers'];
      const clean = {}; for (const k of allowed) if (k in patch) clean[k] = patch[k];
      if (clean.design || clean.colors || clean.logo !== undefined || clean.tiers) clean.designVersion = db.inc(1);
      await db.update(P.biz(bid), clean);
      if (['name', 'logo', 'colors', 'design', 'lang'].some((k) => k in clean)) walletPing('b=' + encodeURIComponent(bid));
      await audit(bid, 'business.update', { fields: Object.keys(clean) });
    },

    // ── Customers ──────────────────────────────────────────
    async listCustomers(bid) { await need(bid, 'customers'); return db.list(P.sub(bid, 'customers'), { orderBy: ['joinedAt', 'desc'] }); },
    // Live versions for the business app: new members and purchases show up without refreshing.
    async watchCustomers(bid, onData) { await need(bid, 'customers'); return db.watch(P.sub(bid, 'customers'), { orderBy: ['joinedAt', 'desc'] }, onData); },
    async watchActivity(bid, since, onData) { await need(bid, 'transactions'); return db.watch(P.sub(bid, 'activity'), { where: [['at', '>=', since]], orderBy: ['at', 'desc'] }, onData); },
    async getCustomer(bid, cid) { await need(bid, 'customers'); return db.get(P.sub(bid, 'customers', cid)); },
    async findCustomer(bid, raw) {
      await need(bid, 'customers');
      const q = L.toLatinDigits(String(raw || '').trim());
      if (!q) return null;
      const tries = [];
      const phone = L.normalizePhone(q); if (phone) tries.push(['phone', phone]);
      if (/^\d{6}$/.test(q)) tries.push(['memberNumber', q]);
      tries.push(['scanId', q]);
      if (q.includes('@')) tries.push(['email', q.toLowerCase()]);
      for (const [f, v] of tries) {
        const r = await db.list(P.sub(bid, 'customers'), { where: [[f, '==', v]], limit: 1 });
        if (r[0]) return r[0];
      }
      return null;
    },
    async addCustomer(bid, data) {
      await need(bid, 'customers');
      const r = await S._createMember(bid, data, 'staff');
      await audit(bid, 'customer.create', { customerId: r.customerId });
      return r;
    },
    async updateCustomer(bid, cid, patch) {
      await need(bid, 'customers');
      const allowed = ['firstName', 'lastName', 'email', 'birthday', 'gender', 'notes', 'marketingConsent', 'preferredChannel'];
      const clean = {}; for (const k of allowed) if (k in patch) clean[k] = typeof patch[k] === 'string' ? L.clampStr(patch[k], 500) : patch[k];
      if (clean.email && !L.validEmail(clean.email)) fail('invalid-email');
      const c = await db.get(P.sub(bid, 'customers', cid)); if (!c) fail('not-found');
      const ops = [{ op: 'update', path: P.sub(bid, 'customers', cid), data: clean }];
      const merged = { ...c, ...clean };
      ops.push({ op: 'update', path: P.card(c.cardToken), data: { firstName: merged.firstName, profile: profileOf(merged), updatedAt: now() } });
      await db.batch(ops);
      if ('firstName' in clean) pingCard(c);
    },

    // Shared by staff "add customer" and public "join".
    async _createMember(bid, data, source) {
      const firstName = L.clampStr(data.firstName, 40);
      const phone = L.normalizePhone(data.phone);
      const email = L.clampStr(data.email, 120).toLowerCase();
      if (!firstName) fail('invalid-name');
      if (!phone) fail('invalid-phone');
      if (!L.validEmail(email)) fail('invalid-email');
      if (await db.exists(P.sub(bid, 'phones', phone))) fail('already-member');
      const cid = db.newId() + L.randomString(8);
      const token = L.cardToken();
      const scanId = 'NQ' + L.randomString(10, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
      const u = user();
      return db.transaction(async (tx) => {
        const b = await tx.get(P.biz(bid));
        if (!b) fail('not-found');
        if (!L.canOperate(b)) fail(b.status === 'suspended' ? 'business-suspended' : 'subscription-ended');
        const seq = (b.memberSeq || 0) + 1;
        const bonus = Math.max(0, Number(b.program?.welcomeBonus) || 0);
        const tier = L.tierFor(b.tiers, bonus);
        const t = now();
        const memberNumber = L.memberNumber(seq);
        const customer = {
          firstName, lastName: L.clampStr(data.lastName, 40), phone, email,
          birthday: /^\d{4}-\d{2}-\d{2}$/.test(data.birthday || '') ? data.birthday : '', gender: data.gender || '', notes: '',
          marketingConsent: !!data.marketingConsent, preferredChannel: data.preferredChannel || 'whatsapp',
          memberNumber, cardToken: token, scanId, businessId: bid,
          joinedAt: t, lastVisitAt: null, visits: 0, spend: 0, points: bonus, lifetimePoints: bonus,
          redeemedCount: 0, tierId: tier?.id || null, source,
        };
        const card = {
          businessId: bid, customerId: cid, memberNumber, passId: `${bid}.${memberNumber}`,
          qrValue: scanId, barcodeValue: memberNumber, walletStatus: 'none', joinedAt: t,
          ...cardFields(customer), profile: profileOf(customer),
        };
        const ev = { customerId: cid, type: 'join', points: bonus, balance: bonus, amount: 0, at: t, staffUid: u?.uid || null, staffName: u?.name || null, source };
        const evId = db.newId();
        tx.set(P.sub(bid, 'customers', cid), customer);
        tx.set(P.sub(bid, 'phones', phone), { at: t });
        tx.set(P.card(token), card);
        tx.set(P.sub(bid, 'activity', evId), ev);
        tx.set(`cards/${token}/activity/${evId}`, publicEvent(ev));
        tx.update(P.biz(bid), { memberSeq: seq });
        tx.set(P.stats(bid), { statCustomers: db.inc(1) }, { merge: true });
        return { customerId: cid, cardToken: token, memberNumber };
      });
    },

    // ── Transactions / checkout ────────────────────────────
    async recordPurchase(bid, { customerId, amount, qty = 1, locationId = 'main' }) {
      await need(bid, 'checkout');
      amount = L.parseAmount(amount);
      if (!Number.isFinite(amount)) fail('invalid-amount');
      const rewards = await db.list(P.sub(bid, 'rewards'));
      const u = user();
      return db.transaction(async (tx) => {
        const b = await tx.get(P.biz(bid));
        const c = await tx.get(P.sub(bid, 'customers', customerId));
        if (!b || !c) fail('not-found');
        if (!L.canOperate(b)) fail(b.status === 'suspended' ? 'business-suspended' : 'subscription-ended');
        if (b.program.type !== 'visits' && b.program.type !== 'stamps' && amount <= 0) fail('invalid-amount');
        const t = now();
        const r = L.applyPurchase({ customer: c, program: b.program, tiers: b.tiers, rewards, amount, qty, now: t });
        const evId = db.newId();
        const ev = { customerId, type: 'purchase', amount, qty, points: r.earned, balance: r.patch.points, at: t, staffUid: u.uid, staffName: u.name || u.email, locationId };
        tx.update(P.sub(bid, 'customers', customerId), r.patch);
        tx.update(P.card(c.cardToken), cardFields({ ...c, ...r.patch }));
        tx.set(P.sub(bid, 'activity', evId), ev);
        tx.set(`cards/${c.cardToken}/activity/${evId}`, publicEvent(ev));
        if (r.tierUp) {
          const tId = db.newId(); const te = { customerId, type: 'tier', points: 0, rewardName: r.tierUp.name, rewardNameAr: r.tierUp.nameAr || null, at: t + 1, staffUid: u.uid };
          tx.set(P.sub(bid, 'activity', tId), te); tx.set(`cards/${c.cardToken}/activity/${tId}`, publicEvent(te));
        }
        tx.set(P.stats(bid), { statTxns: db.inc(1), statRevenue: db.inc(amount), statPoints: db.inc(r.earned), lastActivityAt: t }, { merge: true });
        return { id: evId, earned: r.earned, balance: r.patch.points, unlocked: r.unlocked, tierUp: r.tierUp, customer: { id: customerId, ...c, ...r.patch } };
      }).then((r) => { pingCard(r.customer); return r; });
    },
    async adjustPoints(bid, customerId, delta, note) {
      await need(bid, 'program');
      delta = Math.trunc(Number(delta)); if (!delta) fail('invalid-amount');
      const u = user();
      return db.transaction(async (tx) => {
        const b = await tx.get(P.biz(bid));
        if (!L.canOperate(b)) fail('subscription-ended');
        const c = await tx.get(P.sub(bid, 'customers', customerId)); if (!c) fail('not-found');
        const points = Math.max(0, (c.points || 0) + delta);
        const lifetime = (c.lifetimePoints || 0) + Math.max(0, delta);
        const patch = { points, lifetimePoints: lifetime, tierId: L.tierFor(b.tiers, lifetime)?.id || null };
        const evId = db.newId(); const ev = { customerId, type: 'adjust', points: delta, balance: points, note: L.clampStr(note, 140), at: now(), staffUid: u.uid, staffName: u.name || u.email };
        tx.update(P.sub(bid, 'customers', customerId), patch);
        tx.update(P.card(c.cardToken), cardFields({ ...c, ...patch }));
        tx.set(P.sub(bid, 'activity', evId), ev);
        tx.set(`cards/${c.cardToken}/activity/${evId}`, publicEvent(ev));
        return { ...patch, _c: c };
      }).then(async ({ _c, ...r }) => { pingCard(_c); await audit(bid, 'points.adjust', { customerId, delta, note }); return r; });
    },
    async listActivity(bid, { customerId, since, limit } = {}) {
      await need(bid, 'transactions');
      const where = [];
      if (customerId) where.push(['customerId', '==', customerId]);
      if (since) where.push(['at', '>=', since]);
      return db.list(P.sub(bid, 'activity'), { where, orderBy: ['at', 'desc'], limit });
    },

    // ── Rewards ────────────────────────────────────────────
    _rewardDoc(r) {
      return {
        name: L.clampStr(r.name, 60), nameAr: L.clampStr(r.nameAr || '', 60), description: L.clampStr(r.description || '', 240),
        image: r.image || null, cost: Math.max(1, Math.trunc(Number(r.cost) || 1)), value: Number(r.value) || 0,
        expiresAt: r.expiresAt || null, minPurchase: Number(r.minPurchase) || 0, usageLimit: Number(r.usageLimit) || 0,
        active: r.active !== false, redeemedCount: r.redeemedCount || 0, createdAt: r.createdAt || now(),
      };
    },
    async listRewards(bid) { return db.list(P.sub(bid, 'rewards'), { orderBy: ['cost', 'asc'] }); },
    async saveReward(bid, r) {
      await need(bid, 'rewards');
      const id = r.id || db.newId();
      const prev = r.id ? await db.get(P.sub(bid, 'rewards', id)) : null;
      await db.set(P.sub(bid, 'rewards', id), S._rewardDoc({ ...prev, ...r, redeemedCount: prev?.redeemedCount || 0 }));
      await audit(bid, r.id ? 'reward.update' : 'reward.create', { id, name: r.name });
      return id;
    },
    async deleteReward(bid, id) { await need(bid, 'rewards'); await db.remove(P.sub(bid, 'rewards', id)); await audit(bid, 'reward.delete', { id }); },

    // ── Redemptions ────────────────────────────────────────
    async listRedemptions(bid, status) {
      await need(bid, 'checkout');
      return db.list(P.sub(bid, 'redemptions'), { where: status ? [['status', '==', status]] : [], orderBy: ['createdAt', 'desc'], limit: 100 });
    },
    // Staff confirms a code the customer shows. Single-use is enforced inside the transaction.
    async redeemCode(bid, rawCode) {
      await need(bid, 'checkout');
      let code = L.toLatinDigits(String(rawCode || '')).toUpperCase().replace(/\s/g, '');
      if (code && !code.startsWith('R-')) code = 'R-' + code.replace(/^R/, '');
      const u = user();
      return db.transaction(async (tx) => {
        if (!L.canOperate(await tx.get(P.biz(bid)))) fail('subscription-ended');
        const red = await tx.get(P.sub(bid, 'redemptions', code));
        if (!red) fail('code-not-found');
        if (red.status === 'redeemed') fail('code-used', { redeemedAt: red.redeemedAt });
        if (red.status !== 'pending') fail('code-cancelled');
        if (red.expiresAt && red.expiresAt < now()) fail('code-expired');
        const c = await tx.get(P.sub(bid, 'customers', red.customerId));
        const rw = await tx.get(P.sub(bid, 'rewards', red.rewardId));
        return S._confirm(tx, bid, { code, red, c, rw, u });
      }).then((r) => { pingCard(r.customer); return r; });
    },
    // Staff redeems directly for a customer standing at the counter (no phone needed).
    async redeemForCustomer(bid, customerId, rewardId) {
      await need(bid, 'checkout');
      const code = L.redemptionCode(); const u = user();
      return db.transaction(async (tx) => {
        if (!L.canOperate(await tx.get(P.biz(bid)))) fail('subscription-ended');
        const c = await tx.get(P.sub(bid, 'customers', customerId));
        const rw = await tx.get(P.sub(bid, 'rewards', rewardId));
        if (!c || !rw) fail('not-found');
        const red = { customerId, cardToken: c.cardToken, rewardId, rewardName: rw.name, rewardNameAr: rw.nameAr || null, cost: rw.cost, status: 'pending', createdAt: now(), source: 'staff' };
        return S._confirm(tx, bid, { code, red, c, rw, u, create: true });
      }).then((r) => { pingCard(r.customer); return r; });
    },
    _confirm(tx, bid, { code, red, c, rw, u, create }) {
      if (!c) fail('not-found');
      if (!rw || !L.rewardIsLive(rw)) fail('reward-unavailable');
      if ((c.points || 0) < red.cost) fail('insufficient-points', { points: c.points, cost: red.cost });
      const t = now();
      const points = c.points - red.cost;
      const done = { ...red, status: 'redeemed', redeemedAt: t, staffUid: u.uid, staffName: u.name || u.email };
      tx.set(P.sub(bid, 'redemptions', code), done);
      tx.set(`cards/${c.cardToken}/redemptions/${code}`, { rewardId: red.rewardId, rewardName: red.rewardName, rewardNameAr: rw.nameAr || null, cost: red.cost, status: 'redeemed', createdAt: red.createdAt, redeemedAt: t, businessId: bid, cardToken: c.cardToken, customerId: c.id });
      tx.update(P.sub(bid, 'customers', c.id), { points, redeemedCount: (c.redeemedCount || 0) + 1 });
      tx.update(P.card(c.cardToken), cardFields({ ...c, points }));
      tx.update(P.sub(bid, 'rewards', red.rewardId), { redeemedCount: db.inc(1) });
      const evId = db.newId();
      const ev = { customerId: c.id, type: 'redeem', points: -red.cost, balance: points, rewardId: red.rewardId, rewardName: red.rewardName, rewardNameAr: rw.nameAr || null, code, at: t, staffUid: u.uid, staffName: u.name || u.email };
      tx.set(P.sub(bid, 'activity', evId), ev);
      tx.set(`cards/${c.cardToken}/activity/${evId}`, publicEvent(ev));
      tx.set(P.stats(bid), { statRedeemed: db.inc(1), lastActivityAt: t }, { merge: true });
      return { code, rewardName: red.rewardName, rewardNameAr: rw.nameAr || null, cost: red.cost, balance: points, customer: { ...c, points } };
    },

    // ── Public: customer side (no login) ──────────────────
    async joinProgram(slug, data) {
      const b = await S.getBusinessBySlug(slug); if (!b) fail('not-found');
      return S._createMember(b.id, { ...data, marketingConsent: !!data.marketingConsent }, 'qr');
    },
    async getCard(token) {
      const card = await db.get(P.card(token)); if (!card || card.deleted) return null;
      const [business, rewards] = await Promise.all([S.getBusiness(card.businessId), S.listRewards(card.businessId)]);
      return { card, business, rewards: rewards.filter((r) => L.rewardIsLive(r)) };
    },
    async listCardActivity(token) { return db.list(`cards/${token}/activity`, { orderBy: ['at', 'desc'], limit: 50 }); },
    async listCardRedemptions(token) { return db.list(`cards/${token}/redemptions`, { orderBy: ['createdAt', 'desc'], limit: 20 }); },
    async requestRedemption(token, rewardId) {
      const card = await db.get(P.card(token)); if (!card) fail('not-found');
      const bid = card.businessId;
      if (!L.canOperate(await S.getBusiness(bid))) fail('subscription-ended');
      const rw = await db.get(P.sub(bid, 'rewards', rewardId));
      if (!rw || !L.rewardIsLive(rw)) fail('reward-unavailable');
      if ((card.points || 0) < rw.cost) fail('insufficient-points');
      // Reuse an open code for the same reward instead of piling up duplicates.
      const open = (await S.listCardRedemptions(token)).find((r) => r.rewardId === rewardId && r.status === 'pending' && r.expiresAt > now());
      if (open) return { code: open.id, rewardName: L.clampStr(rw.name), rewardNameAr: rw.nameAr || null, cost: rw.cost, expiresAt: open.expiresAt };
      const code = L.redemptionCode(); const t = now();
      const red = { customerId: card.customerId, cardToken: token, rewardId, rewardName: rw.name, rewardNameAr: rw.nameAr || null, cost: rw.cost, status: 'pending', createdAt: t, expiresAt: t + 2 * 3600 * 1000, source: 'customer', businessId: bid };
      await db.batch([
        { op: 'set', path: P.sub(bid, 'redemptions', code), data: red },
        { op: 'set', path: `cards/${token}/redemptions/${code}`, data: red },
      ]);
      return { code, rewardName: rw.name, rewardNameAr: rw.nameAr || null, cost: rw.cost, expiresAt: red.expiresAt };
    },
    async updateMyProfile(token, patch) {
      const card = await db.get(P.card(token)); if (!card) fail('not-found');
      const clean = {}; for (const k of SELF_EDITABLE) if (k in patch) clean[k] = typeof patch[k] === 'string' ? L.clampStr(patch[k], 120) : patch[k];
      if (clean.email && !L.validEmail(clean.email)) fail('invalid-email');
      if ('email' in clean) clean.email = clean.email.toLowerCase();
      await db.batch([
        { op: 'update', path: P.sub(card.businessId, 'customers', card.customerId), data: clean },
        { op: 'update', path: P.card(token), data: { profile: { ...(card.profile || {}), ...clean } } },
      ]);
    },

    // ── Data deletion (privacy) ────────────────────────────
    // The customer asks from their card; the owner then removes the personal details.
    async requestDeletion(token) {
      const card = await db.get(P.card(token)); if (!card || card.deleted) fail('not-found');
      const t = now();
      await db.batch([
        { op: 'set', path: P.sub(card.businessId, 'deletionRequests', card.customerId), data: { cardToken: token, memberNumber: card.memberNumber, at: t } },
        { op: 'update', path: P.card(token), data: { deletionRequestedAt: t } },
      ]);
      return t;
    },
    async listDeletionRequests(bid) { await need(bid, 'settings'); return db.list(P.sub(bid, 'deletionRequests'), { orderBy: ['at', 'asc'] }); },
    // Removes name, phone and contact details; the card stops working. Purchase history stays
    // in reports as anonymous activity (it only ever stored the customer id, never the name).
    async deleteCustomerData(bid, cid) {
      await need(bid, 'settings');
      const c = await db.get(P.sub(bid, 'customers', cid)); if (!c) fail('not-found');
      const t = now();
      const ops = [
        { op: 'delete', path: P.sub(bid, 'customers', cid) },
        { op: 'delete', path: P.sub(bid, 'deletionRequests', cid) },
      ];
      if (c.phone) ops.push({ op: 'delete', path: P.sub(bid, 'phones', c.phone) });
      if (c.cardToken) ops.push({ op: 'update', path: P.card(c.cardToken), data: { deleted: true, firstName: '', profile: {}, points: 0, updatedAt: t } });
      await db.batch(ops);
      pingCard(c);
      await audit(bid, 'customer.delete', { customerId: cid, memberNumber: c.memberNumber });
    },

    // ── Staff ──────────────────────────────────────────────
    async listMembers(bid) { await need(bid, 'staff'); return db.list(P.sub(bid, 'members')); },
    async listInvites(bid) { await need(bid, 'staff'); return db.list(P.sub(bid, 'invites')); },
    async inviteMember(bid, { email, role, name }) {
      await need(bid, 'staff');
      email = String(email || '').trim().toLowerCase();
      if (!L.validEmail(email) || !email) fail('invalid-email');
      if (!['manager', 'staff', 'marketing'].includes(role)) fail('invalid-role');
      await db.set(P.sub(bid, 'invites', email), { email, role, name: L.clampStr(name, 60), businessId: bid, invitedBy: user().uid, createdAt: now() });
      await audit(bid, 'staff.invite', { email, role });
    },
    async revokeInvite(bid, email) { await need(bid, 'staff'); await db.remove(P.sub(bid, 'invites', email)); },
    async setMemberRole(bid, uid, role) {
      await need(bid, 'staff');
      if (!['manager', 'staff', 'marketing'].includes(role)) fail('invalid-role');
      const m = await db.get(P.sub(bid, 'members', uid)); if (m?.role === 'owner') fail('cannot-change-owner');
      await db.update(P.sub(bid, 'members', uid), { role }); await audit(bid, 'staff.role', { uid, role });
    },
    async removeMember(bid, uid) {
      await need(bid, 'staff');
      const m = await db.get(P.sub(bid, 'members', uid)); if (m?.role === 'owner') fail('cannot-change-owner');
      await db.remove(P.sub(bid, 'members', uid)); await audit(bid, 'staff.remove', { uid });
    },

    // ── CRM: segments, campaigns, templates ───────────────
    async listSegments(bid) { await need(bid, 'crm'); return db.list(P.sub(bid, 'segments')); },
    async saveSegment(bid, s) {
      await need(bid, 'crm'); const id = s.id || db.newId();
      await db.set(P.sub(bid, 'segments', id), { name: L.clampStr(s.name, 80), rules: (s.rules || []).slice(0, 8), createdAt: s.createdAt || now() });
      return id;
    },
    async deleteSegment(bid, id) { await need(bid, 'crm'); await db.remove(P.sub(bid, 'segments', id)); },
    async listCampaigns(bid) { await need(bid, 'campaigns'); return db.list(P.sub(bid, 'campaigns'), { orderBy: ['createdAt', 'desc'] }); },
    async saveCampaign(bid, c) {
      await need(bid, 'campaigns'); const id = c.id || db.newId();
      await db.set(P.sub(bid, 'campaigns', id), {
        name: L.clampStr(c.name, 80), segment: c.segment, channel: L.CAMPAIGN_CHANNELS.includes(c.channel) ? c.channel : 'whatsapp', header: L.clampStr(c.header || '', 60),
        message: L.clampStr(c.message, 1000), status: c.status || 'draft', recipients: c.recipients || 0,
        createdAt: c.createdAt || now(), preparedAt: c.preparedAt || null,
      });
      return id;
    },
    async deleteCampaign(bid, id) { await need(bid, 'campaigns'); await db.remove(P.sub(bid, 'campaigns', id)); },
    // Builds the recipient list (consenting customers only) with personalised text.
    // Sending integrations (WhatsApp API, SMS, email) plug in here later.
    async prepareCampaign(bid, id, customers, business) {
      await need(bid, 'campaigns');
      if (!L.canOperate(business)) fail('subscription-ended');
      const camp = await db.get(P.sub(bid, 'campaigns', id));
      const ops = []; const out = [];
      for (const c of customers) {
        if (!c.marketingConsent) continue;
        const text = L.renderTemplate(camp.message, { first_name: c.firstName, business_name: business.name, points: c.points, tier: c.tierId, reward: '' });
        out.push({ customerId: c.id, name: c.firstName + ' ' + (c.lastName || ''), phone: c.phone, email: c.email, text });
        ops.push({ op: 'set', path: `${P.sub(bid, 'campaigns', id)}/recipients/${c.id}`, data: { customerId: c.id, channel: camp.channel, status: 'queued', text, at: now() } });
      }
      ops.push({ op: 'update', path: P.sub(bid, 'campaigns', id), data: { status: 'ready', recipients: out.length, preparedAt: now() } });
      await db.batch(ops);
      await audit(bid, 'campaign.prepare', { id, recipients: out.length });
      return out;
    },
    async listTemplates(bid) { await need(bid, 'campaigns'); return db.list(P.sub(bid, 'templates')); },
    async saveTemplate(bid, t) { await need(bid, 'campaigns'); await db.set(P.sub(bid, 'templates', t.id), { channel: t.channel, body: L.clampStr(t.body, 1000), active: !!t.active }); },

    // ── Locations & audit ──────────────────────────────────
    async listLocations(bid) { return db.list(P.sub(bid, 'locations')); },
    async saveLocation(bid, l) {
      await need(bid, 'locations'); const id = l.id || db.newId();
      const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max && n !== 0 ? Math.round(n * 1e6) / 1e6 : null; };
      await db.set(P.sub(bid, 'locations', id), { name: L.clampStr(l.name, 60), address: L.clampStr(l.address, 160), lat: num(l.lat, 90), lng: num(l.lng, 180), nearbyText: L.clampStr(l.nearbyText, 120), createdAt: l.createdAt || now() });
      walletPing('b=' + encodeURIComponent(bid));   // wallet passes pick up the new location
      return id;
    },
    // Sends a campaign to customers' Google Wallet passes (server checks the role again).
    async sendWalletCampaign(bid, campaignId, items) {
      await need(bid, 'campaigns');
      if (mode === 'demo') {   // the demo has no Google account: pretend every pass received it
        await db.update(P.sub(bid, 'campaigns', campaignId), { status: 'sent', sentAt: now(), walletSent: items.length, walletSilent: 0 });
        return { sent: items.length, silent: 0, notInWallet: 0, failed: 0 };
      }
      const base = mode === 'firebase' ? walletFnUrl() : '';
      if (!base) fail('wallet-off');
      const token = await auth.idToken?.();
      if (!token) fail('unauthenticated');
      const total = { sent: 0, silent: 0, notInWallet: 0, failed: 0 };
      for (let i = 0; i < items.length; i += 200) {
        const r = await fetch(`${base}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ bid, campaignId, items: items.slice(i, i + 200) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) fail(j.error || 'failed');
        for (const k of Object.keys(total)) total[k] += j[k] || 0;
      }
      await audit(bid, 'campaign.wallet', { campaignId, ...total });
      return total;
    },
    async deleteLocation(bid, id) { await need(bid, 'locations'); if (id === 'main') fail('cannot-delete-main'); await db.remove(P.sub(bid, 'locations', id)); },
    // The owner's own contact number, so the platform can reach them (owner + platform admin only).
    async ownerContact(bid) { await need(bid, 'settings'); return (await db.get(P.sub(bid, 'private', 'settings'))) || {}; },
    async updateOwnerContact(bid, { phone }) {
      await need(bid, 'settings');
      const ownerPhone = phone ? L.normalizePhone(phone) : ''; if (phone && !ownerPhone) fail('invalid-phone');
      await db.set(P.sub(bid, 'private', 'settings'), { ownerPhone }, { merge: true });
      return ownerPhone;
    },
    async listAudit(bid) { await need(bid, 'settings'); return db.list(P.sub(bid, 'audit'), { orderBy: ['at', 'desc'], limit: 100 }); },

    // ── Platform admin (aggregates only — no customer PII) ─
    async adminListBusinesses() {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const [biz, stats] = await Promise.all([db.list('businesses', { orderBy: ['createdAt', 'desc'] }), db.list('stats')]);
      const byId = new Map(stats.map((x) => [x.id, x]));
      return biz.map((b) => ({ ...(byId.get(b.id) || {}), ...b, id: b.id }));
    },
    // Owner contacts + the admin's own notes for every business, keyed by business id.
    async adminDirectory() {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const biz = await db.list('businesses');
      const [contacts, notes] = await Promise.all([
        Promise.all(biz.map((b) => db.get(P.sub(b.id, 'private', 'settings')).catch(() => null))),
        db.list('adminNotes').catch(() => []),
      ]);
      const noteBy = new Map(notes.map((n) => [n.id, n]));
      return new Map(biz.map((b, i) => [b.id, { ...(contacts[i] || {}), note: noteBy.get(b.id) || null }]));
    },
    async adminBusinessDetails(bid) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const [b, stats, contact, note, payments, members] = await Promise.all([
        db.get(P.biz(bid)), db.get(P.stats(bid)), db.get(P.sub(bid, 'private', 'settings')).catch(() => null),
        db.get(`adminNotes/${bid}`).catch(() => null), db.list(P.sub(bid, 'payments'), { orderBy: ['at', 'desc'] }).catch(() => []),
        db.list(P.sub(bid, 'members')).catch(() => []),
      ]);
      if (!b) fail('not-found');
      return { ...(stats || {}), ...b, id: bid, contact: contact || {}, note: note || {}, payments, members };
    },
    async adminSetOwnerPhone(bid, phone) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const ownerPhone = phone ? L.normalizePhone(phone) : ''; if (phone && !ownerPhone) fail('invalid-phone');
      await db.set(P.sub(bid, 'private', 'settings'), { ownerPhone }, { merge: true });
      return ownerPhone;
    },
    async adminSaveNote(bid, text) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      await db.set(`adminNotes/${bid}`, { text: L.clampStr(text, 4000), updatedAt: now() }, { merge: true });
    },
    async adminMarkContacted(bid) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const t = now(); await db.set(`adminNotes/${bid}`, { contactedAt: t }, { merge: true }); return t;
    },
    // Every recorded payment across all businesses, newest first.
    async adminListPayments() {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const rows = await db.listGroup('payments');
      return rows.map((p) => ({ ...p, businessId: p.businessId || String(p._path || '').split('/')[1] })).sort((a, b) => (b.at || 0) - (a.at || 0));
    },
    async adminSetStatus(bid, status) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      if (!['active', 'suspended'].includes(status)) fail('invalid');
      await db.update(P.biz(bid), { status }); await audit(bid, 'admin.status', { status });
    },
    async adminSetPlan(bid, plan) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      if (!L.PLANS.includes(plan)) fail('invalid');
      await db.update(P.biz(bid), { plan }); await audit(bid, 'admin.plan', { plan });
    },
    // Record a payment received (cash, Sham Cash, transfer…) and add paid time.
    async adminMarkPaid(bid, { months, plan, amount, currency, method, note }) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      months = Math.trunc(Number(months)); if (!(months >= 1 && months <= 36)) fail('invalid');
      if (!L.PAID_PLANS.includes(plan)) fail('invalid');
      const b = await db.get(P.biz(bid)); if (!b) fail('not-found');
      const paidUntil = L.extendPaid(b, months);
      const u = user();
      await db.batch([
        { op: 'update', path: P.biz(bid), data: { paidUntil, plan } },
        { op: 'set', path: P.sub(bid, 'payments', db.newId()), data: { businessId: bid, months, plan, amount: Number(amount) || 0, currency: currency || 'USD', method: L.clampStr(method, 40), note: L.clampStr(note, 200), periodEnd: paidUntil, at: now(), by: u.email } },
      ]);
      await audit(bid, 'admin.paid', { months, plan, amount, paidUntil });
      return paidUntil;
    },
    async adminExtendTrial(bid, days) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      days = Math.trunc(Number(days)); if (!(days >= 1 && days <= 365)) fail('invalid');
      const b = await db.get(P.biz(bid)); if (!b) fail('not-found');
      const trialEndsAt = L.extendTrial(b, days);
      await db.update(P.biz(bid), { trialEndsAt }); await audit(bid, 'admin.trial', { days, trialEndsAt });
      return trialEndsAt;
    },
    // Set the exact last day of the trial (earlier or later), e.g. to undo an extension made by mistake.
    async adminSetTrialEnd(bid, ymd) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); if (!m) fail('invalid');
      const trialEndsAt = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59).getTime();   // end of that day
      const b = await db.get(P.biz(bid)); if (!b) fail('not-found');
      await db.update(P.biz(bid), { trialEndsAt }); await audit(bid, 'admin.trial_set', { from: b.trialEndsAt || null, trialEndsAt });
      return trialEndsAt;
    },
    async listPayments(bid) {
      if (!(await S.isPlatformAdmin())) await need(bid, 'billing');
      return db.list(P.sub(bid, 'payments'), { orderBy: ['at', 'desc'] });
    },
    // Public platform settings: trial length, prices, how to pay, announcement.
    async platformSettings() {
      const s = (await db.get('platform/settings')) || {};
      return {
        signupsOpen: s.signupsOpen !== false, announcement: s.announcement || '', trialDays: s.trialDays || L.DEFAULT_TRIAL_DAYS,
        currency: s.currency || 'USD', prices: { starter: 15, professional: 30, enterprise: 60, ...(s.prices || {}) },
        paymentInfo: s.paymentInfo || '', supportWhatsapp: s.supportWhatsapp || '',
      };
    },
    async adminSettings() { return S.platformSettings(); },
    async adminSaveSettings(s) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const prices = {}; for (const p of L.PAID_PLANS) prices[p] = Math.max(0, Number(s.prices?.[p]) || 0);
      await db.set('platform/settings', {
        signupsOpen: !!s.signupsOpen, announcement: L.clampStr(s.announcement, 300),
        trialDays: Math.min(365, Math.max(1, Math.trunc(Number(s.trialDays) || L.DEFAULT_TRIAL_DAYS))),
        currency: L.clampStr(s.currency || 'USD', 6), prices,
        paymentInfo: L.clampStr(s.paymentInfo, 1000), supportWhatsapp: L.clampStr(s.supportWhatsapp, 20),
      });
    },
    // Home page FAQ (public). Falls back to the built-in questions until the admin saves a list.
    async faq() {
      const d = await db.get('platform/faq').catch(() => null);
      return { items: d && Array.isArray(d.items) ? cleanFaq(d.items) : DEFAULT_FAQ, custom: !!d, updatedAt: d?.updatedAt || null };
    },
    async adminSaveFaq(items) {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      const clean = cleanFaq(items);
      await db.set('platform/faq', { items: clean, updatedAt: now(), by: user()?.email || '' });
      return clean;
    },
    async adminResetFaq() {
      if (!(await S.isPlatformAdmin())) fail('permission-denied');
      await db.remove('platform/faq');
    },
  };
  return S;
}
