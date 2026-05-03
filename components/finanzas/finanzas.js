import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// --- CORE ---
window.rateBcvVal = window.rateBcvVal || 0; 
window.rateBinanceVal = window.rateBinanceVal || 0; 
window.rateEuroVal = window.rateEuroVal || 0;
let financeChartInstance = null;
let isUnlocked = false;
window.currentSmartFilter = null; // Guarda el estado del filtro de fechas avanzado

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

window.changePin = () => {
    const newPin = prompt("🔑 Ingresa tu nuevo PIN de seguridad:");
    if(newPin && newPin.trim().length > 0) { state.masterPin = newPin.trim(); saveDataToCloud(); alert("✅ PIN actualizado."); }
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
    saveDataToCloud(); window.closeWalletModal(); window.renderWallets(); window.renderBalances();
};

window.deleteWallet = (id) => {
    if(id === 'bs') return alert("⚠️ La cartera base de Bolívares no puede ser eliminada.");
    if(confirm("¿Seguro? Los gastos mantendrán su historial.")) {
        state.wallets = state.wallets.filter(w => w.id !== id);
        saveDataToCloud(); window.renderWallets(); window.renderExpenses(); 
    }
};

window.renderWallets = () => {
    if(!isUnlocked) return;
    const container = document.getElementById('walletsContainer'); if(!container) return;
    container.innerHTML = '';
    state.wallets.forEach(w => {
        const isBs = w.id === 'bs';
        const equivDiv = isBs ? `<div id="bsEquiv" style="font-size: 0.85em; color: #8ba4b5; margin-top: 5px;">≈ Sincroniza tasas</div>` : '';
        const deleteBtn = !isBs ? `<button onclick="deleteWallet('${w.id}')" style="background:transparent; color:#ff4d4d; border:none; padding:0; font-size:1.2em; cursor:pointer;">🗑️</button>` : '';

        const card = document.createElement('div'); card.className = 'balance-card';
        card.style.background = '#111a28'; card.style.border = `1px solid rgba(255,255,255,0.1)`; card.style.borderTop = `3px solid ${w.color}`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;"><span class="b-title" style="color:#fff;">${w.name}</span>${deleteBtn}</div>
            <span class="b-amount" id="bal-${w.id}" style="color:${w.color};">${w.symbol} 0.00</span>${equivDiv}
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

// --- ASISTENTE DE VOZ (Web Speech API) ---
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


// --- FILTRO INTELIGENTE (SMART FILTER) ---

window.toggleSmartFilter = () => {
    const panel = document.getElementById('smartFilterPanel');
    if(panel.classList.contains('active')) {
        panel.classList.remove('active');
    } else {
        window.buildSmartFilterUI();
        panel.classList.add('active');
    }
};

window.toggleSfMonth = (headerElement, contentId) => {
    headerElement.classList.toggle('open');
    document.getElementById(contentId).classList.toggle('open');
};

window.buildSmartFilterUI = () => {
    const container = document.getElementById('smartFilterPanel');
    const now = new Date(); // Abril 2026 en este caso
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    let html = '';
    
    // Retrocedemos desde el mes actual hasta enero
    for(let m = currentMonth; m >= 0; m--) {
        const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
        // Cortafuegos: Si es el mes actual, el máximo día permitido es HOY. Si es pasado, todo el mes.
        const maxDay = (m === currentMonth) ? currentDate : daysInMonth;

        const startMonth = `${currentYear}-${String(m+1).padStart(2,'0')}-01`;
        const endMonth = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(maxDay).padStart(2,'0')}`;

        html += `
        <div class="sf-month-group">
            <div class="sf-month-header" onclick="window.toggleSfMonth(this, 'sf-weeks-${m}')">
                <span>📅 ${monthNames[m]} ${currentYear}</span>
                <button class="sf-apply-month-btn" onclick="applySmartFilter('${startMonth}', '${endMonth}', 'Todo ${monthNames[m]}'); event.stopPropagation();">Seleccionar Mes</button>
            </div>
            <div id="sf-weeks-${m}" class="sf-weeks-container">
        `;

        const weeks = [
            { name: 'Semana 1', start: 1, end: 7 },
            { name: 'Semana 2', start: 8, end: 14 },
            { name: 'Semana 3', start: 15, end: 21 },
            { name: 'Semana 4', start: 22, end: 28 },
            { name: 'Semana 5', start: 29, end: daysInMonth }
        ];

        weeks.forEach(w => {
            // Solo dibujar la semana si su inicio es menor o igual al día límite
            if(w.start <= maxDay) {
                // Si la semana pasa de hoy, cortarla en hoy
                const wEnd = Math.min(w.end, maxDay); 
                const sDate = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(w.start).padStart(2,'0')}`;
                const eDate = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(wEnd).padStart(2,'0')}`;

                html += `
                    <div class="sf-week-item" onclick="applySmartFilter('${sDate}', '${eDate}', '${w.name} de ${monthNames[m]}')">
                        <span>↳ ${w.name}</span> <span style="font-size:0.85em; opacity:0.6;">(Día ${w.start} al ${wEnd})</span>
                    </div>
                `;
            }
        });
        html += `</div></div>`;
    }
    container.innerHTML = html;
};

window.applySmartFilter = (startStr, endStr, labelText) => {
    window.currentSmartFilter = { start: startStr, end: endStr };
    
    // UI Update
    document.getElementById('smartFilterPanel').classList.remove('active');
    document.getElementById('activeSmartFilterLabel').style.display = 'block';
    document.getElementById('sfLabelText').innerText = labelText;
    
    // Forzar actualización de gráfico y lista
    window.renderExpenses();
};

window.clearSmartFilter = () => {
    window.currentSmartFilter = null;
    document.getElementById('activeSmartFilterLabel').style.display = 'none';
    window.renderExpenses();
};

// --- RENDERIZADO DE GASTOS Y GRÁFICO ---
window.rebuildChart = () => { window.renderExpenses(); };
window.applyFilters = () => { window.renderExpenses(); }; 
window.clearFilters = () => { 
    if(document.getElementById('filterText')) document.getElementById('filterText').value = '';
    if(document.getElementById('filterAccount')) document.getElementById('filterAccount').value = 'all'; 
    window.clearSmartFilter(); // Limpia también el filtro inteligente
};

function parseVeDate(dateStr) { 
    if(!dateStr) return new Date(0); 
    const parts = dateStr.split(',')[0].trim().split('/'); 
    if(parts.length === 3) return new Date(parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0') + 'T00:00:00'); 
    return new Date(dateStr); 
}
function getLocalYMD(dateObj) {
    if (isNaN(dateObj)) return "";
    return dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
}

window.renderExpenses = () => { 
    const list = document.getElementById('expenseList'); if (!list) return; list.innerHTML = ''; 
    const fText = document.getElementById('filterText')?.value.toLowerCase() || '';
    const fAcc = document.getElementById('filterAccount')?.value || 'all';
    
    let filtered = state.expenses.map((exp, originalIndex) => ({...exp, originalIndex})); 
    
    // 1. Filtros Básicos
    if(fText !== '') filtered = filtered.filter(e => e.desc.toLowerCase().includes(fText));
    if(fAcc !== 'all') filtered = filtered.filter(e => e.account === fAcc); 
    
    // 2. Filtro Inteligente de Fechas
    if(window.currentSmartFilter) {
        filtered = filtered.filter(e => {
            const dYMD = getLocalYMD(parseVeDate(e.date));
            return dYMD >= window.currentSmartFilter.start && dYMD <= window.currentSmartFilter.end;
        });
    }
    
    let chartSums = {}; state.wallets.forEach(w => chartSums[w.id] = 0);

    [...filtered].reverse().forEach((exp) => { 
        if(chartSums[exp.account] !== undefined) chartSums[exp.account] += parseFloat(exp.amount);
        else chartSums[exp.account] = parseFloat(exp.amount);

        const walletInfo = state.wallets.find(w => w.id === exp.account) || { name: 'Eliminada', symbol: '¤', color: '#444' };
        const li = document.createElement('li'); li.className = 'expense-item'; li.style.borderLeftColor = walletInfo.color; 
        li.style.background = '#111a28'; li.style.borderTop = '1px solid #1a273a'; li.style.borderRight = '1px solid #1a273a'; li.style.borderBottom = '1px solid #1a273a';
        
        let equivHtml = ''; 
        if (exp.account === 'bs' && (exp.eqUsd || exp.eqUsdt || exp.eqEur)) { 
            equivHtml = `<br><span style="font-size: 0.75em; color: #8ba4b5;">≈ $${(exp.eqUsd||0).toFixed(2)} BCV | ₮${(exp.eqUsdt||0).toFixed(2)} BIN | €${(exp.eqEur||0).toFixed(2)} EUR</span>`; 
        } 
        
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong style="color:white;">${exp.desc}</strong><br><span class="task-date" style="color:#8ba4b5;">📅 ${exp.date} | 🏦 ${walletInfo.name.toUpperCase()}</span>${equivHtml}`; 
        
        const amountSpan = document.createElement('span'); amountSpan.className = 'expense-amount'; 
        amountSpan.innerText = `-${walletInfo.symbol}${parseFloat(exp.amount).toFixed(2)}`; amountSpan.style.color = '#ff4d4d';
        
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'Deshacer'; 
        deleteBtn.style.background = '#1a273a'; deleteBtn.style.color = '#8ba4b5'; deleteBtn.style.padding = '5px 10px'; deleteBtn.style.marginLeft = '15px'; deleteBtn.style.fontSize = '0.8em'; deleteBtn.style.border = 'none'; deleteBtn.style.borderRadius = '4px';
        deleteBtn.onclick = () => { 
            if(confirm("¿Devolver gasto al saldo?")) { 
                if(state.balances[exp.account] !== undefined) state.balances[exp.account] += parseFloat(exp.amount); 
                state.expenses.splice(exp.originalIndex, 1); saveDataToCloud(); window.renderExpenses(); window.renderBalances(); 
            } 
        }; 
        li.append(contentDiv, amountSpan, deleteBtn); list.appendChild(li); 
    }); 
    if(filtered.length === 0) list.innerHTML = '<li style="justify-content:center; color:#8ba4b5; background: transparent; border:none;">No hay movimientos en este periodo.</li>'; 
    window.updateFinanceChart(chartSums);
};

