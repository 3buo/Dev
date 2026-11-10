import { ensureDevModeShadowRoot } from './devmode-shadow.js';
import { auth } from '../../js/firebase-config.js';
import { state, saveDataToCloud } from '../../js/store.js';
import { hashPin, verifyPin } from '../../js/pin.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail, checkActionCode } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { initAppearance, openAppearanceModal, applyAppearance } from './appearance.js';
import {
  injectDevNoCodeCss,
  bindGlobalButtonSounds,
  bindInspectorHotkeys,
  ensureDevSoundPanel
} from './devmode-sounds-ui.js';

// Sin credenciales hardcodeadas en el bundle (fix F04). DevMode ahora usa
// credenciales POR USUARIO: cada cuenta crea su propio usuario/contraseña dev
// (PBKDF2, guardado en su doc de Firestore) y puede recuperarlas re-autenticando
// con su contraseña de Taskify o con un código enviado a su correo.
const DEV_ALLOWED_EMAILS = []; // vacío: el gate es la credencial por usuario
const KEY_STYLES = 'dev_dynamic_styles_v2';
const KEY_CONTENT = 'dev_dynamic_content_v2';
const KEY_PANEL_POS = 'dev_panel_position_v2';
const KEY_BINDINGS = 'dev_dynamic_bindings_v1';
const AUTOSAVE_DEBOUNCE_MS = 1500;

let shadowRootRef = null;
let isDevModeActive = false;
let isInspectorActive = false;
let isSelectionLocked = false;
let currentTargetElement = null;
let currentTargetDevId = null;
let activeInlineEditor = null;
let mutationObserver = null;
let globalBindingsReady = false;

const devLocalState = {
  dynamicStylesById: {},
  dynamicContentById: {},
  dynamicBindingsById: {}
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
    devLocalState.dynamicStylesById = JSON.parse(localStorage.getItem(KEY_STYLES) || '{}');
  } catch {
    devLocalState.dynamicStylesById = {};
    localStorage.removeItem(KEY_STYLES);
  }

  try {
    devLocalState.dynamicContentById = JSON.parse(localStorage.getItem(KEY_CONTENT) || '{}');
  } catch {
    devLocalState.dynamicContentById = {};
    localStorage.removeItem(KEY_CONTENT);
  }

  try {
    devLocalState.dynamicBindingsById = JSON.parse(localStorage.getItem(KEY_BINDINGS) || '{}');
  } catch {
    devLocalState.dynamicBindingsById = {};
    localStorage.removeItem(KEY_BINDINGS);
  }
}

function saveState() {
  localStorage.setItem(KEY_STYLES, JSON.stringify(devLocalState.dynamicStylesById));
  localStorage.setItem(KEY_CONTENT, JSON.stringify(devLocalState.dynamicContentById));
  localStorage.setItem(KEY_BINDINGS, JSON.stringify(devLocalState.dynamicBindingsById));
}

function getNodeStyleBucket(devId) {
  if (!devLocalState.dynamicStylesById[devId]) {
    devLocalState.dynamicStylesById[devId] = { styles: {} };
  }
  return devLocalState.dynamicStylesById[devId];
}

function ensureLightStyleTag(id) {
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = id;
    document.head.appendChild(tag);
  }
  return tag;
}

