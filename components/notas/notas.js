import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

// Memoria temporal para recordar qué categorías minimizaste
window.collapsedCategories = window.collapsedCategories || new Set();

// --- FUNCIONES GLOBALES DE MARKDOWN ---
window.parseMarkdown = (text) => {
    if (!text) return "";
    let processed = text.replace(/\[\[(.*?)\]\]/g, '<span class="zk-link" onclick="window.searchAndOpenNote(\'$1\')">#$1</span>');
    return marked ? marked.parse(processed) : processed; 
};

window.activeTextarea = null;
const mdToolbar = document.getElementById('mdToolbar'); 
document.addEventListener('focusin', (e) => { if (e.target.tagName === 'TEXTAREA') { window.activeTextarea = e.target; const rect = e.target.getBoundingClientRect(); mdToolbar.style.display = 'flex'; mdToolbar.style.top = (rect.top + window.scrollY - 45) + 'px'; mdToolbar.style.left = rect.left + 'px'; } }); 
document.addEventListener('focusout', (e) => { if (e.target.tagName === 'TEXTAREA') { setTimeout(()=> mdToolbar.style.display = 'none', 150); } }); 

window.applyMd = (e, prefix, suffix) => { e.preventDefault(); if (!window.activeTextarea) return; const start = window.activeTextarea.selectionStart; const end = window.activeTextarea.selectionEnd; const text = window.activeTextarea.value; const selected = text.substring(start, end); window.activeTextarea.value = text.substring(0, start) + prefix + selected + suffix + text.substring(end); window.activeTextarea.focus(); window.activeTextarea.selectionStart = start + prefix.length; window.activeTextarea.selectionEnd = end + prefix.length; window.activeTextarea.dispatchEvent(new Event('input')); }; 
window.applyMdTable = (e) => { e.preventDefault(); if (!window.activeTextarea) return; const tableTemplate = "\n| Encabezado 1 | Encabezado 2 | Encabezado 3 |\n|---|---|---|\n| Dato 1 | Dato 2 | Dato 3 |\n| Dato 4 | Dato 5 | Dato 6 |\n\n"; const start = window.activeTextarea.selectionStart; const text = window.activeTextarea.value; window.activeTextarea.value = text.substring(0, start) + tableTemplate + text.substring(start); window.activeTextarea.focus(); window.activeTextarea.selectionStart = start + tableTemplate.length; window.activeTextarea.selectionEnd = start + tableTemplate.length; window.activeTextarea.dispatchEvent(new Event('input')); };

