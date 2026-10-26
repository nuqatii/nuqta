// Pure loyalty logic — no DOM, no storage. Shared by every portal and by the tests.

export const DAY = 86400000;

export const BUSINESS_TYPES = ['restaurant', 'cafe', 'retail', 'salon', 'gym', 'beauty', 'grocery', 'other'];
export const PROGRAM_TYPES = ['points', 'visits', 'stamps', 'spend'];
export const ROLES = ['owner', 'manager', 'staff', 'marketing'];
export const CHANNELS = ['whatsapp', 'sms', 'email', 'push'];
// Campaigns can also go to customers' Google Wallet passes (push notification on the pass).
export const CAMPAIGN_CHANNELS = [...CHANNELS, 'gwallet'];

// What each role may open. Mirrored server-side in firestore.rules.
export const PERMISSIONS = {
  owner:     ['billing', 'dashboard', 'checkout', 'customers', 'transactions', 'rewards', 'program', 'designer', 'crm', 'campaigns', 'analytics', 'locations', 'staff', 'settings', 'qr'],
  manager:   ['dashboard', 'checkout', 'customers', 'transactions', 'rewards', 'program', 'crm', 'analytics', 'locations', 'qr'],
  staff:     ['checkout', 'customers', 'transactions'],
  marketing: ['dashboard', 'customers', 'crm', 'campaigns', 'analytics', 'qr'],
};
export const can = (role, area) => !!PERMISSIONS[role]?.includes(area);

// ── Subscription ────────────────────────────────────────
// A business runs on a free trial, then on paid time that the platform admin adds.
// Keep GRACE_DAYS / DEFAULT_TRIAL_DAYS in sync with firestore.rules.
// Two plans with every feature: Basic for up to 3 branches, Enterprise for 4 or more.
export const PLANS = ['trial', 'basic', 'enterprise'];
export const PAID_PLANS = ['basic', 'enterprise'];
export const BASIC_MAX_LOCATIONS = 3;
// Older plan names (before 26 Oct 2026) count as Basic.
export const planKey = (p) => (p === 'starter' || p === 'professional' ? 'basic' : PLANS.includes(p) ? p : 'trial');
export const maxLocations = (b) => (planKey(b?.plan) === 'enterprise' ? Infinity : BASIC_MAX_LOCATIONS);
export const planForLocations = (n) => (n > BASIC_MAX_LOCATIONS ? 'enterprise' : 'basic');
export const GRACE_DAYS = 3;
export const DEFAULT_TRIAL_DAYS = 30;
export const trialEnd = (b) => b?.trialEndsAt ?? ((b?.createdAt || Date.now()) + DEFAULT_TRIAL_DAYS * DAY);
//   trial     → inside the free trial
//   active    → paid time remaining
//   grace     → trial/subscription ended less than GRACE_DAYS ago: everything still works, with warnings
//   expired   → locked: no new points, joins or redemptions; dashboard shows only the Subscription page
//   suspended → paused by the platform admin
export function accessState(b, now = Date.now()) {
  if (!b) return { state: 'expired', endsAt: 0, daysLeft: 0 };
  if (b.status === 'suspended') return { state: 'suspended', endsAt: 0, daysLeft: 0 };
  const tEnd = trialEnd(b); const paid = b.paidUntil || 0;
  const end = Math.max(tEnd, paid);
  const days = (ms) => Math.max(0, Math.ceil((ms - now) / DAY));
  if (paid > now) return { state: 'active', endsAt: paid, daysLeft: days(paid) };
  if (tEnd > now) return { state: 'trial', endsAt: tEnd, daysLeft: days(tEnd) };
  const lockAt = end + GRACE_DAYS * DAY;
  if (now < lockAt) return { state: 'grace', endsAt: end, lockAt, daysLeft: days(lockAt) };
  return { state: 'expired', endsAt: end, daysLeft: 0 };
}
export const canOperate = (b, now) => ['trial', 'active', 'grace'].includes(accessState(b, now).state);
// New paid time starts after whatever the business already has (trial or earlier payment).
export function extendPaid(b, months, now = Date.now()) {
  const start = new Date(Math.max(now, b?.paidUntil || 0, trialEnd(b)));
  const end = new Date(start); end.setMonth(end.getMonth() + months);
  return end.getTime();
}
export const extendTrial = (b, days, now = Date.now()) => Math.max(now, trialEnd(b)) + days * DAY;

