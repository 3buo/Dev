// Local backups (IndexedDB) for snapshots & restoration points
// Works offline/online without depending on Firestore.

const DB_NAME = 'taskify_local_backup_db';
const DB_VERSION = 1;
const STORE = 'snapshots';

function getNowIso() {
  return new Date().toISOString();
}

function stableStringify(obj) {
  // Deterministic stringify to reduce snapshot churn when values reorder.
  // (Not cryptographic; just stable key order.)
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function dataSizeBytesStringified(str) {
  try {
    // UTF-16 -> approximate bytes
    return new Blob([str]).size;
  } catch (e) {
    return str.length;
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byUid', 'uid', { unique: false });
        store.createIndex('byCreatedAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    fn(store, (r) => (result = r));
  });
}

export async function saveSnapshot({ uid, snapshot, reason = 'manual', localVersion = 0, cloudSyncedAt = null }) {
  if (!uid) throw new Error('saveSnapshot requires uid');

  const createdAt = getNowIso();
  const payloadString = stableStringify(snapshot);
  const sizeBytes = dataSizeBytesStringified(payloadString);

  // Limit amount of data stored per snapshot: keep it simple for now.
  // Caller decides what to include in `snapshot`.

  const id = `${uid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const record = {
    id,
    uid,
    createdAt,
    reason,
    localVersion,
    cloudSyncedAt,
    sizeBytes,
    // Stored as object; cloning handled by structured clone.
    snapshot
  };

  await withStore('readwrite', (store, setResult) => {
    const req = store.add(record);
    req.onsuccess = () => setResult(true);
    req.onerror = () => setResult(Promise.reject(req.error));
  });

  return record;
}

export async function getSnapshotsForUid(uid, limit = 30) {
  if (!uid) return [];

  const all = await withStore('readonly', (store, setResult) => {
    const idx = store.index('byUid');
    const req = idx.openCursor(IDBKeyRange.only(uid));
    const rows = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return setResult(rows);
      rows.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => setResult([]);
  });

  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return all.slice(0, limit);
}

export async function getLatestSnapshotForUid(uid) {
  const snaps = await getSnapshotsForUid(uid, 1);
  return snaps[0] || null;
}

export async function restoreSnapshot(snapshotRecord) {
  if (!snapshotRecord?.snapshot) throw new Error('restoreSnapshot invalid record');
  return snapshotRecord.snapshot;
}

// Exporta un snapshot específico tal cual quedó guardado (incluye metadatos).
export async function exportSnapshotRecord(id) {
  if (!id) throw new Error('exportSnapshotRecord requires id');
  const rec = await withStore('readonly', (store, setResult) => {
    const req = store.get(id);
    req.onsuccess = () => setResult(req.result || null);
    req.onerror = () => setResult(null);
  });
  return rec;
}

// Importa snapshots en IndexedDB. Evita duplicados por id.
export async function importSnapshotRecords(records) {
  if (!Array.isArray(records)) throw new Error('importSnapshotRecords expects array');
  const normalized = records.filter(r => r && r.id && r.snapshot);
  if (normalized.length === 0) return 0;

  let added = 0;
  await withStore('readwrite', (store, setResult) => {
    let pending = normalized.length;
    normalized.forEach((rec) => {
      const req = store.put(rec);
      req.onsuccess = () => {
        added++;
        pending--;
        if (pending === 0) setResult(true);
      };
      req.onerror = () => {
        pending--;
        if (pending === 0) setResult(true);
      };
    });
  });
  return added;
}


export async function deleteSnapshot(id) {
  if (!id) return false;
  return withStore('readwrite', (store, setResult) => {
    const req = store.delete(id);
    req.onsuccess = () => setResult(true);
    req.onerror = () => setResult(false);
  });
}

export async function clearAllSnapshots() {
  return withStore('readwrite', (store, setResult) => {
    const req = store.clear();
    req.onsuccess = () => setResult(true);
    req.onerror = () => setResult(false);
  });
}

