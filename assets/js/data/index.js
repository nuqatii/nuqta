// Picks the backend and returns the shared service.
import { resolveMode } from '../config.js';
import { createService } from './service.js';

let servicePromise = null;

export function getService() {
  if (servicePromise) return servicePromise;
  servicePromise = (async () => {
    const mode = resolveMode();
    if (mode === 'firebase') {
      const { loadFirebase, createFirestoreDB, createFirebaseAuth } = await import('./db-firestore.js');
      const fb = await loadFirebase();
      const auth = createFirebaseAuth(fb);
      await auth.ready();
      return createService({ db: createFirestoreDB(fb), auth, mode });
    }
    const [{ createMemoryDB }, { createMemoryAuth }] = await Promise.all([import('./db-memory.js'), import('./auth-memory.js')]);
    const db = createMemoryDB(); const auth = createMemoryAuth();
    if (db.isEmpty()) {
      const { seedDemo } = await import('./demo-seed.js');
      await seedDemo(db, auth);
    }
    const svc = createService({ db, auth, mode });
    svc.resetDemo = async () => {
      db.reset(); auth._reset();
      const { seedDemo } = await import('./demo-seed.js');
      await seedDemo(db, auth);
    };
    return svc;
  })();
  return servicePromise;
}
