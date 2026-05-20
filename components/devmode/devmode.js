import { ensureDevModeShadowRoot } from './devmode-shadow.js';
import {
  injectDevNoCodeCss,
  bindGlobalButtonSounds,
  bindInspectorHotkeys,
  ensureDevSoundPanel
} from './devmode-sounds-ui.js';

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
const KEY_STYLES = 'dev_dynamic_styles_v2';
const KEY_CONTENT = 'dev_dynamic_content_v2';
const KEY_PANEL_POS = 'dev_panel_position_v2';

let shadowRootRef = null;
let isDevModeActive = false;
let isInspectorActive = false;
let isSelectionLocked = false;
let currentTargetElement = null;
let currentTargetDevId = null;
let activeInlineEditor = null;
let mutationObserver = null;
let globalBindingsReady = false;

const state = {
  dynamicStylesById: {},
  dynamicContentById: {}
};

function rootEl(id) {
  if (!shadowRootRef) return null;
  return shadowRootRef.getElementById(id);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function ensureDevId(el) {
  if (!(el instanceof HTMLElement)) return null;
  if (shadowRootRef?.contains(el)) return null;
  if (el.closest('#devmode-shadow-host')) return null;
  if (el.closest('#backupPanel')) return null;
  if (el.id === 'backupLauncher' || el.closest('#backupLauncher')) return null;
  if (!el.dataset.devId) el.dataset.devId = `dev-${crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  return el.dataset.devId;
}

function getElementByDevId(devId) {
  return document.querySelector(`[data-dev-id="${cssEscape(devId)}"]`);
}

function loadState() {
  try {
    state.dynamicStylesById = JSON.parse(localStorage.getItem(KEY_STYLES) || '{}');
  } catch {
    state.dynamicStylesById = {};
    localStorage.removeItem(KEY_STYLES);
  }

  try {
    state.dynamicContentById = JSON.parse(localStorage.getItem(KEY_CONTENT) || '{}');
  } catch {
    state.dynamicContentById = {};
    localStorage.removeItem(KEY_CONTENT);
  }
}

function saveState() {
  localStorage.setItem(KEY_STYLES, JSON.stringify(state.dynamicStylesById));
  localStorage.setItem(KEY_CONTENT, JSON.stringify(state.dynamicContentById));
}

function getNodeStyleBucket(devId) {
  if (!state.dynamicStylesById[devId]) {
    state.dynamicStylesById[devId] = { styles: {} };
  }
  return state.dynamicStylesById[devId];
}

function injectDynamicStyleSheet() {
  if (!shadowRootRef) return;
  let styleTag = shadowRootRef.getElementById('dev-dynamic-stylesheet');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dev-dynamic-stylesheet';
    shadowRootRef.appendChild(styleTag);
  }

  let cssText = '/* DEV MODE V2 - SHADOW SCOPED GENERATOR */\n';
  for (const devId in state.dynamicStylesById) {
    const selector = `[data-dev-id="${cssEscape(devId)}"]`;
    const styles = state.dynamicStylesById[devId]?.styles || {};
    const keys = Object.keys(styles);
    if (!keys.length) continue;
    cssText += `${selector}{\n`;
    keys.forEach((key) => {
      cssText += `  ${key}: ${styles[key]} !important;\n`;
    });
    cssText += '}\n';
  }
  styleTag.textContent = cssText;
}

function applyContentOverrides() {
  for (const devId in state.dynamicContentById) {
    const el = getElementByDevId(devId);
    if (!el) continue;
    const next = (state.dynamicContentById[devId] || '').trim();
    if (next && el.textContent !== next) el.textContent = next;
  }
}

function applyAllPersisted() {
  injectDynamicStyleSheet();
  applyContentOverrides();
}

function syncFieldsFromSelectedElement() {
  const targetBadge = rootEl('devTargetSelector');
  const textGroup = rootEl('devTextGroup');
  const textInput = rootEl('devElementText');
  const bgColor = rootEl('devBgColor');
  const bgText = rootEl('devBgText');
  const txtColor = rootEl('devTextColor');
  const txtText = rootEl('devTextText');
  const borderColor = rootEl('devBorderColor');
  const borderText = rootEl('devBorderText');
  const borderBottom = rootEl('devBorderBottom');
  const borderRadius = rootEl('devBorderRadius');
  const padding = rootEl('devPadding');
  const fontSize = rootEl('devFontSize');

  if (!(targetBadge instanceof HTMLElement)) return;

  if (!currentTargetElement || !currentTargetDevId) {
    targetBadge.textContent = 'Ninguno';
    if (textGroup instanceof HTMLElement) textGroup.style.display = 'none';
    return;
  }

  targetBadge.textContent = `[data-dev-id="${currentTargetDevId}"]`;
  if (textGroup instanceof HTMLElement) textGroup.style.display = 'flex';

  const computed = getComputedStyle(currentTargetElement);
  const nodeStyles = state.dynamicStylesById[currentTargetDevId]?.styles || {};

  if (textInput instanceof HTMLInputElement) {
    textInput.value = state.dynamicContentById[currentTargetDevId] || currentTargetElement.textContent?.trim() || '';
  }
  if (bgColor instanceof HTMLInputElement) bgColor.value = normalizeHex(nodeStyles.background || computed.backgroundColor);
  if (bgText instanceof HTMLInputElement) bgText.value = nodeStyles.background || computed.backgroundColor || '';
  if (txtColor instanceof HTMLInputElement) txtColor.value = normalizeHex(nodeStyles.color || computed.color);
  if (txtText instanceof HTMLInputElement) txtText.value = nodeStyles.color || computed.color || '';
  if (borderColor instanceof HTMLInputElement) borderColor.value = normalizeHex(nodeStyles.borderColor || computed.borderColor);
  if (borderText instanceof HTMLInputElement) borderText.value = nodeStyles.borderColor || computed.borderColor || '';
  if (borderBottom instanceof HTMLInputElement) borderBottom.value = nodeStyles.borderBottom || computed.borderBottom || '';
  if (borderRadius instanceof HTMLInputElement) borderRadius.value = nodeStyles.borderRadius || computed.borderRadius || '';
  if (padding instanceof HTMLInputElement) padding.value = nodeStyles.padding || computed.padding || '';
  if (fontSize instanceof HTMLInputElement) fontSize.value = nodeStyles.fontSize || computed.fontSize || '';
}

function normalizeHex(color) {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = color;
  const normalized = ctx.fillStyle;
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  return '#000000';
}

function showToast(message) {
  if (!shadowRootRef) return;
  let toast = shadowRootRef.getElementById('dev-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dev-toast';
    toast.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000004;background:#0d1b2b;border:1px solid #58a6ff;color:#d8ebff;padding:8px 12px;border-radius:999px;font-weight:700;';
    shadowRootRef.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 1200);
}

function onSelectTarget(el) {
  if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
  currentTargetElement = el;
  currentTargetDevId = ensureDevId(el);
  currentTargetElement?.classList.add('dev-selected-target');
  syncFieldsFromSelectedElement();
}

function isIgnoredTarget(el) {
  if (!(el instanceof HTMLElement)) return true;
  if (shadowRootRef?.contains(el)) return true;
  if (el.closest('#devmode-shadow-host')) return true;
  if (el.closest('#backupPanel')) return true;
  if (el.id === 'backupLauncher' || el.closest('#backupLauncher')) return true;
  return false;
}

function handleInspectorClick(e) {
  if (!isDevModeActive || !isInspectorActive || isSelectionLocked) return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (isIgnoredTarget(target)) return;
  e.preventDefault();
  e.stopPropagation();
  onSelectTarget(target);
}

function closeInlineEdit() {
  if (!activeInlineEditor) return;
  activeInlineEditor.removeAttribute('contenteditable');
  activeInlineEditor.classList.remove('dev-inline-editing');
  activeInlineEditor.oninput = null;
  activeInlineEditor.onblur = null;
  activeInlineEditor.onkeydown = null;
  activeInlineEditor = null;
}

function openInlineEdit() {
  if (!currentTargetElement || !currentTargetDevId) {
    showToast('Selecciona un elemento primero');
    return;
  }

  closeInlineEdit();
  activeInlineEditor = currentTargetElement;
  activeInlineEditor.classList.add('dev-inline-editing');
  activeInlineEditor.setAttribute('contenteditable', 'true');
  activeInlineEditor.focus();

  const saveLive = () => {
    if (!currentTargetDevId || !activeInlineEditor) return;
    state.dynamicContentById[currentTargetDevId] = activeInlineEditor.textContent?.trim() || '';
    saveState();
    syncFieldsFromSelectedElement();
  };

  activeInlineEditor.oninput = () => {
    saveLive();
    showToast('✍️ Edición en vivo');
  };

  activeInlineEditor.onblur = () => {
    saveLive();
    closeInlineEdit();
  };

  activeInlineEditor.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      activeInlineEditor?.blur();
    }
  };

  showToast('✍️ Modo edición activado');
}

function applyAndSaveDevStyles() {
  if (!currentTargetElement || !currentTargetDevId) {
    showToast('Selecciona un elemento primero');
    return;
  }

  const bucket = getNodeStyleBucket(currentTargetDevId);
  const styles = bucket.styles;

  const bgText = rootEl('devBgText');
  const txtText = rootEl('devTextText');
  const borderText = rootEl('devBorderText');
  const borderBottom = rootEl('devBorderBottom');
  const borderRadius = rootEl('devBorderRadius');
  const padding = rootEl('devPadding');
  const fontSize = rootEl('devFontSize');
  const textInput = rootEl('devElementText');

  if (bgText instanceof HTMLInputElement && bgText.value.trim()) styles.background = bgText.value.trim();
  if (txtText instanceof HTMLInputElement && txtText.value.trim()) styles.color = txtText.value.trim();
  if (borderText instanceof HTMLInputElement && borderText.value.trim()) styles.borderColor = borderText.value.trim();
  if (borderBottom instanceof HTMLInputElement && borderBottom.value.trim()) styles.borderBottom = borderBottom.value.trim();
  if (borderRadius instanceof HTMLInputElement && borderRadius.value.trim()) styles.borderRadius = borderRadius.value.trim();
  if (padding instanceof HTMLInputElement && padding.value.trim()) styles.padding = padding.value.trim();
  if (fontSize instanceof HTMLInputElement && fontSize.value.trim()) styles.fontSize = fontSize.value.trim();

  if (textInput instanceof HTMLInputElement) {
    state.dynamicContentById[currentTargetDevId] = textInput.value;
  }

  saveState();
  applyAllPersisted();
  syncFieldsFromSelectedElement();
  showToast('✅ Cambios guardados');
}

function resetTargetStyles() {
  if (!currentTargetDevId) {
    showToast('Selecciona un elemento primero');
    return;
  }

  delete state.dynamicStylesById[currentTargetDevId];
  delete state.dynamicContentById[currentTargetDevId];
  saveState();
  applyAllPersisted();
  syncFieldsFromSelectedElement();
  showToast('🔄 Elemento revertido');
}

function factoryResetStyles() {
  if (!confirm('⚠️ ¿Borrar TODOS los estilos y textos personalizados?')) return;
  state.dynamicStylesById = {};
  state.dynamicContentById = {};
  localStorage.removeItem(KEY_STYLES);
  localStorage.removeItem(KEY_CONTENT);
  applyAllPersisted();
  showToast('🧹 Reset completo');
}

function toggleInspectorMode() {
  isInspectorActive = !isInspectorActive;
  const btn = rootEl('btnInspectorToggle');
  if (btn instanceof HTMLButtonElement) {
    btn.textContent = `Inspeccionar: ${isInspectorActive ? 'ON' : 'OFF'}`;
  }
  showToast(isInspectorActive ? '🕵️ Inspector activo' : '🧭 Inspector inactivo');
}

function closeDevPanel() {
  isDevModeActive = false;
  isInspectorActive = false;
  closeInlineEdit();
  window.__devModeIsAuthenticated = false;

  const panel = rootEl('devEditorPanel');
  if (panel instanceof HTMLElement) panel.style.display = 'none';

  if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
  currentTargetElement = null;
  currentTargetDevId = null;
}

function authenticateDev() {
  const user = rootEl('devUser');
  const pass = rootEl('devPass');
  if (!(user instanceof HTMLInputElement) || !(pass instanceof HTMLInputElement)) return;

  if (user.value !== DEV_CREDS.user || pass.value !== DEV_CREDS.pass) {
    showToast('❌ Credenciales inválidas');
    return;
  }

  window.__devModeIsAuthenticated = true;
  isDevModeActive = true;
  isInspectorActive = true;

  const modal = rootEl('devLoginModal');
  const panel = rootEl('devEditorPanel');
  if (modal instanceof HTMLElement) modal.style.display = 'none';
  if (panel instanceof HTMLElement) panel.style.display = 'flex';

  const btn = rootEl('btnInspectorToggle');
  if (btn instanceof HTMLButtonElement) btn.textContent = 'Inspeccionar: ON';

  showToast('✅ DevMode autenticado');
}

function closeDevLogin() {
  const modal = rootEl('devLoginModal');
  if (modal instanceof HTMLElement) modal.style.display = 'none';
}

function openDevLogin() {
  const modal = rootEl('devLoginModal');
  if (modal instanceof HTMLElement) modal.style.display = 'flex';
}

function setupDragPanel() {
  const panel = rootEl('devEditorPanel');
  const header = panel?.querySelector('.dev-panel-header');
  if (!(panel instanceof HTMLElement) || !(header instanceof HTMLElement)) return;

  let isDragging = false;
  let originX = 0;
  let originY = 0;
  let startLeft = 0;
  let startTop = 0;

  const saved = localStorage.getItem(KEY_PANEL_POS);
  if (saved) {
    try {
      const p = JSON.parse(saved);
      if (typeof p.left === 'number' && typeof p.top === 'number') {
        panel.style.right = 'auto';
        panel.style.left = `${p.left}px`;
        panel.style.top = `${p.top}px`;
      }
    } catch {}
  }

  const move = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    const nextLeft = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, startLeft + dx));
    const nextTop = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, startTop + dy));
    panel.style.right = 'auto';
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  };

  const up = () => {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);

    const left = parseFloat(panel.style.left || '0');
    const top = parseFloat(panel.style.top || '0');
    localStorage.setItem(KEY_PANEL_POS, JSON.stringify({ left, top }));
  };

  header.addEventListener('mousedown', (e) => {
    if ((e.target instanceof HTMLElement) && e.target.tagName === 'BUTTON') return;
    isDragging = true;
    originX = e.clientX;
    originY = e.clientY;
    startLeft = panel.getBoundingClientRect().left;
    startTop = panel.getBoundingClientRect().top;
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
}

function bindUIActions() {
  const loginSubmit = rootEl('devLoginSubmit');
  const loginCancel = rootEl('devLoginCancel');
  const panelClose = rootEl('devPanelClose');
  const inspector = rootEl('btnInspectorToggle');
  const saveBtn = rootEl('devBtnSave');
  const resetBtn = rootEl('devBtnResetTarget');
  const factoryBtn = rootEl('devBtnFactoryReset');
  const textInput = rootEl('devElementText');

  loginSubmit?.addEventListener('click', (e) => {
    e.preventDefault();
    authenticateDev();
  });

  loginCancel?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDevLogin();
  });

  panelClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDevPanel();
  });

  inspector?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleInspectorMode();
  });

  saveBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    applyAndSaveDevStyles();
  });

  resetBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    resetTargetStyles();
  });

  factoryBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    factoryResetStyles();
  });

  textInput?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    openInlineEdit();
  });

  const colorPairs = [
    ['devBgColor', 'devBgText'],
    ['devTextColor', 'devTextText'],
    ['devBorderColor', 'devBorderText']
  ];

  colorPairs.forEach(([pickerId, textId]) => {
    const picker = rootEl(pickerId);
    const text = rootEl(textId);
    if (!(picker instanceof HTMLInputElement) || !(text instanceof HTMLInputElement)) return;

    picker.addEventListener('input', () => {
      text.value = picker.value;
    });

    text.addEventListener('input', () => {
      if (/^#([0-9a-f]{6})$/i.test(text.value.trim())) {
        picker.value = text.value.trim();
      }
    });
  });
}

function ensureAllDevIds() {
  document.querySelectorAll('body *').forEach((el) => {
    if (el instanceof HTMLElement) ensureDevId(el);
  });
}

function bindGlobalEvents() {
  if (globalBindingsReady) return;
  globalBindingsReady = true;

  document.addEventListener('click', handleInspectorClick, { capture: true });

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
      e.preventDefault();
      if (!isDevModeActive) {
        openDevLogin();
      } else {
        closeDevPanel();
      }
    }

    if (e.key === 'Escape') {
      if (activeInlineEditor) activeInlineEditor.blur();
      if (isDevModeActive) closeDevPanel();
    }
  });
}

function startMutationObserver() {
  if (mutationObserver) mutationObserver.disconnect();
  mutationObserver = new MutationObserver(() => {
    ensureAllDevIds();
    applyContentOverrides();
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

export function initDevMode() {
  loadState();
  const { root } = ensureDevModeShadowRoot();
  shadowRootRef = root;

  window.__devModeIsAuthenticated = false;

  try {
    injectDevNoCodeCss();
    bindGlobalButtonSounds();
    bindInspectorHotkeys();
    ensureDevSoundPanel();
  } catch {}

  ensureAllDevIds();
  applyAllPersisted();

  bindUIActions();
  setupDragPanel();
  bindGlobalEvents();
  startMutationObserver();

  const panel = rootEl('devEditorPanel');
  if (panel instanceof HTMLElement) panel.style.display = 'none';
}

export const devModeBridge = {
  init: initDevMode,
  open: openDevLogin,
  close: closeDevPanel,
  toggleInspector: toggleInspectorMode,
  isAuthenticated: () => Boolean(window.__devModeIsAuthenticated)
};
