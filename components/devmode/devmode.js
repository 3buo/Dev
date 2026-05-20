import { ensureDevModeShadowRoot, getDevModeRoot } from './devmode-shadow.js';

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
const DEV_STYLES_V2_KEY = 'dev_dynamic_styles_v2';
const DEV_CONTENT_V2_KEY = 'dev_dynamic_content_v2';

let devRoot = null;
let isDevModeActive = false;
let isInspectorActive = false;
let isSelectionLocked = false;
let currentTargetElement = null;
let currentTargetDevId = null;
let activeInlineEditor = null;
let activeToolbar = null;
let hasGlobalBindings = false;

const state = {
  dynamicStylesById: {},
  dynamicContentById: {}
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

function persistState() {
  localStorage.setItem(DEV_STYLES_V2_KEY, JSON.stringify(state.dynamicStylesById));
  localStorage.setItem(DEV_CONTENT_V2_KEY, JSON.stringify(state.dynamicContentById));
}

function loadState() {
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
}

function generateDevId() {
  if (window.crypto?.randomUUID) return `dev-${window.crypto.randomUUID()}`;
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function ensureDevIdForElement(el) {
  if (!(el instanceof HTMLElement)) return null;
  if (devRoot?.contains(el)) return null;
  if (el.closest('#devmode-shadow-host')) return null;
  if (el.closest('#backupPanel')) return null;
  if (el.id === 'backupLauncher' || el.closest('#backupLauncher')) return null;
  if (!el.dataset.devId) el.dataset.devId = generateDevId();
  return el.dataset.devId;
}

function ensureDevIdsInDom() {
  document.querySelectorAll('body *').forEach((el) => {
    if (el instanceof HTMLElement) ensureDevIdForElement(el);
  });
}

function getNodeBucket(devId) {
  if (!state.dynamicStylesById[devId]) {
    state.dynamicStylesById[devId] = { styles: {}, active: {}, meta: {} };
  }
  return state.dynamicStylesById[devId];
}

function injectStyleSheet() {
  if (!devRoot) return;
  let styleTag = devRoot.getElementById('dev-dynamic-stylesheet');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dev-dynamic-stylesheet';
    devRoot.appendChild(styleTag);
  }

  let cssString = '/* DEVMODE ATOMIC */\n';
  for (const devId in state.dynamicStylesById) {
    const selector = `[data-dev-id="${escapeForCss(devId)}"]`;
    const styles = state.dynamicStylesById[devId]?.styles || {};
    const keys = Object.keys(styles);
    if (!keys.length) continue;
    cssString += `${selector} {\n`;
    keys.forEach((k) => {
      cssString += `  ${k}: ${styles[k]} !important;\n`;
    });
    cssString += '}\n';
  }

  styleTag.textContent = cssString;
}

function applyContentOverrides() {
  for (const devId in state.dynamicContentById) {
    const el = getElementByDevId(devId);
    if (!el) continue;
    const next = (state.dynamicContentById[devId] || '').trim();
    if (next && el.textContent !== next) {
      el.textContent = next;
    }
  }
}

function getOrCreateToast() {
  if (!devRoot) return null;
  let toast = devRoot.getElementById('dev-toast-el');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dev-toast-el';
    toast.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000003;background:#111c2c;border:1px solid #58a6ff;border-radius:999px;padding:8px 12px;color:#c9d1d9;font-weight:700;display:none;';
    devRoot.appendChild(toast);
  }
  return toast;
}

function showToast(message) {
  const toast = getOrCreateToast();
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 1000);
}

function updateSelectionLockButton() {
  const btn = $('devSelectionLockBtn');
  if (!(btn instanceof HTMLElement)) return;
  btn.textContent = isSelectionLocked ? '🔒 Selección bloqueada' : '🔓 Selección libre';
}

function openLiveEditOnElement(target) {
  if (!(target instanceof HTMLElement)) return;
  const devId = ensureDevIdForElement(target);
  if (!devId) return;

  if (activeInlineEditor && activeInlineEditor !== target) {
    activeInlineEditor.removeAttribute('contenteditable');
    activeInlineEditor.classList.remove('dev-inline-editing');
  }

  activeInlineEditor = target;
  currentTargetElement = target;
  currentTargetDevId = devId;

  target.classList.add('dev-inline-editing');
  target.setAttribute('contenteditable', 'true');
  target.focus();

  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  sel?.removeAllRanges();
  sel?.addRange(range);

  const saveLiveText = () => {
    if (!target.dataset.devId) return;
    state.dynamicContentById[target.dataset.devId] = (target.textContent || '').trim();
    persistState();
    const detected = $('devDetectedText');
    if (detected) detected.textContent = target.textContent || '(sin texto)';
  };

  const handleInput = () => {
    saveLiveText();
    showToast('✍️ Editando texto en vivo');
  };

  const handleBlur = () => {
    saveLiveText();
    target.removeAttribute('contenteditable');
    target.classList.remove('dev-inline-editing');
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      target.blur();
    }
  };

  target.oninput = handleInput;
  target.onblur = handleBlur;
  target.onkeydown = handleKeydown;

  showToast('✍️ Modo edición activado');
}

function handleDevClick(e) {
  if (!isInspectorActive || isSelectionLocked) return;
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (devRoot?.contains(target)) return;
  if (target.closest('#devmode-shadow-host')) return;
  if (target.closest('#backupPanel')) return;
  if (target.id === 'backupLauncher' || target.closest('#backupLauncher')) return;

  e.preventDefault();
  e.stopPropagation();

  const devId = ensureDevIdForElement(target);
  if (!devId) return;

  if (currentTargetElement) {
    currentTargetElement.classList.remove('dev-selected-target');
  }

  currentTargetElement = target;
  currentTargetDevId = devId;
  target.classList.add('dev-selected-target');

  const idEl = $('devDetectedId');
  const nameEl = $('devDetectedName');
  const textEl = $('devDetectedText');

  if (idEl) idEl.textContent = devId;
  if (nameEl) nameEl.textContent = target.tagName.toLowerCase();
  if (textEl) textEl.textContent = (target.textContent || '').trim() || '(sin texto)';

  showToast('🎯 Elemento seleccionado');
}

