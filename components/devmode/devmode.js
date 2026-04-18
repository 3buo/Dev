// ==========================================================================
// CORE DEL DEVELOPER MODE (RUNTIME THEME BUILDER)
// ==========================================================================

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
let isDevModeActive = false;
let isInspectorActive = false;
let currentTargetElement = null;
let currentSelectorTarget = null;

// Objeto maestro que almacena las modificaciones de CSS
// Estructura: { ".note-card": { "background-color": "#fff", "border-radius": "15px" } }
let dynamicStylesDB = JSON.parse(localStorage.getItem('dev_dynamic_styles')) || {};

// 1. INICIALIZADOR (Se ejecuta al arrancar la app para inyectar CSS guardado)
export function initDevMode() {
    injectDynamicStyleSheet();
    
    // Escuchar atajo de teclado: Alt + Shift + D
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.code === 'KeyD') {
            e.preventDefault();
            if(!isDevModeActive) {
                document.getElementById('devLoginModal').style.display = 'flex';
                document.getElementById('devUser').focus();
            } else {
                window.closeDevPanel(); // Apagar si ya estaba encendido
            }
        }
    });
}

// 2. LÓGICA DE AUTENTICACIÓN
window.authenticateDev = () => {
    const user = document.getElementById('devUser').value;
    const pass = document.getElementById('devPass').value;
    
    if (user === DEV_CREDS.user && pass === DEV_CREDS.pass) {
        document.getElementById('devLoginModal').style.display = 'none';
        isDevModeActive = true;
        document.getElementById('devUser').value = '';
        document.getElementById('devPass').value = '';
        openDevPanel();
    } else {
        alert("Acceso denegado. Credenciales incorrectas.");
    }
};

window.closeDevLogin = () => { document.getElementById('devLoginModal').style.display = 'none'; };

// 3. APERTURA Y CIERRE DEL PANEL
function openDevPanel() {
    document.getElementById('devEditorPanel').style.display = 'flex';
    activateInspector();
}

window.closeDevPanel = () => {
    document.getElementById('devEditorPanel').style.display = 'none';
    deactivateInspector();
    isDevModeActive = false;
};

// 4. MODO INSPECTOR (Capturar elementos en pantalla)
window.toggleInspectorMode = () => {
    isInspectorActive ? deactivateInspector() : activateInspector();
};

function activateInspector() {
    isInspectorActive = true;
    document.getElementById('btnInspectorToggle').innerText = 'Inspeccionar: ON';
    document.getElementById('btnInspectorToggle').style.color = '#39ff14';
    document.getElementById('btnInspectorToggle').style.borderColor = '#39ff14';
    
    document.addEventListener('mouseover', handleDevHover);
    document.addEventListener('mouseout', handleDevMouseOut);
    document.addEventListener('click', handleDevClick, { capture: true }); // Capture true interrumpe eventos normales
}

function deactivateInspector() {
    isInspectorActive = false;
    document.getElementById('btnInspectorToggle').innerText = 'Inspeccionar: OFF';
    document.getElementById('btnInspectorToggle').style.color = '#8b949e';
    document.getElementById('btnInspectorToggle').style.borderColor = '#30363d';
    
    document.removeEventListener('mouseover', handleDevHover);
    document.removeEventListener('mouseout', handleDevMouseOut);
    document.removeEventListener('click', handleDevClick, { capture: true });
    
    if (currentTargetElement) {
        currentTargetElement.classList.remove('dev-selected-target', 'dev-hover-target');
        currentTargetElement = null;
    }
}

// 5. EVENTOS DEL INSPECTOR
function handleDevHover(e) {
    if(!isInspectorActive) return;
    // Evitar inspeccionar el propio panel de desarrollo
    if(e.target.closest('#devEditorPanel')) return; 
    e.target.classList.add('dev-hover-target');
}

function handleDevMouseOut(e) {
    if(!isInspectorActive) return;
    e.target.classList.remove('dev-hover-target');
}

function handleDevClick(e) {
    if(!isInspectorActive) return;
    if(e.target.closest('#devEditorPanel')) return;
    
    e.preventDefault(); // Evita que botones o links funcionen
    e.stopPropagation(); // Evita burbujeo a la app principal

    if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
    
    currentTargetElement = e.target;
    currentTargetElement.classList.add('dev-selected-target');
    currentTargetElement.classList.remove('dev-hover-target');
    
    loadElementDataIntoPanel(currentTargetElement);
    deactivateInspector(); // Pausar inspector para dejar editar tranquilo
}

