const DEV_SHADOW_HOST_ID = 'devmode-shadow-host';

const LEGACY_MARKUP = `
<div id="devLoginModal" style="display: none; position: fixed; inset: 0; z-index: 9999999; background: var(--overlay-strong); align-items: center; justify-content: center; backdrop-filter: blur(10px);">
  <div style="background: var(--bg-surface); padding: 30px; border-radius: var(--radius-lg); border: 1px solid var(--accent-sky); width: 300px; box-shadow: 0 0 50px var(--tint-sky);">
      <h2 style="color: var(--accent-sky); margin-top: 0; text-align: center;">⚡ Modo Developer</h2>
      <input type="text" id="devUser" placeholder="Usuario" style="width: 100%; margin-bottom: var(--space-4); padding: var(--space-3); background: var(--bg-inset); border: 1px solid var(--border-subtle); color: var(--text-primary); border-radius: var(--radius-sm); box-sizing: border-box;">
      <input type="password" id="devPass" placeholder="Contraseña" style="width: 100%; margin-bottom: var(--space-5); padding: var(--space-3); background: var(--bg-inset); border: 1px solid var(--border-subtle); color: var(--text-primary); border-radius: var(--radius-sm); box-sizing: border-box;">
      <div style="display: flex; gap: var(--space-3);">
          <button id="devLoginSubmit" style="flex: 1; background: var(--accent-sky); color: var(--text-on-accent); border: none; padding: var(--space-3); border-radius: var(--radius-sm); font-weight: bold; cursor: pointer;">Ingresar</button>
          <button id="devLoginCancel" style="flex: 1; background: transparent; color: var(--text-tertiary); border: 1px solid var(--border-subtle); padding: var(--space-3); border-radius: var(--radius-sm); cursor: pointer;">Cancelar</button>
      </div>
  </div>
</div>

<div id="devTreeNavigator" class="dev-tree-panel" style="display: none;" role="complementary" aria-label="Tree Navigator">
  <div class="dev-tree-header">
      <span>🌳 Tree Navigator</span>
      <button id="devTreeRefresh" class="dev-tree-icon-btn" title="Refrescar árbol">↻</button>
  </div>
  <div id="devTreeContent" class="dev-tree-content"></div>
</div>

<div id="devEditorPanel" class="dev-panel" role="dialog" aria-label="DevMode UI Builder">
  <div class="dev-panel-header">
      <span>🛠️ UI Builder</span>
      <button id="btnInspectorToggle" style="background: transparent; border: 1px solid var(--accent-sky); color: var(--accent-sky); border-radius: var(--radius-sm); cursor: pointer; padding: 4px 8px; font-size: var(--text-xs);">Inspeccionar: ON</button>
      <button id="devPanelClose" style="background: transparent; border: none; color: var(--text-tertiary); cursor: pointer; font-size: 1.2em;">✖</button>
  </div>

  <div class="dev-panel-body">
      <div style="font-size: var(--text-xs); color: var(--text-tertiary);">Editando Elemento:</div>
      <div id="devTargetSelector" class="dev-target-badge">Ninguno</div>

      <div class="dev-control-group dev-feature-box dev-feature-box-highlight" id="devTextGroup" style="display: none;">
          <label style="color: var(--accent-sky);">📝 Texto del Elemento</label>
          <input type="text" id="devElementText" class="dev-input" placeholder="Sobreescribir texto original...">
          <button type="button" id="devDataBindingBtn" class="dev-btn dev-btn-secondary dev-pill-btn">🔗 Vincular Dato Dinámico</button>
          <div id="devDataBindingPopover" class="dev-popover" style="display: none;">
              <div class="dev-popover-title">Variables dinámicas</div>
              <div id="devDataBindingList" class="dev-binding-list"></div>
              <div class="dev-popover-row">
                  <input type="text" id="devBindingManualInput" class="dev-input" placeholder="Ej: currentUser.name">
                  <button type="button" id="devBindingApplyManual" class="dev-btn dev-btn-secondary">Aplicar</button>
              </div>
              <button type="button" id="devBindingClear" class="dev-btn dev-btn-danger">Quitar vínculo</button>
          </div>
      </div>

      <div class="dev-control-group">
          <label>Fondo (Background)</label>
          <div class="dev-color-wrapper">
              <input type="color" id="devBgColor" class="dev-color-input">
              <input type="text" id="devBgText" class="dev-input" style="flex: 1;" placeholder="#RRGGBB o rgba()">
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
              <input type="text" id="devBorderText" class="dev-input" style="flex: 1;" placeholder="Ej: var(--text-primary)">
          </div>
      </div>

      <div class="dev-control-group">
          <label>Línea Inferior</label>
          <input type="text" id="devBorderBottom" class="dev-input" placeholder="Ej: 3px solid var(--accent-primary)">
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

      <div id="devFlexGroup" class="dev-control-group dev-feature-box" style="display: none;">
          <label style="color: var(--accent-sky);">📐 Layout Flex</label>

          <div class="dev-flex-row">
              <span class="dev-flex-caption">Dirección</span>
              <div class="dev-segmented" id="devFlexDirectionGroup">
                  <button type="button" class="dev-seg-btn" data-flex-key="flexDirection" data-flex-value="row" title="Fila">↔</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="flexDirection" data-flex-value="column" title="Columna">↕</button>
              </div>
          </div>

          <div class="dev-flex-row">
              <span class="dev-flex-caption">Wrap</span>
              <div class="dev-segmented" id="devFlexWrapGroup">
                  <button type="button" class="dev-seg-btn" data-flex-key="flexWrap" data-flex-value="nowrap" title="Sin salto">⤬</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="flexWrap" data-flex-value="wrap" title="Con salto">⤿</button>
              </div>
          </div>

          <div class="dev-flex-row">
              <span class="dev-flex-caption">Justify</span>
              <div class="dev-segmented dev-segmented-grid" id="devFlexJustifyGroup">
                  <button type="button" class="dev-seg-btn" data-flex-key="justifyContent" data-flex-value="flex-start" title="Start">⟸</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="justifyContent" data-flex-value="center" title="Center">≡</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="justifyContent" data-flex-value="flex-end" title="End">⟹</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="justifyContent" data-flex-value="space-between" title="Between">⟷</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="justifyContent" data-flex-value="space-around" title="Around">⟺</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="justifyContent" data-flex-value="space-evenly" title="Evenly">☰</button>
              </div>
          </div>

          <div class="dev-flex-row">
              <span class="dev-flex-caption">Align</span>
              <div class="dev-segmented dev-segmented-grid" id="devFlexAlignGroup">
                  <button type="button" class="dev-seg-btn" data-flex-key="alignItems" data-flex-value="flex-start" title="Start">⇤</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="alignItems" data-flex-value="center" title="Center">⋮</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="alignItems" data-flex-value="flex-end" title="End">⇥</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="alignItems" data-flex-value="stretch" title="Stretch">⬍</button>
                  <button type="button" class="dev-seg-btn" data-flex-key="alignItems" data-flex-value="baseline" title="Baseline">▁</button>
              </div>
          </div>

          <div class="dev-control-group" style="margin-top: 8px;">
              <label>Gap</label>
              <input type="text" id="devFlexGap" class="dev-input" placeholder="Ej: 8px o 1rem">
          </div>
      </div>

      <div id="devAnimGroup" class="dev-control-group dev-feature-box" style="display: none;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-primary);">
              <input type="checkbox" id="devAnimEnable">
              ✨ Animación al hacer Clic
          </label>
          <select id="devAnimType" class="dev-input" style="display: none; margin-top: var(--space-3); width: 100%; cursor: pointer;">
              <option value="scale-down">Hundimiento Suave (Scale Down)</option>
              <option value="scale-up">Salto 3D (Scale Up)</option>
              <option value="pulse-glow">Resplandor Neón (Glow Pulse)</option>
          </select>
      </div>

      <div id="devSaveStatus" class="dev-save-status is-idle">Guardado</div>
      <button id="devBtnSave" class="dev-btn">💾 Guardar Cambios</button>
      <button id="devBtnResetTarget" class="dev-btn dev-btn-danger">🔄 Revertir Elemento</button>
      <button id="devBtnFactoryReset" class="dev-btn dev-btn-danger" style="margin-top: var(--space-1); border-style: dashed;">⚠️ Borrar TODO (CSS y Textos)</button>
  </div>
</div>
`;

