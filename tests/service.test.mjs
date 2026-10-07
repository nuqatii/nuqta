// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser shims for the demo backend.
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.addEventListener = () => {};

const L = await import('../assets/js/core/loyalty.js');
const { createMemoryDB } = await import('../assets/js/data/db-memory.js');
const { createMemoryAuth } = await import('../assets/js/data/auth-memory.js');
const { createService } = await import('../assets/js/data/service.js');
const { seedDemo, DEMO_ACCOUNTS, DEMO_CARD } = await import('../assets/js/data/demo-seed.js');

test('earn rules for each program type', () => {
  assert.equal(L.earnFor({ type: 'points', per: 10, earn: 1 }, { amount: 1255 }), 125);
  assert.equal(L.earnFor({ type: 'points', per: 1, earn: 2 }, { amount: 50 }), 100);
  assert.equal(L.earnFor({ type: 'visits', earn: 1 }, { amount: 999 }), 1);
  assert.equal(L.earnFor({ type: 'stamps', earn: 1 }, { qty: 3 }), 3);
  assert.equal(L.earnFor({ type: 'spend', per: 1, earn: 1 }, { amount: 70.9 }), 70);
});

test('tiers, unlocks, phone and code helpers', () => {
  const tiers = L.defaultTiers();
  assert.equal(L.tierFor(tiers, 0).id, 'bronze');
  assert.equal(L.tierFor(tiers, 5000).id, 'gold');
  assert.equal(L.nextTier(tiers, 5000).id, 'vip');
  const rw = [{ id: 'a', cost: 500, active: true }, { id: 'b', cost: 1000, active: false }];
  assert.deepEqual(L.newlyUnlocked(rw, 450, 520).map((r) => r.id), ['a']);
  assert.equal(L.normalizePhone('٠٩٤٤ ١٢٣ ٤٥٦'), '+963944123456');
  assert.equal(L.normalizePhone('00963944123456'), '+963944123456');
  assert.equal(L.normalizePhone('12'), '');
  assert.match(L.redemptionCode(), /^R-[A-Z2-9]{6}$/);
  assert.equal(L.parseAmount('١٬٢٥٠'.replace('٬', ',')), 1250);
  assert.equal(L.renderTemplate('Hi {{first_name}} at {{business_name}}', { first_name: 'Maya', business_name: "Joe's" }), "Hi Maya at Joe's");
  assert.ok(L.matchesRules({ lastVisitAt: Date.now() - 40 * L.DAY }, [{ field: 'daysSinceVisit', op: 'gte', value: 30 }]));
});

const db = createMemoryDB(); const auth = createMemoryAuth();
await seedDemo(db, auth);
const S = createService({ db, auth, mode: 'demo' });

test('demo seed has the promised shape', async () => {
  await S.signIn(DEMO_ACCOUNTS.owner.email, 'demo1234');
  const [m] = await S.myMemberships();
  assert.equal(m.name, "Joe's Pizza");
  const cs = await S.listCustomers(m.businessId);
  assert.equal(cs.length, 250);
  const acts = await S.listActivity(m.businessId, {});
  assert.ok(acts.filter((a) => a.type === 'purchase').length >= 500, 'needs 500+ transactions');
  assert.equal((await S.listRewards(m.businessId)).length, 5);
  assert.ok(new Set(cs.map((c) => c.tierId)).size >= 3, 'multiple tiers populated');
});

test('owner journey: create business → join → purchase → redeem', async () => {
  await S.signOut();
  await S.signUp('new@cafe.test', 'secret1', 'Rasha');
  const b = await S.createBusiness({ name: 'Rasha Café', type: 'cafe', programType: 'points', firstReward: { name: 'Free coffee', cost: 50 } });
  assert.equal(b.slug, 'rasha-cafe');
  const j = await S.joinProgram('rasha-cafe', { firstName: 'Maya', phone: '0944 000 111' });
  await assert.rejects(S.joinProgram('rasha-cafe', { firstName: 'Maya', phone: '+963944000111' }), /already-member/);
  const c = await S.findCustomer(b.id, '0944000111');
  assert.equal(c.memberNumber, '100001');
  const p = await S.recordPurchase(b.id, { customerId: c.id, amount: 600 });
  assert.equal(p.earned, 60);
  assert.equal(p.unlocked.length, 1, 'free coffee unlocked');
  const card = await S.getCard(j.cardToken);
  assert.equal(card.card.points, 60);
  const red = await S.requestRedemption(j.cardToken, card.rewards[0].id);
  const done = await S.redeemCode(b.id, red.code.toLowerCase());
  assert.equal(done.balance, 10);
  await assert.rejects(S.redeemCode(b.id, red.code), /code-used/, 'single use');
  const acts = await S.listCardActivity(j.cardToken);
  assert.deepEqual(acts.map((a) => a.type).sort(), ['join', 'purchase', 'redeem']);
});

test('tenant isolation and roles', async () => {
  await S.signOut();
  await S.signIn(DEMO_ACCOUNTS.other.email, 'demo1234');           // Urban Coffee owner
  await assert.rejects(S.listCustomers('joespizza01'), /permission-denied/);
  await assert.rejects(S.recordPurchase('joespizza01', { customerId: 'cust_maya', amount: 100 }), /permission-denied/);
  await S.signOut();
  await S.signIn(DEMO_ACCOUNTS.staff.email, 'demo1234');           // cashier
  const r = await S.recordPurchase('joespizza01', { customerId: 'cust_maya', amount: 1000 });
  assert.equal(r.earned, 100);
  await assert.rejects(S.saveReward('joespizza01', { name: 'x', cost: 1 }), /permission-denied/);
  await assert.rejects(S.listMembers('joespizza01'), /permission-denied/);
  const maya = await S.getCard(DEMO_CARD);
  assert.ok(maya.card.points >= 920);
  const ok = await S.redeemCode('joespizza01', 'R-DEMO42');
  assert.equal(ok.rewardName, 'Free dessert');
});

test('invited staff claims their role on sign-up', async () => {
  await S.signOut();
  await S.signUp('new.cashier@joespizza.demo', 'secret1', 'Hadi');
  const ms = await S.myMemberships();
  assert.equal(ms[0]?.role, 'staff');
});
