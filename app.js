import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { state, initCloudData, clearLocalData, unsubSnapshot } from './store.js';

const loadedModules = new Set();
let currentTab = null;

// --- SISTEMA MODULAR DE PESTAÑAS ---
window.switchTab = async (tabName) => {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<div style="text-align:center; padding: 40px;">Cargando interfaz...</div>';

    try {
        const htmlRes = await fetch(`components/${tabName}/${tabName}.html`);
        container.innerHTML = await htmlRes.text();

        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            // Si el módulo ya se había cargado antes, disparamos el evento para que se re-dibuje con los datos actuales
            window.dispatchEvent(new Event('stateChanged'));
        }
    } catch (e) {
        container.innerHTML = `<div style="color:var(--warning)">Error cargando el módulo ${tabName}. ${e.message}</div>`;
    }
};

// --- AUTHENTICATION ---
onAuthStateChanged(auth, async (user) => { 
    if (user) { 
        document.getElementById('authScreen').style.display = 'none'; 
        document.getElementById('mainApp').style.display = 'block'; 
        initCloudData(user.uid); 
        window.switchTab('actividades'); // Pestaña por defecto
    } else { 
        document.getElementById('authScreen').style.display = 'flex'; 
        document.getElementById('mainApp').style.display = 'none'; 
        if (unsubSnapshot) unsubSnapshot(); 
        clearLocalData(); 
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

// Paleta de Comandos
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