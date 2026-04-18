import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

/* ==========================================================================
   --- CORE Y SEGURIDAD ---
   ========================================================================== */
window.rateBcvVal = window.rateBcvVal || 0; 
window.rateBinanceVal = window.rateBinanceVal || 0; 
window.rateEuroVal = window.rateEuroVal || 0;

let financeChartInstance = null;
let isUnlocked = false;

window.unlockVault = () => { 
    const input = document.getElementById('pinInput').value; 
    if (input === state.masterPin) { 
        document.getElementById('vaultOverlay').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('vaultOverlay').classList.add('vault-hidden'); 
            document.getElementById('vaultContent').classList.remove('vault-hidden'); 
        }, 400); // Transición suave
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
    if(newPin && newPin.trim().length > 0) { 
        state.masterPin = newPin.trim(); 
        saveDataToCloud(); 
        alert("✅ PIN actualizado."); 
    }
};

/* ==========================================================================
   --- GESTOR DE CARTERAS (WALLET MANAGER) ---
   ========================================================================== */
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
    if(id === 'bs') return alert("⚠️ La cartera base de Bolívares no puede ser eliminada por el sistema cambiario.");
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

        const card = document.createElement('div');
        card.className = 'balance-card';
        card.style.background = '#111a28'; card.style.border = `1px solid rgba(255,255,255,0.1)`; card.style.borderTop = `3px solid ${w.color}`;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="b-title" style="color:#fff;">${w.name}</span>
                ${deleteBtn}
            </div>
            <span class="b-amount" id="bal-${w.id}" style="color:${w.color};">${w.symbol} 0.00</span>
            ${equivDiv}
            <button class="b-btn" onclick="updateBalance('${w.id}', '${w.name}')" style="background:rgba(255,255,255,0.05); color:#8ba4b5;">Actualizar</button>
        `;
        container.appendChild(card);
    });

    const expAcc = document.getElementById('expAccount');
    if(expAcc) {
        const currentVal = expAcc.value; expAcc.innerHTML = '<option value="" disabled selected>-- Elige cuenta --</option>';
        state.wallets.forEach(w => expAcc.innerHTML += `<option value="${w.id}">${w.name}</option>`);
        if(currentVal) expAcc.value = currentVal;
    }

    const filtAcc = document.getElementById('filterAccount');
    if(filtAcc) {
        const currentFilt = filtAcc.value; filtAcc.innerHTML = '<option value="all">Todas</option>';
        state.wallets.forEach(w => filtAcc.innerHTML += `<option value="${w.id}">${w.name}</option>`);
        filtAcc.value = currentFilt || 'all';
    }
};

/* ==========================================================================
   --- ASISTENTE DE VOZ MÁGICA (NLP LOCAL) ---
   ========================================================================== */
let recognition = null;
let isListening = false;

// Inicializador de Web Speech API (Gratis y Nativo del Navegador)
function initVoiceEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'es-VE'; // Configurado para entender jerga local
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            processVoiceNLP(transcript);
            stopVoiceUI();
        };
        recognition.onerror = (event) => { stopVoiceUI(); alert("No pude escucharte bien. Error: " + event.error); };
        recognition.onend = () => { stopVoiceUI(); };
    } else {
        document.getElementById('btnVoiceRecord').style.display = 'none';
        console.warn("Speech API no soportada en este navegador.");
    }
}

window.toggleVoiceRecognition = () => {
    if(!recognition) initVoiceEngine();
    if(!recognition) return;

    if (isListening) {
        recognition.stop(); stopVoiceUI();
    } else {
        recognition.start();
        isListening = true;
        const btn = document.getElementById('btnVoiceRecord');
        btn.classList.add('listening');
        document.getElementById('voiceIcon').innerText = '🔴';
        document.getElementById('voiceText').innerText = 'Escuchando...';
    }
};

function stopVoiceUI() {
    isListening = false;
    const btn = document.getElementById('btnVoiceRecord');
    if(btn) {
        btn.classList.remove('listening');
        document.getElementById('voiceIcon').innerText = '🎙️';
        document.getElementById('voiceText').innerText = 'Tocar para hablar';
    }
}

// Motor NLP Local (Procesamiento de Lenguaje Natural Ligero)
function processVoiceNLP(text) {
    text = text.toLowerCase();
    
    // 1. Extraer Monto (Regex para números con comas o puntos)
    let amountMatch = text.match(/\d+([.,]\d+)?/);
    let amount = amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0;
    if(amount <= 0) return alert("Asistente: Escuché '" + text + "', pero no pude identificar un monto válido.");

    // 2. Extraer Cartera
    let matchedWalletId = null;
    let matchedWalletName = '';
    // Iterar carteras y buscar si el usuario mencionó alguna
    for (let w of state.wallets) {
        if (text.includes(w.name.toLowerCase())) {
            matchedWalletId = w.id;
            matchedWalletName = w.name;
            break;
        }
    }
    // Fallback: Si no menciona cuenta, usar la primera (ej. Facebank) o 'bs' si detecta la palabra bolivares
    if (!matchedWalletId) {
        if(text.includes('bolivar') || text.includes('bs') || text.includes('bolívares')) matchedWalletId = 'bs';
        else matchedWalletId = state.wallets[0].id;
        matchedWalletName = state.wallets.find(w => w.id === matchedWalletId).name;
    }

    // 3. Extraer Descripción (Limpiando la frase original)
    let desc = text.replace(amountMatch[0], '') // quitar numero
                   .replace(new RegExp(matchedWalletName, 'ig'), '') // quitar nombre de cuenta
                   .replace(/(gasté|pagué|compré|gaste|pague|compre|usando|con|en|de|la|cartera|cuenta|por|dolares|bolivares)/ig, ' ') // limpiar conectores
                   .replace(/\s+/g, ' ').trim(); // limpiar espacios dobles
    
    // Capitalizar primera letra
    if(desc) desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    else desc = "Gasto rápido (Voz)";

    // 4. Mostrar Confirmación Visual
    document.getElementById('vcAmount').innerText = `- $${amount}`;
    document.getElementById('vcDesc').innerText = desc;
    document.getElementById('vcWallet').innerText = matchedWalletName.toUpperCase();
    document.getElementById('vcWalletId').value = matchedWalletId;
    
    document.getElementById('voiceConfirmModal').classList.remove('vault-hidden');
}

window.closeVoiceConfirm = () => { document.getElementById('voiceConfirmModal').classList.add('vault-hidden'); };

window.confirmVoiceExpense = () => {
    const amountText = document.getElementById('vcAmount').innerText.replace(/[^0-9.]/g, '');
    const amount = parseFloat(amountText);
    const desc = document.getElementById('vcDesc').innerText;
    const account = document.getElementById('vcWalletId').value;
    
    executeExpense(desc, amount, account);
    closeVoiceConfirm();
};


/* ==========================================================================
   --- MOTOR AVANZADO DE GRÁFICOS (Chart.js Engine) ---
   ========================================================================== */
// Función puente para actualizar el gráfico leyendo los nuevos controles UI
window.rebuildChart = () => {
    // Forzamos la re-evaluación y filtrado llamando a renderExpenses, 
    // la cual al final llama a updateFinanceChart() con las sumas correctas.
    window.renderExpenses();
};

window.updateFinanceChart = (chartSums) => {
    const canvas = document.getElementById('financeChart'); 
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Leer Configuración Sheets
    const type = document.getElementById('advChartType')?.value || 'bar';
    const theme = document.getElementById('advChartTheme')?.value || 'neon';
    const showLegend = document.getElementById('advChartLegend')?.checked;
    const showGrid = document.getElementById('advChartGrid')?.checked;
    
    if(financeChartInstance) { financeChartInstance.destroy(); financeChartInstance = null; }

    let labels = []; let dataSets = []; let bgColors = []; let borderColors = [];
    let totalDataSum = 0;

    // Paletas de Color Psicológicas
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
        
        let colorBase = w.color;
        // Si el usuario elige un tema predefinido que no sea su color base, lo sobreescribimos visualmente
        if(theme !== 'neon') colorBase = currentPalette[index % currentPalette.length];

        const grad = ctx.createLinearGradient(0, 0, 0, 400); 
        grad.addColorStop(0, colorBase); 
        grad.addColorStop(1, type === 'bar' || type === 'polarArea' ? 'rgba(0,0,0,0.5)' : colorBase);
        
        bgColors.push(grad);
        borderColors.push(colorBase);
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
                borderWidth: type === 'bar' ? 0 : 2, 
                borderRadius: type === 'bar' ? 4 : 0,
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: true, 
            plugins: { 
                legend: { display: showLegend, position: 'bottom', labels: { color: '#8ba4b5', font: { family: 'system-ui' } } }, 
                tooltip: { enabled: hasData, backgroundColor: 'rgba(10, 15, 24, 0.9)', titleColor: '#00d2ff', padding: 10, cornerRadius: 8 } 
            },
            scales: (type === 'bar' || type === 'line') ? {
                y: { beginAtZero: true, grid: { color: showGrid ? '#1a273a' : 'transparent' }, ticks: { color: '#8ba4b5' } },
                x: { grid: { display: false }, ticks: { color: '#8ba4b5' } }
            } : (type === 'polarArea' ? { r: { grid: { color: showGrid ? '#1a273a' : 'transparent'}, ticks: { display: false } } } : {})
        } 
    }); 
};


/* ==========================================================================
   --- MOTOR DE GASTOS Y FILTROS ---
   ========================================================================== */
window.applyFilters = () => { window.renderExpenses(); }; 
window.clearFilters = () => { 
    if(document.getElementById('filterText')) document.getElementById('filterText').value = '';
    if(document.getElementById('filterDate')) document.getElementById('filterDate').value = ''; 
    if(document.getElementById('filterAccount')) document.getElementById('filterAccount').value = 'all'; 
    window.renderExpenses(); 
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
    const fDate = document.getElementById('filterDate')?.value || '';
    const fAcc = document.getElementById('filterAccount')?.value || 'all';
    
    let filtered = state.expenses.map((exp, originalIndex) => ({...exp, originalIndex})); 
    
    if(fText !== '') filtered = filtered.filter(e => e.desc.toLowerCase().includes(fText));
    if(fAcc !== 'all') filtered = filtered.filter(e => e.account === fAcc); 
    if(fDate) filtered = filtered.filter(e => getLocalYMD(parseVeDate(e.date)) === fDate); 
    
    let chartSums = {}; state.wallets.forEach(w => chartSums[w.id] = 0);

    [...filtered].reverse().forEach((exp) => { 
        if(chartSums[exp.account] !== undefined) chartSums[exp.account] += parseFloat(exp.amount);
        else chartSums[exp.account] = parseFloat(exp.amount);

        const walletInfo = state.wallets.find(w => w.id === exp.account) || { name: 'Eliminada', symbol: '¤', color: '#444' };

        const li = document.createElement('li'); 
        li.className = 'expense-item'; 
        li.style.borderLeftColor = walletInfo.color; 
        li.style.background = '#111a28'; li.style.borderTop = '1px solid #1a273a'; li.style.borderRight = '1px solid #1a273a'; li.style.borderBottom = '1px solid #1a273a';
        
        let equivHtml = ''; 
        if (exp.account === 'bs' && (exp.eqUsd || exp.eqUsdt || exp.eqEur)) { 
            equivHtml = `<br><span style="font-size: 0.75em; color: #8ba4b5;">≈ $${(exp.eqUsd||0).toFixed(2)} BCV | ₮${(exp.eqUsdt||0).toFixed(2)} BIN | €${(exp.eqEur||0).toFixed(2)} EUR</span>`; 
        } 
        
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong style="color:white;">${exp.desc}</strong><br><span class="task-date" style="color:#8ba4b5;">📅 ${exp.date} | 🏦 ${walletInfo.name.toUpperCase()}</span>${equivHtml}`; 
        
        const amountSpan = document.createElement('span'); amountSpan.className = 'expense-amount'; 
        amountSpan.innerText = `-${walletInfo.symbol}${parseFloat(exp.amount).toFixed(2)}`; 
        amountSpan.style.color = '#ff4d4d'; // Color psicológico de gasto
        
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
    
    if(filtered.length === 0) list.innerHTML = '<li style="justify-content:center; color:#8ba4b5; background: transparent; border:none;">No se encontraron movimientos.</li>'; 
    window.updateFinanceChart(chartSums);
};

