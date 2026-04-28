import { state, saveDataToCloud, recordActivity, deleteDataFromCloud } from '../../js/store.js';

// --- GESTIÓN DE TAREAS SIMPLES ---
window.addTask = async () => { 
    const input = document.getElementById('taskInput');
    const dateInput = document.getElementById('dateInput');
    const pri = document.getElementById('priorityInput'); 
    
    if (!input || !dateInput || !pri) {
        console.error("Error: Elementos de la tarea no encontrados.");
        return alert('Error interno cargando la interfaz de tareas.'); 
    }

    if (input.value.trim() === '') return alert('Escribe la actividad.'); 
    
    const newTask = { 
        id: crypto.randomUUID(), // Generar ID único
        text: input.value, 
        date: dateInput.value, 
        priority: pri.value, 
        completed: false 
    };
    
    if(!state.actividades) state.actividades = [];
    state.actividades.push(newTask); 
    
    input.value = ''; 
    if(dateInput) dateInput.value = ''; 
    
    recordActivity(); 
    await saveDataToCloud('actividades', newTask); // Guardar la nueva tarea
    window.renderTasks(); 
};

window.renderTasks = () => { 
    const pendingList = document.getElementById('pendingList');
    const completedList = document.getElementById('completedList'); 
    if (!pendingList || !completedList) {
        console.error("Error: Listas de tareas no encontradas.");
        return;
    }
    
    pendingList.innerHTML = ''; 
    completedList.innerHTML = ''; 
    
    (state.actividades || []).filter(task => !task.recurring).forEach((task) => { 
        const li = document.createElement('li'); 
        const checkbox = document.createElement('input'); 
        checkbox.type = 'checkbox'; 
        checkbox.checked = task.completed; 
        
        // BLINDADO: Listener para el cambio del checkbox
        checkbox.addEventListener('change', async () => { 
            task.completed = !task.completed; 
            if(task.completed) { task.completedAt = new Date().toLocaleString('es-VE'); recordActivity(); } 
            else { task.completedAt = null; }
            
            await saveDataToCloud('actividades', task); // Actualizar tarea
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
        // BLINDADO: Listener para el botón de eliminar
        deleteBtn.addEventListener('click', async () => { 
            if(confirm("¿Eliminar esta tarea?")) {
                await deleteDataFromCloud('actividades', task.id); // Eliminar de Supabase
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
    const dayCheckboxes = document.querySelectorAll('#recTaskDays input[type="checkbox"]:checked');
    
    if (!input || !dateInput || !timeInput || !intervalInput || !freqSelect) {
        console.error("Error: Elementos del hábito recurrente no encontrados.");
        return alert("Error interno cargando la interfaz de hábitos.");
    }
    
    const selectedDays = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

    if (input.value.trim() === '' || !timeInput.value) {
        return alert('⚠️ Escribe el nombre del hábito y elige una hora.'); 
    }
    
    let baseDate = new Date();
    if (dateInput.value) {
        const [year, month, day] = dateInput.value.split('-');
        baseDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    const [hours, mins] = timeInput.value.split(':');
    baseDate.setHours(parseInt(hours), parseInt(mins), 0, 0);

    const newTask = { 
        id: crypto.randomUUID(), // Generar ID único
        text: input.value, 
        interval: parseInt(intervalInput.value) || 1, 
        freq: freqSelect.value, 
        days: selectedDays.length > 0 ? selectedDays : null,
        notified: false,
        recurring: true, 
        nextTrigger: (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16)
    };
    
    if (baseDate <= new Date()) window.rescheduleRecurring(newTask, false); 
    else window.rescheduleRecurring(newTask, true); 

    if(!state.actividades) state.actividades = [];
    state.actividades.push(newTask); 
    
    input.value = ''; 
    dateInput.value = ''; 
    timeInput.value = '';
    document.querySelectorAll('#recTaskDays input').forEach(cb => cb.checked = false);
    
    recordActivity(); 
    await saveDataToCloud('actividades', newTask); // Guardar el nuevo hábito
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

// --- EDICIÓN Y RENDERIZADO DE HÁBITOS ---
window.openEditHabitModal = (taskId) => {
    const task = (state.actividades || []).find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('editHabitId').value = task.id;
    document.getElementById('editHabitName').value = task.text;
    const d = new Date(task.nextTrigger);
    document.getElementById('editHabitDate').value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    document.getElementById('editHabitTime').value = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    document.getElementById('editHabitModal').style.display = 'flex';
};

window.closeEditHabitModal = () => { document.getElementById('editHabitModal').style.display = 'none'; };

window.saveEditHabit = async () => {
    const taskId = document.getElementById('editHabitId')?.value;
    const task = (state.actividades || []).find(t => t.id === taskId);
    if (!task) return;

    task.text = document.getElementById('editHabitName').value;
    const dateInput = document.getElementById('editHabitDate');
    const timeInput = document.getElementById('editHabitTime');
    
    if (!dateInput || !timeInput) return; // Verificar existencia

    const [year, month, day] = dateInput.value.split('-');
    const [hours, mins] = timeInput.value.split(':');
    let baseDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(mins));
    task.nextTrigger = (new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000))).toISOString().slice(0, 16);
    
    window.rescheduleRecurring(task, false); 
    await saveDataToCloud('actividades', task); 
    window.closeEditHabitModal(); 
    window.renderRecurringTasks();
};

window.renderRecurringTasks = () => { 
    const list = document.getElementById('recurringList'); 
    if(!list) return; 
    list.innerHTML = ''; 
    
    (state.actividades || []).filter(task => task.recurring).forEach((rec) => { 
        const li = document.createElement('li'); 
        const checkbox = document.createElement('input'); 
        checkbox.type = 'checkbox'; 
        checkbox.checked = false; // Siempre inicia desmarcado, se marca al completar manualmente
        
        // BLINDADO: Listener para el cambio del checkbox
        checkbox.addEventListener('change', async () => { 
            window.rescheduleRecurring(rec); 
            recordActivity(); 
            await saveDataToCloud('actividades', rec); // Actualizar hábito
            window.renderRecurringTasks(); 
        }); 
        
        let dateString = "Fecha inválida";
        if(rec.nextTrigger) {
            const nextD = new Date(rec.nextTrigger);
            if(!isNaN(nextD.getTime())) dateString = nextD.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        }
        
        const dayMap = {1:'L', 2:'M', 3:'X', 4:'J', 5:'V', 6:'S', 0:'D'};
        let patternStr = rec.days && rec.days.length > 0 ? `Días: ${rec.days.map(d => dayMap[d]).join(', ')}` : `Cada ${rec.interval} ${rec.freq}`;

        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong>${rec.text}</strong><br><span class="task-date">Próximo: ⏰ ${dateString}</span>`; 
        
        const badge = document.createElement('span'); badge.className = 'badge rec-badge'; badge.innerText = patternStr; 
        
        const btnBox = document.createElement('div');
        btnBox.style.display = 'flex'; btnBox.style.marginLeft = 'auto'; btnBox.style.gap = '5px';
        
        const editBtn = document.createElement('button'); editBtn.innerText = '✏️'; 
        editBtn.style.background = 'var(--secondary)'; editBtn.style.padding = '5px 10px'; editBtn.style.color = 'black';
        // BLINDADO: Listener para el botón de editar
        editBtn.addEventListener('click', () => window.openEditHabitModal(rec.id));
        
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; 
        deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; 
        // BLINDADO: Listener para el botón de eliminar
        deleteBtn.addEventListener('click', async () => { 
            if(confirm("¿Eliminar este hábito?")) {
                await deleteDataFromCloud('actividades', rec.id); // Eliminar de Supabase
                window.renderRecurringTasks(); 
            }
        }); 
        
        btnBox.append(editBtn, deleteBtn);
        li.append(checkbox, contentDiv, badge, btnBox); 
        list.appendChild(li); 
    }); 
};

// --- SISTEMA DE CALENDARIO ---
let calDate = new Date();

window.openCalendarModal = () => {
    calDate = new Date(); // Reset al mes actual
    const modal = document.getElementById('calendarModal');
    if(modal) modal.style.display = 'flex';
    window.renderCalendar();
};

window.closeCalendarModal = () => {
    const modal = document.getElementById('calendarModal');
    if(modal) modal.style.display = 'none';
};

window.changeMonth = (dir) => {
    calDate.setMonth(calDate.getMonth() + dir);
    window.renderCalendar();
};

window.renderCalendar = () => {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarMonthYear');
    if (!grid || !title) return;
    
    grid.innerHTML = '';
    
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    title.innerText = `${monthNames[month]} ${year}`;
    
    ['D', 'L', 'M', 'X', 'J', 'V', 'S'].forEach(d => {
        let el = document.createElement('div');
        el.innerText = d;
        el.style.textAlign = 'center';
        el.style.fontWeight = 'bold';
        el.style.color = 'var(--secondary)';
        el.style.fontSize = '0.8em';
        el.style.marginBottom = '5px';
        grid.appendChild(el);
    });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) {
        let el = document.createElement('div');
        grid.appendChild(el);
    }
    
    for(let i=1; i<=daysInMonth; i++) {
        let el = document.createElement('div');
        el.innerText = String(i);
        el.className = 'cal-day';
        
        let currentDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        
        let dayActivities = [];
        
        (state.actividades || []).forEach(t => {
            if(!t.recurring && !t.completed && t.date === currentDateStr) { // Tareas simples
                dayActivities.push(`📌 ${t.text}`);
            }
            if(t.recurring && t.nextTrigger && t.nextTrigger.startsWith(currentDateStr)) { // Hábitos recurrentes
                let time = new Date(t.nextTrigger).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
                dayActivities.push(`🔄 ${t.text} (${time})`);
            }
        });
        
        if(dayActivities.length > 0) {
            el.classList.add('has-activities');
            el.innerHTML = `${i} <div class="cal-tooltip">${dayActivities.join('<br>')}</div>`;
        }
        
        const hoy = new Date();
        if (year === hoy.getFullYear() && month === hoy.getMonth() && i === hoy.getDate()) {
            el.style.borderBottom = "3px solid var(--primary)";
        }

        grid.appendChild(el);
    }
};

export function init() {
    window.renderTasks();
    window.renderRecurringTasks();
    
    // BLINDADO: Enlazar eventos a los elementos
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) addTaskBtn.addEventListener('click', window.addTask);
    const recTaskAddBtn = document.getElementById('recTaskAddBtn');
    if (recTaskAddBtn) recTaskAddBtn.addEventListener('click', window.addRecurringTask);
    const openCalendarBtn = document.getElementById('openCalendarBtn');
    if (openCalendarBtn) openCalendarBtn.addEventListener('click', window.openCalendarModal);
    const closeCalendarModalBtn = document.getElementById('closeCalendarModalBtn');
    if (closeCalendarModalBtn) closeCalendarModalBtn.addEventListener('click', window.closeCalendarModal);
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => window.changeMonth(-1));
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => window.changeMonth(1));
    const saveEditHabitBtn = document.getElementById('saveEditHabitBtn');
    if (saveEditHabitBtn) saveEditHabitBtn.addEventListener('click', window.saveEditHabit);
    const closeEditHabitModalBtn = document.getElementById('closeEditHabitModalBtn');
    if (closeEditHabitModalBtn) closeEditHabitModalBtn.addEventListener('click', window.closeEditHabitModal);
    
    const taskInput = document.getElementById('taskInput');
    if(taskInput) taskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.addTask(); });
    const recTaskInput = document.getElementById('recTaskInput');
    if(recTaskInput) recTaskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.addRecurringTask(); });
}

window.addEventListener('stateChanged', () => {
    if(document.getElementById('view-actividades')) { // Solo si estamos en la vista de actividades
        init();
        const calendarModal = document.getElementById('calendarModal');
        if(calendarModal && calendarModal.style.display === 'flex') {
            window.renderCalendar(); // Re-renderizar si el modal está abierto
        }
    }
});