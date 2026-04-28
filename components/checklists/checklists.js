import { state, saveDataToCloud, recordActivity, deleteDataFromCloud } from '../../js/store.js';

// --- GESTIÓN DE CHECKLISTS ---
window.createChecklist = async () => {
    const titleInput = document.getElementById('clTitle');
    if (!titleInput || titleInput.value.trim() === '') return alert("Escribe un título para la lista");
    
    const newChecklist = { 
        id: crypto.randomUUID(), // Generar ID único
        title: titleInput.value.trim(), 
        items: [] 
    };
    
    if (!state.checklists) state.checklists = [];
    state.checklists.unshift(newChecklist);
    
    titleInput.value = '';
    
    recordActivity();
    await saveDataToCloud('checklists', newChecklist); // Guardar la nueva checklist
    window.renderChecklists();
};

window.addClItem = async (checklistId) => {
    const clIndex = (state.checklists || []).findIndex(cl => cl.id === checklistId);
    if (clIndex === -1) return;

    const input = document.getElementById(`clItemInput-${checklistId}`);
    if (!input || input.value.trim() === '') return;
    
    state.checklists[clIndex].items.push({ text: input.value.trim(), checked: false });
    input.value = '';
    
    recordActivity();
    await saveDataToCloud('checklists', state.checklists[clIndex]); // Actualizar la checklist
    window.renderChecklists();
};

window.toggleClItem = async (checklistId, itemIndex) => {
    const clIndex = (state.checklists || []).findIndex(cl => cl.id === checklistId);
    if (clIndex === -1) return;

    state.checklists[clIndex].items[itemIndex].checked = !state.checklists[clIndex].items[itemIndex].checked;
    await saveDataToCloud('checklists', state.checklists[clIndex]); // Actualizar la checklist
    window.renderChecklists();
};

window.deleteChecklist = async (checklistId) => {
    if(confirm("¿Eliminar esta lista por completo?")) {
        state.checklists = (state.checklists || []).filter(cl => cl.id !== checklistId);
        await deleteDataFromCloud('checklists', checklistId); // Eliminar de Supabase
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
    
    currentEditItems = JSON.parse(JSON.stringify(cl.items || [])); 
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
        container.innerHTML = '<div style="color: #666; font-size: 0.9em; text-align: center; padding: 10px;">No hay elementos aún. Añade uno abajo.</div>';
    }
    
    currentEditItems.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.gap = '8px'; div.style.alignItems = 'center';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = item.checked;
        checkbox.style.transform = 'scale(1.3)'; checkbox.style.marginRight = '5px';
        checkbox.addEventListener('change', () => { currentEditItems[i].checked = !currentEditItems[i].checked; });

        const textInput = document.createElement('input');
        textInput.type = 'text'; textInput.value = item.text;
        textInput.style.flexGrow = '1'; textInput.style.padding = '8px';
        textInput.style.background = '#2c2c2c'; textInput.style.border = '1px solid #444';
        textInput.style.color = 'white'; textInput.style.borderRadius = '4px';
        textInput.addEventListener('input', (e) => { item.text = e.target.value; });

        const removeBtn = document.createElement('button');
        removeBtn.innerText = 'X';
        removeBtn.style.background = '#cf6679'; removeBtn.style.padding = '8px 12px';
        removeBtn.style.fontWeight = 'bold'; removeBtn.style.borderRadius = '4px';
        removeBtn.addEventListener('click', () => { 
            currentEditItems.splice(i, 1); 
            window.renderEditClItems(); 
        });
        
        div.append(checkbox, textInput, removeBtn);
        container.appendChild(div);
    });
};

window.addEditClItem = () => {
    const input = document.getElementById('editClNewItem');
    if(!input || input.value.trim() === '') return;
    
    currentEditItems.push({text: input.value.trim(), checked: false});
    input.value = '';
    window.renderEditClItems();
    const modalContainer = document.querySelector('#editClModal .container');
    if(modalContainer) modalContainer.scrollTop = modalContainer.scrollHeight;
};

