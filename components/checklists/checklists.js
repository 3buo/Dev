import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

window.createChecklist = () => {
    const title = document.getElementById('clTitle').value;
    if (!title) return alert("Escribe un título para la lista");
    if (!state.checklists) state.checklists = [];
    
    state.checklists.unshift({ id: Date.now(), title, items: [] });
    document.getElementById('clTitle').value = '';
    
    recordActivity();
    saveDataToCloud();
    window.renderChecklists();
};

window.addClItem = (clIndex) => {
    const input = document.getElementById(`clItemInput-${clIndex}`);
    if (!input.value) return;
    
    state.checklists[clIndex].items.push({ text: input.value, checked: false });
    input.value = '';
    
    recordActivity();
    saveDataToCloud();
    window.renderChecklists();
};

window.toggleClItem = (clIndex, itemIndex) => {
    state.checklists[clIndex].items[itemIndex].checked = !state.checklists[clIndex].items[itemIndex].checked;
    saveDataToCloud();
    window.renderChecklists();
};

window.deleteChecklist = (clIndex) => {
    if(confirm("¿Eliminar esta lista por completo?")) {
        state.checklists.splice(clIndex, 1);
        saveDataToCloud();
        window.renderChecklists();
    }
};

// --- SISTEMA DE EDICIÓN PROFUNDA ---
let currentEditItems = [];

window.openEditClModal = (clIndex) => {
    const cl = state.checklists[clIndex];
    document.getElementById('editClIndex').value = clIndex;
    document.getElementById('editClTitle').value = cl.title;
    
    // Clonación profunda para no alterar los datos reales si el usuario presiona "Cancelar"
    currentEditItems = JSON.parse(JSON.stringify(cl.items)); 
    
    window.renderEditClItems();
    document.getElementById('editClModal').style.display = 'flex';
};

window.closeEditClModal = () => {
    document.getElementById('editClModal').style.display = 'none';
};

window.renderEditClItems = () => {
    const container = document.getElementById('editClItems');
    container.innerHTML = '';
    
    if(currentEditItems.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 0.9em; text-align: center; padding: 10px;">No hay elementos aún. Añade uno abajo.</div>';
    }
    
    currentEditItems.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.style.alignItems = 'center';
        
        div.innerHTML = `
            <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleEditClItem(${i})" style="transform: scale(1.3); margin-right: 5px;">
            <input type="text" value="${item.text}" oninput="updateEditClItemText(${i}, this.value)" style="flex-grow: 1; padding: 8px; background: #2c2c2c; border: 1px solid #444; color: white; border-radius: 4px;">
            <button onclick="removeEditClItem(${i})" style="background: #cf6679; padding: 8px 12px; font-weight: bold; border-radius: 4px;">X</button>
        `;
        container.appendChild(div);
    });
};

window.updateEditClItemText = (i, val) => { currentEditItems[i].text = val; };
window.toggleEditClItem = (i) => { currentEditItems[i].checked = !currentEditItems[i].checked; };
window.removeEditClItem = (i) => { currentEditItems.splice(i, 1); window.renderEditClItems(); };

window.addEditClItem = () => {
    const input = document.getElementById('editClNewItem');
    const val = input.value.trim();
    if(!val) return;
    
    currentEditItems.push({text: val, checked: false});
    input.value = '';
    window.renderEditClItems();
    
    // Auto-scroll al final de la lista de items
    const modalContainer = document.querySelector('#editClModal .container');
    modalContainer.scrollTop = modalContainer.scrollHeight;
};

window.saveEditChecklist = () => {
    const clIndex = document.getElementById('editClIndex').value;
    const newTitle = document.getElementById('editClTitle').value.trim();
    
    if(!newTitle) return alert("La lista debe tener un título.");
    
    // Limpiar items vacíos
    const cleanItems = currentEditItems.filter(item => item.text.trim() !== '');

    state.checklists[clIndex].title = newTitle;
    state.checklists[clIndex].items = cleanItems;
    
    recordActivity();
    saveDataToCloud();
    window.closeEditClModal();
    window.renderChecklists();
};

window.renderChecklists = () => {
    if (!state.checklists) state.checklists = [];
    const container = document.getElementById('checklistsContainer');
    if(!container) return;
    container.innerHTML = '';

    state.checklists.forEach((cl, clIndex) => {
        const card = document.createElement('div');
        card.className = 'container';
        card.style.borderTop = '3px solid var(--secondary)';
        
        let itemsHtml = cl.items.map((item, i) => `
            <div class="checklist-item" style="flex-direction: row; align-items: center; background: #222; margin-bottom: 5px; padding: 10px; border-radius: 6px;">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleClItem(${clIndex}, ${i})" style="transform: scale(1.3); margin-right: 10px;">
                <span style="${item.checked ? 'text-decoration: line-through; color: #666;' : 'color: white;'} flex-grow: 1; font-size: 1.1em;">${item.text}</span>
            </div>
        `).join('');

        if(cl.items.length === 0) itemsHtml = '<div style="color:#666; font-size:0.9em; margin-bottom: 10px;">Lista vacía.</div>';

        card.innerHTML = `
            <h2 style="margin-bottom: 15px; font-size: 1.3em;">
                ${cl.title}
                <div style="display: flex; gap: 8px;">
                    <button onclick="openEditClModal(${clIndex})" style="font-size: 0.7em; padding: 6px 12px; background: rgba(3, 218, 198, 0.2); border: 1px solid var(--secondary); color: var(--secondary);">✏️ Editar</button>
                    <button onclick="deleteChecklist(${clIndex})" style="font-size: 0.7em; padding: 6px 12px; background: #cf6679; color: black;">🗑️</button>
                </div>
            </h2>
            
            <div style="margin-bottom: 15px; max-height: 300px; overflow-y: auto;">
                ${itemsHtml}
            </div>
            
            <div class="input-group" style="margin-bottom: 0;">
                <input type="text" id="clItemInput-${clIndex}" placeholder="Nuevo elemento rápido..." onkeypress="if(event.key === 'Enter') addClItem(${clIndex})">
                <button onclick="addClItem(${clIndex})">Añadir</button>
            </div>
        `;
        container.appendChild(card);
    });
};

export function init() {
    window.renderChecklists();
}

window.addEventListener('stateChanged', () => { 
    if(document.getElementById('checklistsContainer')) init(); 
});
