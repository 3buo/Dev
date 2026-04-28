import { supabase } from './supabase-config.js';
import { state, initCloudData, clearLocalData, unsubSnapshot, saveDataToCloud, recordActivity } from './store.js';

const loadedModules = new Set();
const loadedCSS = new Set(); 
let currentTab = null;

// --- SISTEMA DE LOG DE DIAGNÓSTICO INTEGRADO ---
const logError = (tabName, context, error) => {
    console.error(`[DEBUG ERROR] Tab: ${tabName} | Contexto: ${context}`, error);
    const container = document.getElementById('tab-content-container');
    if (container) {
        container.innerHTML = `
            <div style="background: #2d1b1b; color: #ff6b6b; padding: 20px; border: 1px solid #ff6b6b; border-radius: 8px; margin: 20px; font-family: monospace;">
                <h3 style="margin-top:0;">⚠️ Error de Módulo: ${tabName}</h3>
                <p><strong>Contexto:</strong> ${context}</p>
                <p><strong>Detalle Técnico:</strong> ${error.message || error}</p>
                <p style="font-size: 0.9em;">Revisa la consola (F12 -> Console) para ver el stack trace completo.</p>
                <button onclick="window.location.reload()" style="background: #ff6b6b; color: white; border: none; padding: 10px; cursor: pointer; border-radius: 4px;">Recargar Aplicación</button>
            </div>
        `;
    }
};

// --- SISTEMA DE PESTAÑAS (Con saneamiento preventivo) ---
window.switchTab = async (tabName) => {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`tab-${tabName}`);
    if(btn) btn.classList.add('active');
    document.body.setAttribute('data-theme', tabName);
    
    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #aaa;">Cargando interfaz...</div>';

    try {
        if (!loadedCSS.has(tabName)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = `components/${tabName}/${tabName}.css`;
            document.head.appendChild(link);
            loadedCSS.add(tabName);
        }

        const htmlRes = await fetch(`components/${tabName}/${tabName}.html`);
        if (!htmlRes.ok) throw new Error(`Archivo no encontrado: components/${tabName}/${tabName}.html`);
        
        const rawHtml = await htmlRes.text();

        // AJUSTE PREVENTIVO DOMPURIFY
        if (typeof DOMPurify !== 'undefined') {
            container.innerHTML = DOMPurify.sanitize(rawHtml);
        } else {
            console.warn("DOMPurify no cargado, renderizando sin sanear.");
            container.innerHTML = rawHtml;
        }

        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            window.dispatchEvent(new Event('stateChanged'));
        }
    } catch (e) {
        logError(tabName, 'Proceso de carga de módulo', e);
    }
};

// --- DRAG AND DROP ---
const tabContainer = document.getElementById('tabContainer');
if (tabContainer) {
    Sortable.create(tabContainer, { 
        animation: 150, ghostClass: 'sortable-ghost', 
        onEnd: function () { 
            state.tabOrder = Array.from(tabContainer.children).map(btn => btn.id); 
        } 
    });
}

// --- AUTH (Migrado a Supabase - BLINDADO CON ESPERA VISUAL) ---
supabase.auth.onAuthStateChange(async (event, session) => { 
    const user = session?.user;
    
    if (user && user.id) { 
        // 1. Ocultar Auth, mostrar carga
        document.getElementById('authScreen').style.display = 'none'; 
        const app = document.getElementById('mainApp');
        app.style.display = 'block';
        app.innerHTML = '<div style="color:white; text-align:center; padding:50px; font-size:1.5em;">Sincronizando datos con la nube...</div>';
        
        // 2. Espera bloqueante
        await initCloudData(user.id); 
        
        // 3. Restaurar App y navegar
        app.innerHTML = ''; // Limpiar mensaje de carga si es necesario o recargar
        window.location.reload(); // Recarga limpia tras obtener datos de Supabase
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
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value; 
    if(!e || !p) return alert("Campos vacíos"); 
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if(error) alert("Error: " + error.message); 
};

window.appLogout = async () => { if(confirm("¿Cerrar sesión?")) await supabase.auth.signOut(); };

// --- PALETA DE COMANDOS ---
const cmdOverlay = document.getElementById('cmdOverlay'), cmdInput = document.getElementById('cmdInput'), cmdResults = document.getElementById('cmdResults'); 
let cmdOptions = [ 
    { name: "💰 Nuevo Gasto", action: () => { window.switchTab('finanzas'); } }, 
    { name: "📓 Nueva Nota", action: () => { window.switchTab('notas'); } }, 
    { name: "📝 Nueva Tarea", action: () => { window.switchTab('actividades'); } }, 
    { name: "🚪 Cerrar Sesión", action: () => { window.appLogout(); } } 
];
document.addEventListener('keydown', (e) => { 
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if(!state.currentUid) return; cmdOverlay.style.display = 'flex'; cmdInput.value = ''; cmdInput.focus(); } 
    if (e.key === 'Escape') cmdOverlay.style.display = 'none'; 
}); 
window.closeCmd = (e) => { if(e.target === cmdOverlay) cmdOverlay.style.display = 'none'; };

// Exponer el estado a la consola para depuración
window.appState = state;

// --- MOTOR GLOBAL DE ALARMAS ---
setInterval(() => {
    if(!state.currentUid) return;
    const now = new Date();
    state.reminders?.forEach((rem) => {
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