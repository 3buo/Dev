# Firebase Backup System - Documentation

## Overview

This backup system provides comprehensive data protection for your Firebase platform with:
- **Local Storage Backups**: Redundant copies stored in browser localStorage
- **Firebase Restore Points**: Timestamped snapshots of database state
- **Detailed Logging**: Complete audit trail of all backup operations
- **Automatic Triggers**: Auto-backup after critical data operations

## File Structure

```
js/backups/
├── firebase-backup-config.js    # Firebase-specific backup configuration and logging
├── local-storage-backup.js      # Local storage wrapper with restore points
├── backup-manager.js            # Unified manager combining both systems
└── README.md                    # This documentation file
```

## Usage

### 1. Initialize the Backup System

```javascript
import { backupManager } from './js/backups/backup-manager.js';

// Initialize after Firebase setup
await backupManager.init();
```

### 2. Create Restore Points After Data Operations

```javascript
// After saving an activity
await backupManager.createFirebaseRestorePoint("AFTER_ACTIVITY_SAVE", { id: "activity-123" });

// After saving a checklist
await backupManager.createFirebaseRestorePoint("AFTER_CHECKLIST_SAVE", { id: "checklist-456" });

// After saving finances data
await backupManager.createFirebaseRestorePoint("AFTER_FINANZAS_SAVE", { transactionId: "tx-789" });
```

### 3. Save Full System Snapshots

```javascript
// Periodic full system backup (e.g., every hour)
await backupManager.saveAll();

// Or save specific collections
await backupManager.saveCollection("activities", activitiesData);
await backupManager.saveCollection("checklists", checklistsData);
```

### 4. Get Backup Statistics

```javascript
const stats = backupManager.getStats();
console.log(stats.summary.totalBackups); // Total number of backups
console.log(stats.summary.lastBackup);   // Timestamp of last backup
```

### 5. Export Backup Data for Recovery

```javascript
// Export Firebase restore points
await backupManager.exportFirebaseRestorePoint("RP-1234567890-abc");

// Export local backup data
await backupManager.exportLocalBackup();

// Export complete configuration (recommended)
const fullExport = backupManager.exportCompleteBackup();
console.log(fullExport); // JSON string with all backup data
```

### 6. Automatic Backup Triggers

The system automatically creates restore points after these operations:
- `AFTER_ACTIVITY_SAVE` - After saving activities
- `AFTER_CHECKLIST_SAVE` - After saving checklists
- `AFTER_FINANZAS_SAVE` - After saving finances data
- `AFTER_NOTAS_SAVE` - After saving notes
- `AFTER_RECORDATORIOS_SAVE` - After saving reminders
- `AFTER_ALARM_SAVE` - After saving alarms

## Logging System

All backup operations are logged with timestamps and restore point IDs:

```javascript
// Example log output:
[BACKUP-LOG] 2026-05-02T18:30:45 (4) - [INFO] Creating Firebase restore point for: AFTER_ACTIVITY_SAVE
[RESTORE-POINT] 2026-05-02T18:30:45 (4) - Created restore point for type: AFTER_ACTIVITY_SAVE
```

## Restore Points

### Find Latest Restore Point

```javascript
// Get latest Firebase restore point for a specific type
const latest = backupManager.getLatestFirebaseRestorePoint("AFTER_ACTIVITY_SAVE");

// Get latest local backup for a collection
const localBackup = backupManager.getLatestLocalBackup("activities");
```

### Export Specific Restore Point

```javascript
// Export a specific restore point by ID
await backupManager.exportFirebaseRestorePoint("RP-1234567890-abc");
```

## Operation Logs

Track all backup operations for audit purposes:

```javascript
// Get operation logs
const logs = backupManager.getOperationLogs();

// Export operation logs to file
backupManager.exportOperationLogs("operation-logs.json");
```

## Storage Management

### Check Storage Availability

```javascript
const storageInfo = backupManager.checkStorage();
console.log(storageInfo.available); // true/false
console.log(storageInfo.usedPercent); // Percentage of used quota
```

### Clear Backup Data (Use with Caution)

```javascript
// Clears all backup data from both Firebase and Local Storage
await backupManager.clearAll();
```

## Best Practices

1. **Initialize Early**: Call `backupManager.init()` after Firebase setup but before first data operations
2. **Auto-Backups**: Let the system handle automatic restore points after critical operations
3. **Periodic Snapshots**: Run `saveAll()` periodically (e.g., every hour) for full system backups
4. **Export Regularly**: Export complete backup configuration to a file for safekeeping
5. **Monitor Storage**: Check storage usage before large data operations

## Recovery Scenarios

### Scenario 1: Single Document Lost

```javascript
// Find latest restore point for the specific document type
const restorePoint = backupManager.getLatestFirebaseRestorePoint("AFTER_ACTIVITY_SAVE");

// Export and use the restore point data
await backupManager.exportFirebaseRestorePoint(restorePoint.id);
```

