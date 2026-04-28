// ==========================================================================
// CORE DEL DEVELOPER MODE (RUNTIME THEME BUILDER + DOM MUTATION)
// ==========================================================================

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
let isDevModeActive = false;
let isInspectorActive = false;
let currentTargetElement = null;
let currentSelectorTarget = null;
let isOverridingText = false; // Candado anti-colapso

// Extracción segura de la base de datos
let dynamicStylesDB = {};
let dynamicContentDB = {};
try {
    dynamicStylesDB = JSON.parse(localStorage.getItem('dev_dynamic_styles')) || {};
    dynamicContentDB = JSON.parse(localStorage.getItem('dev_dynamic_content')) || {};
} catch (error) {
    localStorage.removeItem('dev_dynamic_styles');
    localStorage.removeItem('dev_dynamic_content');
}

export function initDevMode() {
    injectDynamicStyleSheet();
    applyContentOverrides();
    
    // Vigilante del DOM para Textos
    const observer = new MutationObserver(() => applyContentOverrides());
    observer.observe(document.body, { childList: true, subtree: true });

    // Enlazar paletas de colores en tiempo real
    bindColorSyncEvents();
    
    const animCheck = document.getElementById('devAnimEnable');
    if(animCheck) {
        animCheck.addEventListener('change', (e) => {
            const animTypeSelect = document.getElementById('devAnimType');
            if(animTypeSelect) animTypeSelect.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // Atajo de teclado (Alt + Shift + D)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
            e.preventDefault();
            const modal = document.getElementById('devLoginModal');
            if(!isDevModeActive) {
                if(modal) modal.style.display = 'flex';
                setTimeout(() => { document.getElementById('devUser')?.focus(); }, 50);
            } else {
                window.closeDevPanel();
            }
        }
    });
}

