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
