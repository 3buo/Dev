import { supabase } from './supabase-config.js';
import { state, initCloudData, clearLocalData, unsubSnapshot, saveDataToCloud, recordActivity } from './store.js';

const loadedModules = new Set();
const loadedCSS = new Set(); 
let currentTab = null;

// 🔥 NUEVO: sistema de recompensa global
function triggerReward(text = "✔") {
    let el = document.getElementById('globalReward');
    
    if (!el) {
        el = document.createElement('div');
        el.id = "globalReward";
        el.style.position = "fixed";
        el.style.top = "20px";
        el.style.right = "20px";
        el.style.fontSize = "22px";
        el.style.opacity = "0";
        el.style.transition = "all 0.2s ease";
        el.style.zIndex = "99999";
        document.body.appendChild(el);
    }

    el.textContent = text;
    el.style.opacity = "1";
    el.style.transform = "scale(1.2)";

    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "scale(1)";
    }, 300);
}

// 🔥 NUEVO: focus inteligente
function smartFocus() {
    const activeInput = document.querySelector('input:not([type="hidden"]), textarea');
    if (activeInput) activeInput.focus();
}

window.onload = async () => {
    smartFocus();
};

// click global mantiene flujo
document.addEventListener("click", () => {
    smartFocus();
});

// --- SISTEMA DE PESTAÑAS ---
window.switchTab = async (tabName) => {
    currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    document.body.setAttribute('data-theme', tabName);
    
    const container = document.getElementById('tab-content-container');

    // 🔥 mejora UX (carga suave)
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #aaa;">⚡ Cargando...</div>';

    try {
        if (!loadedCSS.has(tabName)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `components/${tabName}/${tabName}.css`;
            document.head.appendChild(link);
            loadedCSS.add(tabName);
        }

        const htmlRes = await fetch(`components/${tabName}/${tabName}.html`);
        container.innerHTML = await htmlRes.text();

        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            window.dispatchEvent(new Event('stateChanged'));
        }

        // 🔥 auto focus al cambiar tab
        setTimeout(() => smartFocus(), 100);

    } catch (e) {
        container.innerHTML = `<div style="color:var(--warning)">Error cargando el módulo ${tabName}.</div>`;
    }
};

// --- DRAG AND DROP ---
Sortable.create(document.getElementById('tabContainer'), { 
    animation: 150, 
    ghostClass: 'sortable-ghost', 
    onEnd: function () { 
        state.tabOrder = Array.from(document.getElementById('tabContainer').children).map(btn => btn.id); 
        saveDataToCloud(); 
        triggerReward("↕"); // 🔥 feedback
    } 
});

window.addEventListener('stateChanged', () => {
    if (state.tabOrder && state.tabOrder.length > 0) { 
        const container = document.getElementById('tabContainer'); 
        state.tabOrder.forEach(id => { 
            const btn = document.getElementById(id); 
            if (btn) container.appendChild(btn); 
        }); 
    } 
});

// --- AUTH ---
supabase.auth.onAuthStateChange(async (event, session) => { 
    const user = session?.user;

    if (user) { 
        document.getElementById('authScreen').style.display = 'none'; 
        document.getElementById('mainApp').style.display = 'block'; 

        await initCloudData(user.id); 

        if(!currentTab) window.switchTab('actividades'); 

        triggerReward("🚀"); // 🔥 login feedback

    } else { 
        document.getElementById('authScreen').style.display = 'flex'; 
        document.getElementById('mainApp').style.display = 'none'; 

        if (unsubSnapshot) supabase.removeChannel(unsubSnapshot); 

        clearLocalData(); 
        document.body.removeAttribute('data-theme');
    } 
});

// --- LOGIN ---
window.appLogin = async () => { 
    const e = document.getElementById('authEmail').value;
    const p = document.getElementById('authPassword').value;

    if(!e || !p) return alert("Campos vacíos"); 

    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });

    if(error) {
        alert("Error: " + error.message);
    } else {
        triggerReward("✔"); // 🔥 feedback
    }
};

// --- REGISTER ---
window.appRegister = async () => { 
    const e = document.getElementById('authEmail').value;
    const p = document.getElementById('authPassword').value;

    if(p.length < 6) return alert("Min 6 chars"); 

    const { error } = await supabase.auth.signUp({ email: e, password: p });

    if(error) alert(error.message); 
    else {
        triggerReward("🎉");
        alert("Cuenta creada con éxito.");
    }
};

