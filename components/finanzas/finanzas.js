import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// --- CORE ---
window.rateBcvVal = window.rateBcvVal || 0; 
window.rateBinanceVal = window.rateBinanceVal || 0; 
window.rateEuroVal = window.rateEuroVal || 0;
let financeChartInstance = null;
let isUnlocked = false;
window.currentSmartFilter = null; 

// --- SEGURIDAD: Desbloqueo de Bóveda ---
window.unlockVault = () => { 
    const inputField = document.getElementById('pinInput');
    if(!inputField) return;
    const input = inputField.value; 
    
    // DEBUG: Eliminar en producción si se desea
    console.log("Validando PIN...");

    // Comprobación segura de tipos y valores
    if (String(input).trim() === String(state.masterPin).trim()) { 
        isUnlocked = true;
        
        const overlay = document.getElementById('vaultOverlay');
        const content = document.getElementById('vaultContent');
        
        if(overlay) overlay.style.opacity = '0';
        
        // CORREGIDO: Uso de función segura en setTimeout
        setTimeout(() => {
            if(overlay) overlay.classList.add('vault-hidden'); 
            if(content) content.classList.remove('vault-hidden'); 
            init(); // Cargar datos
        }, 400); 

        if(navigator.vibrate) navigator.vibrate([50, 50, 50]); 
        if(window.rateBcvVal === 0) window.fetchExchangeRates(true);
    } else { 
        alert("PIN Incorrecto."); 
        inputField.value = ''; 
        if(navigator.vibrate) navigator.vibrate(200); 
    } 
};

window.changePin = async () => {
    const newPin = prompt("🔑 Ingresa tu nuevo PIN de seguridad:");
    if(newPin && newPin.trim().length > 0) { 
        const pin = newPin.trim();
        state.masterPin = pin; 
        // BLINDAJE: Uso exacto de la columna 'masterpin' en minúsculas
        await saveDataToCloud('configuracion', { masterpin: pin }); 
        alert("✅ PIN actualizado."); 
    }
};

// --- GESTOR DE CARTERAS ---
window.openWalletModal = () => {
    const name = document.getElementById('newWalletName'), symbol = document.getElementById('newWalletSymbol');
    if(name) name.value = ''; 
    if(symbol) symbol.value = '';
    const modal = document.getElementById('walletModal');
    if(modal) modal.classList.remove('vault-hidden');
};

window.closeWalletModal = () => { 
    const modal = document.getElementById('walletModal');
    if(modal) modal.classList.add('vault-hidden'); 
};

window.saveNewWallet = () => {
    const name = document.getElementById('newWalletName').value.trim();
    const symbol = document.getElementById('newWalletSymbol').value.trim();
    const color = document.getElementById('newWalletColor').value;
    
    if(!name || !symbol) return alert("Llena el nombre y el símbolo.");
    
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-4);
    
    if(!state.wallets) state.wallets = [];
    state.wallets.push({ id, name, symbol, color });
    
    if(!state.balances) state.balances = {};
    state.balances[id] = 0; 
    
    saveDataToCloud('finanzas', { wallets: state.wallets, balances: state.balances }); 
    window.closeWalletModal(); 
    window.renderWallets(); 
    window.renderBalances();
};

window.deleteWallet = (id) => {
    if(id === 'bs') return alert("⚠️ La cartera base de Bolívares no puede ser eliminada.");
    if(confirm("¿Seguro? Los gastos mantendrán su historial.")) {
        state.wallets = state.wallets.filter(w => w.id !== id);
        saveDataToCloud('finanzas', { wallets: state.wallets }); 
        window.renderWallets(); 
        window.renderExpenses(); 
    }
};

