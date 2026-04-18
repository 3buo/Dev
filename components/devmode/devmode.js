// ==========================================================================
// CORE DEL DEVELOPER MODE (RUNTIME THEME BUILDER + DOM MUTATION)
// ==========================================================================

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
let isDevModeActive = false;
let isInspectorActive = false;
let currentTargetElement = null;
let currentSelectorTarget = null;

// Extracción segura de BBDD
let dynamicStylesDB = {};
let dynamicContentDB = {};
try {
    dynamicStylesDB = JSON.parse(localStorage.getItem('dev_dynamic_styles')) || {};
    dynamicContentDB = JSON.parse(localStorage.getItem('dev_dynamic_content')) || {};
} catch (e) {
    localStorage.removeItem('dev_dynamic_styles');
    localStorage.removeItem('dev_dynamic_content');
}

export function initDevMode() {
    console.log("🛠️ DevMode Inicializado. Presiona Alt + Shift + D para abrir.");
    
    injectDynamicStyleSheet();
    applyContentOverrides();
    
    // Vigilante de DOM (Re-inyecta textos si cambia de pestaña)
    const observer = new MutationObserver(() => applyContentOverrides());
    observer.observe(document.body, { childList: true, subtree: true });

    // FIX 1: Enlazar sincronización bidireccional y PREVIEW EN TIEMPO REAL
    bindColorSyncEvents();
    
    // Checkbox Animaciones
    const animCheck = document.getElementById('devAnimEnable');
    if(animCheck) {
        animCheck.addEventListener('change', (e) => {
            document.getElementById('devAnimType').style.display = e.target.checked ? 'block' : 'none';
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
            e.preventDefault();
            const modal = document.getElementById('devLoginModal');
            if(!isDevModeActive) {
                modal.style.display = 'flex';
                setTimeout(() => { document.getElementById('devUser')?.focus(); }, 50);
            } else {
                window.closeDevPanel();
            }
        }
    });
}

function bindColorSyncEvents() {
    // Sincroniza Color Picker <-> Input Texto y aplica el estilo al DOM en vivo
    const sync = (colorInputId, textInputId, cssProp) => {
        const colorInput = document.getElementById(colorInputId);
        const textInput = document.getElementById(textInputId);
        if(!colorInput || !textInput) return;

        colorInput.addEventListener('input', (e) => {
            textInput.value = e.target.value;
            if (currentTargetElement) {
                currentTargetElement.style[cssProp] = e.target.value;
            }
        });
        
        textInput.addEventListener('input', (e) => {
            if (currentTargetElement) {
                currentTargetElement.style[cssProp] = e.target.value;
            }
            if(e.target.value.startsWith('#') && e.target.value.length === 7) {
                colorInput.value = e.target.value;
            }
        });
    };
    sync('devBgColor', 'devBgText', 'backgroundColor');
    sync('devTextColor', 'devTextText', 'color');
    sync('devBorderColor', 'devBorderText', 'borderColor');
}

window.authenticateDev = () => {
    const user = document.getElementById('devUser').value;
    const pass = document.getElementById('devPass').value;
    if (user === DEV_CREDS.user && pass === DEV_CREDS.pass) {
        document.getElementById('devLoginModal').style.display = 'none';
        isDevModeActive = true; 
        document.getElementById('devUser').value = ''; 
        document.getElementById('devPass').value = '';
        const panel = document.getElementById('devEditorPanel');
        if(panel) { panel.style.display = 'flex'; activateInspector(); }
    } else { 
        alert("Acceso denegado."); 
    }
};

window.closeDevLogin = () => { document.getElementById('devLoginModal').style.display = 'none'; };
window.closeDevPanel = () => { 
    const panel = document.getElementById('devEditorPanel');
    if(panel) panel.style.display = 'none'; 
    deactivateInspector(); isDevModeActive = false; 
};

// ==========================================
// MODO INSPECTOR
// ==========================================
window.toggleInspectorMode = () => { isInspectorActive ? deactivateInspector() : activateInspector(); };

function activateInspector() {
    isInspectorActive = true;
    const btn = document.getElementById('btnInspectorToggle');
    if(btn) { btn.innerText = 'Inspeccionar: ON'; btn.style.color = '#39ff14'; btn.style.borderColor = '#39ff14'; }
    document.addEventListener('mouseover', handleDevHover);
    document.addEventListener('mouseout', handleDevMouseOut);
    document.addEventListener('click', handleDevClick, { capture: true });
}

function deactivateInspector() {
    isInspectorActive = false;
    const btn = document.getElementById('btnInspectorToggle');
    if(btn) { btn.innerText = 'Inspeccionar: OFF'; btn.style.color = '#8b949e'; btn.style.borderColor = '#30363d'; }
    document.removeEventListener('mouseover', handleDevHover);
    document.removeEventListener('mouseout', handleDevMouseOut);
    document.removeEventListener('click', handleDevClick, { capture: true });
    if (currentTargetElement) { 
        currentTargetElement.classList.remove('dev-selected-target', 'dev-hover-target'); 
        currentTargetElement = null; 
    }
}

