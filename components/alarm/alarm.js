import { state, saveDataToCloud } from '../../js/store.js'; // Ajusta la ruta a tu store

// Repositorio de sonidos (URLs gratuitas de Google)
const SOUNDS = {
    digital: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    bell: 'https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg',
    scifi: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
};

let currentAudio = null;
let activeCallback = null; // Para saber qué hacer cuando le dan "Completar"

// 1. Inicializar Preferencias del Usuario
export function initAlarmSystem() {
    // Si el usuario no tiene preferencias guardadas, creamos las predeterminadas
    if (!state.alarmSettings) {
        state.alarmSettings = { sound: 'digital', volume: 0.5 };
        saveDataToCloud();
    }
    
    // Sincronizar UI con los datos de la base de datos
    document.getElementById('alarmSoundSelect').value = state.alarmSettings.sound;
    document.getElementById('alarmVolumeSlider').value = state.alarmSettings.volume;
}

// 2. Control de la Interfaz de Configuración
window.toggleAlarmConfig = () => {
    const panel = document.getElementById('alarmConfigPanel');
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
};

window.previewAndSaveAlarmSettings = () => {
    const sound = document.getElementById('alarmSoundSelect').value;
    const volume = document.getElementById('alarmVolumeSlider').value;
    
    // Guardar en la cuenta del usuario
    state.alarmSettings = { sound, volume: parseFloat(volume) };
    saveDataToCloud();

    // Reproducir vista previa (deteniendo el anterior si sonaba)
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    
    currentAudio = new Audio(SOUNDS[sound]);
    currentAudio.volume = state.alarmSettings.volume;
    currentAudio.play();
};

// 3. API PÚBLICA PARA DISPARAR LA ALARMA
// Llama a window.triggerSystemAlarm("Tomar agua", "Es vital", miFuncionCompletar) desde cualquier archivo
window.triggerSystemAlarm = (title, description, onCompleteCallback) => {
    document.getElementById('sysAlarmTitle').innerText = title || 'Alarma';
    document.getElementById('sysAlarmDesc').innerText = description || '';
    document.getElementById('sysAlarmModal').style.display = 'flex';
    
    activeCallback = onCompleteCallback;

    // Reproducir en bucle
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    
    const settings = state.alarmSettings || { sound: 'digital', volume: 0.5 };
    currentAudio = new Audio(SOUNDS[settings.sound]);
    currentAudio.volume = settings.volume;
    currentAudio.loop = true; // Sigue sonando hasta que el usuario responda
    
    // Manejo de errores por políticas de Autoplay del navegador
    currentAudio.play().catch(e => console.log("El navegador bloqueó el autoplay. El modal visual sí apareció."));
};

// 4. Respuestas del Usuario en el Modal
window.completeSystemAlarm = () => {
    stopAudioAndClose();
    if (activeCallback) activeCallback(); // Ejecuta la tarea ligada a la actividad
};

window.snoozeSystemAlarm = () => {
    stopAudioAndClose();
    // Vuelve a dispararse en 5 minutos (300,000 ms)
    const savedTitle = document.getElementById('sysAlarmTitle').innerText;
    const savedDesc = document.getElementById('sysAlarmDesc').innerText;
    const savedCallback = activeCallback;
    
    setTimeout(() => {
        window.triggerSystemAlarm(`(Pospuesto) ${savedTitle}`, savedDesc, savedCallback);
    }, 300000); 
};

function stopAudioAndClose() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    document.getElementById('sysAlarmModal').style.display = 'none';
}

// Escuchar cambios de estado global (al iniciar sesión, carga las config correctas)
window.addEventListener('stateChanged', () => {
    if(document.getElementById('alarmSoundSelect')) initAlarmSystem();
});