### Scenario 2: Multiple Documents Lost

```javascript
// Save full system snapshot to capture all current state
await backupManager.saveAll();

// This creates a comprehensive restore point for recovery
```

### Scenario 3: Complete System Recovery

```javascript
// Export complete configuration with all backups
const fullExport = backupManager.exportCompleteBackup("full-recovery.json");

// Import into new instance if needed
backupManager.importCompleteBackup(fullExport);
```

## Error Handling

The system includes comprehensive error handling and logging:

```javascript
try {
    await backupManager.createFirebaseRestorePoint("AFTER_ACTIVITY_SAVE", data);
} catch (error) {
    console.error(`Backup failed:`, error);
    // Fallback to local storage only if needed
    await backupManager.localBackup.saveCollection("activities", data);
}
```

## Version Information

- **Manager Name**: UnifiedBackupManager
- **Version**: 1.0
- **Storage Key**: `firebase-backup-local-storage`
- **Default Expiration**: 30 days for localStorage backups

## Support

For issues or questions, check the console logs for detailed error messages and restore point IDs. 

```

Respuestas Claras al Sistema de Backup
1. ¿Dónde se guardan los respaldos de la base de datos? ¿En qué archivo?
Los respaldos se guardan en DOS lugares simultáneamente:

A En Firebase (la nube)
Archivo lógico: firebase-backup-config.js dentro del módulo de backup
Ubicación física: Se guardan como documentos en tus colecciones de Firebase con IDs tipo RP-1234567890-abc
Qué contiene: Snapshots completos de cada colección (actividades, checklists, finanzas, notas, recordatorios)
B En LocalStorage del navegador (localmente)
Archivo físico: Se guarda en localStorage con la clave "firebase-backup-local-storage"
Ubicación física: En el navegador donde se ejecuta tu app (Chrome, Firefox, Edge, etc.)
Qué contiene:
Datos actuales de cada colección
Historial de puntos de restauración (últimos 50)
Logs de operaciones (últimos 100)
C En archivos JSON exportados (opcional)
Cuando ejecutas exportCompleteBackup(), se genera un archivo JSON que puedes guardar manualmente en:

full-recovery.json (puedes guardarlo donde quieras, ej: js/backups/full-recovery.json)
Este archivo contiene TODO el estado del sistema de backup
2. ¿Dónde veo el registro de puntos de restauración de la DB?
Hay DOS formas de ver los registros:

A En la Consola del Navegador (Principal)
Abre las herramientas de desarrollador (F12) → pestaña "Console" y verás mensajes como:

[BACKUP-LOG] 2026-05-02T19:30:45 (4) - [INFO] Creating Firebase restore point for: AFTER_ACTIVITY_SAVE
[RESTORE-POINT] 2026-05-02T19:30:45 (4) - Created restore point for type: AFTER_ACTIVITY_SAVE

B En el Archivo Exportado
Ejecuta backupManager.exportCompleteBackup() y verás en la consola:

{
  "firebase": {
    "logs": [...],        // Todos los logs de operaciones
    "restorePoints": [...] // Todos los puntos de restauración
  },
  "local": {
    "stats": {...},       // Estadísticas del backup local
    "restoreHistory": [...] // Historial de restore points locales
  }
}

3. Si se pierden todos los datos por estar offline y guardar, y al reconectar está todo vacío...
Paso a Paso para Recuperar:
Paso 1: Abrir la Consola del Navegador
Presiona F12 o haz clic derecho → "Inspeccionar" → pestaña "Console"
Paso 2: Importar el Backup Guardado
Ejecuta en la consola:

import { backupManager } from './js/backups/backup-manager.js';

// Opción A: Si ya exportaste antes a un archivo
const fileContent = await readFile('full-recovery.json', 'utf8');
backupManager.importCompleteBackup(fileContent);

// Opción B: Si quieres usar el último backup de localStorage
const lastSnapshot = await backupManager.exportLocalBackup();
backupManager.importCompleteBackup(lastSnapshot);

Paso 3: Verificar que se Restauró
Ejecuta en la consola:

const stats = backupManager.getStats();
console.log(stats.summary.totalBackups); // Debería mostrar número > 0
console.log(stats.summary.lastBackup);   // Timestamp del último backup

Paso 4: Los Datos se Cargan Automáticamente
Después de importar, los datos están disponibles en:

backupManager.localBackup.backupData (memoria)
localStorage (persistido)
Resumen Visual
Pregunta	Respuesta Rápida
¿Dónde se guardan?	Firebase (nube) + LocalStorage (navegador) + Archivos JSON opcionales
¿Dónde ver los logs?	Consola del navegador (F12 → Console) o archivo exportado
¿Qué ejecutar para recuperar?	backupManager.importCompleteBackup(jsonString) en la consola


```