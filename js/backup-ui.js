import { getLatestSnapshotForUid, getSnapshotsForUid, restoreSnapshot, deleteSnapshot } from './local-backup.js';
import { state, restoreStateFromSnapshot, notifyLocalBackupListChanged } from './store.js';

function ensureBackupPanel() {
  let panel = document.getElementById('backupPanel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'backupPanel';
  panel.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    width: 380px;
    max-width: 92vw;
    min-width: 320px;
    height: 66vh;
    max-height: 80vh;
    overflow: auto;
    resize: both;
    min-width: 320px;
    max-width: 92vw;
    min-height: 320px;
    max-height: 85vh;
    background: linear-gradient(180deg, var(--bg-surface), var(--bg-canvas));
    backdrop-filter: blur(12px);
    border: 1px solid var(--accent-sky-border);
    border-radius: var(--radius-lg);
    z-index: 3000;
    box-shadow: 0 10px 40px var(--shadow-color);
    padding: 14px;
    color: var(--text-primary);
    display: none;
    cursor: move;
  `;

  panel.innerHTML = `
    <div id="backupPanelHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3); padding:var(--space-2) 6px; border-radius:var(--radius-lg); background:var(--tint-neutral); border:1px solid var(--border-subtle);">
      <div>
        <div style="font-weight:800; color:var(--accent-sky); letter-spacing:0.2px;">⛑️ Backups & Restauración</div>
        <div style="font-size:var(--text-xs); color:var(--text-secondary);">Puntos locales (offline) + export/import manual</div>
      </div>
      <button id="backupPanelClose" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.2em;">×</button>
    </div>

    <div style="display:flex; gap:var(--space-3); margin-bottom:var(--space-3);">
      <button id="btnCreatePoint" style="flex:1; background:var(--bg-surface-raised); color:var(--text-primary); border:1px solid var(--border-subtle); padding:var(--space-3); border-radius:14px; cursor:pointer; font-weight:800; backdrop-filter: blur(10px);">Crear punto</button>
      <button id="btnRestoreLatest" style="flex:1; background:var(--tint-sky); color:var(--accent-sky); border:1px solid var(--accent-sky-border); padding:var(--space-3); border-radius:14px; cursor:pointer; font-weight:800; backdrop-filter: blur(10px);">Restaurar último</button>
    </div>

    <div style="margin: 10px 0; border-top:1px solid var(--border-subtle); padding-top:10px;">
      <div style="display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; margin-bottom:8px;">
        <div>
          <div style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:2px;">Exportación / Importación</div>
          <div style="font-size:var(--text-xs); color:var(--text-tertiary);">Incluye snapshot + metadatos de puntos</div>
        </div>
        <div style="font-size:var(--text-xs); color:var(--text-tertiary);">JSON</div>
      </div>

      <div style="display:flex; gap:var(--space-3); margin-bottom:var(--space-3);">
        <button id="btnExport" style="flex:1; background:var(--tint-neutral); color:var(--text-primary); border:1px solid var(--border-subtle); padding:var(--space-3); border-radius:14px; cursor:pointer; font-weight:800;">Descargar</button>
        <button id="btnImport" style="flex:1; background:var(--tint-error); color:var(--status-error); border:1px solid var(--tint-error); padding:var(--space-3); border-radius:14px; cursor:pointer; font-weight:800;">Importar</button>
      </div>

      <input type="file" id="backupImportFile" accept="application/json" style="display:none;" />
      <div style="margin-bottom:var(--space-3); font-size:var(--text-xs); color:var(--text-tertiary);">Importar reemplaza únicamente los puntos guardados en tu navegador (no toca Firestore directamente).</div>
    </div>

    <div style="margin: 10px 0; border-top:1px solid var(--border-subtle); padding-top:10px;">
      <div style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:8px;">Historial</div>
      <ul id="backupList" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;"></ul>
    </div>

    <div id="backupErr" style="display:none; margin-top:var(--space-3); color:var(--status-error); font-weight:700;"></div>
    <div id="backupOk" style="display:none; margin-top:var(--space-3); color:var(--status-success); font-weight:800;"></div>
    <div style="margin-top:var(--space-3); font-size:var(--text-xs); color:var(--text-tertiary);">Auto-snapshots cuando la app guarda. Sin internet se mantienen localmente.</div>
  `;

  document.body.appendChild(panel);

  // Soporte drag-and-drop (arrastrar desde la cabecera)
  const headerEl = panel.querySelector('#backupPanelHeader');
  if (headerEl) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    headerEl.style.cursor = 'move';

    const onMouseDown = (e) => {
      // Solo iniciar si el click es primario
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      // Para evitar NaN cuando no hay left/top
      startLeft = panel.offsetLeft || 20;
      startTop = panel.offsetTop || 70;
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = `${Math.max(0, startLeft + dx)}px`;
      panel.style.top = `${Math.max(0, startTop + dy)}px`;
      panel.style.right = 'auto';
      panel.style.width = panel.style.width || '380px';
    };

    const onMouseUp = () => { isDragging = false; };

    headerEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  panel.querySelector('#backupPanelClose').onclick = () => {
    panel.style.display = 'none';
  };

  panel.querySelector('#btnCreatePoint').onclick = async () => {
    panel.querySelector('#backupErr').style.display = 'none';
    try {
      // store.js will expose createManualRestorationPoint
      if (!window.createManualRestorationPoint) throw new Error('createManualRestorationPoint not ready');
      await window.createManualRestorationPoint();
      await refreshBackupList();
    } catch (e) {
      const msg = e?.message || String(e);
      panel.querySelector('#backupErr').textContent = msg;
      panel.querySelector('#backupErr').style.display = 'block';
    }
  };

  panel.querySelector('#btnRestoreLatest').onclick = async () => {
    panel.querySelector('#backupErr').style.display = 'none';
    panel.querySelector('#backupOk').style.display = 'none';
    try {
      if (!state.currentUid) throw new Error('Sin sesión (uid)');
      const latest = await getLatestSnapshotForUid(state.currentUid);
      if (!latest) return;
      restoreStateFromSnapshot(latest.snapshot);
      notifyLocalBackupListChanged();
      window.dispatchEvent(new Event('stateChanged'));
      panel.style.display = 'none';
      panel.querySelector('#backupOk').textContent = 'Restaurado ✅';
      panel.querySelector('#backupOk').style.display = 'block';
    } catch (e) {
      const msg = e?.message || String(e);
      panel.querySelector('#backupErr').textContent = msg;
      panel.querySelector('#backupErr').style.display = 'block';
    }
  };

  panel.querySelector('#btnExport').onclick = async () => {
    panel.querySelector('#backupErr').style.display = 'none';
    panel.querySelector('#backupOk').style.display = 'none';
    try {
      if (!state.currentUid) throw new Error('Sin sesión (uid)');

      const snaps = await getSnapshotsForUid(state.currentUid, 500);
      const payload = {
        type: 'taskify_local_backup_v1',
        uid: state.currentUid,
        exportedAt: new Date().toISOString(),
        snapshots: snaps
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taskify-backup-${state.currentUid}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      panel.querySelector('#backupOk').textContent = 'Export descargado ✅';
      panel.querySelector('#backupOk').style.display = 'block';
    } catch (e) {
      const msg = e?.message || String(e);
      panel.querySelector('#backupErr').textContent = msg;
      panel.querySelector('#backupErr').style.display = 'block';
    }
  };

  panel.querySelector('#btnImport').onclick = () => {
    if (!window.__devModeIsAuthenticated) {
      panel.querySelector('#backupErr').textContent = 'Importar requiere modo developer.';
      panel.querySelector('#backupErr').style.display = 'block';
      return;
    }
    panel.querySelector('#backupImportFile').click();
  };

  panel.querySelector('#backupImportFile').onchange = async (e) => {
    panel.querySelector('#backupErr').style.display = 'none';
    panel.querySelector('#backupOk').style.display = 'none';

    try {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data?.snapshots || !Array.isArray(data.snapshots)) throw new Error('JSON inválido: falta snapshots[]');

      const mod = await import('./local-backup.js');
      if (!mod.importSnapshotRecords) throw new Error('importSnapshotRecords no disponible');
      const count = await mod.importSnapshotRecords(data.snapshots);

      panel.querySelector('#backupOk').textContent = `Import completado: +${count} puntos ✅`;
      panel.querySelector('#backupOk').style.display = 'block';

      await refreshBackupList();
      notifyLocalBackupListChanged();
    } catch (err) {
      const msg = err?.message || String(err);
      panel.querySelector('#backupErr').textContent = msg;
      panel.querySelector('#backupErr').style.display = 'block';
    } finally {
      // reset file input
      panel.querySelector('#backupImportFile').value = '';
    }
  };


  // Expose global toggle
  window.toggleBackupPanel = () => {
    const current = panel.style.display;
    const shouldOpen = current !== 'flex';
    panel.style.display = shouldOpen ? 'flex' : 'none';

    const launcher = document.getElementById('backupLauncher');
    if (launcher) {
      launcher.classList.toggle('backup-launcher-open', shouldOpen);
      launcher.setAttribute('aria-pressed', shouldOpen ? 'true' : 'false');
      launcher.setAttribute('title', shouldOpen ? 'Cerrar Backups' : 'Abrir Backups');
    }
  };

  return panel;
}

async function refreshBackupList() {
  const panel = ensureBackupPanel();
  const ul = panel.querySelector('#backupList');
  ul.innerHTML = '';

  if (!state.currentUid) {
    ul.innerHTML = `<li style="color:var(--text-secondary); font-size:var(--text-sm);">Inicia sesión para ver backups.</li>`;
    return;
  }

  const snaps = await getSnapshotsForUid(state.currentUid, 25);
  if (!snaps || snaps.length === 0) {
    ul.innerHTML = `<li style="color:var(--text-secondary); font-size:var(--text-sm);">Aún no hay puntos de restauración.</li>`;
    return;
  }

  snaps.forEach((snap) => {
    const li = document.createElement('li');
    li.style.cssText = `
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:var(--radius-lg);
      padding:var(--space-3);
      display:flex;
      flex-direction:column;
      gap:8px;
    `;

    li.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-3);">
        <div>
          <div style="font-weight:800; color:var(--text-primary); font-size:var(--text-sm);">${new Date(snap.createdAt).toLocaleString('es-ES')}</div>
          <div style="font-size:var(--text-xs); color:var(--text-secondary);">${snap.reason || 'auto'} • ${Math.max(0, Math.round((snap.sizeBytes||0)/1024))} KB</div>
        </div>
        <button style="background:transparent; border:none; color:var(--status-error); cursor:pointer; font-weight:800;" title="Borrar">🗑️</button>
      </div>

      <div style="display:flex; gap:8px;">
        <button style="flex:1; background:var(--bg-surface-raised); color:var(--text-secondary); border:1px solid var(--border-subtle); padding:var(--space-2) 10px; border-radius:var(--radius-md); cursor:pointer; font-weight:800;">Restaurar</button>
        <button style="width:44px; background:transparent; color:var(--text-secondary); border:1px solid var(--border-subtle); padding:var(--space-2) 10px; border-radius:var(--radius-md); cursor:pointer; font-weight:800;">↩</button>
      </div>
    `;

    const [restoreBtn, deleteBtn] = [li.querySelector('button:nth-child(2)'), li.querySelector('button[title]')];

    // Restore
    li.querySelectorAll('button').forEach((b) => {
      if (b.textContent.trim().toLowerCase() === 'restaurar') {
        b.onclick = async () => {
          const rec = await restoreSnapshot(snap);
          restoreStateFromSnapshot(rec);
          window.dispatchEvent(new Event('stateChanged'));
          panel.style.display = 'none';
          notifyLocalBackupListChanged();
        };
      }
      if (b.title === 'Borrar') {
        b.onclick = async () => {
          await deleteSnapshot(snap.id);
          await refreshBackupList();
          notifyLocalBackupListChanged();
        };
      }
    });

    ul.appendChild(li);
  });
}