// Sincronización en vivo de inputs de color
function bindColorSyncEvents() {
    const sync = (colorId, textId, cssProp) => {
        const colorInput = document.getElementById(colorId);
        const textInput = document.getElementById(textId);
        if(!colorInput || !textInput) return;

        colorInput.addEventListener('input', (e) => {
            textInput.value = e.target.value;
            if(currentTargetElement) currentTargetElement.style.setProperty(cssProp, e.target.value, 'important');
        });
        
        textInput.addEventListener('input', (e) => {
            if(currentTargetElement) currentTargetElement.style.setProperty(cssProp, e.target.value, 'important');
            // Actualiza el input de color si el texto es un hex válido
            if(e.target.value.match(/^#[0-9A-Fa-f]{6}$/i)) {
                colorInput.value = e.target.value;
            }
        });
    };
    sync('devBgColor', 'devBgText', 'background-color');
    sync('devTextColor', 'devTextText', 'color');
    sync('devBorderColor', 'devBorderText', 'border-color');
}

// --- VENTANAS Y MODOS ---
window.authenticateDev = () => {
    const user = document.getElementById('devUser')?.value;
    const pass = document.getElementById('devPass')?.value;
    if (user === DEV_CREDS.user && pass === DEV_CREDS.pass) {
        document.getElementById('devLoginModal').style.display = 'none';
        isDevModeActive = true; 
        document.getElementById('devUser').value = ''; 
        document.getElementById('devPass').value = '';
        const panel = document.getElementById('devEditorPanel');
        if(panel) { panel.style.display = 'flex'; activateInspector(); }
    } else { alert("Acceso denegado."); }
};
window.closeDevLogin = () => { document.getElementById('devLoginModal').style.display = 'none'; };
window.closeDevPanel = () => { 
    const panel = document.getElementById('devEditorPanel');
    if(panel) panel.style.display = 'none'; 
    deactivateInspector(); 
    isDevModeActive = false; 
};

// --- MODO INSPECTOR ---
window.toggleInspectorMode = () => { isInspectorActive ? deactivateInspector() : activateInspector(); };

function activateInspector() {
    isInspectorActive = true;
    const btn = document.getElementById('btnInspectorToggle');
    if(btn) { btn.innerText = 'Inspeccionar: ON'; btn.style.color = '#39ff14'; btn.style.borderColor = '#39ff14'; }
    
    document.addEventListener('mouseover', handleDevHover);
    document.addEventListener('mouseout', handleDevMouseOut);
    // Usamos capture:true para interceptar el evento antes que otros listeners
    document.addEventListener('click', handleDevClick, { capture: true }); 
}

function deactivateInspector() {
    isInspectorActive = false;
    const btn = document.getElementById('btnInspectorToggle');
    if(btn) { btn.innerText = 'Inspeccionar: OFF'; btn.style.color = '#8b949e'; btn.style.borderColor = '#30363d'; }
    
    document.removeEventListener('mouseover', handleDevHover);
    document.removeEventListener('mouseout', handleDevMouseOut);
    document.removeEventListener('click', handleDevClick, { capture: true });
    
    // Limpiar el resaltado del elemento anterior
    if (currentTargetElement) { 
        currentTargetElement.classList.remove('dev-selected-target', 'dev-hover-target'); 
        currentTargetElement = null; 
    }
}

function handleDevHover(e) { 
    // Evitar afectar el panel de edición
    if(isInspectorActive && !e.target.closest('#devEditorPanel')) {
        e.target.classList.add('dev-hover-target');
    }
}
function handleDevMouseOut(e) { 
    if(isInspectorActive) e.target.classList.remove('dev-hover-target'); 
}

function handleDevClick(e) {
    // Ignorar si no estamos en modo inspector, si el click es dentro del panel, o si es un evento del propio inspector
    if(!isInspectorActive || e.target.closest('#devEditorPanel') || e.target.closest('.dev-panel *') || e.target.tagName.toUpperCase() === 'BODY') {
        return;
    }
    e.preventDefault(); 
    e.stopPropagation();

    // Remover resaltado del elemento anterior
    if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
    
    currentTargetElement = e.target;
    currentTargetElement.classList.add('dev-selected-target');
    currentTargetElement.classList.remove('dev-hover-target');
    
    loadElementDataIntoPanel(currentTargetElement);
    deactivateInspector(); // Salir del modo inspector tras seleccionar
}

// --- EXTRACCIÓN AL PANEL (CORRECCIONES EXACTAS) ---
function getSafeSelector(el) {
    if (!el || !el.tagName) return '*';
    // Priorizar ID si es válido
    if (el.id && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(el.id)) return `#${el.id}`;
    // Intentar con clases si son significativas
    const classes = Array.from(el.classList).filter(c => !c.startsWith('dev-') && c !== 'active' && /^[a-zA-Z_]/.test(c));
    if (classes.length > 0) return el.tagName.toLowerCase() + '.' + classes.join('.');
    // Si no, usar el nombre de la etiqueta
    return el.tagName.toLowerCase();
}

function rgbToStrictHex(rgba) {
    if (!rgba || rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent') return '';
    if (rgba.startsWith('#')) return rgba.substring(0, 7);
    const rgb = rgba.match(/\d+/g);
    if (!rgb || rgb.length < 3) return '';
    // Convertir RGB a Hex
    return `#${parseInt(rgb[0]).toString(16).padStart(2, '0')}${parseInt(rgb[1]).toString(16).padStart(2, '0')}${parseInt(rgb[2]).toString(16).padStart(2, '0')}`;
}

// Extrae medidas (padding, radius) de forma segura
function extractPaddingAndRadius(computed, type) {
    if (type === 'padding') {
        let p = computed.getPropertyValue('padding');
        if (p && p !== '') return p; // Si es un valor shorthand
        const pt = computed.getPropertyValue('padding-top') || '0px';
        const pr = computed.getPropertyValue('padding-right') || '0px';
        const pb = computed.getPropertyValue('padding-bottom') || '0px';
        const pl = computed.getPropertyValue('padding-left') || '0px';
        return `${pt} ${pr} ${pb} ${pl}`.replace(/(0px\s?)+/g, '0').trim() || '0';
    }
    if (type === 'radius') {
        let r = computed.getPropertyValue('border-radius');
        if (r && r !== '') return r; // Si es un valor shorthand
        const rtl = computed.getPropertyValue('border-top-left-radius') || '0px';
        const rtr = computed.getPropertyValue('border-top-right-radius') || '0px';
        const rbr = computed.getPropertyValue('border-bottom-right-radius') || '0px';
        const rbl = computed.getPropertyValue('border-bottom-left-radius') || '0px';
        return `${rtl} ${rtr} ${rbr} ${rbl}`.replace(/(0px\s?)+/g, '0').trim() || '0';
    }
    return '';
}

function loadElementDataIntoPanel(element) {
    currentSelectorTarget = getSafeSelector(element);
    document.getElementById('devTargetSelector').innerText = currentSelectorTarget;
    
    const computed = window.getComputedStyle(element);
    
    // Cargar visualmente en el panel
    document.getElementById('devBgColor').value = rgbToStrictHex(computed.getPropertyValue('background-color')) || '#000000';
    document.getElementById('devBgText').value = computed.getPropertyValue('background-color');
    document.getElementById('devTextColor').value = rgbToStrictHex(computed.getPropertyValue('color')) || '#ffffff';
    document.getElementById('devTextText').value = computed.getPropertyValue('color');
    document.getElementById('devBorderColor').value = rgbToStrictHex(computed.getPropertyValue('border-color')) || '#000000';
    document.getElementById('devBorderText').value = computed.getPropertyValue('border-color');
    
    document.getElementById('devBorderBottom').value = computed.getPropertyValue('border-bottom') || '';
    document.getElementById('devBorderRadius').value = extractPaddingAndRadius(computed, 'radius');
    document.getElementById('devPadding').value = extractPaddingAndRadius(computed, 'padding');
    document.getElementById('devFontSize').value = computed.getPropertyValue('font-size') || '';

    // Lógica de Textos (Sobrescritura de texto)
    const tagName = element.tagName.toUpperCase();
    const textEditableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LABEL','STRONG','EM','LI','TH','TD','DIV'];
    
    // Si el elemento puede tener texto editable y no es demasiado complejo
    if(textEditableTags.includes(tagName) && element.children.length < 3 && !element.closest('input') && !element.closest('textarea')) {
        document.getElementById('devTextGroup').style.display = 'flex';
        document.getElementById('devElementText').value = dynamicContentDB[currentSelectorTarget] || element.innerText.trim();
    } else {
        document.getElementById('devTextGroup').style.display = 'none';
        document.getElementById('devElementText').value = '';
    }

    // Lógica de Animaciones al hacer clic
    const isClickable = ['BUTTON', 'A', 'DIV', 'SPAN', 'LABEL', 'LI', 'TD', 'TH'].includes(tagName) || element.style.cursor === 'pointer' || element.closest('button') || element.closest('a') || element.closest('.tab-btn') || element.closest('.md-btn');
    
    if (isClickable) {
        document.getElementById('devAnimGroup').style.display = 'flex';
        const animTypeSelect = document.getElementById('devAnimType');
        
        // Verificar si ya hay una animación definida para este selector
        const activeSel = currentSelectorTarget + ':active';
        if(dynamicStylesDB[activeSel] && dynamicStylesDB[activeSel]['transform']) {
            document.getElementById('devAnimEnable').checked = true;
            animTypeSelect.style.display = 'block';
            animTypeSelect.value = dynamicStylesDB[activeSel]['transform'].includes('scale(0.92)') ? 'scale-down' : (dynamicStylesDB[activeSel]['transform'].includes('scale(1.05)') ? 'scale-up' : 'pulse-glow');
        } else {
            document.getElementById('devAnimEnable').checked = false;
            animTypeSelect.style.display = 'none';
        }
    } else {
        document.getElementById('devAnimGroup').style.display = 'none';
    }
}

// --- GUARDAR Y FEEDBACK VISUAL ---
window.applyAndSaveDevStyles = () => {
    if (!currentSelectorTarget) return alert("Selecciona un elemento primero.");
    
    // Capturar todos los campos del panel
    const newStyles = {
        'background-color': document.getElementById('devBgText')?.value,
        'color': document.getElementById('devTextText')?.value,
        'border-color': document.getElementById('devBorderText')?.value,
        'border-bottom': document.getElementById('devBorderBottom')?.value,
        'border-radius': document.getElementById('devBorderRadius')?.value,
        'padding': document.getElementById('devPadding')?.value,
        'font-size': document.getElementById('devFontSize')?.value
    };

    // Crear o acceder a los estilos dinámicos para el selector actual
    if(!dynamicStylesDB[currentSelectorTarget]) dynamicStylesDB[currentSelectorTarget] = {};
    
    // Guardar solo los que tengan valor
    for (let property in newStyles) {
        const value = newStyles[property];
        if(value && value.trim() !== '') {
            dynamicStylesDB[currentSelectorTarget][property] = value;
        } else {
            // Si el campo está vacío, eliminar la propiedad para resetearla
            delete dynamicStylesDB[currentSelectorTarget][property];
        }
    }

    // Guardar Animaciones (Solo si el grupo está visible)
    const animGroup = document.getElementById('devAnimGroup');
    if (animGroup && animGroup.style.display !== 'none') {
        const animEnable = document.getElementById('devAnimEnable');
        const activeSel = currentSelectorTarget + ':active'; // Selector para estado :active
        
        if (animEnable.checked) {
            const animType = document.getElementById('devAnimType').value;
            dynamicStylesDB[currentSelectorTarget]['transition'] = 'all 0.2s ease'; // Transición suave
            
            dynamicStylesDB[activeSel] = {}; // Reiniciar estilos de :active
            if(animType === 'scale-down') { dynamicStylesDB[activeSel]['transform'] = 'scale(0.92)'; } 
            else if(animType === 'scale-up') { dynamicStylesDB[activeSel]['transform'] = 'scale(1.05)'; } 
            else if(animType === 'pulse-glow') {
                dynamicStylesDB[activeSel]['box-shadow'] = '0 0 15px var(--note-accent)'; // Usar color de tema
                dynamicStylesDB[activeSel]['transform'] = 'scale(0.98)';
            }
        } else {
            // Si se desmarca, eliminar animaciones de :active
            delete dynamicStylesDB[activeSel]; 
        }
    }

    // Aplicar estilos al DOM y guardar en localStorage
    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    injectDynamicStyleSheet();

    // Guardado de Textos (Sobrescritura)
    const textGroup = document.getElementById('devTextGroup');
    if(textGroup && textGroup.style.display !== 'none') {
        const newText = document.getElementById('devElementText').value;
        if(newText && newText.trim() !== '') {
            dynamicContentDB[currentSelectorTarget] = newText;
        } else {
            delete dynamicContentDB[currentSelectorTarget]; // Borrar si está vacío
        }
        localStorage.setItem('dev_dynamic_content', JSON.JSON.stringify(dynamicContentDB));
        applyContentOverrides(); // Aplicar cambios de texto
    }
    
    // FEEDBACK VISUAL AL BOTÓN GUARDAR
    const btnSave = document.getElementById('devBtnSave');
    if (btnSave) {
        const originalText = btnSave.innerText;
        btnSave.innerText = '✅ ¡Guardado!';
        btnSave.classList.add('dev-btn-success');
        
        setTimeout(() => {
            btnSave.innerText = originalText;
            btnSave.classList.remove('dev-btn-success');
        }, 2000);
    }
};

// ==========================================
// INYECTORES DE ESTILOS Y CONTENIDO
// ==========================================
function injectDynamicStyleSheet() {
    let styleTag = document.getElementById('dev-dynamic-stylesheet');
    if (!styleTag) { 
        styleTag = document.createElement('style'); 
        styleTag.id = 'dev-dynamic-stylesheet'; 
        document.head.appendChild(styleTag); 
    }

    let cssString = '/* GENERADO POR DEV MODE THEME BUILDER */\n';
    for (const selector in dynamicStylesDB) {
        cssString += `${selector} {\n`;
        for (const property in dynamicStylesDB[selector]) {
            cssString += `  ${property}: ${dynamicStylesDB[selector][property]} !important;\n`;
        }
        cssString += `}\n\n`;
    }
    styleTag.innerHTML = cssString;
}

function applyContentOverrides() {
    if(isOverridingText) return; 
    isOverridingText = true;
    
    for(let selector in dynamicContentDB) {
        try {
            // Seleccionar todos los elementos que coinciden
            document.querySelectorAll(selector).forEach(el => {
                // Solo sobrescribir si el contenido es diferente
                if(el.textContent.trim() !== dynamicContentDB[selector].trim()) {
                    el.textContent = dynamicContentDB[selector];
                }
            });
        } catch(e) {
            console.error("Error al aplicar override de texto:", e);
        }
    }
    // Liberar el candado después de un corto tiempo
    setTimeout(() => { isOverridingText = false; }, 50);
}

// ==========================================
// REINICIOS Y LIMPIEZA
// ==========================================
window.resetTargetStyles = () => {
    if (!currentTargetElement) return;
    const selector = getSafeSelector(currentTargetElement);
    
    // Eliminar estilos y contenido asociados
    delete dynamicStylesDB[selector]; 
    delete dynamicStylesDB[selector + ':active']; // Limpiar también el estado :active
    delete dynamicContentDB[selector];
    
    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    localStorage.setItem('dev_dynamic_content', JSON.stringify(dynamicContentDB));
    
    injectDynamicStyleSheet(); 
    window.location.reload(); // Recargar para aplicar cambios
};

window.factoryResetStyles = () => {
    if(confirm("⚠️ ¿Borrar TODOS los estilos y textos personalizados de forma permanente?")) {
        dynamicStylesDB = {}; 
        dynamicContentDB = {};
        localStorage.removeItem('dev_dynamic_styles'); 
        localStorage.removeItem('dev_dynamic_content');
        window.location.reload(); 
    }
};

// --- LISTENERS DE EVENTOS ---
function setupDevModeEvents() {
    const btnInspector = document.getElementById('btnInspectorToggle');
    if(btnInspector) btnInspector.addEventListener('click', window.toggleInspectorMode);

    const btnSave = document.getElementById('devBtnSave');
    if(btnSave) btnSave.addEventListener('click', window.applyAndSaveDevStyles);

    const btnReset = document.getElementById('devBtnReset');
    if(btnReset) btnReset.addEventListener('click', window.resetTargetStyles);
    
    const btnFactoryReset = document.getElementById('devBtnFactoryReset');
    if(btnFactoryReset) btnFactoryReset.addEventListener('click', window.factoryResetStyles);
    
    // Inputs de color y texto
    document.getElementById('devBgColor')?.addEventListener('input', e => { document.getElementById('devBgText').value = e.target.value; if(currentTargetElement) currentTargetElement.style.setProperty('background-color', e.target.value, 'important'); });
    document.getElementById('devBgText')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('background-color', e.target.value, 'important'); });
    
    document.getElementById('devTextColor')?.addEventListener('input', e => { document.getElementById('devTextText').value = e.target.value; if(currentTargetElement) currentTargetElement.style.setProperty('color', e.target.value, 'important'); });
    document.getElementById('devTextText')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('color', e.target.value, 'important'); });
    
    document.getElementById('devBorderColor')?.addEventListener('input', e => { document.getElementById('devBorderText').value = e.target.value; if(currentTargetElement) currentTargetElement.style.setProperty('border-color', e.target.value, 'important'); });
    document.getElementById('devBorderText')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('border-color', e.target.value, 'important'); });
    
    document.getElementById('devBorderBottom')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('border-bottom', e.target.value, 'important'); });
    document.getElementById('devBorderRadius')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('border-radius', e.target.value, 'important'); });
    document.getElementById('devPadding')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('padding', e.target.value, 'important'); });
    document.getElementById('devFontSize')?.addEventListener('input', e => { if(currentTargetElement) currentTargetElement.style.setProperty('font-size', e.target.value, 'important'); });
    
    // Animaciones
    const animCheck = document.getElementById('devAnimEnable');
    const animType = document.getElementById('devAnimType');
    if(animCheck && animType) {
        animCheck.addEventListener('change', e => animType.style.display = e.target.checked ? 'block' : 'none');
        animType.addEventListener('change', () => {
            if(currentTargetElement && animCheck.checked) {
                const activeSel = getSafeSelector(currentTargetElement) + ':active';
                const animTypeVal = animType.value;
                dynamicStylesDB[currentTargetElement.id || getSafeSelector(currentTargetElement)] = dynamicStylesDB[currentTargetElement.id || getSafeSelector(currentTargetElement)] || {};
                dynamicStylesDB[currentTargetElement.id || getSafeSelector(currentTargetElement)]['transition'] = 'all 0.2s ease';

                dynamicStylesDB[activeSel] = {};
                if(animTypeVal === 'scale-down') dynamicStylesDB[activeSel]['transform'] = 'scale(0.92)';
                else if(animTypeVal === 'scale-up') dynamicStylesDB[activeSel]['transform'] = 'scale(1.05)';
                else if(animTypeVal === 'pulse-glow') dynamicStylesDB[activeSel]['box-shadow'] = '0 0 15px var(--note-accent)';
                injectDynamicStyleSheet(); // Aplicar inmediatamente
            }
        });
    }
}

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', setupDevModeEvents);