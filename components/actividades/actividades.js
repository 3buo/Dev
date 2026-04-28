import { state, saveDataToCloud, recordActivity, deleteDataFromCloud } from '../../js/store.js';

// --- GESTIÓN DE TAREAS SIMPLES ---
window.addTask = async () => { 
    const input = document.getElementById('taskInput');
    const dateInput = document.getElementById('dateInput');
    const pri = document.getElementById('priorityInput'); 
    
    if (!input || input.value.trim() === '') return alert('Escribe la actividad.'); 
    
    const newTask = { 
        id: crypto.randomUUID(),
        text: input.value, 
        date: dateInput ? dateInput.value : '', 
        priority: pri ? pri.value : 'media', 
        completed: false,
        recurring: false
    };
    
    if(!state.actividades) state.actividades = [];
    state.actividades.push(newTask); 
    
    input.value = ''; 
    if(dateInput) dateInput.value = ''; 
    
    recordActivity(); 
    await saveDataToCloud('actividades', newTask);
    window.renderTasks(); 
};

window.renderTasks = () => { 
    const pendingList = document.getElementById('pendingList');
    const completedList = document.getElementById('completedList'); 
    if (!pendingList || !completedList) return;
    
    pendingList.innerHTML = ''; 
    completedList.innerHTML = ''; 
    
    (state.actividades || []).filter(t => !t.recurring).forEach((task, index) => { 
        const li = document.createElement('li'); 
        
        const checkbox = document.createElement('input'); 
        checkbox.type = 'checkbox'; 
        checkbox.checked = task.completed; 
        checkbox.addEventListener('change', async () => { 
            task.completed = !task.completed; 
            if(task.completed) { task.completedAt = new Date().toLocaleString('es-VE'); recordActivity(); } 
            else { task.completedAt = null; }
            await saveDataToCloud('actividades', task); 
            window.renderTasks(); 
        }); 
        
        const contentDiv = document.createElement('div'); 
        contentDiv.className = 'task-content'; 
        let completedInfo = (task.completed && task.completedAt) ? `<br><span style="font-size: 0.8em; color: var(--secondary);">✅ Completada: ${task.completedAt}</span>` : '';
        contentDiv.innerHTML = `<strong>${task.text}</strong><br><span class="task-date">📅 ${task.date || 'Sin fecha'}</span>${completedInfo}`; 
        
        const badge = document.createElement('span'); 
        badge.className = `badge pri-${task.priority}`; 
        badge.innerText = task.priority; 
        
        const deleteBtn = document.createElement('button'); 
        deleteBtn.innerText = 'X'; 
        deleteBtn.style.background = '#cf6679'; 
        deleteBtn.style.padding = '5px 10px'; 
        deleteBtn.style.marginLeft = '10px'; 
        deleteBtn.addEventListener('click', async () => { 
            if(confirm("¿Eliminar tarea?")) {
                await deleteDataFromCloud('actividades', task.id);
                window.renderTasks(); 
            }
        }); 
        
        li.append(checkbox, contentDiv, badge, deleteBtn); 
        task.completed ? (li.classList.add('completed-task'), completedList.appendChild(li)) : pendingList.appendChild(li);
    }); 
};

// --- GESTIÓN DE HÁBITOS RECURRENTES ---
window.addRecurringTask = async () => { 
    const input = document.getElementById('recTaskInput');
    const dateInput = document.getElementById('recTaskDate');
    const timeInput = document.getElementById('recTaskTime');
    const intervalInput = document.getElementById('recTaskInterval');
    const freqSelect = document.getElementById('recTaskFreq');
    
    if (!input || !timeInput) return;
    
    const dayCheckboxes = document.querySelectorAll('#recTaskDays input[type="checkbox"]:checked');
    const selectedDays = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    if (input.value.trim() === '' || !timeInput.value) return alert('⚠️ Escribe el nombre y elige hora.'); 
    
    let baseDate = new Date();
    if (dateInput && dateInput.value) {
        const [year, month, day] = dateInput.value.split('-');
        baseDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    const [hours, mins] = timeInput.value.split(':');
    baseDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

    const newTask = { 
        id: crypto.randomUUID(),
        text: input.value, 
        interval: parseInt(intervalInput?.value) || 1, 
        freq: freqSelect ? freqSelect.value : 'dias', 
        days: selectedDays.length > 0 ? selectedDays : null,
        notified: false,
        recurring: true,
        nextTrigger: (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16)
    };
    
    window.rescheduleRecurring(newTask, true); 

    if(!state.actividades) state.actividades = [];
    state.actividades.push(newTask); 
    
    input.value = ''; 
    recordActivity(); 
    await saveDataToCloud('actividades', newTask); 
    window.renderRecurringTasks();
};

window.rescheduleRecurring = (task) => { 
    let date = new Date(task.nextTrigger); 
    const now = new Date(); 
    const interval = parseInt(task.interval) || 1;
    // Lógica simplificada de re-programación
    date.setDate(date.getDate() + interval);
    task.nextTrigger = (new Date(date.getTime() - (date.getTimezoneOffset() * 60000))).toISOString().slice(0, 16); 
    task.notified = false; 
};

// --- RENDERIZADO Y EDICIÓN ---
window.renderRecurringTasks = () => { 
    const list = document.getElementById('recurringList'); 
    if(!list) return; 
    list.innerHTML = ''; 
    
    (state.actividades || []).filter(t => t.recurring).forEach((rec) => { 
        const li = document.createElement('li'); 
        li.innerHTML = `<strong>${rec.text}</strong><br><span>⏰ ${rec.nextTrigger}</span>`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = 'X';
        deleteBtn.addEventListener('click', async () => {
            await deleteDataFromCloud('actividades', rec.id);
            window.renderRecurringTasks();
        });
        li.appendChild(deleteBtn);
        list.appendChild(li); 
    }); 
};

export function init() {
    window.renderTasks();
    window.renderRecurringTasks();
    
    // Bindings de seguridad
    document.getElementById('addTaskBtn')?.addEventListener('click', window.addTask);
    document.getElementById('recTaskAddBtn')?.addEventListener('click', window.addRecurringTask);
}

window.addEventListener('stateChanged', () => { if(document.getElementById('pendingList')) init(); });