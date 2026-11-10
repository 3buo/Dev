// ==========================================================================
// MÓDULO DE ALARMAS Y NOTIFICACIONES (INDEPENDIENTE)
// Cola de alarmas: nunca se sobrescribe una alarma activa; las siguientes
// suenan en orden al resolver la actual. Snooze respeta la configuración
// del recordatorio (snoozeMins). Fallback: beep sintetizado (WebAudio)
// si el navegador bloquea el audio o no hay red. (DESIGN_SPEC.md §5.3)
// ==========================================================================
import { saveDataToCloud } from '../../js/store.js';

const SOUNDS = {
    digital: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    bell: 'https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg',
    scifi: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'
};

let currentAudio = null;
let activeCallback = null;
let isRinging = false;
let alarmQueue = [];
let beepTimer = null;
let beepCtx = null;

// --- Preferencias locales (sonido/volumen) ---
function getAlarmSettings() {
    try {
        const saved = localStorage.getItem('taskify_alarm_prefs');
        return saved ? JSON.parse(saved) : { sound: 'digital', volume: 0.5 };
    } catch (e) {
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
    if (soundSelect) soundSelect.value = settings.sound;
    if (volSlider) volSlider.value = settings.volume;
}

window.toggleAlarmConfig = () => {
    const panel = document.getElementById('alarmConfigPanel');
    if (panel) {
        const open = panel.style.display !== 'flex';
        panel.style.display = open ? 'flex' : 'none';
        const btn = document.querySelector('.alarm-floating-btn');
        if (btn) btn.setAttribute('aria-expanded', String(open));
    }
};

window.previewAndSaveAlarmSettings = () => {
    const sound = document.getElementById('alarmSoundSelect').value;
    const volume = parseFloat(document.getElementById('alarmVolumeSlider').value);
    saveAlarmSettings({ sound, volume });
    stopAlarmAudio();
    currentAudio = new Audio(SOUNDS[sound]);
    currentAudio.volume = volume;
    currentAudio.play().catch(() => playFallbackBeep(volume, false));
};

// --- Beep sintetizado de respaldo (WebAudio, sin red ni permisos) ---
function beepOnce(ctx, volume, t) {
    try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(volume * 0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.2);
    } catch (e) { /* sin soporte: silencio */ }
}

function playFallbackBeep(volume, loop) {
    stopBeep();
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        beepCtx = new Ctx();
        beepCtx.resume().catch(() => {});
        const pattern = () => {
            const t = beepCtx.currentTime;
            beepOnce(beepCtx, volume, t);
            beepOnce(beepCtx, volume, t + 0.22);
            beepOnce(beepCtx, volume, t + 0.44);
        };
        pattern();
        if (loop) beepTimer = setInterval(pattern, 1500);
    } catch (e) { /* sin audio */ }
}

function stopBeep() {
    if (beepTimer) { clearInterval(beepTimer); beepTimer = null; }
    if (beepCtx) { try { beepCtx.close(); } catch (e) {} beepCtx = null; }
}

function stopAlarmAudio() {
    if (currentAudio) {
        try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) {}
        currentAudio = null;
    }
    stopBeep();
}

function playAlarm(settings) {
    stopAlarmAudio();
    if (window.navigator.vibrate) { try { window.navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {} }
    currentAudio = new Audio(SOUNDS[settings.sound] || SOUNDS.digital);
    currentAudio.volume = settings.volume ?? 0.5;
    currentAudio.loop = true;
    currentAudio.play().catch(() => playFallbackBeep(settings.volume ?? 0.5, true));
    currentAudio.addEventListener('error', () => playFallbackBeep(settings.volume ?? 0.5, true));
}

// --- API GLOBAL: cola de alarmas ---
window.triggerSystemAlarm = (title, description, onCompleteCallback, target) => {
    alarmQueue.push({ title, description, onComplete: onCompleteCallback, target: target || null });
    if (!isRinging) showNextAlarm();
};

function showNextAlarm() {
    if (alarmQueue.length === 0) { isRinging = false; return; }
    isRinging = true;
    const entry = alarmQueue.shift();

    window.__activeAlarmTarget = entry.target;
    activeCallback = entry.onComplete;

    const titleEl = document.getElementById('sysAlarmTitle');
    const descEl = document.getElementById('sysAlarmDesc');
    const modalEl = document.getElementById('sysAlarmModal');
    const snoozeBtn = document.getElementById('sysAlarmSnoozeBtn');
    const doneBtn = document.getElementById('sysAlarmDoneBtn');

    if (titleEl) titleEl.innerText = entry.title || 'Alarma';
    if (descEl) descEl.innerText = entry.description || '';
    const snoozeMins = entry.target?.snoozeMins ?? 5;
    if (snoozeBtn) snoozeBtn.innerText = `Posponer ${snoozeMins} min`;
    if (modalEl) modalEl.style.display = 'flex';

    playAlarm(getAlarmSettings());

    // Foco en la acción principal para operar con teclado
    setTimeout(() => { try { (doneBtn || snoozeBtn)?.focus(); } catch (e) {} }, 50);
}

window.completeSystemAlarm = () => {
    const cb = activeCallback;
    activeCallback = null;
    window.__activeAlarmTarget = null;
    if (cb) { try { cb(); } catch (e) { console.warn('alarm callback', e); } }
    if (alarmQueue.length > 0) { showNextAlarm(); }        // siguiente alarma en cola
    else { isRinging = false; stopAlarmAudio(); hideAlarmModal(); }
};

window.snoozeSystemAlarm = () => {
    const target = window.__activeAlarmTarget;
    if (target) {
        // Respeta el snooze configurado por el usuario en el recordatorio (5/10/15/30 min)
        const mins = target.snoozeMins ?? 5;
        target.snoozeUntil = Date.now() + mins * 60000;
        target._ringing = false;      // permiso para volver a sonar tras la pausa
        if (target.notified !== undefined) target.notified = false;
        saveDataToCloud();
    }
    window.__activeAlarmTarget = null;
    activeCallback = null;
    if (alarmQueue.length > 0) { showNextAlarm(); }
    else { isRinging = false; stopAlarmAudio(); hideAlarmModal(); }
};

function hideAlarmModal() {
    const modal = document.getElementById('sysAlarmModal');
    if (modal) modal.style.display = 'none';
}

// Inicializar automáticamente
initAlarmSystem();