function activateInspector() {
  if (isInspectorActive) return;
  isInspectorActive = true;
  document.addEventListener('click', handleDevClick, { capture: true });
}

function deactivateInspector() {
  isInspectorActive = false;
  document.removeEventListener('click', handleDevClick, { capture: true });
}

function closeDevPanel() {
  deactivateInspector();
  isDevModeActive = false;
  window.__devModeIsAuthenticated = false;
  if (activeToolbar) activeToolbar.style.display = 'none';
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

  if (activeToolbar) activeToolbar.style.display = 'flex';
  activateInspector();
  showToast('✅ DevMode activo');
}

function bindToolbarActions(toolbar) {
  const quickEdit = toolbar.querySelector('#devQuickEditTextBtn');
  const lockBtn = toolbar.querySelector('#devSelectionLockBtn');

  if (quickEdit instanceof HTMLElement) {
    quickEdit.onclick = null;
    quickEdit.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!currentTargetElement) {
        showToast('Selecciona un texto primero');
        return;
      }
      openLiveEditOnElement(currentTargetElement);
    }, { capture: true });
  }

  if (lockBtn instanceof HTMLElement) {
    lockBtn.onclick = null;
    lockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      isSelectionLocked = !isSelectionLocked;
      updateSelectionLockButton();
      showToast(isSelectionLocked ? '🔒 Selección bloqueada' : '🔓 Selección libre');
    }, { capture: true });
  }

  toolbar.addEventListener('click', (e) => {
    e.stopPropagation();
  }, { capture: true });
}

function getOrCreateFloatingToolbar() {
  if (!devRoot) return null;
  if (activeToolbar) return activeToolbar;

  const toolbar = document.createElement('div');
  toolbar.id = 'devFloatingToolbar';
  toolbar.className = 'dev-floating-toolbar';
  toolbar.innerHTML = `
    <div class="dev-toolbar-header" id="devToolbarDragHandle">
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="dev-toolbar-grip">⋮⋮</span>
        <span class="dev-toolbar-title">Context Palette</span>
      </div>
    </div>
    <div style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);display:grid;gap:4px;background:rgba(255,255,255,0.02);">
      <div style="font-size:10px;color:#8b949e;text-transform:uppercase;font-weight:800;letter-spacing:.4px;">Elemento detectado</div>
      <div style="font-size:11px;color:#9ecbff;"><strong>ID:</strong> <span id="devDetectedId">N/A</span></div>
      <div style="font-size:11px;color:#c9d1d9;"><strong>Nombre:</strong> <span id="devDetectedName">N/A</span></div>
      <div style="font-size:11px;color:#8ba4b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong>Texto:</strong> <span id="devDetectedText">Ninguno</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;">
        <button id="devQuickEditTextBtn" class="dev-pill" style="font-size:10px;padding:5px 10px;">✍️ Editar texto</button>
        <button id="devSelectionLockBtn" class="dev-pill" style="font-size:10px;padding:5px 10px;">🔓 Selección libre</button>
      </div>
    </div>
  `;
  devRoot.appendChild(toolbar);
  activeToolbar = toolbar;
  bindToolbarActions(toolbar);
  updateSelectionLockButton();
  return toolbar;
}

function bindShadowUiActions() {
  const loginSubmit = $('devLoginSubmit');
  const loginCancel = $('devLoginCancel');
  const panelClose = $('devPanelClose');

  loginSubmit?.addEventListener('click', (e) => {
    e.preventDefault();
    authenticateDev();
  });

  loginCancel?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = $('devLoginModal');
    if (modal instanceof HTMLElement) modal.style.display = 'none';
  });

  panelClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDevPanel();
  });
}

function bindGlobalInteractions() {
  if (hasGlobalBindings) return;
  hasGlobalBindings = true;

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
      e.preventDefault();
      const modal = $('devLoginModal');
      if (!isDevModeActive) {
        if (modal instanceof HTMLElement) modal.style.display = 'flex';
      } else {
        closeDevPanel();
      }
    }

    if (e.key === 'Escape') {
      if (activeInlineEditor) {
        activeInlineEditor.blur();
      }
      if (isDevModeActive) {
        closeDevPanel();
      }
    }
  });
}

export function initDevMode() {
  loadState();

  const { root } = ensureDevModeShadowRoot();
  devRoot = root || getDevModeRoot();
  if (!devRoot) return;

  window.__devModeIsAuthenticated = false;
  ensureDevIdsInDom();
  injectStyleSheet();
  applyContentOverrides();

  getOrCreateFloatingToolbar();
  if (activeToolbar) activeToolbar.style.display = 'none';

  bindShadowUiActions();
  bindGlobalInteractions();

  const observer = new MutationObserver(() => {
    ensureDevIdsInDom();
    applyContentOverrides();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export const devModeBridge = {
  init: initDevMode,
  open: () => {
    const modal = $('devLoginModal');
    if (modal instanceof HTMLElement) modal.style.display = 'flex';
  },
  close: closeDevPanel,
  toggleInspector: () => {
    if (isInspectorActive) deactivateInspector();
    else activateInspector();
  },
  isAuthenticated: () => Boolean(window.__devModeIsAuthenticated)
};
