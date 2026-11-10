import { state, saveDataToCloud, recordActivity } from '../../js/store.js';
import { esc } from '../../js/escape.js';
import { hashPin, verifyPin } from '../../js/pin.js';
import { toast } from '../../js/feedback.js';

// --- TOKENS CSS EN CANVAS (única fuente de color: tokens.css) ---
const cssVar = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
};

// --- CORE ---
window.rateBcvVal = window.rateBcvVal || 0; 
window.rateBinanceVal = window.rateBinanceVal || 0; 
window.rateEuroVal = window.rateEuroVal || 0;
let financeChartInstance = null;
let isUnlocked = false;
window.currentSmartFilter = null; // Guarda el estado del filtro de fechas avanzado

window.unlockVault = async () => { 
    const input = document.getElementById('pinInput').value; 
    const ok = state.pinHash ? await verifyPin(input, state.pinHash) : false; 
    if (ok) { 
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
        toast('PIN Incorrecto.'); 
        document.getElementById('pinInput').value = ''; 
        if(navigator.vibrate) navigator.vibrate(200); 
    } 
};

window.changePin = () => {
    document.getElementById('pinCurrent').value = '';
    document.getElementById('pinNew').value = '';
    document.getElementById('pinChangeModal').classList.remove('vault-hidden');
};
window.closePinChange = () => { document.getElementById('pinChangeModal').classList.add('vault-hidden'); };
window.confirmPinChange = async () => {
    const current = document.getElementById('pinCurrent').value;
    const next = document.getElementById('pinNew').value.trim();
    const isFirstSetup = !state.pinHash;
    if (!isFirstSetup && (!current || !(await verifyPin(current, state.pinHash)))) { toast('PIN actual incorrecto.'); return; }
    if (!/^\d{4,10}$/.test(next)) { toast('PIN inválido: usa 4 a 10 dígitos.'); return; }
    state.pinHash = await hashPin(next);
    delete state.masterPin;
    saveDataToCloud();
    closePinChange();
    toast('✅ PIN actualizado.');
};

// --- WALLET MANAGER ---
window.openWalletModal = () => {
    document.getElementById('newWalletName').value = ''; document.getElementById('newWalletSymbol').value = '';
    document.getElementById('walletModal').classList.remove('vault-hidden');
};
window.closeWalletModal = () => { document.getElementById('walletModal').classList.add('vault-hidden'); };

window.saveNewWallet = () => {
    const name = document.getElementById('newWalletName').value.trim(), symbol = document.getElementById('newWalletSymbol').value.trim(), color = document.getElementById('newWalletColor').value;
    if(!name || !symbol) return toast("Llena el nombre y el símbolo.");
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-4);
    state.wallets.push({ id, name, symbol, color });
    state.balances[id] = 0; 
    saveDataToCloud(); window.closeWalletModal(); window.renderWallets(); window.renderBalances();
};

