export function LegacyDevModeMarkup() {
  return (
    <>
      <div
        id="devLoginModal"
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999999,
          background: 'rgba(0,0,0,0.9)',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            background: '#161b22',
            padding: 30,
            borderRadius: 12,
            border: '1px solid #58a6ff',
            width: 300,
            boxShadow: '0 0 50px rgba(88, 166, 255, 0.2)',
          }}
        >
          <h2 style={{ color: '#58a6ff', marginTop: 0, textAlign: 'center' }}>⚡ Modo Developer</h2>
          <input
            type="text"
            id="devUser"
            placeholder="Usuario"
            style={{
              width: '100%',
              marginBottom: 15,
              padding: 10,
              background: '#010409',
              border: '1px solid #30363d',
              color: 'white',
              borderRadius: 6,
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            id="devPass"
            placeholder="Contraseña"
            style={{
              width: '100%',
              marginBottom: 20,
              padding: 10,
              background: '#010409',
              border: '1px solid #30363d',
              color: 'white',
              borderRadius: 6,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => (window as any).authenticateDev?.()}
              style={{
                flex: 1,
                background: '#58a6ff',
                color: '#000',
                border: 'none',
                padding: 10,
                borderRadius: 6,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => (window as any).closeDevLogin?.()}
              style={{
                flex: 1,
                background: 'transparent',
                color: '#8b949e',
                border: '1px solid #30363d',
                padding: 10,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <div id="devEditorPanel" className="dev-panel">
        <div className="dev-panel-header">
          <span>🛠️ UI Builder</span>
          <button
            type="button"
            onClick={() => (window as any).toggleInspectorMode?.()}
            id="btnInspectorToggle"
            style={{
              background: 'transparent',
              border: '1px solid #58a6ff',
              color: '#58a6ff',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '0.8em',
            }}
          >
            Inspeccionar: ON
          </button>
          <button
            type="button"
            onClick={() => (window as any).closeDevPanel?.()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: '1.2em',
            }}
          >
            ✖
          </button>
        </div>

        <div className="dev-panel-body">
          <div style={{ fontSize: '0.85em', color: '#8b949e' }}>Editando Elemento:</div>
          <div id="devTargetSelector" className="dev-target-badge">
            Ninguno
          </div>

          <div
            className="dev-control-group dev-feature-box dev-feature-box-highlight"
            id="devTextGroup"
            style={{ display: 'none' }}
          >
            <label style={{ color: 'var(--note-accent)' }}>📝 Texto del Elemento</label>
            <input
              type="text"
              id="devElementText"
              className="dev-input"
              placeholder="Sobreescribir texto original..."
            />
          </div>

          <div className="dev-control-group">
            <label>Fondo (Background)</label>
            <div className="dev-color-wrapper">
              <input type="color" id="devBgColor" className="dev-color-input" />
              <input
                type="text"
                id="devBgText"
                className="dev-input"
                style={{ flex: 1 }}
                placeholder="#000000 o rgba()"
              />
            </div>
          </div>

          <div className="dev-control-group">
            <label>Color de Texto</label>
            <div className="dev-color-wrapper">
              <input type="color" id="devTextColor" className="dev-color-input" />
              <input type="text" id="devTextText" className="dev-input" style={{ flex: 1 }} />
            </div>
          </div>

          <div className="dev-control-group">
            <label>Color de Borde (Global)</label>
            <div className="dev-color-wrapper">
              <input type="color" id="devBorderColor" className="dev-color-input" />
              <input
                type="text"
                id="devBorderText"
                className="dev-input"
                style={{ flex: 1 }}
                placeholder="Ej: #ffffff"
              />
            </div>
          </div>

          <div className="dev-control-group">
            <label>Línea Inferior</label>
            <input type="text" id="devBorderBottom" className="dev-input" placeholder="Ej: 3px solid #b392f0" />
          </div>

          <div className="dev-control-group">
            <label>Radio de Borde (Border Radius)</label>
            <input type="text" id="devBorderRadius" className="dev-input" placeholder="Ej: 12px" />
          </div>

          <div className="dev-control-group">
            <label>Relleno (Padding)</label>
            <input type="text" id="devPadding" className="dev-input" placeholder="Ej: 15px 20px" />
          </div>

          <div className="dev-control-group">
            <label>Tamaño de Fuente (Font Size)</label>
            <input type="text" id="devFontSize" className="dev-input" placeholder="Ej: 1.2em o 16px" />
          </div>

          <div id="devAnimGroup" className="dev-control-group dev-feature-box" style={{ display: 'none' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'white' }}>
              <input type="checkbox" id="devAnimEnable" />
              ✨ Animación al hacer Clic
            </label>
            <select
              id="devAnimType"
              className="dev-input"
              style={{ display: 'none', marginTop: 10, width: '100%', cursor: 'pointer' }}
            >
              <option value="scale-down">Hundimiento Suave (Scale Down)</option>
              <option value="scale-up">Salto 3D (Scale Up)</option>
              <option value="pulse-glow">Resplandor Neón (Glow Pulse)</option>
            </select>
          </div>

          <button id="devBtnSave" className="dev-btn" type="button" onClick={() => (window as any).applyAndSaveDevStyles?.()}>
            💾 Guardar Cambios
          </button>
          <button className="dev-btn dev-btn-danger" type="button" onClick={() => (window as any).resetTargetStyles?.()}>
            🔄 Revertir Elemento
          </button>
          <button
            className="dev-btn dev-btn-danger"
            type="button"
            style={{ marginTop: 5, borderStyle: 'dashed' }}
            onClick={() => (window as any).factoryResetStyles?.()}
          >
            ⚠️ Borrar TODO (CSS y Textos)
          </button>
        </div>
      </div>
    </>
  )
}
