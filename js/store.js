import { supabase } from './supabase-config.js';

export const state = {
    isReady: false, 
    currentUid: null,
    masterPin: "1234",
    actividades: [], 
    reminders: [], 
    finanzas: [], 
    notas: [], 
    checklists: [], 
    recurringTasks: [], 
    activityLog: {},
    tabOrder: [],
    wallets: [ 
        { id: 'facebank', name: 'Facebank', symbol: '$', color: '#00d2ff' }, 
        { id: 'binance', name: 'Binance', symbol: '₮', color: '#fbc02d' }, 
        { id: 'bs', name: 'Bolívares', symbol: 'Bs.', color: '#39ff14' } 
    ],
    balances: { facebank: 0, binance: 0, bs: 0 },
    expenses: []
};

export let unsubSnapshot = null;

/**
 * Notifica a la interfaz que el estado ha cambiado
 */
export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

/**
 * Inicializa los datos desde Supabase de forma tolerante a fallos
 */
export async function initCloudData(userId) {
    state.currentUid = userId;
    state.isReady = false; 
    
    try {
        const tables = ['actividades', 'checklists', 'recordatorios', 'finanzas', 'notas'];
        
        const results = await Promise.all(tables.map(table => 
            supabase.from(table).select('*').eq('user_id', userId)
                .then(res => ({ table, data: res.data, error: res.error }))
        ));

        results.forEach(res => {
            if (res.error) {
                console.error(`Error cargando tabla ${res.table}:`, res.error);
            } else {
                // Asegura que el array exista antes de asignar
                state[res.table] = res.data || []; 
            }
        });

        const { data: cfg, error: cfgError } = await supabase.from('configuracion').select('masterpin').eq('user_id', userId).maybeSingle();
        if (cfgError) console.error("Error cargando PIN:", cfgError);
        if (cfg && cfg.masterpin) {
            state.masterPin = cfg.masterpin;
        }
        
        state.isReady = true;
        notifyStateChange();
        localStorage.setItem('taskify_emergency_backup', JSON.stringify(state));

    } catch (error) {
        console.error("Error crítico al sincronizar con la nube:", error);
        const backup = localStorage.getItem('taskify_emergency_backup');
        if (backup) {
            Object.assign(state, JSON.parse(backup));
            state.isReady = true;
            notifyStateChange();
        }
    }

    // Configuración de Realtime
    if (unsubSnapshot) supabase.removeChannel(unsubSnapshot);
    unsubSnapshot = supabase.channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', filter: `user_id=eq.${userId}` }, () => {
            initCloudData(userId);
        })
        .subscribe();
}

/**
 * Guarda datos en una tabla específica.
 */
export async function saveDataToCloud(table, dataObject) {
    if(!state.currentUid || !state.isReady) return;

    if (table === 'configuracion') {
        // Guarda el PIN
        const { error } = await supabase.from('configuracion').upsert({ user_id: state.currentUid, masterpin: state.masterPin });
        if (error) console.error("Error guardando PIN:", error);
        return;
    }

    // Para tablas normales (tareas, hábitos, etc.)
    const record = { ...dataObject, user_id: state.currentUid };
    const { error } = await supabase.from(table).upsert([record]);
    
    if (error) {
        console.error("Error guardando en", table, error);
    } else {
        // Refrescamos todos los datos para consistencia
        initCloudData(state.currentUid); 
    }
}

/**
 * Elimina datos en una tabla específica por su ID.
 */
export async function deleteDataFromCloud(table, id) {
    if(!state.currentUid || !state.isReady) return;
    
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', state.currentUid);
    
    if (error) {
        console.error("Error eliminando en", table, error);
    } else {
        // Refrescamos todos los datos después de eliminar
        initCloudData(state.currentUid); 
    }
}

/**
 * Registra actividad en el log local
 */
export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
}

/**
 * Resetea el estado local al cerrar sesión
 */
export function clearLocalData() {
    Object.assign(state, { 
        isReady: false, 
        currentUid: null,
        masterPin: "1234",
        actividades: [], 
        reminders: [], 
        finanzas: [], 
        notas: [], 
        checklists: [], 
        recurringTasks: [], 
        activityLog: {},
        tabOrder: [],
        expenses: []
    });
    notifyStateChange();
}

// Exponer el estado a la consola para depuración
window.appState = state;