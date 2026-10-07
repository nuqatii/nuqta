// Firestore security-rules tests. Requires Java + the Firebase emulator:
//   npm install && npm run test:rules
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch, increment, query, where, collectionGroup } from 'firebase/firestore';

let env;
const JOE = 'joe', OTHER = 'karim', CASHIER = 'lina', MKT = 'sara', ADMIN = 'admin';
const BID = 'joespizza01', OBID = 'urban01', TOKEN = 'cardTokenMaya0123456789ab', CID = 'cust_maya';

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'nuqta-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore(); const b = writeBatch(db);
    const biz = (owner, status = 'active') => ({ name: 'B', slug: 's', ownerUid: owner, status, plan: 'free', memberSeq: 1, program: { type: 'points', per: 10, earn: 1, welcomeBonus: 50 }, tiers: [] });
    b.set(doc(db, 'platformAdmins', ADMIN), { at: 1 });
    b.set(doc(db, 'platform/settings'), { signupsOpen: true });
    b.set(doc(db, 'businesses', BID), biz(JOE));
    b.set(doc(db, 'businesses', OBID), biz(OTHER));
    b.set(doc(db, 'stats', BID), { statCustomers: 1, statRevenue: 1000 });
    for (const [uid, role] of [[JOE, 'owner'], [CASHIER, 'staff'], [MKT, 'marketing']]) b.set(doc(db, `businesses/${BID}/members/${uid}`), { uid, role, businessId: BID });
    b.set(doc(db, `businesses/${OBID}/members/${OTHER}`), { uid: OTHER, role: 'owner', businessId: OBID });
    b.set(doc(db, `businesses/${BID}/customers/${CID}`), { firstName: 'Maya', phone: '+963944123456', points: 600, lifetimePoints: 600, cardToken: TOKEN, businessId: BID });
    b.set(doc(db, `businesses/${BID}/rewards/rw1`), { name: 'Dessert', cost: 500, active: true, redeemedCount: 0 });
    b.set(doc(db, `businesses/${BID}/activity/a1`), { customerId: CID, type: 'purchase', points: 60, staffUid: CASHIER, at: 1 });
    b.set(doc(db, `cards/${TOKEN}`), { businessId: BID, customerId: CID, points: 600 });
    await b.commit();
  });
});
const as = (uid, email) => env.authenticatedContext(uid, { email: email || `${uid}@x.test`, firebase: { sign_in_provider: 'password' } }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

test('another business owner cannot read or write our customers', async () => {
  const db = as(OTHER);
  await assertFails(getDoc(doc(db, `businesses/${BID}/customers/${CID}`)));
  await assertFails(getDocs(collection(db, `businesses/${BID}/customers`)));
  await assertFails(updateDoc(doc(db, `businesses/${BID}/customers/${CID}`), { points: 99999 }));
  await assertFails(getDoc(doc(db, `stats/${BID}`)));
});
test('the public sees branding, rewards and a card by token — nothing else', async () => {
  const db = anon();
  await assertSucceeds(getDoc(doc(db, `businesses/${BID}`)));
  await assertSucceeds(getDocs(collection(db, `businesses/${BID}/rewards`)));
  await assertSucceeds(getDoc(doc(db, `cards/${TOKEN}`)));
  await assertFails(getDocs(collection(db, 'cards')));
  await assertFails(getDoc(doc(db, `businesses/${BID}/customers/${CID}`)));
  await assertFails(getDoc(doc(db, `stats/${BID}`)));
  await assertFails(updateDoc(doc(db, `businesses/${BID}`), { name: 'Hacked' }));
  await assertSucceeds(updateDoc(doc(db, `businesses/${BID}`), { memberSeq: 2 }));
  await assertFails(updateDoc(doc(db, `businesses/${BID}`), { memberSeq: 50 }));
});
test('cashier adds points but cannot manage rewards, team or settings', async () => {
  const db = as(CASHIER);
  await assertSucceeds(updateDoc(doc(db, `businesses/${BID}/customers/${CID}`), { points: 660, lifetimePoints: 660, visits: 1 }));
  await assertFails(updateDoc(doc(db, `businesses/${BID}/customers/${CID}`), { businessId: OBID }));
  await assertFails(setDoc(doc(db, `businesses/${BID}/rewards/rw2`), { name: 'Free everything', cost: 1, active: true }));
  await assertFails(setDoc(doc(db, `businesses/${BID}/members/hacker`), { uid: 'hacker', role: 'owner', businessId: BID }));
  await assertFails(updateDoc(doc(db, `businesses/${BID}`), { name: 'X' }));
});
test('ledger entries are immutable; marketing cannot read them', async () => {
  await assertFails(updateDoc(doc(as(JOE), `businesses/${BID}/activity/a1`), { points: 9999 }));
  await assertFails(deleteDoc(doc(as(JOE), `businesses/${BID}/activity/a1`)));
  await assertFails(getDoc(doc(as(MKT), `businesses/${BID}/activity/a1`)));
});
test('reward codes: valid request accepted, forged ones rejected, single use enforced', async () => {
  const red = { customerId: CID, cardToken: TOKEN, rewardId: 'rw1', rewardName: 'Dessert', cost: 500, status: 'pending', source: 'customer', createdAt: Date.now(), expiresAt: Date.now() + 3600e3 };
  await assertSucceeds(setDoc(doc(anon(), `businesses/${BID}/redemptions/R-AAAAAA`), red));
  await assertFails(setDoc(doc(anon(), `businesses/${BID}/redemptions/R-BBBBBB`), { ...red, cost: 1 }));
  await assertFails(setDoc(doc(anon(), `businesses/${BID}/redemptions/R-CCCCCC`), { ...red, status: 'redeemed' }));
  const db = as(CASHIER);
  await assertSucceeds(setDoc(doc(db, `businesses/${BID}/redemptions/R-AAAAAA`), { ...red, status: 'redeemed', staffUid: CASHIER, redeemedAt: Date.now() }));
  await assertFails(setDoc(doc(db, `businesses/${BID}/redemptions/R-AAAAAA`), { ...red, status: 'redeemed', staffUid: CASHIER, redeemedAt: Date.now() + 1 }));
});
test('public join: one customer per phone', async () => {
  const join = (phone, cid, token) => {
    const db = anon(); const b = writeBatch(db);
    b.set(doc(db, `businesses/${BID}/customers/${cid}`), { firstName: 'L', phone, businessId: BID, points: 50, lifetimePoints: 50, visits: 0, spend: 0, redeemedCount: 0, lastVisitAt: null, cardToken: token, source: 'qr' });
    b.set(doc(db, `businesses/${BID}/phones/${phone}`), { at: 1 });
    b.set(doc(db, `cards/${token}`), { businessId: BID, customerId: cid, points: 50 });
    b.set(doc(db, `businesses/${BID}/activity/j-${cid}`), { customerId: cid, type: 'join', points: 50, staffUid: null, at: 1 });
    b.set(doc(db, `cards/${token}/activity/j-${cid}`), { type: 'join', points: 50, at: 1 });
    b.update(doc(db, `businesses/${BID}`), { memberSeq: 2 });
    b.set(doc(db, `stats/${BID}`), { statCustomers: increment(1) }, { merge: true });
    return b.commit();
  };
  await assertSucceeds(join('+963955000111', 'cidNew000000000001', 'tokNew0000000000000000001'));
  await assertFails(join('+963955000111', 'cidNew000000000002', 'tokNew0000000000000000002'));
});
test('a forged join with free points is rejected', async () => {
  const db = anon();
  await assertFails(setDoc(doc(db, `businesses/${BID}/customers/rich`), { firstName: 'R', phone: '+9639', businessId: BID, points: 100000, lifetimePoints: 100000, visits: 0, spend: 0, redeemedCount: 0, lastVisitAt: null, cardToken: 'x'.repeat(24), source: 'qr' }));
});
test('platform admin lists businesses; owners cannot', async () => {
  await assertSucceeds(getDocs(collection(as(ADMIN), 'businesses')));
  await assertFails(getDocs(collection(as(JOE), 'businesses')));
  await assertSucceeds(updateDoc(doc(as(ADMIN), `businesses/${BID}`), { status: 'suspended' }));
  await assertFails(getDoc(doc(as(ADMIN), `businesses/${BID}/customers/${CID}`)));
});
test('memberships are discoverable only by their own user', async () => {
  await assertSucceeds(getDocs(query(collectionGroup(as(CASHIER), 'members'), where('uid', '==', CASHIER))));
  await assertFails(getDocs(query(collectionGroup(as(CASHIER), 'members'), where('uid', '==', JOE))));
});
