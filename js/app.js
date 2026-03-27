import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { state, initCloudData, clearLocalData, unsubSnapshot, saveDataToCloud } from './store.js';

const loadedModules = new Set();
const loadedCSS = new Set(); // Nuevo: Rastreador de estilos cargados
let currentTab = null;

// --- SISTEMA MODULAR DE PESTAÑAS Y CSS DINÁMICO ---
window.switchTab = async (tabName) => {
    currentTab = tabName;
    
    // 1. Cambiamos la clase activa visualmente
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    const container = document.getElementById('tab-content-container');
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: #aaa;">Cargando interfaz...</div>';

    try {
        // 2. Inyectamos el CSS dinámicamente (Solo la primera vez)
        if (!loadedCSS.has(tabName)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `components/${tabName}/${tabName}.css`;
            
            // Si el archivo CSS no existe, no romperá la app, solo dará un error 404 silencioso en la consola
            document.head.appendChild(link);
            loadedCSS.add(tabName);
        }

        // 3. Cargamos el HTML
        const htmlRes = await fetch(`components/${tabName}/${tabName}.html`);
        container.innerHTML = await htmlRes.text();

        // 4. Cargamos el JS
        if (!loadedModules.has(tabName)) {
            const module = await import(`../components/${tabName}/${tabName}.js`);
            if (module.init) module.init();
            loadedModules.add(tabName);
        } else {
            // Si ya estaba cargado, forzamos un repintado local
            window.dispatchEvent(new Event('stateChanged'));
        }
    } catch (e) {
        container.innerHTML = `<div style="color:var(--warning)">Error cargando el módulo ${tabName}. ${e.message}</div>`;
    }
};

// --- DRAG AND DROP DE PESTAÑAS (SORTABLE.JS) ---
// Inicializamos el drag and drop
Sortable.create(document.getElementById('tabContainer'), { 
    animation: 150, 
    ghostClass: 'sortable-ghost', 
    onEnd: function () { 
        // Cuando terminas de arrastrar, guardamos el nuevo orden en el estado global y en la nube
        state.tabOrder = Array.from(document.getElementById('tabContainer').children).map(btn => btn.id); 
        saveDataToCloud(); 
    } 
});

// Cuando la app carga los datos de Firebase, reordenamos visualmente los botones
window.addEventListener('stateChanged', () => {
    if (state.tabOrder && state.tabOrder.length > 0) { 
        const container = document.getElementById('tabContainer'); 
        state.tabOrder.forEach(id => { 
            const btn = document.getElementById(id); 
            // Añadir al final reordena físicamente el nodo en el DOM
            if (btn) container.appendChild(btn); 
        }); 
    } 
});

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

// --- PALETA DE COMANDOS (CTRL + K) ---
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
