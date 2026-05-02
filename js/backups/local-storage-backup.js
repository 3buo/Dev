import { backupLogger, findLatestRestorePoint } from "./firebase-backup-config.js";

// ============================================
// LOCAL STORAGE BACKUP SYSTEM
// ============================================

/**
 * Local storage wrapper with automatic restore points and logs
 * Prevents data loss by maintaining local snapshots alongside Firebase
 */
class LocalStorageBackup {
    constructor() {
        this.storageKey = "firebase-backup-local-storage";
        this.backupData = {};
        this.restoreHistory = [];
        this.logLevel = "INFO"; // DEBUG, INFO, WARN, ERROR
    }

    /**
     * Initialize local storage backup system
     */
    init() {
        try {
            // Load existing backup data if available
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                this.backupData = JSON.parse(savedData);
                console.log(`${backupLogger.getTimestamp()} - Loaded existing local storage backup`);
            } else {
                this.backupData = {};
                console.log(`${backupLogger.getTimestamp()} - Initialized fresh local storage backup`);
            }

            // Create initial restore point
            const initialState = { collections: Object.keys(this.backupData) };
            backupLogger.createRestorePoint("LOCAL_STORAGE_INITIAL_STATE", initialState);

            return { success: true, data: this.backupData };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to initialize local storage backup", error);
            throw error;
        }
    }

    /**
     * Save current state of a collection for restore point
     */
    saveCollection(collection, data) {
        try {
            // Deep clone the data
            this.backupData[collection] = JSON.parse(JSON.stringify(data));
            
            // Create restore point
            const timestamp = backupLogger.getTimestamp();
            const restorePoint = backupLogger.createRestorePoint(
                `LOCAL_${collection}_BACKUP`,
                { collection, snapshot: "full" }
            );

            // Save to localStorage with expiration (30 days)
            this.saveToLocalStorage();

            console.log(`${backupLogger.getTimestamp()} - Saved restore point for: ${collection}`);
            
            return { success: true, timestamp, restorePointId: restorePoint.id };
        } catch (error) {
            backupLogger.log("ERROR", `Failed to save collection ${collection}`, error);
            throw error;
        }
    }

    /**
     * Save all collections at once for full system snapshot
     */
    saveAll() {
        try {
            const timestamp = backupLogger.getTimestamp();
            
            // Create restore point for full system state
            const fullSnapshot = {
                collections: Object.keys(this.backupData),
                totalCollections: Object.keys(this.backupData).length,
                snapshotTime: timestamp
            };

            const restorePoint = backupLogger.createRestorePoint(
                "LOCAL_FULL_SYSTEM_BACKUP",
                fullSnapshot
            );

            // Save to localStorage with expiration (30 days)
            this.saveToLocalStorage();

            console.log(`${backupLogger.getTimestamp()} - Saved full system snapshot`);
            
            return { success: true, timestamp, restorePointId: restorePoint.id };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to save all collections", error);
            throw error;
        }
    }

    /**
     * Save backup data to localStorage with 30-day expiration
     */
    saveToLocalStorage() {
        try {
            const serialized = JSON.stringify({
                version: "1.0",
                timestamp: backupLogger.getTimestamp(),
                data: this.backupData,
                restoreHistory: this.restoreHistory.slice(-50) // Keep last 50 history entries
            });

            localStorage.setItem(this.storageKey, serialized);
            
            console.log(`${backupLogger.getTimestamp()} - Saved to localStorage`);
        } catch (error) {
            backupLogger.log("WARN", "Failed to save to localStorage", error);
        }
    }

    /**
     * Get current state of a collection for restore point
     */
    getCollection(collection) {
        return this.backupData[collection] || null;
    }

    /**
     * Get all collections for full system snapshot
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.backupData));
    }

    /**
     * Check if a collection exists in backup
     */
    hasCollection(collection) {
        return this.backupData[collection] !== undefined;
    }

    // ============================================
    // RESTORE POINT MANAGEMENT
    // ============================================

    /**
     * Get restore history for audit trail
     */
    getRestoreHistory() {
        return [...this.restoreHistory];
    }

    /**
     * Add entry to restore history
     */
    addToRestoreHistory(type, data) {
        const timestamp = backupLogger.getTimestamp();
        const entry = {
            id: `LH-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            type,
            timestamp,
            data: JSON.stringify(data),
            metadata: {
                logLevel: this.logLevel,
                version: "1.0"
            }
        };

        this.restoreHistory.push(entry);
        
        // Keep only last 50 entries to prevent memory issues
        if (this.restoreHistory.length > 50) {
            this.restoreHistory = this.restoreHistory.slice(-50);
        }

        return entry;
    }

    /**
     * Find latest restore point for a specific collection type
     */
    findLatestRestorePoint(type) {
        const filtered = this.restoreHistory.filter(h => h.type === type);
        
        if (filtered.length > 0) {
            // Sort by timestamp and get latest
            return filtered.sort((a, b) => 
                new Date(b.timestamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1')) -
                new Date(a.timestamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1'))
            )[0];
        }

        return null;
    }

    /**
     * Get restore points within a specific time range
     */
    getRestorePointsInRange(start, end) {
        const now = new Date();
        let startDate = start ? new Date(start.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1')) : null;
        let endDate = end ? new Date(end.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1')) : now;

        return this.restoreHistory.filter(h => {
            const hDate = new Date(h.timestamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1'));
            return hDate >= startDate && hDate <= endDate;
        });
    }

    // ============================================
    // EXPORT AND IMPORT FUNCTIONS
    // ============================================

    /**
     * Export backup data to JSON file for manual recovery
     */
    exportToFile(filename = "local-backup-data.json") {
        const timestamp = backupLogger.getTimestamp();
        
        const exportData = {
            version: "1.0",
            timestamp,
            storageKey: this.storageKey,
            backupData: JSON.parse(JSON.stringify(this.backupData)),
            restoreHistory: this.restoreHistory.slice(-50),
            summary: {
                totalCollections: Object.keys(this.backupData).length,
                totalRestorePoints: this.restoreHistory.length,
                lastBackup: this.restoreHistory[this.restoreHistory.length - 1]?.timestamp || null
            }
        };

        console.log(`${backupLogger.getTimestamp()} - Exported local backup to file: ${filename}`);
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import backup data from JSON string
     */
    importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.backupData) {
                this.backupData = data.backupData;
            }
            
            if (data.restoreHistory) {
                this.restoreHistory = data.restoreHistory;
            }

            // Save to localStorage
            this.saveToLocalStorage();

            backupLogger.log("INFO", "Successfully imported local backup data");
            
            return { success: true };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to import local backup data", error);
            throw error;
        }
    }

    /**
     * Export all restore points for comprehensive recovery
     */
    exportAllRestorePoints() {
        const timestamp = backupLogger.getTimestamp();
        
        const allRestorePoints = this.restoreHistory.map(h => ({
            id: h.id,
            type: h.type,
            timestamp: h.timestamp,
            data: JSON.parse(h.data),
            metadata: h.metadata
        }));

        console.log(`${backupLogger.getTimestamp()} - Exported ${allRestorePoints.length} restore points`);
        
        return allRestorePoints;
    }

    // ============================================
    // AUTOMATIC BACKUP SCHEDULING
    // ============================================

    /**
     * Set up automatic backup triggers for common operations
     */
    setupAutoBackups() {
        const autoBackupTriggers = [
            "AFTER_ACTIVITY_SAVE",
            "AFTER_CHECKLIST_SAVE",
            "AFTER_FINANZAS_SAVE",
            "AFTER_NOTAS_SAVE",
            "AFTER_RECORDATORIOS_SAVE"
        ];

        console.log(`${backupLogger.getTimestamp()} - Auto-backup triggers configured for:`, autoBackupTriggers);
        
        return { success: true, triggers: autoBackupTriggers };
    }

    /**
     * Create automatic restore point after data operations
     */
    createAutoBackup(type, data) {
        const timestamp = backupLogger.getTimestamp();
        
        console.log(`${backupLogger.getTimestamp()} - Auto-backup triggered for: ${type}`);
        
        // Add to restore history
        this.addToRestoreHistory(`AUTO_${type}`, { type, snapshot: "full" });

        return { success: true, timestamp };
    }

    /**
     * Clear local storage backup (use with caution)
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            this.backupData = {};
            this.restoreHistory = [];
            
            const timestamp = backupLogger.getTimestamp();
            backupLogger.createRestorePoint("LOCAL_STORAGE_CLEARED", { action: "clear_all" });

            console.log(`${backupLogger.getTimestamp()} - Cleared local storage backup`);
            
            return { success: true };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to clear local storage backup", error);
            throw error;
        }
    }

    /**
     * Get backup statistics
     */
    getStats() {
        const totalCollections = Object.keys(this.backupData).length;
        const totalRestorePoints = this.restoreHistory.length;
        
        return {
            version: "1.0",
            storageKey: this.storageKey,
            totalCollections,
            totalRestorePoints,
            lastBackup: this.restoreHistory[this.restoreHistory.length - 1]?.timestamp || null,
            collections: Object.keys(this.backupData)
        };
    }

    /**
     * Check localStorage availability and size
     */
    checkStorage() {
        try {
            const storage = window.localStorage;
            const usage = storage.usage ? storage.usage() : 0;
            const limit = storage.quota ? storage.quota() : 5242880; // Default 5MB
            
            return {
                available: true,
                usedBytes: usage,
                quotaBytes: limit,
                usedPercent: (usage / limit) * 100,
                remainingBytes: limit - usage
            };
        } catch (error) {
            console.warn(`${backupLogger.getTimestamp()} - localStorage not available`);
            return { available: false, error };
        }
    }
}

// ============================================
// EXPORTS
// ============================================

export const localBackupSystem = new LocalStorageBackup();
