import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { saveSnapshot as saveLocalSnapshotRecord, getLatestSnapshotForUid, restoreSnapshot as restoreLocalSnapshotRecord } from './local-backup.js';

export const state = {
    currentUid: null,
    masterPin: "1234",
    tasks: [],
    reminders: [],
    balances: { facebank: 0, binance: 0, bs: 0 },
    expenses: [],
    notes: [],
    recurringTasks: [],
    checklists: [],
    tabOrder: [],
    activityLog: {}
};

export let unsubSnapshot = null;

// Cuando los datos cambian, le avisamos a toda la app
export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

let localSnapshotDebounceTimer = null;
let localSnapshotPendingReason = null;

function snapshotPayload() {
    const { currentUid, ...data } = state;
    return data;
}

export function restoreStateFromSnapshot(snapshotData) {
    if (!snapshotData || typeof snapshotData !== 'object') throw new Error('snapshotData inválido');
    // No tocamos currentUid para no romper listeners
    Object.assign(state, snapshotData);
    notifyStateChange();
}

export async function createManualRestorationPoint(reason = 'manual') {
    if (!state.currentUid) throw new Error('Sin sesión (uid)');
    const record = await saveLocalSnapshotRecord({
        uid: state.currentUid,
        snapshot: snapshotPayload(),
        reason,
        localVersion: Date.now(),
        cloudSyncedAt: null
    });
    notifyLocalBackupListChanged();
    return record;
}

export function notifyLocalBackupListChanged() {
    window.dispatchEvent(new Event('localBackupListChanged'));
}

export function scheduleLocalSnapshot(reason = 'auto') {
    if (!state.currentUid) return;
    localSnapshotPendingReason = reason;
    if (localSnapshotDebounceTimer) clearTimeout(localSnapshotDebounceTimer);

    localSnapshotDebounceTimer = setTimeout(async () => {
        try {
            await saveLocalSnapshotRecord({
                uid: state.currentUid,
                snapshot: snapshotPayload(),
                reason: localSnapshotPendingReason || 'auto',
                localVersion: Date.now(),
                cloudSyncedAt: null
            });
            notifyLocalBackupListChanged();
        } catch (e) {
            console.warn('saveLocalSnapshot failed', e);
        }
    }, 500);
}

export async function initCloudData(uid) {
    state.currentUid = uid;

    // Offline-first: load latest local snapshot before cloud.
    try {
        const latestLocal = await getLatestSnapshotForUid(uid);
        if (latestLocal?.snapshot) {
            Object.assign(state, latestLocal.snapshot);
            state.localVersion = latestLocal.localVersion || state.localVersion || 0;
            notifyStateChange();
        }
    } catch (e) {
        console.warn('Failed to load latest local snapshot', e);
    }

    const docRef = doc(db, "userData", uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        await setDoc(docRef, {
            tasks: [],
            reminders: [],
            balances: { facebank: 0, binance: 0, bs: 0 },
            expenses: [],
            notes: [],
            recurringTasks: [],
            checklists: [],
            tabOrder: [],
            activityLog: {},
            masterPin: "1234",
            localVersion: 0
        });
    }

    // Cloud listener (do not clobber newer local state)
    unsubSnapshot = onSnapshot(docRef, (doc) => {
        if (!doc.exists()) return;

        const incoming = doc.data();

        const incomingVersion = incoming?.localVersion || 0;
        const localVersion = state?.localVersion || 0;

        if (localVersion > incomingVersion) {
            const syncEl = document.getElementById('syncStatus');
            if (syncEl) {
                syncEl.innerText = '💾 Cambios locales';
                syncEl.className = 'cloud-status cloud-syncing';
                setTimeout(() => { syncEl.className = 'cloud-status'; }, 2000);
            }
            return;
        }

        Object.assign(state, incoming);
        notifyStateChange();

        const syncEl = document.getElementById('syncStatus');
        if (syncEl) {
            syncEl.innerText = "☁️ Sincronizado";
            syncEl.className = "cloud-status cloud-syncing";
            setTimeout(() => syncEl.className = "cloud-status", 2000);
        }
    });
}

export async function saveDataToCloud(reason = 'cloud') {
    if (!state.currentUid) return;

    const syncEl = document.getElementById('syncStatus');
    if (syncEl) syncEl.innerText = "Subiendo...";

    // Persist local snapshot too (offline never loses changes).
    scheduleLocalSnapshot(reason);

    const { currentUid, ...dataToSave } = state;
    await updateDoc(doc(db, "userData", currentUid), dataToSave);

    const syncSnapshotEl = document.getElementById('syncStatus');
    if (syncSnapshotEl) {
        syncSnapshotEl.innerText = "☁️ Sincronizado";
        syncSnapshotEl.className = "cloud-status cloud-syncing";
        setTimeout(() => syncSnapshotEl.className = "cloud-status", 2000);
    }
}

export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
}

export function clearLocalData() {
    Object.assign(state, {
        masterPin: "1234",
        tasks: [],
        reminders: [],
        balances: { facebank: 0, binance: 0, bs: 0 },
        expenses: [],
        notes: [],
        recurringTasks: [],
        checklists: [],
        tabOrder: [],
        activityLog: {}
    });
    notifyStateChange();
}