window.updateBalance = (accKey, accName) => { 
    const input = prompt(`Ingresa tu saldo actual real en ${accName}: (Usa punto para decimales)`); 
    if (input !== null && !isNaN(input)) { 
        state.balances[accKey] = parseFloat(input); recordActivity(); saveDataToCloud(); window.renderBalances(); 
    } 
};

// Función Centralizada de Gasto (Usada por el form manual y por la Voz)
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
        const el = document.getElementById(`bal-${w.id}`);
        if(el) el.innerText = `${w.symbol} ${parseFloat(state.balances[w.id] || 0).toFixed(2)}`;
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

/* ==========================================================================
   --- CAZADOR DE DATOS (EXCHANGE RATES DATA HUNTER) ---
   ========================================================================== */
window.fetchExchangeRates = async (isAutoCall = false) => { 
    const isManualClick = (isAutoCall !== true); 
    const btn = document.getElementById('btnSyncRates'); 
    if(btn) btn.innerText = '📡 Sync...'; 
    
    try { 
        let bcvVal = 0, binanceVal = 0, euroVal = 0; 
        const fetchWithFallback = async (url) => { try { let res = await fetch(url); if (res.ok) return await res.json(); } catch(e) {} return null; }; 
        const dataBcv = await fetchWithFallback('https://ve.dolarapi.com/v1/dolares/oficial'); if (dataBcv) bcvVal = dataBcv.promedio || dataBcv.venta || 0; 
        const dataEur = await fetchWithFallback('https://ve.dolarapi.com/v1/euros/oficial'); if (dataEur) euroVal = dataEur.promedio || dataEur.venta || 0; 
        
        const binanceSources = [
            { url: 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=binance', type: 'direct' },
            { url: 'https://api.pydolarvenezuela.com/api/v1/dollar?page=binance', type: 'direct' },
            { url: 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://api.pydolarvenezuela.com/api/v1/dollar'), type: 'proxy' }
        ];

        for (let source of binanceSources) {
            if (binanceVal > 0) break;
            try {
                let res = await fetch(source.url, { cache: "no-store" }); if (!res.ok) continue;
                let data = await res.json();
                if (source.type === 'proxy' && data.contents) data = JSON.parse(data.contents);

                let found = null;
                const deepSearch = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    for (let k in obj) {
                        if (k.toLowerCase().includes('binance')) {
                            if (obj[k].price) { found = parseFloat(obj[k].price); return; }
                            if (typeof obj[k] === 'number') { found = obj[k]; return; }
                        }
                        if (!found) deepSearch(obj[k]);
                    }
                };
                deepSearch(data);
                if (found && found > 20) binanceVal = found;
            } catch (e) {}
        }

        if (binanceVal === 0 && isManualClick) {
            let manualVal = prompt("⚠️ No se conectó con Binance. Ingresa la tasa manual (Ej: 39.50):");
            if (manualVal && !isNaN(parseFloat(manualVal.replace(',', '.')))) binanceVal = parseFloat(manualVal.replace(',', '.'));
        }
        
        window.rateBcvVal = bcvVal > 0 ? bcvVal : window.rateBcvVal; 
        window.rateBinanceVal = binanceVal > 0 ? binanceVal : window.rateBinanceVal; 
        window.rateEuroVal = euroVal > 0 ? euroVal : window.rateEuroVal; 
        
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
    if(!state.wallets) { // Migración Segura
        state.wallets = [ { id: 'facebank', name: 'Facebank', symbol: '$', color: '#00d2ff' }, { id: 'binance', name: 'Binance', symbol: '₮', color: '#fbc02d' }, { id: 'bs', name: 'Bolívares', symbol: 'Bs.', color: '#39ff14' } ];
        if(!state.balances) state.balances = { facebank: 0, binance: 0, bs: 0 }; saveDataToCloud();
    }
    
    // Iniciar Motor de Voz (Oculto)
    initVoiceEngine();

    window.renderWallets(); window.renderBalances(); window.renderExpenses();
    if(window.rateBcvVal === 0 || window.rateBinanceVal === 0) window.fetchExchangeRates(true); 
}

window.addEventListener('stateChanged', () => { 
    // Si salimos de la pestaña, detenemos el micrófono por privacidad
    if(!document.getElementById('view-finanzas')) {
        if(recognition && isListening) { recognition.stop(); stopVoiceUI(); }
    } else if(isUnlocked) {
        init();
    }
});
