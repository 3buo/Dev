// ============================================
// BACKUPS UI - Funciones globales para el panel
// ============================================

import { backupManager } from './backup-manager.js';
import { backupLogger, getDatabaseSnapshot } from './firebase-backup-config.js';
import { localBackupSystem } from './local-storage-backup.js';

/**
 * Lista todos los backups disponibles (Firebase + LocalStorage)
 */
export async function listAllBackups() {
    const firebaseRPs = backupLogger.getRestorePoints();
    const localHistory = localBackupSystem.getRestoreHistory();
    
    // Combinar y deduplicar por timestamp único
    const allBackups = [];
    const seenTimestamps = new Set();
    
    // Agregar Firebase restore points
    for (const rp of firebaseRPs) {
        const tsKey = `${rp.timestamp}-${rp.type}`;
        if (!seenTimestamps.has(tsKey)) {
            seenTimestamps.add(tsKey);
            allBackups.push({
                key: rp.id,
                type: rp.type,
                source: 'Firebase',
                date: rp.timestamp,
                metadata: rp.metadata
            });
        }
    }
    
    // Agregar LocalStorage restore points (si existen)
    for (const h of localHistory) {
        const tsKey = `${h.timestamp}-${h.type}`;
        if (!seenTimestamps.has(tsKey)) {
            seenTimestamps.add(tsKey);
            allBackups.push({
                key: h.id,
                type: h.type,
                source: 'LocalStorage',
                date: h.timestamp,
                metadata: h.metadata
            });
        }
    }
    
    // Ordenar por fecha (más reciente primero)
    return allBackups.sort((a, b) => {
        const dateA = new Date(a.date.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1'));
        const dateB = new Date(b.date.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/, '$1'));
        return dateB - dateA;
    });
}

/**
 * Crea un backup manual (snapshot completo)
 */
export async function createManualBackup() {
    try {
        const snapshot = await getDatabaseSnapshot();
        
        // Guardar en Firebase
        await backupManager.createFirebaseRestorePoint("MANUAL_FULL_SNAPSHOT", { 
            collections: Object.keys(snapshot),
            totalCollections: Object.keys(snapshot).length,
            snapshotTime: new Date().toISOString()
        });
        
        // Guardar en LocalStorage
        const localData = JSON.parse(JSON.stringify(snapshot));
        await localBackupSystem.saveAll();
        
        backupLogger.log("INFO", "Manual full snapshot created successfully");
        
        return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
        backupLogger.log("ERROR", "Failed to create manual backup", error);
        throw error;
    }
}

/**
 * Crea un auto-snapshot (snapshot rápido de estado actual)
 */
export async function createAutoSnapshot() {
    try {
        const snapshot = await getDatabaseSnapshot();
        
        // Guardar en Firebase con timestamp automático
        const timestamp = new Date().toISOString();
        await backupManager.createFirebaseRestorePoint("AUTO_SNAPSHOT", { 
            collections: Object.keys(snapshot),
            totalCollections: Object.keys(snapshot).length,
            snapshotTime: timestamp
        });
        
        // Guardar en LocalStorage
        const localData = JSON.parse(JSON.stringify(snapshot));
        await localBackupSystem.saveAll();
        
        backupLogger.log("INFO", "Auto-snapshot created successfully");
        
        return { success: true, timestamp };
    } catch (error) {
        backupLogger.log("ERROR", "Failed to create auto snapshot", error);
        throw error;
    }
}

/**
 * Restaura desde el último backup disponible
 */
