import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.addTask = () => { 
    const input = document.getElementById('taskInput'), dateInput = document.getElementById('dateInput'), pri = document.getElementById('priorityInput'); 
    if (input.value.trim() === '') return alert('Escribe la actividad.'); 
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
        notified: false 
    };

    newTask.nextTrigger = (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16);
    
    // Si la fecha elegida está en el pasado, "false" hace que el sistema calcule los ciclos 
    // hasta encontrar la próxima fecha válida en el futuro.
    if (baseDate <= new Date()) {
        window.rescheduleRecurring(newTask, false); 
    } else {
        window.rescheduleRecurring(newTask, true); 
    }

    state.recurringTasks.push(newTask); 
    
    input.value = ''; document.getElementById('recTaskDate').value = ''; document.getElementById('recTaskTime').value = ''; 
    document.querySelectorAll('#recTaskDays input').forEach(cb => cb.checked = false);
    
    recordActivity(); saveDataToCloud(); window.renderRecurringTasks();
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

// --- EDICIÓN DE HÁBITOS ---
window.openEditHabitModal = (index) => {
    const task = state.recurringTasks[index];
    document.getElementById('editHabitIndex').value = index;
    document.getElementById('editHabitName').value = task.text;
    
    // Extraer fecha y hora actual para el Modal
    const d = new Date(task.nextTrigger);
    document.getElementById('editHabitDate').value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    document.getElementById('editHabitTime').value = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    
    document.getElementById('editHabitModal').style.display = 'flex';
};

window.closeEditHabitModal = () => { document.getElementById('editHabitModal').style.display = 'none'; };

window.saveEditHabit = () => {
    const index = document.getElementById('editHabitIndex').value;
    const text = document.getElementById('editHabitName').value;
    const dateInput = document.getElementById('editHabitDate').value;
    const timeInput = document.getElementById('editHabitTime').value;

    if (!text || !timeInput || !dateInput) return alert("Completa todos los campos");

    const task = state.recurringTasks[index];
    task.text = text;

    let baseDate = new Date();
    const [year, month, day] = dateInput.split('-');
    baseDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
    const [hours, mins] = timeInput.split(':');
    baseDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

    task.nextTrigger = (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16);

    // Reprogramar si se eligió el pasado accidentalmente
    if (baseDate <= new Date()) window.rescheduleRecurring(task, false); 
    else window.rescheduleRecurring(task, true); 

    saveDataToCloud();
    window.closeEditHabitModal();
    window.renderRecurringTasks();
};

window.renderRecurringTasks = () => { 
    const list = document.getElementById('recurringList'); if(!list) return; list.innerHTML = ''; 
    state.recurringTasks.forEach((rec, index) => { 
        const li = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = false; 
        checkbox.onchange = () => { 
            window.rescheduleRecurring(state.recurringTasks[index]); 
            recordActivity(); saveDataToCloud(); window.renderRecurringTasks(); 
        }; 
        
        let dateString = "Fecha inválida";
        if(rec.nextTrigger) {
            const nextD = new Date(rec.nextTrigger);
            if(!isNaN(nextD)) dateString = nextD.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        }
        
        const dayMap = {1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S', 0:'D'};
        let patternStr = rec.days ? `Días: ${rec.days.map(d => dayMap[d]).join(', ')}` : `Cada ${rec.interval} ${rec.freq}`;

        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong>${rec.text}</strong><br><span class="task-date">Próximo: ⏰ ${dateString}</span>`; 
        const badge = document.createElement('span'); badge.className = 'badge rec-badge'; badge.innerText = patternStr; 
        
        const btnBox = document.createElement('div');
        btnBox.style.display = 'flex'; btnBox.style.marginLeft = 'auto'; btnBox.style.gap = '5px';
        
        const editBtn = document.createElement('button'); editBtn.innerText = '✏️'; editBtn.style.background = 'var(--secondary)'; editBtn.style.padding = '5px 10px'; editBtn.style.color = 'black';
        editBtn.onclick = () => window.openEditHabitModal(index);
        
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; 
        deleteBtn.onclick = () => { state.recurringTasks.splice(index, 1); saveDataToCloud(); window.renderRecurringTasks(); }; 
        
        btnBox.append(editBtn, deleteBtn);
        li.append(checkbox, contentDiv, badge, btnBox); list.appendChild(li); 
    }); 
};

export function init() {
    window.renderTasks();
    window.renderRecurringTasks();
}

window.addEventListener('stateChanged', () => { if(document.getElementById('pendingList')) init(); });
