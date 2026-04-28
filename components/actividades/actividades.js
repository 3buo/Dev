import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// --- GESTIÓN DE TAREAS SIMPLES ---
window.addTask = () => { 
    const input = document.getElementById('taskInput'), dateInput = document.getElementById('dateInput'), pri = document.getElementById('priorityInput'); 
    if (input.value.trim() === '') return alert('Escribe la actividad.'); 
    
    const newTask = { text: input.value, date: dateInput.value, priority: pri.value, completed: false };
    
    if(!state.tasks) state.tasks = [];
    state.tasks.push(newTask); 
    
    input.value = ''; dateInput.value = ''; 
    recordActivity(); 
    
    // Guardar en Supabase usando la nueva función genérica
    saveDataToCloud('actividades', newTask); 
    window.renderTasks(); 
};

window.renderTasks = () => { 
    const pendingList = document.getElementById('pendingList'), completedList = document.getElementById('completedList'); 
    if (!pendingList || !completedList) return;
    pendingList.innerHTML = ''; completedList.innerHTML = ''; 
    
    // VERIFICACIÓN DE SEGURIDAD AÑADIDA: (state.tasks || [])
    (state.tasks || []).forEach((task, index) => { 
        const li = document.createElement('li'); 
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.completed; 
        checkbox.onchange = () => { 
            state.tasks[index].completed = !state.tasks[index].completed; 
            if(state.tasks[index].completed) { state.tasks[index].completedAt = new Date().toLocaleString('es-VE'); recordActivity(); } 
            else { state.tasks[index].completedAt = null; }
            
            saveDataToCloud('actividades', state.tasks[index]); 
            window.renderTasks(); 
        }; 
        
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        let completedInfo = (task.completed && task.completedAt) ? `<br><span style="font-size: 0.8em; color: var(--secondary);">✅ Completada: ${task.completedAt}</span>` : '';
        contentDiv.innerHTML = `<strong>${task.text}</strong><br><span class="task-date">📅 ${task.date || 'Sin fecha'}</span>${completedInfo}`; 
        
        const badge = document.createElement('span'); badge.className = `badge pri-${task.priority}`; badge.innerText = task.priority; 
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; deleteBtn.style.marginLeft = '10px'; 
        deleteBtn.onclick = () => { state.tasks.splice(index, 1); saveDataToCloud('actividades', task); window.renderTasks(); }; 
        
        li.append(checkbox, contentDiv, badge, deleteBtn); 
        task.completed ? (li.classList.add('completed-task'), completedList.appendChild(li)) : pendingList.appendChild(li);
    }); 
};

