import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// --- SISTEMA DE ETIQUETADO SEMÁNTICO LOCAL ---
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

// --- MOTOR AUTO-MARKDOWN ---
function parseMarkdown(text) {
    if(!text) return '';
    let html = text
        .replace(/```([\s\S]*?)```/g, '<div class="md-code-block">$1</div>')
        .replace(/`([^`]+)`/g, '<span class="md-code-inline">$1</span>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h3 style="color:var(--note-accent); font-size:1.3em;">$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/^\- (.*$)/gim, '• $1<br>')
        .replace(/\n/g, '<br>');
    return `<div class="md-content">${html}</div>`;
}

// --- SISTEMA DE TABLAS TIPO EXCEL ---
let tempMainTables = []; 
let tempEditTables = []; 

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
            <button class="table-btn" onclick="addCol('${prefix}', ${tIndex})">+ Columna</button>
            <button class="table-btn" onclick="addRow('${prefix}', ${tIndex})">+ Fila</button>
            <button class="table-btn" onclick="delCol('${prefix}', ${tIndex})" style="color:#ff7b72;">- Columna</button>
            <button class="table-btn" onclick="delRow('${prefix}', ${tIndex})" style="color:#ff7b72;">- Fila</button>
            <button class="table-btn" onclick="deleteTable('${prefix}', ${tIndex})" style="background:#da3633; color:white; margin-left:auto;">🗑️ Tabla</button>
        `;
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'note-table-container';
        const table = document.createElement('table');
        table.className = 'note-table';

        matrix.forEach((rowArray, rIndex) => {
            const tr = document.createElement('tr');
            rowArray.forEach((cellValue, cIndex) => {
                const cell = rIndex === 0 ? document.createElement('th') : document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.value = cellValue;
                input.oninput = (e) => {
                    tablesArray[tIndex][rIndex][cIndex] = e.target.value;
                    if(prefix === 'edit') window.updateLivePreview();
                };
                cell.appendChild(input);
                tr.appendChild(cell);
            });
            table.appendChild(tr);
        });

        tableContainer.appendChild(table);
        wrapper.append(controls, tableContainer);
        container.appendChild(wrapper);
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
                else html += `<td><div style="padding: 8px; font-size:0.9em;">${cell}</div></td>`;
            });
            html += `</tr>`;
        });
        html += `</table></div>`;
    });
    return html;
}

window.addMainTable = () => { tempMainTables.push(createEmptyTable()); buildEditableTableHTML(tempMainTables, 'mainTablesContainer', 'main'); };
window.addEditTable = () => { tempEditTables.push(createEmptyTable()); buildEditableTableHTML(tempEditTables, 'editTablesContainer', 'edit'); window.updateLivePreview(); };

window.addRow = (prefix, tIndex) => {
    const arr = prefix === 'main' ? tempMainTables : tempEditTables;
    const cols = arr[tIndex][0].length;
    arr[tIndex].push(new Array(cols).fill(""));
    buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix);
    if(prefix === 'edit') window.updateLivePreview();
};
window.addCol = (prefix, tIndex) => {
    const arr = prefix === 'main' ? tempMainTables : tempEditTables;
    arr[tIndex].forEach((row, rIndex) => row.push(rIndex === 0 ? "Nueva Col" : ""));
    buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix);
    if(prefix === 'edit') window.updateLivePreview();
};
window.delRow = (prefix, tIndex) => {
    const arr = prefix === 'main' ? tempMainTables : tempEditTables;
    if(arr[tIndex].length > 1) arr[tIndex].pop();
    buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix);
    if(prefix === 'edit') window.updateLivePreview();
};
window.delCol = (prefix, tIndex) => {
    const arr = prefix === 'main' ? tempMainTables : tempEditTables;
    if(arr[tIndex][0].length > 1) arr[tIndex].forEach(row => row.pop());
    buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix);
    if(prefix === 'edit') window.updateLivePreview();
};
window.deleteTable = (prefix, tIndex) => {
    const arr = prefix === 'main' ? tempMainTables : tempEditTables;
    arr.splice(tIndex, 1);
    buildEditableTableHTML(arr, `${prefix}TablesContainer`, prefix);
    if(prefix === 'edit') window.updateLivePreview();
};


// --- GESTIÓN CRUD DE NOTAS ---

window.saveNote = () => {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title && !content && tempMainTables.length === 0) return alert('La nota está vacía.');
    if (!state.notes) state.notes = [];
    
    const tablesToSave = JSON.parse(JSON.stringify(tempMainTables));

    const newNote = {
        id: Date.now(),
        title: title || 'Sin Título',
        content: content,
        tables: tablesToSave,
        date: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }),
        tags: analyzeSemantics(title + " " + content)
    };

    state.notes.unshift(newNote);
    
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    tempMainTables = [];
    buildEditableTableHTML(tempMainTables, 'mainTablesContainer', 'main');
    
    recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph();
};

