import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

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

// --- HERRAMIENTAS MARKDOWN Y PREVIEW ZEN ---
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

window.toggleZenPreview = () => {
    const editor = document.getElementById('noteContent');
    const previewArea = document.getElementById('zenPreviewArea');
    const btn = document.getElementById('btnTogglePreview');
    const tableContainer = document.getElementById('mainTablesContainer');
    
    if (previewArea.style.display === 'none') {
        editor.style.display = 'none';
        tableContainer.style.display = 'none';
        previewArea.style.display = 'block';
        
        let htmlPreview = parseMarkdown(editor.value);
        if(tempMainTables.length > 0) htmlPreview += buildReadOnlyTablesHTML(tempMainTables);
        previewArea.innerHTML = htmlPreview || '<span style="color:#8b949e; font-style:italic;">Nota vacía...</span>';
        
        btn.innerHTML = '✏️ Seguir editando';
        btn.style.color = 'white'; btn.style.borderColor = 'var(--note-accent)';
    } else {
        editor.style.display = 'block';
        tableContainer.style.display = 'block';
        previewArea.style.display = 'none';
        btn.innerHTML = '👁️ Previsualizar nota';
        btn.style.color = ''; btn.style.borderColor = '';
    }
};

// --- GESTIÓN DE VISTAS (List vs Grid) ---
window.currentNotesView = 'grid'; // Default
window.changeViewFormat = (viewType) => {
    window.currentNotesView = viewType;
    const grid = document.getElementById('notesGrid');
    const btnGrid = document.getElementById('btnViewGrid');
    const btnList = document.getElementById('btnViewList');
    
    if(viewType === 'list') {
        grid.classList.add('list-view');
        btnList.classList.add('active'); btnGrid.classList.remove('active');
    } else {
        grid.classList.remove('list-view');
        btnGrid.classList.add('active'); btnList.classList.remove('active');
    }
};

// --- TABLAS MINIMALISTAS ---
let tempMainTables = []; let tempEditTables = []; 
function createEmptyTable() { return [ ["Columna 1", "Columna 2"], ["", ""] ]; }

function buildEditableTableHTML(tablesArray, containerId, prefix) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';

    tablesArray.forEach((matrix, tIndex) => {
        const wrapper = document.createElement('div');
        const controls = document.createElement('div');
        controls.className = 'table-controls';
        controls.innerHTML = `
            <button class="md-tool-btn" onclick="addCol('${prefix}', ${tIndex})">+ Col</button>
            <button class="md-tool-btn" onclick="addRow('${prefix}', ${tIndex})">+ Fila</button>
            <button class="md-tool-btn" onclick="delCol('${prefix}', ${tIndex})" style="color:#ff7b72;">- Col</button>
            <button class="md-tool-btn" onclick="delRow('${prefix}', ${tIndex})" style="color:#ff7b72;">- Fila</button>
            <button class="md-tool-btn" onclick="deleteTable('${prefix}', ${tIndex})" style="background:#da3633; color:white; margin-left:auto; border:none;">🗑️ Eliminar</button>
        `;
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'note-table-container';
        const table = document.createElement('table'); table.className = 'note-table';

        matrix.forEach((rowArray, rIndex) => {
            const tr = document.createElement('tr');
            rowArray.forEach((cellValue, cIndex) => {
                const cell = rIndex === 0 ? document.createElement('th') : document.createElement('td');
                const input = document.createElement('input'); input.type = 'text'; input.value = cellValue;
                input.oninput = (e) => {
                    tablesArray[tIndex][rIndex][cIndex] = e.target.value;
                    if(prefix === 'edit') window.updateLivePreview();
                };
                cell.appendChild(input); tr.appendChild(cell);
            });
            table.appendChild(tr);
        });

        tableContainer.appendChild(table); wrapper.append(controls, tableContainer); container.appendChild(wrapper);
    });
}

function buildReadOnlyTablesHTML(tablesArray) {
    if(!tablesArray || tablesArray.length === 0) return '';
    let html = '';
    tablesArray.forEach(matrix => {
        html += `<div class="note-table-container" style="margin-top:10px;"><table class="note-table">`;
        matrix.forEach((row, rIndex) => {
            html += `<tr>`;
            row.forEach(cell => {
                if(rIndex === 0) html += `<th>${cell}</th>`;
                else html += `<td><div style="padding: 10px; font-size:0.95em;">${cell}</div></td>`;
            });
            html += `</tr>`;
        });
        html += `</table></div>`;
    });
    return html;
}

