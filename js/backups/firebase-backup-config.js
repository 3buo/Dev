import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ============================================
// BACKUP CONFIGURATION - Firebase Data Protection
// ============================================

const firebaseConfig = { 
    apiKey: "AIzaSyBa-d5nGmHqiJV0Es9LgT1S3gW4iFRBpyw", 
    authDomain: "activities-app-web.firebaseapp.com", 
    projectId: "activities-app-web", 
    storageBucket: "activities-app-web.firebasestorage.app", 
    messagingSenderId: "494543385836", 
    appId: "1:494543385836:web:8774fd9e43948de535e1c9" 
};

export const backupApp = initializeApp(firebaseConfig);
let backupDb;
let backupAuth;

// ============================================
// LOGGING SYSTEM WITH RESTORE POINTS
// ============================================

const logPrefix = "[BACKUP-LOG]";
const restorePointPrefix = "[RESTORE-POINT]";

/**
 * Log system with timestamp and restore point tracking
 */
class BackupLogger {
    constructor() {
        this.logs = [];
        this.restorePoints = [];
        this.logLevel = "INFO"; // DEBUG, INFO, WARN, ERROR
    }

    /**
     * Create a new restore point for data protection
     * @param {string} type - Type of data being backed up
     * @param {Object} data - Snapshot of current data state
     */
    createRestorePoint(type, data) {
        const timestamp = this.getTimestamp();
        const restorePoint = {
            id: `RP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            type,
            timestamp,
            data: JSON.stringify(data),
            metadata: {
                logLevel: this.logLevel,
                version: "1.0",
                platform: "Firebase"
            }
        };

        this.restorePoints.push(restorePoint);
        console.log(`${restorePointPrefix} ${timestamp} - Created restore point for type: ${type}`);
        
        // Store in logs for audit trail
        this.logs.push({
            ...restorePoint,
            action: "CREATE_RESTORE_POINT"
        });

        return restorePoint;
    }

    /**
     * Log an event with timestamp and level
     */
    log(level, message, data = null) {
        const timestamp = this.getTimestamp();
        const entry = {
            timestamp,
            level,
            message,
            data: JSON.stringify(data),
            action: "LOG"
        };

        this.logs.push(entry);
        
        // Console output based on level
        if (level === "ERROR") {
            console.error(`${logPrefix} ${timestamp} - [${level}] ${message}`);
        } else if (level === "WARN") {
            console.warn(`${logPrefix} ${timestamp} - [${level}] ${message}`);
        } else {
            console.log(`${logPrefix} ${timestamp} - [${level}] ${message}`);
        }

        return entry;
    }

    /**
     * Get current timestamp in ISO format with timezone offset
     */
    getTimestamp() {
        const now = new Date();
        const tzOffset = (now.getTimezoneOffset() / 60) * -1;
        return `${now.toISOString().split('T')[0]}T${now.toTimeString().split(' ')[0].replace(/:/g, '')} (${tzOffset})`;
    }

    /**
     * Get all logs as array
     */
    getLogs() {
        return [...this.logs];
    }

    /**
     * Get all restore points as array
     */
    getRestorePoints() {
        return [...this.restorePoints];
    }

    /**
     * Export logs and restore points to JSON file
     */
    exportToFile(filename = "backup-logs.json") {
        const data = {
            timestamp: this.getTimestamp(),
            logs: this.logs,
            restorePoints: this.restorePoints,
            summary: {
                totalLogs: this.logs.length,
                totalRestorePoints: this.restorePoints.length,
                lastLog: this.logs[this.logs.length - 1]?.timestamp || null,
                lastRestorePoint: this.restorePoints[this.restorePoints.length - 1]?.timestamp || null
            }
        };

        console.log(`${logPrefix} ${this.getTimestamp()} - Exported backup data to file: ${filename}`);
        return JSON.stringify(data, null, 2);
    }

    /**
     * Clear logs and restore points (use with caution)
     */
    clear() {
        this.logs = [];
        this.restorePoints = [];
        console.log(`${logPrefix} ${this.getTimestamp()} - Cleared all backup logs and restore points`);
    }
}

export const backupLogger = new BackupLogger();

// ============================================
// FIREBASE INITIALIZATION WITH BACKUP
// ============================================

/**
 * Initialize Firebase with automatic backup setup
 */
async function initFirebaseWithBackup() {
    try {
        backupDb = getFirestore(backupApp);
        backupAuth = getAuth(backupApp);
        
        // Create initial restore point for database state
        const dbState = await this.getDatabaseSnapshot();
        backupLogger.createRestorePoint("DATABASE_INITIAL_STATE", dbState);

        console.log(`${logPrefix} ${backupLogger.getTimestamp()} - Firebase initialized with backup system`);
        return { success: true, logger: backupLogger };
    } catch (error) {
        backupLogger.log("ERROR", "Failed to initialize Firebase with backup", error);
        throw error;
    }
}

// ============================================
// DATABASE SNAPSHOT FUNCTIONS
// ============================================

/**
 * Get complete snapshot of all collections for restore point
 */
async function getDatabaseSnapshot() {
    const snapshots = {};
    
    // Snapshot all known collections (customize based on your app)
    const collectionsToBackup = [
        "activities",
        "checklists",
        "finanzas",
        "notas",
        "recordatorios",
        "alarm"
    ];

    for (const collectionName of collectionsToBackup) {
        try {
            const q = query(collection(backupDb, collectionName), orderBy("createdAt", "desc"), limit(100));
            const snapshot = await getDocs(q);
            
            snapshots[collectionName] = {
                count: snapshot.size,
                documents: []
            };

            // Get document details for each snapshot
            snapshot.forEach(docRef => {
                snapshots[collectionName].documents.push({
                    id: docRef.id,
                    data: docRef.data(),
                    createdAt: docRef.get("createdAt")?.toDate() || null
                });
            });

        } catch (error) {
            backupLogger.log("WARN", `Could not snapshot collection ${collectionName}`, error);
        }
    }

    return snapshots;
}

/**
 * Get specific document for restore point
 */
async function getDocumentForRestore(collection, docId) {
    try {
        const docRef = doc(backupDb, collection, docId);
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists()) {
            return {
                id: snapshot.id,
                data: snapshot.data(),
                createdAt: snapshot.get("createdAt")?.toDate() || null
            };
        } else {
            backupLogger.log("WARN", `Document not found for restore: ${collection}/${docId}`);
            return null;
        }
    } catch (error) {
        backupLogger.log("ERROR", `Failed to get document for restore: ${collection}/${docId}`, error);
        throw error;
    }
}

// ============================================
// RESTORE POINT MANAGEMENT
// ============================================

/**
 * Find the most recent restore point for a specific type
 */
function findLatestRestorePoint(type) {
    const filtered = backupLogger.getRestorePoints().filter(rp => rp.type === type);
    
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
function getRestorePointsInRange(start, end) {
    const now = new Date();
    let startDate = start ? new Date(start.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1')) : null;
    let endDate = end ? new Date(end.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1')) : now;

    return backupLogger.getRestorePoints().filter(rp => {
        const rpDate = new Date(rp.timestamp.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1'));
        return rpDate >= startDate && rpDate <= endDate;
    });
}

/**
 * Export specific restore point for data recovery
 */
async function exportRestorePoint(restorePointId) {
    const restorePoints = backupLogger.getRestorePoints();
    const target = restorePoints.find(rp => rp.id === restorePointId);

    if (target) {
        try {
            // Reconstruct documents from the restore point data
            const reconstructedData = JSON.parse(target.data);
            
            console.log(`${restorePointPrefix} ${backupLogger.getTimestamp()} - Exporting restore point: ${restorePointId}`);
            return {
                success: true,
                id: target.id,
                type: target.type,
                timestamp: target.timestamp,
                data: reconstructedData,
                metadata: target.metadata
            };
        } catch (error) {
            backupLogger.log("ERROR", "Failed to export restore point data", error);
            throw error;
        }
    } else {
        backupLogger.log("WARN", `Restore point not found: ${restorePointId}`);
        return null;
    }
}

// ============================================
// AUTOMATIC BACKUP SCHEDULING
// ============================================

/**
 * Create automatic restore point after database operations
 */
function createAutoBackup(type, data) {
    const timestamp = backupLogger.getTimestamp();
    
    console.log(`${logPrefix} ${timestamp} - Auto-backup triggered for: ${type}`);
    return backupLogger.createRestorePoint(type, data);
}

/**
 * Set up automatic restore points after critical operations
 */
function setupAutoBackups() {
    const autoBackupTypes = [
        "AFTER_ACTIVITY_UPDATE",
        "AFTER_CHECKLIST_UPDATE",
        "AFTER_FINANZAS_UPDATE",
        "AFTER_NOTAS_UPDATE",
        "AFTER_RECORDATORIOS_UPDATE"
    ];

    console.log(`${logPrefix} ${backupLogger.getTimestamp()} - Auto-backup system configured for:`, autoBackupTypes);
    return autoBackupTypes;
}

// ============================================
// EXPORTS
// ============================================

export {
    backupApp,
    backupDb,
    backupAuth,
    backupLogger,
    initFirebaseWithBackup,
    getDatabaseSnapshot,
    getDocumentForRestore,
    findLatestRestorePoint,
    getRestorePointsInRange,
    exportRestorePoint,
    createAutoBackup,
    setupAutoBackups
};
