// ==========================================================================
// CORE DEL DEVELOPER MODE (RUNTIME THEME BUILDER + DOM MUTATION)
// ==========================================================================

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
let isDevModeActive = false;
let isInspectorActive = false;
let currentTargetElement = null;
let currentSelectorTarget = null;

// Base de datos de Diseño (CSS)
let dynamicStylesDB = JSON.parse(localStorage.getItem('dev_dynamic_styles')) || {};
// Base de datos de Contenido (Textos)
let dynamicContentDB = JSON.parse(localStorage.getItem('dev_dynamic_content')) || {};

export function initDevMode() {
    injectDynamicStyleSheet();
    applyContentOverrides(); // Aplicar textos guardados
    
    // El Vigilante: Escucha cambios en la app para re-aplicar textos (Ej. cambiar de tab)
    const observer = new MutationObserver(() => applyContentOverrides());
    observer.observe(document.body, { childList: true, subtree: true });

    // Atajo Alt + Shift + D
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.code === 'KeyD') {
            e.preventDefault();
            if(!isDevModeActive) {
                document.getElementById('devLoginModal').style.display = 'flex';
                document.getElementById('devUser').focus();
            } else {
                window.closeDevPanel();
            }
        }
    });
}

// LÓGICA DE AUTENTICACIÓN Y PANEL
window.authenticateDev = () => {
    const user = document.getElementById('devUser').value;
    const pass = document.getElementById('devPass').value;
    if (user === DEV_CREDS.user && pass === DEV_CREDS.pass) {
        document.getElementById('devLoginModal').style.display = 'none';
        isDevModeActive = true; document.getElementById('devUser').value = ''; document.getElementById('devPass').value = '';
        openDevPanel();
    } else { alert("Acceso denegado."); }
};
window.closeDevLogin = () => { document.getElementById('devLoginModal').style.display = 'none'; };

function openDevPanel() { document.getElementById('devEditorPanel').style.display = 'flex'; activateInspector(); }
window.closeDevPanel = () => { document.getElementById('devEditorPanel').style.display = 'none'; deactivateInspector(); isDevModeActive = false; };

// MODO INSPECTOR
window.toggleInspectorMode = () => { isInspectorActive ? deactivateInspector() : activateInspector(); };

function activateInspector() {
    isInspectorActive = true;
    const btn = document.getElementById('btnInspectorToggle');
    btn.innerText = 'Inspeccionar: ON'; btn.style.color = '#39ff14'; btn.style.borderColor = '#39ff14';
    document.addEventListener('mouseover', handleDevHover);
    document.addEventListener('mouseout', handleDevMouseOut);
    document.addEventListener('click', handleDevClick, { capture: true });
}

