import { ensureDevModeShadowRoot, getDevModeRoot } from './devmode-shadow.js';

const DEV_CREDS = { user: 'admin_neo', pass: 'dev_77Xq' };
const DEV_STYLES_V2_KEY = 'dev_dynamic_styles_v2';
const DEV_CONTENT_V2_KEY = 'dev_dynamic_content_v2';
const DEV_STYLES_LEGACY_KEY = 'dev_dynamic_styles';
const DEV_CONTENT_LEGACY_KEY = 'dev_dynamic_content';

let isDevModeActive = false;
let isInspectorActive = false;
let currentTargetElement = null;
let currentTargetDevId = null;
let isOverridingText = false;

let devRoot = null;
let textObserver = null;
let idObserver = null;
let activeInlineEditor = null;
let activeToolbar = null;
let hasGlobalBindings = false;

const state = {
  dynamicStylesById: {},
  dynamicContentById: {},
  legacyStyles: {},
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

function getNodeBucket(devId) {
  if (!state.dynamicStylesById[devId]) {
    state.dynamicStylesById[devId] = { styles: {}, active: {}, meta: {} };
  }
  if (!state.dynamicStylesById[devId].meta) {
    state.dynamicStylesById[devId].meta = {};
  }
  return state.dynamicStylesById[devId];
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
      z-index: 10000003;
      opacity: 0;
      pointer-events: none;
      transition: opacity 160ms ease, transform 160ms ease;
    }
    .dev-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(-6px);
    }

    .dev-floating-toolbar {
      position: fixed;
      z-index: 10000002;
      width: 340px;
      display: none;
      flex-direction: column;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(20,24,34,0.95), rgba(10,13,20,0.95));
      border: 1px solid rgba(102, 153, 255, 0.35);
      box-shadow: 0 18px 48px rgba(0,0,0,0.55), 0 0 1px rgba(255,255,255,0.1) inset;
      backdrop-filter: blur(12px);
      overflow: hidden;
      user-select: none;
    }
    .dev-toolbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 10px 12px;
      cursor: grab;
    }
    .dev-toolbar-header:active { cursor: grabbing; }
    .dev-toolbar-title {
      color: #c9d1d9;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .dev-toolbar-grip {
      color: #8b949e;
      font-size: 14px;
      letter-spacing: 1px;
    }
    .dev-toolbar-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .dev-tab-btn {
      border: none;
      background: transparent;
      color: #8b949e;
      font-size: 11px;
      font-weight: 700;
      padding: 10px 6px;
      cursor: pointer;
      transition: all 140ms ease;
    }
    .dev-tab-btn:hover {
      color: #c9d1d9;
      background: rgba(255,255,255,0.04);
    }
    .dev-tab-btn.active {
      color: #9ecbff;
      background: rgba(88,166,255,0.12);
      box-shadow: inset 0 -2px 0 rgba(88,166,255,0.65);
    }
    .dev-toolbar-body {
      padding: 10px;
      display: grid;
      gap: 10px;
      max-height: 340px;
      overflow: auto;
    }
    .dev-tab-panel { display: none; gap: 10px; }
    .dev-tab-panel.active { display: grid; }
    .dev-row { display: grid; gap: 6px; }
    .dev-row label {
      font-size: 11px;
      color: #8b949e;
      font-weight: 700;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }
    .dev-inline-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .dev-input, .dev-select, .dev-btn {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid #30363d;
      background: rgba(1,4,9,0.75);
      color: #c9d1d9;
      padding: 8px;
      font-size: 12px;
      outline: none;
    }
    .dev-input:focus, .dev-select:focus {
      border-color: #58a6ff;
      box-shadow: 0 0 0 2px rgba(88,166,255,0.18);
    }
    .dev-pill-group { display: flex; gap: 6px; flex-wrap: wrap; }
    .dev-pill {
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.03);
      color: #c9d1d9;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 10px;
      cursor: pointer;
    }
    .dev-pill.active {
      border-color: rgba(88,166,255,0.65);
      color: #9ecbff;
      background: rgba(88,166,255,0.12);
    }
    .dev-link-sides {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #8b949e;
      font-size: 11px;
      font-weight: 700;
    }
    .dev-data-btn {
      border-color: rgba(183,148,246,0.65);
      color: #c4b5fd;
      background: rgba(89,60,140,0.18);
      cursor: pointer;
    }
    .dev-close-btn {
      border: 1px solid rgba(255,255,255,0.2);
      background: transparent;
      color: #8b949e;
      border-radius: 7px;
      width: 24px;
      height: 24px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      font-size: 14px;
    }
    .dev-close-btn:hover {
      color: #c9d1d9;
      border-color: rgba(255,255,255,0.4);
    }
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
    devRoot.appendChild(toast);
  }
  return toast;
}