// ── Programs ────────────────────────────────────────────────
// Every program type is stored as a single integer balance ("units"):
//   points  → `earn` points for every `per` of currency spent
//   visits  → 1 unit per visit
//   stamps  → 1 stamp per item (qty) bought
//   spend   → 1 unit per `per` of currency spent; rewards unlock at spend thresholds
export function defaultProgram(type = 'points', currency = 'SYP') {
  // New Syrian pound (two zeros removed in 2026): 10 SYP → 1 point keeps numbers human.
  const per = currency === 'SYP' ? 10 : 1;
  switch (type) {
    case 'visits': return { type, per: 0, earn: 1, goal: 10, welcomeBonus: 0 };
    case 'stamps': return { type, per: 0, earn: 1, goal: 10, welcomeBonus: 0 };
    case 'spend':  return { type, per: currency === 'SYP' ? 1 : 1, earn: 1, goal: currency === 'SYP' ? 10000 : 100, welcomeBonus: 0 };
    default:       return { type: 'points', per, earn: 1, goal: 0, welcomeBonus: 0 };
  }
}

export function earnFor(program, { amount = 0, qty = 1 } = {}) {
  const p = program || defaultProgram();
  amount = Math.max(0, Number(amount) || 0);
  qty = Math.max(1, Math.floor(Number(qty) || 1));
  switch (p.type) {
    case 'visits': return 1 * (p.earn || 1);
    case 'stamps': return qty * (p.earn || 1);
    case 'spend':
    case 'points':
    default: {
      const per = Number(p.per) > 0 ? Number(p.per) : 1;
      return Math.floor((amount / per) * (Number(p.earn) || 1));
    }
  }
}

// Number of circles on a stamp/visit card: the cheapest live reward, so the grid fills up
// exactly when a reward becomes available. Falls back to the program's goal.
export function stampGoal(program, rewards) {
  const costs = (rewards || []).filter((r) => rewardIsLive(r)).map((r) => r.cost).filter((n) => n > 0);
  const g = costs.length ? Math.min(...costs) : (program?.goal || 10);
  return Math.min(20, Math.max(2, Math.round(g)));
}
// Stamp & visit cards count in rounds: the card shows stamps toward the NEXT reward and
// how many full cards (rewards) are saved up. The stored balance is the plain total, so
// redeeming one reward simply subtracts one card's worth.
export const isStampy = (program) => program?.type === 'stamps' || program?.type === 'visits';
// Days until the customer's next birthday (0 = today), or null without a birthday.
// 29 Feb birthdays are celebrated on 28 Feb in other years.
export function daysToBirthday(birthday, now = Date.now()) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(birthday || ''); if (!m) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const on = (y) => { const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; const d = +m[1] === 2 && +m[2] === 29 && !leap ? 28 : +m[2]; return new Date(y, +m[1] - 1, d); };
  let next = on(today.getFullYear());
  if (next < today) next = on(today.getFullYear() + 1);
  return Math.round((next - today) / DAY);
}
export const BIRTHDAY_FILTERS = { bday_today: 0, bday_week: 7 };

export function stampState(program, rewards, points) {
  const goal = stampGoal(program, rewards);
  const p = Math.max(0, Math.floor(points || 0));
  return { goal, progress: p % goal, ready: Math.floor(p / goal), left: goal - (p % goal) };
}
// How many rewards the customer can take right now (shown as "N rewards ready").
export function readyCount(program, rewards, points) {
  if (isStampy(program)) return stampState(program, rewards, points).ready;
  return (rewards || []).filter((r) => rewardIsLive(r) && (points || 0) >= r.cost).length;
}
export const unitKey = (type) => ({ points: 'u_points', visits: 'u_visits', stamps: 'u_stamps', spend: 'u_spend' }[type] || 'u_points');

// ── Tiers ───────────────────────────────────────────────────
export function defaultTiers() {
  return [
    { id: 'bronze', name: 'Bronze', nameAr: 'برونزي', min: 0,     color: '#A86B3C', benefits: '' },
    { id: 'silver', name: 'Silver', nameAr: 'فضي',    min: 1000,  color: '#8A97A8', benefits: '' },
    { id: 'gold',   name: 'Gold',   nameAr: 'ذهبي',   min: 5000,  color: '#C9A227', benefits: '' },
    { id: 'vip',    name: 'VIP',    nameAr: 'VIP',    min: 10000, color: '#1D2433', benefits: '' },
  ];
}

