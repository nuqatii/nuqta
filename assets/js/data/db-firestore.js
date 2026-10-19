// Firestore adapter — same interface as db-memory.js.
import { CONFIG } from '../config.js';

export async function loadFirebase() {
  const v = CONFIG.FIREBASE_SDK_VERSION;
  const base = `https://www.gstatic.com/firebasejs/${v}`;
  const [app, fs, auth] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  const fbApp = app.getApps().length ? app.getApp() : app.initializeApp(CONFIG.FIREBASE);
  return { app: fbApp, fs, authMod: auth };
}

export function createFirestoreDB({ app, fs }) {
  const db = fs.getFirestore(app);
  const INC_KEY = '__inc';
  const docRef = (p) => fs.doc(db, p);
  const conv = (data) => {
    const out = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (v === undefined) continue;
      out[k] = v && typeof v === 'object' && INC_KEY in v ? fs.increment(v[INC_KEY]) : v;
    }
    return out;
  };
  const snapOut = (s) => (s.exists() ? { id: s.id, ...s.data() } : null);
  const buildQuery = (ref, { where, orderBy, limit } = {}) => {
    const parts = [];
    for (const [f, op, v] of where || []) parts.push(fs.where(f, op, v));
    if (orderBy) parts.push(fs.orderBy(orderBy[0], orderBy[1] || 'asc'));
    if (limit) parts.push(fs.limit(limit));
    return fs.query(ref, ...parts);
  };

  const api = {
    kind: 'firestore',
    raw: db,
    inc: (n) => ({ [INC_KEY]: n }),
    newId: () => fs.doc(fs.collection(db, '_ids')).id,
    async get(p) { return snapOut(await fs.getDoc(docRef(p))); },
    async exists(p) { return (await fs.getDoc(docRef(p))).exists(); },
    async set(p, data, { merge = false } = {}) { await fs.setDoc(docRef(p), conv(data), { merge }); },
    async update(p, patch) { await fs.updateDoc(docRef(p), conv(patch)); },
    async remove(p) { await fs.deleteDoc(docRef(p)); },
    async list(col, opts) {
      const s = await fs.getDocs(buildQuery(fs.collection(db, col), opts));
      return s.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async listGroup(colId, opts) {
      const s = await fs.getDocs(buildQuery(fs.collectionGroup(db, colId), opts));
      return s.docs.map((d) => ({ id: d.id, _path: d.ref.path, ...d.data() }));
    },
    async count(col, opts) {
      const s = await fs.getCountFromServer(buildQuery(fs.collection(db, col), opts));
      return s.data().count;
    },
    async batch(ops) {
      // Firestore batches cap at 500 writes.
      for (let i = 0; i < ops.length; i += 450) {
        const b = fs.writeBatch(db);
        for (const o of ops.slice(i, i + 450)) {
          if (o.op === 'set') b.set(docRef(o.path), conv(o.data), { merge: !!o.merge });
          else if (o.op === 'update') b.update(docRef(o.path), conv(o.data));
          else if (o.op === 'delete') b.delete(docRef(o.path));
        }
        await b.commit();
      }
    },
    async transaction(fn) {
      return fs.runTransaction(db, async (t) => {
        const tx = {
          get: async (p) => snapOut(await t.get(docRef(p))),
          set: (p, d, o = {}) => t.set(docRef(p), conv(d), { merge: !!o.merge }),
          update: (p, d) => t.update(docRef(p), conv(d)),
          delete: (p) => t.delete(docRef(p)),
        };
        return fn(tx);
      });
    },
  };
  return api;
}

export function createFirebaseAuth({ app, authMod: a }) {
  const auth = a.getAuth(app);
  const map = (u) => (u && !u.isAnonymous ? { uid: u.uid, email: (u.email || '').toLowerCase(), name: u.displayName || '' } : null);
  return {
    kind: 'firebase',
    current: () => map(auth.currentUser),
    ready: () => new Promise((res) => { const off = a.onAuthStateChanged(auth, (u) => { off(); res(map(u)); }); }),
    onChange: (cb) => a.onAuthStateChanged(auth, (u) => cb(map(u))),
    async signUp(email, password, name) {
      const c = await a.createUserWithEmailAndPassword(auth, email, password);
      if (name) await a.updateProfile(c.user, { displayName: name });
      return map(c.user);
    },
    async signIn(email, password) { return map((await a.signInWithEmailAndPassword(auth, email, password)).user); },
    signOut: () => a.signOut(auth),
    resetPassword: (email) => a.sendPasswordResetEmail(auth, email),
    idToken: () => auth.currentUser?.getIdToken() || null,
  };
}