window.renderNotes = () => {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.notes || state.notes.length === 0) {
        grid.innerHTML = '<div style="color: #8b949e; width: 100%; text-align: center; grid-column: 1 / -1; padding: 40px;">No hay notas. Escribe algo arriba para comenzar.</div>';
        return;
    }

    state.notes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.onclick = () => openNoteModal(index);

        const header = document.createElement('div');
        header.style.marginBottom = '10px';
        header.innerHTML = `
            <div style="font-weight:bold; color:white; font-size:1.1em; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${note.title}</div>
            <div style="font-size:0.75em; color:#8b949e;">${note.date}</div>
        `;

        const body = document.createElement('div');
        body.style.flexGrow = '1'; body.style.overflow = 'hidden';
        body.style.maskImage = 'linear-gradient(to bottom, black 50%, transparent 100%)';
        body.style.webkitMaskImage = '-webkit-linear-gradient(top, black 50%, transparent 100%)';
        
        let htmlContent = parseMarkdown(note.content);
        if(note.tables && note.tables.length > 0) {
            htmlContent += buildReadOnlyTablesHTML(note.tables);
        }
        body.innerHTML = htmlContent;

        const footer = document.createElement('div');
        footer.style.marginTop = '15px';
        let tagsHtml = '';
        if(note.tags && note.tags.length > 0) {
            note.tags.forEach(t => tagsHtml += `<span class="tag-chip">${t}</span>`);
        } else {
            tagsHtml = `<span class="tag-chip" style="color:#8b949e; border-color:transparent; background:rgba(255,255,255,0.05);">📝 Nota</span>`;
        }
        footer.innerHTML = tagsHtml;

        card.append(header, body, footer);
        grid.appendChild(card);
    });

    handleTimeCapsule();
};

// --- MODAL DE EDICIÓN Y LIVE PREVIEW ---
let currentEditIndex = null;

window.openNoteModal = (index) => {
    currentEditIndex = index;
    const note = state.notes[index];
    
    document.getElementById('editNoteTitle').value = note.title;
    document.getElementById('editNoteContent').value = note.content || '';
    
    tempEditTables = note.tables ? JSON.parse(JSON.stringify(note.tables)) : [];
    buildEditableTableHTML(tempEditTables, 'editTablesContainer', 'edit');
    
    window.updateLivePreview();
    document.getElementById('noteModal').style.display = 'flex';
};

window.closeNoteModal = () => { document.getElementById('noteModal').style.display = 'none'; currentEditIndex = null; };

window.updateLivePreview = () => {
    const rawContent = document.getElementById('editNoteContent').value;
    document.getElementById('livePreviewMarkdown').innerHTML = parseMarkdown(rawContent);
    document.getElementById('livePreviewTables').innerHTML = buildReadOnlyTablesHTML(tempEditTables);
};

window.updateNote = () => {
    if (currentEditIndex === null) return;
    const title = document.getElementById('editNoteTitle').value.trim();
    const content = document.getElementById('editNoteContent').value.trim();
    
    state.notes[currentEditIndex].title = title || 'Sin título';
    state.notes[currentEditIndex].content = content;
    state.notes[currentEditIndex].tables = JSON.parse(JSON.stringify(tempEditTables));
    state.notes[currentEditIndex].tags = analyzeSemantics(title + " " + content);
    
    recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph(); closeNoteModal();
};

window.deleteNote = () => {
    if (currentEditIndex === null) return;
    if(confirm('¿Eliminar esta nota para siempre?')) {
        state.notes.splice(currentEditIndex, 1);
        recordActivity(); saveDataToCloud(); window.renderNotes(); updateMindGraph(); closeNoteModal();
    }
};

// --- CÁPSULA DEL TIEMPO ---
function handleTimeCapsule() {
    const capsule = document.getElementById('timeCapsule');
    if (!state.notes || state.notes.length < 3) { capsule.style.display = 'none'; return; }
    
    if(Math.random() > 0.6) {
        capsule.style.display = 'block';
        const randIndex = Math.floor(Math.random() * (state.notes.length - 2)) + 2;
        const oldNote = state.notes[randIndex];
        
        let preview = (oldNote.content || oldNote.title).substring(0, 100).replace(/\n/g, ' ');
        if(preview.length === 100) preview += '...';
        
        document.getElementById('tcContent').innerHTML = `<strong>${oldNote.title}</strong>: "${preview}"`;
        capsule.onclick = () => window.openNoteModal(randIndex);
    } else {
        capsule.style.display = 'none';
    }
}

// --- RED DE PENSAMIENTO (Canvas 3D) ---
let graphAnimFrame;
let isGraphActive = false;

function updateMindGraph() {
    const canvas = document.getElementById('mindGraph');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const numNodes = state.notes ? Math.max(state.notes.length, 5) : 5;
    document.getElementById('graphStats').innerText = `${state.notes ? state.notes.length : 0} conexiones neuronales`;

    let particles = [];
    for(let i=0; i < Math.min(numNodes, 40); i++) {
        particles.push({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1
        });
    }

    function animate() {
        if(!isGraphActive) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for(let i=0; i < particles.length; i++) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy;
            
            if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if(p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(88, 166, 255, 0.8)'; ctx.fill();

            for(let j=i+1; j < particles.length; j++) {
                let p2 = particles[j];
                let dist = Math.sqrt(Math.pow(p.x - p2.x, 2) + Math.pow(p.y - p2.y, 2));
                if(dist < 100) {
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(88, 166, 255, ${1 - dist/100})`; ctx.lineWidth = 0.5; ctx.stroke();
                }
            }
        }
        graphAnimFrame = requestAnimationFrame(animate);
    }
    if(graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
    isGraphActive = true; animate();
}

export function init() { window.renderNotes(); updateMindGraph(); }

window.addEventListener('stateChanged', () => { 
    if(!document.getElementById('view-notas')) { 
        isGraphActive = false; 
        if(graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
    } else {
        init();
    }
});