window.isEditingPreview = false; 
window.htmlTableToMd = (tableEl) => { let md = "\n"; const rows = tableEl.querySelectorAll('tr'); rows.forEach((row, rowIndex) => { let rowMd = "|"; const cells = row.querySelectorAll('th, td'); cells.forEach(cell => { let text = cell.innerText.replace(/\n/g, ' ').trim(); if(text === '') text = ' '; rowMd += " " + text + " |"; }); md += rowMd + "\n"; if (rowIndex === 0) { let sepMd = "|"; cells.forEach(() => { sepMd += "---|"; }); md += sepMd + "\n"; } }); return md + "\n"; }; 
window.syncTableToMd = (tableIndex, tableEl, textareaEl, forceRender = false) => { const tokens = marked.lexer(textareaEl.value); const tableTokens = tokens.filter(t => t.type === 'table'); if(!tableTokens[tableIndex]) return; const oldMd = tableTokens[tableIndex].raw; const newMd = window.htmlTableToMd(tableEl); textareaEl.value = textareaEl.value.replace(oldMd, newMd); if (forceRender) { window.isEditingPreview = false; textareaEl.dispatchEvent(new Event('input')); } }; 
window.modifyTable = (tableIndex, action, textareaEl, previewEl) => { const tables = previewEl.querySelectorAll('table'); const table = tables[tableIndex]; if(!table) return; const tbody = table.querySelector('tbody') || table; const thead = table.querySelector('thead'); if(action === 'addCol') { table.querySelectorAll('tr').forEach((row) => { const cell = document.createElement(row.parentNode === thead ? 'th' : 'td'); cell.innerText = 'Dato'; row.appendChild(cell); }); } else if(action === 'remCol') { table.querySelectorAll('tr').forEach(row => { if(row.children.length > 1) row.removeChild(row.lastElementChild); }); } else if(action === 'addRow') { const row = document.createElement('tr'); const colCount = table.querySelector('tr').children.length; for(let i=0; i<colCount; i++) { const cell = document.createElement('td'); cell.innerText = 'Dato'; row.appendChild(cell); } tbody.appendChild(row); } else if(action === 'remRow') { if(tbody.children.length > 1) tbody.removeChild(tbody.lastElementChild); } window.syncTableToMd(tableIndex, table, textareaEl, true); }; 
window.renderLivePreview = (textareaEl, previewEl) => { if (window.isEditingPreview) return; if(textareaEl.value.trim() !== '') { previewEl.style.display = 'block'; previewEl.innerHTML = window.parseMarkdown(textareaEl.value); } else { previewEl.style.display = 'none'; return; } const tables = previewEl.querySelectorAll('table'); const tokens = marked.lexer(textareaEl.value); const tableTokens = tokens.filter(t => t.type === 'table'); tables.forEach((table, i) => { if(!tableTokens[i]) return; const wrapper = document.createElement('div'); wrapper.className = 'table-editor-wrapper'; table.parentNode.insertBefore(wrapper, table); wrapper.appendChild(table); const controls = document.createElement('div'); controls.className = 'table-controls'; const addColBtn = document.createElement('button'); addColBtn.className = 't-btn'; addColBtn.innerText = '+ Columna'; addColBtn.onclick = () => window.modifyTable(i, 'addCol', textareaEl, previewEl); const remColBtn = document.createElement('button'); remColBtn.className = 't-btn t-btn-del'; remColBtn.innerText = '- Columna'; remColBtn.onclick = () => window.modifyTable(i, 'remCol', textareaEl, previewEl); const addRowBtn = document.createElement('button'); addRowBtn.className = 't-btn'; addRowBtn.innerText = '+ Fila'; addRowBtn.onclick = () => window.modifyTable(i, 'addRow', textareaEl, previewEl); const remRowBtn = document.createElement('button'); remRowBtn.className = 't-btn t-btn-del'; remRowBtn.innerText = '- Fila'; remRowBtn.onclick = () => window.modifyTable(i, 'remRow', textareaEl, previewEl); controls.append(addColBtn, remColBtn, addRowBtn, remRowBtn); wrapper.insertBefore(controls, table); table.querySelectorAll('th, td').forEach(cell => { cell.setAttribute('contenteditable', 'true'); cell.addEventListener('input', () => { window.isEditingPreview = true; window.syncTableToMd(i, table, textareaEl, false); window.isEditingPreview = false; }); }); }); };

// --- LÓGICA DE CATEGORÍAS, COLORES Y NOTAS ---

window.addNoteCategory = () => {
    const input = document.getElementById('newCategoryInput');
    const catName = input.value.trim();
    if (catName === '') return alert("Escribe un nombre para la categoría.");
    if (state.noteCategories.includes(catName) || catName === 'Sin clasificar') return alert("Esta categoría ya existe.");
    
    state.noteCategories.push(catName);
    input.value = '';
    saveDataToCloud();
    window.renderNotes();
};

window.deleteNoteCategory = (catName) => {
    if(!confirm(`¿Eliminar la categoría "${catName}"? Las notas se moverán a "Sin clasificar".`)) return;
    state.notes.forEach(n => { if (n.category === catName) n.category = 'Sin clasificar'; });
    state.noteCategories = state.noteCategories.filter(c => c !== catName);
    window.collapsedCategories.delete(catName); // Limpiar memoria de colapso
    saveDataToCloud();
    window.renderNotes();
};

window.toggleCategoryCollapse = (catName) => {
    if (window.collapsedCategories.has(catName)) {
        window.collapsedCategories.delete(catName);
    } else {
        window.collapsedCategories.add(catName);
    }
    window.renderNotes(); // Re-render rápido para aplicar estilos
};

window.addNote = () => { 
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value; 
    const category = document.getElementById('noteCategorySelect').value;
    const color = document.getElementById('noteColor').value;

    if (title.trim() === '' || content.trim() === '') return alert("Llenar campos."); 
    
    state.notes.push({ 
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        title, 
        content, 
        category,
        color, // Guardamos el color
        date: new Date().toLocaleString('es-VE'), 
        editedAt: null 
    }); 
    
    document.getElementById('noteTitle').value = ''; 
    document.getElementById('noteContent').value = ''; 
    document.getElementById('newNotePreview').style.display = 'none'; 
    recordActivity(); saveDataToCloud(); window.renderNotes();
};