// 6. LECTURA DE DATOS (Mapear Elemento -> Panel)
function loadElementDataIntoPanel(element) {
    // Determinar el mejor selector (ID preferido, sino la primera Clase, sino la Etiqueta)
    if (element.id && element.id !== '') {
        currentSelectorTarget = `#${element.id}`;
    } else if (element.classList.length > 0) {
        // Obviamos las clases propias del dev mode
        let cleanClasses = Array.from(element.classList).filter(c => !c.includes('dev-'));
        currentSelectorTarget = cleanClasses.length > 0 ? `.${cleanClasses[0]}` : element.tagName.toLowerCase();
    } else {
        currentSelectorTarget = element.tagName.toLowerCase();
    }
    
    document.getElementById('devTargetSelector').innerText = currentSelectorTarget;
    
    // Leer estilos computados actuales del navegador
    const computed = window.getComputedStyle(element);
    
    // Convertir rgb() a hex para los inputs de tipo color
    const bgHex = rgbToHex(computed.backgroundColor);
    const textHex = rgbToHex(computed.color);

    document.getElementById('devBgColor').value = bgHex !== '#00000000' ? bgHex : '#000000';
    document.getElementById('devBgText').value = computed.backgroundColor;
    document.getElementById('devTextColor').value = textHex !== '#00000000' ? textHex : '#ffffff';
    document.getElementById('devTextText').value = computed.color;
    
    document.getElementById('devBorderRadius').value = computed.borderRadius;
    document.getElementById('devPadding').value = computed.padding;
    document.getElementById('devFontSize').value = computed.fontSize;

    // Sincronizar inputs de texto y color en vivo
    document.getElementById('devBgColor').oninput = (e) => document.getElementById('devBgText').value = e.target.value;
    document.getElementById('devTextColor').oninput = (e) => document.getElementById('devTextText').value = e.target.value;
}

// 7. APLICAR Y GUARDAR (El corazón del Theme Builder)
window.applyAndSaveDevStyles = () => {
    if (!currentSelectorTarget) return alert("Selecciona un elemento primero.");
    
    // Recolectar valores del panel
    const newStyles = {
        'background': document.getElementById('devBgText').value,
        'color': document.getElementById('devTextText').value,
        'border-radius': document.getElementById('devBorderRadius').value,
        'padding': document.getElementById('devPadding').value,
        'font-size': document.getElementById('devFontSize').value
    };

    // Actualizar la base de datos de estilos
    if(!dynamicStylesDB[currentSelectorTarget]) {
        dynamicStylesDB[currentSelectorTarget] = {};
    }
    
    // Solo guardar los que no estén vacíos
    for (let property in newStyles) {
        if(newStyles[property].trim() !== '') {
            dynamicStylesDB[currentSelectorTarget][property] = newStyles[property];
        }
    }

    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    
    // Inyectar al DOM inmediatamente
    injectDynamicStyleSheet();
    
    // Feedback visual
    const btn = document.querySelector('.dev-btn');
    const originalText = btn.innerText;
    btn.innerText = '✅ ¡Aplicado y Guardado!';
    setTimeout(() => btn.innerText = originalText, 1500);
};

// 8. INYECTOR CSS GLOBAL
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
            // Se usa !important forzado para asegurar que sobreescriba los CSS originales del código fuente
            cssString += `  ${property}: ${dynamicStylesDB[selector][property]} !important;\n`;
        }
        cssString += `}\n\n`;
    }

    styleTag.innerHTML = cssString;
}

// 9. REINICIOS
window.resetTargetStyles = () => {
    if(!currentSelectorTarget || !dynamicStylesDB[currentSelectorTarget]) return;
    delete dynamicStylesDB[currentSelectorTarget];
    localStorage.setItem('dev_dynamic_styles', JSON.stringify(dynamicStylesDB));
    injectDynamicStyleSheet();
    alert(`Estilos revertidos para ${currentSelectorTarget}`);
};

window.factoryResetStyles = () => {
    if(confirm("⚠️ ¿Estás seguro? Esto borrará TODAS las modificaciones de interfaz que hayas hecho en toda la app.")) {
        dynamicStylesDB = {};
        localStorage.removeItem('dev_dynamic_styles');
        injectDynamicStyleSheet();
        window.closeDevPanel();
    }
};

// UTILIDADES
function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    let a = rgb.split("(")[1].split(")")[0];
    a = a.split(",");
    let b = a.map(function(x){             
        x = parseInt(x).toString(16);     
        return (x.length==1) ? "0"+x : x; 
    });
    return "#" + b[0] + b[1] + b[2];
}
