import { supabase } from './supabase-config.js'; // CAMBIO: Usamos Supabase

// Mantenemos el candado isReady y la memoria de emergencia intactos
export const state = {
    isReady: false, 
    currentUid: null, masterPin: "1234", tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 },
    expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {}
};

export let unsubSnapshot = null;

export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

export async function initCloudData(uid) {
    state.currentUid = uid;
    state.isReady = false; 
    
    try {
        // 1. Descargar los datos desde PostgreSQL (Supabase)
        const { data, error } = await supabase.from('user_data').select('data').eq('id', uid).single();

        if (error && error.code === 'PGRST116') {
            // Error PGRST116 significa "La fila no existe" -> Es un usuario nuevo
            const defaultData = { tasks: [], reminders: [], balances: {facebank:0,binance:0,bs:0}, expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {}, masterPin: "1234" };
            await supabase.from('user_data').insert({ id: uid, data: defaultData });
            Object.assign(state, defaultData);
        } else if (data && data.data) {
            // Usuario existente, asignamos sus datos
            Object.assign(state, data.data);
        } else if (error) {
            throw error; // Saltar al Catch de emergencia
        }

        // DESBLOQUEAMOS LOS GUARDADOS
        state.isReady = true;
        notifyStateChange();
        localStorage.setItem('taskify_emergency_backup', JSON.stringify(state));

    } catch (error) {
        console.error("Error leyendo datos de la nube. Intentando recuperar backup local...", error);
        const backup = localStorage.getItem('taskify_emergency_backup');
        if (backup) {
            Object.assign(state, JSON.parse(backup));
            state.isReady = true;
            notifyStateChange();
        }
    }

    // 2. Suscribirse a cambios en tiempo real (Equivalente al onSnapshot de Firebase)
    if (unsubSnapshot) supabase.removeChannel(unsubSnapshot);
    unsubSnapshot = supabase.channel('custom-user-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_data', filter: `id=eq.${uid}` }, (payload) => {
            if(payload.new && payload.new.data) {
                Object.assign(state, payload.new.data);
                state.isReady = true; 
                notifyStateChange(); 
                
                const syncEl = document.getElementById('syncStatus');
                if(syncEl) { 
                    syncEl.innerText = "☁️ Sincronizado"; 
                    syncEl.className = "cloud-status cloud-syncing"; 
                    setTimeout(() => syncEl.className = "cloud-status", 2000); 
                }
                localStorage.setItem('taskify_emergency_backup', JSON.stringify(state));
            }
        })
        .subscribe();
}

export async function saveDataToCloud() {
    // EL CANDADO EN ACCIÓN
    if(!state.currentUid || !state.isReady) {
        console.warn("Guardado bloqueado: Previniendo que se borre la nube (Internet lento).");
        return;
    }

    const syncEl = document.getElementById('syncStatus');
    if(syncEl) syncEl.innerText = "Subiendo...";
    
    const { currentUid, isReady, ...dataToSave } = state;
    
    try {
        // Enviar la actualización a la columna 'data' (JSONB) en PostgreSQL
        const { error } = await supabase.from('user_data').update({ data: dataToSave }).eq('id', currentUid);
        if (error) throw error;
    } catch (error) {
        console.error("Error crítico al subir a Supabase:", error);
        if(syncEl) syncEl.innerText = "⚠️ Guardado localmente";
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
