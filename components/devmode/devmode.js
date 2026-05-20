import { ensureDevModeShadowRoot, getDevModeRoot } from './devmode-shadow.js';

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };

let isDevModeActive = false;
let isInspectorActive = false;
let currentTargetElement = null;
let currentSelectorTarget = null;
let isOverridingText = false;

/** @type {ShadowRoot | null} */
let devRoot = null;
/** @type {MutationObserver | null} */
let textObserver = null;

const state = {
    /** @type {Record<string, Record<string, string>>} */
    dynamicStylesDB: {},
    /** @type {Record<string, string>} */
    dynamicContentDB: {}
};

function loadPersistedState() {
    try {
        state.dynamicStylesDB = JSON.parse(localStorage.getItem('dev_dynamic_styles') || '{}');
        state.dynamicContentDB = JSON.parse(localStorage.getItem('dev_dynamic_content') || '{}');
    } catch (error) {
        state.dynamicStylesDB = {};
        state.dynamicContentDB = {};
        localStorage.removeItem('dev_dynamic_styles');
        localStorage.removeItem('dev_dynamic_content');
    }
}

function $(id) {
    if (!devRoot) return null;
    return devRoot.getElementById(id);
}

function saveStylesState() {
    localStorage.setItem('dev_dynamic_styles', JSON.stringify(state.dynamicStylesDB));
}

function saveContentState() {
    localStorage.setItem('dev_dynamic_content', JSON.stringify(state.dynamicContentDB));
}

function persistAll() {
    saveStylesState();
    saveContentState();
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
      #devEditorPanel .dev-btn, #devEditorPanel .dev-btn-danger {
        position: relative;
        overflow: hidden;
      }
      #devEditorPanel .dev-btn::after, #devEditorPanel .dev-btn-danger::after {
        content: '';
        position: absolute;
        top: -60px;
        left: -30px;
        width: 120px;
        height: 120px;
        background: radial-gradient(circle at center, rgba(88,166,255,0.35), rgba(88,166,255,0));
        opacity: 0;
        transition: opacity 220ms ease;
        pointer-events: none;
      }
      #devEditorPanel .dev-btn:hover::after, #devEditorPanel .dev-btn-danger:hover::after { opacity: 1; }
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
        z-index: 10000000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease, transform 160ms ease;
        box-shadow: 0 10px 35px rgba(0,0,0,0.55);
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

function bindUxFeedback() {
    if (!devRoot) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const canBeep = !!AudioCtx;
    const stateKey = 'dev_ui_sound_enabled';
    const isSoundEnabled = () => localStorage.getItem(stateKey) !== '0';

    function beep(freq = 560, durationMs = 45) {
        if (!canBeep || !isSoundEnabled()) return;
        try {
            const ctx = new AudioCtx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = freq;
            g.gain.value = 0.0001;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            const now = ctx.currentTime;
            g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
            o.stop(now + durationMs / 1000);
            setTimeout(() => ctx.close?.(), durationMs + 20);
        } catch (e) {}
    }

    devRoot.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        const btnEl = t.closest('#devEditorPanel .dev-btn, #devEditorPanel .dev-btn-danger, #btnInspectorToggle');
        if (!btnEl) return;
        const soundType = btnEl.id === 'btnInspectorToggle' ? 'toggle' : 'action';
        beep(soundType === 'toggle' ? 620 : 560, 45);
        btnEl.classList.add('dev-sparkle');
        setTimeout(() => btnEl.classList.remove('dev-sparkle'), 460);
        showToast('✓ UI actualizado');
    }, { capture: true });
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

function injectDynamicStyleSheet() {
    if (!devRoot) return;
    let styleTag = devRoot.getElementById('dev-dynamic-stylesheet');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dev-dynamic-stylesheet';
        devRoot.appendChild(styleTag);
    }

    let cssString = '/* GENERADO POR DEV MODE THEME BUILDER */\n';
    for (const selector in state.dynamicStylesDB) {
        cssString += `${selector} {\n`;
        for (const property in state.dynamicStylesDB[selector]) {
            cssString += `  ${property}: ${state.dynamicStylesDB[selector][property]} !important;\n`;
        }
        cssString += '}\n\n';
    }
    styleTag.textContent = cssString;
}

function applyContentOverrides() {
    if (isOverridingText) return;
    isOverridingText = true;

    for (const selector in state.dynamicContentDB) {
        try {
            document.querySelectorAll(selector).forEach((el) => {
                const next = state.dynamicContentDB[selector]?.trim() ?? '';
                if (next && el.textContent?.trim() !== next) el.textContent = next;
            });
        } catch (e) {}
    }

    setTimeout(() => { isOverridingText = false; }, 50);
}

function ensureTextObserver() {
    if (textObserver) return;
    textObserver = new MutationObserver(() => applyContentOverrides());
    textObserver.observe(document.body, { childList: true, subtree: true });
}