const SHADOW_SCOPED_CSS = `
:host {
  all: initial;
  font-family: Inter, system-ui, sans-serif;
}
.dev-hover-target {
  outline: 2px dashed var(--accent-sky) !important;
  outline-offset: 2px !important;
  cursor: crosshair !important;
}
.dev-selected-target {
  outline: 3px solid var(--status-error) !important;
  outline-offset: 2px !important;
}
.dev-panel {
  position: fixed; right: 20px; top: 20px; width: 340px;
  background: var(--bg-surface); backdrop-filter: blur(10px);
  border: 1px solid var(--glow-sky); border-radius: var(--radius-lg);
  box-shadow: 0 20px 50px var(--shadow-color); z-index: 999999;
  color: var(--text-primary); font-family: Inter, system-ui, sans-serif;
  display: none; flex-direction: column; overflow: hidden;
}
.dev-panel-header {
  background: var(--bg-surface); padding: var(--space-4); border-bottom: 1px solid var(--border-subtle);
  display: flex; justify-content: space-between; align-items: center;
  font-weight: bold; color: var(--text-primary);
}
.dev-panel-body {
  padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);
  max-height: 75vh; overflow-y: auto;
}
.dev-target-badge {
  background: var(--tint-sky); color: var(--accent-sky);
  padding: var(--space-1) 10px; border-radius: var(--radius-sm); font-family: monospace;
  font-size: var(--text-xs); word-break: break-all;
}
.dev-control-group { display: flex; flex-direction: column; gap: var(--space-1); }
.dev-control-group label { font-size: var(--text-xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; }
.dev-input {
  background: var(--bg-inset); border: 1px solid var(--border-subtle); color: var(--text-primary);
  padding: var(--space-2); border-radius: var(--radius-sm); font-family: monospace;
  outline: none; transition: 0.2s; width: 100%; box-sizing: border-box;
}
.dev-input:focus { border-color: var(--accent-sky); }
.dev-color-wrapper { display: flex; gap: var(--space-3); align-items: center; }
.dev-color-input {
  width: 35px; height: 35px; border: none; border-radius: 50%;
  cursor: pointer; background: transparent; padding: 0;
}
.dev-feature-box {
  background: var(--tint-neutral); border: 1px solid var(--border-subtle);
  padding: var(--space-3); border-radius: var(--radius-md); margin-top: var(--space-1);
}
.dev-feature-box-highlight {
  background: var(--tint-sky); border: 1px dashed var(--tint-sky);
}
.dev-flex-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dev-flex-caption {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.dev-segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.dev-segmented-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.dev-seg-btn {
  border: 1px solid var(--border-subtle);
  background: var(--bg-canvas);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  min-height: 30px;
  cursor: pointer;
  font-weight: 700;
  transition: 0.2s ease;
}
.dev-seg-btn:hover {
  border-color: var(--accent-sky);
  color: var(--accent-sky);
}
.dev-seg-btn.is-active {
  background: var(--tint-sky);
  border-color: var(--accent-sky);
  color: var(--accent-sky);
  box-shadow: inset 0 0 0 1px var(--accent-sky-border);
}
.dev-popover {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  background: var(--bg-inset);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dev-popover-title {
  font-size: var(--text-xs);
  color: var(--accent-sky);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 700;
}
.dev-binding-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
}
.dev-binding-item {
  border: 1px solid var(--border-subtle);
  background: var(--bg-canvas);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  min-height: 30px;
  cursor: pointer;
  text-align: left;
  padding: var(--space-2) 8px;
  font-size: var(--text-xs);
}
.dev-binding-item:hover {
  border-color: var(--accent-sky);
  color: var(--accent-sky);
}
.dev-popover-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.dev-pill-btn {
  margin-top: 6px;
  border-radius: 999px;
}
.dev-tree-panel {
  position: fixed;
  left: 20px;
  top: 20px;
  width: 280px;
  max-height: 80vh;
  background: var(--bg-surface);
  border: 1px solid var(--glow-sky);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 50px var(--shadow-color);
  z-index: 999998;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.dev-tree-header {
  background: var(--bg-surface);
  padding: var(--space-3) 12px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
}
.dev-tree-content {
  padding: var(--space-3);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dev-tree-node {
  border: 1px solid var(--border-subtle);
  background: var(--bg-canvas);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  cursor: pointer;
  font-size: var(--text-xs);
  color: var(--text-primary);
}
.dev-tree-node:hover {
  border-color: var(--accent-sky);
  color: var(--accent-sky);
}
.dev-tree-node.is-active {
  border-color: var(--accent-sky);
  background: var(--tint-sky);
  color: var(--accent-sky);
}
.dev-tree-icon-btn {
  border: 1px solid var(--border-subtle);
  background: var(--bg-canvas);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  min-width: 28px;
  min-height: 28px;
  cursor: pointer;
}
.dev-save-status {
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: var(--space-2) 10px;
  font-size: var(--text-xs);
  font-weight: 700;
  text-align: center;
  color: var(--text-tertiary);
  background: var(--tint-neutral);
  margin-top: 8px;
}
.dev-save-status.is-syncing {
  color: var(--accent-sky);
  border-color: var(--accent-sky);
  animation: devPulse 1s ease-in-out infinite;
}
.dev-save-status.is-saved {
  color: var(--status-success);
  border-color: var(--status-success);
  background: var(--tint-success);
}
@keyframes devPulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
.dev-btn {
  background: var(--status-success); color: var(--text-primary); border: none; padding: var(--space-3);
  border-radius: var(--radius-sm); font-weight: bold; cursor: pointer; margin-top: var(--space-3); transition: 0.2s; text-align: center;
}
.dev-btn:hover { background: var(--status-success); }
.dev-btn-secondary {
  background: transparent;
  border: 1px solid var(--accent-sky);
  color: var(--accent-sky);
}
.dev-btn-secondary:hover {
  background: var(--tint-sky);
}
.dev-btn-success { background: var(--status-success) !important; color: var(--text-on-accent) !important; box-shadow: 0 0 15px var(--glow-success); }
.dev-btn-danger { background: transparent; border: 1px solid var(--status-error); color: var(--status-error); margin-top: 0; }
.dev-btn-danger:hover { background: var(--status-error); color: var(--text-primary); }
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
