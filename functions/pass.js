// Turns a business + card from Firestore into a Google Wallet loyalty class and object.
// Pure: no network, no Firebase — so it can be unit-tested.
import * as L from './shared/loyalty.js';

const TXT = {
  en: { points: 'Points', stamps: 'Stamps', visits: 'Visits', spend: 'Spent', ready: 'Rewards ready', tier: 'Tier', open: 'Open my card', member: 'Member', logo: 'Logo' },
  ar: { points: 'النقاط', stamps: 'الأختام', visits: 'الزيارات', spend: 'الإنفاق', ready: 'مكافآت جاهزة', tier: 'المستوى', open: 'افتح بطاقتي', member: 'العضو', logo: 'الشعار' },
};
const CUR = { SYP: { en: 'SYP', ar: 'ل.س' }, USD: { en: 'USD', ar: 'دولار' } };

const langOf = (b) => (b?.lang === 'en' ? 'en' : 'ar');
// A Google "LocalizedString": the business language first, the other one as a translation.
export function loc(en, ar, main = 'ar') {
  const other = main === 'ar' ? 'en' : 'ar';
  const v = { en: en || ar || '', ar: ar || en || '' };
  return { defaultValue: { language: main, value: v[main] }, translatedValues: v[other] && v[other] !== v[main] ? [{ language: other, value: v[other] }] : [] };
}
const word = (key, main) => ({ text: TXT[main][key], localized: loc(TXT.en[key], TXT.ar[key], main) });

// Google accepts only letters, digits, '.', '_' and '-' in ids.
const safe = (s) => String(s || '').replace(/[^A-Za-z0-9._-]/g, '_');
export const classIdFor = (issuerId, bid) => `${issuerId}.biz_${safe(bid)}`;
export const objectIdFor = (issuerId, card) => `${issuerId}.card_${safe(card.businessId)}_${safe(card.customerId)}`;

const hex = (c, fallback = '#0F6E5C') => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : fallback);
const liveRewards = (rewards) => (rewards || []).filter((r) => L.rewardIsLive(r));

export function buildClass({ issuerId, bid, business, logoUrl }) {
  const main = langOf(business);
  const d = business.design || {};
  const progEn = d.programName || business.name;
  const progAr = d.programNameAr || d.programName || business.name;
  return {
    id: classIdFor(issuerId, bid),
    issuerName: String(business.name || '').slice(0, 60),
    programName: (main === 'ar' ? progAr : progEn).slice(0, 60),
    localizedProgramName: loc(progEn, progAr, main),
    programLogo: { sourceUri: { uri: logoUrl }, contentDescription: loc(`${business.name} logo`, `شعار ${business.name}`, main) },
    hexBackgroundColor: hex(business.colors?.bg),
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
  };
}

export function buildObject({ issuerId, token, card, business, rewards, siteUrl, heroUrl }) {
  const main = langOf(business);
  const prog = business.program || { type: 'points' };
  const live = liveRewards(rewards);
  const points = Math.max(0, Math.floor(card.points || 0));
  let primary, st = null;
  if (L.isStampy(prog)) {
    st = L.stampState(prog, live, points);
    const w = word(prog.type === 'visits' ? 'visits' : 'stamps', main);
    primary = { label: w.text, localizedLabel: w.localized, balance: { string: `${st.progress}/${st.goal}` } };
  } else if (prog.type === 'spend') {
    const cur = CUR[business.currency] || { en: business.currency || '', ar: business.currency || '' };
    primary = { label: `${TXT[main].spend} (${cur[main]})`, localizedLabel: loc(`Spent (${cur.en})`, `الإنفاق (${cur.ar})`, main), balance: { int: points } };
  } else {
    const w = word('points', main);
    primary = { label: w.text, localizedLabel: w.localized, balance: { int: points } };
  }
  const ready = L.readyCount(prog, live, points);
  const rw = word('ready', main);
  const obj = {
    id: objectIdFor(issuerId, card),
    classId: classIdFor(issuerId, card.businessId),
    state: card.deleted ? 'INACTIVE' : 'ACTIVE',
    accountId: String(card.memberNumber || ''),
    accountName: card.deleted ? '' : String(card.firstName || '').slice(0, 40),
    loyaltyPoints: primary,
    secondaryLoyaltyPoints: { label: rw.text, localizedLabel: rw.localized, balance: { int: ready } },
    barcode: { type: 'QR_CODE', value: String(card.qrValue || card.memberNumber || ''), alternateText: String(card.memberNumber || '') },
    linksModuleData: { uris: [{ id: 'card', uri: `${siteUrl}rewards.html?c=${token}`, description: TXT[main].open, localizedDescription: word('open', main).localized }] },
    textModulesData: [],
  };
  // Stamp cards get a picture of the stamp grid (Google has no stamp layout of its own).
  if (st && heroUrl && !card.deleted) {
    obj.heroImage = { sourceUri: { uri: heroUrl(st) }, contentDescription: loc(`${st.progress} of ${st.goal} stamps`, `${st.progress} من ${st.goal} أختام`, main) };
  }
  const tiers = business.tiers || [];
  if (tiers.length > 1) {
    const tier = L.tierFor(tiers, card.lifetimePoints || 0);
    if (tier) {
      const h = word('tier', main);
      obj.textModulesData.push({ id: 'tier', header: h.text, localizedHeader: h.localized, body: main === 'ar' ? (tier.nameAr || tier.name) : tier.name, localizedBody: loc(tier.name, tier.nameAr || tier.name, main) });
    }
  }
  if (card.deleted) { obj.linksModuleData = { uris: [] }; obj.textModulesData = []; }
  return obj;
}

// The unsigned "Save to Google Wallet" JWT body. The object already exists, so only its id is sent.
export function saveClaims({ serviceEmail, objectId, origins }) {
  return {
    iss: serviceEmail, aud: 'google', typ: 'savetowallet', iat: Math.floor(Date.now() / 1000),
    origins: origins || [],
    payload: { loyaltyObjects: [{ id: objectId }] },
  };
}
