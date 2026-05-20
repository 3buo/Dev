import { ensureDevModeShadowRoot, getDevModeRoot } from './devmode-shadow.js';

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
const DEV_STYLES_V2_KEY = 'dev_dynamic_styles_v2';
const DEV_CONTENT_V2_KEY = 'dev_dynamic_content_v2';
const DEV_STYLES_LEGACY_KEY = 'dev_dynamic_styles';
const DEV_CONTENT_LEGACY_KEY = 'dev_dynamic_content';

let isDevModeActive = false;
let isInspectorActive = false;
/** @type {HTMLElement | null} */
let currentTargetElement = null;
/** @type {string | null} */
let currentTargetDevId = null;
let isOverridingText = false;

/** @type {ShadowRoot | null} */
let devRoot = null;
/** @type {MutationObserver | null} */
let textObserver = null;
/** @type {MutationObserver | null} */
let idObserver = null;
/** @type {HTMLElement | null} */
let activeInlineEditor = null;

const state = {
    /** @type {Record<string, { styles: Record<string, string>, active: Record<string, string> }>} */
    dynamicStylesById: {},
    /** @type {Record<string, string>} */
    dynamicContentById: {},
    /** @type {Record<string, Record<string, string>>} */
    legacyStyles: {},
    /** @type {Record<string, string>} */
    legacyContent: {}
};

function $(id) {
    if (!devRoot) return null;
    return devRoot.getElementById(id);
}

