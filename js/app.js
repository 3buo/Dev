import { supabase } from './supabase-config.js';
import { state, initCloudData, clearLocalData, unsubSnapshot, saveDataToCloud, recordActivity } from './store.js';

const loadedModules = new Set();
const loadedCSS = new Set(); 
let currentTab = null;

// --- SISTEMA DE PESTAÑAS (Con saneamiento DOMPurify) ---
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
        const rawHtml = await htmlRes.text();
        // Saneamiento de seguridad para prevenir XSS
        container.innerHTML = DOMPurify.sanitize(rawHtml);

        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            window.dispatchEvent(new Event('stateChanged'));
        }
    } catch (e) {
        container.innerHTML = `<div style="color:var(--warning)">Error cargando el módulo ${tabName}.</div>`;
    }
};

// --- DRAG AND DROP ---
const tabContainer = document.getElementById('tabContainer');
if (tabContainer) {
    Sortable.create(tabContainer, { 
        animation: 150, ghostClass: 'sortable-ghost', 
        onEnd: function () { 
            state.tabOrder = Array.from(tabContainer.children).map(btn => btn.id); 
            // Guardar orden en tabla de configuración si lo deseas
        } 
    });
}

window.addEventListener('stateChanged', () => {
    if (state.tabOrder && state.tabOrder.length > 0) { 
        const container = document.getElementById('tabContainer'); 
        state.tabOrder.forEach(id => { const btn = document.getElementById(id); if (btn) container.appendChild(btn); }); 
    } 
});

// --- AUTH (Migrado a Supabase) ---
supabase.auth.onAuthStateChange(async (event, session) => { 
    const user = session?.user;
    if (user) { 
        document.getElementById('authScreen').style.display = 'none'; 
        // Esperamos a que los datos se carguen COMPLETAMENTE antes de mostrar la app
        await initCloudData(user.id); 
        document.getElementById('mainApp').style.display = 'block'; 
        
        if(!currentTab) window.switchTab('actividades'); 
    } else { 
        document.getElementById('authScreen').style.display = 'flex'; 
        document.getElementById('mainApp').style.display = 'none'; 
        if (unsubSnapshot) supabase.removeChannel(unsubSnapshot); 
        clearLocalData(); 
        document.body.removeAttribute('data-theme');
    } 
});

window.appLogin = async () => { 
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value; 
    if(!e || !p) return alert("Campos vacíos"); 
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if(error) alert("Error: " + error.message); 
};

window.appRegister = async () => { 
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value; 
    if(p.length < 6) return alert("La contraseña debe tener al menos 6 caracteres"); 
    const { error } = await supabase.auth.signUp({ email: e, password: p });
    if(error) alert(error.message); else alert("Cuenta creada. Ya puedes iniciar sesión.");
};

window.appResetPassword = async () => { 
    const e = prompt("Introduce tu correo electrónico:"); 
    if(e) {
        const { error } = await supabase.auth.resetPasswordForEmail(e);
        if(error) alert(error.message); else alert("¡Enlace de recuperación enviado!");
    }
};

window.appLogout = async () => { 
    if(confirm("¿Cerrar sesión?")) await supabase.auth.signOut(); 
};

// --- PALETA DE COMANDOS ---
const cmdOverlay = document.getElementById('cmdOverlay'), cmdInput = document.getElementById('cmdInput'), cmdResults = document.getElementById('cmdResults'); 
let cmdOptions = [ 
    { name: "💰 Nuevo Gasto", action: () => { window.switchTab('finanzas'); setTimeout(()=>document.getElementById('expDesc')?.focus(), 500); } }, 
    { name: "📓 Nueva Nota", action: () => { window.switchTab('notas'); setTimeout(()=>document.getElementById('noteTitle')?.focus(), 500); } }, 
    { name: "📝 Nueva Tarea", action: () => { window.switchTab('actividades'); setTimeout(()=>document.getElementById('taskInput')?.focus(), 500); } }, 
    { name: "🚪 Cerrar Sesión", action: () => { window.appLogout(); } } 
];
document.addEventListener('keydown', (e) => { 
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if(!state.currentUid) return; cmdOverlay.style.display = 'flex'; cmdInput.value = ''; renderCmdResults(cmdOptions); cmdInput.focus(); } 
    if (e.key === 'Escape') cmdOverlay.style.display = 'none'; 
}); 
window.closeCmd = (e) => { if(e.target === cmdOverlay) cmdOverlay.style.display = 'none'; };
cmdInput.addEventListener('input', (e) => { const val = e.target.value.toLowerCase(); renderCmdResults(cmdOptions.filter(opt => opt.name.toLowerCase().includes(val))); }); 
function renderCmdResults(list) { cmdResults.innerHTML = ''; list.forEach((item, index) => { const li = document.createElement('li'); li.innerText = item.name; if(index === 0) li.classList.add('active-cmd'); li.onclick = () => { item.action(); cmdOverlay.style.display = 'none'; }; cmdResults.appendChild(li); }); } 
cmdInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') { const active = cmdResults.querySelector('.active-cmd'); if(active) active.click(); } });

// ==========================================================================
// --- MOTOR GLOBAL DE ALARMAS ---
// ==========================================================================

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

    state.recurringTasks?.forEach((rec) => {
        if (!rec.notified && now >= new Date(rec.nextTrigger)) {
            rec.notified = true;
            saveDataToCloud('actividades', rec);
            if(window.triggerSystemAlarm) {
                window.triggerSystemAlarm("Hábito / Rutina", rec.text, () => { 
                    if(window.rescheduleRecurring) window.rescheduleRecurring(rec);
                    recordActivity(); 
                    window.dispatchEvent(new Event('stateChanged'));
                });
            }
        }
    });
}, 5000);