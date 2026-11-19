const DB_NAME = 'amt-tralms-offline';
const DB_VERSION = 1;
export const ENTITIES = ['Item', 'Borrower', 'BorrowRequest', 'Loan', 'MaintenanceLog', 'AuditLog'];

const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const entity of ENTITIES) if (!db.objectStoreNames.contains(entity)) db.createObjectStore(entity, { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function all(entity) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const req = db.transaction(entity, 'readonly').objectStore(entity).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function get(entity, id) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const req = db.transaction(entity, 'readonly').objectStore(entity).get(String(id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function save(entity, value) {
  const db = await dbReady;
  const now = new Date().toISOString();
  const record = { ...value, id: String(value.id || crypto.randomUUID()), created_date: value.created_date || now, updated_date: now };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(entity, 'readwrite');
    tx.objectStore(entity).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Database update was cancelled'));
  });
  notify(entity);
  return record;
}

export async function saveMany(entity, records) {
  const db = await dbReady;
  const now = new Date().toISOString();
  const saved = records.map((r) => ({ ...r, id: String(r.id || crypto.randomUUID()), created_date: r.created_date || now, updated_date: now }));
  await new Promise((resolve, reject) => {
    const tx = db.transaction(entity, 'readwrite');
    for (const record of saved) tx.objectStore(entity).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Database update was cancelled'));
  });
  notify(entity);
  return saved;
}

export async function remove(entity, id) {
  const db = await dbReady;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(entity, 'readwrite');
    tx.objectStore(entity).delete(String(id));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  notify(entity);
}

export async function replaceAll(data) {
  const db = await dbReady;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ENTITIES, 'readwrite');
    for (const entity of ENTITIES) {
      const store = tx.objectStore(entity);
      store.clear();
      for (const row of (data[entity] || [])) store.put(row);
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Import was cancelled'));
  });
  for (const entity of ENTITIES) notify(entity);
}

const listeners = new Map();
export function subscribe(entity, callback) {
  if (!listeners.has(entity)) listeners.set(entity, new Set());
  listeners.get(entity).add(callback);
  return () => listeners.get(entity)?.delete(callback);
}
function notify(entity) { for (const callback of listeners.get(entity) || []) callback(); }

export async function snapshot() {
  return Object.fromEntries(await Promise.all(ENTITIES.map(async (entity) => [entity, await all(entity)])));
}
