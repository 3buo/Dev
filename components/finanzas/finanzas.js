import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// --- CORE ---
window.rateBcvVal = window.rateBcvVal || 0; 
window.rateBinanceVal = window.rateBinanceVal || 0; 
window.rateEuroVal = window.rateEuroVal || 0;
let financeChartInstance = null;
let isUnlocked = false;
window.currentSmartFilter = null; 

// --- MEJORA: Lógica de desbloqueo reactiva ---
window.unlockVault = () => { 
    const input = document.getElementById('pinInput').value; 
    if (input === state.masterPin) { 
        document.getElementById('vaultOverlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('vaultOverlay').classList.add('vault-hidden'); 
            document.getElementById('vaultContent').classList.remove('vault-hidden'); 
        }, 400); 
        isUnlocked = true;
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]); 
        init();
        if(window.rateBcvVal === 0) window.fetchExchangeRates(true);
    } else { 
        alert("PIN Incorrecto."); 
        document.getElementById('pinInput').value = ''; 
        if(navigator.vibrate) navigator.vibrate(200); 
    } 
};

// --- CORRECCIÓN: Uso de 'masterpin' en minúsculas ---
window.changePin = async () => {
    const newPin = prompt("🔑 Ingresa tu nuevo PIN de seguridad:");
    if(newPin && newPin.trim().length > 0) { 
        const pin = newPin.trim();
        state.masterPin = pin; 
        saveDataToCloud('configuracion', { masterpin: pin }); 
        alert("✅ PIN actualizado."); 
    }
};

// --- WALLET MANAGER ---
window.openWalletModal = () => {
    document.getElementById('newWalletName').value = ''; document.getElementById('newWalletSymbol').value = '';
    document.getElementById('walletModal').classList.remove('vault-hidden');
};
window.closeWalletModal = () => { document.getElementById('walletModal').classList.add('vault-hidden'); };

window.saveNewWallet = () => {
    const name = document.getElementById('newWalletName').value.trim(), symbol = document.getElementById('newWalletSymbol').value.trim(), color = document.getElementById('newWalletColor').value;
    if(!name || !symbol) return alert("Llena el nombre y el símbolo.");
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-4);
    state.wallets.push({ id, name, symbol, color });
    state.balances[id] = 0; 
    saveDataToCloud('finanzas', { wallets: state.wallets, balances: state.balances }); 
    window.closeWalletModal(); window.renderWallets(); window.renderBalances();
};

window.deleteWallet = (id) => {
    if(id === 'bs') return alert("⚠️ La cartera base de Bolívares no puede ser eliminada.");
    if(confirm("¿Seguro? Los gastos mantendrán su historial.")) {
        state.wallets = state.wallets.filter(w => w.id !== id);
        saveDataToCloud('finanzas', { wallets: state.wallets }); 
        window.renderWallets(); window.renderExpenses(); 
    }
};

window.renderWallets = () => {
    if(!isUnlocked) return;
    const container = document.getElementById('walletsContainer'); if(!container) return;
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

    const expAcc = document.getElementById('expAccount'), filtAcc = document.getElementById('filterAccount');
    if(expAcc) {
        const currentVal = expAcc.value; expAcc.innerHTML = '<option value="" disabled selected>-- Elige cuenta --</option>';
        state.wallets.forEach(w => expAcc.innerHTML += `<option value="${w.id}">${w.name}</option>`);
        if(currentVal) expAcc.value = currentVal;
    }
    if(filtAcc) {
        const currentFilt = filtAcc.value; filtAcc.innerHTML = '<option value="all">Todas</option>';
        state.wallets.forEach(w => filtAcc.innerHTML += `<option value="${w.id}">${w.name}</option>`);
        filtAcc.value = currentFilt || 'all';
    }
};

// --- ASISTENTE DE VOZ ---
let recognition = null, isListening = false;
function initVoiceEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition(); recognition.lang = 'es-VE'; recognition.interimResults = false;
        recognition.onresult = (event) => { processVoiceNLP(event.results[0][0].transcript); stopVoiceUI(); };
        recognition.onerror = () => { stopVoiceUI(); }; recognition.onend = () => stopVoiceUI();
    } else { document.getElementById('btnVoiceRecord').style.display = 'none'; }
}

window.toggleVoiceRecognition = () => {
    if(!recognition) initVoiceEngine(); if(!recognition) return;
    if (isListening) { recognition.stop(); stopVoiceUI(); } 
    else {
        recognition.start(); isListening = true;
        const btn = document.getElementById('btnVoiceRecord'); btn.classList.add('listening');
        document.getElementById('voiceIcon').innerText = '🔴'; document.getElementById('voiceText').innerText = 'Escuchando...';
    }
};

