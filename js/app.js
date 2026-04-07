import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { state, initCloudData, clearLocalData, unsubSnapshot, saveDataToCloud, recordActivity } from './store.js';

const loadedModules = new Set();
const loadedCSS = new Set(); 
let currentTab = null;

// --- SISTEMA DE PESTAÑAS ---
window.switchTab = async (tabName) => {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
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
        container.innerHTML = await htmlRes.text();

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
Sortable.create(document.getElementById('tabContainer'), { 
    animation: 150, ghostClass: 'sortable-ghost', 
    onEnd: function () { 
        state.tabOrder = Array.from(document.getElementById('tabContainer').children).map(btn => btn.id); 
        saveDataToCloud(); 
    } 
});

window.addEventListener('stateChanged', () => {
    if (state.tabOrder && state.tabOrder.length > 0) { 
        const container = document.getElementById('tabContainer'); 
        state.tabOrder.forEach(id => { const btn = document.getElementById(id); if (btn) container.appendChild(btn); }); 
    } 
});

// --- AUTH ---
onAuthStateChanged(auth, async (user) => { 
    if (user) { 
        document.getElementById('authScreen').style.display = 'none'; 
        document.getElementById('mainApp').style.display = 'block'; 
        await initCloudData(user.uid); 
        window.switchTab('actividades'); 
    } else { 
        document.getElementById('authScreen').style.display = 'flex'; 
        document.getElementById('mainApp').style.display = 'none'; 
        if (unsubSnapshot) unsubSnapshot(); 
        clearLocalData(); 
        document.body.removeAttribute('data-theme');
    } 
});

window.appLogin = () => { 
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value; 
    if(!e || !p) return alert("Campos vacíos"); 
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Error: " + err.message)); 
};
window.appRegister = () => { 
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value; 
    if(p.length < 6) return alert("Min 6 chars"); 
    createUserWithEmailAndPassword(auth, e, p).then(() => alert("Cuenta creada.")).catch(err => alert(err.message)); 
};
window.appResetPassword = () => { const e = prompt("Correo:"); if(e) sendPasswordResetEmail(auth, e).then(() => alert("Enviado!")).catch(err=>alert(err.message)); };
window.appLogout = () => { if(confirm("¿Cerrar sesión?")) signOut(auth); };

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


// --- MOTOR GLOBAL DE ALARMAS (EL CEREBRO) ---
let audioCtx = null;
let alarmAudioInterval = null;

document.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}, { once: true });

function playBeep() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = "sine"; osc.frequency.value = 800;
    gain.gain.setValueAtTime(1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
}

const startAlarmSound = () => { if(!alarmAudioInterval) { playBeep(); alarmAudioInterval = setInterval(playBeep, 2000); } };
const stopAlarmSound = () => { if(alarmAudioInterval) { clearInterval(alarmAudioInterval); alarmAudioInterval = null; } };

window.triggerModal = (type, text, onComplete, onSnooze) => {
    startAlarmSound();
    document.getElementById('alarmTypeDesc').innerText = type; 
    document.getElementById('alarmText').innerText = text;
    const modal = document.getElementById('alarmModal'); 
    modal.style.display = 'flex';
    
    const btnC = document.getElementById('btnComplete'), btnS = document.getElementById('btnSnooze');
    const newBtnC = btnC.cloneNode(true), newBtnS = btnS.cloneNode(true);
    btnC.parentNode.replaceChild(newBtnC, btnC); btnS.parentNode.replaceChild(newBtnS, btnS);
    
    newBtnC.onclick = () => { stopAlarmSound(); modal.style.display = 'none'; if(onComplete) onComplete(); };
    newBtnS.onclick = () => { stopAlarmSound(); modal.style.display = 'none'; if(onSnooze) onSnooze(); };
};

setInterval(() => {
    if(!state.currentUid) return;
    const now = new Date();
    
    // 1. Revisar Recordatorios (De la pestaña Recordatorios)
    state.reminders?.forEach((rem) => {
        if (!rem.completed && !rem.notified && now >= new Date(rem.datetime)) {
            rem.notified = true;
            window.triggerModal("Recordatorio", rem.text, 
                () => { rem.completed = true; saveDataToCloud(); window.dispatchEvent(new Event('stateChanged')); }, 
                () => { 
                    const snoozeTime = new Date(now.getTime() + (rem.snoozeMins * 60000));
                    rem.datetime = new Date(snoozeTime.getTime() - (snoozeTime.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    rem.notified = false; saveDataToCloud(); window.dispatchEvent(new Event('stateChanged'));
                }
            );
        }
    });

    // 2. Revisar Hábitos (De la pestaña Actividades)
    state.recurringTasks?.forEach((rec) => {
        if (!rec.notified && now >= new Date(rec.nextTrigger)) {
            rec.notified = true;
            window.triggerModal("Hábito / Rutina", rec.text, 
                () => { 
                    if(window.rescheduleRecurring) window.rescheduleRecurring(rec);
                    recordActivity(); saveDataToCloud(); window.dispatchEvent(new Event('stateChanged'));
                }, 
                () => { 
                    rec.notified = false;
                    const snoozeTime = new Date(now.getTime() + (10 * 60000)); // 10 minutos de snooze
                    rec.nextTrigger = new Date(snoozeTime.getTime() - (snoozeTime.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    saveDataToCloud(); window.dispatchEvent(new Event('stateChanged'));
                }
            );
        }
    });
}, 5000);