window.addMainTable = () => { tempMainTables.push(createEmptyTable()); buildEditableTableHTML(tempMainTables, 'mainTablesContainer', 'main'); };
window.addEditTable = () => { tempEditTables.push(createEmptyTable()); buildEditableTableHTML(tempEditTables, 'editTablesContainer', 'edit'); window.updateLivePreview(); };
window.addRow = (prefix, idx) => { const arr = prefix === 'main' ? tempMainTables : tempEditTables; arr[idx].push(new Array(arr[idx][0].length).fill("")); buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix); if(prefix === 'edit') window.updateLivePreview(); };
window.addCol = (prefix, idx) => { const arr = prefix === 'main' ? tempMainTables : tempEditTables; arr[idx].forEach((r, i) => r.push(i === 0 ? "Nueva" : "")); buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix); if(prefix === 'edit') window.updateLivePreview(); };
window.delRow = (prefix, idx) => { const arr = prefix === 'main' ? tempMainTables : tempEditTables; if(arr[idx].length > 1) arr[idx].pop(); buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix); if(prefix === 'edit') window.updateLivePreview(); };
window.delCol = (prefix, idx) => { const arr = prefix === 'main' ? tempMainTables : tempEditTables; if(arr[idx][0].length > 1) arr[idx].forEach(r => r.pop()); buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix); if(prefix === 'edit') window.updateLivePreview(); };
window.deleteTable = (prefix, idx) => { const arr = prefix === 'main' ? tempMainTables : tempEditTables; arr.splice(idx, 1); buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix); if(prefix === 'edit') window.updateLivePreview(); };

// --- GESTIÓN CRUD DE NOTAS ---
window.saveNote = () => {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title && !content && tempMainTables.length === 0) return alert('La nota está vacía.');
    if (!state.notes) state.notes = [];
    
    state.notes.unshift({
        id: Date.now(), title: title || 'Sin Título', content: content,
        tables: JSON.parse(JSON.stringify(tempMainTables)),
        date: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        tags: analyzeSemantics(title + " " + content)
    });
    
    // Reset interfaz
    document.getElementById('noteTitle').value = ''; document.getElementById('noteContent').value = '';
    tempMainTables = []; buildEditableTableHTML(tempMainTables, 'mainTablesContainer', 'main');
    
    // Forzar salir de previsualización si estaba activa
    if(document.getElementById('zenPreviewArea').style.display === 'block') window.toggleZenPreview();
    
    recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph();
};

window.renderNotes = () => {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.notes || state.notes.length === 0) {
        grid.innerHTML = '<div style="color: #8b949e; width: 100%; text-align: center; grid-column: 1 / -1; padding: 40px;">No hay notas registradas.</div>';
        return;
    }

    state.notes.forEach((note, index) => {
        const card = document.createElement('div'); card.className = 'note-card';
        card.onclick = () => openNoteModal(index);

        const header = document.createElement('div'); header.className = 'card-header';
        header.innerHTML = `<div style="font-weight:bold; color:white; font-size:1.1em; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${note.title}</div><div style="font-size:0.75em; color:#8b949e;">${note.date}</div>`;

        const body = document.createElement('div'); body.className = 'card-body';
        let htmlContent = parseMarkdown(note.content);
        if(note.tables && note.tables.length > 0) htmlContent += buildReadOnlyTablesHTML(note.tables);
        body.innerHTML = htmlContent;

        const footer = document.createElement('div'); footer.className = 'card-footer';
        let tagsHtml = '';
        if(note.tags && note.tags.length > 0) note.tags.forEach(t => tagsHtml += `<span class="tag-chip">${t}</span>`);
        else tagsHtml = `<span class="tag-chip" style="color:#8b949e; border-color:transparent; background:rgba(255,255,255,0.05);">📝 Nota</span>`;
        footer.innerHTML = tagsHtml;

        card.append(header, body, footer); grid.appendChild(card);
    });
    handleTimeCapsule();
};

