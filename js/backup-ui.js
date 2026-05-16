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
    width: 360px;
    max-height: 70vh;
    overflow: auto;
    background: #0f141b;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    z-index: 3000;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    padding: 14px;
    color: white;
    display: none;
  `;

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <div>
        <div style="font-weight:800; color:#58a6ff;">⛑️ Auto-backups</div>
        <div style="font-size:0.85em; color:#8ba4b5;">Puntos de restauración locales</div>
      </div>
      <button id="backupPanelClose" style="background:transparent; border:none; color:#8ba4b5; cursor:pointer; font-size:1.2em;">×</button>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:10px;">
      <button id="btnCreatePoint" style="flex:1; background:#2d3446; color:#8ba4b5; border:1px solid rgba(255,255,255,0.08); padding:10px; border-radius:10px; cursor:pointer; font-weight:700;">Crear punto</button>
      <button id="btnRestoreLatest" style="flex:1; background:#58a6ff22; color:#58a6ff; border:1px solid rgba(88,166,255,0.35); padding:10px; border-radius:10px; cursor:pointer; font-weight:800;">Restaurar último</button>
    </div>

    <div style="margin: 10px 0; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px;">
      <div style="font-size:0.9em; color:#8ba4b5; margin-bottom:8px;">Historial</div>
      <ul id="backupList" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;"></ul>
    </div>

    <div id="backupErr" style="display:none; margin-top:10px; color:#ff7b72; font-weight:700;"></div>
    <div style="margin-top:10px; font-size:0.75em; color:#6e7681;">Se guardan snapshots al hacer cambios. Sincroniza Firestore cuando hay internet.</div>
  `;

  document.body.appendChild(panel);

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
    try {
      if (!state.currentUid) throw new Error('Sin sesión (uid)');
      const latest = await getLatestSnapshotForUid(state.currentUid);
      if (!latest) return;
      restoreStateFromSnapshot(latest.snapshot);
      notifyLocalBackupListChanged();
      window.dispatchEvent(new Event('stateChanged'));
      panel.style.display = 'none';
    } catch (e) {
      const msg = e?.message || String(e);
      panel.querySelector('#backupErr').textContent = msg;
      panel.querySelector('#backupErr').style.display = 'block';
    }
  };

  // Expose global toggle
  window.toggleBackupPanel = () => {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
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
    const btn = document.createElement('button');
    btn.id = 'backupLauncher';
    btn.className = 'alarm-floating-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 20px;
      background: #111a28;
      border: 1px solid rgba(88,166,255,0.5);
      color: #58a6ff;
      border-radius: 12px;
      width: 56px;
      height: 56px;
      font-size: 1.1em;
      cursor: pointer;
      z-index: 2500;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45);
    `;
    btn.textContent = '⛑️';
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