window.renderNotes = () => { 
    if (!state.noteCategories) state.noteCategories = [];

    // Migración silenciosa: ID, Categoría y Color por defecto a notas viejas
    let needsSave = false;
    state.notes.forEach(n => {
        if (!n.id) { n.id = Date.now().toString() + Math.random().toString(36).substr(2, 5); needsSave = true; }
        if (!n.category) { n.category = 'Sin clasificar'; needsSave = true; }
        if (!n.color) { n.color = '#bb86fc'; needsSave = true; } // Por defecto morado si eran viejas
    });
    if (needsSave) saveDataToCloud();

    const catSelect = document.getElementById('noteCategorySelect');
    if (catSelect) {
        // Mantener la selección actual al re-dibujar
        const currentVal = catSelect.value;
        catSelect.innerHTML = '<option value="Sin clasificar">Sin clasificar</option>';
        state.noteCategories.forEach(cat => { catSelect.innerHTML += `<option value="${cat}">${cat}</option>`; });
        if (state.noteCategories.includes(currentVal) || currentVal === 'Sin clasificar') {
            catSelect.value = currentVal;
        }
    }

    const container = document.getElementById('categoriesContainer'); 
    if (!container) return; 
    container.innerHTML = ''; 

    const allCategories = ['Sin clasificar', ...state.noteCategories];

    allCategories.forEach(cat => {
        const catNotes = state.notes.filter(n => n.category === cat);
        const isCollapsed = window.collapsedCategories.has(cat);
        
        const catDiv = document.createElement('div');
        catDiv.className = 'note-category-box';
        
        const deleteCatBtn = cat !== 'Sin clasificar' ? `<button onclick="deleteNoteCategory('${cat}')" class="btn-del-cat" title="Borrar categoría">🗑️</button>` : '';
        const arrow = isCollapsed ? '▶' : '▼';

        catDiv.innerHTML = `
            <div class="category-header">
                <h3 onclick="toggleCategoryCollapse('${cat}')" style="cursor: pointer; user-select: none;">
                    <span style="color: #888; width: 20px; display: inline-block;">${arrow}</span> 
                    📁 ${cat} <span class="cat-count">${catNotes.length}</span>
                </h3>
                ${deleteCatBtn}
            </div>
            <ul class="notes-drag-list ${isCollapsed ? 'collapsed' : ''}" data-category="${cat}"></ul>
        `;
        container.appendChild(catDiv);

        const ul = catDiv.querySelector('ul');
        
        if (catNotes.length === 0 && !isCollapsed) {
            ul.innerHTML = `<div class="empty-cat-msg">Arrastra una nota aquí...</div>`;
        }

        [...catNotes].reverse().forEach((note) => { 
            const realIndex = state.notes.findIndex(n => n.id === note.id);
            if (realIndex === -1) return;

            const li = document.createElement('li'); 
            li.style.flexDirection = 'column'; li.style.alignItems = 'flex-start'; 
            li.dataset.id = note.id; 
            li.className = 'draggable-note';
            // Aplicar el color único de la nota a su borde izquierdo
            li.style.borderLeftColor = note.color;

            const header = document.createElement('div'); header.className = 'note-header'; 
            let editMsg = note.editedAt ? `<span style="font-size: 0.7em; color: var(--secondary);">Editada: ${note.editedAt}</span>` : ''; 
            header.innerHTML = `<div style="flex-grow: 1;"><strong>${note.title}</strong><br><span class="task-date">📅 ${note.date}</span> <br> ${editMsg}</div><span style="font-size: 1.2em; color: var(--secondary);">▼</span>`; 
            
            const btnBox = document.createElement('div'); btnBox.style.display = 'flex'; btnBox.style.gap = '5px'; btnBox.style.alignItems = 'center';
            
            // Selector de color integrado en cada nota para cambiar en vivo
            const inlineColor = document.createElement('input');
            inlineColor.type = 'color';
            inlineColor.value = note.color;
            inlineColor.className = 'inline-color-picker';
            inlineColor.title = "Cambiar color";
            inlineColor.onclick = (e) => e.stopPropagation(); // Evitar que se expanda la nota al clicar el color
            inlineColor.onchange = (e) => {
                state.notes[realIndex].color = e.target.value;
                saveDataToCloud();
                window.renderNotes(); // Repintar
            };

            const editBtn = document.createElement('button'); editBtn.innerText = '✏️'; editBtn.style.background = '#444'; editBtn.style.padding = '5px'; 
            const deleteBtn = document.createElement('button'); deleteBtn.innerText = 'X'; deleteBtn.style.background = '#cf6679'; deleteBtn.style.padding = '5px 10px'; 
            
            deleteBtn.onclick = (e) => { 
                e.stopPropagation(); 
                if(confirm("¿Borrar nota?")) { state.notes.splice(realIndex, 1); saveDataToCloud(); window.renderNotes(); } 
            }; 
            btnBox.append(inlineColor, editBtn, deleteBtn); header.appendChild(btnBox); 
            
            const body = document.createElement('div'); body.className = 'note-body markdown-content'; body.innerHTML = window.parseMarkdown(note.content); 
            const editArea = document.createElement('div'); editArea.style.display = 'none'; editArea.style.width = '100%'; editArea.style.marginTop = '15px'; 
            
            const editTitle = document.createElement('input'); editTitle.type = 'text'; editTitle.value = note.title; editTitle.style.width = '100%'; editTitle.style.marginBottom = '10px'; 
            const editText = document.createElement('textarea'); editText.value = note.content; editText.style.width = '100%'; editText.style.minHeight = '150px'; 
            
            const editPreview = document.createElement('div'); editPreview.className = 'markdown-content live-preview-box'; 
            editText.addEventListener('input', () => window.renderLivePreview(editText, editPreview)); 
            
            const saveEditBtn = document.createElement('button'); saveEditBtn.innerText = 'Guardar'; saveEditBtn.style.marginTop = '15px'; 
            saveEditBtn.onclick = () => { 
                if (editTitle.value.trim() === '' || editText.value.trim() === '') return; 
                state.notes[realIndex].title = editTitle.value; 
                state.notes[realIndex].content = editText.value; 
                state.notes[realIndex].editedAt = new Date().toLocaleString('es-VE'); 
                recordActivity(); saveDataToCloud(); window.renderNotes();
            }; 
            editArea.append(editTitle, editText, editPreview, saveEditBtn); 
            
            header.onclick = (e) => { 
                if(e.target === editBtn || e.target === inlineColor) return; 
                const isHidden = body.style.display === 'none' || body.style.display === ''; 
                body.style.display = isHidden ? 'block' : 'none'; editArea.style.display = 'none'; header.querySelector('span:last-child').innerText = isHidden ? '▲' : '▼'; 
            }; 
            editBtn.onclick = (e) => { 
                e.stopPropagation(); body.style.display = 'none'; editArea.style.display = 'block'; header.querySelector('span:last-child').innerText = '▲'; 
                window.renderLivePreview(editText, editPreview); 
            }; 
            li.appendChild(header); li.appendChild(body); li.appendChild(editArea); ul.appendChild(li); 
        }); 

        // Sortable.js: Funciona aunque esté minimizado
        Sortable.create(ul, {
            group: 'shared-notes-categories',
            animation: 150,
            ghostClass: 'sortable-ghost',
            delay: 100, 
            delayOnTouchOnly: true,
            onEnd: function (evt) {
                const itemEl = evt.item;  
                const newCategory = evt.to.dataset.category; 
                const noteId = itemEl.dataset.id; 

                const realIndex = state.notes.findIndex(n => n.id === noteId);
                if (realIndex !== -1 && state.notes[realIndex].category !== newCategory) {
                    state.notes[realIndex].category = newCategory;
                    recordActivity(); saveDataToCloud(); window.renderNotes();
                }
            }
        });
    });
};

