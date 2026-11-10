// ==========================================================================
// components/devmode/appearance.js — "Mi Estilo" (no-code, por usuario)
// Fondo (color/imagen del dispositivo), fuente global y animaciones.
// Todo se aplica EN VIVO y se guarda en state.appearance → Firestore
// (solo visible para el usuario dueño de la cuenta).
// El UI es un asistente de 3 pasos pensado para ser intuitivo a cualquier edad.
// ==========================================================================
import { state, saveDataToCloud } from '../../js/store.js';
import { auth } from '../../js/firebase-config.js';

const PRESET_COLORS = [
    { name: 'Océano', color: '#1e3a5f' },
    { name: 'Bosque', color: '#14532d' },
    { name: 'Uva', color: '#4c1d95' },
    { name: 'Rosa', color: '#831843' },
    { name: 'Café', color: '#3b2f2f' },
    { name: 'Carbón', color: '#1c1c1e' },
    { name: 'Petróleo', color: '#134e4a' },
    { name: 'Marino', color: '#1f2937' },
    { name: 'Arena', color: '#f0e9dd' },
    { name: 'Cielo', color: '#0b5d7a' }
];

const FONTS = {
    inter: { label: 'Clásica', css: null },
    georgia: { label: 'Elegante', css: "Georgia, 'Times New Roman', serif" },
    trebuchet: { label: 'Amigable', css: "'Trebuchet MS', 'Segoe UI', sans-serif" },
    comic: { label: 'Divertida', css: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" },
    mono: { label: 'Retro', css: "'Courier New', Consolas, monospace" }
};

const ANIMS = {
    default: { label: 'Clásicas', ico: '🌊', desc: 'Lo normal de siempre' },
    playful: { label: 'Divertidas', ico: '🎉', desc: 'Todo cobra vida' },
    none: { label: 'Silencio total', ico: '😴', desc: 'Sin animaciones' }
};

const WIZARD_CSS = `
.wiz-section { display: flex; flex-direction: column; gap: 8px; }
.wiz-step-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--text-primary); font-size: 14px; }
.wiz-step-num { background: var(--tint-sky); color: var(--accent-sky); width: 22px; height: 22px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
.wiz-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
.wiz-card { display: flex; flex-direction: column; align-items: center; gap: 6px; background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 8px; cursor: pointer; color: var(--text-secondary); font-size: 12px; font-weight: 600; min-height: 44px; transition: 0.2s; }
.wiz-card:hover { border-color: var(--accent-sky); transform: translateY(-2px); }
.wiz-card.is-active { background: var(--tint-sky); border-color: var(--accent-sky); color: var(--accent-sky); box-shadow: inset 0 0 0 1px var(--accent-sky-border); }
.wiz-card-ico { font-size: 1.6em; line-height: 1; }
.wiz-card-aa { font-size: 20px; font-weight: 700; line-height: 1.2; }
.wiz-swatches { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.wiz-swatch { width: 30px; height: 30px; border-radius: 999px; border: 2px solid transparent; cursor: pointer; transition: 0.15s; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
.wiz-swatch:hover { transform: scale(1.15); }
.wiz-swatch.is-active { border-color: var(--text-primary); transform: scale(1.15); }
.wiz-picker-label { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
.wiz-picker-label input { width: 30px; height: 30px; border: none; border-radius: 999px; background: transparent; cursor: pointer; padding: 0; }
.wiz-big-btn { background: var(--tint-sky); color: var(--accent-sky); border: 1px dashed var(--accent-sky); border-radius: var(--radius-md); padding: 12px; font-weight: 700; cursor: pointer; min-height: 44px; }
.wiz-big-btn:hover { background: var(--tint-sky); }
.wiz-slider-label { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.wiz-slider-label input { flex: 1; accent-color: var(--accent-sky); }
.wiz-hint { font-size: 11px; color: var(--text-tertiary); }
.wiz-preview { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--bg-inset); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 10px 14px; }
.wiz-preview-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.wiz-preview-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.6px; }
.wiz-preview-chip { background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--text-primary); box-shadow: var(--shadow-1); }
.wiz-preview-chip.is-bouncy { animation: wizBounce 1s ease-in-out infinite; }
@keyframes wizBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.wiz-reset-btn { background: transparent; border: 1px solid var(--status-error); color: var(--status-error); border-radius: var(--radius-md); padding: 8px 12px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.wiz-reset-btn:hover { background: var(--tint-error); }
.wiz-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 10000004; background: var(--bg-surface); border: 1px solid var(--accent-sky); color: var(--text-primary); padding: 8px 16px; border-radius: 999px; font-weight: 700; font-size: 13px; box-shadow: var(--shadow-2); }
`;

let rootRef = null;
let fileInputRef = null;

function rootEl(id) { return rootRef?.getElementById(id) || null; }

function showWizardToast(message) {
    let toastEl = rootEl('wizToast');
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'wizToast';
        toastEl.className = 'wiz-toast';
        rootRef.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.style.display = 'block';
    clearTimeout(showWizardToast._t);
    showWizardToast._t = setTimeout(() => { toastEl.style.display = 'none'; }, 1800);
}

function getAppearance() {
    if (!state.appearance || typeof state.appearance !== 'object') state.appearance = {};
    return state.appearance;
}

// --- MOTOR DE APLICACIÓN (inline en <html>/<body>: gana a los temas) ---
export function applyAppearance() {
    const ap = getAppearance();
    const html = document.documentElement;
    const body = document.body;

    if (ap.bgMode === 'color' && ap.bgColor) {
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = ap.bgColor;
        body.style.backgroundSize = '';
        body.style.backgroundAttachment = '';
        body.style.backgroundPosition = '';
    } else if (ap.bgMode === 'image' && ap.bgImage) {
        const dim = Math.min(80, Math.max(0, Number(ap.bgDim) || 0)) / 100;
        body.style.backgroundColor = '';
        body.style.backgroundImage = `linear-gradient(rgba(8,8,8,${dim}), rgba(8,8,8,${dim})), url("${ap.bgImage}")`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundAttachment = 'fixed';
    } else {
        body.style.backgroundImage = '';
        body.style.backgroundColor = '';
        body.style.backgroundSize = '';
        body.style.backgroundAttachment = '';
        body.style.backgroundPosition = '';
    }

    if (ap.font && FONTS[ap.font]?.css) html.style.setProperty('--font-sans', FONTS[ap.font].css);
    else html.style.removeProperty('--font-sans');

    html.classList.toggle('app-anim-none', ap.anim === 'none');
    html.classList.toggle('app-anim-playful', ap.anim === 'playful');
}

function resetAppearanceOverrides() {
    const body = document.body;
    body.style.backgroundImage = '';
    body.style.backgroundColor = '';
    body.style.backgroundSize = '';
    body.style.backgroundAttachment = '';
    body.style.backgroundPosition = '';
    document.documentElement.style.removeProperty('--font-sans');
    document.documentElement.classList.remove('app-anim-none', 'app-anim-playful');
}

// --- PERSISTENCIA (por usuario, en la nube) ---
async function persistAppearance(actionLabel) {
    applyAppearance();
    syncWizardUI();
    if (!state.currentUid) return;
    try {
        await saveDataToCloud('appearance');
        const status = rootEl('wizSaveStatus');
        if (status) { status.textContent = 'Guardado ✓'; status.style.color = 'var(--status-success)'; }
    } catch (e) {
        if (getAppearance().bgMode === 'image') {
            state.appearance = { ...getAppearance(), bgMode: 'theme', bgImage: null };
            applyAppearance();
            syncWizardUI();
            showWizardToast('⚠️ La imagen era muy pesada para la nube. Elige una más pequeña.');
            try { await saveDataToCloud('appearance'); } catch {}
        } else {
            showWizardToast('⚠️ No se pudo guardar en la nube (' + (e?.code || 'error') + ')');
            const status = rootEl('wizSaveStatus');
            if (status) { status.textContent = 'Sin conexión'; status.style.color = 'var(--status-warning)'; }
        }
    }
}

// --- IMAGEN DESDE EL DISPOSITIVO (se optimiza sola) ---
function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

async function processImageFile(file) {
    if (!file || !file.type.startsWith('image/')) { showWizardToast('⚠️ Elige un archivo de imagen (JPG/PNG/WebP).'); return null; }
    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const img = await loadImageFromDataUrl(dataUrl);
        const MAX_SIDE = 1600;
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let out = canvas.toDataURL('image/jpeg', 0.78);
        let quality = 0.78;
        while (out.length > 260000 && quality > 0.4) {
            quality -= 0.12;
            out = canvas.toDataURL('image/jpeg', quality);
        }
        if (out.length > 260000) { showWizardToast('⚠️ La imagen es muy pesada. Elige una foto más pequeña.'); return null; }
        return out;
    } catch (e) {
        showWizardToast('⚠️ No se pudo leer la imagen.');
        return null;
    }
}

