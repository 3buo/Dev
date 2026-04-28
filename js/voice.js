import { state, saveDataToCloud, recordActivity, notifyStateChange } from './store.js';

let voiceRecognition = null;
let isRecording = false;

function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Tu navegador no soporta reconocimiento de voz."); return null; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES'; recognition.interimResults = true; recognition.continuous = true; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
        let interim = '', final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
        }
        if (interim) { document.getElementById('voiceText').innerText = interim; document.getElementById('voiceTranscript').style.display = 'block'; }
        if (final) { document.getElementById('voiceText').innerText = final; processVoiceCommand(final.trim()); }
    };
    recognition.onerror = () => stopVoiceRecording();
    recognition.onend = () => { if (isRecording) try { recognition.start(); } catch(e) {} };
    return recognition;
}

function processVoiceCommand(text) {
    const lower = text.toLowerCase();
    if (lower.startsWith('tarea ') || lower.startsWith('agregar tarea ')) {
        const tText = text.replace(/^(tarea|agregar tarea)\s+/i, '');
        state.tasks.push({ text: tText, date: new Date().toISOString().split('T')[0], priority: 'Media', completed: false });
        recordActivity(); saveDataToCloud(); notifyStateChange(); showVoiceFeedback('✅ Tarea agregada: ' + tText);
    } else if (lower.startsWith('nota ')) {
        const nText = text.replace(/^(nota)\s+/i, '');
        state.notes.push({ title: 'Nota de Voz', content: nText, date: new Date().toLocaleString('es-VE'), editedAt: null });
        recordActivity(); saveDataToCloud(); notifyStateChange(); showVoiceFeedback('📓 Nota guardada');
    } else if (lower.includes('ir a ')) {
        if(lower.includes('actividades')) window.switchTab('actividades');
        if(lower.includes('notas')) window.switchTab('notas');
        if(lower.includes('finanzas')) window.switchTab('finanzas');
        showVoiceFeedback('Navegando...');
    } else {
        state.tasks.push({ text: text, date: new Date().toISOString().split('T')[0], priority: 'Media', completed: false });
        recordActivity(); saveDataToCloud(); notifyStateChange(); showVoiceFeedback('📝 Tarea rápida: ' + text);
    }
}

function showVoiceFeedback(msg) {
    document.getElementById('voiceTranscript').style.display = 'block';
    document.getElementById('voiceText').innerText = msg;
    setTimeout(() => { if (!isRecording) document.getElementById('voiceTranscript').style.display = 'none'; }, 3000);
}

function stopVoiceRecording() {
    isRecording = false; if (voiceRecognition) try { voiceRecognition.stop(); } catch(e) {}
    document.getElementById('fab-mic').classList.remove('recording');
    setTimeout(() => document.getElementById('voiceTranscript').style.display = 'none', 2000);
}

window.toggleVoiceNLP = () => {
    if (isRecording) { stopVoiceRecording(); return; }
    if (!voiceRecognition) { voiceRecognition = initVoiceRecognition(); if (!voiceRecognition) return; }
    isRecording = true; document.getElementById('fab-mic').classList.add('recording');
    document.getElementById('voiceTranscript').style.display = 'block'; document.getElementById('voiceText').innerText = 'Escuchando...';
    try { voiceRecognition.start(); } catch(e) { voiceRecognition.stop(); setTimeout(() => { try { voiceRecognition.start(); } catch(e2) {} }, 100); }
};