// Demo database: a document store with Firestore-like paths, persisted to localStorage.
// Same interface as db-firestore.js so the service layer is written once.

const KEY = 'nuqta_demo_db_v3';
const INC = Symbol('inc');

export function createMemoryDB() {
  let docs = {};
  try { docs = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { docs = {}; }
  let timer = null;
  const persist = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(docs)); }
      catch (e) { console.warn('Demo storage full', e); }
    }, 60);
  };
  const flush = () => { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch {} };
  addEventListener('pagehide', flush);
  // Another tab (e.g. the cashier) wrote to the demo store — pick it up.
  addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { try { docs = JSON.parse(e.newValue); } catch {} } });

  const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
  const idOf = (path) => path.split('/').pop();
  const withId = (path, d) => (d ? { id: idOf(path), ...clone(d) } : null);

  function applyPatch(base, patch) {
    const out = { ...(base || {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === 'object' && v[INC] !== undefined) out[k] = (Number(out[k]) || 0) + v[INC];
      else if (v === undefined) delete out[k];
      else out[k] = v;
    }
    return out;
  }
  const strip = (data) => applyPatch({}, data);

  function match(doc, where) {
    return (where || []).every(([f, op, v]) => {
      const x = doc[f];
      switch (op) {
        case '==': return x === v;
        case '!=': return x !== v;
        case '>': return x > v;
        case '>=': return x >= v;
        case '<': return x < v;
        case '<=': return x <= v;
        case 'in': return v.includes(x);
        case 'array-contains': return Array.isArray(x) && x.includes(v);
        default: return false;
      }
    });
  }
  function query(paths, { where, orderBy, limit } = {}) {
    let rows = paths.map((p) => withId(p, docs[p])).filter((d) => match(d, where));
    if (orderBy) {
      const [f, dir = 'asc'] = orderBy;
      rows.sort((a, b) => ((a[f] ?? 0) > (b[f] ?? 0) ? 1 : (a[f] ?? 0) < (b[f] ?? 0) ? -1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    return limit ? rows.slice(0, limit) : rows;
  }

  const api = {
    kind: 'memory',
    inc: (n) => ({ [INC]: n }),
    newId: () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    async get(path) { return withId(path, docs[path]); },
    async exists(path) { return !!docs[path]; },
    async set(path, data, { merge = false } = {}) {
      docs[path] = merge ? applyPatch(docs[path], data) : strip(data); persist();
    },
    async update(path, patch) {
      if (!docs[path]) throw new Error('not-found: ' + path);
      docs[path] = applyPatch(docs[path], patch); persist();
    },
    async remove(path) { delete docs[path]; persist(); },
    async list(col, opts) {
      const depth = col.split('/').length + 1;
      const paths = Object.keys(docs).filter((p) => p.startsWith(col + '/') && p.split('/').length === depth);
      return query(paths, opts);
    },
    async listGroup(colId, opts) {
      const paths = Object.keys(docs).filter((p) => { const s = p.split('/'); return s[s.length - 2] === colId; });
      return query(paths, opts);
    },
    async count(col, opts) { return (await api.list(col, opts)).length; },
    async batch(ops) {
      for (const o of ops) {
        if (o.op === 'set') docs[o.path] = o.merge ? applyPatch(docs[o.path], o.data) : strip(o.data);
        else if (o.op === 'update') { if (!docs[o.path]) throw new Error('not-found: ' + o.path); docs[o.path] = applyPatch(docs[o.path], o.data); }
        else if (o.op === 'delete') delete docs[o.path];
      }
      persist();
    },
    // Runs fn(tx) where tx.get reads and tx.set/update/delete are buffered then committed atomically.
    async transaction(fn) {
      const ops = [];
      const tx = {
        get: async (p) => withId(p, docs[p]),
        set: (p, d, o = {}) => ops.push({ op: 'set', path: p, data: d, merge: o.merge }),
        update: (p, d) => ops.push({ op: 'update', path: p, data: d }),
        delete: (p) => ops.push({ op: 'delete', path: p }),
      };
      const result = await fn(tx);
      await api.batch(ops);
      return result;
    },
    // Demo-only helpers
    isEmpty: () => Object.keys(docs).length === 0,
    loadRaw(map) { docs = map; flush(); },
    reset() { docs = {}; localStorage.removeItem(KEY); },
    flush,
  };
  return api;
}