window.updateFinanceChart = (chartSums) => {
    const canvas = document.getElementById('financeChart'); if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const type = document.getElementById('advChartType')?.value || 'bar';
    const theme = document.getElementById('advChartTheme')?.value || 'neon';
    const showLegend = document.getElementById('advChartLegend')?.checked;
    const showGrid = document.getElementById('advChartGrid')?.checked;
    
    if(financeChartInstance) { financeChartInstance.destroy(); financeChartInstance = null; }
    let labels = []; let dataSets = []; let bgColors = []; let borderColors = []; let totalDataSum = 0;

    const palettes = {
        neon: ['#00d2ff', '#ff4d4d', '#39ff14', '#fbc02d', '#b100e8'],
        pastel: ['#a8e6cf', '#ff8b94', '#dcedc1', '#ffd3b6', '#ffaaa5'],
        monochrome: ['#1a365d', '#2b6cb0', '#4299e1', '#63b3ed', '#bee3f8']
    };
    const currentPalette = palettes[theme];

    state.wallets.forEach((w, index) => {
        labels.push(`${w.name} (${w.symbol})`);
        const val = chartSums[w.id] || 0;
        dataSets.push(val); totalDataSum += val;
        let colorBase = theme !== 'neon' ? currentPalette[index % currentPalette.length] : w.color;
        const grad = ctx.createLinearGradient(0, 0, 0, 400); 
        grad.addColorStop(0, colorBase); 
        grad.addColorStop(1, type === 'bar' || type === 'polarArea' ? 'rgba(0,0,0,0.5)' : colorBase);
        bgColors.push(grad); borderColors.push(colorBase);
    });

    const hasData = totalDataSum > 0;
    financeChartInstance = new Chart(ctx, { 
        type: type, 
        data: { 
            labels: labels, 
            datasets: [{ 
                label: 'Distribución de Capital',
                data: hasData ? dataSets : labels.map(() => 0.1), 
                backgroundColor: hasData ? bgColors : labels.map(() => '#1a273a'), 
                borderColor: hasData ? borderColors : labels.map(() => '#2d3446'),
                borderWidth: type === 'bar' ? 0 : 2, borderRadius: type === 'bar' ? 4 : 0,
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: true, 
            plugins: { legend: { display: showLegend, position: 'bottom', labels: { color: '#8ba4b5', font: { family: 'system-ui' } } }, tooltip: { enabled: hasData, backgroundColor: 'rgba(10, 15, 24, 0.9)', titleColor: '#00d2ff', padding: 10, cornerRadius: 8 } },
            scales: (type === 'bar' || type === 'line') ? { y: { beginAtZero: true, grid: { color: showGrid ? '#1a273a' : 'transparent' }, ticks: { color: '#8ba4b5' } }, x: { grid: { display: false }, ticks: { color: '#8ba4b5' } } } : (type === 'polarArea' ? { r: { grid: { color: showGrid ? '#1a273a' : 'transparent'}, ticks: { display: false } } } : {})
        } 
    }); 
};

// --- DATA HUNTER (Resto de operaciones) ---
window.updateBalance = (accKey, accName) => { 
    const input = prompt(`Ingresa tu saldo actual real en ${accName}: (Usa punto para decimales)`); 
    if (input !== null && !isNaN(input)) { state.balances[accKey] = parseFloat(input); recordActivity(); saveDataToCloud(); window.renderBalances(); } 
};

function executeExpense(desc, amount, account) {
    const numAmount = parseFloat(amount); 
    if (numAmount > state.balances[account] && !confirm('Gasto mayor al saldo disponible. ¿Continuar?')) return; 
    state.balances[account] -= numAmount; 
    let eqUsd = null, eqUsdt = null, eqEur = null; 
    if (account === 'bs') { 
        if (window.rateBcvVal > 0) eqUsd = numAmount / window.rateBcvVal; 
        if (window.rateBinanceVal > 0) eqUsdt = numAmount / window.rateBinanceVal; 
        if (window.rateEuroVal > 0) eqEur = numAmount / window.rateEuroVal;
    } 
    state.expenses.push({ desc, amount: numAmount, account, date: new Date().toLocaleString('es-VE'), eqUsd, eqUsdt, eqEur }); 
    recordActivity(); saveDataToCloud(); window.renderExpenses(); window.renderBalances();
}

window.addExpense = () => { 
    const desc = document.getElementById('expDesc').value, amount = document.getElementById('expAmount').value, account = document.getElementById('expAccount').value; 
    if (desc.trim() === '' || amount === '' || parseFloat(amount) <= 0 || account === '') return alert("Llena todos los campos."); 
    executeExpense(desc, amount, account);
    document.getElementById('expDesc').value = ''; document.getElementById('expAmount').value = ''; document.getElementById('expAccount').selectedIndex = 0; 
};

window.renderBalances = () => { 
    if(!isUnlocked) return;
    state.wallets.forEach(w => {
        const el = document.getElementById(`bal-${w.id}`); if(el) el.innerText = `${w.symbol} ${parseFloat(state.balances[w.id] || 0).toFixed(2)}`;
    });
    const bsEquiv = document.getElementById('bsEquiv');
    if(bsEquiv) {
        let bs = state.balances['bs'] || 0; let eq = []; 
        if(window.rateBcvVal > 0) eq.push(`🇺🇸 BCV: $${(bs / window.rateBcvVal).toFixed(2)}`); 
        if(window.rateBinanceVal > 0) eq.push(`🟡 BIN: ₮${(bs / window.rateBinanceVal).toFixed(2)}`); 
        if(window.rateEuroVal > 0) eq.push(`🇪🇺 EUR: €${(bs / window.rateEuroVal).toFixed(2)}`); 
        bsEquiv.innerHTML = eq.length > 0 ? eq.join('<br>') : '≈ Sincroniza tasas'; 
    }
};

window.fetchExchangeRates = async (isAutoCall = false) => { 
    const isManualClick = (isAutoCall !== true); const btn = document.getElementById('btnSyncRates'); if(btn) btn.innerText = '📡 Sync...'; 
    try { 
        let bcvVal = 0, binanceVal = 0, euroVal = 0; 
        const fetchWithFallback = async (url) => { try { let res = await fetch(url); if (res.ok) return await res.json(); } catch(e) {} return null; }; 
        const dataBcv = await fetchWithFallback('https://ve.dolarapi.com/v1/dolares/oficial'); if (dataBcv) bcvVal = dataBcv.promedio || dataBcv.venta || 0; 
        const dataEur = await fetchWithFallback('https://ve.dolarapi.com/v1/euros/oficial'); if (dataEur) euroVal = dataEur.promedio || dataEur.venta || 0; 
        
        const binanceSources = [ { url: 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=binance', type: 'direct' }, { url: 'https://api.pydolarvenezuela.com/api/v1/dollar?page=binance', type: 'direct' }, { url: 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://api.pydolarvenezuela.com/api/v1/dollar'), type: 'proxy' } ];
        for (let source of binanceSources) {
            if (binanceVal > 0) break;
            try {
                let res = await fetch(source.url, { cache: "no-store" }); if (!res.ok) continue;
                let data = await res.json(); if (source.type === 'proxy' && data.contents) data = JSON.parse(data.contents);
                let found = null;
                const deepSearch = (obj) => { if (!obj || typeof obj !== 'object') return; for (let k in obj) { if (k.toLowerCase().includes('binance')) { if (obj[k].price) { found = parseFloat(obj[k].price); return; } if (typeof obj[k] === 'number') { found = obj[k]; return; } } if (!found) deepSearch(obj[k]); } };
                deepSearch(data); if (found && found > 20) binanceVal = found;
            } catch (e) {}
        }
        if (binanceVal === 0 && isManualClick) { let manualVal = prompt("⚠️ Ingresa la tasa manual (Ej: 39.50):"); if (manualVal && !isNaN(parseFloat(manualVal.replace(',', '.')))) binanceVal = parseFloat(manualVal.replace(',', '.')); }
        
        window.rateBcvVal = bcvVal > 0 ? bcvVal : window.rateBcvVal; window.rateBinanceVal = binanceVal > 0 ? binanceVal : window.rateBinanceVal; window.rateEuroVal = euroVal > 0 ? euroVal : window.rateEuroVal; 
        
        if(document.getElementById('rateBcv')) {
            document.getElementById('rateBcv').innerText = `Bs. ${parseFloat(window.rateBcvVal).toFixed(2)}`; 
            document.getElementById('rateBinance').innerText = window.rateBinanceVal > 0 ? `Bs. ${parseFloat(window.rateBinanceVal).toFixed(2)}` : '⚠️ Fallo';
            document.getElementById('rateEuro').innerText = `Bs. ${parseFloat(window.rateEuroVal).toFixed(2)}`; 
            document.getElementById('rateLastUpdate').innerText = `Última act: ${new Date().toLocaleTimeString('es-VE')}`; 
            window.renderBalances(); window.renderExpenses(); 
        }
        if(btn) btn.innerText = '📡 Forzar Sincronización'; 
    } catch(err) { if(btn) btn.innerText = '⚠️ Reintentar'; } 
};

window.exportToCSV = () => { 
    if(state.expenses.length === 0) return alert("Vacio."); 
    let csvContent = "Fecha,Descripcion,Metodo,Monto (Original),Equiv USD (BCV),Equiv USDT (Binance),Equiv EUR\n"; 
    const sorted = [...state.expenses].sort((a,b) => parseVeDate(a.date) - parseVeDate(b.date)); 
    sorted.forEach(e => { csvContent += `"${e.date}","${e.desc}","${e.account}","${e.amount}","${(e.eqUsd||0).toFixed(2)}","${(e.eqUsdt||0).toFixed(2)}","${(e.eqEur||0).toFixed(2)}"\n`; }); 
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Reporte_Finanzas.csv"; link.click(); 
};

window.downloadChartPNG = () => { 
    const canvas = document.getElementById('financeChart'); if(!canvas) return;
    const link = document.createElement('a'); link.download = 'Grafico_Finanzas.png'; link.href = canvas.toDataURL('image/png'); link.click(); 
};

export function init() {
    if(!isUnlocked) return;
    if(!state.wallets) { state.wallets = [ { id: 'facebank', name: 'Facebank', symbol: '$', color: '#00d2ff' }, { id: 'binance', name: 'Binance', symbol: '₮', color: '#fbc02d' }, { id: 'bs', name: 'Bolívares', symbol: 'Bs.', color: '#39ff14' } ]; if(!state.balances) state.balances = { facebank: 0, binance: 0, bs: 0 }; saveDataToCloud(); }
    initVoiceEngine(); window.renderWallets(); window.renderBalances(); window.renderExpenses();
    if(window.rateBcvVal === 0 || window.rateBinanceVal === 0) window.fetchExchangeRates(true); 
}
window.addEventListener('stateChanged', () => {
    if(!document.getElementById('view-finanzas')) { if(recognition && isListening) { recognition.stop(); stopVoiceUI(); } }
    else if(isUnlocked) { init(); }
});

// --- BULK INPUT MANAGER ---
let bulkPanel = null;
let parsedBulkRecords = [];

window.toggleBulkInput = () => {
    if(!bulkPanel) {
        // Create bulk panel container
        const container = document.createElement('div');
        container.id = 'bulkPanel';
        container.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            width: 350px; max-height: 400px;
            background: #1a273a; border: 2px solid #ff4d4d;
            border-radius: 12px; padding: 15px;
            box-shadow: 0 8px 32px rgba(255, 77, 77, 0.3);
            z-index: 1000; display: flex; flex-direction: column;
        `;
        
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="color:#ff4d4d; margin:0; font-size:1.2em;">📥 Entrada Masiva</h3>
                <button onclick="toggleBulkInput()" style="background:none; border:none; color:#8ba4b5; cursor:pointer; font-size:1.5em;">×</button>
            </div>
            
            <textarea id="bulkTextarea" placeholder="Ingresa datos en formato: monto - descripcion&#10;&#10;Ejemplo:&#10;15 - Netflix&#10;30 - Spotify&#10;50 - Amazon"
                style="flex:1; min-height:200px; background:#111a28; border:1px solid #2d3446; color:#fff; padding:10px; font-size:0.9em; resize:none; font-family:inherit;"
                oninput="updateBulkPreview()"></textarea>
            
            <div style="margin-top:10px;">
                <label style="color:#8ba4b5; font-size:0.85em; display:block; margin-bottom:5px;">Cartera:</label>
                <select id="bulkWalletSelect" style="width:100%; background:#111a28; border:1px solid #2d3446; color:#fff; padding:8px; font-size:0.9em; border-radius:4px;">
                    ${state.wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                </select>
            </div>
            
            <div style="margin-top:auto; display:flex; gap:10px;">
                <button onclick="processBulkInput()" id="btnPreview"
                    style="flex:1; background:#2d3446; color:#8ba4b5; border:none; padding:10px; font-size:0.9em; cursor:pointer; border-radius:4px;">
                    👁️ Previsualizar
                </button>
                <button onclick="confirmBulkAdd()" id="btnConfirm"
                    style="flex:1; background:#ff4d4d; color:#fff; border:none; padding:10px; font-size:0.9em; cursor:pointer; border-radius:4px;">
                    ✅ Confirmar
                </button>
            </div>
        `;
        
        bulkPanel = container;
        document.body.appendChild(bulkPanel);
    } else {
        // Toggle visibility
        if(bulkPanel.style.display === 'none' || bulkPanel.style.display === '') {
            bulkPanel.style.display = 'flex';
        } else {
            bulkPanel.style.display = 'none';
        }
    }
};

window.updateBulkPreview = () => {
    const textarea = document.getElementById('bulkTextarea');
    if(!textarea) return;
    
    const rawText = textarea.value.trim();
    parsedBulkRecords = [];
    
    if(rawText) {
        // Split by newlines and parse each line
        const lines = rawText.split('\n').filter(l => l.trim());
        
        for(const line of lines) {
            // Match pattern: number - text (case insensitive for the dash)
            const match = line.match(/^([\d,]+)\s*[-–—]\s*(.+)$/);
            
            if(match) {
                let amount = parseFloat(match[1].replace(/,/g, ''));
                let desc = match[2].trim();
                
                // Capitalize first letter of description
                if(desc && desc.length > 0) {
                    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
                } else {
                    desc = "Gasto sin descripción";
                }
                
                parsedBulkRecords.push({ amount, desc });
            }
        }
    }
    
    updatePreviewDisplay();
};

function updatePreviewDisplay() {
    const previewEl = document.getElementById('bulkPreview');
    if(!previewEl) return;
    
    if(parsedBulkRecords.length === 0) {
        previewEl.innerHTML = '<span style="color:#8ba4b5; font-size:0.9em;">Escribe algo para ver la previsualización...</span>';
        document.getElementById('btnPreview').disabled = false;
        document.getElementById('btnConfirm').disabled = true;
    } else {
        previewEl.innerHTML = parsedBulkRecords.map((r, i) => `
            <div style="display:flex; justify-content:space-between; padding:6px 8px; background:#1a273a; margin-bottom:4px; border-radius:4px; font-size:0.9em;">
                <span style="color:#fff;"><strong>${i+1}.</strong> ${r.desc}</span>
                <span style="color:#ff4d4d;">-${r.amount.toFixed(2)}</span>
            </div>`).join('');
        
        document.getElementById('btnPreview').disabled = true;
        document.getElementById('btnConfirm').disabled = false;
    }
};

window.confirmBulkAdd = () => {
    if(parsedBulkRecords.length === 0) return;
    
    const walletId = document.getElementById('bulkWalletSelect')?.value || 'bs';
    const walletName = state.wallets.find(w => w.id === walletId)?.name || 'Bolívares';
    
    // Show confirmation modal
    if(!window.bulkConfirmModal) {
        window.bulkConfirmModal = document.createElement('div');
        window.bulkConfirmModal.id = 'bulkConfirmModal';
        window.bulkConfirmModal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #1a273a; border: 2px solid #ff4d4d; border-radius: 12px;
            padding: 25px; min-width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            z-index: 2000; display: flex; flex-direction: column; align-items: center;
        `;
        
        window.bulkConfirmModal.innerHTML = `
            <h3 style="color:#ff4d4d; margin-bottom:10px;">✅ Confirmar Entrada Masiva</h3>
            <p style="color:#8ba4b5; text-align:center; margin-bottom:20px;">
                ¿Agregar <strong>${parsedBulkRecords.length}</strong> gasto(s) a la cartera de <strong>${walletName.toUpperCase()}</strong>?
            </p>
            <div id="bulkConfirmList" style="width:100%; max-height:200px; overflow-y:auto; background:#111a28; border:1px solid #2d3446; padding:10px; margin-bottom:15px; font-size:0.9em;">
                ${parsedBulkRecords.map((r, i) => `
                    <div style="display:flex; justify-content:space-between; padding:6px 8px; background:#1a273a; margin-bottom:4px; border-radius:4px;">
                        <span style="color:#fff;">${i+1}. ${r.desc}</span>
                        <span style="color:#ff4d4d;">-${r.amount.toFixed(2)}</span>
                    </div>`).join('')}
            </div>
            <button onclick="executeBulkAdd('${walletId}')"
                style="background:#ff4d4d; color:#fff; border:none; padding:10px 30px; font-size:1em; cursor:pointer; border-radius:6px; margin-bottom:10px;">
                ✅ Agregar Todos
            </button>
            <button onclick="window.bulkConfirmModal.remove()"
                style="background:#2d3446; color:#8ba4b5; border:none; padding:10px 30px; font-size:1em; cursor:pointer; border-radius:6px;">
                Cancelar
            </button>
        `;
        
        document.body.appendChild(window.bulkConfirmModal);
    } else {
        // Update modal content with current records and wallet
        const listEl = document.getElementById('bulkConfirmList');
        if(listEl) {
            listEl.innerHTML = parsedBulkRecords.map((r, i) => `
                <div style="display:flex; justify-content:space-between; padding:6px 8px; background:#1a273a; margin-bottom:4px; border-radius:4px;">
                    <span style="color:#fff;">${i+1}. ${r.desc}</span>
                    <span style="color:#ff4d4d;">-${r.amount.toFixed(2)}</span>
                </div>`).join('');
        }
    }
};

window.executeBulkAdd = (walletId) => {
    if(window.bulkConfirmModal) window.bulkConfirmModal.remove();
    
    // Execute each expense one by one using the existing executeExpense function
    let totalAdded = 0;
    for(const record of parsedBulkRecords) {
        try {
            executeExpense(record.desc, record.amount, walletId);
            totalAdded++;
        } catch(e) {
            console.error('Error adding expense:', e);
        }
    }
    
    // Clear textarea and reset
    document.getElementById('bulkTextarea').value = '';
    parsedBulkRecords = [];
    updatePreviewDisplay();
    
    if(totalAdded > 0) {
        alert(`✅ Se agregaron ${totalAdded} gasto(s) correctamente.`);
    } else {
        alert('⚠️ Algunos gastos no se pudieron agregar.');
    }
    
    // Close bulk panel after a short delay
    setTimeout(() => {
        if(bulkPanel && bulkPanel.style.display !== 'none') {
            bulkPanel.style.display = 'none';
        }
    }, 500);
};

// --- BULK INPUT MANAGER ---
