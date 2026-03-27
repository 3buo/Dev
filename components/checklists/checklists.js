import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.tempChecklistItems = window.tempChecklistItems || [];
window.openChecklists = window.openChecklists || new Set();

window.addTempChecklistItem = () => { 
    const input = document.getElementById('clNewItem'); 
    if(input.value.trim() === '') return; 
    window.tempChecklistItems.push({ text: input.value, checked: false, checkedAt: null, editedAt: null }); 
    input.value = ''; window.renderTempChecklist(); 
}; 

window.renderTempChecklist = () => { 
    const ul = document.getElementById('clTempList'); if(!ul) return; ul.innerHTML = ''; 
    window.tempChecklistItems.forEach((item, i) => { 
        const li = document.createElement('li'); li.style.padding = "5px"; li.style.marginBottom = "5px"; 
        li.innerHTML = `<span style="flex-grow:1;">- ${item.text.substring(0,30)}...</span> <button onclick="window.tempChecklistItems.splice(${i},1); window.renderTempChecklist()" style="background:#cf6679; padding:2px 5px;">X</button>`; 
        ul.appendChild(li); 
    }); 
}; 

window.saveNewChecklist = () => { 
    const title = document.getElementById('clTitle').value; 
    if (title.trim() === '' || window.tempChecklistItems.length === 0) return alert("Título y 1 ítem min."); 
    state.checklists.push({ id: Date.now().toString(), title, items: [...window.tempChecklistItems], createdAt: new Date().toLocaleString('es-VE'), editedAt: null }); 
    document.getElementById('clTitle').value = ''; window.tempChecklistItems = []; 
    window.renderTempChecklist(); recordActivity(); saveDataToCloud(); window.renderChecklists(); 
}; 

window.renderChecklists = () => { 
    const pendingList = document.getElementById('clPending'), completedList = document.getElementById('clCompleted'); 
    if(!pendingList || !completedList) return; pendingList.innerHTML = ''; completedList.innerHTML = ''; 
    
    state.checklists.forEach((listData, listIndex) => { 
        const li = document.createElement('li'); li.style.flexDirection = 'column'; li.style.alignItems = 'flex-start'; 
        const isCompleted = listData.items.length > 0 && listData.items.every(item => item.checked); 
        const listId = listData.id || listData.createdAt; 
        const header = document.createElement('div'); header.className = 'note-header'; 
        let editMsg = listData.editedAt ? `<span style="font-size: 0.7em; color: var(--secondary);">Última modificación: ${listData.editedAt}</span>` : ''; 
        const isOpen = window.openChecklists.has(listId); const arrow = isOpen ? '▲' : '▼'; 
        header.innerHTML = `<div style="flex-grow: 1;"><strong>${listData.title}</strong><br><span class="task-date">Creado el: 📅 ${listData.createdAt}</span> <br> ${editMsg}</div><span style="font-size: 1.2em; color: var(--secondary);">${arrow}</span>`; 
        
        const btnBox = document.createElement('div'); btnBox.style.display = 'flex'; btnBox.style.gap = '5px'; 
        const editTitleBtn = document.createElement('button'); editTitleBtn.innerText = '📝'; editTitleBtn.style.background = '#444'; editTitleBtn.style.padding = '5px'; 
        editTitleBtn.onclick = (e) => { e.stopPropagation(); let newTitle = prompt("Editar Título:", listData.title); if(newTitle) { listData.title = newTitle; listData.editedAt = new Date().toLocaleString('es-VE'); saveDataToCloud(); window.renderChecklists(); } }; 
        const delBtn = document.createElement('button'); delBtn.innerText = 'X'; delBtn.style.background = '#cf6679'; delBtn.style.padding = '5px 10px'; 
        delBtn.onclick = (e) => { e.stopPropagation(); if(confirm("¿Borrar?")) { state.checklists.splice(listIndex, 1); saveDataToCloud(); window.renderChecklists(); } }; 
        btnBox.append(editTitleBtn, delBtn); header.appendChild(btnBox); 
        
        const body = document.createElement('div'); body.className = 'note-body'; body.style.display = isOpen ? 'block' : 'none'; 
        listData.items.forEach((item, itemIndex) => { 
            const itemDiv = document.createElement('div'); itemDiv.className = 'checklist-item'; 
            const topRow = document.createElement('div'); topRow.className = 'checklist-item-row'; 
            const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = item.checked; 
            cb.onchange = () => { item.checked = cb.checked; if(item.checked) { item.checkedAt = new Date().toLocaleString('es-VE'); recordActivity(); } else item.checkedAt = null; saveDataToCloud(); window.renderChecklists(); }; 
            const textDiv = document.createElement('div'); textDiv.className = 'markdown-content'; textDiv.style.flexGrow = '1'; 
            textDiv.innerHTML = window.parseMarkdown ? window.parseMarkdown(item.text) : item.text; // Dependencia suave de marked.js
            topRow.append(cb, textDiv); itemDiv.appendChild(topRow); body.appendChild(itemDiv); 
        }); 
        
        header.onclick = () => { const isHidden = body.style.display === 'none'; if (isHidden) { window.openChecklists.add(listId); body.style.display = 'block'; header.querySelector('span').innerText = '▲'; } else { window.openChecklists.delete(listId); body.style.display = 'none'; header.querySelector('span').innerText = '▼'; } }; 
        li.appendChild(header); li.appendChild(body); 
        isCompleted ? (li.classList.add('completed-task'), completedList.appendChild(li)) : pendingList.appendChild(li); 
    }); 
};

export function init() {
    window.renderChecklists();
    window.renderTempChecklist();
}

window.addEventListener('stateChanged', () => { if(document.getElementById('clPending')) init(); });