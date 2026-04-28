import { supabase } from './supabase-config.js';

export const state = {
    isReady: false, 
    currentUid: null,
    actividades: [], 
    reminders: [], 
    finanzas: [], 
    notas: [], 
    checklists: [], 
    recurringTasks: [], 
    activityLog: {},
    tabOrder: []
};

export let unsubSnapshot = null;

/**
 * Notifica a la interfaz que el estado ha cambiado
 */
export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

/**
 * Inicializa los datos desde Supabase al iniciar sesión
 */
export async function initCloudData(userId) {
    state.currentUid = userId;
    state.isReady = false; 
    
    try {
        // Cargamos todas las tablas en paralelo para máxima velocidad
        const [act, check, rem, fin, not] = await Promise.all([
            supabase.from('actividades').select('*').eq('user_id', userId),
            supabase.from('checklists').select('*').eq('user_id', userId),
            supabase.from('recordatorios').select('*').eq('user_id', userId),
            supabase.from('finanzas').select('*').eq('user_id', userId),
            supabase.from('notas').select('*').eq('user_id', userId)
        ]);

        // Asignamos los datos obtenidos
        state.actividades = act.data || [];
        state.checklists = check.data || [];
        state.reminders = rem.data || [];
        state.finanzas = fin.data || [];
        state.notas = not.data || [];
        
        state.isReady = true;
        notifyStateChange();
        
        // Guardado de emergencia local
        localStorage.setItem('taskify_emergency_backup', JSON.stringify(state));

    } catch (error) {
        console.error("Error al sincronizar con la nube:", error);
        const backup = localStorage.getItem('taskify_emergency_backup');
        if (backup) {
            Object.assign(state, JSON.parse(backup));
            state.isReady = true;
            notifyStateChange();
        }
    }

    // Configuración de Realtime (Actualización automática si otro dispositivo cambia algo)
    if (unsubSnapshot) supabase.removeChannel(unsubSnapshot);
    unsubSnapshot = supabase.channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', filter: `user_id=eq.${userId}` }, (payload) => {
            console.log("Cambio detectado, refrescando datos...");
            initCloudData(userId);
        })
        .subscribe();
}

/**
 * Guarda datos en una tabla específica.
 * @param {string} table - Nombre de la tabla en Supabase
 * @param {object} dataObject - Datos a guardar
 */
export async function saveDataToCloud(table, dataObject) {
    if(!state.currentUid || !state.isReady) return;

    // Aseguramos que siempre lleve el user_id para cumplir con RLS
    const record = { ...dataObject, user_id: state.currentUid };

    const { error } = await supabase.from(table).upsert([record]);
    
    if (error) {
        console.error("Error guardando en", table, error);
    } else {
        // Refrescamos los datos para mantener el estado local consistente
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
        actividades: [], 
        reminders: [], 
        finanzas: [], 
        notas: [], 
        checklists: [], 
        recurringTasks: [], 
        activityLog: {},
        tabOrder: []
    });
    notifyStateChange();
}