// --- RESET ---
window.appResetPassword = async () => { 
    const e = prompt("Correo:"); 
    if(e) {
        const { error } = await supabase.auth.resetPasswordForEmail(e);
        if(error) alert(error.message); 
        else {
            triggerReward("📧");
            alert("¡Enviado!");
        }
    }
};

// --- LOGOUT ---
window.appLogout = async () => { 
    if(confirm("¿Cerrar sesión?")) {
        await supabase.auth.signOut(); 
        triggerReward("👋");
    }
};

// --- SHORTCUT ULTRA RÁPIDO ---
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        const active = document.activeElement;

        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
            active.blur(); // simula envío
            triggerReward("⚡");
        }
    }
});

// --- PALETA DE COMANDOS (igual pero con reward) ---
const cmdOverlay = document.getElementById('cmdOverlay'), 
      cmdInput = document.getElementById('cmdInput'), 
      cmdResults = document.getElementById('cmdResults'); 

let cmdOptions = [ 
    { name: "💰 Nuevo Gasto", action: () => { window.switchTab('finanzas'); triggerReward(); } }, 
    { name: "📓 Nueva Nota", action: () => { window.switchTab('notas'); triggerReward(); } }, 
    { name: "📝 Nueva Tarea", action: () => { window.switchTab('actividades'); triggerReward(); } }, 
    { name: "🚪 Cerrar Sesión", action: () => { window.appLogout(); } } 
];

document.addEventListener('keydown', (e) => { 
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { 
        e.preventDefault(); 
        if(!state.currentUid) return; 
        cmdOverlay.style.display = 'flex'; 
        cmdInput.value = ''; 
        renderCmdResults(cmdOptions); 
        cmdInput.focus(); 
    } 
    if (e.key === 'Escape') cmdOverlay.style.display = 'none'; 
}); 

window.closeCmd = (e) => { 
    if(e.target === cmdOverlay) cmdOverlay.style.display = 'none'; 
};

cmdInput.addEventListener('input', (e) => { 
    const val = e.target.value.toLowerCase(); 
    renderCmdResults(cmdOptions.filter(opt => opt.name.toLowerCase().includes(val))); 
}); 

function renderCmdResults(list) { 
    cmdResults.innerHTML = ''; 
    list.forEach((item, index) => { 
        const li = document.createElement('li'); 
        li.innerText = item.name; 
        if(index === 0) li.classList.add('active-cmd'); 
        li.onclick = () => { 
            item.action(); 
            cmdOverlay.style.display = 'none'; 
        }; 
        cmdResults.appendChild(li); 
    }); 
} 

cmdInput.addEventListener('keydown', (e) => { 
    if(e.key === 'Enter') { 
        const active = cmdResults.querySelector('.active-cmd'); 
        if(active) active.click(); 
    } 
});


// --- MOTOR GLOBAL DE ALARMAS (SIN CAMBIOS CRÍTICOS) ---
setInterval(() => {
    if(!state.currentUid) return;
    const now = new Date();
    
    state.reminders?.forEach((rem) => {
        if (!rem.completed && !rem.notified && now >= new Date(rem.datetime)) {
            rem.notified = true;
            saveDataToCloud(); 

            if(window.triggerSystemAlarm) {
                window.triggerSystemAlarm(
                    "Recordatorio", 
                    rem.text, 
                    () => { 
                        const actualRem = state.reminders.find(r => r.text === rem.text && r.datetime === rem.datetime);
                        if (actualRem) actualRem.completed = true; else rem.completed = true; 
                        recordActivity(); 
                        saveDataToCloud(); 
                        if(window.renderReminders) window.renderReminders();
                        window.dispatchEvent(new Event('stateChanged')); 
                        triggerReward("⏰");
                    }
                );
            }
        }
    });

    state.recurringTasks?.forEach((rec) => {
        if (!rec.notified && now >= new Date(rec.nextTrigger)) {
            rec.notified = true;
            saveDataToCloud();

            if(window.triggerSystemAlarm) {
                window.triggerSystemAlarm(
                    "Hábito / Rutina", 
                    rec.text, 
                    () => { 
                        if(window.rescheduleRecurring) window.rescheduleRecurring(rec);
                        recordActivity(); 
                        saveDataToCloud(); 
                        if(window.renderRecurringTasks) window.renderRecurringTasks();
                        window.dispatchEvent(new Event('stateChanged'));
                        triggerReward("🔁");
                    }
                );
            }
        }
    });
}, 5000);