// Tier is earned on lifetime units (spending points never drops a tier).
export function tierFor(tiers, lifetime) {
  const sorted = [...(tiers || [])].sort((a, b) => a.min - b.min);
  let cur = sorted[0] || null;
  for (const t of sorted) if ((lifetime || 0) >= t.min) cur = t;
  return cur;
}
export function nextTier(tiers, lifetime) {
  return [...(tiers || [])].sort((a, b) => a.min - b.min).find((t) => t.min > (lifetime || 0)) || null;
}

// ── Rewards ─────────────────────────────────────────────────
export function rewardIsLive(r, now = Date.now()) {
  if (!r || !r.active) return false;
  if (r.expiresAt && r.expiresAt < now) return false;
  if (r.usageLimit && (r.redeemedCount || 0) >= r.usageLimit) return false;
  return true;
}
export function affordableRewards(rewards, balance, now = Date.now()) {
  return (rewards || []).filter((r) => rewardIsLive(r, now) && balance >= r.cost);
}
// Rewards that became affordable because balance went from `before` to `after`.
export function newlyUnlocked(rewards, before, after, now = Date.now()) {
  return (rewards || []).filter((r) => rewardIsLive(r, now) && before < r.cost && after >= r.cost);
}

// ── Purchase (the heart of checkout) ────────────────────────
// Returns the full set of field changes so every backend applies identical math.
export function applyPurchase({ customer, program, tiers, rewards, amount, qty, now = Date.now() }) {
  const earned = earnFor(program, { amount, qty });
  const before = customer.points || 0;
  const after = before + earned;
  const lifetime = (customer.lifetimePoints || 0) + earned;
  const oldTier = tierFor(tiers, customer.lifetimePoints || 0);
  const newTier = tierFor(tiers, lifetime);
  return {
    earned,
    patch: {
      points: after,
      lifetimePoints: lifetime,
      visits: (customer.visits || 0) + 1,
      spend: round2((customer.spend || 0) + (Number(amount) || 0)),
      lastVisitAt: now,
      tierId: newTier?.id || null,
    },
    unlocked: newlyUnlocked(rewards, before, after, now),
    tierUp: newTier && oldTier && newTier.id !== oldTier.id ? newTier : null,
  };
}

// ── Segments ────────────────────────────────────────────────
export const AUTO_SEGMENTS = ['new', 'active', 'loyal', 'vip', 'at_risk', 'inactive'];

export function autoSegment(c, tiers, now = Date.now()) {
  const sinceVisit = c.lastVisitAt ? (now - c.lastVisitAt) / DAY : Infinity;
  const sinceJoin = (now - (c.joinedAt || now)) / DAY;
  const top = [...(tiers || [])].sort((a, b) => b.min - a.min)[0];
  if (sinceJoin <= 14 && (c.visits || 0) <= 2) return 'new';
  if (sinceVisit > 60) return 'inactive';
  if (sinceVisit > 30) return 'at_risk';
  if (top && c.tierId === top.id) return 'vip';
  if ((c.visits || 0) >= 5) return 'loyal';
  return 'active';
}