// Fix F-dev-01: los estilos por-elemento DEBEN vivir en el DOM light.
// Antes se inyectaban dentro del shadow root y nunca alcanzaban a los
// elementos de la app (scoping de Shadow DOM) → la edición visual no se veía.
function injectDynamicStyleSheet() {
  const styleTag = ensureLightStyleTag('dev-dynamic-stylesheet');
  let cssText = '/* DEV MODE V2 - LIGHT DOM STYLES */\n';
  for (const devId in devLocalState.dynamicStylesById) {
    const selector = `[data-dev-id="${cssEscape(devId)}"]`;
    const styles = devLocalState.dynamicStylesById[devId]?.styles || {};
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

// Outline de selección/hover y keyframes de animación por-elemento (DOM light)
const DEV_LIGHT_UI_CSS = `
.dev-hover-target { outline: 2px dashed var(--accent-sky) !important; outline-offset: 2px !important; cursor: crosshair !important; }
.dev-selected-target { outline: 3px solid var(--status-error) !important; outline-offset: 2px !important; }
.dev-inline-editing { outline: 2px solid var(--accent-primary) !important; outline-offset: 2px !important; }
@keyframes devAnimScaleDown { 0% { transform: scale(1); } 40% { transform: scale(0.94); } 100% { transform: scale(1); } }
@keyframes devAnimScaleUp { 0% { transform: scale(1); } 40% { transform: scale(1.06) translateY(-2px); } 100% { transform: scale(1); } }
@keyframes devAnimPulseGlow { 0%, 100% { box-shadow: 0 0 0 rgba(0,0,0,0); } 50% { box-shadow: 0 0 14px var(--glow-sky); } }
`;

function ensureLightUICss() {
  const tag = ensureLightStyleTag('dev-light-ui-css');
  tag.textContent = DEV_LIGHT_UI_CSS;
}

function getBindingContext() {
  const currentUserName = localStorage.getItem('currentUserName') || 'Usuario';
  return {
    currentUser: {
      name: currentUserName
    },
    app: {
      title: document.title || 'App'
    },
    now: {
      iso: new Date().toISOString(),
      locale: new Date().toLocaleString()
    }
  };
}

function getValueFromPath(obj, path) {
  if (!path) return '';
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) return acc[key];
    return '';
  }, obj);
}

function resolveDynamicExpression(expression) {
  const context = getBindingContext();
  const raw = expression.trim();
  const normalized = raw.replace(/^\{\{|\}\}$/g, '').trim();
  const value = getValueFromPath(context, normalized);
  if (value === undefined || value === null || value === '') return `{{${normalized}}}`;
  return String(value);
}