function stopVoiceUI() {
    isListening = false;
    const btn = document.getElementById('btnVoiceRecord');
    if(btn) { btn.classList.remove('listening'); document.getElementById('voiceIcon').innerText = '🎙️'; document.getElementById('voiceText').innerText = 'Tocar para hablar'; }
}

function processVoiceNLP(text) {
    text = text.toLowerCase();
    let amountMatch = text.match(/\d+([.,]\d+)?/);
    let amount = amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0;
    if(amount <= 0) return alert("No pude identificar un monto válido.");

    let matchedWalletId = null, matchedWalletName = '';
    for (let w of state.wallets) { if (text.includes(w.name.toLowerCase())) { matchedWalletId = w.id; matchedWalletName = w.name; break; } }
    if (!matchedWalletId) {
        if(text.includes('bolivar') || text.includes('bs')) matchedWalletId = 'bs';
        else matchedWalletId = state.wallets[0].id;
        matchedWalletName = state.wallets.find(w => w.id === matchedWalletId).name;
    }

    let desc = text.replace(amountMatch[0], '').replace(new RegExp(matchedWalletName, 'ig'), '').replace(/(gasté|pagué|compré|en|de|la|cartera|cuenta|por)/ig, ' ').replace(/\s+/g, ' ').trim();
    if(desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1); else desc = "Gasto rápido (Voz)";

    document.getElementById('vcAmount').innerText = `- $${amount}`; document.getElementById('vcDesc').innerText = desc;
    document.getElementById('vcWallet').innerText = matchedWalletName.toUpperCase(); document.getElementById('vcWalletId').value = matchedWalletId;
    document.getElementById('voiceConfirmModal').classList.remove('vault-hidden');
}

window.closeVoiceConfirm = () => { document.getElementById('voiceConfirmModal').classList.add('vault-hidden'); };
window.confirmVoiceExpense = () => {
    const amount = parseFloat(document.getElementById('vcAmount').innerText.replace(/[^0-9.]/g, ''));
    executeExpense(document.getElementById('vcDesc').innerText, amount, document.getElementById('vcWalletId').value);
    closeVoiceConfirm();
};

// --- FILTROS Y RENDERIZADO ---
window.toggleSmartFilter = () => {
    const panel = document.getElementById('smartFilterPanel');
    if(panel.classList.contains('active')) panel.classList.remove('active');
    else { window.buildSmartFilterUI(); panel.classList.add('active'); }
};

window.toggleSfMonth = (headerElement, contentId) => {
    headerElement.classList.toggle('open');
    document.getElementById(contentId).classList.toggle('open');
};

