// Demo authentication. Only for the in-browser demo — the Firebase mode uses Firebase Auth.
const USERS = 'nuqta_demo_users_v1';
const SESSION = 'nuqta_demo_session_v1';

async function hash(password, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + password));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const err = (code) => Object.assign(new Error(code), { code });

export function createMemoryAuth() {
  const users = () => JSON.parse(localStorage.getItem(USERS) || '{}');
  const saveUsers = (u) => localStorage.setItem(USERS, JSON.stringify(u));
  const listeners = new Set();
  const current = () => {
    const uid = localStorage.getItem(SESSION); const u = uid && Object.values(users()).find((x) => x.uid === uid);
    return u ? { uid: u.uid, email: u.email, name: u.name } : null;
  };
  const emit = () => listeners.forEach((cb) => cb(current()));

  const api = {
    kind: 'memory',
    current,
    ready: async () => current(),
    idToken: async () => null,
    onChange(cb) { listeners.add(cb); cb(current()); return () => listeners.delete(cb); },
    async signUp(email, password, name) {
      email = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err('auth/invalid-email');
      if (String(password).length < 6) throw err('auth/weak-password');
      const all = users();
      if (all[email]) throw err('auth/email-already-in-use');
      const salt = crypto.getRandomValues(new Uint32Array(2)).join('');
      const uid = 'u_' + Math.random().toString(36).slice(2, 12);
      all[email] = { uid, email, name: name || '', salt, hash: await hash(password, salt) };
      saveUsers(all); localStorage.setItem(SESSION, uid); emit();
      return current();
    },
    async signIn(email, password) {
      email = String(email).trim().toLowerCase();
      const u = users()[email];
      if (!u || (await hash(password, u.salt)) !== u.hash) throw err('auth/invalid-credential');
      localStorage.setItem(SESSION, u.uid); emit();
      return current();
    },
    async signOut() { localStorage.removeItem(SESSION); emit(); },
    async resetPassword() { throw err('auth/demo-no-email'); },
    // Seeding helper
    async _createUser(email, password, name, uid) {
      const all = users(); const salt = 'seed' + uid;
      all[email] = { uid, email, name, salt, hash: await hash(password, salt) }; saveUsers(all);
    },
    _reset() { localStorage.removeItem(USERS); localStorage.removeItem(SESSION); },
  };
  return api;
}
