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
    background: linear-gradient(180deg, rgba(18,24,39,0.98), rgba(10,14,24,0.98));
    backdrop-filter: blur(12px);
    border: 1px solid rgba(88,166,255,0.28);
    border-radius: 12px;
    z-index: 3000;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    padding: 14px;
    color: white;
    display: none;
    cursor: move;
  `;

  panel.innerHTML = `
    <div id="backupPanelHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:6px 6px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);">
      <div>
        <div style="font-weight:900; color:#58a6ff; letter-spacing:0.2px;">⛑️ Backups & Restauración</div>
        <div style="font-size:0.85em; color:#8ba4b5;">Puntos locales (offline) + export/import manual</div>
      </div>
      <button id="backupPanelClose" style="background:transparent; border:none; color:#8ba4b5; cursor:pointer; font-size:1.2em;">×</button>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:10px;">
      <button id="btnCreatePoint" style="flex:1; background:rgba(55, 65, 81, 0.55); color:#e5e7eb; border:1px solid rgba(255,255,255,0.10); padding:10px; border-radius:14px; cursor:pointer; font-weight:850; backdrop-filter: blur(10px);">Crear punto</button>
      <button id="btnRestoreLatest" style="flex:1; background:rgba(88,166,255,0.16); color:#9ecbff; border:1px solid rgba(88,166,255,0.35); padding:10px; border-radius:14px; cursor:pointer; font-weight:950; backdrop-filter: blur(10px);">Restaurar último</button>
    </div>

    <div style="margin: 10px 0; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:8px;">
        <div>
          <div style="font-size:0.9em; color:#8ba4b5; margin-bottom:2px;">Exportación / Importación</div>
          <div style="font-size:0.75em; color:#6e7681;">Incluye snapshot + metadatos de puntos</div>
        </div>
        <div style="font-size:0.75em; color:#6e7681;">JSON</div>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <button id="btnExport" style="flex:1; background:rgba(255,255,255,0.04); color:#e5e7eb; border:1px solid rgba(255,255,255,0.10); padding:10px; border-radius:14px; cursor:pointer; font-weight:900;">Descargar</button>
        <button id="btnImport" style="flex:1; background:rgba(255,77,77,0.12); color:#ff9aa2; border:1px solid rgba(255,77,77,0.30); padding:10px; border-radius:14px; cursor:pointer; font-weight:900;">Importar</button>
      </div>

      <input type="file" id="backupImportFile" accept="application/json" style="display:none;" />
      <div style="margin-bottom:10px; font-size:0.75em; color:#6e7681;">Importar reemplaza únicamente los puntos guardados en tu navegador (no toca Firestore directamente).</div>
    </div>

    <div style="margin: 10px 0; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
      <div style="font-size:0.9em; color:#8ba4b5; margin-bottom:8px;">Historial</div>
      <ul id="backupList" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;"></ul>
    </div>

    <div id="backupErr" style="display:none; margin-top:10px; color:#ff7b72; font-weight:700;"></div>
    <div id="backupOk" style="display:none; margin-top:10px; color:#39ff14; font-weight:800;"></div>
    <div style="margin-top:10px; font-size:0.75em; color:#6e7681;">Auto-snapshots cuando la app guarda. Sin internet se mantienen localmente.</div>
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
    ul.innerHTML = `<li style="color:#8ba4b5; font-size:0.9em;">Inicia sesión para ver backups.</li>`;
    return;
  }

  const snaps = await getSnapshotsForUid(state.currentUid, 25);
  if (!snaps || snaps.length === 0) {
    ul.innerHTML = `<li style="color:#8ba4b5; font-size:0.9em;">Aún no hay puntos de restauración.</li>`;
    return;
  }

  snaps.forEach((snap) => {
    const li = document.createElement('li');
    li.style.cssText = `
      background:#111a28;
      border:1px solid rgba(255,255,255,0.08);
      border-radius:12px;
      padding:10px;
      display:flex;
      flex-direction:column;
      gap:8px;
    `;

    li.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <div style="font-weight:800; color:white; font-size:0.95em;">${new Date(snap.createdAt).toLocaleString('es-ES')}</div>
          <div style="font-size:0.8em; color:#8ba4b5;">${snap.reason || 'auto'} • ${Math.max(0, Math.round((snap.sizeBytes||0)/1024))} KB</div>
        </div>
        <button style="background:transparent; border:none; color:#ff7b72; cursor:pointer; font-weight:900;" title="Borrar">🗑️</button>
      </div>

      <div style="display:flex; gap:8px;">
        <button style="flex:1; background:#2d3446; color:#8ba4b5; border:1px solid rgba(255,255,255,0.08); padding:8px 10px; border-radius:10px; cursor:pointer; font-weight:800;">Restaurar</button>
        <button style="width:44px; background:transparent; color:#8ba4b5; border:1px solid rgba(255,255,255,0.08); padding:8px 10px; border-radius:10px; cursor:pointer; font-weight:800;">↩</button>
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
  // DEV-MODE BLINDING: only activate once developer mode is authenticated.
  // (Avoid exposing backup controls to normal users.)
  if (!window.__devModeIsAuthenticated) {
    // Para depuración: aseguramos que el módulo sí cargó
    // eslint-disable-next-line no-console
    console.log('[backup-ui] devmode not authenticated yet; UI hidden');
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
      border-radius: 16px;
      border: 1px solid rgba(88,166,255,0.38);
      background: linear-gradient(160deg, rgba(18,28,45,0.96), rgba(8,14,26,0.96));
      color: #9ecbff;
      font-size: 1.2em;
      cursor: pointer;
      z-index: 2500;
      box-shadow: 0 10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
      backdrop-filter: blur(8px);
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 180ms ease;
    `;
    btn.textContent = '⛑️';
    btn.setAttribute('aria-label', 'Abrir panel de backups');
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('title', 'Abrir Backups');

    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px) scale(1.03)';
      btn.style.borderColor = 'rgba(88,166,255,0.75)';
      btn.style.boxShadow = '0 14px 40px rgba(0,0,0,0.55), 0 0 20px rgba(88,166,255,0.18)';
      btn.style.color = '#c7e2ff';
    };
    btn.onmouseleave = () => {
      const isOpen = btn.classList.contains('backup-launcher-open');
      btn.style.transform = isOpen ? 'scale(1.02)' : 'none';
      btn.style.borderColor = isOpen ? 'rgba(88,166,255,0.9)' : 'rgba(88,166,255,0.38)';
      btn.style.boxShadow = isOpen
        ? '0 16px 42px rgba(0,0,0,0.6), 0 0 24px rgba(88,166,255,0.22)'
        : '0 10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)';
      btn.style.color = isOpen ? '#e8f3ff' : '#9ecbff';
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