window.saveEditChecklist = async () => {
    if (currentEditChecklistId === null) return;
    const title = document.getElementById('editClTitle');
    if(!title || title.value.trim() === '') return alert("La lista debe tener un título.");
    
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
        card.style.borderTop = '3px solid var(--secondary)';
        
        let itemsHtml = (cl.items || []).map((item, i) => `
            <div class="checklist-item" style="display:flex; align-items:center; background:#222; margin-bottom:5px; padding:10px; border-radius:6px;">
                <input type="checkbox" id="check-${cl.id}-${i}" ${item.checked ? 'checked' : ''}>
                <label for="check-${cl.id}-${i}" style="${item.checked ? 'text-decoration:line-through; color:#666;' : 'color:white;'} flex-grow:1; margin-left:10px;">${item.text}</label>
            </div>
        `).join('');

        if((cl.items || []).length === 0) itemsHtml = '<div style="color:#666; font-size:0.9em; margin-bottom:10px;">Lista vacía.</div>';

        card.innerHTML = `
            <h2 style="margin-bottom: 15px; font-size: 1.3em;">
                ${cl.title}
                <div style="display: flex; gap: 8px;">
                    <button id="edit-cl-${cl.id}" class="btn-edit-cl" style="font-size: 0.7em; padding: 6px 12px; background: rgba(3, 218, 198, 0.2); border: 1px solid var(--secondary); color: var(--secondary);">✏️ Editar</button>
                    <button id="del-cl-${cl.id}" class="btn-del-cl" style="font-size: 0.7em; padding: 6px 12px; background: #cf6679; color: black;">🗑️</button>
                </div>
            </h2>
            
            <div style="margin-bottom: 15px; max-height: 300px; overflow-y: auto;">
                ${itemsHtml}
            </div>
            
            <div class="input-group" style="margin-bottom: 0;">
                <input type="text" id="clItemInput-${cl.id}" placeholder="Nuevo elemento rápido...">
                <button id="add-item-${cl.id}">Añadir</button>
            </div>
        `;
        container.appendChild(card);

        // BLINDADO: Enlazar eventos para cada checklist después de renderizar
        document.getElementById(`edit-cl-${cl.id}`)?.addEventListener('click', () => window.openEditClModal(cl.id));
        document.getElementById(`del-cl-${cl.id}`)?.addEventListener('click', () => window.deleteChecklist(cl.id));
        document.getElementById(`add-item-${cl.id}`)?.addEventListener('click', () => window.addClItem(cl.id));
        
        const itemInput = document.getElementById(`clItemInput-${cl.id}`);
        if (itemInput) {
            itemInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.addClItem(cl.id); });
        }
        
        // Enlazar checkboxes a toggleClItem
        (cl.items || []).forEach((item, i) => {
            document.getElementById(`check-${cl.id}-${i}`)?.addEventListener('change', () => window.toggleClItem(cl.id, i));
        });
    });
};

export function init() {
    window.renderChecklists();

    // BLINDADO: Enlazar eventos a los botones principales
    document.getElementById('createClBtn')?.addEventListener('click', window.createChecklist);
    document.getElementById('clTitle')?.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.createChecklist(); });

    // Eventos para el modal de edición
    document.getElementById('saveEditClBtn')?.addEventListener('click', window.saveEditChecklist);
    document.getElementById('closeEditClModalBtn')?.addEventListener('click', window.closeEditClModal);
    document.getElementById('addEditClItemBtn')?.addEventListener('click', window.addEditClItem);
    const editClNewItemInput = document.getElementById('editClNewItem');
    if (editClNewItemInput) {
        editClNewItemInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') window.addEditClItem(); });
    }
}

window.addEventListener('stateChanged', () => { 
    if(document.getElementById('checklistsContainer')) init(); 
});