function applyContentOverrides() {
  for (const devId in devLocalState.dynamicContentById) {
    const el = getElementByDevId(devId);
    if (!el) continue;

    const binding = devLocalState.dynamicBindingsById[devId];
    if (binding) {
      const resolved = resolveDynamicExpression(binding);
      if (el.textContent !== resolved) el.textContent = resolved;
      continue;
    }

    const next = (devLocalState.dynamicContentById[devId] || '').trim();
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
  const flexGroup = rootEl('devFlexGroup');
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
  const flexGap = rootEl('devFlexGap');

  if (!(targetBadge instanceof HTMLElement)) return;

  if (!currentTargetElement || !currentTargetDevId) {
    targetBadge.textContent = 'Ninguno';
    if (textGroup instanceof HTMLElement) textGroup.style.display = 'none';
    if (flexGroup instanceof HTMLElement) flexGroup.style.display = 'none';
    syncFlexButtons({});
    return;
  }

  targetBadge.textContent = `[data-dev-id="${currentTargetDevId}"]`;
  if (textGroup instanceof HTMLElement) textGroup.style.display = 'flex';
  if (flexGroup instanceof HTMLElement) flexGroup.style.display = 'flex';

  const computed = getComputedStyle(currentTargetElement);
  const nodeStyles = devLocalState.dynamicStylesById[currentTargetDevId]?.styles || {};

  if (textInput instanceof HTMLInputElement) {
    textInput.value = devLocalState.dynamicContentById[currentTargetDevId] || currentTargetElement.textContent?.trim() || '';
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

  const flexValues = {
    flexDirection: nodeStyles.flexDirection || computed.flexDirection || '',
    flexWrap: nodeStyles.flexWrap || computed.flexWrap || '',
    justifyContent: nodeStyles.justifyContent || computed.justifyContent || '',
    alignItems: nodeStyles.alignItems || computed.alignItems || ''
  };

  if (flexGap instanceof HTMLInputElement) {
    flexGap.value = nodeStyles.gap || computed.gap || '';
  }

  syncFlexButtons(flexValues);
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
    toast.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000004;background:var(--bg-surface);border:1px solid var(--accent-sky);color:var(--text-primary);padding:var(--space-2) 12px;border-radius:999px;font-weight:700;';
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
    devLocalState.dynamicContentById[currentTargetDevId] = activeInlineEditor.textContent?.trim() || '';
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
  const flexGap = rootEl('devFlexGap');

  if (bgText instanceof HTMLInputElement && bgText.value.trim()) styles.background = bgText.value.trim();
  if (txtText instanceof HTMLInputElement && txtText.value.trim()) styles.color = txtText.value.trim();
  if (borderText instanceof HTMLInputElement && borderText.value.trim()) styles.borderColor = borderText.value.trim();
  if (borderBottom instanceof HTMLInputElement && borderBottom.value.trim()) styles.borderBottom = borderBottom.value.trim();
  if (borderRadius instanceof HTMLInputElement && borderRadius.value.trim()) styles.borderRadius = borderRadius.value.trim();
  if (padding instanceof HTMLInputElement && padding.value.trim()) styles.padding = padding.value.trim();
  if (fontSize instanceof HTMLInputElement && fontSize.value.trim()) styles.fontSize = fontSize.value.trim();

  if (flexGap instanceof HTMLInputElement) {
    const gapValue = flexGap.value.trim();
    if (gapValue) styles.gap = gapValue;
    else delete styles.gap;
  }

  if (textInput instanceof HTMLInputElement) {
    devLocalState.dynamicContentById[currentTargetDevId] = textInput.value;
  }

  // Animación al hacer clic (por-elemento): interruptor + tipo de efecto
  const animEnable = rootEl('devAnimEnable');
  const animType = rootEl('devAnimType');
  if (animEnable instanceof HTMLInputElement && animType instanceof HTMLSelectElement) {
    if (animEnable.checked) {
      const camel = animType.value.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      styles.animation = `devAnim${camel[0].toUpperCase() + camel.slice(1)} var(--duration-base) var(--ease-standard)`;
    } else {
      delete styles.animation;
    }
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

  delete devLocalState.dynamicStylesById[currentTargetDevId];
  delete devLocalState.dynamicContentById[currentTargetDevId];
  saveState();
  applyAllPersisted();
  syncFieldsFromSelectedElement();
  showToast('🔄 Elemento revertido');
}

function factoryResetStyles() {
  if (!confirm('⚠️ ¿Borrar TODOS los estilos y textos personalizados?')) return;
  devLocalState.dynamicStylesById = {};
  devLocalState.dynamicContentById = {};
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
  if (mutationObserver) { mutationObserver.disconnect(); mutationObserver = null; }
  window.__devModeIsAuthenticated = false;

  const panel = rootEl('devEditorPanel');
  if (panel instanceof HTMLElement) panel.style.display = 'none';

  if (currentTargetElement) currentTargetElement.classList.remove('dev-selected-target');
  currentTargetElement = null;
  currentTargetDevId = null;
}

function enterDevPanel() {
  window.__devModeIsAuthenticated = true;
  isDevModeActive = true;
  isInspectorActive = true;

  const modal = rootEl('devLoginModal');
  const panel = rootEl('devEditorPanel');
  if (modal instanceof HTMLElement) modal.style.display = 'none';
  if (panel instanceof HTMLElement) panel.style.display = 'flex';

  const btn = rootEl('btnInspectorToggle');
  if (btn instanceof HTMLButtonElement) btn.textContent = 'Inspeccionar: ON';

  startMutationObserver();
  showToast('✅ DevMode autenticado');
}

// --- CREDENCIALES DEV POR USUARIO (crear / entrar / recuperar) ---
const devCred = () => (state.devAuth && typeof state.devAuth === 'object' && state.devAuth.hash) ? state.devAuth : null;

async function authenticateDev() {
  const current = auth?.currentUser;
  if (!current) { showToast('❌ Requiere sesión'); return; }
  if (DEV_ALLOWED_EMAILS.length && !DEV_ALLOWED_EMAILS.includes(current.email)) {
    showToast('❌ Acceso denegado (sin autorización dev)');
    return;
  }
  const cred = devCred();
  if (!cred) { showToast('🆕 Primero crea tus credenciales dev.'); return; }

  const userInput = (rootEl('devUser')?.value || '').trim();
  const passInput = rootEl('devPass')?.value || '';
  if (!userInput || !passInput) { showToast('✍️ Escribe tu usuario y contraseña dev.'); return; }
  if (userInput !== cred.user) { showToast('❌ Usuario dev incorrecto.'); return; }

  const ok = await verifyPin(passInput, cred).catch(() => false);
  if (!ok) { showToast('❌ Contraseña dev incorrecta.'); return; }
  enterDevPanel();
}

async function createDevCredentials() {
  const current = auth?.currentUser;
  if (!current) { showToast('❌ Requiere sesión'); return; }
  const userInput = (rootEl('devUser')?.value || '').trim();
  const passInput = rootEl('devPass')?.value || '';
  const passInput2 = rootEl('devPass2')?.value || '';
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(userInput)) { showToast('✍️ Usuario dev: 3-20 caracteres (letras, números, . _ -).'); return; }
  if (passInput.length < 4 || passInput.length > 20) { showToast('🔑 Contraseña dev: 4-20 caracteres.'); return; }
  if (passInput !== passInput2) { showToast('🔑 Las contraseñas no coinciden.'); return; }

  state.devAuth = { user: userInput, ...(await hashPin(passInput)) };
  try { await saveDataToCloud('dev-credentials'); } catch (e) { console.warn('dev cred save', e); }
  enterDevPanel();
  showToast('🔐 Credenciales dev creadas para tu usuario');
}

function closeDevLogin() {
  const modal = rootEl('devLoginModal');
  if (modal instanceof HTMLElement) modal.style.display = 'none';
}

function openDevLogin() {
  const cred = devCred();
  const title = rootEl('devLoginTitle');
  const hint = rootEl('devLoginHint');
  const pass2 = rootEl('devPass2');
  const forgot = rootEl('devForgotLink');
  const submit = rootEl('devLoginSubmit');
  const userInput = rootEl('devUser');
  const passInput = rootEl('devPass');

  if (userInput instanceof HTMLInputElement) userInput.value = '';
  if (passInput instanceof HTMLInputElement) passInput.value = '';
  if (pass2 instanceof HTMLInputElement) pass2.value = '';

  if (title instanceof HTMLElement) title.textContent = cred ? '⚡ Modo Developer' : '🔐 Crea tus credenciales dev';
  if (hint instanceof HTMLElement) {
    hint.textContent = cred
      ? 'Ingresa tus credenciales de desarrollador.'
      : 'Es tu primera vez: elige un usuario y una contraseña dev. Son tuyos, de tu cuenta.';
  }
  if (pass2 instanceof HTMLElement) pass2.style.display = cred ? 'none' : 'block';
  if (forgot instanceof HTMLElement) forgot.style.display = cred ? 'block' : 'none';
  if (submit instanceof HTMLButtonElement) submit.textContent = cred ? 'Ingresar' : 'Crear y entrar';
  if (userInput instanceof HTMLInputElement) userInput.placeholder = cred ? 'Usuario dev' : 'Elige tu usuario dev';
  if (passInput instanceof HTMLInputElement) passInput.placeholder = cred ? 'Contraseña dev' : 'Elige tu contraseña dev';

  const modal = rootEl('devLoginModal');
  if (modal instanceof HTMLElement) modal.style.display = 'flex';
}

// --- RECUPERACIÓN: contraseña de Taskify o código al correo ---
let devRecoveryVerified = false;

function openDevRecovery() {
  devRecoveryVerified = false;
  const modal = rootEl('devRecoveryModal');
  if (modal instanceof HTMLElement) modal.style.display = 'flex';
  rootEl('devRecoveryPathPassword').style.display = 'block';
  rootEl('devRecoveryPathEmail').style.display = 'none';
  rootEl('devRecoveryResult').style.display = 'none';
  const passEl = rootEl('devRecoveryAppPass');
  if (passEl instanceof HTMLInputElement) passEl.value = '';
  const codeEl = rootEl('devRecoveryCode');
  if (codeEl instanceof HTMLInputElement) codeEl.value = '';
  rootEl('devLoginModal').style.display = 'none';
  syncRecoveryPathButtons('password');
}

function closeDevRecovery() {
  const modal = rootEl('devRecoveryModal');
  if (modal instanceof HTMLElement) modal.style.display = 'none';
}

function syncRecoveryPathButtons(activePath) {
  rootEl('devRecoveryPaths')?.querySelectorAll('.dev-recovery-path').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.path === activePath);
  });
}