window.renderWallets = () => {
    if(!isUnlocked) return;
    const container = document.getElementById('walletsContainer'); 
    if(!container) return;
    
    container.innerHTML = '';
    (state.wallets || []).forEach(w => {
        const isBs = w.id === 'bs';
        const equivDiv = isBs ? `<div id="bsEquiv" style="font-size: 0.85em; color: #8ba4b5; margin-top: 5px;">≈ Sincroniza tasas</div>` : '';
        const deleteBtn = !isBs ? `<button onclick="deleteWallet('${w.id}')" style="background:transparent; color:#ff4d4d; border:none; padding:0; font-size:1.2em; cursor:pointer;">🗑️</button>` : '';

        const card = document.createElement('div'); card.className = 'balance-card';
        card.style.background = '#111a28'; card.style.border = `1px solid rgba(255,255,255,0.1)`; card.style.borderTop = `3px solid ${w.color}`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;"><span class="b-title" style="color:#fff;">${w.name}</span>${deleteBtn}</div>
            <span class="b-amount" id="bal-${w.id}" style="color:${w.color};">${w.symbol} ${parseFloat(state.balances[w.id] || 0).toFixed(2)}</span>${equivDiv}
            <button class="b-btn" onclick="updateBalance('${w.id}', '${w.name}')" style="background:rgba(255,255,255,0.05); color:#8ba4b5;">Actualizar</button>`;
        container.appendChild(card);
    });

    const expAcc = document.getElementById('expAccount');
    if(expAcc) {
        const currentVal = expAcc.value; 
        expAcc.innerHTML = '<option value="" disabled selected>-- Elige cuenta --</option>';
        state.wallets.forEach(w => expAcc.innerHTML += `<option value="${w.id}">${w.name}</option>`);
        if(currentVal) expAcc.value = currentVal;
    }
};

// --- ASISTENTE DE VOZ ---
let recognition = null, isListening = false;
function initVoiceEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition(); recognition.lang = 'es-VE'; recognition.interimResults = false;
        recognition.onresult = (event) => { processVoiceNLP(event.results[0][0].transcript); stopVoiceUI(); };
        recognition.onerror = () => { stopVoiceUI(); }; 
        recognition.onend = () => stopVoiceUI();
    } else { 
        const btn = document.getElementById('btnVoiceRecord');
        if(btn) btn.style.display = 'none'; 
    }
}

window.toggleVoiceRecognition = () => {
    if(!recognition) initVoiceEngine(); if(!recognition) return;
    if (isListening) { recognition.stop(); stopVoiceUI(); } 
    else {
                try {
            recognition.start(); isListening = true;
            const btn = document.getElementById('btnVoiceRecord'); 
            if(btn) btn.classList.add('listening');
            const icon = document.getElementById('voiceIcon');
            const text = document.getElementById('voiceText');
            if(icon) icon.innerText = '🔴'; 
            if(text) text.innerText = 'Escuchando...';
        } catch(_) { console.error("Error voz"); }
    }
};

function stopVoiceUI() {
    isListening = false;
    const btn = document.getElementById('btnVoiceRecord');
    if(btn) { 
        btn.classList.remove('listening'); 
        const icon = document.getElementById('voiceIcon');
        const text = document.getElementById('voiceText');
        if(icon) icon.innerText = '🎙️'; 
        if(text) text.innerText = 'Tocar para hablar'; 
    }
}

function processVoiceNLP(text) {
    text = text.toLowerCase();
    let amountMatch = text.match(/\d+([.,]\d+)?/);
    let amount = amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0;
    if(amount <= 0) return alert("No pude identificar un monto válido.");

    let matchedWalletId = null, matchedWalletName = '';
    for (let w of state.wallets) { 
        if (text.includes(w.name.toLowerCase())) { 
            matchedWalletId = w.id; 
            matchedWalletName = w.name; 
            break; 
        } 
    }
    
    if (!matchedWalletId) {
        if(text.includes('bolivar') || text.includes('bs')) matchedWalletId = 'bs';
        else matchedWalletId = state.wallets[0].id;
        matchedWalletName = state.wallets.find(w => w.id === matchedWalletId).name;
    }

    let desc = text.replace(amountMatch[0], '').replace(new RegExp(matchedWalletName, 'ig'), '').replace(/(gasté|pagué|compré|en|de|la|cartera|cuenta|por)/ig, ' ').replace(/\s+/g, ' ').trim();
    if(desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1); else desc = "Gasto rápido (Voz)";

    document.getElementById('vcAmount').innerText = `- $${amount}`; 
    document.getElementById('vcDesc').innerText = desc;
    document.getElementById('vcWallet').innerText = matchedWalletName.toUpperCase(); 
    document.getElementById('vcWalletId').value = matchedWalletId;
    document.getElementById('voiceConfirmModal').classList.remove('vault-hidden');
}

// --- RENDERIZADO Y LOGICA DE GASTOS ---
window.renderExpenses = () => { 
    const list = document.getElementById('expenseList'); 
    if (!list) return; 
    list.innerHTML = ''; 
    
    const fText = document.getElementById('filterText')?.value.toLowerCase() || '';
    const fAcc = document.getElementById('filterAccount')?.value || 'all';
    
    let filtered = (state.expenses || []).map((exp, originalIndex) => ({...exp, originalIndex})); 
    if(fText !== '') filtered = filtered.filter(e => e.desc.toLowerCase().includes(fText));
    if(fAcc !== 'all') filtered = filtered.filter(e => e.account === fAcc); 
    
    let chartSums = {}; 
    (state.wallets || []).forEach(w => chartSums[w.id] = 0);

    [...filtered].reverse().forEach((exp) => { 
        if(chartSums[exp.account] !== undefined) chartSums[exp.account] += parseFloat(exp.amount);
        else chartSums[exp.account] = parseFloat(exp.amount);

        const walletInfo = state.wallets.find(w => w.id === exp.account) || { name: 'Eliminada', symbol: '¤', color: '#444' };
        const li = document.createElement('li'); 
        li.className = 'expense-item'; 
        li.style.borderLeft = `4px solid ${walletInfo.color}`;
        li.innerHTML = `
            <div style="flex-grow: 1;">
                <strong style="color:white;">${exp.desc}</strong><br>
                <span style="font-size:0.8em; color:#8ba4b5;">📅 ${exp.date} | 🏦 ${walletInfo.name.toUpperCase()}</span>
            </div>
            <span class="expense-amount" style="color:#ff4d4d; font-weight:bold;">-${walletInfo.symbol}${parseFloat(exp.amount).toFixed(2)}</span>
        `;
        list.appendChild(li); 
    }); 
    
    window.updateFinanceChart(chartSums);
};

window.updateFinanceChart = (chartSums) => {
    const canvas = document.getElementById('financeChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if(financeChartInstance) { financeChartInstance.destroy(); }
    
    const labels = state.wallets.map(w => w.name);
    const data = state.wallets.map(w => chartSums[w.id] || 0);
    const colors = state.wallets.map(w => w.color);

    financeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8ba4b5' } } }
        }
    });
};

window.updateBalance = (accKey, accName) => { 
    const input = prompt(`Ingresa saldo real en ${accName}: (Ej: 100.50)`); 
    if (input !== null && !isNaN(parseFloat(input))) { 
        state.balances[accKey] = parseFloat(input); 
        recordActivity(); 
        saveDataToCloud('finanzas', { balances: state.balances }); 
        window.renderBalances(); 
    } 
};

function executeExpense(desc, amount, account) {
    const numAmount = parseFloat(amount); 
    if(!state.balances[account]) state.balances[account] = 0;
    state.balances[account] -= numAmount; 
    
    if(!state.expenses) state.expenses = [];
    state.expenses.push({ 
        desc, 
        amount: numAmount, 
        account, 
        date: new Date().toLocaleDateString('es-VE') 
    }); 
    
    recordActivity(); 
    saveDataToCloud('finanzas', { expenses: state.expenses, balances: state.balances }); 
    window.renderExpenses(); 
    window.renderBalances();
}

window.addExpense = () => { 
    const desc = document.getElementById('expDesc').value;
    const amount = document.getElementById('expAmount').value;
    const account = document.getElementById('expAccount').value; 
    
    if (desc.trim() === '' || amount === '' || !account) return alert("Llena todos los campos."); 
    executeExpense(desc, amount, account);
    
    document.getElementById('expDesc').value = '';
    document.getElementById('expAmount').value = '';
};

window.renderBalances = () => { 
    if(!isUnlocked) return; 
    (state.wallets || []).forEach(w => { 
        const el = document.getElementById(`bal-${w.id}`); 
        if(el) el.innerText = `${w.symbol} ${parseFloat(state.balances[w.id] || 0).toFixed(2)}`; 
    }); 
};

window.fetchExchangeRates = async () => {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        window.rateBcvVal = data.promedio || 0;
        const bcvEl = document.getElementById('rateBcv');
        if(bcvEl) bcvEl.innerText = `Bs. ${parseFloat(window.rateBcvVal).toFixed(2)}`;
        window.renderBalances();
        } catch(_) { console.warn("Error tasas"); }
};

// --- INICIALIZACIÓN ---
export function init() {
    if(!isUnlocked) return;
    initVoiceEngine(); 
    window.renderWallets(); 
    window.renderBalances(); 
    window.renderExpenses();
}

// Escucha de cambios de estado global
window.addEventListener('stateChanged', () => { 
    const view = document.getElementById('view-finanzas');
    if(view) {
        if(isUnlocked) {
            init();
        } else {
            // Aseguramos que la UI de bloqueo esté visible si no se ha desbloqueado
            const overlay = document.getElementById('vaultOverlay');
            const content = document.getElementById('vaultContent');
            if(overlay) overlay.classList.remove('vault-hidden');
            if(content) content.classList.add('vault-hidden');
        }
    }
});

// Listener de eventos para botones (Blindaje anti-CSP)
document.addEventListener('click', (e) => {
    if(e.target && e.target.id === 'btnUnlockVault') {
        window.unlockVault();
    }
});