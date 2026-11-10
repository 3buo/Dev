// js/store.js — REWRITE vanilla sin dependencias (reemplaza zustand).
// Arregla F01 (boot), F02 (exports de backup-ui), F08 (snapshot obsoleta), F17 (fecha UTC).
import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { saveSnapshot as saveLocalSnapshotRecord, getLatestSnapshotForUid } from './local-backup.js';

const initialState = {
  currentUid: null,
  tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 },
  expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [],
  activityLog: {}, localVersion: 0
  // Nota: sin masterPin. La bóveda se configura en el primer uso (D-5).
};

let s = { ...initialState };
const set = (partial) => { s = { ...s, ...partial }; };
const get = () => s;

// Proxy: state.tasks.push(...) siempre muta el estado VIVO (fix F08).
export const state = new Proxy({}, {
  get: (_, p) => get()[p],
  set: (_, p, v) => { set({ [p]: v }); return true; },
  deleteProperty: (_, p) => { delete get()[p]; return true; },
  has: (_, p) => p in get(),
  ownKeys: () => Reflect.ownKeys(get()),
  getOwnPropertyDescriptor: (_, p) => Object.getOwnPropertyDescriptor(get(), p)
});

export let unsubSnapshot = null;

export async function initCloudData(uid) {
  set({ currentUid: uid });
  try {
    const latestLocal = await getLatestSnapshotForUid(uid);
    if (latestLocal?.snapshot) set({ ...latestLocal.snapshot, localVersion: latestLocal.localVersion || 0 });
  } catch (e) { console.warn('Failed to load latest local snapshot', e); }
  const docRef = doc(db, 'userData', uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) await setDoc(docRef, { ...initialState });
  unsubSnapshot = onSnapshot(docRef, (doc) => {
    if (!doc.exists()) return;
    const incoming = doc.data();
    if (incoming?.masterPin) delete incoming.masterPin; // migración D-5
    const incomingVersion = incoming?.localVersion || 0;
    if (get().localVersion > incomingVersion) return; // pendiente local: no pisar (F21 para merge real)
    set({ ...incoming });
    notifyStateChange();
  });
}

export async function saveDataToCloud(reason = 'cloud') {
  const { currentUid, ...dataToSave } = get();
  if (!currentUid) return;
  scheduleLocalSnapshot(reason);
  await updateDoc(doc(db, 'userData', currentUid), dataToSave);
}

export function scheduleLocalSnapshot(reason = 'auto') {
  const { currentUid } = get();
  if (!currentUid) return;
  if (window.localSnapshotDebounceTimer) clearTimeout(window.localSnapshotDebounceTimer);
  window.localSnapshotDebounceTimer = setTimeout(async () => {
    try {
      const { currentUid: _, ...data } = get();
      await saveLocalSnapshotRecord({ uid: currentUid, snapshot: data, reason, localVersion: Date.now(), cloudSyncedAt: null });
      notifyLocalBackupListChanged();
    } catch (e) { console.warn('saveLocalSnapshot failed', e); }
  }, 500);
}

export function recordActivity() {
  const now = new Date(); // fecha LOCAL (fix F17)
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  set({ activityLog: { ...get().activityLog, [today]: (get().activityLog[today] || 0) + 1 } });
}

export function clearLocalData() { set({ ...initialState }); }
export function notifyStateChange() { window.dispatchEvent(new Event('stateChanged')); }

// Exports que backup-ui.js ya importa (fix F02):
export function restoreStateFromSnapshot(snapshotData) {
  if (!snapshotData || typeof snapshotData !== 'object') throw new Error('snapshotData inválido');
  const clean = { ...snapshotData };
  if (clean.masterPin) delete clean.masterPin; // migración D-5
  set({ ...clean, currentUid: get().currentUid });
  notifyStateChange();
}
export function notifyLocalBackupListChanged() { window.dispatchEvent(new Event('localBackupListChanged')); }
export async function createManualRestorationPoint(reason = 'manual') {
  const { currentUid, ...data } = get();
  if (!currentUid) throw new Error('Sin sesión (uid)');
  const record = await saveLocalSnapshotRecord({ uid: currentUid, snapshot: data, reason, localVersion: Date.now(), cloudSyncedAt: null });
  notifyLocalBackupListChanged();
  return record;
}