function selectRecoveryPath(path) {
  rootEl('devRecoveryPathPassword').style.display = path === 'password' ? 'block' : 'none';
  rootEl('devRecoveryPathEmail').style.display = path === 'email' ? 'block' : 'none';
  syncRecoveryPathButtons(path);
}

function showRecoveryResult() {
  devRecoveryVerified = true;
  rootEl('devRecoveryPathPassword').style.display = 'none';
  rootEl('devRecoveryPathEmail').style.display = 'none';
  rootEl('devRecoveryResult').style.display = 'block';
  const userEl = rootEl('devRecoveryUser');
  if (userEl instanceof HTMLInputElement) {
    const current = devCred();
    userEl.value = current?.user || `dev_${(auth.currentUser?.uid || 'user').slice(0, 6)}`;
  }
  const p1 = rootEl('devRecoveryNewPass');
  const p2 = rootEl('devRecoveryNewPass2');
  if (p1 instanceof HTMLInputElement) p1.value = '';
  if (p2 instanceof HTMLInputElement) p2.value = '';
}

async function verifyDevRecoveryByPassword() {
  const current = auth?.currentUser;
  if (!current) { showToast('❌ Requiere sesión'); return; }
  const pass = rootEl('devRecoveryAppPass')?.value || '';
  if (!pass) { showToast('✍️ Escribe tu contraseña de Taskify.'); return; }
  try {
    await signInWithEmailAndPassword(auth, current.email, pass);
    showRecoveryResult();
    showToast('✅ Identidad verificada con tu contraseña');
  } catch (e) {
    showToast('❌ Contraseña de Taskify incorrecta.');
  }
}

