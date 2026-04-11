import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.rateBcvVal = window.rateBcvVal || 0; 
window.rateBinanceVal = window.rateBinanceVal || 0; 
window.rateEuroVal = window.rateEuroVal || 0;

let financeChartInstance = null;
let isUnlocked = false;

window.unlockVault = () => { 
    const input = document.getElementById('pinInput').value; 
    if (input === state.masterPin) { 
        document.getElementById('vaultOverlay').classList.add('vault-hidden'); 
        document.getElementById('vaultContent').classList.remove('vault-hidden'); 
        isUnlocked = true;
        
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]); 
        
        init();
        
        if(window.rateBcvVal === 0) {
            window.fetchExchangeRates();
        }
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

window.applyFilters = () => { window.renderExpenses(); }; 

window.clearFilters = () => { 
    if(document.getElementById('filterText')) document.getElementById('filterText').value = '';
    if(document.getElementById('filterDate')) document.getElementById('filterDate').value = ''; 
    if(document.getElementById('filterStartDate')) document.getElementById('filterStartDate').value = ''; 
    if(document.getElementById('filterEndDate')) document.getElementById('filterEndDate').value = ''; 
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
    const list = document.getElementById('expenseList'); 
    if (!list) return; 
    list.innerHTML = ''; 
    
    const fText = document.getElementById('filterText')?.value.toLowerCase() || '';
    const fDate = document.getElementById('filterDate')?.value || '';
    const fStart = document.getElementById('filterStartDate')?.value || '';
    const fEnd = document.getElementById('filterEndDate')?.value || '';
    const fAcc = document.getElementById('filterAccount')?.value || 'all';
    
    let filtered = state.expenses.map((exp, originalIndex) => ({...exp, originalIndex})); 
    
    if(fText !== '') filtered = filtered.filter(e => e.desc.toLowerCase().includes(fText));
    if(fAcc !== 'all') filtered = filtered.filter(e => e.account === fAcc); 
    
    if(fDate) filtered = filtered.filter(e => getLocalYMD(parseVeDate(e.date)) === fDate); 
    else if (fStart && fEnd) filtered = filtered.filter(e => { 
        const dYMD = getLocalYMD(parseVeDate(e.date)); 
        return dYMD >= fStart && dYMD <= fEnd; 
    }); 
    
    [...filtered].reverse().forEach((exp) => { 
        const li = document.createElement('li'); 
        li.className = 'expense-item ex-' + exp.account; 
        let symbol = exp.account === 'facebank' ? '$' : exp.account === 'binance' ? '₮' : 'Bs.'; 
        let equivHtml = ''; 
        if (exp.account === 'bs' && (exp.eqUsd || exp.eqUsdt || exp.eqEur)) { 
            equivHtml = `<br><span style="font-size: 0.75em; color: var(--secondary); opacity: 0.9;">≈ $${(exp.eqUsd||0).toFixed(2)} BCV | ₮${(exp.eqUsdt||0).toFixed(2)} BIN | €${(exp.eqEur||0).toFixed(2)} EUR</span>`; 
        } 
        const contentDiv = document.createElement('div'); 
        contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong>${exp.desc}</strong><br><span class="task-date">📅 ${exp.date} | 🏦 ${exp.account.toUpperCase()}</span>${equivHtml}`; 
        
        const amountSpan = document.createElement('span'); 
        amountSpan.className = 'expense-amount'; 
        amountSpan.innerText = `-${symbol}${parseFloat(exp.amount).toFixed(2)}`; 
        
        const deleteBtn = document.createElement('button'); 
        deleteBtn.innerText = 'Deshacer'; 
        deleteBtn.style.background = '#444'; 
        deleteBtn.style.padding = '5px 10px'; 
        deleteBtn.style.marginLeft = '15px'; 
        deleteBtn.style.fontSize = '0.8em'; 
        deleteBtn.onclick = () => { 
            if(confirm("¿Devolver gasto al saldo?")) { 
                state.balances[exp.account] += parseFloat(exp.amount); 
                state.expenses.splice(exp.originalIndex, 1); 
                saveDataToCloud(); 
                window.renderExpenses(); 
                window.renderBalances(); 
            } 
        }; 
        li.append(contentDiv, amountSpan, deleteBtn); 
        list.appendChild(li); 
    }); 
    
    if(filtered.length === 0) list.innerHTML = '<li style="justify-content:center; color:#aaa;">No se encontraron gastos.</li>'; 
    
    let sumFb = 0, sumBin = 0, sumBs = 0; 
    filtered.forEach(e => { 
        if(e.account === 'facebank') sumFb += parseFloat(e.amount); 
        if(e.account === 'binance') sumBin += parseFloat(e.amount); 
        if(e.account === 'bs') sumBs += parseFloat(e.amount); 
    }); 
    window.updateFinanceChart(sumFb, sumBin, sumBs);
};

window.updateFinanceChart = (sumFb, sumBin, sumBs) => {
    const canvas = document.getElementById('financeChart'); 
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const type = document.getElementById('chartSettingsType')?.value || 'bar';
    
    if(financeChartInstance) { financeChartInstance.destroy(); financeChartInstance = null; }
    const hasData = (sumFb + sumBin + sumBs) > 0;

    const gFb = ctx.createLinearGradient(0, 0, 0, 400); gFb.addColorStop(0, '#42a5f5'); gFb.addColorStop(1, '#0d47a1');
    const gBin = ctx.createLinearGradient(0, 0, 0, 400); gBin.addColorStop(0, '#fbc02d'); gBin.addColorStop(1, '#f57f17');
    const gBs = ctx.createLinearGradient(0, 0, 0, 400); gBs.addColorStop(0, '#66bb6a'); gBs.addColorStop(1, '#1b5e20');

    financeChartInstance = new Chart(ctx, { 
        type: type, 
        data: { 
            labels: ['Facebank ($)', 'Binance (USDT)', 'Bolívares (Bs)'], 
            datasets: [{ 
                label: 'Gastos Filtrados',
                data: hasData ? [sumFb, sumBin, sumBs] : [0.1, 0.1, 0.1], 
                backgroundColor: hasData ? [gFb, gBin, gBs] : ['#444', '#444', '#444'], 
                borderColor: hasData ? ['#bbdefb', '#fff9c4', '#c8e6c9'] : ['#555', '#555', '#555'],
                borderWidth: type === 'bar' ? 2 : 0, 
                borderRadius: type === 'bar' ? 6 : 0,
                hoverOffset: 6
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: true, 
            plugins: { 
                legend: { display: type !== 'bar', labels: { color: 'white' } }, 
                tooltip: { enabled: hasData } 
            },
            scales: type === 'bar' ? {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#aaa' } },
                x: { grid: { display: false }, ticks: { color: '#aaa' } }
            } : {}
        } 
    }); 
};

window.updateBalance = (accKey, accName) => { 
    const input = prompt(`Ingresa tu pool real en ${accName}: (Usa punto para decimales)`); 
    if (input !== null && !isNaN(input)) { 
        state.balances[accKey] = parseFloat(input); 
        recordActivity(); 
        saveDataToCloud(); 
        window.renderBalances(); 
    } 
};

window.addExpense = () => { 
    const desc = document.getElementById('expDesc').value, 
          amount = document.getElementById('expAmount').value, 
          account = document.getElementById('expAccount').value; 
    
    if (desc.trim() === '' || amount === '' || parseFloat(amount) <= 0 || account === '') return alert("Llena todos los campos."); 
    
    const numAmount = parseFloat(amount); 
    if (numAmount > state.balances[account] && !confirm('Gasto mayor al saldo. ¿Continuar?')) return; 
    
    state.balances[account] -= numAmount; 
    
    let eqUsd = null, eqUsdt = null, eqEur = null; 
    if (account === 'bs') { 
        if (window.rateBcvVal > 0) eqUsd = numAmount / window.rateBcvVal; 
        if (window.rateBinanceVal > 0) eqUsdt = numAmount / window.rateBinanceVal; 
        if (window.rateEuroVal > 0) eqEur = numAmount / window.rateEuroVal;
    } 
    
    state.expenses.push({ 
        desc, 
        amount: numAmount, 
        account, 
        date: new Date().toLocaleString('es-VE'), 
        eqUsd, eqUsdt, eqEur 
    }); 
    
    document.getElementById('expDesc').value = ''; 
    document.getElementById('expAmount').value = ''; 
    document.getElementById('expAccount').selectedIndex = 0; 
    
    recordActivity(); 
    saveDataToCloud(); 
    window.renderExpenses(); 
    window.renderBalances();
};

window.renderBalances = () => { 
    if(!isUnlocked) return;
    const balFacebank = document.getElementById('balFacebank'); 
    if(!balFacebank) return;
    
    balFacebank.innerText = '$' + parseFloat(state.balances.facebank || 0).toFixed(2); 
    document.getElementById('balBinance').innerText = '₮' + parseFloat(state.balances.binance || 0).toFixed(2); 
    document.getElementById('balBs').innerText = 'Bs. ' + parseFloat(state.balances.bs || 0).toFixed(2); 
    
    let bs = state.balances.bs || 0; 
    let eq = []; 
    if(window.rateBcvVal > 0) eq.push(`🇺🇸 BCV: $${(bs / window.rateBcvVal).toFixed(2)}`); 
    if(window.rateBinanceVal > 0) eq.push(`🟡 BIN: ₮${(bs / window.rateBinanceVal).toFixed(2)}`); 
    if(window.rateEuroVal > 0) eq.push(`🇪🇺 EUR: €${(bs / window.rateEuroVal).toFixed(2)}`); 
    
    document.getElementById('bsEquiv').innerHTML = eq.length > 0 ? eq.join('<br>') : '≈ Sincroniza tasas'; 
};

window.fetchExchangeRates = async () => { 
    const btn = document.getElementById('btnSyncRates'); 
    if(btn) btn.innerText = '📡 Sync...'; 
    
    try { 
        let bcvVal = 0, binanceVal = 0, euroVal = 0; 
        
        // 1. Obtener Dolar BCV y Euro a través de DolarAPI (Estable)
        const fetchWithFallback = async (url) => { 
            try { 
                let res = await fetch(url); 
                if (res.ok) return await res.json(); 
            } catch(e) {} 
            return null; 
        }; 
        
        const dataBcv = await fetchWithFallback('https://ve.dolarapi.com/v1/dolares/oficial'); 
        if (dataBcv) bcvVal = dataBcv.promedio || dataBcv.venta || 0; 
        
        const dataEur = await fetchWithFallback('https://ve.dolarapi.com/v1/euros/oficial'); 
        if (dataEur) euroVal = dataEur.promedio || dataEur.venta || 0; 
        
        // 2. NUEVO SISTEMA PARA BINANCE P2P (Evitando bloqueos de CORS)
        
        // Intentar primero con la API Oficial de PyDolarVenezuela
        const pydolarUrls = [
            'https://api.pydolarvenezuela.com/api/v1/dollar?page=binance',
            'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=binance'
        ];

        for (let url of pydolarUrls) {
            if (binanceVal > 0) break;
            try {
                let res = await fetch(url);
                if (res.ok) {
                    let data = await res.json();
                    const searchPrice = (obj) => { 
                        if (!obj || typeof obj !== 'object') return; 
                        for (let key in obj) { 
                            if (key.toLowerCase().includes('binance') && obj[key].price) { 
                                binanceVal = parseFloat(obj[key].price); 
                                return; 
                            } 
                            if (binanceVal === 0) searchPrice(obj[key]); 
                        } 
                    }; 
                    searchPrice(data);
                }
            } catch(e) { /* Silencioso, salta al siguiente método */ }
        }

        // Si la API falló, aplicamos el Scraping web solicitado usando AllOrigins
        if (binanceVal === 0) {
            try {
                // AllOrigins esquiva el CORS devolviendo el HTML dentro del JSON
                const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://dolartoday.com/');
                const dtRes = await fetch(proxyUrl);
                const dtJson = await dtRes.json();
                const htmlText = dtJson.contents;

                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');

                // Intento 1: Usar el XPath explícito que diste
                const xpath = '/html/body/div[1]/div/section[1]/div[1]/div[4]/div[1]/div[2]/span';
                const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                
                if (node) {
                    let textClean = node.textContent.replace(/[^\d,]/g, '').replace(',', '.');
                    let parsedVal = parseFloat(textClean);
                    if (!isNaN(parsedVal) && parsedVal > 0) binanceVal = parsedVal;
                }

                // Intento 2 (Red de Seguridad): Si DolarToday cambia el HTML y rompe el XPath
                if (binanceVal === 0) {
                    const elements = doc.querySelectorAll('*');
                    for(let i=0; i < elements.length; i++) {
                        if(elements[i].textContent.toLowerCase() === 'binance') {
                            let nextText = elements[i].nextElementSibling ? elements[i].nextElementSibling.textContent : elements[i].parentNode.textContent;
                            let match = nextText.match(/\d{2,3}[,.]\d{2}/);
                            if(match) {
                                binanceVal = parseFloat(match[0].replace(',', '.'));
                                break;
                            }
                        }
                    }
                }
            } catch(e) { console.warn("Fallo scraping en DolarToday", e); }
        }
        
        // 3. Asignación Global y actualización
        window.rateBcvVal = bcvVal; 
        window.rateBinanceVal = binanceVal; 
        window.rateEuroVal = euroVal; 
        
        if(document.getElementById('rateBcv')) {
            document.getElementById('rateBcv').innerText = `Bs. ${parseFloat(bcvVal).toFixed(2)}`; 
            document.getElementById('rateBinance').innerText = binanceVal > 0 ? `Bs. ${parseFloat(binanceVal).toFixed(2)}` : '⚠️ Fallo red'; 
            document.getElementById('rateEuro').innerText = `Bs. ${parseFloat(euroVal).toFixed(2)}`; 
            document.getElementById('rateLastUpdate').innerText = `Última act: ${new Date().toLocaleTimeString('es-VE')}`; 
            
            window.renderBalances(); 
            window.renderExpenses(); 
        }
        if(btn) btn.innerText = '📡 Sincronizar'; 
        
    } catch(err) { 
        console.error("Error en sincronización:", err);
        if(btn) btn.innerText = '⚠️ Reintentar'; 
    } 
};

window.exportToCSV = () => { 
    if(state.expenses.length === 0) return alert("Vacio."); 
    let csvContent = "Fecha,Descripcion,Metodo,Monto (Original),Equiv USD (BCV),Equiv USDT (Binance),Equiv EUR\n"; 
    const sorted = [...state.expenses].sort((a,b) => parseVeDate(a.date) - parseVeDate(b.date)); 
    sorted.forEach(e => { 
        csvContent += `"${e.date}","${e.desc}","${e.account}","${e.amount}","${(e.eqUsd||0).toFixed(2)}","${(e.eqUsdt||0).toFixed(2)}","${(e.eqEur||0).toFixed(2)}"\n`; 
    }); 
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Reporte_Finanzas_MetaOS.csv"; link.click(); 
};

window.downloadChartPNG = () => { 
    const canvas = document.getElementById('financeChart'); 
    if(!canvas) return;
    const link = document.createElement('a'); 
    link.download = 'Distribucion_Gastos_MetaOS.png'; 
    link.href = canvas.toDataURL('image/png'); 
    link.click(); 
};

export function init() {
    if(!isUnlocked) return;
    window.renderBalances();
    window.renderExpenses();
    
    if(window.rateBcvVal === 0) {
        window.fetchExchangeRates();
    }
}

window.addEventListener('stateChanged', () => { 
    if(document.getElementById('expenseList') && isUnlocked) {
        init();
    }
});