window.deleteWallet = (id) => {
    if(id === 'bs') return toast("⚠️ La cartera base de Bolívares no puede ser eliminada.");
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
        const equivDiv = isBs ? `<div id="bsEquiv" style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-1);">≈ Sincroniza tasas</div>` : '';
        const deleteBtn = !isBs ? `<button onclick="deleteWallet('${w.id}')" style="background:transparent; color:var(--status-error); border:none; padding:0; font-size:1.2em; cursor:pointer;">🗑️</button>` : '';

        const card = document.createElement('div'); card.className = 'balance-card';
        card.style.background = 'var(--bg-surface)'; card.style.border = `1px solid var(--border-subtle)`; card.style.borderTop = `3px solid ${w.color}`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;"><span class="b-title" style="color:var(--text-primary);">${w.name}</span>${deleteBtn}</div>
            <span class="b-amount" id="bal-${w.id}" style="color:${w.color};">${w.symbol} 0.00</span>${equivDiv}
            <button class="b-btn" onclick="updateBalance('${w.id}', '${w.name}')" style="background:var(--tint-neutral); color:var(--text-secondary);">Actualizar</button>`;
        container.appendChild(card);
    });

const expAcc = document.getElementById('expAccount'), filtAcc = document.getElementById('filterAccount'), bulkW = document.getElementById('bulkWalletSelect');
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
    if(bulkW) {
        const currentBulk = bulkW.value; bulkW.innerHTML = '';
        state.wallets.forEach(w => bulkW.innerHTML += `<option value="${w.id}">${w.name}</option>`);
        bulkW.value = currentBulk || state.wallets[0]?.id;
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
    if(amount <= 0) return toast("No pude identificar un monto válido.");

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
                        <span>↳ ${w.name}</span> <span style="font-size:var(--text-xs); opacity:0.6;">(Día ${w.start} al ${wEnd})</span>
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

        const walletInfo = state.wallets.find(w => w.id === exp.account) || { name: 'Eliminada', symbol: '¤', color: 'var(--border-strong)' };
        const li = document.createElement('li'); li.className = 'expense-item'; li.style.borderLeftColor = walletInfo.color; 
        li.style.background = 'var(--bg-surface)'; li.style.borderTop = '1px solid var(--border-subtle)'; li.style.borderRight = '1px solid var(--border-subtle)'; li.style.borderBottom = '1px solid var(--border-subtle)';
        
        let equivHtml = ''; 
        if (exp.account === 'bs' && (exp.eqUsd || exp.eqUsdt || exp.eqEur)) { 
            equivHtml = `<br><span style="font-size: var(--text-xs); color: var(--text-secondary);">≈ $${(exp.eqUsd||0).toFixed(2)} BCV | ₮${(exp.eqUsdt||0).toFixed(2)} BIN | €${(exp.eqEur||0).toFixed(2)} EUR</span>`; 
        } 
        
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong style="color:var(--text-primary);">${esc(exp.desc)}</strong><br><span class="task-date" style="color:var(--text-secondary);">📅 ${exp.date} | 🏦 ${esc(walletInfo.name.toUpperCase())}</span>${equivHtml}`; 
        
        const amountSpan = document.createElement('span'); amountSpan.className = 'expense-amount'; 
        amountSpan.innerText = `-${walletInfo.symbol}${parseFloat(exp.amount).toFixed(2)}`; amountSpan.style.color = 'var(--status-error)';
        
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'Deshacer'; 
        deleteBtn.style.background = 'var(--bg-surface-raised)'; deleteBtn.style.color = 'var(--text-secondary)'; deleteBtn.style.padding = '5px 10px'; deleteBtn.style.marginLeft = '15px'; deleteBtn.style.fontSize = '0.8em'; deleteBtn.style.border = 'none'; deleteBtn.style.borderRadius = '4px';
        deleteBtn.onclick = () => { 
            if(confirm("¿Devolver gasto al saldo?")) { 
                if(state.balances[exp.account] !== undefined) state.balances[exp.account] += parseFloat(exp.amount); 
                state.expenses.splice(exp.originalIndex, 1); saveDataToCloud(); window.renderExpenses(); window.renderBalances(); 
            } 
        }; 
        li.append(contentDiv, amountSpan, deleteBtn); list.appendChild(li); 
    }); 
    if(filtered.length === 0) list.innerHTML = '<li style="justify-content:center; color:var(--text-secondary); background: transparent; border:none;">No hay movimientos en este periodo.</li>'; 
    window.updateFinanceChart(chartSums);
    window.renderInsights();
};