async function sendDevRecoveryCode() {
  const current = auth?.currentUser;
  if (!current) { showToast('❌ Requiere sesión'); return; }
  try {
    await sendPasswordResetEmail(auth, current.email, {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true
    });
    showToast('📧 Código enviado a ' + current.email + '. Revisa tu bandeja y spam.');
  } catch (e) {
    showToast('❌ No se pudo enviar el código (' + (e?.code || 'red') + ').');
  }
}

async function verifyDevRecoveryCode() {
  const current = auth?.currentUser;
  if (!current) { showToast('❌ Requiere sesión'); return; }
  const code = (rootEl('devRecoveryCode')?.value || '').trim();
  if (!code) { showToast('✍️ Pega el código recibido por correo.'); return; }
  try {
    const info = await checkActionCode(auth, code);
    if (info.operation !== 'PASSWORD_RESET') throw new Error('wrong-operation');
    const codeEmail = (info.data?.email || '').toLowerCase();
    if (codeEmail !== current.email.toLowerCase()) throw new Error('email-mismatch');
    showRecoveryResult();
    showToast('✅ Código verificado. Recupera tus credenciales.');
  } catch (e) {
    showToast('❌ Código inválido o expirado. Usa el enlace del correo o pide otro.');
  }
}

async function saveDevRecoveryCredentials() {
  if (!devRecoveryVerified) { showToast('❌ Verifica primero tu identidad.'); return; }
  const userInput = (rootEl('devRecoveryUser')?.value || '').trim();
  const passInput = rootEl('devRecoveryNewPass')?.value || '';
  const passInput2 = rootEl('devRecoveryNewPass2')?.value || '';
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(userInput)) { showToast('✍️ Usuario dev: 3-20 caracteres (letras, números, . _ -).'); return; }
  if (passInput.length < 4 || passInput.length > 20) { showToast('🔑 Contraseña dev: 4-20 caracteres.'); return; }
  if (passInput !== passInput2) { showToast('🔑 Las contraseñas no coinciden.'); return; }

  state.devAuth = { user: userInput, ...(await hashPin(passInput)) };
  try { await saveDataToCloud('dev-credentials'); } catch (e) { console.warn('dev cred save', e); }
  closeDevRecovery();
  showToast('🔐 Credenciales dev recuperadas y guardadas. ¡Ya puedes entrar!');
}

