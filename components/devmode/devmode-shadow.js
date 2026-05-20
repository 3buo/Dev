const DEV_SHADOW_HOST_ID = 'devmode-shadow-host';

const LEGACY_MARKUP = `
<div id="devLoginModal" style="display: none; position: fixed; inset: 0; z-index: 9999999; background: rgba(0,0,0,0.9); align-items: center; justify-content: center; backdrop-filter: blur(10px);">
  <div style="background: #161b22; padding: 30px; border-radius: 12px; border: 1px solid #58a6ff; width: 300px; box-shadow: 0 0 50px rgba(88, 166, 255, 0.2);">
      <h2 style="color: #58a6ff; margin-top: 0; text-align: center;">⚡ Modo Developer</h2>
      <input type="text" id="devUser" placeholder="Usuario" style="width: 100%; margin-bottom: 15px; padding: 10px; background: #010409; border: 1px solid #30363d; color: white; border-radius: 6px; box-sizing: border-box;">
      <input type="password" id="devPass" placeholder="Contraseña" style="width: 100%; margin-bottom: 20px; padding: 10px; background: #010409; border: 1px solid #30363d; color: white; border-radius: 6px; box-sizing: border-box;">
      <div style="display: flex; gap: 10px;">
          <button id="devLoginSubmit" style="flex: 1; background: #58a6ff; color: #000; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">Ingresar</button>
          <button id="devLoginCancel" style="flex: 1; background: transparent; color: #8b949e; border: 1px solid #30363d; padding: 10px; border-radius: 6px; cursor: pointer;">Cancelar</button>
      </div>
  </div>
</div>

<div id="devEditorPanel" class="dev-panel" role="dialog" aria-label="DevMode UI Builder">
  <div class="dev-panel-header">
      <span>🛠️ UI Builder</span>
      <button id="btnInspectorToggle" style="background: transparent; border: 1px solid #58a6ff; color: #58a6ff; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 0.8em;">Inspeccionar: ON</button>
      <button id="devPanelClose" style="background: transparent; border: none; color: #8b949e; cursor: pointer; font-size: 1.2em;">✖</button>
  </div>

  <div class="dev-panel-body">
      <div style="font-size: 0.85em; color: #8b949e;">Editando Elemento:</div>
      <div id="devTargetSelector" class="dev-target-badge">Ninguno</div>

      <div class="dev-control-group dev-feature-box dev-feature-box-highlight" id="devTextGroup" style="display: none;">
          <label style="color: var(--note-accent);">📝 Texto del Elemento</label>
          <input type="text" id="devElementText" class="dev-input" placeholder="Sobreescribir texto original...">
      </div>

      <div class="dev-control-group">
          <label>Fondo (Background)</label>
          <div class="dev-color-wrapper">
              <input type="color" id="devBgColor" class="dev-color-input">
              <input type="text" id="devBgText" class="dev-input" style="flex: 1;" placeholder="#000000 o rgba()">
          </div>
      </div>

      <div class="dev-control-group">
          <label>Color de Texto</label>
          <div class="dev-color-wrapper">
              <input type="color" id="devTextColor" class="dev-color-input">
              <input type="text" id="devTextText" class="dev-input" style="flex: 1;">
          </div>
      </div>

      <div class="dev-control-group">
          <label>Color de Borde (Global)</label>
          <div class="dev-color-wrapper">
              <input type="color" id="devBorderColor" class="dev-color-input">
              <input type="text" id="devBorderText" class="dev-input" style="flex: 1;" placeholder="Ej: #ffffff">
          </div>
      </div>

      <div class="dev-control-group">
          <label>Línea Inferior</label>
          <input type="text" id="devBorderBottom" class="dev-input" placeholder="Ej: 3px solid #b392f0">
      </div>

      <div class="dev-control-group">
          <label>Radio de Borde (Border Radius)</label>
          <input type="text" id="devBorderRadius" class="dev-input" placeholder="Ej: 12px">
      </div>

      <div class="dev-control-group">
          <label>Relleno (Padding)</label>
          <input type="text" id="devPadding" class="dev-input" placeholder="Ej: 15px 20px">
      </div>

      <div class="dev-control-group">
          <label>Tamaño de Fuente (Font Size)</label>
          <input type="text" id="devFontSize" class="dev-input" placeholder="Ej: 1.2em o 16px">
      </div>

      <div id="devAnimGroup" class="dev-control-group dev-feature-box" style="display: none;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: white;">
              <input type="checkbox" id="devAnimEnable">
              ✨ Animación al hacer Clic
          </label>
          <select id="devAnimType" class="dev-input" style="display: none; margin-top: 10px; width: 100%; cursor: pointer;">
              <option value="scale-down">Hundimiento Suave (Scale Down)</option>
              <option value="scale-up">Salto 3D (Scale Up)</option>
              <option value="pulse-glow">Resplandor Neón (Glow Pulse)</option>
          </select>
      </div>

      <button id="devBtnSave" class="dev-btn">💾 Guardar Cambios</button>
      <button id="devBtnResetTarget" class="dev-btn dev-btn-danger">🔄 Revertir Elemento</button>
      <button id="devBtnFactoryReset" class="dev-btn dev-btn-danger" style="margin-top: 5px; border-style: dashed;">⚠️ Borrar TODO (CSS y Textos)</button>
  </div>
</div>
`;

