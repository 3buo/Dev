import { state, saveDataToCloud, recordActivity, deleteDataFromCloud } from '../../js/store.js';

// --- SISTEMA SEMÁNTICO ---
const semanticTags = [
    { name: '🛒 Compras', keywords: ['comprar', 'mercado', 'precio', 'tienda', 'pago', 'factura'] },
    { name: '💼 Trabajo', keywords: ['jefe', 'reunión', 'proyecto', 'oficina', 'cliente', 'reporte'] },
    { name: '💡 Ideas', keywords: ['idea', 'pensar', 'inventar', 'crear'] },
    { name: '📚 Estudio', keywords: ['tarea', 'examen', 'leer', 'aprender', 'curso'] },
    { name: '💻 Código', keywords: ['script', 'html', 'javascript', 'bug', 'error', '```'] }
];

function analyzeSemantics(text) {
    const textLower = text.toLowerCase();
    let tagsFound = [];
    semanticTags.forEach(category => {
        if (category.keywords.some(kw => textLower.includes(kw))) tagsFound.push(category.name);
    });
    return tagsFound;
}

// --- HERRAMIENTAS MARKDOWN ---
window.insertMD = (prefix, suffix, targetId) => {
    const textarea = document.getElementById(targetId);
    if(!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
    textarea.focus();
    textarea.selectionStart = start + prefix.length;
    textarea.selectionEnd = end + prefix.length;
    
    if(targetId === 'editNoteContent') window.updateLivePreview();
};

function parseMarkdown(text) {
    if(!text) return '';
    let html = text
        .replace(/```([\s\S]*?)```/g, '<div class="md-code-block">$1</div>')
        .replace(/`([^`]+)`/g, '<span class="md-code-inline">$1</span>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h3 style="color:var(--note-accent); font-size:1.3em;">$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/_(.*)_/gim, '<em>$1</em>')
        .replace(/^\- (.*$)/gim, '• $1<br>')
        .replace(/\n/g, '<br>');
    return `<div class="md-content">${html}</div>`;
}

// --- GESTIÓN DE NOTAS ---
let tempMainTables = []; let tempEditTables = [];

window.saveNote = async () => {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title && !content && tempMainTables.length === 0) return alert('La nota está vacía.');
    if (!state.notas) state.notas = [];
    
    const newNote = {
        id: crypto.randomUUID(), 
        title: title || 'Sin Título', 
        content: content,
        tables: JSON.parse(JSON.stringify(tempMainTables)),
        date: new Date().toISOString().slice(0, 10),
        tags: analyzeSemantics(title + " " + content)
    };
    
    state.notas.unshift(newNote);
    document.getElementById('noteTitle').value = ''; 
    document.getElementById('noteContent').value = '';
    tempMainTables = []; 
    buildEditableTableHTML(tempMainTables, 'mainTablesContainer', 'main');
    
    recordActivity(); 
    await saveDataToCloud('notas', newNote);
    window.renderNotes(); 
};

window.renderNotes = () => {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    (state.notas || []).forEach((note, index) => {
        const card = document.createElement('div'); card.className = 'note-card';
        card.addEventListener('click', () => openNoteModal(note.id));
        card.innerHTML = `<h3>${note.title}</h3><p>${note.date}</p>`;
        grid.appendChild(card);
    });
};

// --- EDICIÓN Y MODALES ---
let currentEditNoteId = null;
window.openNoteModal = (noteId) => {
    const note = (state.notas || []).find(n => n.id === noteId);
    if (!note) return;
    currentEditNoteId = noteId;
    document.getElementById('editNoteTitle').value = note.title; 
    document.getElementById('editNoteContent').value = note.content || '';
    tempEditTables = note.tables ? JSON.parse(JSON.stringify(note.tables)) : [];
    buildEditableTableHTML(tempEditTables, 'editTablesContainer', 'edit');
    document.getElementById('noteModal').style.display = 'flex';
};

window.updateNote = async () => {
    const note = (state.notas || []).find(n => n.id === currentEditNoteId);
    if (!note) return;
    note.title = document.getElementById('editNoteTitle').value.trim() || 'Sin título';
    note.content = document.getElementById('editNoteContent').value.trim();
    note.tables = JSON.parse(JSON.stringify(tempEditTables));
    
    await saveDataToCloud('notas', note);
    window.renderNotes();
    document.getElementById('noteModal').style.display = 'none';
};

window.deleteNote = async () => {
    if(confirm('¿Eliminar esta nota?')) {
        await deleteDataFromCloud('notas', currentEditNoteId);
        state.notas = state.notas.filter(n => n.id !== currentEditNoteId);
        window.renderNotes();
        document.getElementById('noteModal').style.display = 'none';
    }
};

// --- TABLAS ---
function buildEditableTableHTML(tablesArray, containerId, prefix) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    tablesArray.forEach((matrix, tIndex) => {
        const wrapper = document.createElement('div');
        // Usamos botones con IDs genéricos o data-attributes para blindaje
        wrapper.innerHTML = `<button class="md-tool-btn" data-action="delete" data-index="${tIndex}">🗑️</button>`;
        container.appendChild(wrapper);
        wrapper.querySelector('button').addEventListener('click', () => {
            tablesArray.splice(tIndex, 1);
            buildEditableTableHTML(tablesArray, containerId, prefix);
        });
    });
}

// --- INICIALIZACIÓN ---
export function init() {
    window.renderNotes();
    document.getElementById('btnSaveNote')?.addEventListener('click', window.saveNote);
    document.getElementById('btnEditSave')?.addEventListener('click', window.updateNote);
    document.getElementById('btnEditDelete')?.addEventListener('click', window.deleteNote);
}

window.addEventListener('stateChanged', () => { if(document.getElementById('view-notas')) init(); });