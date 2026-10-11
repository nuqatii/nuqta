// The customer's "My cards" list, kept on this phone (no login).
// Each entry remembers a snapshot so the list draws instantly and still works offline.
const KEY = 'nuqta_wallet_v1';

function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ } }

// Snapshot of just what the list needs (raw values; labels are localised at render time).
export function snapshot(business, card, readyCount = 0, goal = null) {
  const b = business || {};
  return {
    biz: { name: b.name, slug: b.slug, logo: b.logo || null, colors: b.colors, currency: b.currency, program: b.program, tiers: b.tiers,
      design: { programName: b.design?.programName || '', programNameAr: b.design?.programNameAr || '', icon: b.design?.icon || 'star', style: b.design?.style } },
    card: { points: card?.points || 0, lifetimePoints: card?.lifetimePoints || 0, firstName: card?.firstName || '' },
    ready: readyCount, goal,
  };
}

export const wallet = {
  all() {
    migrate();
    return read().sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
  },
  tokenFor(bid) { return wallet.all().find((x) => x.bid === bid)?.token || null; },
  // Add or refresh a card. One card per business: re-joining replaces the old one.
  save(token, bid, snap, { opened = true } = {}) {
    const list = read();
    const prev = list.find((x) => x.token === token);
    const next = list.filter((x) => x.token !== token && x.bid !== bid);
    next.push({ token, bid, addedAt: prev?.addedAt || Date.now(), openedAt: opened ? Date.now() : prev?.openedAt || Date.now(), snap: snap || prev?.snap || null });
    write(next);
  },
  remove(token) { write(read().filter((x) => x.token !== token)); },
};

// Cards saved by the first version of the app (one key per business).
function migrate() {
  let list = null;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('nuqta_card_')) continue;
    list = list || read();
    const bid = k.slice('nuqta_card_'.length); const token = localStorage.getItem(k);
    if (token && !list.some((x) => x.token === token || x.bid === bid)) list.push({ token, bid, addedAt: Date.now(), openedAt: 0, snap: null });
    localStorage.removeItem(k);
  }
  if (list) write(list);
}
