import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc, updateDoc, getDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. CAPA DE SEGURIDAD: Persistencia Offline (Si se va el internet, usa la caché del móvil)
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') console.warn('Múltiples pestañas abiertas, persistencia en 1 sola.');
        else if (err.code === 'unimplemented') console.warn('Navegador sin soporte para persistencia.');
    });
} catch (e) {
    console.warn("No se pudo iniciar la persistencia offline", e);
}

// 2. AÑADIDO EL CANDADO isReady
export const state = {
    isReady: false, // FLAG CRÍTICO: Previene que se sobrescriba la base de datos vacía
    currentUid: null, masterPin: "1234", tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 },
    expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {}
};

export let unsubSnapshot = null;

// Cuando los datos cambian, le avisamos a toda la app
export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

export async function initCloudData(uid) {
    state.currentUid = uid;
    state.isReady = false; // Bloqueamos guardados por defecto
    
    const docRef = doc(db, "userData", uid);
    
    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            // Solo si el usuario es genuinamente nuevo, inicializamos en blanco
            await setDoc(docRef, { tasks: [], reminders: [], balances: {facebank:0,binance:0,bs:0}, expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {}, masterPin: "1234" });
        }
    } catch (error) {
        console.error("Error leyendo datos de la nube. Intentando recuperar backup local...", error);
        const backup = localStorage.getItem('taskify_emergency_backup');
        if (backup) {
            Object.assign(state, JSON.parse(backup));
            state.isReady = true;
            notifyStateChange();
        }
    }

    unsubSnapshot = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            Object.assign(state, doc.data());
            state.isReady = true; // DESBLOQUEAMOS LOS GUARDADOS: La data real ya llegó
            notifyStateChange(); 
            
            const syncEl = document.getElementById('syncStatus');
            if(syncEl) { 
                syncEl.innerText = "☁️ Sincronizado"; 
                syncEl.className = "cloud-status cloud-syncing"; 
                setTimeout(() => syncEl.className = "cloud-status", 2000); 
            }

            // 3. CAPA DE SEGURIDAD: Guardar un snapshot local invisible
            localStorage.setItem('taskify_emergency_backup', JSON.stringify(state));
        }
    });
}

export async function saveDataToCloud() {
    // EL CANDADO EN ACCIÓN: Rechaza cualquier guardado si la data no ha bajado primero
    if(!state.currentUid || !state.isReady) {
        console.warn("Guardado bloqueado: Previniendo que se borre la nube (Internet lento).");
        return;
    }

    const syncEl = document.getElementById('syncStatus');
    if(syncEl) syncEl.innerText = "Subiendo...";
    
    // Extraemos currentUid e isReady para no subirlos a Firebase como datos
    const { currentUid, isReady, ...dataToSave } = state;
    
    try {
        await updateDoc(doc(db, "userData", currentUid), dataToSave);
    } catch (error) {
        console.error("Error crítico al subir a la nube:", error);
        if(syncEl) syncEl.innerText = "⚠️ Guardado localmente";
        
        // Si hay error (ej. se van los datos en la calle), guardamos forzosamente en local
        localStorage.setItem('taskify_emergency_backup', JSON.stringify(state));
    }
}

export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
}

export function clearLocalData() {
    Object.assign(state, { isReady: false, masterPin: "1234", tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 }, expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {} });
    notifyStateChange();
}