// --- GESTIÓN DE HÁBITOS RECURRENTES ---
window.addRecurringTask = () => { 
    const input = document.getElementById('recTaskInput');
    const dateInput = document.getElementById('recTaskDate').value;
    const timeInput = document.getElementById('recTaskTime').value;
    const interval = document.getElementById('recTaskInterval').value;
    const freq = document.getElementById('recTaskFreq').value;
    
    const dayCheckboxes = document.querySelectorAll('#recTaskDays input[type="checkbox"]:checked');
    const selectedDays = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    if (input.value.trim() === '' || !timeInput) {
        return alert('⚠️ Escribe el nombre del hábito y elige una hora.'); 
    }
    
    let baseDate = new Date();
    if (dateInput) {
        const [year, month, day] = dateInput.split('-');
        baseDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    const [hours, mins] = timeInput.split(':');
    baseDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

    const newTask = { 
        text: input.value, 
        interval: parseInt(interval) || 1, 
        freq: freq, 
        days: selectedDays.length > 0 ? selectedDays : null,
        notified: false,
        nextTrigger: (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16)
    };
    
    if (baseDate <= new Date()) window.rescheduleRecurring(newTask, false); 
    else window.rescheduleRecurring(newTask, true); 

    if(!state.recurringTasks) state.recurringTasks = [];
    state.recurringTasks.push(newTask); 
    
    input.value = ''; document.getElementById('recTaskDate').value = ''; document.getElementById('recTaskTime').value = ''; 
    document.querySelectorAll('#recTaskDays input').forEach(cb => cb.checked = false);
    
    recordActivity(); 
    saveDataToCloud('actividades', newTask); 
    window.renderRecurringTasks();
};

window.rescheduleRecurring = (task, isInitialSetup = false) => { 
    let date = new Date(task.nextTrigger); 
    const now = new Date(); 
    const interval = parseInt(task.interval) || 1;
    const freq = task.freq;
    
    if (task.days && task.days.length > 0) {
        if (!isInitialSetup) date.setDate(date.getDate() + 1);
        let safeCounter = 0;
        while (!task.days.includes(date.getDay()) && safeCounter < 365) {
            date.setDate(date.getDate() + 1);
            safeCounter++;
        }
        let weekJumper = 0;
        while (date <= now && !isInitialSetup && weekJumper < 52) {
            date.setDate(date.getDate() + 7);
            weekJumper++;
        }
    } else {
        if (!isInitialSetup) {
            let loopLimiter = 0;
            do {
                if(freq === 'minutos') date.setMinutes(date.getMinutes() + interval); 
                else if(freq === 'horas') date.setHours(date.getHours() + interval); 
                else if(freq === 'dias') date.setDate(date.getDate() + interval); 
                else if(freq === 'meses') date.setMonth(date.getMonth() + interval); 
                else date.setHours(date.getHours() + 1); 
                loopLimiter++;
                if(loopLimiter > 1000) break; 
            } while (date <= now); 
        }
    }
    task.nextTrigger = (new Date(date.getTime() - (date.getTimezoneOffset() * 60000))).toISOString().slice(0, 16); 
    task.notified = false; 
};

// --- EDICIÓN Y RENDERIZADO ---
window.openEditHabitModal = (index) => {
    const task = state.recurringTasks[index];
    document.getElementById('editHabitIndex').value = index;
    document.getElementById('editHabitName').value = task.text;
    const d = new Date(task.nextTrigger);
    document.getElementById('editHabitDate').value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    document.getElementById('editHabitTime').value = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    document.getElementById('editHabitModal').style.display = 'flex';
};

window.closeEditHabitModal = () => { document.getElementById('editHabitModal').style.display = 'none'; };

window.saveEditHabit = () => {
    const index = document.getElementById('editHabitIndex').value;
    const task = state.recurringTasks[index];
    task.text = document.getElementById('editHabitName').value;
    const [year, month, day] = document.getElementById('editHabitDate').value.split('-');
    const [hours, mins] = document.getElementById('editHabitTime').value.split(':');
    let baseDate = new Date(year, month - 1, day, hours, mins);
    task.nextTrigger = (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16);
    
    window.rescheduleRecurring(task, false); 
    saveDataToCloud('actividades', task); 
    window.closeEditHabitModal(); 
    window.renderRecurringTasks();
};

window.renderRecurringTasks = () => { 
    const list = document.getElementById('recurringList'); if(!list) return; list.innerHTML = ''; 
    (state.recurringTasks || []).forEach((rec, index) => { 
        const li = document.createElement('li'); 
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; 
        checkbox.onchange = () => { window.rescheduleRecurring(state.recurringTasks[index]); recordActivity(); saveDataToCloud('actividades', rec); window.renderRecurringTasks(); }; 
        const dateString = new Date(rec.nextTrigger).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        const patternStr = rec.days ? `Días: ${rec.days.join(',')}` : `Cada ${rec.interval} ${rec.freq}`;
        li.innerHTML = `<strong>${rec.text}</strong><br><span>⏰ ${dateString}</span><span class="badge">${patternStr}</span>`;
        list.appendChild(li); 
    }); 
};

export function init() {
    window.renderTasks();
    window.renderRecurringTasks();
}

window.addEventListener('stateChanged', () => {
    if(document.getElementById('pendingList')) {
        init();
    }
});