// --- ASISTENTE: construcción y acciones ---
function buildWizardMarkup() {
    if (rootEl('devAppearanceModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="devAppearanceModal" style="display: none; position: fixed; inset: 0; z-index: 9999998; background: var(--overlay-strong); align-items: center; justify-content: center; backdrop-filter: blur(8px);">
      <div style="background: var(--bg-surface); width: min(560px, 94vw); max-height: 90vh; overflow-y: auto; border-radius: var(--radius-xl); border: 1px solid var(--glow-sky); padding: 24px; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; color: var(--text-primary);">🎨 Mi Estilo</h2>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span id="wizSaveStatus" style="font-size: 12px; color: var(--status-success); font-weight: 700;">Guardado ✓</span>
            <button id="wizClose" style="background: transparent; border: none; color: var(--text-tertiary); font-size: 1.3em; cursor: pointer;">✖</button>
          </div>
        </div>
        <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">Tu app, a tu manera. Toca una tarjeta y verás el cambio al instante. Solo tú lo verás, en todos tus dispositivos.</p>

        <div class="wiz-section">
          <div class="wiz-step-title"><span class="wiz-step-num">1</span> Tu fondo</div>
          <div class="wiz-cards" id="wizBgCards">
            <button class="wiz-card" data-bgmode="theme"><span class="wiz-card-ico">✨</span><span>Según el tema</span></button>
            <button class="wiz-card" data-bgmode="color"><span class="wiz-card-ico">🎨</span><span>Un color</span></button>
            <button class="wiz-card" data-bgmode="image"><span class="wiz-card-ico">🖼️</span><span>Imagen mía</span></button>
          </div>
          <div id="wizColorRow" style="display: none;">
            <div class="wiz-swatches" id="wizSwatches"></div>
            <label class="wiz-picker-label">Otro color: <input type="color" id="wizColorPicker" aria-label="Elegir otro color"></label>
          </div>
          <div id="wizImageRow" style="display: none;">
            <button id="wizImageBtn" class="wiz-big-btn">📁 Subir imagen desde tu dispositivo</button>
            <label class="wiz-slider-label"><span>☀️</span><input type="range" id="wizDim" min="0" max="80" step="5" value="30"><span>🌙</span><span id="wizDimValue">30%</span><span>(para leer mejor)</span></label>
            <span class="wiz-hint">La imagen se ajusta sola para que tu app siga siendo rápida.</span>
          </div>
        </div>

        <div class="wiz-section">
          <div class="wiz-step-title"><span class="wiz-step-num">2</span> Tu letra</div>
          <div class="wiz-cards" id="wizFontCards"></div>
        </div>

        <div class="wiz-section">
          <div class="wiz-step-title"><span class="wiz-step-num">3</span> El movimiento</div>
          <div class="wiz-cards" id="wizAnimCards"></div>
        </div>

        <div class="wiz-preview">
          <div class="wiz-preview-left">
            <span class="wiz-preview-label">Así se ve</span>
            <span id="wizPreviewChip" class="wiz-preview-chip">📝 Tu app</span>
          </div>
          <button id="wizResetAll" class="wiz-reset-btn">↩️ Restaurar todo</button>
        </div>
      </div>
    </div>`;
    rootRef.appendChild(wrap.firstElementChild);
}

function buildCards() {
    const fontCards = rootEl('wizFontCards');
    fontCards.innerHTML = '';
    Object.entries(FONTS).forEach(([key, f]) => {
        const btn = document.createElement('button');
        btn.className = 'wiz-card';
        btn.dataset.font = key;
        btn.innerHTML = `<span class="wiz-card-aa" style="font-family: ${f.css || "'Inter', system-ui, sans-serif"}">Aa</span><span>${f.label}</span>`;
        fontCards.appendChild(btn);
    });

    const animCards = rootEl('wizAnimCards');
    animCards.innerHTML = '';
    Object.entries(ANIMS).forEach(([key, a]) => {
        const btn = document.createElement('button');
        btn.className = 'wiz-card';
        btn.dataset.anim = key;
        btn.innerHTML = `<span class="wiz-card-ico">${a.ico}</span><span>${a.label}</span><span style="font-size: 10px; color: var(--text-tertiary);">${a.desc}</span>`;
        animCards.appendChild(btn);
    });

    const swatches = rootEl('wizSwatches');
    swatches.innerHTML = '';
    PRESET_COLORS.forEach(({ name, color }) => {
        const s = document.createElement('button');
        s.className = 'wiz-swatch';
        s.dataset.color = color;
        s.title = name;
        s.setAttribute('aria-label', `Color ${name}`);
        s.style.background = color;
        swatches.appendChild(s);
    });
}

function syncWizardUI() {
    const ap = getAppearance();
    const bgMode = ap.bgMode || 'theme';
    rootEl('wizBgCards')?.querySelectorAll('.wiz-card').forEach(c => {
        c.classList.toggle('is-active', c.dataset.bgmode === bgMode);
    });
    rootEl('wizColorRow').style.display = bgMode === 'color' ? 'block' : 'none';
    rootEl('wizImageRow').style.display = bgMode === 'image' ? 'block' : 'none';

    rootEl('wizSwatches')?.querySelectorAll('.wiz-swatch').forEach(s => {
        s.classList.toggle('is-active', ap.bgColor && ap.bgColor.toLowerCase() === s.dataset.color.toLowerCase());
    });
    const picker = rootEl('wizColorPicker');
    if (picker) picker.value = /^#[0-9a-f]{6}$/i.test(ap.bgColor || '') ? ap.bgColor : PRESET_COLORS[0].color;
    const dim = rootEl('wizDim');
    if (dim) { dim.value = String(ap.bgDim ?? 30); const label = rootEl('wizDimValue'); if (label) label.textContent = `${dim.value}%`; }

    rootEl('wizFontCards')?.querySelectorAll('.wiz-card').forEach(c => {
        c.classList.toggle('is-active', c.dataset.font === (ap.font || 'inter'));
    });
    rootEl('wizAnimCards')?.querySelectorAll('.wiz-card').forEach(c => {
        c.classList.toggle('is-active', c.dataset.anim === (ap.anim || 'default'));
    });

    const chip = rootEl('wizPreviewChip');
    if (chip) {
        chip.style.fontFamily = FONTS[ap.font || 'inter']?.css ? FONTS[ap.font].css : "'Inter', system-ui, sans-serif";
        chip.classList.toggle('is-bouncy', ap.anim === 'playful');
    }
}

function bindWizardEvents() {
    rootEl('wizClose')?.addEventListener('click', () => {
        rootEl('devAppearanceModal').style.display = 'none';
    });

    rootEl('wizBgCards')?.addEventListener('click', (e) => {
        const card = e.target.closest('.wiz-card');
        if (!card) return;
        const mode = card.dataset.bgmode;
        state.appearance = { ...getAppearance(), bgMode: mode };
        persistAppearance('bg-mode');
    });

    rootEl('wizSwatches')?.addEventListener('click', (e) => {
        const s = e.target.closest('.wiz-swatch');
        if (!s) return;
        state.appearance = { ...getAppearance(), bgMode: 'color', bgColor: s.dataset.color };
        persistAppearance('bg-color');
    });

    rootEl('wizColorPicker')?.addEventListener('input', (e) => {
        state.appearance = { ...getAppearance(), bgMode: 'color', bgColor: e.target.value };
        persistAppearance('bg-color');
    });

    rootEl('wizImageBtn')?.addEventListener('click', () => {
        if (!fileInputRef) {
            fileInputRef = document.createElement('input');
            fileInputRef.type = 'file';
            fileInputRef.accept = 'image/*';
            fileInputRef.style.display = 'none';
            document.body.appendChild(fileInputRef);
            fileInputRef.addEventListener('change', async () => {
                const file = fileInputRef.files?.[0];
                fileInputRef.value = '';
                if (!file) return;
                const dataUrl = await processImageFile(file);
                if (!dataUrl) return;
                state.appearance = { ...getAppearance(), bgMode: 'image', bgImage: dataUrl };
                persistAppearance('bg-image');
            });
        }
        fileInputRef.click();
    });

    rootEl('wizDim')?.addEventListener('input', (e) => {
        state.appearance = { ...getAppearance(), bgDim: Number(e.target.value) };
        const label = rootEl('wizDimValue');
        if (label) label.textContent = `${e.target.value}%`;
        applyAppearance();
        syncWizardUI();
        clearTimeout(bindWizardEvents._dimSave);
        bindWizardEvents._dimSave = setTimeout(() => persistAppearance('bg-dim'), 400);
    });

    rootEl('wizFontCards')?.addEventListener('click', (e) => {
        const card = e.target.closest('.wiz-card');
        if (!card) return;
        state.appearance = { ...getAppearance(), font: card.dataset.font };
        persistAppearance('font');
    });

    rootEl('wizAnimCards')?.addEventListener('click', (e) => {
        const card = e.target.closest('.wiz-card');
        if (!card) return;
        state.appearance = { ...getAppearance(), anim: card.dataset.anim };
        persistAppearance('anim');
    });

    rootEl('wizResetAll')?.addEventListener('click', () => {
        state.appearance = {};
        resetAppearanceOverrides();
        persistAppearance('reset');
        showWizardToast('↩️ Estilo restaurado al original.');
    });
}

export function openAppearanceModal() {
    if (!rootRef) return;
    syncWizardUI();
    rootEl('devAppearanceModal').style.display = 'flex';
}

export function initAppearance(root) {
    if (!root) return;
    rootRef = root;

    if (!rootEl('devmode-wiz-style')) {
        const style = document.createElement('style');
        style.id = 'devmode-wiz-style';
        style.textContent = WIZARD_CSS;
        root.appendChild(style);
    }
    buildWizardMarkup();
    buildCards();
    bindWizardEvents();

    // Reaplicar cuando la nube trae el estilo del usuario (otros dispositivos / login)
    window.addEventListener('stateChanged', () => { applyAppearance(); syncWizardUI(); });
    // Al cerrar sesión, el estilo personal vuelve a los temas por defecto
    if (auth?.onAuthStateChanged) {
        auth.onAuthStateChanged((user) => {
            if (!user) resetAppearanceOverrides();
            else applyAppearance();
        });
    }

    applyAppearance();
    syncWizardUI();
}
