import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.addTask = () => { 
    const input = document.getElementById('taskInput'), dateInput = document.getElementById('dateInput'), pri = document.getElementById('priorityInput'); 
    if (input.value.trim() === '') return alert('Escribe.'); 
    state.tasks.push({ text: input.value, date: dateInput.value, priority: pri.value, completed: false }); 
    input.value = ''; dateInput.value = ''; 
    recordActivity(); saveDataToCloud(); window.renderTasks(); 
};

window.renderTasks = () => { 
    const pendingList = document.getElementById('pendingList'), completedList = document.getElementById('completedList'); 
    if (!pendingList || !completedList) return;
    pendingList.innerHTML = ''; completedList.innerHTML = ''; 
    
    state.tasks.forEach((task, index) => { 
        const li = document.createElement('li'); 
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.completed; 
        checkbox.onchange = () => { 
            state.tasks[index].completed = !state.tasks[index].completed; 
            if(state.tasks[index].completed) { state.tasks[index].completedAt = new Date().toLocaleString('es-VE'); recordActivity(); } 
            else { state.tasks[index].completedAt = null; }
            saveDataToCloud(); window.renderTasks(); 
        }; 
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        let completedInfo = (task.completed && task.completedAt) ? `<br><span style="font-size: 0.8em; color: var(--secondary);">✅ Completada: ${task.completedAt}</span>` : '';
        contentDiv.innerHTML = `<strong>${task.text}</strong><br><span class="task-date">📅 ${task.date || 'Sin fecha'}</span>${completedInfo}`; 
        const badge = document.createElement('span'); badge.className = `badge pri-${task.priority}`; badge.innerText = task.priority; 
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; deleteBtn.style.marginLeft = '10px'; 
        deleteBtn.onclick = () => { state.tasks.splice(index, 1); saveDataToCloud(); window.renderTasks(); }; 
        li.append(checkbox, contentDiv, badge, deleteBtn); 
        task.completed ? (li.classList.add('completed-task'), completedList.appendChild(li)) : pendingList.appendChild(li);
    }); 
};

window.addRecurringTask = () => { 
    const input = document.getElementById('recTaskInput'), start = document.getElementById('recTaskStart'), interval = document.getElementById('recTaskInterval'), freq = document.getElementById('recTaskFreq'); 
    if (input.value.trim() === '' || start.value === '') return; 
    state.recurringTasks.push({ text: input.value, nextTrigger: start.value, interval: parseInt(interval.value), freq: freq.value, notified: false }); 
    input.value = ''; start.value = ''; recordActivity(); saveDataToCloud(); window.renderRecurringTasks();
};

window.rescheduleRecurring = (task) => { 
    let date = new Date(task.nextTrigger); let now = new Date(); if (date < now) date = now; 
    if(task.freq === 'minutos') date.setMinutes(date.getMinutes() + task.interval); 
    if(task.freq === 'horas') date.setHours(date.getHours() + task.interval); 
    if(task.freq === 'dias') date.setDate(date.getDate() + task.interval); 
    if(task.freq === 'meses') date.setMonth(date.getMonth() + task.interval); 
    task.nextTrigger = (new Date(date.getTime() - (date.getTimezoneOffset() * 60000))).toISOString().slice(0, 16); task.notified = false; 
};

window.renderRecurringTasks = () => { 
    const list = document.getElementById('recurringList'); if(!list) return; list.innerHTML = ''; 
    state.recurringTasks.forEach((rec, index) => { 
        const li = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = false; 
        checkbox.onchange = () => { window.rescheduleRecurring(state.recurringTasks[index]); recordActivity(); saveDataToCloud(); window.renderRecurringTasks(); }; 
        const dateString = new Date(rec.nextTrigger).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; contentDiv.innerHTML = `<strong>${rec.text}</strong><br><span class="task-date">Próximo: ⏰ ${dateString}</span>`; 
        const badge = document.createElement('span'); badge.className = 'badge rec-badge'; badge.innerText = `Cada ${rec.interval} ${rec.freq}`; 
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; deleteBtn.style.marginLeft = '10px'; 
        deleteBtn.onclick = () => { state.recurringTasks.splice(index, 1); saveDataToCloud(); window.renderRecurringTasks(); }; 
        li.append(checkbox, contentDiv, badge, deleteBtn); list.appendChild(li); 
    }); 
};

window.renderHeatmap = () => { 
    const grid = document.getElementById('heatmapGrid'); if(!grid) return; grid.innerHTML = ''; const today = new Date(); 
    for(let i = 29; i >= 0; i--) { 
        const d = new Date(today); d.setDate(today.getDate() - i); const dateStr = d.toISOString().split('T')[0]; const count = state.activityLog[dateStr] || 0; 
        const cell = document.createElement('div'); cell.className = 'heat-cell'; 
        if(count > 0 && count <= 2) cell.classList.add('heat-lvl-1'); else if(count > 2 && count <= 5) cell.classList.add('heat-lvl-2'); else if(count > 5 && count <= 8) cell.classList.add('heat-lvl-3'); else if(count > 8) cell.classList.add('heat-lvl-4'); 
        cell.title = `${dateStr}: ${count} acciones`; grid.appendChild(cell); 
    } 
};

// Se expone el init para que app.js lo llame la primera vez
export function init() {
    window.renderTasks();
    window.renderRecurringTasks();
    window.renderHeatmap();
}

// Escuchar cambios de otros módulos (ej. Voz) para repintar
window.addEventListener('stateChanged', () => {
    if(document.getElementById('pendingList')) init();
});