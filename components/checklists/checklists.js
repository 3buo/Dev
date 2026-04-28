import { state, saveDataToCloud, recordActivity, deleteDataFromCloud } from '../../js/store.js';

// --- GESTIÓN DE CHECKLISTS ---
window.createChecklist = async () => {
    const titleInput = document.getElementById('clTitle');
    if (!titleInput || !titleInput.value) return alert("Escribe un título para la lista");
    
    const newChecklist = { 
        id: crypto.randomUUID(),
        title: titleInput.value, 
        items: [] 
    };
    
    if (!state.checklists) state.checklists = [];
    state.checklists.unshift(newChecklist);
    
    titleInput.value = '';
    
    recordActivity();
    await saveDataToCloud('checklists', newChecklist);
    window.renderChecklists();
};

window.addClItem = async (checklistId) => {
    const clIndex = (state.checklists || []).findIndex(cl => cl.id === checklistId);
    if (clIndex === -1) return;

    const input = document.getElementById(`clItemInput-${checklistId}`);
    if (!input || !input.value) return;
    
    state.checklists[clIndex].items.push({ text: input.value, checked: false });
    input.value = '';
    
    recordActivity();
    await saveDataToCloud('checklists', state.checklists[clIndex]);
    window.renderChecklists();
};

window.toggleClItem = async (checklistId, itemIndex) => {
    const clIndex = (state.checklists || []).findIndex(cl => cl.id === checklistId);
    if (clIndex === -1) return;

    state.checklists[clIndex].items[itemIndex].checked = !state.checklists[clIndex].items[itemIndex].checked;
    await saveDataToCloud('checklists', state.checklists[clIndex]);
    window.renderChecklists();
};

window.deleteChecklist = async (checklistId) => {
    if(confirm("¿Eliminar esta lista por completo?")) {
        state.checklists = (state.checklists || []).filter(cl => cl.id !== checklistId);
        await deleteDataFromCloud('checklists', checklistId);
        recordActivity();
        window.renderChecklists();
    }
};

// --- SISTEMA DE EDICIÓN PROFUNDA ---
let currentEditItems = []; 
let currentEditChecklistId = null; 

window.openEditClModal = (checklistId) => {
    const cl = (state.checklists || []).find(clItem => clItem.id === checklistId);
    if (!cl) return;

    currentEditChecklistId = checklistId;
    const title = document.getElementById('editClTitle');
    if(title) title.value = cl.title;
    
    currentEditItems = JSON.parse(JSON.stringify(cl.items)); 
    
    window.renderEditClItems();
    const modal = document.getElementById('editClModal');
    if(modal) modal.style.display = 'flex';
};

window.closeEditClModal = () => {
    const modal = document.getElementById('editClModal');
    if(modal) modal.style.display = 'none';
    currentEditChecklistId = null;
    currentEditItems = [];
};

window.renderEditClItems = () => {
    const container = document.getElementById('editClItems');
    if (!container) return;
    container.innerHTML = '';
    
    if(currentEditItems.length === 0) {
        container.innerHTML = '<div style="color: #666; font-size: 0.9em; text-align: center; padding: 10px;">No hay elementos aún.</div>';
    }
    
    currentEditItems.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '8px'; div.style.alignItems = 'center';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = item.checked;
        checkbox.addEventListener('change', () => { item.checked = !item.checked; });

        const textInput = document.createElement('input');
        textInput.type = 'text'; textInput.value = item.text;
        textInput.style.flexGrow = '1'; textInput.style.padding = '8px';
        textInput.addEventListener('input', (e) => { item.text = e.target.value; });

        const removeBtn = document.createElement('button');
        removeBtn.innerText = 'X';
        removeBtn.addEventListener('click', () => { currentEditItems.splice(i, 1); window.renderEditClItems(); });
        
        div.append(checkbox, textInput, removeBtn);
        container.appendChild(div);
    });
};

window.addEditClItem = () => {
    const input = document.getElementById('editClNewItem');
    if(!input || !input.value.trim()) return;
    currentEditItems.push({text: input.value.trim(), checked: false});
    input.value = '';
    window.renderEditClItems();
};

window.saveEditChecklist = async () => {
    if (currentEditChecklistId === null) return;
    const title = document.getElementById('editClTitle');
    if(!title || !title.value.trim()) return alert("La lista debe tener un título.");
    
    const clIndex = (state.checklists || []).findIndex(cl => cl.id === currentEditChecklistId);
    if (clIndex === -1) return;

    state.checklists[clIndex].title = title.value.trim();
    state.checklists[clIndex].items = currentEditItems.filter(item => item.text.trim() !== '');
    
    recordActivity();
    await saveDataToCloud('checklists', state.checklists[clIndex]);
    window.closeEditClModal();
    window.renderChecklists();
};

window.renderChecklists = () => {
    const container = document.getElementById('checklistsContainer');
    if(!container) return;
    container.innerHTML = '';

    (state.checklists || []).forEach((cl) => {
        const card = document.createElement('div');
        card.className = 'container';
        
        let itemsHtml = (cl.items || []).map((item, i) => `
            <div class="checklist-item" style="display:flex; align-items:center; background:#222; margin-bottom:5px; padding:10px; border-radius:6px;">
                <input type="checkbox" id="check-${cl.id}-${i}" ${item.checked ? 'checked' : ''}>
                <label for="check-${cl.id}-${i}" style="${item.checked ? 'text-decoration:line-through; color:#666;' : 'color:white;'} flex-grow:1; margin-left:10px;">${item.text}</label>
            </div>
        `).join('');

        card.innerHTML = `
            <h2>${cl.title} 
                <button id="edit-cl-${cl.id}">✏️</button> 
                <button id="del-cl-${cl.id}">🗑️</button>
            </h2>
            <div>${itemsHtml || '<div style="color:#666;">Lista vacía.</div>'}</div>
            <input type="text" id="clInput-${cl.id}" placeholder="Añadir...">
            <button id="add-cl-${cl.id}">+</button>
        `;
        container.appendChild(card);

        // Bindings de seguridad
        document.getElementById(`edit-cl-${cl.id}`).addEventListener('click', () => window.openEditClModal(cl.id));
        document.getElementById(`del-cl-${cl.id}`).addEventListener('click', () => window.deleteChecklist(cl.id));
        document.getElementById(`add-cl-${cl.id}`).addEventListener('click', () => window.addClItem(cl.id));
        
        (cl.items || []).forEach((item, i) => {
            document.getElementById(`check-${cl.id}-${i}`).addEventListener('change', () => window.toggleClItem(cl.id, i));
        });
    });
};

export function init() {
    window.renderChecklists();
    document.getElementById('createClBtn')?.addEventListener('click', window.createChecklist);
    document.getElementById('saveEditClBtn')?.addEventListener('click', window.saveEditChecklist);
    document.getElementById('closeEditClModalBtn')?.addEventListener('click', window.closeEditClModal);
    document.getElementById('addEditClItemBtn')?.addEventListener('click', window.addEditClItem);
}

window.addEventListener('stateChanged', () => { 
    if(document.getElementById('checklistsContainer')) init(); 
});