// Realistic demo data: Joe's Pizza (Damascus) with 250 members and ~6 months of history,
// plus a second tenant (Urban Coffee) so tenant isolation can be seen in the demo.
import * as L from '../core/loyalty.js';

export const DEMO_ACCOUNTS = {
  owner:     { email: 'owner@joespizza.demo',     password: 'demo1234', name: 'Joe Haddad',    uid: 'u_joe' },
  manager:   { email: 'manager@joespizza.demo',   password: 'demo1234', name: 'Omar Saleh',    uid: 'u_omar' },
  staff:     { email: 'staff@joespizza.demo',     password: 'demo1234', name: 'Lina Khoury',   uid: 'u_lina' },
  marketing: { email: 'marketing@joespizza.demo', password: 'demo1234', name: 'Sara Nasr',     uid: 'u_sara' },
  other:     { email: 'owner@urbancoffee.demo',   password: 'demo1234', name: 'Karim Aswad',   uid: 'u_karim' },
  admin:     { email: 'admin@nuqta.demo',         password: 'demo1234', name: 'Platform Admin', uid: 'u_admin' },
};
export const DEMO_CARD = 'demoMayaCard7Qp2xKw9Lr4Tz';
export const DEMO_CARD_UC = 'demoMayaCoffee3Hn8Vd5Rk2Wq';   // Maya also belongs to Urban Coffee — shows the multi-card wallet

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const svgLogo = (bg, fg, glyph) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${bg}"/>${glyph.replaceAll('FG', fg)}</svg>`);
const PIZZA = svgLogo('#FFF4E0', '#B3261E', '<path d="M48 18 L78 70 Q48 84 18 70 Z" fill="FG"/><path d="M48 18 L78 70 Q48 84 18 70 Z" fill="none" stroke="#F2B544" stroke-width="5" stroke-linejoin="round"/><circle cx="46" cy="50" r="5" fill="#FFF4E0"/><circle cx="56" cy="62" r="4" fill="#FFF4E0"/><circle cx="38" cy="64" r="4" fill="#FFF4E0"/>');
const CUP = svgLogo('#1F3A33', '#E9DCC4', '<path d="M28 38 h34 v18 a17 17 0 0 1 -34 0 z" fill="FG"/><path d="M62 42 h5 a7 7 0 0 1 0 14 h-5" fill="none" stroke="FG" stroke-width="4"/><path d="M38 22 q4 6 0 10 M48 22 q4 6 0 10" stroke="FG" stroke-width="3" fill="none" stroke-linecap="round"/>');

const FIRST = ['محمد', 'أحمد', 'رنا', 'لين', 'يزن', 'نور', 'سامر', 'هبة', 'خالد', 'ريم', 'عمر', 'سلمى', 'طارق', 'ديما', 'باسل', 'جود', 'مازن', 'تالا', 'فراس', 'لمى', 'غيث', 'ميس', 'كنان', 'رهف', 'أنس', 'شام', 'وسيم', 'زينة', 'إياد', 'حلا', 'Ramy', 'Lara', 'Fadi', 'Nadia', 'Hadi', 'Yara'];
const LAST = ['الحلبي', 'الشامي', 'خوري', 'العلي', 'حداد', 'النابلسي', 'القدسي', 'الأسعد', 'المصري', 'السيد', 'درويش', 'الخطيب', 'Sabbagh', 'Haddad', 'Khoury', 'Nassar'];

