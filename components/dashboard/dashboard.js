import { state } from '../../js/store.js';

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});

// Listen for state changes to update the dashboard reactively
window.addEventListener('stateChanged', renderDashboard);

function renderDashboard() {
    if (!state.currentUid) {
        document.getElementById('stat-tasks').innerText = '0';
        document.getElementById('stat-reminders').innerText = '0';
        document.getElementById('stat-balance').innerText = '0';
        return;
    }

    // Update Stats
    const tasksCount = state.tasks ? state.tasks.length : 0;
    const remindersCount = state.reminders ? state.reminders.filter(r => !r.completed).length : 0;
    
    // Sum balances (assuming numerical values)
    // F29: iterar carteras reales en vez de hardcodear tres cuentas
    const walletIds = (Array.isArray(state.wallets) && state.wallets.length)
        ? state.wallets.map(w => w.id)
        : ['facebank', 'binance', 'bs'];
    const totalBalance = walletIds.reduce((acc, id) => acc + ((state.balances?.[id]) || 0), 0);

    document.getElementById('stat-tasks').innerText = tasksCount;
    document.getElementById('stat-reminders').innerText = remindersCount;
    document.getElementById('stat-balance').innerText = totalBalance.toLocaleString();

    // Update Finance Summary
    if (state.balances) {
        const f = document.getElementById('dash-facebank'), b = document.getElementById('dash-binance'), s = document.getElementById('dash-bs');
        if (f) f.innerText = (state.balances.facebank || 0).toLocaleString();
        if (b) b.innerText = (state.balances.binance || 0).toLocaleString();
        if (s) s.innerText = (state.balances.bs || 0).toLocaleString();
    }

    // Update Activity List
    const activityList = document.getElementById('dash-activity-list');
    if (activityList) {
        activityList.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];
        const logs = state.activityLog[today] || 0;
        
        if (logs > 0) {
            const li = document.createElement('li');
            li.innerText = `Hoy registraste ${logs} ${logs === 1 ? 'actividad' : 'actividades'}.`;
            activityList.appendChild(li);
        } else {
            const li = document.createElement('li');
            li.innerText = 'No hay actividad registrada hoy.';
            li.style.color = 'var(--text-faint, var(--text-tertiary))';
            activityList.appendChild(li);
        }
    }
}