function syncFlexButtons(values) {
  if (!shadowRootRef) return;
  const buttons = shadowRootRef.querySelectorAll('.dev-seg-btn');
  buttons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const key = button.dataset.flexKey || '';
    const value = button.dataset.flexValue || '';
    if (values[key] === value) button.classList.add('is-active');
    else button.classList.remove('is-active');
  });
}

function applyFlexOption(key, value) {
  if (!currentTargetElement || !currentTargetDevId) {
    showToast('Selecciona un elemento primero');
    return;
  }

  const bucket = getNodeStyleBucket(currentTargetDevId);
  const styles = bucket.styles;

  styles.display = 'flex';
  styles[key] = value;

  saveState();
  applyAllPersisted();
  syncFieldsFromSelectedElement();
  showToast(`📐 ${key}: ${value}`);
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
  const appearanceBtn = rootEl('btnAppearanceOpen');
  const saveBtn = rootEl('devBtnSave');
  const resetBtn = rootEl('devBtnResetTarget');
  const factoryBtn = rootEl('devBtnFactoryReset');
  const textInput = rootEl('devElementText');

  loginSubmit?.addEventListener('click', (e) => {
    e.preventDefault();
    if (devCred()) authenticateDev();
    else createDevCredentials();
  });

  loginCancel?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDevLogin();
  });

  rootEl('devForgotLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    openDevRecovery();
  });

  rootEl('devRecoveryPaths')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dev-recovery-path');
    if (btn) selectRecoveryPath(btn.dataset.path);
  });
  rootEl('devRecoveryVerifyPass')?.addEventListener('click', () => verifyDevRecoveryByPassword());
  rootEl('devRecoverySendCode')?.addEventListener('click', () => sendDevRecoveryCode());
  rootEl('devRecoveryVerifyCode')?.addEventListener('click', () => verifyDevRecoveryCode());
  rootEl('devRecoverySave')?.addEventListener('click', () => saveDevRecoveryCredentials());
  rootEl('devRecoveryCancel')?.addEventListener('click', () => closeDevRecovery());

  panelClose?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDevPanel();
  });

  appearanceBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openAppearanceModal();
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

  // Animación por-elemento: mostrar el selector solo si el interruptor está activo
  const animEnable = rootEl('devAnimEnable');
  const animType = rootEl('devAnimType');
  if (animEnable instanceof HTMLInputElement && animType instanceof HTMLElement) {
    animEnable.addEventListener('change', () => {
      animType.style.display = animEnable.checked ? 'block' : 'none';
    });
  }

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

  const flexGap = rootEl('devFlexGap');
  if (flexGap instanceof HTMLInputElement) {
    flexGap.addEventListener('change', () => {
      if (!currentTargetDevId) return;
      const bucket = getNodeStyleBucket(currentTargetDevId);
      const value = flexGap.value.trim();
      if (value) {
        bucket.styles.display = 'flex';
        bucket.styles.gap = value;
      } else {
        delete bucket.styles.gap;
      }
      saveState();
      applyAllPersisted();
      syncFieldsFromSelectedElement();
    });
  }

  if (shadowRootRef) {
    shadowRootRef.querySelectorAll('.dev-seg-btn').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener('click', () => {
        const key = button.dataset.flexKey;
        const value = button.dataset.flexValue;
        if (!key || !value) return;
        applyFlexOption(key, value);
      });
    });
  }
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

  ensureLightUICss();
  ensureAllDevIds();
  applyAllPersisted();

  bindUIActions();
  setupDragPanel();
  bindGlobalEvents();

  // Estudio visual "Mi Estilo" (fondo/fuente/animaciones por usuario)
  try {
    initAppearance(shadowRootRef);
    applyAppearance();
  } catch (e) { console.warn('appearance init', e); }

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