export const RULE_FIELDS = {
  daysSinceVisit: (c, now) => (c.lastVisitAt ? Math.floor((now - c.lastVisitAt) / DAY) : 9999),
  joinedDaysAgo:  (c, now) => Math.floor((now - (c.joinedAt || now)) / DAY),
  spend:          (c) => c.spend || 0,
  points:         (c) => c.points || 0,
  lifetimePoints: (c) => c.lifetimePoints || 0,
  visits:         (c) => c.visits || 0,
  redeemedCount:  (c) => c.redeemedCount || 0,
  tierId:         (c) => c.tierId || '',
  birthdayMonth:  (c) => (c.birthday ? Number(String(c.birthday).slice(5, 7)) : 0),
  marketingConsent: (c) => (c.marketingConsent ? 1 : 0),
};
const OPS = {
  gt: (a, b) => a > b, gte: (a, b) => a >= b, lt: (a, b) => a < b, lte: (a, b) => a <= b,
  eq: (a, b) => String(a) === String(b), neq: (a, b) => String(a) !== String(b),
};
export function matchesRules(c, rules, now = Date.now()) {
  return (rules || []).every((r) => {
    const f = RULE_FIELDS[r.field]; const op = OPS[r.op];
    if (!f || !op) return false;
    const v = typeof f(c, now) === 'number' ? Number(r.value) : r.value;
    return op(f(c, now), v);
  });
}
export function presetSegments() {
  return [
    { id: 'preset_30d',      name: "Haven't visited in 30 days", nameAr: 'لم يزوروا منذ ٣٠ يوماً', rules: [{ field: 'daysSinceVisit', op: 'gte', value: 30 }] },
    { id: 'preset_month',    name: 'Joined this month',          nameAr: 'انضموا هذا الشهر',        rules: [{ field: 'joinedDaysAgo', op: 'lte', value: 30 }] },
    { id: 'preset_never',    name: 'Never redeemed a reward',    nameAr: 'لم يستبدلوا أي مكافأة',    rules: [{ field: 'redeemedCount', op: 'eq', value: 0 }] },
    { id: 'preset_1000',     name: 'More than 1,000 points',     nameAr: 'أكثر من ١٠٠٠ نقطة',       rules: [{ field: 'points', op: 'gt', value: 1000 }] },
  ];
}

// ── Messaging templates ─────────────────────────────────────
export const TEMPLATE_VARS = ['first_name', 'business_name', 'points', 'reward', 'tier'];
export function renderTemplate(body, vars) {
  return String(body || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
}
export function defaultTemplates() {
  return [
    { id: 'welcome',      channel: 'whatsapp', active: true, body: 'أهلاً {{first_name}}! انضممت إلى برنامج مكافآت {{business_name}}. رصيدك الآن {{points}}.' },
    { id: 'reward_ready', channel: 'whatsapp', active: true, body: 'خبر حلو يا {{first_name}} — صار عندك رصيد كافٍ لـ {{reward}} عند {{business_name}}.' },
    { id: 'tier_up',      channel: 'whatsapp', active: true, body: 'مبروك {{first_name}}! وصلت إلى مستوى {{tier}} في {{business_name}}.' },
    { id: 'birthday',     channel: 'whatsapp', active: false, body: 'كل عام وأنت بخير {{first_name}}! هديتك بانتظارك في {{business_name}} هذا الأسبوع.' },
    { id: 'winback',      channel: 'whatsapp', active: false, body: 'اشتقنا لك يا {{first_name}}! رصيدك {{points}} ما زال بانتظارك في {{business_name}}.' },
  ];
}

// ── Codes & identifiers ─────────────────────────────────────
const SAFE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function randomString(n, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  const out = []; const buf = new Uint32Array(n);
  globalThis.crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(alphabet[buf[i] % alphabet.length]);
  return out.join('');
}
export const redemptionCode = () => 'R-' + randomString(6, SAFE);
export const cardToken = () => randomString(24, 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789');
export const memberNumber = (seq) => String(100000 + seq);

// Rough Arabic → Latin transliteration so Arabic business names get readable join links.
const AR = { 'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ؤ': 'o', 'ء': '' };
export function slugify(name) {
  const s = String(name || '').replace(/[\u064B-\u0652]/g, '').replace(/[\u0621-\u064A]/g, (ch) => AR[ch] ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  return s.length >= 3 ? s : 'biz-' + randomString(5);
}

// ── Input normalisation ─────────────────────────────────────
export function toLatinDigits(s) {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}
// Syrian-first phone normalisation to E.164. Returns '' if clearly invalid.
export function normalizePhone(raw) {
  let s = toLatinDigits(raw).replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) return /^\+\d{8,15}$/.test(s) ? s : '';
  if (/^09\d{8}$/.test(s)) return '+963' + s.slice(1);   // 09xx xxx xxx
  if (/^9\d{8}$/.test(s)) return '+963' + s;              // 9xx xxx xxx
  if (/^963\d{9}$/.test(s)) return '+' + s;
  if (/^\d{8,15}$/.test(s)) return '+' + s;
  return '';
}
export function parseAmount(raw) {
  const n = Number(toLatinDigits(raw).replace(/[,،\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? round2(n) : NaN;
}
export const validEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());
export const round2 = (n) => Math.round(n * 100) / 100;
export const clampStr = (s, n = 120) => String(s ?? '').trim().slice(0, n);
