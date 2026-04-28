import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const state = {
    currentUid: null, masterPin: "1234", tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 },
    expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {}
};

export let unsubSnapshot = null;

// Cuando los datos cambian, le avisamos a toda la app
export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

export async function initCloudData(uid) {
    state.currentUid = uid;
    const docRef = doc(db, "userData", uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        await setDoc(docRef, { tasks: [], reminders: [], balances: {facebank:0,binance:0,bs:0}, expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {}, masterPin: "1234" });
    }
    unsubSnapshot = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            Object.assign(state, doc.data());
            notifyStateChange(); // Fuerza re-render de la pestaña activa
            const syncEl = document.getElementById('syncStatus');
            if(syncEl) { syncEl.innerText = "☁️ Sincronizado"; syncEl.className = "cloud-status cloud-syncing"; setTimeout(() => syncEl.className = "cloud-status", 2000); }
        }
    });
}

export async function saveDataToCloud() {
    if(!state.currentUid) return;
    const syncEl = document.getElementById('syncStatus');
    if(syncEl) syncEl.innerText = "Subiendo...";
    
    // Extraemos solo la data que queremos guardar
    const { currentUid, ...dataToSave } = state;
    await updateDoc(doc(db, "userData", currentUid), dataToSave);
}

export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
}

export function clearLocalData() {
    Object.assign(state, { masterPin: "1234", tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 }, expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {} });
    notifyStateChange();
}