function getSafeSelector(el) {
    if (!el || !el.tagName) return '*';
    if (el.id && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(el.id)) return `#${el.id}`;
    const classes = Array.from(el.classList).filter((c) => !c.startsWith('dev-') && c !== 'active' && /^[a-zA-Z_]/.test(c));
    if (classes.length > 0) return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
    return el.tagName.toLowerCase();
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
        const pt = computed.getPropertyValue('padding-top') || '0px';
        const pr = computed.getPropertyValue('padding-right') || '0px';
        const pb = computed.getPropertyValue('padding-bottom') || '0px';
        const pl = computed.getPropertyValue('padding-left') || '0px';
        return `${pt} ${pr} ${pb} ${pl}`.trim();
    }
    const r = computed.getPropertyValue('border-radius');
    if (r) return r;
    const rtl = computed.getPropertyValue('border-top-left-radius') || '0px';
    const rtr = computed.getPropertyValue('border-top-right-radius') || '0px';
    const rbr = computed.getPropertyValue('border-bottom-right-radius') || '0px';
    const rbl = computed.getPropertyValue('border-bottom-left-radius') || '0px';
    return `${rtl} ${rtr} ${rbr} ${rbl}`.trim();
}

function loadElementDataIntoPanel(element) {
    currentSelectorTarget = getSafeSelector(element);
    const selectorLabel = $('devTargetSelector');
    if (selectorLabel) selectorLabel.textContent = currentSelectorTarget;

    const computed = window.getComputedStyle(element);

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

    const tagName = element.tagName.toUpperCase();
    const textEditableTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON', 'LABEL', 'STRONG', 'EM', 'LI', 'TH', 'TD', 'DIV'];
    const textGroup = $('devTextGroup');
    const textField = $('devElementText');

    if (textGroup instanceof HTMLElement && textField instanceof HTMLInputElement) {
        if (textEditableTags.includes(tagName) && element.children.length < 3) {
            textGroup.style.display = 'flex';
            textField.value = state.dynamicContentDB[currentSelectorTarget] || element.innerText.trim();
        } else {
            textGroup.style.display = 'none';
            textField.value = '';
        }
    }

    const isClickable = ['BUTTON', 'A'].includes(tagName)
        || element.classList.contains('tab-btn')
        || element.classList.contains('md-btn')
        || computed.getPropertyValue('cursor') === 'pointer'
        || element.closest('button') !== null;

    const animGroup = $('devAnimGroup');
    const animEnable = $('devAnimEnable');
    const animType = $('devAnimType');

    if (animGroup instanceof HTMLElement && animEnable instanceof HTMLInputElement && animType instanceof HTMLElement) {
        if (isClickable) {
            animGroup.style.display = 'flex';
            const activeSel = `${currentSelectorTarget}:active`;
            if (state.dynamicStylesDB[activeSel]?.transform) {
                animEnable.checked = true;
                animType.style.display = 'block';
            } else {
                animEnable.checked = false;
                animType.style.display = 'none';
            }
        } else {
            animGroup.style.display = 'none';
        }
    }
}

function handleDevHover(e) {
    if (!isInspectorActive) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (devRoot && devRoot.contains(target)) return;
    target.classList.add('dev-hover-target');
}

function handleDevMouseOut(e) {
    if (!isInspectorActive) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    target.classList.remove('dev-hover-target');
}

