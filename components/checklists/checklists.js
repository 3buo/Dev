import { state, saveDataToCloud, recordActivity } from '../../js/store.js';
import { esc } from '../../js/escape.js';
import { toast } from '../../js/feedback.js';

const ensureChecklistDefaults = () => {
    if (!Array.isArray(state.checklists)) state.checklists = [];

    // Backward compatibility for older snapshots
    state.checklists.forEach((cl) => {
        if (!('createdAt' in cl) || !cl.createdAt) cl.createdAt = new Date().toISOString();
        if (!('categoryId' in cl)) cl.categoryId = null;
    });

    if (!Array.isArray(state.checklistCategories)) state.checklistCategories = [];
};

const formatDateKey = (isoOrMs) => {
    const d = new Date(isoOrMs);
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
};

const isChecklistCompleted = (cl) => {
    if (!Array.isArray(cl.items) || cl.items.length === 0) return false;
    return cl.items.every((it) => !!it.checked);
};

const getCategoryById = (categoryId) => {
    const categories = Array.isArray(state.checklistCategories) ? state.checklistCategories : [];
    return categories.find((c) => c.id === categoryId) || null;
};

const getCategoryName = (categoryId) => {
    return getCategoryById(categoryId)?.name || 'Sin clasificar';
};

const createCategory = (name) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) throw new Error('Nombre de clasificación inválido');

    ensureChecklistDefaults();

    const id = `cat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    state.checklistCategories.unshift({
        id,
        name: trimmed,
        createdAt: new Date().toISOString(),
    });

    recordActivity();
    return id;
};

const getCompletedLists = () => {
    const completed = [];
    state.checklists.forEach((cl, clIndex) => {
        if (isChecklistCompleted(cl)) completed.push({ cl, clIndex });
    });
    return completed;
};

const getNotCompletedLists = () => {
    const notCompleted = [];
    state.checklists.forEach((cl, clIndex) => {
        if (!isChecklistCompleted(cl)) notCompleted.push({ cl, clIndex });
    });
    return notCompleted;
};

window.createChecklist = () => {
    const title = document.getElementById('clTitle').value;
    if (!title) return toast('Escribe un título para la lista');

    ensureChecklistDefaults();

    state.checklists.unshift({
        id: Date.now(),
        title: title.trim(),
        createdAt: new Date().toISOString(),
        categoryId: null,
        items: [],
    });

    document.getElementById('clTitle').value = '';

    recordActivity();
    saveDataToCloud();
    window.renderChecklists();
};

window.addClItem = (clIndex) => {
    const input = document.getElementById(`clItemInput-${clIndex}`);
    if (!input || !input.value) return;

    ensureChecklistDefaults();

    state.checklists[clIndex].items.push({ text: input.value, checked: false });
    input.value = '';

    recordActivity();
    saveDataToCloud();
    window.renderChecklists();
    // F30: preservar el foco tras el re-render completo
    const refocused = document.getElementById(`clItemInput-${clIndex}`);
    if (refocused) refocused.focus();
};

window.toggleClItem = (clIndex, itemIndex) => {
    ensureChecklistDefaults();
    state.checklists[clIndex].items[itemIndex].checked = !state.checklists[clIndex].items[itemIndex].checked;

    saveDataToCloud();
    window.renderChecklists();
};

window.deleteChecklist = (clIndex) => {
    if (confirm('¿Eliminar esta lista por completo?')) {
        ensureChecklistDefaults();
        state.checklists.splice(clIndex, 1);
        saveDataToCloud();
        window.renderChecklists();
    }
};

// --- SISTEMA DE EDICIÓN PROFUNDA ---
let currentEditItems = [];

window.openEditClModal = (clIndex) => {
    ensureChecklistDefaults();

    const cl = state.checklists[clIndex];
    document.getElementById('editClIndex').value = String(clIndex);
    document.getElementById('editClTitle').value = cl.title;

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

    if (currentEditItems.length === 0) {
        container.innerHTML = '<div style="color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; padding: var(--space-3);">No hay elementos aún. Añade uno abajo.</div>';
        return;
    }

    currentEditItems.forEach((item, i) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '8px';
        div.style.alignItems = 'center';

        div.innerHTML = `
            <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleEditClItem(${i})" style="transform: scale(1.3); margin-right: 5px;">
            <input type="text" value="${esc(item.text)}" oninput="updateEditClItemText(${i}, this.value)" style="flex-grow: 1; padding: var(--space-2); background: var(--bg-surface-raised); border: 1px solid var(--border-strong); color: var(--text-primary); border-radius: var(--radius-sm);">
            <button onclick="removeEditClItem(${i})" style="background: var(--status-error); padding: var(--space-2) 12px; font-weight: bold; border-radius: var(--radius-sm);">X</button>
        `;

        container.appendChild(div);
    });
};

window.updateEditClItemText = (i, val) => {
    currentEditItems[i].text = val;
};
window.toggleEditClItem = (i) => {
    currentEditItems[i].checked = !currentEditItems[i].checked;
};
window.removeEditClItem = (i) => {
    currentEditItems.splice(i, 1);
    window.renderEditClItems();
};

window.addEditClItem = () => {
    const input = document.getElementById('editClNewItem');
    const val = input.value.trim();
    if (!val) return;

    currentEditItems.push({ text: val, checked: false });
    input.value = '';

    window.renderEditClItems();

    const modalContainer = document.querySelector('#editClModal .container');
    modalContainer.scrollTop = modalContainer.scrollHeight;
};

window.saveEditChecklist = () => {
    ensureChecklistDefaults();

    const clIndex = Number(document.getElementById('editClIndex').value);
    const newTitle = document.getElementById('editClTitle').value.trim();
    if (!newTitle) return toast('La lista debe tener un título.');

    const cleanItems = currentEditItems.filter((item) => item.text.trim() !== '');

    state.checklists[clIndex].title = newTitle;
    state.checklists[clIndex].items = cleanItems;

    recordActivity();
    saveDataToCloud();
    window.closeEditClModal();
    window.renderChecklists();
};

const renderChecklistCard = ({ cl, clIndex }) => {
    const card = document.createElement('div');
    card.className = 'container';
    card.style.borderTop = '3px solid var(--secondary)';

    const itemsHtml = (cl.items || [])
        .map(
            (item, i) => `
        <div class="checklist-item" style="flex-direction: row; align-items: center; background: var(--bg-surface-raised); margin-bottom: var(--space-1); padding: var(--space-3); border-radius: var(--radius-sm);">
            <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleClItem(${clIndex}, ${i})" style="transform: scale(1.3); margin-right: 10px;">
            <span style="${item.checked ? 'text-decoration: line-through; color: var(--text-tertiary);' : 'color: var(--text-primary);'} flex-grow: 1; font-size: 1.1em;">${esc(item.text)}</span>
        </div>
    `,
        )
        .join('');

    const normalizedItemsHtml = (cl.items || []).length === 0
        ? '<div style="color:var(--text-tertiary); font-size:var(--text-sm); margin-bottom: var(--space-3);">Lista vacía.</div>'
        : itemsHtml;

    card.innerHTML = `
        <div style="margin-bottom: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--accent-secondary); background: var(--tint-teal); border: 1px solid var(--tint-teal); padding: 4px 10px; border-radius: 999px; display: inline-block;">
                ${formatDateKey(cl.createdAt)}
            </div>

            <h2 style="margin: 8px 0 10px 0; font-size: 1.25em;">
                ${cl.title}
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                    <button onclick="openEditClModal(${clIndex})" style="font-size: var(--text-xs); padding: var(--space-2) 12px; background: var(--tint-teal); border: 1px solid var(--secondary); color: var(--secondary);">✏️ Editar</button>
                    <button onclick="deleteChecklist(${clIndex})" style="font-size: var(--text-xs); padding: var(--space-2) 12px; background: var(--status-error); color: var(--text-on-accent);">🗑️</button>
                </div>
            </h2>
        </div>

        <div style="margin-bottom: var(--space-3); max-height: 300px; overflow-y: auto;">
            ${normalizedItemsHtml}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); margin-bottom: var(--space-3); flex-wrap: wrap;">
            <div style="flex: 1; min-width: 240px;" class="input-group">
                <input type="text" id="clItemInput-${clIndex}" placeholder="Nuevo elemento rápido..." onkeypress="if(event.key === 'Enter') addClItem(${clIndex})">
                <button onclick="addClItem(${clIndex})">Añadir</button>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
                <div style="color:var(--text-secondary); font-size:var(--text-xs); white-space:nowrap;">${getCategoryName(cl.categoryId)}</div>
                <button onclick="window.__openClassifyMenu(${clIndex}, event)" draggable="false" style="font-size: var(--text-xs); padding: 7px 10px; background: var(--tint-teal); border: 1px solid var(--secondary); color: var(--secondary);">🏷️ Clasificar en...</button>
            </div>
        </div>
    `;

    // Drag & Drop (feature 2)
    card.draggable = true;
    card.dataset.clIndex = String(clIndex);
    card.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', String(clIndex));
        e.dataTransfer.effectAllowed = 'move';

        card.style.opacity = '0.6';
    };
    card.ondragend = () => {
        card.style.opacity = '';
    };

    return card;
};

window.__openClassifyMenu = (clIndex, ev) => {
    ensureChecklistDefaults();

    // Close existing menu
    const existing = document.getElementById('clClassifyMenu');
    if (existing) existing.remove();

    const cl = state.checklists[clIndex];
    if (!cl) return;

    const menu = document.createElement('div');
    menu.id = 'clClassifyMenu';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    menu.style.minWidth = '320px';
    menu.style.maxWidth = '90vw';
    menu.style.padding = '14px';
    menu.style.background = 'var(--bg-surface)';
    menu.style.border = '1px solid var(--secondary)';
    menu.style.borderRadius = '10px';
    menu.style.boxShadow = '0 18px 60px var(--shadow-color)';
    menu.style.backdropFilter = 'blur(6px)';

    const cats = Array.isArray(state.checklistCategories) ? state.checklistCategories : [];

    const currentCatId = cl.categoryId || null;

    menu.innerHTML = `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
                <div style="color: var(--secondary); font-weight: bold;">Clasificar</div>
                <div style="color:var(--text-secondary); font-size:var(--text-sm); margin-top:6px;">${esc(cl.title)}</div>
            </div>
            <button id="clClassifyClose" style="background: transparent; color:var(--text-secondary); border:1px solid var(--border-strong); padding:var(--space-2) 10px; border-radius:var(--radius-md); cursor:pointer;">✕</button>
        </div>

        <div style="margin-top:12px; color:var(--text-secondary); font-size:var(--text-xs);">Arrastra o elige una categoría</div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:var(--space-3);">
            <button onclick="window.__classifyChecklist(${clIndex}, null)" style="background:${currentCatId===null ? 'var(--tint-teal)' : 'var(--bg-surface-raised)'}; color: var(--secondary); border: 1px solid var(--secondary); padding:var(--space-3); border-radius:var(--radius-md); cursor:pointer; text-align:left;">⬚ Sin clasificar</button>
            ${cats.map((c) => `
                <button onclick="window.__classifyChecklist(${clIndex}, '${c.id}')" style="background:${currentCatId===c.id ? 'var(--tint-teal)' : 'var(--bg-surface-raised)'}; color: var(--secondary); border: 1px solid var(--secondary); padding:var(--space-3); border-radius:var(--radius-md); cursor:pointer; text-align:left;">
                    🗂️ ${esc(c.name)}
                </button>
            `).join('')}
        </div>

        <div style="margin-top:14px; padding-top:12px; border-top: 1px solid var(--border-subtle);">
            <div style="color:var(--text-secondary); font-size:var(--text-xs); margin-bottom:8px;">Crear nueva clasificación</div>
            <div style="display:flex; gap:8px;">
                <input id="clNewCategoryName" type="text" placeholder="Ej: Trabajo, Casa, Salud" style="flex:1; background:var(--bg-surface-raised); border:1px solid var(--border-strong); color:var(--text-primary); padding:var(--space-3); border-radius:var(--radius-md);">
                <button onclick="window.__createChecklistCategoryFromMenu(${clIndex})" style="background: var(--tint-teal); color: var(--secondary); border: 1px solid var(--secondary); padding: var(--space-3) 12px; border-radius: var(--radius-md); cursor:pointer; font-weight: bold;">+ Crear</button>
            </div>
        </div>
    `;

    document.body.appendChild(menu);

    const close = () => menu.remove();
    menu.querySelector('#clClassifyClose').onclick = close;

    document.addEventListener('mousedown', (e) => {
        const t = e.target;
        if (!menu.contains(t)) close();
    }, { once: true });

    // Position near click
    const margin = 14;
    const x = Math.min(window.innerWidth - menu.offsetWidth - margin, Math.max(margin, ev?.clientX ?? margin));
    const y = Math.min(window.innerHeight - menu.offsetHeight - margin, Math.max(margin, (ev?.clientY ?? margin) + 8));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
};

window.__classifyChecklist = (clIndex, categoryIdOrNull) => {
    ensureChecklistDefaults();
    state.checklists[clIndex].categoryId = categoryIdOrNull || null;
    saveDataToCloud();
    window.renderChecklists();

    const existing = document.getElementById('clClassifyMenu');
    if (existing) existing.remove();
};

window.__createChecklistCategoryFromMenu = (clIndex) => {
    ensureChecklistDefaults();
    const input = document.getElementById('clNewCategoryName');
    const name = input?.value;

    if (!name || !String(name).trim()) {
        toast('Escribe un nombre para la clasificación');
        return;
    }

    try {
        const newId = createCategory(name);
        window.__classifyChecklist(clIndex, newId);
    } catch (e) {
        toast('No se pudo crear la categoría');
    }
};

const renderChecklistCardsIntoContainer = (items, container) => {
    // Minimal: sin headers de fecha / sin expand-collapse.
    // La fecha vive únicamente dentro del pill del card.
    items.forEach((it) => container.appendChild(renderChecklistCard(it)));
};

const renderCategoriesAndDnD = (notCompleted) => {
    // UX: no mostramos headers grandes. Solo mostramos zonas de drop con las checklist cards.
    // El título visible será el mismo card (incluye el pill con la fecha).

    ensureChecklistDefaults();

    const categories = Array.isArray(state.checklistCategories) ? state.checklistCategories : [];

    const byCat = new Map();
    const unclassified = [];

    notCompleted.forEach((it) => {
        const catId = it.cl.categoryId || null;
        if (!catId) {
            unclassified.push(it);
            return;
        }
        if (!byCat.has(catId)) byCat.set(catId, []);
        byCat.get(catId).push(it);
    });

    const renderDropZone = (key, items) => {
        const zone = document.createElement('div');
        zone.style.paddingTop = '6px';
        zone.style.marginBottom = '14px';

        zone.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };
        zone.ondrop = (e) => {
            e.preventDefault();
            const payload = e.dataTransfer.getData('text/plain');
            const clIndex = Number(payload);
            if (!Number.isFinite(clIndex)) return;
            window.__classifyChecklist(clIndex, key === null ? null : key);
        };

        // Sin collapse por fecha de esta capa: mantenemos el layout minimalista.
        // El card ya contiene el pill con la fecha.
        items.forEach((it) => zone.appendChild(renderChecklistCard(it)));

        return zone;
    };

    const out = document.createDocumentFragment();

    // Sin clasificar
    if (unclassified.length > 0) out.appendChild(renderDropZone(null, unclassified));

    categories.forEach((c) => {
        const items = byCat.get(c.id) || [];
        if (items.length === 0) return;
        out.appendChild(renderDropZone(c.id, items));
    });

    return out;
};

window.renderChecklists = () => {
    ensureChecklistDefaults();

    const root = document.getElementById('checklistsContainer');
    if (!root) return;

    if (!window.__clCollapse) window.__clCollapse = { completed: true };

    root.innerHTML = '';

    // Feature 3: Completed section
    const completed = getCompletedLists();
    const notCompleted = getNotCompletedLists();

    const completedHeader = document.createElement('div');
    completedHeader.className = 'container';
    completedHeader.style.borderTop = '3px solid var(--secondary)';
    completedHeader.style.marginBottom = '12px';
    completedHeader.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; user-select:none;">
            <h2 style="margin:0; font-size:1.2em;">Listas completadas</h2>
            <span style="color: var(--secondary); font-weight: bold;">${window.__clCollapse.completed ? '▾' : '▸'}</span>
        </div>
    `;

    completedHeader.onclick = () => {
        window.__clCollapse.completed = !window.__clCollapse.completed;
        window.renderChecklists();
    };

    root.appendChild(completedHeader);

    if (window.__clCollapse.completed) {
        const completedWrap = document.createElement('div');
        completed.forEach((it) => completedWrap.appendChild(renderChecklistCard(it)));
        root.appendChild(completedWrap);
    }

    // Feature 2: Categories + drag & drop (with date collapse inside each category)
    const catsWrap = document.createElement('div');
    catsWrap.style.marginTop = '6px';

    if (notCompleted.length > 0) {
        catsWrap.appendChild(renderCategoriesAndDnD(notCompleted));
    } else {
        catsWrap.innerHTML = '<div style="color:var(--text-tertiary); font-size:var(--text-sm); text-align:center; padding: 16px;">No hay checklists pendientes.</div>';
    }

    root.appendChild(catsWrap);
};

export function init() {
    window.renderChecklists();
}

window.addEventListener('stateChanged', () => {
    if (document.getElementById('checklistsContainer')) init();
});

