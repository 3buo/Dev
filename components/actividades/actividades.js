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
    const input = document.getElementById('recTaskInput');
    const timeInput = document.getElementById('recTaskTime');
    const interval = document.getElementById('recTaskInterval').value;
    const freq = document.getElementById('recTaskFreq').value;
    
    // Recoger los días seleccionados
    const dayCheckboxes = document.querySelectorAll('#recTaskDays input[type="checkbox"]:checked');
    const selectedDays = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    if (input.value.trim() === '') return alert('Escribe el nombre del hábito.'); 
    
    let baseDate = new Date();
    if (timeInput.value) {
        const [hours, mins] = timeInput.value.split(':');
        baseDate.setHours(parseInt(hours), parseInt(mins), 0, 0);
    }
    
    // Si la hora inicial configurada ya pasó hoy, empezamos a evaluar desde mañana
    if (baseDate <= new Date()) {
        baseDate.setDate(baseDate.getDate() + 1);
    }

    const newTask = { 
        text: input.value, 
        interval: parseInt(interval), 
        freq: freq, 
        days: selectedDays.length > 0 ? selectedDays : null,
        notified: false 
    };

    // Calcular el primer trigger real usando nuestra nueva función
    newTask.nextTrigger = (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16);
    // Aplicamos reschedule para asegurarnos de que caiga en el día correcto inmediatamente
    window.rescheduleRecurring(newTask, true);

    state.recurringTasks.push(newTask); 
    
    input.value = ''; timeInput.value = ''; 
    document.querySelectorAll('#recTaskDays input').forEach(cb => cb.checked = false);
    
    recordActivity(); saveDataToCloud(); window.renderRecurringTasks();
};

window.rescheduleRecurring = (task, isInitialSetup = false) => { 
    // Usamos de base matemática la fecha ORIGINAL en que debía sonar, NO LA HORA ACTUAL
    let date = new Date(task.nextTrigger); 
    const now = new Date(); 
    
    if (task.days && task.days.length > 0) {
        // Lógica de "Días de la semana"
        // Si no es la configuración inicial, avanzamos un día para no repetir hoy
        if (!isInitialSetup) date.setDate(date.getDate() + 1);
        
        // Buscamos el próximo día que haga match con el array
        while (!task.days.includes(date.getDay())) {
            date.setDate(date.getDate() + 1);
        }
    } else {
        // Lógica de Intervalos clásico
        // Se ejecuta un bucle para sumar el intervalo a la base original hasta que quede en el futuro.
        // Esto evita que "la hora se pierda" si le das clic horas o días tarde.
        do {
            if(task.freq === 'minutos') date.setMinutes(date.getMinutes() + task.interval); 
            if(task.freq === 'horas') date.setHours(date.getHours() + task.interval); 
            if(task.freq === 'dias') date.setDate(date.getDate() + task.interval); 
            if(task.freq === 'meses') date.setMonth(date.getMonth() + task.interval); 
        } while (date <= now && !isInitialSetup); 
    }
    
    task.nextTrigger = (new Date(date.getTime() - (date.getTimezoneOffset() * 60000))).toISOString().slice(0, 16); 
    task.notified = false; 
};

window.renderRecurringTasks = () => { 
    const list = document.getElementById('recurringList'); if(!list) return; list.innerHTML = ''; 
    state.recurringTasks.forEach((rec, index) => { 
        const li = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = false; 
        checkbox.onchange = () => { window.rescheduleRecurring(state.recurringTasks[index]); recordActivity(); saveDataToCloud(); window.renderRecurringTasks(); }; 
        const dateString = new Date(rec.nextTrigger).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        
        // Crear un label bonito para mostrar el patrón
        const dayMap = {1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S', 0:'D'};
        let patternStr = rec.days ? `Días: ${rec.days.map(d => dayMap[d]).join(', ')}` : `Cada ${rec.interval} ${rec.freq}`;

        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong>${rec.text}</strong><br><span class="task-date">Próximo: ⏰ ${dateString}</span>`; 
        const badge = document.createElement('span'); badge.className = 'badge rec-badge'; badge.innerText = patternStr; 
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

export function init() {
    window.renderTasks();
    window.renderRecurringTasks();
    window.renderHeatmap();
}

window.addEventListener('stateChanged', () => {
    if(document.getElementById('pendingList')) init();
});
