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
 * Inicializa los datos desde Supabase al iniciar sesión
 */
export async function initCloudData(userId) {
    state.currentUid = userId;
    state.isReady = false; 
    
    try {
        // Cargamos tablas + la configuración del usuario usando 'masterpin' en minúsculas
        const [act, check, rem, fin, not, cfg] = await Promise.all([
            supabase.from('actividades').select('*').eq('user_id', userId),
            supabase.from('checklists').select('*').eq('user_id', userId),
            supabase.from('recordatorios').select('*').eq('user_id', userId),
            supabase.from('finanzas').select('*').eq('user_id', userId),
            supabase.from('notas').select('*').eq('user_id', userId),
            supabase.from('configuracion').select('masterpin').eq('user_id', userId).maybeSingle() 
        ]);

        state.actividades = act.data || [];
        state.checklists = check.data || [];
        state.reminders = rem.data || [];
        state.finanzas = fin.data || [];
        state.notas = not.data || [];
        
        // Asignamos el PIN correctamente desde la columna 'masterpin'
        if (cfg.data && cfg.data.masterpin) {
            state.masterPin = cfg.data.masterpin;
        }
        
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

    // Si guardamos configuración, usamos el nombre de columna correcto
    if (table === 'configuracion') {
        const { error } = await supabase.from('configuracion').upsert({ user_id: state.currentUid, masterpin: state.masterPin });
        if (error) console.error("Error guardando PIN:", error);
        return;
    }

    // Para tablas normales
    const record = { ...dataObject, user_id: state.currentUid };
    const { error } = await supabase.from(table).upsert([record]);
    
    if (error) {
        console.error("Error guardando en", table, error);
    } else {
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