const SHADOW_SCOPED_CSS = `
:host {
  all: initial;
  font-family: Inter, system-ui, sans-serif;
}
.dev-hover-target {
  outline: 2px dashed #00d2ff !important;
  outline-offset: 2px !important;
  cursor: crosshair !important;
}
.dev-selected-target {
  outline: 3px solid #ff4d4d !important;
  outline-offset: 2px !important;
}
.dev-panel {
  position: fixed; right: 20px; top: 20px; width: 340px;
  background: rgba(13, 17, 23, 0.95); backdrop-filter: blur(10px);
  border: 1px solid rgba(88, 166, 255, 0.4); border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8); z-index: 999999;
  color: #c9d1d9; font-family: Inter, system-ui, sans-serif;
  display: none; flex-direction: column; overflow: hidden;
}
.dev-panel-header {
  background: #161b22; padding: 15px; border-bottom: 1px solid #30363d;
  display: flex; justify-content: space-between; align-items: center;
  font-weight: bold; color: white;
}
.dev-panel-body {
  padding: 15px; display: flex; flex-direction: column; gap: 15px;
  max-height: 75vh; overflow-y: auto;
}
.dev-target-badge {
  background: rgba(88, 166, 255, 0.1); color: #58a6ff;
  padding: 5px 10px; border-radius: 4px; font-family: monospace;
  font-size: 0.85em; word-break: break-all;
}
.dev-control-group { display: flex; flex-direction: column; gap: 5px; }
.dev-control-group label { font-size: 0.8em; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
.dev-input {
  background: #010409; border: 1px solid #30363d; color: white;
  padding: 8px; border-radius: 6px; font-family: monospace;
  outline: none; transition: 0.2s; width: 100%; box-sizing: border-box;
}
.dev-input:focus { border-color: #58a6ff; }
.dev-color-wrapper { display: flex; gap: 10px; align-items: center; }
.dev-color-input {
  width: 35px; height: 35px; border: none; border-radius: 50%;
  cursor: pointer; background: transparent; padding: 0;
}
.dev-feature-box {
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1);
  padding: 12px; border-radius: 8px; margin-top: 5px;
}
.dev-feature-box-highlight {
  background: rgba(88, 166, 255, 0.05); border: 1px dashed rgba(88, 166, 255, 0.3);
}
.dev-btn {
  background: #238636; color: white; border: none; padding: 10px;
  border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: 0.2s; text-align: center;
}
.dev-btn:hover { background: #2ea043; }
.dev-btn-success { background: #39ff14 !important; color: #000 !important; box-shadow: 0 0 15px rgba(57, 255, 20, 0.5); }
.dev-btn-danger { background: transparent; border: 1px solid #da3633; color: #da3633; margin-top: 0; }
.dev-btn-danger:hover { background: #da3633; color: white; }
`;

export function ensureDevModeShadowRoot() {
  let host = document.getElementById(DEV_SHADOW_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = DEV_SHADOW_HOST_ID;
    document.body.appendChild(host);
  }

  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });

  if (!root.getElementById('devmode-shadow-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'devmode-shadow-style';
    styleTag.textContent = SHADOW_SCOPED_CSS;
    root.appendChild(styleTag);
  }

  if (!root.getElementById('devEditorPanel')) {
    const container = document.createElement('div');
    container.id = 'devmode-shadow-container';
    container.innerHTML = LEGACY_MARKUP;
    root.appendChild(container);
  }

  return { host, root };
}

export function getDevModeRoot() {
  const host = document.getElementById(DEV_SHADOW_HOST_ID);
  if (!host?.shadowRoot) return null;
  return host.shadowRoot;
}