// --- MODAL Y PREVIEW ---
let currentEditIndex = null;
window.openNoteModal = (index) => {
    currentEditIndex = index; const note = state.notes[index];
    document.getElementById('editNoteTitle').value = note.title; document.getElementById('editNoteContent').value = note.content || '';
    tempEditTables = note.tables ? JSON.parse(JSON.stringify(note.tables)) : [];
    buildEditableTableHTML(tempEditTables, 'editTablesContainer', 'edit');
    window.updateLivePreview(); document.getElementById('noteModal').style.display = 'flex';
};
window.closeNoteModal = () => { document.getElementById('noteModal').style.display = 'none'; currentEditIndex = null; };
window.updateLivePreview = () => {
    document.getElementById('livePreviewMarkdown').innerHTML = parseMarkdown(document.getElementById('editNoteContent').value);
    document.getElementById('livePreviewTables').innerHTML = buildReadOnlyTablesHTML(tempEditTables);
};
window.updateNote = () => {
    if (currentEditIndex === null) return;
    const title = document.getElementById('editNoteTitle').value.trim(), content = document.getElementById('editNoteContent').value.trim();
    state.notes[currentEditIndex].title = title || 'Sin título'; state.notes[currentEditIndex].content = content;
    state.notes[currentEditIndex].tables = JSON.parse(JSON.stringify(tempEditTables));
    state.notes[currentEditIndex].tags = analyzeSemantics(title + " " + content);
    recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph(); closeNoteModal();
};
window.deleteNote = () => {
    if (currentEditIndex === null) return;
    if(confirm('¿Eliminar esta nota permanentemente?')) {
        state.notes.splice(currentEditIndex, 1);
        recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph(); closeNoteModal();
    }
};

// --- CÁPSULA Y CANVAS ---
function handleTimeCapsule() {
    const capsule = document.getElementById('timeCapsule');
    if (!state.notes || state.notes.length < 3) { capsule.style.display = 'none'; return; }
    if(Math.random() > 0.6) {
        capsule.style.display = 'block'; const randIndex = Math.floor(Math.random() * (state.notes.length - 2)) + 2;
        let preview = (state.notes[randIndex].content || state.notes[randIndex].title).substring(0, 100).replace(/\n/g, ' ');
        document.getElementById('tcContent').innerHTML = `<strong>${state.notes[randIndex].title}</strong>: "${preview}..."`;
        capsule.onclick = () => window.openNoteModal(randIndex);
    } else { capsule.style.display = 'none'; }
}

let graphAnimFrame, isGraphActive = false;
function updateMindGraph() {
    const canvas = document.getElementById('mindGraph'); if (!canvas) return; const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight;
    document.getElementById('graphStats').innerText = `${state.notes ? state.notes.length : 0} conexiones neuronales`;
    let particles = [];
    for(let i=0; i < Math.min((state.notes?.length||5), 40); i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1 });
    function animate() {
        if(!isGraphActive) return; ctx.clearRect(0, 0, canvas.width, canvas.height);
        for(let i=0; i < particles.length; i++) {
            let p = particles[i]; p.x += p.vx; p.y += p.vy;
            if(p.x < 0 || p.x > canvas.width) p.vx *= -1; if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = 'rgba(88, 166, 255, 0.8)'; ctx.fill();
            for(let j=i+1; j < particles.length; j++) {
                let dist = Math.sqrt(Math.pow(p.x - particles[j].x, 2) + Math.pow(p.y - particles[j].y, 2));
                if(dist < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(particles[j].x, particles[j].y); ctx.strokeStyle = `rgba(88, 166, 255, ${1 - dist/100})`; ctx.lineWidth = 0.5; ctx.stroke(); }
            }
        }
        graphAnimFrame = requestAnimationFrame(animate);
    }
    if(graphAnimFrame) cancelAnimationFrame(graphAnimFrame); isGraphActive = true; animate();
}

export function init() { 
    window.renderNotes(); 
    window.changeViewFormat(window.currentNotesView); // Aplicar vista guardada
    updateMindGraph(); 
}

window.addEventListener('stateChanged', () => { 
    if(!document.getElementById('view-notas')) { isGraphActive = false; if(graphAnimFrame) cancelAnimationFrame(graphAnimFrame); } 
    else { init(); }
});
