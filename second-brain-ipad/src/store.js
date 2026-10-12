// IndexedDB wrapper. Only encrypted records and vault metadata are stored here.
const DB = 'sbipad';
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => { const d = r.result; for (const n of ['meta', 'notes', 'files']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const wrap = (store, mode, fn) => db().then((d) => new Promise((res, rej) => {
  const tx = d.transaction(store, mode); const out = fn(tx.objectStore(store));
  tx.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); tx.onerror = () => rej(tx.error);
}));
export const getMeta = () => wrap('meta', 'readonly', (s) => s.get('vault'));
export const getMetaK = (k) => wrap('meta', 'readonly', (s) => s.get(k));
export const putMetaK = (k, m) => wrap('meta', 'readwrite', (s) => s.put(m, k));
export const putMeta = (m) => wrap('meta', 'readwrite', (s) => s.put(m, 'vault'));
export const putRec = (id, rec) => wrap('notes', 'readwrite', (s) => s.put(rec, id));
export const delRec = (id) => wrap('notes', 'readwrite', (s) => s.delete(id));
export const putFile = (id, rec) => wrap('files', 'readwrite', (s) => s.put(rec, id));
export const delFile = (id) => wrap('files', 'readwrite', (s) => s.delete(id));
export const getFile = (id) => wrap('files', 'readonly', (s) => s.get(id));
export const allFiles = () => allOf('files');
export async function allRecs() { return allOf('notes'); }
async function allOf(store) {
  const d = await db();
  return new Promise((res, rej) => {
    const out = []; const c = d.transaction(store).objectStore(store).openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
    c.onerror = () => rej(c.error);
  });
}
export async function wipe() { for (const n of ['notes', 'files', 'meta']) await wrap(n, 'readwrite', (s) => s.clear()); }
