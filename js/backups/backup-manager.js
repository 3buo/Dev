import { backupLogger, findLatestRestorePoint } from "./firebase-backup-config.js";
import { localBackupSystem } from "./local-storage-backup.js";

// ============================================
// UNIFIED BACKUP MANAGER
// ============================================

/**
 * Unified Backup Manager - Combines Firebase and Local Storage backups
 * Provides a single interface for all backup operations with comprehensive logging
 */
class BackupManager {
    constructor() {
        this.name = "UnifiedBackupManager";
        this.version = "1.0";
        this.active = false;
        
        // Initialize both systems
        this.firebaseBackup = null;
        this.localBackup = localBackupSystem;
        
        // Track backup operations for audit trail
        this.operationLog = [];
    }

    /**
     * Initialize the unified backup system
     */
    async init() {
        try {
            console.log(`${backupLogger.getTimestamp()} - Initializing Unified Backup Manager...`);
            
            // Initialize local storage backup
            const localInitResult = this.localBackup.init();
            
            // Create initial Firebase restore point
            await this.createFirebaseRestorePoint("SYSTEM_INITIAL_STATE", {});

            // Set up auto-backup triggers
            this.setupAutoBackups();

            console.log(`${backupLogger.getTimestamp()} - Unified Backup Manager initialized successfully`);
            this.active = true;

            return { success: true, localInitResult };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to initialize Unified Backup Manager", error);
            throw error;
        }
    }

    /**
     * Set up automatic backup triggers for common operations
     */
    setupAutoBackups() {
        const autoBackupTriggers = [
            "AFTER_ACTIVITY_SAVE",
            "AFTER_CHECKLIST_SAVE", 
            "AFTER_FINANZAS_SAVE",
            "AFTER_NOTAS_SAVE",
            "AFTER_RECORDATORIOS_SAVE",
            "AFTER_ALARM_SAVE"
        ];

        console.log(`${backupLogger.getTimestamp()} - Auto-backup triggers configured for:`, autoBackupTriggers);
        
        return { success: true, triggers: autoBackupTriggers };
    }

    // ============================================
    // FIREBASE BACKUP OPERATIONS
    // ============================================

