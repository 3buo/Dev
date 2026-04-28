import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.addReminder = () => { 
    const input = document.getElementById('remInput');
    const datetimeInput = document.getElementById('remDatetime');
    const snoozeInput = document.getElementById('snoozeInput'); 
    
    if (input.value.trim() === '' || datetimeInput.value === '') return alert('Escribe y selecciona una fecha.'); 
    
    state.reminders.push({ 
        text: input.value, 
        datetime: datetimeInput.value, 
        snoozeMins: parseInt(snoozeInput.value), 
        completed: false, 
        notified: false 
    }); 
    
    input.value = ''; 
    datetimeInput.value = ''; 
    recordActivity(); 
    saveDataToCloud(); 
    window.renderReminders(); 
};

window.renderReminders = () => { 
    const pendingList = document.getElementById('pendingReminders');
    const completedList = document.getElementById('completedReminders'); 
    
    if(!pendingList || !completedList) return; 
    pendingList.innerHTML = ''; 
    completedList.innerHTML = ''; 
    
    state.reminders.forEach((rem, index) => { 
        const li = document.createElement('li'); 
        const checkbox = document.createElement('input'); 
        checkbox.type = 'checkbox'; 
        checkbox.checked = rem.completed; 
        
        checkbox.onchange = () => { 
            state.reminders[index].completed = !state.reminders[index].completed; 
            if(!state.reminders[index].completed) {
                state.reminders[index].notified = false; 
            } else {
                recordActivity(); 
            }
            saveDataToCloud(); 
            window.renderReminders(); 
        }; 
        
        const dateString = new Date(rem.datetime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        const contentDiv = document.createElement('div'); 
        contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong>${rem.text}</strong><br><span class="task-date">⏰ ${dateString}</span>`; 
        
        const badge = document.createElement('span'); 
        badge.className = 'badge snooze-badge'; 
        badge.innerText = `Snooze: ${rem.snoozeMins}m`; 
        
        const deleteBtn = document.createElement('button'); 
        deleteBtn.innerText = 'X'; 
        deleteBtn.style.background = '#cf6679'; 
        deleteBtn.style.padding = '5px 10px'; 
        deleteBtn.style.marginLeft = '10px'; 
        
        deleteBtn.onclick = () => { 
            state.reminders.splice(index, 1); 
            saveDataToCloud(); 
            window.renderReminders(); 
        }; 
        
        li.append(checkbox, contentDiv, badge, deleteBtn); 
        rem.completed ? (li.classList.add('completed-task'), completedList.appendChild(li)) : pendingList.appendChild(li); 
    }); 
};

// Inicialización de la pestaña
export function init() {
    window.renderReminders();
}

// Escuchar cambios de la nube para recargar la lista
window.addEventListener('stateChanged', () => { 
    if(document.getElementById('pendingReminders')) init(); 
});