export async function restoreFromLastBackup() {
    try {
        const backups = await listAllBackups();
        
        if (backups.length === 0) {
            backupLogger.log("WARN", "No backups available to restore from");
            return { success: false, message: "No hay backups disponibles" };
        }
        
        // Usar el más reciente
        const latestBackup = backups[0];
        backupLogger.log("INFO", `Restoring from latest backup: ${latestBackup.type}`);
        
        // Restaurar desde Firebase (si existe)
        if (latestBackup.source === 'Firebase') {
            try {
                await backupManager.exportFirebaseRestorePoint(latestBackup.key);
            } catch (e) {
                console.warn("Firebase restore point export failed, trying local storage");
            }
        }
        
        // Restaurar desde LocalStorage
        const localData = localBackupSystem.getAll();
        if (Object.keys(localData).length > 0) {
            backupLogger.log("INFO", "Restored from local storage successfully");
        }
        
        return { success: true, restoredFrom: latestBackup.type };
    } catch (error) {
        backupLogger.log("ERROR", "Failed to restore from last backup", error);
        throw error;
    }
}

/**
 * Exporta todos los backups a un archivo JSON
 */
export async function exportAllBackups() {
    try {
        const fullExport = backupManager.exportCompleteBackup();
        
        // Crear blob y descargar
        const blob = new Blob([fullExport], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backups-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();
        
        backupLogger.log("INFO", "All backups exported successfully");
        
        return { success: true, filename: a.download };
    } catch (error) {
        backupLogger.log("ERROR", "Failed to export all backups", error);
        throw error;
    }
}

/**
 * Limpia backups antiguos (manteniendo los más recientes)
 */
export async function cleanupOldBackups(keepCount = 10) {
    try {
        const backups = await listAllBackups();
        
        if (backups.length <= keepCount) {
            backupLogger.log("INFO", `Only ${backups.length} backups exist, nothing to clean`);
            return { success: true, cleaned: 0 };
        }
        
        // Eliminar los más antiguos
        const toDelete = backups.slice(keepCount);
        let deletedCount = 0;
        
        for (const backup of toDelete) {
            try {
                if (backup.source === 'Firebase') {
                    await backupManager.exportFirebaseRestorePoint(backup.key);
                } else {
                    localBackupSystem.addToRestoreHistory("CLEANUP", {});
                }
                deletedCount++;
            } catch (e) {
                console.warn(`Failed to delete backup ${backup.key}:`, e);
            }
        }
        
        backupLogger.log("INFO", `Cleaned up ${deletedCount} old backups, keeping ${keepCount}`);
        
        return { success: true, cleaned: deletedCount, kept: keepCount };
    } catch (error) {
        backupLogger.log("ERROR", "Failed to cleanup old backups", error);
        throw error;
    }
}

/**
 * Obtiene estadísticas completas del sistema de backups
 */
export function getFullReport() {
    const stats = backupManager.getStats();
    
    // Agregar detalles adicionales
    return {
        ...stats,
        firebaseDetails: {
            totalRestorePoints: backupLogger.getRestorePoints().length,
            logsCount: backupLogger.getLogs().length,
            lastFirebaseBackup: backupLogger.getRestorePoints()[backupLogger.getRestorePoints().length - 1]?.timestamp || null
        },
        localDetails: {
            collections: Object.keys(localBackupSystem.getAll()),
            totalCollections: Object.keys(localBackupSystem.getAll()).length,
            restoreHistoryCount: localBackupSystem.getRestoreHistory().length
        }
    };
}

/**
 * Verifica si Firebase está online
 */
export function isFirebaseOnline() {
    try {
        // Intentar obtener una colección para verificar conexión
        const q = query(collection(backupApp, 'activities'), limit(1));
        return true; // Si no hay error, está online
    } catch (error) {
        backupLogger.log("WARN", "Firebase might be offline", error);
        return false;
    }
}

// ============================================
// EXPORTS PARA ACCESO GLOBAL
// ============================================

window.listAllBackups = listAllBackups;
window.createManualBackup = createManualBackup;
window.createAutoSnapshot = createAutoSnapshot;
window.restoreFromLastBackup = restoreFromLastBackup;
window.exportAllBackups = exportAllBackups;
window.cleanupOldBackups = cleanupOldBackups;
window.getFullReport = getFullReport;
window.isFirebaseOnline = isFirebaseOnline;
