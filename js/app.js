import { supabase } from './supabase-config.js';
import { state, initCloudData, clearLocalData, unsubSnapshot, saveDataToCloud, recordActivity } from './store.js';

const loadedModules = new Set();
const loadedCSS = new Set(); 
let currentTab = null;

// --- SISTEMA DE LOG DE DIAGNÓSTICO ---
const logError = (tabName, context, error) => {
    console.error(`[DEBUG ERROR] Tab: ${tabName} | Contexto: ${context}`, error);
    const container = document.getElementById('tab-content-container');
    if (container) {
        container.innerHTML = `
            <div style="background: #2d1b1b; color: #ff6b6b; padding: 20px; border: 1px solid #ff6b6b; border-radius: 8px; margin: 20px; font-family: monospace;">
                <h3 style="margin-top:0;">⚠️ Error de Módulo: ${tabName}</h3>
                <p><strong>Detalle Técnico:</strong> ${error.message || error}</p>
                <button id="btnReloadApp" style="background: #ff6b6b; color: white; border: none; padding: 10px; cursor: pointer; border-radius: 4px;">Recargar Aplicación</button>
            </div>
        `;
        document.getElementById('btnReloadApp').addEventListener('click', () => window.location.reload());
    }
};

// --- SISTEMA DE PESTAÑAS ---
window.switchTab = async (tabName) => {
    currentTab = tabName;
    
    // UI Update
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');
    document.body.setAttribute('data-theme', tabName);
    
    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #aaa;">Cargando interfaz...</div>';

    try {
        // Cargar CSS si no existe
        if (!loadedCSS.has(tabName)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; 
            link.href = `components/${tabName}/${tabName}.css`;
            document.head.appendChild(link);
            loadedCSS.add(tabName);
        }

        // Cargar HTML
        const htmlRes = await fetch(`components/${tabName}/${tabName}.html`);
        if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status}: No se encontró el archivo.`);
        
        const rawHtml = await htmlRes.text();
        
        // Saneamiento obligatorio con DOMPurify (Cargado en index.html)
        if (typeof DOMPurify !== 'undefined') {
            container.innerHTML = DOMPurify.sanitize(rawHtml);
        } else {
            container.innerHTML = rawHtml;
        }

        // Cargar Módulo JS
        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            // Notificar al módulo que los datos pueden haber cambiado
            window.dispatchEvent(new Event('stateChanged'));
        }
    } catch (e) {
        logError(tabName, 'Carga de interfaz', e);
    }
};

// --- GESTIÓN DE SESIÓN (SUPABASE) ---
supabase.auth.onAuthStateChange(async (event, session) => { 
    const user = session?.user;
    // En app.js, dentro de onAuthStateChange, antes de initCloudData
    console.log("Intentando inicializar con user ID:", user.id);
    await initCloudData(user.id);

    
    if (user && user.id) { 
        document.getElementById('authScreen').style.display = 'none'; 
        const mainApp = document.getElementById('mainApp');
        mainApp.style.display = 'block';
        
        // Pantalla de espera mientras cargan los datos reales
        const container = document.getElementById('tab-content-container');
        if(container) container.innerHTML = '<div style="color:white; text-align:center; padding:50px;">Sincronizando con la nube...</div>';

        try {
            await initCloudData(user.id); 
            if(!currentTab) window.switchTab('actividades');
            else window.dispatchEvent(new Event('stateChanged'));
        } catch (err) {
            console.error("Error inicializando datos:", err);
        }
    } else { 
        document.getElementById('authScreen').style.display = 'flex'; 
        document.getElementById('mainApp').style.display = 'none'; 
        if (unsubSnapshot) supabase.removeChannel(unsubSnapshot); 
        clearLocalData(); 
        document.body.removeAttribute('data-theme');
    } 
});

// --- FUNCIONES DE AUTH ---
window.appLogin = async () => { 
    const e = document.getElementById('authEmail').value;
    const p = document.getElementById('authPassword').value; 
    if(!e || !p) return alert("Campos vacíos"); 
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if(error) alert("Error: " + error.message); 
};

window.appRegister = async () => { 
    const e = document.getElementById('authEmail').value;
    const p = document.getElementById('authPassword').value; 
    if(p.length < 6) return alert("Mínimo 6 caracteres"); 
    const { error } = await supabase.auth.signUp({ email: e, password: p });
    if(error) alert(error.message); else alert("Registro exitoso. Revisa tu correo o inicia sesión.");
};

window.appLogout = async () => { 
    if(confirm("¿Cerrar sesión?")) await supabase.auth.signOut(); 
};

// --- UTILIDADES ---
const togglePasswordVisibility = () => {
    const input = document.getElementById('authPassword');
    if (input) input.type = input.type === "password" ? "text" : "password";
};

// --- ENLACE DE EVENTOS (Blindaje anti-CSP) ---
document.addEventListener('DOMContentLoaded', () => {
    // Botones de Auth
    document.getElementById('btnLoginBtn')?.addEventListener('click', window.appLogin);
    document.getElementById('btnRegBtn')?.addEventListener('click', window.appRegister);
    document.getElementById('togglePasswordVisibilityBtn')?.addEventListener('click', togglePasswordVisibility);
    
    // Tabs
    document.getElementById('tab-actividades')?.addEventListener('click', () => window.switchTab('actividades'));
    document.getElementById('tab-checklists')?.addEventListener('click', () => window.switchTab('checklists'));
    document.getElementById('tab-recordatorios')?.addEventListener('click', () => window.switchTab('recordatorios'));
    document.getElementById('tab-finanzas')?.addEventListener('click', () => window.switchTab('finanzas'));
    document.getElementById('tab-notas')?.addEventListener('click', () => window.switchTab('notas'));
    document.getElementById('appLogoutBtn')?.addEventListener('click', window.appLogout);

    // Alarmas
    document.getElementById('alarmFloatingBtn')?.addEventListener('click', () => window.toggleAlarmConfig());
});

// --- MOTOR GLOBAL DE ALARMAS ---
setInterval(() => {
    if(!state.currentUid || !state.isReady) return;
    const now = new Date();
    
    // Revisar Recordatorios
    (state.recordatorios || []).forEach((rem) => {
        if (!rem.completed && !rem.notified && now >= new Date(rem.datetime)) {
            rem.notified = true;
            saveDataToCloud('recordatorios', rem); 
            if(window.triggerSystemAlarm) {
                window.triggerSystemAlarm("Recordatorio", rem.text, () => { 
                    rem.completed = true;
                    saveDataToCloud('recordatorios', rem);
                    recordActivity();
                    window.dispatchEvent(new Event('stateChanged')); 
                });
            }
        }
    });
}, 5000);

// Exponer estado para debug
window.appState = state;