// --- INSIGHTS (DESIGN_SPEC.md §5.2) — render puro, no cambia el modelo de datos ---
window.renderInsights = () => {
    const grid = document.getElementById('insightsGrid');
    if (!grid) return;
    const expenses = state.expenses || [];
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const monthKey = (d) => {
        const dt = parseVeDate(d);
        if (isNaN(dt)) return '';
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    };
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

    const sumOf = (key) => expenses.reduce((s, e) => s + (monthKey(e.date) === key ? parseFloat(e.amount || 0) : 0), 0);
    const curTotal = sumOf(curKey), prevTotal = sumOf(prevKey);

    let trendHtml;
    if (prevTotal > 0) {
        const pct = ((curTotal - prevTotal) / prevTotal) * 100;
        trendHtml = `<span class="${pct >= 0 ? 'insight-trend-up' : 'insight-trend-down'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%</span> vs ${monthNames[prev.getMonth()]}`;
    } else {
        trendHtml = 'Primer mes con registros';
    }

    const freq = {};
    expenses.forEach(e => { const k = norm(e.desc); if (k) freq[k] = (freq[k] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const byConcept = {};
    expenses.forEach(e => {
        const k = norm(e.desc), mk = monthKey(e.date);
        if (!k || !mk) return;
        byConcept[k] = byConcept[k] || { months: new Set(), total: 0 };
        byConcept[k].months.add(mk);
        byConcept[k].total += parseFloat(e.amount || 0);
    });
    const subs = Object.entries(byConcept).filter(([, v]) => v.months.size >= 2).sort((a, b) => b[1].months.size - a[1].months.size).slice(0, 3);

    grid.innerHTML = `
        <div class="insight-item">
            <div class="insight-label">Gasto de ${monthNames[now.getMonth()]}</div>
            <div class="insight-value">${curTotal.toFixed(2)}</div>
            <div class="insight-sub">${trendHtml}</div>
        </div>
        <div class="insight-item">
            <div class="insight-label">Top conceptos</div>
            ${top.length ? top.map(([k, n]) => `<div class="insight-subscription"><span>${esc(k)}</span><span class="sub-amount">×${n}</span></div>`).join('') : '<div class="insight-sub">Sin movimientos aún</div>'}
        </div>
        <div class="insight-item">
            <div class="insight-label">Suscripciones probables</div>
            ${subs.length ? subs.map(([k, v]) => `<div class="insight-subscription"><span>${esc(k)}</span><span class="sub-amount">${v.months.size} meses</span></div>`).join('') : '<div class="insight-sub">No detectadas (mismo concepto en ≥2 meses)</div>'}
        </div>`;
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

    // Paletas definidas como tokens en tokens.css (DESIGN_SPEC.md §2)
    const paletteNames = { neon: '--chart', pastel: '--chart-pastel', monochrome: '--chart-mono' };
    const base = paletteNames[theme] || '--chart';
    const currentPalette = [1, 2, 3, 4, 5, 6].map(i => cssVar(`${base}-${i}`, '#7c6cf0'));

    const textSecondary = cssVar('--text-secondary', '#a9b3c8');
    const surfaceRaised = cssVar('--bg-surface-raised', '#1c2330');
    const borderStrong = cssVar('--border-strong', '#3d4a61');
    const borderSubtle = cssVar('--border-subtle', '#272f40');
    const bgInset = cssVar('--bg-inset', '#0a0d13');
    const accentSky = cssVar('--accent-sky', '#4cc3ff');
    const chartFade = cssVar('--chart-fade', 'rgba(4,8,18,0.35)');

    state.wallets.forEach((w, index) => {
        labels.push(`${w.name} (${w.symbol})`);
        const val = chartSums[w.id] || 0;
        dataSets.push(val); totalDataSum += val;
        let colorBase = theme !== 'neon' ? currentPalette[index % currentPalette.length] : w.color;
        const grad = ctx.createLinearGradient(0, 0, 0, 400); 
        grad.addColorStop(0, colorBase); 
        grad.addColorStop(1, type === 'bar' || type === 'polarArea' ? chartFade : colorBase);
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
                backgroundColor: hasData ? bgColors : labels.map(() => surfaceRaised), 
                borderColor: hasData ? borderColors : labels.map(() => borderStrong),
                borderWidth: type === 'bar' ? 0 : 2, borderRadius: type === 'bar' ? 4 : 0,
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: true, 
            plugins: { legend: { display: showLegend, position: 'bottom', labels: { color: textSecondary, font: { family: 'Inter, system-ui, sans-serif', size: 12 } } }, tooltip: { enabled: hasData, backgroundColor: bgInset, titleColor: accentSky, padding: 10, cornerRadius: 8 } },
            scales: (type === 'bar' || type === 'line') ? { y: { beginAtZero: true, grid: { color: showGrid ? borderSubtle : 'transparent' }, ticks: { color: textSecondary } }, x: { grid: { display: false }, ticks: { color: textSecondary } } } : (type === 'polarArea' ? { r: { grid: { color: showGrid ? borderSubtle : 'transparent'}, ticks: { display: false } } } : {})
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
    if (desc.trim() === '' || amount === '' || parseFloat(amount) <= 0 || account === '') return toast("Llena todos los campos."); 
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
        const fetchWithFallback = async (url) => { try { let res = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (res.ok) return await res.json(); } catch(e) {} return null; }; 
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
    if(state.expenses.length === 0) return toast("Vacío."); 
    let csvContent = "Fecha,Descripcion,Metodo,Monto (Original),Equiv USD (BCV),Equiv USDT (Binance),Equiv EUR\n"; 
    const sorted = [...state.expenses].sort((a,b) => parseVeDate(a.date) - parseVeDate(b.date)); 
    const csvSafe = (v) => /^[=+\-@\t\r]/.test(String(v)) ? "'" + v : v; // F26: anti inyección de fórmulas
    sorted.forEach(e => { csvContent += `"${e.date}","${csvSafe(e.desc)}","${e.account}","${e.amount}","${(e.eqUsd||0).toFixed(2)}","${(e.eqUsdt||0).toFixed(2)}","${(e.eqEur||0).toFixed(2)}"\n`; }); 
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Reporte_Finanzas.csv"; link.click(); 
};

window.downloadChartPNG = () => { 
    const canvas = document.getElementById('financeChart'); if(!canvas) return;
    const link = document.createElement('a'); link.download = 'Grafico_Finanzas.png'; link.href = canvas.toDataURL('image/png'); link.click(); 
};

export function init() {
    if(!isUnlocked) return;
    if(!state.wallets) {
        // Colores por defecto resueltos desde los tokens CSS (--chart-*)
        const [cSky, cAmber, cGreen] = ['--chart-2', '--chart-4', '--chart-3'].map(n => cssVar(n, '#7c6cf0'));
        state.wallets = [ { id: 'facebank', name: 'Facebank', symbol: '$', color: cSky }, { id: 'binance', name: 'Binance', symbol: '₮', color: cAmber }, { id: 'bs', name: 'Bolívares', symbol: 'Bs.', color: cGreen } ];
        if(!state.balances) state.balances = { facebank: 0, binance: 0, bs: 0 };
        saveDataToCloud();
    }
    // El selector de color de "Nueva Cartera" usa el token de acento como valor por defecto
    const colorPicker = document.getElementById('newWalletColor');
    if (colorPicker) colorPicker.value = cssVar('--accent-sky', '#4cc3ff');
    initVoiceEngine(); window.renderWallets(); window.renderBalances(); window.renderExpenses(); window.renderInsights();
    if(window.rateBcvVal === 0 || window.rateBinanceVal === 0) window.fetchExchangeRates(true); 
}
window.addEventListener('stateChanged', () => {
    if(!document.getElementById('view-finanzas')) { if(recognition && isListening) { recognition.stop(); stopVoiceUI(); } }
    else if(isUnlocked) { init(); }
});

// --- BULK INPUT MANAGER ---
let bulkPanel = null;
let parsedBulkRecords = [];

// Function for bulk-input.html - handles IDs: bulkDataInput, bulkPreview, bulkCount, bulkWalletSelect
window.updateBulkInput = () => {
    const textarea = document.getElementById('bulkDataInput');
    const previewEl = document.getElementById('bulkPreview');
    const countEl = document.getElementById('bulkCount');
    
    if(!textarea || !previewEl) return;
    
    const rawText = textarea.value.trim();
    parsedBulkRecords = [];
    
    if(rawText) {
        const lines = rawText.split('\n').filter(l => l.trim());
        
        for(const line of lines) {
            // Support both regular dash and em-dash
            const match = line.match(/^([\d,]+(\.\d+)?)\s*[-–—]\s*(.+)$/);
            
            if(match) {
                let amount = parseFloat(match[1].replace(/,/g, ''));
                let desc = match[3].trim();
                
                if(desc && desc.length > 0) {
                    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
                } else {
                    desc = "Gasto sin descripción";
                }
                
                if(!isNaN(amount) && amount > 0) {
                    parsedBulkRecords.push({ amount, desc });
                }
            }
        }
    }
    
    // Update the preview display
    if(parsedBulkRecords.length === 0) {
        previewEl.innerHTML = '<span style="color:var(--text-secondary); font-size:var(--text-sm);">Escribe en formato: monto - descripcion</span>';
        if(countEl) countEl.innerText = '0 registros listos para agregar';
    } else {
        previewEl.innerHTML = parsedBulkRecords.map((r, i) => `
            <div style="display:flex; justify-content:space-between; padding:var(--space-2) 8px; background:var(--bg-surface-raised); margin-bottom:4px; border-radius:var(--radius-sm); font-size:var(--text-sm);">
                <span style="color:var(--text-primary);"><strong>${i+1}.</strong> ${r.desc}</span>
                <span style="color:var(--status-error);">-${r.amount.toFixed(2)}</span>
            </div>`).join('');
        if(countEl) countEl.innerText = `${parsedBulkRecords.length} registro(s) listo(s) para agregar`;
    }
};

window.closeBulkConfirmModal = () => {
    const modal = document.getElementById('bulkConfirmModal');
    if(modal) modal.style.display = 'none';
};

window.toggleBulkInput = () => {
    const panel = document.getElementById('bulkPanel');
    if(!panel) return;
    
    // Toggle visibility
    if(panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
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
    
    const btnPreview = document.getElementById('btnPreview');
    const btnConfirm = document.getElementById('btnBulkConfirm');
    
    if(parsedBulkRecords.length === 0) {
        previewEl.innerHTML = '<span style="color:var(--text-secondary); font-size:var(--text-sm);">Escribe algo para ver la previsualización...</span>';
        if(btnPreview) { btnPreview.disabled = false; btnPreview.style.opacity = '0.5'; }
        if(btnConfirm) { btnConfirm.disabled = true; btnConfirm.style.opacity = '0.5'; }
    } else {
        previewEl.innerHTML = parsedBulkRecords.map((r, i) => `
            <div style="display:flex; justify-content:space-between; padding:var(--space-2) 8px; background:var(--bg-surface-raised); margin-bottom:4px; border-radius:var(--radius-sm); font-size:var(--text-sm);">
                <span style="color:var(--text-primary);"><strong>${i+1}.</strong> ${r.desc}</span>
                <span style="color:var(--status-error);">-${r.amount.toFixed(2)}</span>
            </div>`).join('');
        
        if(btnPreview) { btnPreview.disabled = true; btnPreview.style.opacity = '0.5'; }
        if(btnConfirm) { btnConfirm.disabled = false; btnConfirm.style.opacity = '1'; }
    }
};

window.confirmBulkAdd = () => {
    if(parsedBulkRecords.length === 0) return;
    
    const walletId = document.getElementById('bulkWalletSelect')?.value || 'bs';
    const walletName = state.wallets.find(w => w.id === walletId)?.name || 'Bolívares';
    
    // Show confirmation modal - recreate it each time to ensure fresh data
    window.bulkConfirmModal = document.createElement('div');
    window.bulkConfirmModal.id = 'bulkConfirmModal';
    window.bulkConfirmModal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--bg-surface-raised); border: 2px solid var(--status-error); border-radius: var(--radius-lg);
        padding: var(--space-6); min-width: 320px; box-shadow: 0 8px 32px var(--shadow-color);
        z-index: 2000; display: flex; flex-direction: column; align-items: center;
    `;
    
    window.bulkConfirmModal.innerHTML = `
        <h3 style="color:var(--status-error); margin-bottom:var(--space-3);">✅ Confirmar Entrada Masiva</h3>
        <p style="color:var(--text-secondary); text-align:center; margin-bottom:var(--space-5);">
            ¿Agregar <strong>${parsedBulkRecords.length}</strong> gasto(s) a la cartera de <strong>${walletName.toUpperCase()}</strong>?
        </p>
        <div id="bulkConfirmList" style="width:100%; max-height:400px; overflow-y:auto; background:var(--bg-surface); border:1px solid var(--border-strong); padding:var(--space-3); margin-bottom:var(--space-4); font-size:var(--text-sm);">
            ${parsedBulkRecords.map((r, i) => `
                <div style="display:flex; justify-content:space-between; padding:var(--space-2) 8px; background:var(--bg-surface-raised); margin-bottom:4px; border-radius:var(--radius-sm);">
                    <span style="color:var(--text-primary);">${i+1}. ${r.desc}</span>
                    <span style="color:var(--status-error);">-${r.amount.toFixed(2)}</span>
                </div>`).join('')}
        </div>
        <button onclick="executeBulkAdd('${walletId}')"
            style="background:var(--status-error); color:var(--text-on-accent); border:none; padding:var(--space-3) 30px; font-size:1em; cursor:pointer; border-radius:var(--radius-sm); margin-bottom:var(--space-3);">
            ✅ Agregar Todos
        </button>
        <button onclick="window.bulkConfirmModal.remove()"
            style="background:var(--bg-surface-raised); color:var(--text-secondary); border:none; padding:var(--space-3) 30px; font-size:1em; cursor:pointer; border-radius:var(--radius-sm);">
            Cancelar
        </button>
    `;
    
    document.body.appendChild(window.bulkConfirmModal);
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
    
    // Clear textarea and reset (support both bulkTextarea and bulkDataInput)
    const textarea = document.getElementById('bulkTextarea') || document.getElementById('bulkDataInput');
    if(textarea) textarea.value = '';
    parsedBulkRecords = [];
    
    // Update preview to show empty state (call appropriate update function)
    const previewEl = document.getElementById('bulkPreview');
    if(previewEl) {
        // For bulk-input.html style
        previewEl.innerHTML = '<span style="color:var(--text-secondary); font-size:var(--text-sm);">Escribe en formato: monto - descripcion</span>';
        const countEl = document.getElementById('bulkCount');
        if(countEl) countEl.innerText = '0 registros listos para agregar';
        const btnConfirm = document.getElementById('btnBulkConfirm');
        if(btnConfirm) { btnConfirm.disabled = true; btnConfirm.style.opacity = '0.5'; }
    } else {
        // For inline panel style
        updatePreviewDisplay();
    }
    
    // Then re-enable confirm button for more entries
    const btnConfirm = document.getElementById('btnBulkConfirm') || document.getElementById('btnConfirm');
    const btnPreview = document.getElementById('btnPreview');
    if(btnConfirm) btnConfirm.disabled = false;
    if(btnPreview) btnPreview.disabled = false;
    
    console.log(`executeBulkAdd: Cleared ${parsedBulkRecords.length} records, buttons enabled`);
    
    if(totalAdded > 0) {
        toast(`✅ Se agregaron ${totalAdded} gasto(s) correctamente.`);
    } else {
        toast('⚠️ Algunos gastos no se pudieron agregar.');
    }
    
    // Keep panel open for more entries
    setTimeout(() => {
        if(bulkPanel && bulkPanel.style.display !== 'none') {
            // Panel stays open, buttons already enabled above
        }
    }, 500);
};

// --- BULK INPUT MANAGER ---