function showToast(message) {
  const toast = getOrCreateToast();
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 950);
}

const actions = {
  setProp(id, updater) {
    const draft = { text: state.dynamicContentById[id] || '' };
    updater(draft);
    state.dynamicContentById[id] = (draft.text || '').trim();
    persistV2State();
    applyContentOverrides();
  }
};

function setStyleForCurrentNode(property, value) {
  if (!currentTargetDevId) return;
  const bucket = getNodeBucket(currentTargetDevId);
  if (!value || !String(value).trim()) delete bucket.styles[property];
  else bucket.styles[property] = String(value).trim();
  persistV2State();
  injectDynamicStyleSheet();
}

function setMetaForCurrentNode(key, value) {
  if (!currentTargetDevId) return;
  const bucket = getNodeBucket(currentTargetDevId);
  bucket.meta[key] = value;
  persistV2State();
}

function bindToolbarTabs(toolbar) {
  const tabBtns = toolbar.querySelectorAll('.dev-tab-btn');
  const panels = toolbar.querySelectorAll('.dev-tab-panel');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      panels.forEach((panel) => {
        panel.classList.toggle('active', panel.getAttribute('data-panel') === tab);
      });
    });
  });
}

function bindToolbarDragging(toolbar) {
  const handle = toolbar.querySelector('#devToolbarDragHandle');
  if (!(handle instanceof HTMLElement)) return;
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const move = (clientX, clientY) => {
    const maxX = Math.max(8, window.innerWidth - toolbar.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - toolbar.offsetHeight - 8);
    const left = Math.max(8, Math.min(maxX, clientX - offsetX));
    const top = Math.max(8, Math.min(maxY, clientY - offsetY));
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
  };

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    const rect = toolbar.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    move(e.clientX, e.clientY);
  });

  const endDrag = (e) => {
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch {}
  };

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