function handleDevHover(e) { if(isInspectorActive && !e.target.closest('#devEditorPanel')) e.target.classList.add('dev-hover-target'); }
function handleDevMouseOut(e) { if(isInspectorActive) e.target.classList.remove('dev-hover-target'); }

function handleDevClick(e) {
    if(!isInspectorActive || e.target.closest('#devEditorPanel')) return;
    e.preventDefault(); e.stopPropagation();

    if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
    currentTargetElement = e.target;
    currentTargetElement.classList.add('dev-selected-target');
    currentTargetElement.classList.remove('dev-hover-target');
    
    loadElementDataIntoPanel(currentTargetElement);
    deactivateInspector();
}

// ==========================================
// LECTURA DE ELEMENTOS AL PANEL
// ==========================================
function getShorthand(computed, type) {
    if (type === 'padding') {
        if(computed.padding && computed.padding !== '') return computed.padding;
        return `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`.replace(/ 0px/g, ' 0');
    }
    if (type === 'radius') {
        if(computed.borderRadius && computed.borderRadius !== '') return computed.borderRadius;
        return `${computed.borderTopLeftRadius} ${computed.borderTopRightRadius} ${computed.borderBottomRightRadius} ${computed.borderBottomLeftRadius}`;
    }
    return '';
}

function rgbToStrictHex(rgba) {
    // Si es transparente o vacío, forzar a negro para que el <input type="color"> no crashee
    if (!rgba || rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent') return '#000000';
    if (rgba.startsWith('#')) return rgba.substring(0, 7); // Limitar a 6 caracteres (7 con el #)
    
    const rgb = rgba.match(/\d+/g);
    if (!rgb || rgb.length < 3) return '#000000';
    
    const r = parseInt(rgb[0]).toString(16).padStart(2, '0');
    const g = parseInt(rgb[1]).toString(16).padStart(2, '0');
    const b = parseInt(rgb[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function loadElementDataIntoPanel(element) {
    // Generar Selector
    if (element.id && element.id !== '') { 
        currentSelectorTarget = `#${element.id}`; 
    } else if (element.classList.length > 0) {
        let cleanClasses = Array.from(element.classList).filter(c => !c.includes('dev-') && !c.includes('active'));
        currentSelectorTarget = cleanClasses.length > 0 ? `.${cleanClasses[0]}` : element.tagName.toLowerCase();
    } else { 
        currentSelectorTarget = element.tagName.toLowerCase(); 
    }
    
    document.getElementById('devTargetSelector').innerText = currentSelectorTarget;
    const computed = window.getComputedStyle(element);
    
    // Cargar Colores (Asegurando hex estricto para los inputs)
    const bgHex = rgbToStrictHex(computed.backgroundColor); 
    const textHex = rgbToStrictHex(computed.color);
    const bcHex = rgbToStrictHex(computed.borderColor);
    
    document.getElementById('devBgColor').value = bgHex;
    document.getElementById('devBgText').value = computed.backgroundColor;
    document.getElementById('devTextColor').value = textHex;
    document.getElementById('devTextText').value = computed.color;
    document.getElementById('devBorderColor').value = bcHex;
    document.getElementById('devBorderText').value = computed.borderColor;
    
    document.getElementById('devBorderBottom').value = computed.borderBottom;
    document.getElementById('devBorderRadius').value = getShorthand(computed, 'radius');
    document.getElementById('devPadding').value = getShorthand(computed, 'padding');
    document.getElementById('devFontSize').value = computed.fontSize;

    // FIX 2: Lógica Segura para mostrar Caja de Texto (Lista Blanca de Tags)
    const textEditableTags = ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LABEL','STRONG','EM','LI','TH','TD', 'DIV'];
    const tagName = element.tagName.toUpperCase();
    
    // Mostramos si está en la lista blanca, pero no si es un Div con demasiados componentes complejos hijos
    if(textEditableTags.includes(tagName) && element.children.length < 3) {
        document.getElementById('devTextGroup').style.display = 'flex';
        document.getElementById('devElementText').value = dynamicContentDB[currentSelectorTarget] || element.innerText.trim();
    } else {
        document.getElementById('devTextGroup').style.display = 'none';
        document.getElementById('devElementText').value = '';
    }

    // FIX 3: Lógica para mostrar Animaciones (Revisa si él o su padre es un botón)
    const isClickable = ['BUTTON', 'A'].includes(tagName) || element.classList.contains('tab-btn') || element.classList.contains('md-btn') || computed.cursor === 'pointer' || element.closest('button') !== null;
    
    if (isClickable) {
        document.getElementById('devAnimGroup').style.display = 'flex';
        const activeSel = currentSelectorTarget + ':active';
        if(dynamicStylesDB[activeSel] && dynamicStylesDB[activeSel]['transform']) {
            document.getElementById('devAnimEnable').checked = true;
            document.getElementById('devAnimType').style.display = 'block';
        } else {
            document.getElementById('devAnimEnable').checked = false;
            document.getElementById('devAnimType').style.display = 'none';
        }
    } else {
        document.getElementById('devAnimGroup').style.display = 'none';
    }
}

// ==========================================
// GUARDAR Y APLICAR AL DOM
// ==========================================

window.applyAndSaveDevStyles = () => {
    if (!currentSelectorTarget) return alert("Selecciona un elemento primero.");
    
    // 1. Guardar Estilos (Las variables usan nombres CSS correctos)
    const newStyles = {
        'background-color': document.getElementById('devBgText').value,
        'color': document.getElementById('devTextText').value,
        'border-color': document.getElementById('devBorderText').value,
        'border-bottom': document.getElementById('devBorderBottom').value,
        'border-radius': document.getElementById('devBorderRadius').value,
        'padding': document.getElementById('devPadding').value,
        'font-size': document.getElementById('devFontSize').value
    };

    if(!dynamicStylesDB[currentSelectorTarget]) dynamicStylesDB[currentSelectorTarget] = {};
    for (let property in newStyles) {
        if(newStyles[property].trim() !== '') dynamicStylesDB[currentSelectorTarget][property] = newStyles[property];
    }

    // 2. Guardar Animaciones
    if (document.getElementById('devAnimGroup').style.display === 'flex') {
        const activeSel = currentSelectorTarget + ':active';
        if (document.getElementById('devAnimEnable').checked) {
            const animType = document.getElementById('devAnimType').value;
            dynamicStylesDB[currentSelectorTarget]['transition'] = 'all 0.2s ease !important'; 
            
            dynamicStylesDB[activeSel] = {};
            if(animType === 'scale-down') { dynamicStylesDB[activeSel]['transform'] = 'scale(0.92)'; } 
            else if(animType === 'scale-up') { dynamicStylesDB[activeSel]['transform'] = 'scale(1.05)'; } 
            else if(animType === 'pulse-glow') {
                dynamicStylesDB[activeSel]['box-shadow'] = '0 0 15px var(--note-accent)';
                dynamicStylesDB[activeSel]['transform'] = 'scale(0.98)';
            }
        } else {
            delete dynamicStylesDB[activeSel]; 
        }
    }

    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    injectDynamicStyleSheet();

    // 3. Guardar Textos
    if(document.getElementById('devTextGroup').style.display !== 'none') {
        const newText = document.getElementById('devElementText').value;
        if(newText.trim() !== '') {
            dynamicContentDB[currentSelectorTarget] = newText;
        } else {
            delete dynamicContentDB[currentSelectorTarget]; 
        }
        localStorage.setItem('dev_dynamic_content', JSON.stringify(dynamicContentDB));
        applyContentOverrides();
    }
    
    // Feedback
    const btn = document.querySelector('.dev-btn'); 
    const originalText = btn.innerText;
    btn.innerText = '✅ ¡Guardado!'; 
    setTimeout(() => btn.innerText = originalText, 1500);
};

// ==========================================
// INYECTORES
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
    for(let selector in dynamicContentDB) {
        try {
            document.querySelectorAll(selector).forEach(el => {
                // Solo reemplazar si es diferente para evitar ciclos infinitos del MutationObserver
                if(el.innerHTML !== dynamicContentDB[selector]) {
                    el.innerHTML = dynamicContentDB[selector];
                }
            });
        } catch(e) {}
    }
}

// ==========================================
// REINICIOS
// ==========================================

window.resetTargetStyles = () => {
    if(!currentSelectorTarget) return;
    delete dynamicStylesDB[currentSelectorTarget]; 
    delete dynamicStylesDB[currentSelectorTarget + ':active'];
    delete dynamicContentDB[currentSelectorTarget];
    
    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    localStorage.setItem('dev_dynamic_content', JSON.stringify(dynamicContentDB));
    
    injectDynamicStyleSheet(); 
    window.location.reload(); // Recarga para limpiar el DOM de textos huérfanos
};

window.factoryResetStyles = () => {
    if(confirm("⚠️ ¿Borrar TODOS los colores, animaciones y textos personalizados?")) {
        dynamicStylesDB = {}; 
        dynamicContentDB = {};
        localStorage.removeItem('dev_dynamic_styles'); 
        localStorage.removeItem('dev_dynamic_content');
        window.location.reload(); 
    }
};
