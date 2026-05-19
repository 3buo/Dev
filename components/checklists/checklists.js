import { state, saveDataToCloud, recordActivity } from '../../js/store.js';

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
    if (!title) return alert('Escribe un título para la lista');

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
        container.innerHTML = '<div style="color: #666; font-size: 0.9em; text-align: center; padding: 10px;">No hay elementos aún. Añade uno abajo.</div>';
        return;
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
    if (!newTitle) return alert('La lista debe tener un título.');

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
        <div class="checklist-item" style="flex-direction: row; align-items: center; background: #222; margin-bottom: 5px; padding: 10px; border-radius: 6px;">
            <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleClItem(${clIndex}, ${i})" style="transform: scale(1.3); margin-right: 10px;">
            <span style="${item.checked ? 'text-decoration: line-through; color: #666;' : 'color: white;'} flex-grow: 1; font-size: 1.1em;">${item.text}</span>
        </div>
    `,
        )
        .join('');

    const normalizedItemsHtml = (cl.items || []).length === 0
        ? '<div style="color:#666; font-size:0.9em; margin-bottom: 10px;">Lista vacía.</div>'
        : itemsHtml;

    card.innerHTML = `
        <div style="margin-bottom: 10px;">
            <div style="font-size: 0.78em; color: var(--secondary); background: rgba(3, 218, 198, 0.12); border: 1px solid rgba(3, 218, 198, 0.35); padding: 4px 10px; border-radius: 999px; display: inline-block;">
                ${formatDateKey(cl.createdAt)}
            </div>

            <h2 style="margin: 8px 0 10px 0; font-size: 1.25em;">
                ${cl.title}
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                    <button onclick="openEditClModal(${clIndex})" style="font-size: 0.7em; padding: 6px 12px; background: rgba(3, 218, 198, 0.2); border: 1px solid var(--secondary); color: var(--secondary);">✏️ Editar</button>
                    <button onclick="deleteChecklist(${clIndex})" style="font-size: 0.7em; padding: 6px 12px; background: #cf6679; color: black;">🗑️</button>
                </div>
            </h2>
        </div>

        <div style="margin-bottom: 10px; max-height: 300px; overflow-y: auto;">
            ${normalizedItemsHtml}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 10px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 240px;" class="input-group">
                <input type="text" id="clItemInput-${clIndex}" placeholder="Nuevo elemento rápido..." onkeypress="if(event.key === 'Enter') addClItem(${clIndex})">
                <button onclick="addClItem(${clIndex})">Añadir</button>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
                <div style="color:#aaa; font-size:0.85em; white-space:nowrap;">${getCategoryName(cl.categoryId)}</div>
                <button onclick="window.__openClassifyMenu(${clIndex}, event)" draggable="false" style="font-size: 0.78em; padding: 7px 10px; background: rgba(3, 218, 198, 0.2); border: 1px solid var(--secondary); color: var(--secondary);">🏷️ Clasificar en...</button>
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
    menu.style.background = '#1e1e1e';
    menu.style.border = '1px solid var(--secondary)';
    menu.style.borderRadius = '10px';
    menu.style.boxShadow = '0 18px 60px rgba(0,0,0,0.6)';
    menu.style.backdropFilter = 'blur(6px)';

    const cats = Array.isArray(state.checklistCategories) ? state.checklistCategories : [];

    const currentCatId = cl.categoryId || null;

    menu.innerHTML = `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
                <div style="color: var(--secondary); font-weight: bold;">Clasificar</div>
                <div style="color:#ddd; font-size:0.95em; margin-top:6px;">${cl.title}</div>
            </div>
            <button id="clClassifyClose" style="background: transparent; color:#aaa; border:1px solid #444; padding:6px 10px; border-radius:8px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-top:12px; color:#aaa; font-size:0.85em;">Arrastra o elige una categoría</div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
            <button onclick="window.__classifyChecklist(${clIndex}, null)" style="background:${currentCatId===null ? 'rgba(3, 218, 198, 0.25)' : '#2b2b2b'}; color: var(--secondary); border: 1px solid var(--secondary); padding:10px; border-radius:10px; cursor:pointer; text-align:left;">⬚ Sin clasificar</button>
            ${cats.map((c) => `
                <button onclick="window.__classifyChecklist(${clIndex}, '${c.id}')" style="background:${currentCatId===c.id ? 'rgba(3, 218, 198, 0.25)' : '#2b2b2b'}; color: var(--secondary); border: 1px solid var(--secondary); padding:10px; border-radius:10px; cursor:pointer; text-align:left;">
                    🗂️ ${c.name}
                </button>
            `).join('')}
        </div>

        <div style="margin-top:14px; padding-top:12px; border-top: 1px solid #333;">
            <div style="color:#aaa; font-size:0.85em; margin-bottom:8px;">Crear nueva clasificación</div>
            <div style="display:flex; gap:8px;">
                <input id="clNewCategoryName" type="text" placeholder="Ej: Trabajo, Casa, Salud" style="flex:1; background:#2c2c2c; border:1px solid #444; color:#fff; padding:10px; border-radius:10px;">
                <button onclick="window.__createChecklistCategoryFromMenu(${clIndex})" style="background: rgba(3, 218, 198, 0.2); color: var(--secondary); border: 1px solid var(--secondary); padding: 10px 12px; border-radius: 10px; cursor:pointer; font-weight: bold;">+ Crear</button>
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
        alert('Escribe un nombre para la clasificación');
        return;
    }

    try {
        const newId = createCategory(name);
        window.__classifyChecklist(clIndex, newId);
    } catch (e) {
        alert('No se pudo crear la categoría');
    }
};

const renderChecklistCardsIntoContainer = (items, container, dateCollapseEnabled) => {
    // dateCollapseEnabled applies only if we group by date (we keep date collapse for the default view)
    if (!dateCollapseEnabled) {
        items.forEach((it) => container.appendChild(renderChecklistCard(it)));
        return;
    }

    // Group by date with collapse
    const byDate = new Map();
    items.forEach((it) => {
        const key = formatDateKey(it.cl.createdAt);
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key).push(it);
    });

    if (!window.__clCollapseDates) window.__clCollapseDates = {};

    const keys = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));

    keys.forEach((dateKey) => {
        const expanded = window.__clCollapseDates[dateKey] ?? true;

        const wrap = document.createElement('div');
        wrap.style.marginBottom = '14px';

        const header = document.createElement('div');
        header.className = 'container';
        header.style.borderTop = '3px solid var(--secondary)';
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';

        header.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <h2 style="margin:0; font-size:1.1em;">${dateKey}</h2>
                <span style="color: var(--secondary); font-weight: bold;">${expanded ? '▾' : '▸'}</span>
            </div>
        `;

        header.onclick = () => {
            window.__clCollapseDates[dateKey] = !expanded;
            window.renderChecklists();
        };

        wrap.appendChild(header);

        if (expanded) {
            byDate.get(dateKey).forEach((it) => wrap.appendChild(renderChecklistCard(it)));
        }

        container.appendChild(wrap);
    });
};

