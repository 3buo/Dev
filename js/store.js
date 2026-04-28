import { supabase } from './supabase-config.js';

export const state = {
    isReady: false,
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

export const notifyStateChange = () => {
    window.dispatchEvent(new Event('stateChanged'));
};

// 🔥 NUEVO: debounce + queue
let saveTimeout = null;
let isSaving = false;
let pendingSave = false;

// 🔥 BACKUP ROBUSTO
function saveLocalBackup() {
    try {
        localStorage.setItem('taskify_emergency_backup', JSON.stringify({
            ...state,
            lastBackup: Date.now()
        }));
    } catch (e) {
        console.warn("Backup falló", e);
    }
}

// 🔥 INIT CLOUD
export async function initCloudData(uid) {
    state.currentUid = uid;
    state.isReady = false;

    try {
        const { data, error } = await supabase
            .from('user_data')
            .select('data')
            .eq('id', uid)
            .single();

        if (error && error.code === 'PGRST116') {
            const defaultData = {
                tasks: [],
                reminders: [],
                balances: { facebank: 0, binance: 0, bs: 0 },
                expenses: [],
                notes: [],
                recurringTasks: [],
                checklists: [],
                tabOrder: [],
                activityLog: {},
                masterPin: "1234"
            };

            await supabase.from('user_data').insert({
                id: uid,
                data: defaultData
            });

            Object.assign(state, defaultData);

        } else if (data?.data) {
            Object.assign(state, data.data);

        } else if (error) {
            throw error;
        }

        state.isReady = true;
        notifyStateChange();
        saveLocalBackup();

    } catch (error) {
        console.error("Error nube → fallback local", error);

        const backup = localStorage.getItem('taskify_emergency_backup');
        if (backup) {
            Object.assign(state, JSON.parse(backup));
            state.isReady = true;
            notifyStateChange();
        }
    }

    // 🔥 realtime sync
    if (unsubSnapshot) supabase.removeChannel(unsubSnapshot);

    unsubSnapshot = supabase.channel('user-sync')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'user_data',
                filter: `id=eq.${uid}`
            },
            (payload) => {
                if (payload.new?.data) {
                    Object.assign(state, payload.new.data);
                    state.isReady = true;

                    notifyStateChange();
                    saveLocalBackup();

                    updateSyncUI("☁️ Sincronizado");
                }
            }
        )
        .subscribe();
}

// 🔥 UI feedback sync
function updateSyncUI(text) {
    const el = document.getElementById('syncStatus');
    if (!el) return;

    el.innerText = text;
    el.className = "cloud-status cloud-syncing";

    setTimeout(() => {
        el.className = "cloud-status";
    }, 2000);
}

// 🔥 SAVE OPTIMIZADO
export function saveDataToCloud() {
    if (!state.currentUid || !state.isReady) {
        console.warn("Guardado bloqueado");
        return;
    }

    pendingSave = true;

    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        if (isSaving) return;

        isSaving = true;

        const { currentUid, isReady, ...dataToSave } = state;

        updateSyncUI("Subiendo...");

        try {
            const { error } = await supabase
                .from('user_data')
                .update({ data: dataToSave })
                .eq('id', currentUid);

            if (error) throw error;

            pendingSave = false;
            saveLocalBackup();

        } catch (error) {
            console.error("Error guardando:", error);
            updateSyncUI("⚠️ Guardado local");

            saveLocalBackup();
        }

        isSaving = false;

        // 🔥 si hubo cambios durante guardado → reintenta
        if (pendingSave) saveDataToCloud();

    }, 500); // 🔥 debounce 500ms
}

// 🔥 ACTIVIDAD (optimizada)
export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];

    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
}

// 🔥 LIMPIEZA
export function clearLocalData() {
    Object.assign(state, {
        isReady: false,
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