function deactivateInspector() {
    isInspectorActive = false;
    const btn = document.getElementById('btnInspectorToggle');
    btn.innerText = 'Inspeccionar: OFF'; btn.style.color = '#8b949e'; btn.style.borderColor = '#30363d';
    document.removeEventListener('mouseover', handleDevHover);
    document.removeEventListener('mouseout', handleDevMouseOut);
    document.removeEventListener('click', handleDevClick, { capture: true });
    if (currentTargetElement) { currentTargetElement.classList.remove('dev-selected-target', 'dev-hover-target'); currentTargetElement = null; }
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

// LECTURA Y MAPEO DE DATOS AL PANEL
function loadElementDataIntoPanel(element) {
    // Generar selector único
    if (element.id && element.id !== '') { currentSelectorTarget = `#${element.id}`; } 
    else if (element.classList.length > 0) {
        let cleanClasses = Array.from(element.classList).filter(c => !c.includes('dev-') && !c.includes('active'));
        currentSelectorTarget = cleanClasses.length > 0 ? `.${cleanClasses[0]}` : element.tagName.toLowerCase();
    } else { currentSelectorTarget = element.tagName.toLowerCase(); }
    
    document.getElementById('devTargetSelector').innerText = currentSelectorTarget;
    
    const computed = window.getComputedStyle(element);
    
    // Cargar Color/Background
    const bgHex = rgbToHex(computed.backgroundColor); const textHex = rgbToHex(computed.color);
    document.getElementById('devBgColor').value = bgHex !== '#00000000' ? bgHex : '#000000';
    document.getElementById('devBgText').value = computed.backgroundColor;
    document.getElementById('devTextColor').value = textHex !== '#00000000' ? textHex : '#ffffff';
    document.getElementById('devTextText').value = computed.color;
    
    // Cargar Bordes
    const bcHex = rgbToHex(computed.borderColor);
    document.getElementById('devBorderColor').value = bcHex !== '#00000000' ? bcHex : '#000000';
    document.getElementById('devBorderText').value = computed.borderColor;
    document.getElementById('devBorderBottom').value = computed.borderBottom;

    document.getElementById('devBorderRadius').value = computed.borderRadius;
    document.getElementById('devPadding').value = computed.padding;
    document.getElementById('devFontSize').value = computed.fontSize;

    // Sincronización visual inputs de color
    document.getElementById('devBgColor').oninput = (e) => document.getElementById('devBgText').value = e.target.value;
    document.getElementById('devTextColor').oninput = (e) => document.getElementById('devTextText').value = e.target.value;
    document.getElementById('devBorderColor').oninput = (e) => document.getElementById('devBorderText').value = e.target.value;

    // Lógica Inteligente para la Caja de Texto
    // Mostrar solo si el elemento no tiene cajas HTML complejas hijas (botones, spans, p son válidos)
    if(element.children.length === 0 || (element.children.length === 1 && element.children[0].tagName === 'I')) {
        document.getElementById('devTextGroup').style.display = 'flex';
        document.getElementById('devElementText').value = dynamicContentDB[currentSelectorTarget] || element.innerHTML.trim();
    } else {
        document.getElementById('devTextGroup').style.display = 'none';
        document.getElementById('devElementText').value = '';
    }

    // Lógica para el Checkbox de Animación
    const activeSel = currentSelectorTarget + ':active';
    if(dynamicStylesDB[activeSel] && dynamicStylesDB[activeSel]['transform']) {
        document.getElementById('devAnimEnable').checked = true;
        document.getElementById('devAnimType').style.display = 'block';
    } else {
        document.getElementById('devAnimEnable').checked = false;
        document.getElementById('devAnimType').style.display = 'none';
    }
}

window.toggleAnimSelect = () => {
    document.getElementById('devAnimType').style.display = document.getElementById('devAnimEnable').checked ? 'block' : 'none';
};

// GUARDAR TODOS LOS CAMBIOS
window.applyAndSaveDevStyles = () => {
    if (!currentSelectorTarget) return alert("Selecciona un elemento primero.");
    
    // 1. Guardar Estilos Regulares
    const newStyles = {
        'background': document.getElementById('devBgText').value,
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

    // 2. Guardar Lógica de Animaciones (Pseudo-clase :active)
    const activeSel = currentSelectorTarget + ':active';
    if (document.getElementById('devAnimEnable').checked) {
        const animType = document.getElementById('devAnimType').value;
        dynamicStylesDB[currentSelectorTarget]['transition'] = 'all 0.2s ease !important'; // Suavizado base
        
        dynamicStylesDB[activeSel] = {};
        if(animType === 'scale-down') {
            dynamicStylesDB[activeSel]['transform'] = 'scale(0.92)';
        } else if(animType === 'scale-up') {
            dynamicStylesDB[activeSel]['transform'] = 'scale(1.05)';
        } else if(animType === 'pulse-glow') {
            dynamicStylesDB[activeSel]['box-shadow'] = '0 0 15px var(--note-accent)';
            dynamicStylesDB[activeSel]['transform'] = 'scale(0.98)';
        }
    } else {
        delete dynamicStylesDB[activeSel]; // Limpiar si se desmarca
    }

    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    injectDynamicStyleSheet();

    // 3. Guardar Lógica de Texto
    if(document.getElementById('devTextGroup').style.display !== 'none') {
        const newText = document.getElementById('devElementText').value;
        if(newText.trim() !== '') {
            dynamicContentDB[currentSelectorTarget] = newText;
        } else {
            delete dynamicContentDB[currentSelectorTarget]; // Restaurar si lo dejan en blanco
        }
        localStorage.setItem('dev_dynamic_content', JSON.stringify(dynamicContentDB));
        applyContentOverrides();
    }
    
    // Feedback
    const btn = document.querySelector('.dev-btn'); const originalText = btn.innerText;
    btn.innerText = '✅ Guardado!'; setTimeout(() => btn.innerText = originalText, 1500);
};

// INYECTORES EN TIEMPO DE EJECUCIÓN (Runtime)
function injectDynamicStyleSheet() {
    let styleTag = document.getElementById('dev-dynamic-stylesheet');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'dev-dynamic-stylesheet'; document.head.appendChild(styleTag); }

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
    // Escanear todo el DOM y reemplazar textos basados en los selectores guardados
    for(let selector in dynamicContentDB) {
        try {
            document.querySelectorAll(selector).forEach(el => {
                if(el.innerHTML !== dynamicContentDB[selector]) {
                    el.innerHTML = dynamicContentDB[selector];
                }
            });
        } catch(e) {}
    }
}

// REINICIOS
window.resetTargetStyles = () => {
    if(!currentSelectorTarget) return;
    delete dynamicStylesDB[currentSelectorTarget]; delete dynamicStylesDB[currentSelectorTarget + ':active'];
    delete dynamicContentDB[currentSelectorTarget];
    
    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    localStorage.setItem('dev_dynamic_content', JSON.stringify(dynamicContentDB));
    injectDynamicStyleSheet(); applyContentOverrides();
    alert(`Diseño revertido para: ${currentSelectorTarget}. Refresca la app para ver el texto original.`);
};

window.factoryResetStyles = () => {
    if(confirm("⚠️ ¿Borrar TODOS los colores, animaciones y textos personalizados?")) {
        dynamicStylesDB = {}; dynamicContentDB = {};
        localStorage.removeItem('dev_dynamic_styles'); localStorage.removeItem('dev_dynamic_content');
        injectDynamicStyleSheet(); window.location.reload(); // Recarga dura para borrar textos
    }
};

// Utilidades
function rgbToHex(rgb) {
    if(!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '#00000000';
    if (rgb.startsWith('#')) return rgb;
    let a = rgb.split("(")[1].split(")")[0].split(",");
    let b = a.map(x => { x = parseInt(x).toString(16); return (x.length==1) ? "0"+x : x; });
    return "#" + b[0] + b[1] + b[2];
}
