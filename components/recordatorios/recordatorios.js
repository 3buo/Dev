import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.addReminder = () => { 
    const input = document.getElementById('remInput'), datetimeInput = document.getElementById('remDatetime'), snoozeInput = document.getElementById('snoozeInput'); 
    if (input.value.trim() === '' || datetimeInput.value === '') return alert('Escribe.'); 
    state.reminders.push({ text: input.value, datetime: datetimeInput.value, snoozeMins: parseInt(snoozeInput.value), completed: false, notified: false }); 
    input.value = ''; datetimeInput.value = ''; recordActivity(); saveDataToCloud(); window.renderReminders(); 
};

window.renderReminders = () => { 
    const pendingList = document.getElementById('pendingReminders'), completedList = document.getElementById('completedReminders'); 
    if(!pendingList || !completedList) return; pendingList.innerHTML = ''; completedList.innerHTML = ''; 
    
    state.reminders.forEach((rem, index) => { 
        const li = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = rem.completed; 
        checkbox.onchange = () => { 
            state.reminders[index].completed = !state.reminders[index].completed; 
            if(!state.reminders[index].completed) state.reminders[index].notified = false; else recordActivity(); 
            saveDataToCloud(); window.renderReminders(); 
        }; 
        const dateString = new Date(rem.datetime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); 
        const contentDiv = document.createElement('div'); contentDiv.className = 'task-content'; 
        contentDiv.innerHTML = `<strong>${rem.text}</strong><br><span class="task-date">⏰ ${dateString}</span>`; 
        const badge = document.createElement('span'); badge.className = 'badge snooze-badge'; badge.innerText = `Snooze: ${rem.snoozeMins}m`; 
        const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; deleteBtn.style.marginLeft = '10px'; 
        deleteBtn.onclick = () => { state.reminders.splice(index, 1); saveDataToCloud(); window.renderReminders(); }; 
        li.append(checkbox, contentDiv, badge, deleteBtn); 
        rem.completed ? (li.classList.add('completed-task'), completedList.appendChild(li)) : pendingList.appendChild(li); 
    }); 
};

// --- MOTOR GLOBAL DE ALARMAS ---
// Mantenemos este checker activo en el background.
if (!window.alarmsEngineStarted) {
    window.alarmsEngineStarted = true;
    let audioCtx = null;
    let alarmAudioInterval = null;

    document.addEventListener('click', () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (Notification.permission !== "granted" && Notification.permission !== "denied") Notification.requestPermission();
    }, { once: true });

    function playBeep() {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = "sine"; osc.frequency.value = 800;
        gain.gain.setValueAtTime(1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    }

    const startAlarmSound = () => { if(!alarmAudioInterval) { playBeep(); alarmAudioInterval = setInterval(playBeep, 2000); } };
    const stopAlarmSound = () => { if(alarmAudioInterval) { clearInterval(alarmAudioInterval); alarmAudioInterval = null; } };

    window.triggerModal = (type, text, onComplete, onSnooze) => {
        if (Notification.permission === "granted") new Notification(type, { body: text });
        startAlarmSound();
        document.getElementById('alarmTypeDesc').innerText = type; document.getElementById('alarmText').innerText = text;
        const modal = document.getElementById('alarmModal'); modal.style.display = 'flex';
        
        const btnC = document.getElementById('btnComplete'), btnS = document.getElementById('btnSnooze');
        const newBtnC = btnC.cloneNode(true), newBtnS = btnS.cloneNode(true);
        btnC.parentNode.replaceChild(newBtnC, btnC); btnS.parentNode.replaceChild(newBtnS, btnS);
        
        newBtnC.onclick = () => { stopAlarmSound(); modal.style.display = 'none'; if(onComplete) onComplete(); };
        newBtnS.onclick = () => { stopAlarmSound(); modal.style.display = 'none'; if(onSnooze) onSnooze(); };
    };

    setInterval(() => {
        if(!state.currentUid) return; const now = new Date();
        
        // Revisar Recordatorios Únicos
        state.reminders.forEach((rem, index) => {
            if (!rem.completed && !rem.notified) {
                if (now >= new Date(rem.datetime)) {
                    rem.notified = true;
                    window.triggerModal("Recordatorio", rem.text, () => {
                        rem.completed = true; saveDataToCloud(); window.renderReminders?.();
                    }, () => {
                        rem.notified = false;
                        const snoozeTime = new Date(now.getTime() + (rem.snoozeMins * 60000));
                        rem.datetime = new Date(snoozeTime.getTime() - (snoozeTime.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                        saveDataToCloud(); window.renderReminders?.();
                    });
                }
            }
        });

        // Revisar Hábitos Recurrentes (definidos en Actividades)
        state.recurringTasks?.forEach((rec, index) => {
            if (!rec.notified) {
                if (now >= new Date(rec.nextTrigger)) {
                    rec.notified = true;
                    window.triggerModal("Hábito / Rutina", rec.text, () => {
                        if(window.rescheduleRecurring) window.rescheduleRecurring(rec);
                        recordActivity(); saveDataToCloud(); window.renderRecurringTasks?.();
                    }, () => {
                        rec.notified = false;
                        const snoozeTime = new Date(now.getTime() + (10 * 60000));
                        rec.nextTrigger = new Date(snoozeTime.getTime() - (snoozeTime.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                        saveDataToCloud(); window.renderRecurringTasks?.();
                    });
                }
            }
        });
    }, 10000); 
}

export function init() {
    window.renderReminders();
}

window.addEventListener('stateChanged', () => { if(document.getElementById('pendingReminders')) init(); });
