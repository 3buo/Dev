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
                <button id="btnReloadApp" style="background: #ff6b6b; color: white; border: none; padding: 10px; cursor: pointer; border-radius: 4px;">Recargar Aplicación</button>
            </div>
        `;
        document.getElementById('btnReloadApp')?.addEventListener('click', () => window.location.reload());
    }
};

// --- SISTEMA DE PESTAÑAS ---
window.switchTab = async (tabName) => {
    currentTab = tabName;
    
    // Actualizar UI de pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');
    document.body.setAttribute('data-theme', tabName);
    
    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #aaa;">Cargando interfaz...</div>';

    try {
        // Cargar CSS dinámicamente
        if (!loadedCSS.has(tabName)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; 
            link.href = `components/${tabName}/${tabName}.css`;
            document.head.appendChild(link);
            loadedCSS.add(tabName);
        }

        // Cargar HTML
        const htmlRes = await fetch(`components/${tabName}/${tabName}.html`);
        if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status} - Archivo no encontrado: components/${tabName}/${tabName}.html`);
        
        const rawHtml = await htmlRes.text();
        
        // Renderizar HTML (DOMPurify ya no es necesario si quitamos CSP y confiamos en las fuentes)
        container.innerHTML = rawHtml;

        // Cargar Módulo JS
        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            // Si el módulo ya cargó, solo notificamos el cambio de estado
            window.dispatchEvent(new Event('stateChanged'));
        }
    } catch (e) {
        logError(tabName, 'Carga de interfaz', e);
    }
};

// --- DRAG AND DROP PARA TABS ---
const tabContainer = document.getElementById('tabContainer');
if (tabContainer) {
    Sortable.create(tabContainer, { 
        animation: 150, ghostClass: 'sortable-ghost', 
        onEnd: function () { 
            state.tabOrder = Array.from(tabContainer.children).map(btn => btn.id); 
        } 
    });
}

// --- GESTIÓN DE SESIÓN (SUPABASE) ---
supabase.auth.onAuthStateChange(async (event, session) => { 
    const user = session?.user;
    
    if (user && user.id) { 
        document.getElementById('authScreen').style.display = 'none'; 
        const mainApp = document.getElementById('mainApp');
        mainApp.style.display = 'block';
        
        mainApp.innerHTML = '<div style="color:white; text-align:center; padding:50px; font-size:1.5em;">Sincronizando datos con la nube...</div>';
        
        try {
            await initCloudData(user.id); 
        } catch (err) {
            console.error("Fallo al sincronizar datos:", err);
            logError('Auth', 'initCloudData', err); // Loggear el error si falla la inicialización
        }
        
        mainApp.innerHTML = ''; // Limpiar mensaje de carga
        // Navegar a la pestaña por defecto o la última activa
        if(!currentTab) window.switchTab('actividades');
        window.dispatchEvent(new Event('stateChanged')); // Notificar a otros módulos
    } else { 
        // Estado de logout
        document.getElementById('authScreen').style.display = 'flex'; 
        document.getElementById('mainApp').style.display = 'none'; 
        if (unsubSnapshot) supabase.removeChannel(unsubSnapshot); // Desuscribir de realtime
        clearLocalData(); 
        document.body.removeAttribute('data-theme');
    } 
});

// --- FUNCIONES DE AUTH ---
window.appLogin = async () => { 
    const e = document.getElementById('authEmail')?.value;
    const p = document.getElementById('authPassword')?.value; 
    if(!e || !p) return alert("Campos vacíos"); 
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if(error) alert("Error: " + error.message); 
};

window.appRegister = async () => { 
    const e = document.getElementById('authEmail')?.value;
    const p = document.getElementById('authPassword')?.value; 
    if(p.length < 6) return alert("Mínimo 6 caracteres"); 
    const { error } = await supabase.auth.signUp({ email: e, password: p });
    if(error) alert(error.message); else alert("Registro exitoso. Revisa tu correo o inicia sesión.");
};

window.appLogout = async () => { 
    if(confirm("¿Cerrar sesión?")) await supabase.auth.signOut(); 
};

// --- PALETA DE COMANDOS ---
const cmdOverlay = document.getElementById('cmdOverlay'), cmdInput = document.getElementById('cmdInput'); 

document.addEventListener('keydown', (e) => { 
    // Atajo para abrir la paleta (Ctrl+K)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { 
        e.preventDefault(); 
        if(!state.currentUid) return; // No hacer nada si no hay usuario logueado
        if (cmdOverlay) cmdOverlay.style.display = 'flex'; 
        if (cmdInput) cmdInput.value = ''; 
        if (cmdInput) cmdInput.focus(); 
    } 
    // Cerrar con Escape
    if (e.key === 'Escape') {
        if (cmdOverlay) cmdOverlay.style.display = 'none';
    }
});

window.closeCmd = (e) => { if(e.target === cmdOverlay) cmdOverlay.style.display = 'none'; };

// --- MOTOR GLOBAL DE ALARMAS (Comentado por seguridad CSP) ---

setInterval(() => {
    if(!state.currentUid || !state.isReady) return;
    const now = new Date();
    (state.reminders || []).forEach((rem) => {
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