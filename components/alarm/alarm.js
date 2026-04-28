// ==========================================================================
// MÓDULO DE ALARMAS Y NOTIFICACIONES (INDEPENDIENTE)
// ==========================================================================

const SOUNDS = {
    digital: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    bell: 'https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg',
    scifi: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
};

let currentAudio = null;
let activeCallback = null;

// Lógica segura de almacenamiento: Guarda las preferencias al instante
function getAlarmSettings() {
    try {
        const saved = localStorage.getItem('taskify_alarm_prefs');
        return saved ? JSON.parse(saved) : { sound: 'digital', volume: 0.5 };
    } catch(e) {
        return { sound: 'digital', volume: 0.5 };
    }
}

function saveAlarmSettings(settings) {
    localStorage.setItem('taskify_alarm_prefs', JSON.stringify(settings));
}

export function initAlarmSystem() {
    const settings = getAlarmSettings();
    const soundSelect = document.getElementById('alarmSoundSelect');
    const volSlider = document.getElementById('alarmVolumeSlider');
    
    if(soundSelect) soundSelect.value = settings.sound;
    if(volSlider) volSlider.value = settings.volume;
}

window.toggleAlarmConfig = () => {
    const panel = document.getElementById('alarmConfigPanel');
    if(panel) panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
};

window.previewAndSaveAlarmSettings = () => {
    const sound = document.getElementById('alarmSoundSelect').value;
    const volume = parseFloat(document.getElementById('alarmVolumeSlider').value);
    
    // 1. Guardar de forma persistente
    saveAlarmSettings({ sound, volume });

    // 2. Detener cualquier sonido previo
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    
    // 3. Probar el nuevo sonido con el volumen exacto
    currentAudio = new Audio(SOUNDS[sound]);
    currentAudio.volume = volume;
    currentAudio.play().catch(e => console.warn("Autoplay bloqueado por el navegador en la preview."));
};

// API GLOBAL PARA DISPARAR ALARMAS (Esta es la que debes usar en app.js)
window.triggerSystemAlarm = (title, description, onCompleteCallback) => {
    
    // Detener sonidos previos si se superponen
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    
    // Inyectar datos en la interfaz
    const titleEl = document.getElementById('sysAlarmTitle');
    const descEl = document.getElementById('sysAlarmDesc');
    const modalEl = document.getElementById('sysAlarmModal');
    
    if(titleEl) titleEl.innerText = title || 'Alarma';
    if(descEl) descEl.innerText = description || '';
    if(modalEl) modalEl.style.display = 'flex';
    
    activeCallback = onCompleteCallback;
    
    // Ejecutar el sonido correcto
    const settings = getAlarmSettings();
    currentAudio = new Audio(SOUNDS[settings.sound]);
    currentAudio.volume = settings.volume;
    currentAudio.loop = true; // Repetir hasta que el usuario decida
    
    currentAudio.play().catch(e => console.warn("El navegador bloqueó el autoplay visual de la alarma."));
};

window.completeSystemAlarm = () => {
    stopAudioAndClose();
    if (activeCallback) activeCallback();
};

window.snoozeSystemAlarm = () => {
    stopAudioAndClose();
    const savedTitle = document.getElementById('sysAlarmTitle').innerText;
    const savedDesc = document.getElementById('sysAlarmDesc').innerText;
    const savedCallback = activeCallback;
    
    // Re-disparar en 5 minutos
    setTimeout(() => {
        window.triggerSystemAlarm(`(Pospuesto) ${savedTitle}`, savedDesc, savedCallback);
    }, 300000); 
};

function stopAudioAndClose() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    const modal = document.getElementById('sysAlarmModal');
    if(modal) modal.style.display = 'none';
}

// Inicializar automáticamente
initAlarmSystem();