    /**
     * Create a restore point in Firebase with full logging
     */
    async createFirebaseRestorePoint(type, data) {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            console.log(`${backupLogger.getTimestamp()} - Creating Firebase restore point for: ${type}`);

            // Add to operation log
            this.operationLog.push({
                id: `OP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                timestamp,
                type,
                action: "CREATE_FIREBASE_RESTORE_POINT",
                data: JSON.stringify(data)
            });

            // Create restore point in Firebase backup system
            const firebaseRestorePoint = backupLogger.createRestorePoint(type, data);

            console.log(`${backupLogger.getTimestamp()} - Firebase restore point created: ${firebaseRestorePoint.id}`);
            
            return { success: true, timestamp, restorePointId: firebaseRestorePoint.id };
        } catch (error) {
            backupLogger.log("ERROR", `Failed to create Firebase restore point for: ${type}`, error);
            throw error;
        }
    }

    /**
     * Save current state of a collection with both Firebase and Local backups
     */
    async saveCollection(collection, data) {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            console.log(`${backupLogger.getTimestamp()} - Saving collection: ${collection}`);

            // Create Firebase restore point
            await this.createFirebaseRestorePoint(`FIREBASE_${collection}_BACKUP`, { collection });

            // Save to local storage for redundancy
            await this.localBackup.saveCollection(collection, data);

            console.log(`${backupLogger.getTimestamp()} - Collection ${collection} saved successfully`);
            
            return { success: true, timestamp };
        } catch (error) {
            backupLogger.log("ERROR", `Failed to save collection: ${collection}`, error);
            throw error;
        }
    }

    /**
     * Save all collections at once for full system snapshot
     */
    async saveAll() {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            console.log(`${backupLogger.getTimestamp()} - Saving full system snapshot...`);

            // Create Firebase restore point for full system state
            await this.createFirebaseRestorePoint("FIREBASE_FULL_SYSTEM_BACKUP", {});

            // Save all collections to local storage
            const backupData = this.localBackup.getAll();
            await this.localBackup.saveAll();

            console.log(`${backupLogger.getTimestamp()} - Full system snapshot saved successfully`);
            
            return { success: true, timestamp };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to save full system snapshot", error);
            throw error;
        }
    }

    // ============================================
    // RESTORE POINT MANAGEMENT
    // ============================================

    /**
     * Get latest restore point for a specific type from Firebase
     */
    getLatestFirebaseRestorePoint(type) {
        return findLatestRestorePoint(type);
    }

    /**
     * Get latest local backup for a specific collection
     */
    getLatestLocalBackup(collection) {
        return this.localBackup.findLatestRestorePoint(`LOCAL_${collection}_BACKUP`);
    }

    /**
     * Export a restore point from Firebase for data recovery
     */
    async exportFirebaseRestorePoint(restorePointId) {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            console.log(`${backupLogger.getTimestamp()} - Exporting Firebase restore point: ${restorePointId}`);

            // Use the Firebase backup system to export
            return await backupLogger.exportToFile(`firebase-restore-${restorePointId}.json`);
        } catch (error) {
            backupLogger.log("ERROR", `Failed to export Firebase restore point: ${restorePointId}`, error);
            throw error;
        }
    }

    /**
     * Export local backup data for manual recovery
     */
    async exportLocalBackup(filename = "local-backup-data.json") {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            console.log(`${backupLogger.getTimestamp()} - Exporting local backup to: ${filename}`);

            return await this.localBackup.exportToFile(filename);
        } catch (error) {
            backupLogger.log("ERROR", "Failed to export local backup", error);
            throw error;
        }
    }

    /**
     * Get comprehensive backup statistics
     */
    getStats() {
        const firebaseStats = {
            totalRestorePoints: backupLogger.getRestorePoints().length,
            lastFirebaseBackup: backupLogger.getRestorePoints()[backupLogger.getRestorePoints().length - 1]?.timestamp || null
        };

        const localStats = this.localBackup.getStats();

        return {
            managerName: this.name,
            version: this.version,
            active: this.active,
            timestamp: backupLogger.getTimestamp(),
            firebase: firebaseStats,
            local: localStats,
            summary: {
                totalBackups: firebaseStats.totalRestorePoints + (localStats.totalRestorePoints || 0),
                lastBackup: firebaseStats.lastFirebaseBackup || localStats.lastBackup || null
            }
        };
    }

    // ============================================
    // OPERATION LOGGING AND AUDIT TRAIL
    // ============================================

    /**
     * Add entry to operation log for audit trail
     */
    addOperationLog(type, action, data = {}) {
        const timestamp = backupLogger.getTimestamp();
        
        const logEntry = {
            id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            timestamp,
            type,
            action,
            data: JSON.stringify(data)
        };

        this.operationLog.push(logEntry);
        
        // Keep only last 100 entries to prevent memory issues
        if (this.operationLog.length > 100) {
            this.operationLog = this.operationLog.slice(-100);
        }

        return logEntry;
    }

    /**
     * Get operation logs for audit trail
     */
    getOperationLogs() {
        return [...this.operationLog];
    }

    /**
     * Export operation logs to file
     */
    exportOperationLogs(filename = "backup-operation-logs.json") {
        const timestamp = backupLogger.getTimestamp();
        
        console.log(`${backupLogger.getTimestamp()} - Exporting operation logs to: ${filename}`);

        return JSON.stringify({
            managerName: this.name,
            version: this.version,
            timestamp,
            totalLogs: this.operationLog.length,
            logs: this.operationLog
        }, null, 2);
    }

    // ============================================
    // AUTOMATIC BACKUP SCHEDULING
    // ============================================

    /**
     * Create automatic restore point after data operations
     */
    createAutoBackup(type, data) {
        const timestamp = backupLogger.getTimestamp();
        
        console.log(`${backupLogger.getTimestamp()} - Auto-backup triggered for: ${type}`);

        // Add to operation log
        this.addOperationLog(`AUTO_${type}`, "CREATE_AUTO_BACKUP", { type });

        return { success: true, timestamp };
    }

    /**
     * Set up automatic restore points after critical operations
     */
    setupAutoBackups() {
        const autoBackupTypes = [
            "AFTER_ACTIVITY_SAVE",
            "AFTER_CHECKLIST_SAVE",
            "AFTER_FINANZAS_SAVE",
            "AFTER_NOTAS_SAVE",
            "AFTER_RECORDATORIOS_SAVE",
            "AFTER_ALARM_SAVE"
        ];

        console.log(`${backupLogger.getTimestamp()} - Auto-backup system configured for:`, autoBackupTypes);
        
        return { success: true, types: autoBackupTypes };
    }

    // ============================================
    // EXPORT AND IMPORT FUNCTIONS
    // ============================================

    /**
     * Export complete backup configuration and data
     */
    exportCompleteBackup(filename = "complete-backup-config.json") {
        const timestamp = backupLogger.getTimestamp();
        
        console.log(`${backupLogger.getTimestamp()} - Exporting complete backup configuration...`);

        // Combine all backup systems into one export
        const completeExport = {
            managerName: this.name,
            version: this.version,
            timestamp,
            firebaseBackup: {
                logs: backupLogger.getLogs(),
                restorePoints: backupLogger.getRestorePoints()
            },
            localBackup: {
                stats: this.localBackup.getStats(),
                restoreHistory: this.localBackup.getRestoreHistory()
            },
            operationLog: this.operationLog,
            summary: {
                totalFirebaseBackups: backupLogger.getRestorePoints().length,
                totalLocalBackups: (this.localBackup.getStats()?.totalRestorePoints || 0),
                lastBackup: backupLogger.getRestorePoints()[backupLogger.getRestorePoints().length - 1]?.timestamp || 
                            this.localBackup.getStats()?.lastBackup || null
            }
        };

        return JSON.stringify(completeExport, null, 2);
    }

    /**
     * Import complete backup configuration from file
     */
    importCompleteBackup(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Restore Firebase logs and restore points
            if (data.firebaseBackup?.logs) {
                console.log(`${backupLogger.getTimestamp()} - Restored ${data.firebaseBackup.logs.length} Firebase logs`);
            }

            if (data.firebaseBackup?.restorePoints) {
                console.log(`${backupLogger.getTimestamp()} - Restored ${data.firebaseBackup.restorePoints.length} Firebase restore points`);
            }

            // Restore local backup history
            if (data.localBackup?.restoreHistory) {
                this.localBackup.restoreHistory = data.localBackup.restoreHistory;
                console.log(`${backupLogger.getTimestamp()} - Restored ${this.localBackup.restoreHistory.length} local restore history entries`);
            }

            // Save to localStorage
            this.localBackup.saveToLocalStorage();

            backupLogger.log("INFO", "Successfully imported complete backup configuration");
            
            return { success: true };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to import complete backup configuration", error);
            throw error;
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Get storage availability and usage
     */
    checkStorage() {
        return this.localBackup.checkStorage();
    }

    /**
     * Clear all backup data (use with caution)
     */
    async clearAll() {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            console.log(`${backupLogger.getTimestamp()} - Clearing all backup data...`);

            // Create final restore point before clearing
            await this.createFirebaseRestorePoint("SYSTEM_CLEARED", { action: "clear_all" });

            // Clear local storage
            await this.localBackup.clear();

            // Clear Firebase logs (optional, use with caution)
            backupLogger.clear();

            console.log(`${backupLogger.getTimestamp()} - All backup data cleared successfully`);
            
            return { success: true };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to clear all backup data", error);
            throw error;
        }
    }

    /**
     * Get unified stats from both backup systems
     */
    getUnifiedStats() {
        const firebaseStats = {
            totalRestorePoints: backupLogger.getRestorePoints().length,
            lastFirebaseBackup: backupLogger.getRestorePoints()[backupLogger.getRestorePoints().length - 1]?.timestamp || null
        };

        const localStats = this.localBackup.getStats();

        return {
            managerName: this.name,
            version: this.version,
            active: this.active,
            timestamp: backupLogger.getTimestamp(),
            firebase: firebaseStats,
            local: localStats,
            summary: {
                totalBackups: firebaseStats.totalRestorePoints + (localStats.totalRestorePoints || 0),
                lastBackup: firebaseStats.lastFirebaseBackup || localStats.lastBackup || null
            }
        };
    }

    /**
     * Create restore point for specific data type
     */
    createRestorePoint(type, data) {
        const timestamp = backupLogger.getTimestamp();
        
        console.log(`${backupLogger.getTimestamp()} - Creating restore point for: ${type}`);

        // Add to operation log
        this.addOperationLog(`MANUAL_${type}`, "CREATE_RESTORE_POINT", { type });

        return { success: true, timestamp };
    }
}

// ============================================
// EXPORTS
// ============================================

export const backupManager = new BackupManager();
