import { supabase } from './supabase-config.js';

export const state = {
    isReady: false, 
    currentUid: null,
    masterPin: "1234", // PIN por defecto
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

export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));

export async function initCloudData(userId) {
    state.currentUid = userId;
    state.isReady = false; 
    
    try {
        // Cargamos tablas + la configuración del usuario (incluyendo el PIN)
        const [act, check, rem, fin, not, cfg] = await Promise.all([
            supabase.from('actividades').select('*').eq('user_id', userId),
            supabase.from('checklists').select('*').eq('user_id', userId),
            supabase.from('recordatorios').select('*').eq('user_id', userId),
            supabase.from('finanzas').select('*').eq('user_id', userId),
            supabase.from('notas').select('*').eq('user_id', userId),
            supabase.from('configuracion').select('masterPin').eq('user_id', userId).single()
        ]);

        state.actividades = act.data || [];
        state.checklists = check.data || [];
        state.reminders = rem.data || [];
        state.finanzas = fin.data || [];
        state.notas = not.data || [];
        
        // Si el usuario ya configuró un PIN, lo cargamos
        if (cfg.data && cfg.data.masterPin) {
            state.masterPin = cfg.data.masterPin;
        }
        
        state.isReady = true;
        notifyStateChange();
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

    if (unsubSnapshot) supabase.removeChannel(unsubSnapshot);
    unsubSnapshot = supabase.channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', filter: `user_id=eq.${userId}` }, () => {
            initCloudData(userId);
        })
        .subscribe();
}

export async function saveDataToCloud(table, dataObject) {
    if(!state.currentUid || !state.isReady) return;
    const record = { ...dataObject, user_id: state.currentUid };
    const { error } = await supabase.from(table).upsert([record]);
    if (error) console.error("Error guardando en", table, error);
    else initCloudData(state.currentUid); 
}

export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
}

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
        tabOrder: []
    });
    notifyStateChange();
}