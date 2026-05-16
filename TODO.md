# TODO - Auto-backups y puntos de restauración (offline/online)

## Paso 1: Diseño e integración (ya investigado)
- [x] Revisar `js/store.js`, `js/app.js` y componentes que mutan `state`.
- [x] Identificar sitios de escritura: `state.*.push/splice/...`, `saveDataToCloud()`.

## Paso 2: Capa de backups local (implementación)
- [x] Crear `js/local-backup.js` (IndexedDB) para snapshots/restoration points.

## Paso 3: Motor de “restoration points” y auto-snapshots
- [x] Actualizar `js/store.js`:
  - [x] Agregar `scheduleLocalSnapshot()` (debounced) y `createManualRestorationPoint()`.
  - [x] Agregar `restoreStateFromSnapshot()`.

## Paso 4: Persistencia de cambios offline-first
- [x] Modificar `saveDataToCloud()` para que también dispare snapshot local (offline nunca pierde cambios).

## Paso 5: Evitar que la nube sobrescriba cambios locales al reconectar
- [x] Actualizar `initCloudData()` para:
  - [x] Cargar primero el último snapshot local.
  - [x] Ignorar onSnapshot si `localVersion` local es más nuevo que el remoto.

## Paso 6: Panel de UI para backups/restauración
- [x] Crear UI en `js/backup-ui.js`.
- [x] Incluir `js/backup-ui.js` en `index.html`.

## Paso 7: Hooks en mutaciones
- [ ] Centralizar “cada cambio” asegurando que **siempre** se llame a `saveDataToCloud()` (ya ocurre en la mayoría de acciones).
- [ ] Para cambios que mutan `state` sin llamar `saveDataToCloud()`, agregar llamadas mínimas a `saveDataToCloud()`.

## Paso 8: Validación
- [ ] Probar flujo offline/online:
  1) Editar offline
  2) Recargar pantalla offline
  3) Reconectar online
  4) Confirmar que no se pierden cambios offline.