function handleDevClick(e) {
    if (!isInspectorActive) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (devRoot && devRoot.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();

    if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
    currentTargetElement = target;
    currentTargetElement.classList.add('dev-selected-target');
    currentTargetElement.classList.remove('dev-hover-target');

    loadElementDataIntoPanel(currentTargetElement);
    deactivateInspector();
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

    if (currentTargetElement) {
        currentTargetElement.classList.remove('dev-selected-target', 'dev-hover-target');
        currentTargetElement = null;
    }
}

function authenticateDev() {
    const user = $('devUser');
    const pass = $('devPass');
    const modal = $('devLoginModal');
    const panel = $('devEditorPanel');

    const username = user instanceof HTMLInputElement ? user.value : '';
    const password = pass instanceof HTMLInputElement ? pass.value : '';

    if (username === DEV_CREDS.user && password === DEV_CREDS.pass) {
        if (modal instanceof HTMLElement) modal.style.display = 'none';
        isDevModeActive = true;
        window.__devModeIsAuthenticated = true;

        if (user instanceof HTMLInputElement) user.value = '';
        if (pass instanceof HTMLInputElement) pass.value = '';

        if (panel instanceof HTMLElement) {
            panel.style.display = 'flex';
            activateInspector();
        }

        setTimeout(() => {
            try {
                if (typeof window.__initBackupUIFromDevMode === 'function') window.__initBackupUIFromDevMode();
                else if (typeof window.initBackupUI === 'function') window.initBackupUI();
            } catch (e) {}
        }, 0);
    } else {
        alert('Acceso denegado.');
    }
}

function closeDevLogin() {
    const modal = $('devLoginModal');
    if (modal instanceof HTMLElement) modal.style.display = 'none';
}

function closeDevPanel() {
    const panel = $('devEditorPanel');
    if (panel instanceof HTMLElement) panel.style.display = 'none';
    deactivateInspector();
    isDevModeActive = false;
    window.__devModeIsAuthenticated = false;
}

function toggleInspectorMode() {
    if (isInspectorActive) deactivateInspector();
    else activateInspector();
}

function applyAndSaveDevStyles() {
    if (!currentSelectorTarget) {
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

    const newStyles = {
        'background-color': bgText instanceof HTMLInputElement ? bgText.value : '',
        color: txtText instanceof HTMLInputElement ? txtText.value : '',
        'border-color': brdText instanceof HTMLInputElement ? brdText.value : '',
        'border-bottom': brdBottom instanceof HTMLInputElement ? brdBottom.value : '',
        'border-radius': radius instanceof HTMLInputElement ? radius.value : '',
        padding: padding instanceof HTMLInputElement ? padding.value : '',
        'font-size': font instanceof HTMLInputElement ? font.value : ''
    };

    if (!state.dynamicStylesDB[currentSelectorTarget]) state.dynamicStylesDB[currentSelectorTarget] = {};

    for (const property in newStyles) {
        const val = newStyles[property];
        if (val && val.trim() !== '') state.dynamicStylesDB[currentSelectorTarget][property] = val;
        else delete state.dynamicStylesDB[currentSelectorTarget][property];
    }

    const animGroup = $('devAnimGroup');
    const animEnable = $('devAnimEnable');
    const animType = $('devAnimType');

    if (animGroup instanceof HTMLElement && animGroup.style.display === 'flex') {
        const activeSel = `${currentSelectorTarget}:active`;
        if (animEnable instanceof HTMLInputElement && animEnable.checked) {
            const type = animType instanceof HTMLSelectElement ? animType.value : 'scale-down';
            state.dynamicStylesDB[currentSelectorTarget].transition = 'all 0.2s ease';
            state.dynamicStylesDB[activeSel] = {};
            if (type === 'scale-down') state.dynamicStylesDB[activeSel].transform = 'scale(0.92)';
            else if (type === 'scale-up') state.dynamicStylesDB[activeSel].transform = 'scale(1.05)';
            else if (type === 'pulse-glow') {
                state.dynamicStylesDB[activeSel]['box-shadow'] = '0 0 15px var(--note-accent)';
                state.dynamicStylesDB[activeSel].transform = 'scale(0.98)';
            }
        } else {
            delete state.dynamicStylesDB[activeSel];
        }
    }

    saveStylesState();
    injectDynamicStyleSheet();

    const textGroup = $('devTextGroup');
    const textField = $('devElementText');
    if (textGroup instanceof HTMLElement && textGroup.style.display !== 'none' && textField instanceof HTMLInputElement) {
        const newText = textField.value;
        if (newText && newText.trim() !== '') state.dynamicContentDB[currentSelectorTarget] = newText;
        else delete state.dynamicContentDB[currentSelectorTarget];
        saveContentState();
        applyContentOverrides();
    }

    const btnSave = $('devBtnSave');
    if (btnSave instanceof HTMLElement) {
        const originalText = btnSave.innerText;
        btnSave.innerText = '✅ ¡Guardado Correctamente!';
        btnSave.classList.add('dev-btn-success');
        setTimeout(() => {
            btnSave.innerText = originalText;
            btnSave.classList.remove('dev-btn-success');
        }, 2000);
    }
}

function resetTargetStyles() {
    if (!currentSelectorTarget) return;
    delete state.dynamicStylesDB[currentSelectorTarget];
    delete state.dynamicStylesDB[`${currentSelectorTarget}:active`];
    delete state.dynamicContentDB[currentSelectorTarget];
    persistAll();
    injectDynamicStyleSheet();
    window.location.reload();
}

function factoryResetStyles() {
    if (!confirm('⚠️ ¿Borrar TODOS los colores, animaciones y textos personalizados?')) return;
    state.dynamicStylesDB = {};
    state.dynamicContentDB = {};
    localStorage.removeItem('dev_dynamic_styles');
    localStorage.removeItem('dev_dynamic_content');
    window.location.reload();
}

function bindHotkeys() {
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
    bindUxFeedback();
    bindShadowUiActions();
    bindColorSyncEvents();
    bindHotkeys();

    injectDynamicStyleSheet();
    applyContentOverrides();
    ensureTextObserver();
}

export const devModeBridge = createBridge();