window.buildSmartFilterUI = () => {
    const container = document.getElementById('smartFilterPanel');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    let html = '';
    for(let m = currentMonth; m >= 0; m--) {
        const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
        const maxDay = (m === currentMonth) ? currentDate : daysInMonth;
        const startMonth = `${currentYear}-${String(m+1).padStart(2,'0')}-01`;
        const endMonth = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(maxDay).padStart(2,'0')}`;
        html += `<div class="sf-month-group"><div class="sf-month-header" onclick="window.toggleSfMonth(this, 'sf-weeks-${m}')"><span>📅 ${monthNames[m]} ${currentYear}</span><button class="sf-apply-month-btn" onclick="applySmartFilter('${startMonth}', '${endMonth}', 'Todo ${monthNames[m]}'); event.stopPropagation();">Seleccionar Mes</button></div><div id="sf-weeks-${m}" class="sf-weeks-container">`;
        const weeks = [{ name: 'Semana 1', start: 1, end: 7 }, { name: 'Semana 2', start: 8, end: 14 }, { name: 'Semana 3', start: 15, end: 21 }, { name: 'Semana 4', start: 22, end: 28 }, { name: 'Semana 5', start: 29, end: daysInMonth }];
        weeks.forEach(w => {
            if(w.start <= maxDay) {
                const wEnd = Math.min(w.end, maxDay); 
                const sDate = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(w.start).padStart(2,'0')}`;
                const eDate = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(wEnd).padStart(2,'0')}`;
                html += `<div class="sf-week-item" onclick="applySmartFilter('${sDate}', '${eDate}', '${w.name} de ${monthNames[m]}')"><span>↳ ${w.name}</span> <span style="font-size:0.85em; opacity:0.6;">(Día ${w.start} al ${wEnd})</span></div>`;
            }
        });
        html += `</div></div>`;
    }
    container.innerHTML = html;
};

window.applySmartFilter = (startStr, endStr, labelText) => {
    window.currentSmartFilter = { start: startStr, end: endStr };
    document.getElementById('smartFilterPanel').classList.remove('active');
    document.getElementById('activeSmartFilterLabel').style.display = 'block';
    document.getElementById('sfLabelText').innerText = labelText;
    window.renderExpenses();
};

window.clearSmartFilter = () => {
    window.currentSmartFilter = null;
    document.getElementById('activeSmartFilterLabel').style.display = 'none';
    window.renderExpenses();
};

window.renderExpenses = () => { 
    const list = document.getElementById('expenseList'); if (!list) return; list.innerHTML = ''; 
    const fText = document.getElementById('filterText')?.value.toLowerCase() || '';
    const fAcc = document.getElementById('filterAccount')?.value || 'all';
    
    let filtered = (state.expenses || []).map((exp, originalIndex) => ({...exp, originalIndex})); 
    if(fText !== '') filtered = filtered.filter(e => e.desc.toLowerCase().includes(fText));
    if(fAcc !== 'all') filtered = filtered.filter(e => e.account === fAcc); 
    
    if(window.currentSmartFilter) {
        filtered = filtered.filter(e => {
            const dYMD = e.date.substring(0, 10);
            return dYMD >= window.currentSmartFilter.start && dYMD <= window.currentSmartFilter.end;
        });
    }
    
    let chartSums = {}; (state.wallets || []).forEach(w => chartSums[w.id] = 0);
    [...filtered].reverse().forEach((exp) => { 
        if(chartSums[exp.account] !== undefined) chartSums[exp.account] += parseFloat(exp.amount);
        else chartSums[exp.account] = parseFloat(exp.amount);

        const walletInfo = state.wallets.find(w => w.id === exp.account) || { name: 'Eliminada', symbol: '¤', color: '#444' };
        const li = document.createElement('li'); li.className = 'expense-item'; 
        li.innerHTML = `<strong>${exp.desc}</strong><br><span>📅 ${exp.date} | 🏦 ${walletInfo.name.toUpperCase()}</span><span class="expense-amount" style="color:#ff4d4d">-${walletInfo.symbol}${parseFloat(exp.amount).toFixed(2)}</span>`;
        list.appendChild(li); 
    }); 
    window.updateFinanceChart(chartSums);
};

window.updateFinanceChart = (chartSums) => { /* ... lógica de Chart.js ... */ };

window.updateBalance = (accKey, accName) => { 
    const input = prompt(`Ingresa saldo en ${accName}:`); 
    if (input !== null && !isNaN(input)) { state.balances[accKey] = parseFloat(input); recordActivity(); saveDataToCloud('finanzas', { balances: state.balances }); window.renderBalances(); } 
};

function executeExpense(desc, amount, account) {
    const numAmount = parseFloat(amount); 
    state.balances[account] -= numAmount; 
    state.expenses.push({ desc, amount: numAmount, account, date: new Date().toISOString().slice(0, 10) }); 
    recordActivity(); saveDataToCloud('finanzas', { expenses: state.expenses, balances: state.balances }); window.renderExpenses(); window.renderBalances();
}

window.addExpense = () => { 
    const desc = document.getElementById('expDesc').value, amount = document.getElementById('expAmount').value, account = document.getElementById('expAccount').value; 
    if (desc.trim() === '' || amount === '' || account === '') return alert("Llena campos."); 
    executeExpense(desc, amount, account);
};

window.renderBalances = () => { if(!isUnlocked) return; state.wallets.forEach(w => { const el = document.getElementById(`bal-${w.id}`); if(el) el.innerText = `${w.symbol} ${parseFloat(state.balances[w.id] || 0).toFixed(2)}`; }); };

// --- REACTIVIDAD MEJORADA ---
export function init() {
    if(!isUnlocked) return;
    initVoiceEngine(); window.renderWallets(); window.renderBalances(); window.renderExpenses();
}

window.addEventListener('stateChanged', () => { 
    const view = document.getElementById('view-finanzas');
    if(view) {
        if(isUnlocked) {
            init();
        } else {
            document.getElementById('vaultOverlay').classList.remove('vault-hidden');
            document.getElementById('vaultContent').classList.add('vault-hidden');
        }
    }
});