const renderCategoriesAndDnD = (notCompleted) => {
    // Psych/UX: minimize scanning by showing 1 section per category + "Sin clasificar" + DnD zones
    // Also reuses date collapse inside each category section.

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

    // Collapse states per category (in-memory)
    if (!window.__clCollapseCats) window.__clCollapseCats = {};

    const getExpanded = (key) => window.__clCollapseCats[key] ?? true;

    const createCategorySection = (title, key, items) => {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '16px';

        const header = document.createElement('div');
        header.className = 'container';
        header.style.borderTop = '3px solid var(--secondary)';
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';

        const expanded = getExpanded(key);
        header.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <h2 style="margin:0; font-size:1.15em;">${title}</h2>
                <span style="color: var(--secondary); font-weight: bold;">${expanded ? '▾' : '▸'}</span>
            </div>
        `;

        wrap.appendChild(header);

        const zone = document.createElement('div');
        zone.style.paddingTop = '10px';

        // DnD drop zone
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

        if (expanded) {
            renderChecklistCardsIntoContainer(items, zone, true);
        } else {
            zone.innerHTML = '';
        }

        wrap.appendChild(zone);

        header.onclick = () => {
            window.__clCollapseCats[key] = !expanded;
            window.renderChecklists();
        };

        return wrap;
    };

    const out = document.createDocumentFragment();

    out.appendChild(createCategorySection('Sin clasificar', null, unclassified));

    categories.forEach((c) => {
        const items = byCat.get(c.id) || [];
        out.appendChild(createCategorySection(c.name, c.id, items));
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
        catsWrap.innerHTML = '<div style="color:#666; font-size:0.95em; text-align:center; padding: 16px;">No hay checklists pendientes.</div>';
    }

    root.appendChild(catsWrap);
};

export function init() {
    window.renderChecklists();
}

window.addEventListener('stateChanged', () => {
    if (document.getElementById('checklistsContainer')) init();
});