function setActivePill(groupEl, key, value) {
  if (!(groupEl instanceof HTMLElement)) return;
  groupEl.querySelectorAll('.dev-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.getAttribute(key) === value);
  });
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function bindToolbarActions(toolbar) {
  const typoSizeInput = toolbar.querySelector('#devTypoSizeInput');
  const typoSizeRange = toolbar.querySelector('#devTypoSizeRange');
  const typoColor = toolbar.querySelector('#devTypoColor');
  const weightGroup = toolbar.querySelector('#devTypoWeightGroup');
  const alignGroup = toolbar.querySelector('#devTypoAlignGroup');
  const shadowGroup = toolbar.querySelector('#devShadowPresetGroup');
  const bgColor = toolbar.querySelector('#devBgColorPicker');
  const bgOpacity = toolbar.querySelector('#devBgOpacityRange');
  const radiusInput = toolbar.querySelector('#devRadiusInput');
  const paddingLinked = toolbar.querySelector('#devPaddingLinked');
  const marginLinked = toolbar.querySelector('#devMarginLinked');
  const paddingTop = toolbar.querySelector('#devPaddingTop');
  const paddingRight = toolbar.querySelector('#devPaddingRight');
  const paddingBottom = toolbar.querySelector('#devPaddingBottom');
  const paddingLeft = toolbar.querySelector('#devPaddingLeft');
  const marginTop = toolbar.querySelector('#devMarginTop');
  const marginRight = toolbar.querySelector('#devMarginRight');
  const marginBottom = toolbar.querySelector('#devMarginBottom');
  const marginLeft = toolbar.querySelector('#devMarginLeft');
  const bindDataBtn = toolbar.querySelector('#devBindDataBtn');
  const entryAnimation = toolbar.querySelector('#devEntryAnimation');

  const applyFontSize = (val) => {
    if (!val) return;
    const formatted = /\d$/.test(val) ? `${val}px` : val;
    setStyleForCurrentNode('font-size', formatted);
  };

  typoSizeInput?.addEventListener('input', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    applyFontSize(e.target.value);
    if (typoSizeRange instanceof HTMLInputElement) {
      const px = parseInt(e.target.value, 10);
      if (!Number.isNaN(px)) typoSizeRange.value = String(px);
    }
  });

  typoSizeRange?.addEventListener('input', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    const px = `${e.target.value}px`;
    if (typoSizeInput instanceof HTMLInputElement) typoSizeInput.value = px;
    applyFontSize(px);
  });

  typoColor?.addEventListener('input', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    setStyleForCurrentNode('color', e.target.value);
  });

  weightGroup?.querySelectorAll('.dev-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const weight = pill.getAttribute('data-weight') || '400';
      setStyleForCurrentNode('font-weight', weight);
      setActivePill(weightGroup, 'data-weight', weight);
    });
  });

  alignGroup?.querySelectorAll('.dev-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const align = pill.getAttribute('data-align') || 'left';
      setStyleForCurrentNode('text-align', align);
      setActivePill(alignGroup, 'data-align', align);
    });
  });

  const updateBackground = () => {
    const hex = bgColor instanceof HTMLInputElement ? bgColor.value : '#000000';
    const alphaRaw = bgOpacity instanceof HTMLInputElement ? Number(bgOpacity.value) : 100;
    const alpha = Math.max(0, Math.min(100, alphaRaw)) / 100;
    setStyleForCurrentNode('background-color', hexToRgba(hex, alpha));
  };

  bgColor?.addEventListener('input', updateBackground);
  bgOpacity?.addEventListener('input', updateBackground);

  radiusInput?.addEventListener('input', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    setStyleForCurrentNode('border-radius', e.target.value);
  });

  shadowGroup?.querySelectorAll('.dev-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const shadow = pill.getAttribute('data-shadow') || '';
      setStyleForCurrentNode('box-shadow', shadow);
      setActivePill(shadowGroup, 'data-shadow', shadow);
    });
  });

  const readInput = (el, fallback = '0px') => {
    if (!(el instanceof HTMLInputElement)) return fallback;
    return el.value?.trim() || fallback;
  };

  const applyPadding = () => {
    if (!(paddingLinked instanceof HTMLInputElement)) return;
    if (paddingLinked.checked) {
      const v = readInput(paddingTop);
      if (paddingRight instanceof HTMLInputElement) paddingRight.value = v;
      if (paddingBottom instanceof HTMLInputElement) paddingBottom.value = v;
      if (paddingLeft instanceof HTMLInputElement) paddingLeft.value = v;
      setStyleForCurrentNode('padding', v);
    } else {
      setStyleForCurrentNode('padding', `${readInput(paddingTop)} ${readInput(paddingRight)} ${readInput(paddingBottom)} ${readInput(paddingLeft)}`);
    }
  };

  const applyMargin = () => {
    if (!(marginLinked instanceof HTMLInputElement)) return;
    if (marginLinked.checked) {
      const v = readInput(marginTop);
      if (marginRight instanceof HTMLInputElement) marginRight.value = v;
      if (marginBottom instanceof HTMLInputElement) marginBottom.value = v;
      if (marginLeft instanceof HTMLInputElement) marginLeft.value = v;
      setStyleForCurrentNode('margin', v);
    } else {
      setStyleForCurrentNode('margin', `${readInput(marginTop)} ${readInput(marginRight)} ${readInput(marginBottom)} ${readInput(marginLeft)}`);
    }
  };

  [paddingTop, paddingRight, paddingBottom, paddingLeft].forEach((input) => input?.addEventListener('input', applyPadding));
  [marginTop, marginRight, marginBottom, marginLeft].forEach((input) => input?.addEventListener('input', applyMargin));
  paddingLinked?.addEventListener('change', applyPadding);
  marginLinked?.addEventListener('change', applyMargin);

  bindDataBtn?.addEventListener('click', () => {
    if (!currentTargetDevId) return;
    setMetaForCurrentNode('dataBinding', `localdb:${currentTargetDevId}`);
    showToast('🔗 Vinculación preparada en DB local');
  });

  entryAnimation?.addEventListener('change', (e) => {
    if (!(e.target instanceof HTMLSelectElement)) return;
    setMetaForCurrentNode('entryAnimation', e.target.value);
    showToast(`✨ Animación: ${e.target.value || 'none'}`);
  });
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
      <button class="dev-close-btn" id="devToolbarCloseBtn">✕</button>
    </div>
    <div class="dev-toolbar-tabs">
      <button class="dev-tab-btn active" data-tab="typo">Tipografía</button>
      <button class="dev-tab-btn" data-tab="appearance">Apariencia</button>
      <button class="dev-tab-btn" data-tab="layout">Layout</button>
      <button class="dev-tab-btn" data-tab="data">Data</button>
    </div>
    <div class="dev-toolbar-body">
      <section class="dev-tab-panel active" data-panel="typo">
        <div class="dev-row">
          <label>Tamaño</label>
          <div class="dev-inline-row">
            <input class="dev-input" id="devTypoSizeInput" type="text" placeholder="16px" />
            <input class="dev-input" id="devTypoSizeRange" type="range" min="10" max="96" value="16" />
          </div>
        </div>
        <div class="dev-row">
          <label>Peso</label>
          <div class="dev-pill-group" id="devTypoWeightGroup">
            <button class="dev-pill" data-weight="400">Regular</button>
            <button class="dev-pill" data-weight="700">Bold</button>
          </div>
        </div>
        <div class="dev-row">
          <label>Color de texto</label>
          <input class="dev-input" id="devTypoColor" type="color" value="#ffffff" />
        </div>
        <div class="dev-row">
          <label>Alineación</label>
          <div class="dev-pill-group" id="devTypoAlignGroup">
            <button class="dev-pill" data-align="left">Left</button>
            <button class="dev-pill" data-align="center">Center</button>
            <button class="dev-pill" data-align="right">Right</button>
          </div>
        </div>
      </section>

      <section class="dev-tab-panel" data-panel="appearance">
        <div class="dev-row">
          <label>Fondo</label>
          <input class="dev-input" id="devBgColorPicker" type="color" value="#101725" />
        </div>
        <div class="dev-row">
          <label>Opacidad de fondo</label>
          <input class="dev-input" id="devBgOpacityRange" type="range" min="0" max="100" value="100" />
        </div>
        <div class="dev-row">
          <label>Border Radius</label>
          <input class="dev-input" id="devRadiusInput" type="text" placeholder="12px" />
        </div>
        <div class="dev-row">
          <label>Sombras</label>
          <div class="dev-pill-group" id="devShadowPresetGroup">
            <button class="dev-pill" data-shadow="">None</button>
            <button class="dev-pill" data-shadow="0 2px 10px rgba(0,0,0,0.18)">Low</button>
            <button class="dev-pill" data-shadow="0 8px 24px rgba(0,0,0,0.28)">Mid</button>
            <button class="dev-pill" data-shadow="0 14px 36px rgba(0,0,0,0.38)">High</button>
            <button class="dev-pill" data-shadow="0 0 24px rgba(88,166,255,0.55)">Glow</button>
          </div>
        </div>
      </section>

      <section class="dev-tab-panel" data-panel="layout">
        <div class="dev-row">
          <div class="dev-link-sides"><input id="devPaddingLinked" type="checkbox" checked /><span>Link padding sides</span></div>
          <div class="dev-inline-row">
            <input class="dev-input" id="devPaddingTop" type="text" placeholder="Top" />
            <input class="dev-input" id="devPaddingRight" type="text" placeholder="Right" />
            <input class="dev-input" id="devPaddingBottom" type="text" placeholder="Bottom" />
            <input class="dev-input" id="devPaddingLeft" type="text" placeholder="Left" />
          </div>
        </div>
        <div class="dev-row">
          <div class="dev-link-sides"><input id="devMarginLinked" type="checkbox" checked /><span>Link margin sides</span></div>
          <div class="dev-inline-row">
            <input class="dev-input" id="devMarginTop" type="text" placeholder="Top" />
            <input class="dev-input" id="devMarginRight" type="text" placeholder="Right" />
            <input class="dev-input" id="devMarginBottom" type="text" placeholder="Bottom" />
            <input class="dev-input" id="devMarginLeft" type="text" placeholder="Left" />
          </div>
        </div>
      </section>

      <section class="dev-tab-panel" data-panel="data">
        <div class="dev-row">
          <label>Data Binding</label>
          <button class="dev-btn dev-data-btn" id="devBindDataBtn">Vincular Dato</button>
        </div>
        <div class="dev-row">
          <label>Animación de entrada</label>
          <select class="dev-select" id="devEntryAnimation">
            <option value="">Ninguna</option>
            <option value="fade-in">Fade In</option>
            <option value="slide-up">Slide Up</option>
            <option value="zoom-in">Zoom In</option>
          </select>
        </div>
      </section>
    </div>
  `;
  devRoot.appendChild(toolbar);
  activeToolbar = toolbar;

  bindToolbarTabs(toolbar);
  bindToolbarDragging(toolbar);
  bindToolbarActions(toolbar);

  const closeBtn = toolbar.querySelector('#devToolbarCloseBtn');
  closeBtn?.addEventListener('click', () => hideFloatingToolbar());

  return toolbar;
}

function positionFloatingToolbar(target) {
  const toolbar = getOrCreateFloatingToolbar();
  if (!toolbar || !target) return;

  if (!toolbar.style.left || !toolbar.style.top) {
    const rect = target.getBoundingClientRect();
    const top = Math.max(8, rect.top - 14);
    const left = Math.max(8, Math.min(window.innerWidth - 360, rect.right + 12));
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
  }
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

function syncPanelFromCurrentTarget() {
  const selectorLabel = $('devTargetSelector');
  if (selectorLabel) selectorLabel.textContent = currentTargetDevId || 'N/A';
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

  const onInput = () => {
    if (!target.dataset.devId) return;
    actions.setProp(target.dataset.devId, (props) => {
      props.text = target.textContent || '';
    });
  };

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

  target.addEventListener('input', onInput);
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
  }

  if (devId) {
    actions.setProp(devId, (props) => {
      props.text = el.textContent || '';
    });
  }

  el.removeAttribute('contenteditable');
  el.classList.remove('dev-inline-editing');
  delete el.dataset.devInlineOriginal;

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

    ensureDevIdForElement(clone);
    applyContentOverrides();
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

  const bucket = getNodeBucket(currentTargetDevId);

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
    }, 1200);
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

function bindGlobalInteractions() {
  if (hasGlobalBindings) return;
  hasGlobalBindings = true;

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

/**
 * @typedef {Object} DevModeInterface
 * @property {() => void} init
 * @property {() => void} open
 * @property {() => void} close
 * @property {() => void} toggleInspector
 * @property {() => boolean} isAuthenticated
 */

function createBridge() {
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