export function initBackupUI() {
  // F10: export/restauración disponible para cualquier usuario autenticado (GDPR Art.20).
  if (!state.currentUid) {
    console.log('[backup-ui] sin sesión; UI oculta');
    return;
  }

  // Expose manual point creator to avoid circular deps in UI


  // store.js exports createManualRestorationPoint (named export)
  // We attach it to window so the UI buttons can call it without relying on module binding.
  window.createManualRestorationPoint = async (reason = 'manual') => {
    const mod = await import('./store.js');
    return await mod.createManualRestorationPoint(reason);
  };

  ensureBackupPanel();

  // Floating launcher button
  if (!document.getElementById('backupLauncher')) {
    const currentBtnSize = 56;

    // Mantener consistencia con el theme del resto de la app
    // (Si existe, intenta usar variable CSS, pero funciona igual con fallback)
    const accent = 'var(--secondary)';

    

    const btn = document.createElement('button');
    btn.id = 'backupLauncher';
    btn.className = 'alarm-floating-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 58px;
      height: 58px;
      border-radius: var(--radius-xl);
      border: 1px solid var(--accent-sky-border);
      background: linear-gradient(160deg, var(--bg-surface), var(--bg-canvas));
      color: var(--accent-sky);
      font-size: 1.2em;
      cursor: pointer;
      z-index: 2500;
      box-shadow: 0 10px 34px var(--shadow-color), inset 0 1px 0 var(--border-subtle);
      backdrop-filter: blur(8px);
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 180ms ease;
    `;
    btn.textContent = '⛑️';
    btn.setAttribute('aria-label', 'Abrir panel de backups');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('title', 'Abrir Backups');

    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px) scale(1.03)';
      btn.style.borderColor = 'var(--accent-sky)';
      btn.style.boxShadow = '0 14px 40px var(--shadow-color), 0 0 20px var(--glow-sky)';
      btn.style.color = 'var(--accent-sky)';
    };
    btn.onmouseleave = () => {
      const isOpen = btn.classList.contains('backup-launcher-open');
      btn.style.transform = isOpen ? 'scale(1.02)' : 'none';
      btn.style.borderColor = isOpen ? 'var(--accent-sky)' : 'var(--accent-sky-border)';
      btn.style.boxShadow = isOpen
        ? '0 16px 42px var(--shadow-color), 0 0 24px var(--glow-sky)'
        : '0 10px 34px var(--shadow-color), inset 0 1px 0 var(--border-subtle)';
      btn.style.color = isOpen ? 'var(--text-primary)' : 'var(--accent-sky)';
    };

    btn.onclick = () => window.toggleBackupPanel?.();
    document.body.appendChild(btn);
  }

  refreshBackupList().catch(() => {});
  window.addEventListener('stateChanged', () => {
    // Keep list updated only when panel is visible
    const panel = document.getElementById('backupPanel');
    if (panel && panel.style.display !== 'none') refreshBackupList().catch(() => {});
  });

  // Initial list
  notifyLocalBackupListChanged();
}