function escapeForCss(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function getElementByDevId(devId) {
    return document.querySelector(`[data-dev-id="${escapeForCss(devId)}"]`);
}

function persistV2State() {
    localStorage.setItem(DEV_STYLES_V2_KEY, JSON.stringify(state.dynamicStylesById));
    localStorage.setItem(DEV_CONTENT_V2_KEY, JSON.stringify(state.dynamicContentById));
}

function loadPersistedState() {
    try {
        state.dynamicStylesById = JSON.parse(localStorage.getItem(DEV_STYLES_V2_KEY) || '{}');
    } catch {
        state.dynamicStylesById = {};
        localStorage.removeItem(DEV_STYLES_V2_KEY);
    }

    try {
        state.dynamicContentById = JSON.parse(localStorage.getItem(DEV_CONTENT_V2_KEY) || '{}');
    } catch {
        state.dynamicContentById = {};
        localStorage.removeItem(DEV_CONTENT_V2_KEY);
    }

    // fallback legacy sin mutar formato previo
    try {
        state.legacyStyles = JSON.parse(localStorage.getItem(DEV_STYLES_LEGACY_KEY) || '{}');
    } catch {
        state.legacyStyles = {};
    }

    try {
        state.legacyContent = JSON.parse(localStorage.getItem(DEV_CONTENT_LEGACY_KEY) || '{}');
    } catch {
        state.legacyContent = {};
    }
}

function generateDevId() {
    if (window.crypto?.randomUUID) return `dev-${window.crypto.randomUUID()}`;
    return `dev-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function shouldIgnoreElementForDevMode(el) {
    if (!(el instanceof HTMLElement)) return true;
    if (devRoot && devRoot.contains(el)) return true;
    if (el.closest('#devmode-shadow-host')) return true;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return true;
    return false;
}

function ensureDevIdForElement(el) {
    if (!(el instanceof HTMLElement)) return null;
    if (shouldIgnoreElementForDevMode(el)) return null;
    if (!el.dataset.devId) el.dataset.devId = generateDevId();
    return el.dataset.devId;
}

function ensureDevIdsInSubtree(rootNode = document.body) {
    if (!(rootNode instanceof Element || rootNode instanceof Document || rootNode instanceof DocumentFragment)) return;
    const elements = rootNode instanceof Element ? [rootNode, ...rootNode.querySelectorAll('*')] : [...rootNode.querySelectorAll('*')];
    for (const el of elements) ensureDevIdForElement(el);
}

function injectScopedUxCss() {
    if (!devRoot || devRoot.getElementById('dev-nocode-css')) return;
    const tag = document.createElement('style');
    tag.id = 'dev-nocode-css';
    tag.textContent = `
      .dev-sparkle { animation: devSparkle 420ms ease-out; }
      @keyframes devSparkle {
        0% { filter: drop-shadow(0 0 0 rgba(88,166,255,0)); transform: scale(1); }
        35% { filter: drop-shadow(0 0 16px rgba(88,166,255,0.35)); transform: scale(1.02); }
        100% { filter: drop-shadow(0 0 0 rgba(88,166,255,0)); transform: scale(1); }
      }

      .dev-floating-toolbar {
        position: fixed;
        z-index: 10000002;
        display: none;
        gap: 8px;
        align-items: center;
        padding: 8px 10px;
        border-radius: 12px;
        background: rgba(13, 17, 23, 0.75);
        border: 1px solid rgba(88, 166, 255, 0.55);
        backdrop-filter: blur(12px);
        box-shadow: 0 12px 45px rgba(0,0,0,0.45);
      }

      .dev-floating-toolbar input,
      .dev-floating-toolbar select,
      .dev-floating-toolbar button {
        background: rgba(1, 4, 9, 0.75);
        border: 1px solid #30363d;
        color: #c9d1d9;
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 12px;
      }

      .dev-floating-toolbar button {
        border-color: rgba(88, 166, 255, 0.45);
        cursor: pointer;
      }

      .dev-floating-toolbar button:hover {
        border-color: #58a6ff;
        color: #9ecbff;
      }

      .dev-floating-toolbar .dev-bind-btn {
        border-color: rgba(183, 148, 246, 0.5);
        color: #c4b5fd;
      }

      [data-dev-id].dev-hover-target {
        outline: 2px dashed #58a6ff !important;
        outline-offset: 2px !important;
      }

      [data-dev-id].dev-selected-target {
        outline: 2px solid #58a6ff !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.15) !important;
      }

      .dev-inline-editing {
        outline: 2px solid rgba(88,166,255,0.75) !important;
        outline-offset: 2px !important;
        border-radius: 4px;
      }

      .dev-toast {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 26px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(17, 26, 40, 0.92);
        border: 1px solid rgba(88,166,255,0.35);
        color: #c9d1d9;
        font-weight: 800;
        letter-spacing: 0.2px;
        z-index: 10000003;
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .dev-toast.show { opacity: 1; transform: translateX(-50%) translateY(-6px); }
    `;
    devRoot.appendChild(tag);
}

function getOrCreateToast() {
    if (!devRoot) return null;
    let toast = devRoot.getElementById('dev-toast-el');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'dev-toast-el';
        toast.className = 'dev-toast';
        toast.textContent = '✓ UI actualizado';
        devRoot.appendChild(toast);
    }
    return toast;
}

function showToast(message) {
    const toast = getOrCreateToast();
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 900);
}

function getOrCreateFloatingToolbar() {
    if (!devRoot) return null;
    let toolbar = devRoot.getElementById('devFloatingToolbar');
    if (toolbar) return toolbar;

    toolbar = document.createElement('div');
    toolbar.id = 'devFloatingToolbar';
    toolbar.className = 'dev-floating-toolbar';
    toolbar.innerHTML = `
      <label style="font-size:12px;color:#8b949e;">Color</label>
      <input id="devFloatTextColor" type="color" value="#ffffff" />
      <label style="font-size:12px;color:#8b949e;">Tamaño</label>
      <input id="devFloatFontSize" type="text" placeholder="16px" style="width:70px;" />
      <button id="devFloatApplyText">Aplicar</button>
      <button id="devFloatBindData" class="dev-bind-btn">Vincular Dato</button>
    `;
    devRoot.appendChild(toolbar);

    const applyBtn = toolbar.querySelector('#devFloatApplyText');
    const bindBtn = toolbar.querySelector('#devFloatBindData');

    applyBtn?.addEventListener('click', () => {
        if (!currentTargetDevId || !currentTargetElement) return;
        const colorInput = toolbar.querySelector('#devFloatTextColor');
        const sizeInput = toolbar.querySelector('#devFloatFontSize');
        const color = colorInput instanceof HTMLInputElement ? colorInput.value : '';
        const size = sizeInput instanceof HTMLInputElement ? sizeInput.value : '';

        if (!state.dynamicStylesById[currentTargetDevId]) {
            state.dynamicStylesById[currentTargetDevId] = { styles: {}, active: {} };
        }

        if (color) state.dynamicStylesById[currentTargetDevId].styles.color = color;
        if (size) state.dynamicStylesById[currentTargetDevId].styles['font-size'] = size;

        persistV2State();
        injectDynamicStyleSheet();
        showToast('✓ Estilo aplicado al nodo');
    });

    bindBtn?.addEventListener('click', () => {
        if (!currentTargetDevId) return;
        showToast(`🔗 Vincular Dato (${currentTargetDevId.slice(0, 10)}...)`);
    });

    return toolbar;
}

function positionFloatingToolbar(target) {
    const toolbar = getOrCreateFloatingToolbar();
    if (!toolbar || !target) return;
    const rect = target.getBoundingClientRect();
    const top = Math.max(8, rect.top - 48);
    const left = Math.max(8, Math.min(window.innerWidth - 320, rect.left));
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.display = 'flex';
}

function hideFloatingToolbar() {
    const toolbar = getOrCreateFloatingToolbar();
    if (!toolbar) return;
    toolbar.style.display = 'none';
}

function injectDynamicStyleSheet() {
    if (!devRoot) return;
    let styleTag = devRoot.getElementById('dev-dynamic-stylesheet');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dev-dynamic-stylesheet';
        devRoot.appendChild(styleTag);
    }

    let cssString = '/* DEVMODE V2 - ATOMIC BY data-dev-id */\n';
    for (const devId in state.dynamicStylesById) {
        const bucket = state.dynamicStylesById[devId];
        const baseStyles = bucket?.styles || {};
        const activeStyles = bucket?.active || {};
        const selector = `[data-dev-id="${escapeForCss(devId)}"]`;

        const baseProps = Object.keys(baseStyles);
        if (baseProps.length) {
            cssString += `${selector} {\n`;
            for (const prop of baseProps) cssString += `  ${prop}: ${baseStyles[prop]} !important;\n`;
            cssString += '}\n\n';
        }

        const activeProps = Object.keys(activeStyles);
        if (activeProps.length) {
            cssString += `${selector}:active {\n`;
            for (const prop of activeProps) cssString += `  ${prop}: ${activeStyles[prop]} !important;\n`;
            cssString += '}\n\n';
        }
    }

    // Legacy fallback (solo lectura)
    for (const selector in state.legacyStyles) {
        cssString += `${selector} {\n`;
        for (const property in state.legacyStyles[selector]) {
            cssString += `  ${property}: ${state.legacyStyles[selector][property]} !important;\n`;
        }
        cssString += '}\n\n';
    }

    styleTag.textContent = cssString;
}

function applyContentOverrides() {
    if (isOverridingText) return;
    isOverridingText = true;

    for (const devId in state.dynamicContentById) {
        const el = getElementByDevId(devId);
        const next = (state.dynamicContentById[devId] || '').trim();
        if (el && next && el.textContent?.trim() !== next) el.textContent = next;
    }

    // Legacy fallback (solo lectura)
    for (const selector in state.legacyContent) {
        try {
            document.querySelectorAll(selector).forEach((el) => {
                const next = (state.legacyContent[selector] || '').trim();
                if (next && el.textContent?.trim() !== next) el.textContent = next;
            });
        } catch {}
    }

    setTimeout(() => { isOverridingText = false; }, 50);
}

function ensureTextObserver() {
    if (textObserver) return;
    textObserver = new MutationObserver(() => applyContentOverrides());
    textObserver.observe(document.body, { childList: true, subtree: true });
}

function ensureDevIdObserver() {
    if (idObserver) return;
    idObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof Element) ensureDevIdsInSubtree(node);
            });
        }
    });
    idObserver.observe(document.body, { childList: true, subtree: true });
}

function rgbToStrictHex(rgba) {
    if (!rgba || rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent') return '';
    if (rgba.startsWith('#')) return rgba.substring(0, 7);
    const rgb = rgba.match(/\d+/g);
    if (!rgb || rgb.length < 3) return '';
    return `#${parseInt(rgb[0], 10).toString(16).padStart(2, '0')}${parseInt(rgb[1], 10).toString(16).padStart(2, '0')}${parseInt(rgb[2], 10).toString(16).padStart(2, '0')}`;
}

function extractPaddingAndRadius(computed, type) {
    if (type === 'padding') {
        const p = computed.getPropertyValue('padding');
        if (p) return p;
        return `${computed.getPropertyValue('padding-top') || '0px'} ${computed.getPropertyValue('padding-right') || '0px'} ${computed.getPropertyValue('padding-bottom') || '0px'} ${computed.getPropertyValue('padding-left') || '0px'}`.trim();
    }
    const r = computed.getPropertyValue('border-radius');
    if (r) return r;
    return `${computed.getPropertyValue('border-top-left-radius') || '0px'} ${computed.getPropertyValue('border-top-right-radius') || '0px'} ${computed.getPropertyValue('border-bottom-right-radius') || '0px'} ${computed.getPropertyValue('border-bottom-left-radius') || '0px'}`.trim();
}

function syncPanelFromCurrentTarget() {
    if (!currentTargetElement) return;
    const computed = window.getComputedStyle(currentTargetElement);

    const selectorLabel = $('devTargetSelector');
    if (selectorLabel) selectorLabel.textContent = currentTargetDevId || 'N/A';

    const bgColor = $('devBgColor');
    const bgText = $('devBgText');
    const txtColor = $('devTextColor');
    const txtText = $('devTextText');
    const brdColor = $('devBorderColor');
    const brdText = $('devBorderText');
    const borderBottom = $('devBorderBottom');
    const borderRadius = $('devBorderRadius');
    const padding = $('devPadding');
    const fontSize = $('devFontSize');

    if (bgColor instanceof HTMLInputElement) bgColor.value = rgbToStrictHex(computed.getPropertyValue('background-color')) || '#000000';
    if (bgText instanceof HTMLInputElement) bgText.value = computed.getPropertyValue('background-color');
    if (txtColor instanceof HTMLInputElement) txtColor.value = rgbToStrictHex(computed.getPropertyValue('color')) || '#ffffff';
    if (txtText instanceof HTMLInputElement) txtText.value = computed.getPropertyValue('color');
    if (brdColor instanceof HTMLInputElement) brdColor.value = rgbToStrictHex(computed.getPropertyValue('border-color')) || '#000000';
    if (brdText instanceof HTMLInputElement) brdText.value = computed.getPropertyValue('border-color');
    if (borderBottom instanceof HTMLInputElement) borderBottom.value = computed.getPropertyValue('border-bottom') || '';
    if (borderRadius instanceof HTMLInputElement) borderRadius.value = extractPaddingAndRadius(computed, 'radius');
    if (padding instanceof HTMLInputElement) padding.value = extractPaddingAndRadius(computed, 'padding');
    if (fontSize instanceof HTMLInputElement) fontSize.value = computed.getPropertyValue('font-size') || '';
}

function isTextLikeElement(el) {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName.toUpperCase();
    return ['H1','H2','H3','H4','H5','H6','P','SPAN','A','BUTTON','LABEL','STRONG','EM','LI','TH','TD','DIV'].includes(tag);
}

function beginInlineEditing(target) {
    if (!(target instanceof HTMLElement)) return;
    if (!isTextLikeElement(target)) return;
    const devId = ensureDevIdForElement(target);
    if (!devId) return;

    if (activeInlineEditor && activeInlineEditor !== target) commitInlineEditing(true);

    activeInlineEditor = target;
    target.dataset.devInlineOriginal = target.textContent || '';
    target.classList.add('dev-inline-editing');
    target.setAttribute('contenteditable', 'true');
    target.focus();

    const range = document.createRange();
    range.selectNodeContents(target);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const onBlur = () => commitInlineEditing(true);
    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitInlineEditing(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            commitInlineEditing(false);
        }
    };

    target.addEventListener('blur', onBlur, { once: true });
    target.addEventListener('keydown', onKeyDown);
    target.dataset.devInlineKeybound = '1';
}

function commitInlineEditing(accept) {
    if (!activeInlineEditor) return;
    const el = activeInlineEditor;
    const devId = el.dataset.devId;

    if (!accept) {
        el.textContent = el.dataset.devInlineOriginal || el.textContent || '';
    } else if (devId) {
        state.dynamicContentById[devId] = (el.textContent || '').trim();
        persistV2State();
    }

    el.removeAttribute('contenteditable');
    el.classList.remove('dev-inline-editing');
    delete el.dataset.devInlineOriginal;

    // remove keydown listeners by cloning technique if needed
    if (el.dataset.devInlineKeybound === '1') {
        const clone = el.cloneNode(true);
        el.replaceWith(clone);
        activeInlineEditor = null;

        if (currentTargetElement === el) {
            currentTargetElement = clone instanceof HTMLElement ? clone : null;
            currentTargetDevId = currentTargetElement?.dataset.devId || null;
            if (currentTargetElement) {
                currentTargetElement.classList.add('dev-selected-target');
                positionFloatingToolbar(currentTargetElement);
            }
        }

        applyContentOverrides();
        ensureDevIdForElement(clone);
        return;
    }

    activeInlineEditor = null;
    applyContentOverrides();
}

function handleDevHover(e) {
    if (!isInspectorActive) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (devRoot && devRoot.contains(target)) return;
    if (shouldIgnoreElementForDevMode(target)) return;
    ensureDevIdForElement(target);
    target.classList.add('dev-hover-target');
}

function handleDevMouseOut(e) {
    if (!isInspectorActive) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    target.classList.remove('dev-hover-target');
}

function handleDevClick(e) {
    if (!isInspectorActive) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (devRoot && devRoot.contains(target)) return;
    if (shouldIgnoreElementForDevMode(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const devId = ensureDevIdForElement(target);
    if (!devId) return;

    if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');

    currentTargetElement = target;
    currentTargetDevId = devId;
    target.classList.add('dev-selected-target');
    target.classList.remove('dev-hover-target');

    syncPanelFromCurrentTarget();
    positionFloatingToolbar(target);

    const panel = $('devEditorPanel');
    if (panel instanceof HTMLElement) panel.style.display = 'none';

    deactivateInspector();
}

function handleDevDoubleClick(e) {
    if (!isDevModeActive) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (devRoot && devRoot.contains(target)) return;
    if (shouldIgnoreElementForDevMode(target)) return;
    beginInlineEditing(target);
}

function activateInspector() {
    isInspectorActive = true;
    const btn = $('btnInspectorToggle');
    if (btn instanceof HTMLElement) {
        btn.innerText = 'Inspeccionar: ON';
        btn.style.color = '#39ff14';
        btn.style.borderColor = '#39ff14';
    }
    document.addEventListener('mouseover', handleDevHover);
    document.addEventListener('mouseout', handleDevMouseOut);
    document.addEventListener('click', handleDevClick, { capture: true });
}

function deactivateInspector() {
    isInspectorActive = false;
    const btn = $('btnInspectorToggle');
    if (btn instanceof HTMLElement) {
        btn.innerText = 'Inspeccionar: OFF';
        btn.style.color = '#8b949e';
        btn.style.borderColor = '#30363d';
    }
    document.removeEventListener('mouseover', handleDevHover);
    document.removeEventListener('mouseout', handleDevMouseOut);
    document.removeEventListener('click', handleDevClick, { capture: true });
}

function toggleInspectorMode() {
    if (isInspectorActive) deactivateInspector();
    else activateInspector();
}

function closeDevLogin() {
    const modal = $('devLoginModal');
    if (modal instanceof HTMLElement) modal.style.display = 'none';
}

function closeDevPanel() {
    const panel = $('devEditorPanel');
    if (panel instanceof HTMLElement) panel.style.display = 'none';
    hideFloatingToolbar();

    if (currentTargetElement) {
        currentTargetElement.classList.remove('dev-selected-target', 'dev-hover-target');
        currentTargetElement = null;
        currentTargetDevId = null;
    }

    deactivateInspector();
    isDevModeActive = false;
    window.__devModeIsAuthenticated = false;
}

function authenticateDev() {
    const user = $('devUser');
    const pass = $('devPass');
    const modal = $('devLoginModal');

    const username = user instanceof HTMLInputElement ? user.value : '';
    const password = pass instanceof HTMLInputElement ? pass.value : '';

    if (username !== DEV_CREDS.user || password !== DEV_CREDS.pass) {
        alert('Acceso denegado.');
        return;
    }

    if (modal instanceof HTMLElement) modal.style.display = 'none';
    isDevModeActive = true;
    window.__devModeIsAuthenticated = true;

    if (user instanceof HTMLInputElement) user.value = '';
    if (pass instanceof HTMLInputElement) pass.value = '';

    activateInspector();
    showToast('✅ DevMode activo (selecciona un nodo)');

    setTimeout(() => {
        try {
            if (typeof window.__initBackupUIFromDevMode === 'function') window.__initBackupUIFromDevMode();
            else if (typeof window.initBackupUI === 'function') window.initBackupUI();
        } catch {}
    }, 0);
}

function bindShadowUiActions() {
    const loginSubmit = $('devLoginSubmit');
    const loginCancel = $('devLoginCancel');
    const panelClose = $('devPanelClose');
    const inspectorBtn = $('btnInspectorToggle');
    const saveBtn = $('devBtnSave');
    const resetBtn = $('devBtnResetTarget');
    const factoryResetBtn = $('devBtnFactoryReset');
    const animCheck = $('devAnimEnable');

    loginSubmit?.addEventListener('click', authenticateDev);
    loginCancel?.addEventListener('click', closeDevLogin);
    panelClose?.addEventListener('click', closeDevPanel);
    inspectorBtn?.addEventListener('click', toggleInspectorMode);
    saveBtn?.addEventListener('click', applyAndSaveDevStyles);
    resetBtn?.addEventListener('click', resetTargetStyles);
    factoryResetBtn?.addEventListener('click', factoryResetStyles);

    animCheck?.addEventListener('change', (e) => {
        const checked = e.target instanceof HTMLInputElement ? e.target.checked : false;
        const animType = $('devAnimType');
        if (animType instanceof HTMLElement) animType.style.display = checked ? 'block' : 'none';
    });
}

function bindColorSyncEvents() {
    const sync = (colorId, textId, cssProp) => {
        const colorInput = $(colorId);
        const textInput = $(textId);
        if (!colorInput || !textInput) return;

        colorInput.addEventListener('input', (e) => {
            const value = e.target instanceof HTMLInputElement ? e.target.value : '';
            if (textInput instanceof HTMLInputElement) textInput.value = value;
            if (currentTargetElement) currentTargetElement.style.setProperty(cssProp, value, 'important');
        });

        textInput.addEventListener('input', (e) => {
            const value = e.target instanceof HTMLInputElement ? e.target.value : '';
            if (currentTargetElement) currentTargetElement.style.setProperty(cssProp, value, 'important');
            if (/^#[0-9A-Fa-f]{6}$/.test(value) && colorInput instanceof HTMLInputElement) colorInput.value = value;
        });
    };

    sync('devBgColor', 'devBgText', 'background-color');
    sync('devTextColor', 'devTextText', 'color');
    sync('devBorderColor', 'devBorderText', 'border-color');
}

function applyAndSaveDevStyles() {
    if (!currentTargetDevId) {
        alert('Selecciona un elemento primero.');
        return;
    }

    const bgText = $('devBgText');
    const txtText = $('devTextText');
    const brdText = $('devBorderText');
    const brdBottom = $('devBorderBottom');
    const radius = $('devBorderRadius');
    const padding = $('devPadding');
    const font = $('devFontSize');
    const animGroup = $('devAnimGroup');
    const animEnable = $('devAnimEnable');
    const animType = $('devAnimType');

    if (!state.dynamicStylesById[currentTargetDevId]) {
        state.dynamicStylesById[currentTargetDevId] = { styles: {}, active: {} };
    }

    const bucket = state.dynamicStylesById[currentTargetDevId];

    const newStyles = {
        'background-color': bgText instanceof HTMLInputElement ? bgText.value : '',
        color: txtText instanceof HTMLInputElement ? txtText.value : '',
        'border-color': brdText instanceof HTMLInputElement ? brdText.value : '',
        'border-bottom': brdBottom instanceof HTMLInputElement ? brdBottom.value : '',
        'border-radius': radius instanceof HTMLInputElement ? radius.value : '',
        padding: padding instanceof HTMLInputElement ? padding.value : '',
        'font-size': font instanceof HTMLInputElement ? font.value : ''
    };

    for (const property in newStyles) {
        const val = newStyles[property];
        if (val && val.trim() !== '') bucket.styles[property] = val;
        else delete bucket.styles[property];
    }

    if (animGroup instanceof HTMLElement && animGroup.style.display === 'flex') {
        if (animEnable instanceof HTMLInputElement && animEnable.checked) {
            const type = animType instanceof HTMLSelectElement ? animType.value : 'scale-down';
            bucket.styles.transition = 'all 0.2s ease';
            bucket.active = {};
            if (type === 'scale-down') bucket.active.transform = 'scale(0.92)';
            else if (type === 'scale-up') bucket.active.transform = 'scale(1.05)';
            else if (type === 'pulse-glow') {
                bucket.active['box-shadow'] = '0 0 15px var(--note-accent)';
                bucket.active.transform = 'scale(0.98)';
            }
        } else {
            bucket.active = {};
        }
    }

    persistV2State();
    injectDynamicStyleSheet();

    const btnSave = $('devBtnSave');
    if (btnSave instanceof HTMLElement) {
        const originalText = btnSave.innerText;
        btnSave.innerText = '✅ Guardado Atómico';
        btnSave.classList.add('dev-btn-success');
        setTimeout(() => {
            btnSave.innerText = originalText;
            btnSave.classList.remove('dev-btn-success');
        }, 1400);
    }

    showToast('✓ Cambios guardados por nodo');
}

function resetTargetStyles() {
    if (!currentTargetDevId) return;
    delete state.dynamicStylesById[currentTargetDevId];
    delete state.dynamicContentById[currentTargetDevId];
    persistV2State();
    injectDynamicStyleSheet();
    applyContentOverrides();
    showToast('↺ Nodo revertido');
}

function factoryResetStyles() {
    if (!confirm('⚠️ ¿Borrar TODOS los estilos/textos personalizados por nodo?')) return;
    state.dynamicStylesById = {};
    state.dynamicContentById = {};
    localStorage.removeItem(DEV_STYLES_V2_KEY);
    localStorage.removeItem(DEV_CONTENT_V2_KEY);
    injectDynamicStyleSheet();
    showToast('⚠️ Reset total aplicado');
}

function bindGlobalInteractions() {
    document.addEventListener('dblclick', handleDevDoubleClick, { capture: true });

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
            e.preventDefault();
            const modal = $('devLoginModal');
            if (!isDevModeActive) {
                if (modal instanceof HTMLElement) modal.style.display = 'flex';
                setTimeout(() => {
                    const user = $('devUser');
                    if (user instanceof HTMLInputElement) user.focus();
                }, 50);
            } else {
                closeDevPanel();
            }
        }

        if (isInspectorActive && e.key === 'Escape') closeDevPanel();
        if (activeInlineEditor && e.key === 'Escape') commitInlineEditing(false);
    });
}

/**
 * @typedef {Object} DevModeInterface
 * @property {() => void} init
 * @property {() => void} open
 * @property {() => void} close
 * @property {() => void} toggleInspector
 * @property {() => boolean} isAuthenticated
 */

function createBridge() {
    /** @type {DevModeInterface} */
    return {
        init: initDevMode,
        open: () => {
            const modal = $('devLoginModal');
            if (modal instanceof HTMLElement) modal.style.display = 'flex';
        },
        close: closeDevPanel,
        toggleInspector: toggleInspectorMode,
        isAuthenticated: () => Boolean(window.__devModeIsAuthenticated)
    };
}

export function initDevMode() {
    loadPersistedState();

    const { root } = ensureDevModeShadowRoot();
    devRoot = root || getDevModeRoot();
    if (!devRoot) return;

    window.__devModeIsAuthenticated = false;

    injectScopedUxCss();
    bindShadowUiActions();
    bindColorSyncEvents();
    bindGlobalInteractions();

    ensureDevIdsInSubtree(document.body);
    ensureTextObserver();
    ensureDevIdObserver();

    injectDynamicStyleSheet();
    applyContentOverrides();
}

export const devModeBridge = createBridge();