window.searchAndOpenNote = (title) => { 
    if(window.switchTab) window.switchTab('notas'); 
    setTimeout(() => {
        const noteElements = document.querySelectorAll('.draggable-note'); 
        noteElements.forEach(li => { 
            const strongEl = li.querySelector('strong');
            if(strongEl && strongEl.textContent === title) { 
                // Si la categoría estaba minimizada, la expandimos para mostrar la nota
                const ul = li.closest('ul');
                if(ul && ul.classList.contains('collapsed')) {
                    window.toggleCategoryCollapse(ul.dataset.category);
                }
                
                setTimeout(() => {
                    li.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                    li.style.boxShadow = "0 0 15px var(--secondary)"; 
                    const body = li.querySelector('.note-body'); if (body) body.style.display = 'block';
                    setTimeout(() => li.style.boxShadow = "none", 2000); 
                }, 100);
            } 
        }); 
    }, 100);
};

export function init() {
    window.renderNotes();
    const noteContentInput = document.getElementById('noteContent'); 
    const notePreviewDiv = document.getElementById('newNotePreview'); 
    if(noteContentInput && !noteContentInput.dataset.listener) {
        noteContentInput.addEventListener('input', () => window.renderLivePreview(noteContentInput, notePreviewDiv));
        noteContentInput.dataset.listener = "true";
    }
}

window.addEventListener('stateChanged', () => { if(document.getElementById('categoriesContainer')) init(); });