export async function seedDemo(db, auth) {
  const R = rng(20261007);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + Math.floor(R() * (b - a + 1));
  const NOW = Date.now(); const DAY = L.DAY;
  const ops = [];
  const set = (path, data) => ops.push({ op: 'set', path, data });

  for (const a of Object.values(DEMO_ACCOUNTS)) await auth._createUser(a.email, a.password, a.name, a.uid);
  set(`platformAdmins/${DEMO_ACCOUNTS.admin.uid}`, { email: DEMO_ACCOUNTS.admin.email, at: NOW });
  set('platform/settings', { signupsOpen: true, announcement: '', trialDays: 30, currency: 'USD', prices: { starter: 15, professional: 30, enterprise: 60 },
    paymentInfo: 'Sham Cash / Syriatel Cash: 0944 000 000\nBank transfer: ask us for the details\nOr pay in cash at our office in Mezzeh.', supportWhatsapp: '+963944000000' });

  // ── Joe's Pizza ───────────────────────────────────────
  const bid = 'joespizza01';
  const tiers = [
    { id: 'bronze', name: 'Bronze', nameAr: 'برونزي', min: 0,    color: '#A86B3C', benefits: 'نقاط على كل طلب' },
    { id: 'silver', name: 'Silver', nameAr: 'فضي',    min: 1000, color: '#7D8B9C', benefits: 'مشروب مجاني في عيد ميلادك' },
    { id: 'gold',   name: 'Gold',   nameAr: 'ذهبي',   min: 3000, color: '#C9A227', benefits: 'أولوية في حجز الطاولات' },
    { id: 'vip',    name: 'VIP',    nameAr: 'VIP',    min: 6000, color: '#2B1B17', benefits: 'بيتزا كبيرة مجانية كل شهر' },
  ];
  const program = { type: 'points', per: 10, earn: 1, goal: 0, welcomeBonus: 50 };
  const rewards = [
    { id: 'rw_drink',   name: 'Free soft drink',  nameAr: 'مشروب غازي مجاني',  cost: 150,  value: 150,  description: 'أي علبة من البراد' },
    { id: 'rw_garlic',  name: 'Garlic bread',     nameAr: 'خبز بالثوم',         cost: 300,  value: 350,  description: '' },
    { id: 'rw_dessert', name: 'Free dessert',     nameAr: 'حلوى مجانية',        cost: 500,  value: 600,  description: 'بيتزا نوتيلا أو تيراميسو' },
    { id: 'rw_15',      name: '15% off your bill', nameAr: 'خصم ١٥٪ على فاتورتك', cost: 800,  value: 0,    description: 'داخل المطعم فقط' },
    { id: 'rw_pizza',   name: 'Free large pizza', nameAr: 'بيتزا كبيرة مجانية', cost: 1500, value: 1800, description: 'أي بيتزا من القائمة' },
  ];
  const rewardState = Object.fromEntries(rewards.map((r) => [r.id, 0]));
  const stats = { txns: 0, revenue: 0, points: 0, redeemed: 0 };

  const bdayIn = (days, year) => { const d = new Date(NOW + days * DAY); return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const customers = [];
  for (let i = 0; i < 250; i++) {
    const roll = R();
    const visits = roll < 0.48 ? between(1, 2) : roll < 0.78 ? between(3, 5) : roll < 0.95 ? between(6, 11) : between(22, 48);
    const joinedAt = NOW - between(2, 182) * DAY - between(0, 86400) * 1000;
    const isMaya = i === 0;
    customers.push({
      id: isMaya ? 'cust_maya' : 'c' + String(i).padStart(4, '0') + L.randomString(6),
      firstName: isMaya ? 'مايا' : pick(FIRST), lastName: isMaya ? 'الحلبي' : pick(LAST),
      phone: isMaya ? '+963944123456' : '+9639' + between(30000000, 99999999),
      email: R() < 0.4 ? `member${i}@example.com` : '',
      // A few birthdays today and this week so the birthday filters have something to show.
      birthday: ((bd) => (i % 83 === 5 ? bdayIn(0, 1990 + (i % 15)) : i % 97 === 11 ? bdayIn(3, 1995) : bd))(R() < 0.55 ? `${between(1970, 2006)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}` : ''),
      gender: '', notes: isMaya ? 'Prefers thin crust. Usually orders for the office on Thursdays.' : '',
      marketingConsent: isMaya || R() < 0.7, preferredChannel: R() < 0.8 ? 'whatsapp' : 'sms', walletGoogle: i % 5 < 2,
      memberNumber: L.memberNumber(i + 1), cardToken: isMaya ? DEMO_CARD : L.cardToken(),
      scanId: isMaya ? 'NQMAYA2026' : 'NQ' + L.randomString(10, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
      businessId: bid, joinedAt, lastVisitAt: null, visits: 0, spend: 0, points: program.welcomeBonus, lifetimePoints: program.welcomeBonus,
      redeemedCount: 0, tierId: 'bronze', source: R() < 0.8 ? 'qr' : 'staff', _plannedVisits: isMaya ? 14 : visits,
    });
  }

  const staffPool = [DEMO_ACCOUNTS.staff, DEMO_ACCOUNTS.staff, DEMO_ACCOUNTS.manager, DEMO_ACCOUNTS.owner];
  const events = [];
  for (const c of customers) {
    events.push({ c, ev: { customerId: c.id, type: 'join', points: program.welcomeBonus, balance: program.welcomeBonus, amount: 0, at: c.joinedAt, source: c.source } });
    // Visits spread between joining and now; a third of members drift away (older visits only).
    const drifting = c.id !== 'cust_maya' && R() < 0.3;
    const end = drifting ? Math.max(c.joinedAt + DAY, NOW - between(35, 120) * DAY) : NOW - between(0, 20) * DAY;
    const times = Array.from({ length: c._plannedVisits }, () => c.joinedAt + R() * Math.max(DAY, end - c.joinedAt)).sort((a, b) => a - b);
    for (const at of times) {
      const amount = Math.round(between(45, 210) * 10);      // 450–2,100 SYP
      const s = pick(staffPool);
      const r = L.applyPurchase({ customer: c, program, tiers, rewards: [], amount, qty: 1, now: at });
      Object.assign(c, r.patch);
      stats.txns++; stats.revenue += amount; stats.points += r.earned;
      events.push({ c, ev: { customerId: c.id, type: 'purchase', amount, qty: 1, points: r.earned, balance: c.points, at, staffUid: s.uid, staffName: s.name, locationId: R() < 0.7 ? 'main' : 'abu-rummaneh' } });
      if (r.tierUp) events.push({ c, ev: { customerId: c.id, type: 'tier', points: 0, rewardName: r.tierUp.name, rewardNameAr: r.tierUp.nameAr, at: at + 1 } });
      // Sometimes they spend points on the way out.
      const afford = rewards.filter((x) => x.cost <= c.points);
      if (afford.length && R() < 0.28 && c.id !== 'cust_maya') {
        const rw = pick(afford);
        c.points -= rw.cost; c.redeemedCount++; rewardState[rw.id]++; stats.redeemed++;
        const code = L.redemptionCode(); const t = at + 60000;
        events.push({ c, ev: { customerId: c.id, type: 'redeem', points: -rw.cost, balance: c.points, rewardId: rw.id, rewardName: rw.name, rewardNameAr: rw.nameAr, code, at: t, staffUid: s.uid, staffName: s.name },
          red: { code, data: { customerId: c.id, cardToken: c.cardToken, rewardId: rw.id, rewardName: rw.name, rewardNameAr: rw.nameAr, cost: rw.cost, status: 'redeemed', createdAt: t - 30000, redeemedAt: t, staffUid: s.uid, staffName: s.name, source: 'customer', businessId: bid } } });
      }
    }
  }
  // Maya has an open reward code waiting at the counter — try it in Checkout → "Verify a code".
  const maya = customers[0];
  maya.points = Math.max(maya.points, 820); maya.lifetimePoints = Math.max(maya.lifetimePoints, 2400);
  maya.tierId = L.tierFor(tiers, maya.lifetimePoints).id;
  const pend = { customerId: maya.id, cardToken: maya.cardToken, rewardId: 'rw_dessert', rewardName: 'Free dessert', rewardNameAr: 'حلوى مجانية', cost: 500, status: 'pending', createdAt: NOW - 5 * 60000, expiresAt: NOW + 6 * 3600000, source: 'customer', businessId: bid };
  set(`businesses/${bid}/redemptions/R-DEMO42`, pend);
  set(`cards/${maya.cardToken}/redemptions/R-DEMO42`, pend);

  set(`businesses/${bid}`, {
    name: "Joe's Pizza", slug: 'joespizza', type: 'restaurant', currency: 'SYP', lang: 'ar', logo: PIZZA,
    colors: { primary: '#B3261E', secondary: '#F2B544', bg: '#B3261E', text: '#FFFFFF' },
    program, tiers,
    design: { style: 'gradient', layout: 'classic', programName: "Joe's Rewards", programNameAr: 'مكافآت جوز', cover: null, icon: 'pizza', codeFormat: 'qr' },
    status: 'active', plan: 'starter', ownerUid: DEMO_ACCOUNTS.owner.uid, createdAt: NOW - 190 * DAY,
    trialEndsAt: NOW - 160 * DAY, paidUntil: NOW + 20 * DAY,
    memberSeq: customers.length, designVersion: 3,
  });
  set(`stats/${bid}`, { businessId: bid, statCustomers: customers.length, statTxns: stats.txns, statRevenue: stats.revenue, statPoints: stats.points, statRedeemed: stats.redeemed, lastActivityAt: NOW - 3600000 });
  set('slugs/joespizza', { businessId: bid });
  set(`businesses/${bid}/private/settings`, { ownerEmail: DEMO_ACCOUNTS.owner.email, limits: {} });
  for (const [i, ago] of [[0, 160], [1, 100], [2, 40]].map(([i, d]) => [i, d])) {
    set(`businesses/${bid}/payments/pay${i}`, { months: 2, plan: 'starter', amount: 30, currency: 'USD', method: 'Sham Cash', note: '', periodEnd: NOW - ago * DAY + 60 * DAY, at: NOW - ago * DAY, by: DEMO_ACCOUNTS.admin.email });
  }
  const roles = { owner: 'owner', manager: 'manager', staff: 'staff', marketing: 'marketing' };
  for (const [k, role] of Object.entries(roles)) {
    const a = DEMO_ACCOUNTS[k];
    set(`businesses/${bid}/members/${a.uid}`, { uid: a.uid, email: a.email, name: a.name, role, businessId: bid, createdAt: NOW - 180 * DAY });
  }
  set(`businesses/${bid}/invites/new.cashier@joespizza.demo`, { email: 'new.cashier@joespizza.demo', role: 'staff', name: 'Hadi', businessId: bid, invitedBy: DEMO_ACCOUNTS.owner.uid, createdAt: NOW - 2 * DAY });
  set(`businesses/${bid}/locations/main`, { name: 'Mezzeh', address: 'Mezzeh Villat Gharbiyeh, Damascus', createdAt: NOW - 190 * DAY });
  set(`businesses/${bid}/locations/abu-rummaneh`, { name: 'Abu Rummaneh', address: 'Al-Jalaa St, Damascus', createdAt: NOW - 90 * DAY });
  for (const r of rewards) set(`businesses/${bid}/rewards/${r.id}`, { ...r, image: null, expiresAt: null, minPurchase: 0, usageLimit: 0, active: true, redeemedCount: rewardState[r.id], createdAt: NOW - 185 * DAY });
  for (const t of L.defaultTemplates()) set(`businesses/${bid}/templates/${t.id}`, t);
  set(`businesses/${bid}/segments/seg_big`, { name: 'Spent over 15,000 SYP', rules: [{ field: 'spend', op: 'gte', value: 15000 }], createdAt: NOW - 20 * DAY });
  set(`businesses/${bid}/campaigns/camp_winback`, { name: 'We miss you — 20% off this week', segment: 'preset_30d', channel: 'whatsapp', message: 'اشتقنالك يا {{first_name}}! تعال هالأسبوع وخود خصم ٢٠٪ — رصيدك {{points}} نقطة بانتظارك في {{business_name}}.', status: 'draft', recipients: 0, createdAt: NOW - 1 * DAY, preparedAt: null });
  set(`businesses/${bid}/campaigns/camp_thursday`, { name: 'Thursday family deal', segment: 'auto_loyal', channel: 'whatsapp', message: 'يا {{first_name}}، عرض الخميس العائلي: بيتزاتين كبار + مشروب مجاناً. نشوفك بـ {{business_name}}!', status: 'ready', recipients: 41, createdAt: NOW - 9 * DAY, preparedAt: NOW - 8 * DAY });
  set(`businesses/${bid}/audit/seed`, { action: 'business.create', details: { name: "Joe's Pizza" }, actorUid: DEMO_ACCOUNTS.owner.uid, actorEmail: DEMO_ACCOUNTS.owner.email, at: NOW - 190 * DAY });

  const pub = (e) => ({ type: e.type, points: e.points || 0, amount: e.amount || 0, balance: e.balance ?? null, rewardName: e.rewardName || null, rewardNameAr: e.rewardNameAr || null, at: e.at });
  let n = 0;
  for (const { c, ev, red } of events) {
    const id = 'e' + (n++).toString(36) + L.randomString(4);
    set(`businesses/${bid}/activity/${id}`, ev);
    set(`cards/${c.cardToken}/activity/${id}`, pub(ev));
    if (red) { set(`businesses/${bid}/redemptions/${red.code}`, red.data); set(`cards/${c.cardToken}/redemptions/${red.code}`, red.data); }
  }
  for (const c of customers) {
    const { _plannedVisits, id, ...doc } = c;
    set(`businesses/${bid}/customers/${id}`, doc);
    set(`businesses/${bid}/phones/${c.phone}`, { at: c.joinedAt });
    set(`cards/${c.cardToken}`, { businessId: bid, customerId: id, memberNumber: c.memberNumber, passId: `${bid}.${c.memberNumber}`, qrValue: c.scanId, barcodeValue: c.memberNumber, walletStatus: 'none', joinedAt: c.joinedAt, points: c.points, lifetimePoints: c.lifetimePoints, visits: c.visits, tierId: c.tierId, firstName: c.firstName, updatedAt: NOW, profile: { lastName: c.lastName, email: c.email, birthday: c.birthday, marketingConsent: c.marketingConsent, preferredChannel: c.preferredChannel } });
  }

  // ── Urban Coffee (second tenant, stamp card) ──────────
  const ub = 'urbancoffee01';
  set(`businesses/${ub}`, {
    name: 'Urban Coffee', slug: 'urbancoffee', type: 'cafe', currency: 'SYP', lang: 'en', logo: CUP,
    colors: { primary: '#1F3A33', secondary: '#E9DCC4', bg: '#1F3A33', text: '#F5EFE3' },
    program: { type: 'stamps', per: 0, earn: 1, goal: 9, welcomeBonus: 0 }, tiers: [{ id: 'regular', name: 'Regular', nameAr: 'دائم', min: 0, color: '#1F3A33', benefits: '' }],
    design: { style: 'solid', layout: 'stamps', programName: 'Coffee Club', programNameAr: 'نادي القهوة', cover: null, icon: 'coffee', codeFormat: 'qr' },
    status: 'active', plan: 'trial', ownerUid: DEMO_ACCOUNTS.other.uid, createdAt: NOW - 25 * DAY,
    trialEndsAt: NOW + 5 * DAY, paidUntil: null,
    memberSeq: 18, designVersion: 1,
  });
  set(`stats/${ub}`, { businessId: ub, statCustomers: 18, statTxns: 77, statRevenue: 23100, statPoints: 77, statRedeemed: 4, lastActivityAt: NOW - 2 * DAY });
  set('slugs/urbancoffee', { businessId: ub });
  set(`businesses/${ub}/members/${DEMO_ACCOUNTS.other.uid}`, { uid: DEMO_ACCOUNTS.other.uid, email: DEMO_ACCOUNTS.other.email, name: DEMO_ACCOUNTS.other.name, role: 'owner', businessId: ub, createdAt: NOW - 40 * DAY });
  set(`businesses/${ub}/rewards/rw_coffee`, { name: 'Free coffee', nameAr: 'قهوة مجانية', cost: 9, value: 300, description: 'Your 10th coffee is on us', image: null, expiresAt: null, minPurchase: 0, usageLimit: 0, active: true, redeemedCount: 4, createdAt: NOW - 40 * DAY });
  set(`businesses/${ub}/locations/main`, { name: 'Shaalan', address: '', createdAt: NOW - 40 * DAY });
  for (let i = 0; i < 18; i++) {
    const maya = i === 0;
    const id = 'uc' + i + L.randomString(8); const tok = maya ? DEMO_CARD_UC : L.cardToken(); const ph = maya ? '+963944123456' : '+9639' + between(30000000, 99999999);
    const st = maya ? 7 : between(0, 8); const j = NOW - between(1, 40) * DAY;
    const fn = maya ? 'مايا' : pick(FIRST); const scan = 'NQ' + L.randomString(10, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    set(`businesses/${ub}/customers/${id}`, { firstName: fn, lastName: maya ? 'الحلبي' : pick(LAST), phone: ph, email: '', memberNumber: L.memberNumber(i + 1), cardToken: tok, scanId: scan, businessId: ub, joinedAt: j, lastVisitAt: NOW - between(1, 5) * DAY, visits: st, spend: st * 300, points: st, lifetimePoints: st, redeemedCount: 0, tierId: 'regular', marketingConsent: true, preferredChannel: 'whatsapp', source: 'qr', birthday: '', gender: '', notes: '' });
    set(`businesses/${ub}/phones/${ph}`, { at: j });
    set(`cards/${tok}`, { businessId: ub, customerId: id, memberNumber: L.memberNumber(i + 1), passId: `${ub}.${i + 1}`, qrValue: scan, barcodeValue: L.memberNumber(i + 1), walletStatus: 'none', joinedAt: j, points: st, lifetimePoints: st, visits: st, tierId: 'regular', firstName: fn, updatedAt: NOW, profile: { lastName: '', email: '', birthday: '', marketingConsent: true, preferredChannel: 'whatsapp' } });
  }

  // A third tenant whose trial ran out — shows the locked state in the admin console.
  set('businesses/rosesalon01', {
    name: 'Rose Salon', slug: 'rosesalon', type: 'salon', currency: 'SYP', lang: 'ar', logo: null,
    colors: { primary: '#C2185B', secondary: '#FFD1DC', bg: '#C2185B', text: '#FFFFFF' }, program: { type: 'visits', per: 0, earn: 1, goal: 8, welcomeBonus: 0 },
    tiers: [{ id: 'regular', name: 'Regular', nameAr: 'دائم', min: 0, color: '#C2185B', benefits: '' }],
    design: { style: 'gradient', layout: 'stamps', programName: 'Rose Club', programNameAr: 'نادي روز', cover: null, icon: 'scissors', codeFormat: 'qr' },
    status: 'active', plan: 'trial', ownerUid: 'u_rose', createdAt: NOW - 45 * DAY, trialEndsAt: NOW - 15 * DAY, paidUntil: null, memberSeq: 6, designVersion: 1,
  });
  set('slugs/rosesalon', { businessId: 'rosesalon01' });
  set('stats/rosesalon01', { businessId: 'rosesalon01', statCustomers: 6, statTxns: 14, statRevenue: 9800, statPoints: 14, statRedeemed: 0, lastActivityAt: NOW - 16 * DAY });

  await db.batch(ops);
  db.flush?.();
}
