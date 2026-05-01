// ============================================
// BACKUPS-MANAGER.JS - Gestión Unificada de Backups
// ============================================
import { state, createSnapshot, listSnapshots, deleteSnapshot,
         createBackupPoint, listBackups, deleteBackup, restoreFromAnyPoint,
         loadFromIndexedDB, saveToIndexedDB } from './store.js';

/**
 * Clase principal para gestión unificada de backups
 */
export class BackupManager {
    constructor() {
        this.backupHistory = [];
        this.maxHistorySize = 50; // Mantener máximo 50 registros de historial
    }

    /**
     * Registra una operación de backup en el historial
     */
    recordOperation(operation, type, timestamp, details) {
        const entry = {
            operation,
            type,
            timestamp: Date.now(),
            date: new Date(timestamp).toISOString(),
            details
        };

        this.backupHistory.push(entry);
        
        // Mantener tamaño máximo del historial
        if (this.backupHistory.length > this.maxHistorySize) {
            this.backupHistory.shift();
        }
    }

    /**
     * Lista todos los backups disponibles (snapshots + IndexedDB)
     */
    async listAllBackups(uid = state.currentUid) {
        const snapshots = listSnapshots();
        const indexedDBBackups = await listBackups(uid);
        
        // Combinar y ordenar por fecha (más reciente primero)
        const allBackups = [
            ...snapshots.map(s => ({ ...s, source: 'LocalStorage', type: 'snapshot' })),
            ...indexedDBBackups.map(b => ({ 
                ...b, 
                source: 'IndexedDB', 
                type: 'backup',
                date: new Date(b.timestamp).toISOString() 
            }))
        ].sort((a, b) => {
            const timeA = a.date ? new Date(a.date).getTime() : 0;
            const timeB = b.date ? new Date(b.date).getTime() : 0;
            return timeB - timeA; // Más reciente primero
        });

        this.recordOperation('list', 'info', allBackups[0]?.timestamp || Date.now(), { count: allBackups.length });
        
        return allBackups;
    }

    /**
     * Crea un nuevo punto de restauración (backup)
     */
    async createNewBackupPoint(uid = state.currentUid, name = null) {
        try {
            const timestamp = Date.now();
            
            // Crear backup en IndexedDB
            const backupData = await createBackupPoint(uid, { ...state });
            
            if (backupData) {
                // También crear snapshot en LocalStorage
                await createSnapshot();
                
                this.recordOperation('create', 'success', timestamp, { 
                    name: name || `Backup ${new Date(timestamp).toLocaleString()}`,
                    size: backupData.data.length
                });
                
                return { success: true, data: backupData };
            } else {
                throw new Error('Error al crear backup');
            }
        } catch (error) {
            console.error('Error en createNewBackupPoint:', error);
            this.recordOperation('create', 'error', Date.now(), { error: error.message });
            return { success: false, error };
        }
    }

    /**
     * Restaura estado desde un backup específico
     */
    async restoreFromBackup(timestampOrKey, uid = state.currentUid) {
        try {
            const result = await restoreFromAnyPoint(timestampOrKey, uid);
            
            if (result) {
                this.recordOperation('restore', 'success', Date.now(), { 
                    timestamp: timestampOrKey,
                    source: typeof timestampOrKey === 'number' ? 'IndexedDB' : 'LocalStorage'
                });
                
                return { success: true };
            } else {
                throw new Error('Error al restaurar backup');
            }
        } catch (error) {
            console.error('Error en restoreFromBackup:', error);
            this.recordOperation('restore', 'error', Date.now(), { error: error.message });
            return { success: false, error };
        }
    }

    /**
     * Elimina un backup específico
     */
    async deleteBackup(timestampOrKey, uid = state.currentUid) {
        try {
            // Intentar eliminar de IndexedDB primero
            let result = await deleteBackup(uid, timestampOrKey);
            
            if (!result) {
                // Si no encontrado en IndexedDB, intentar LocalStorage
                const snapshots = listSnapshots();
                const snapshot = snapshots.find(s => 
                    s.timestamp === timestampOrKey || 
                    (s.key.includes(timestampOrKey.toString()))
                );
                
                if (snapshot) {
                    result = await deleteSnapshot(snapshot.key);
                }
            }
            
            this.recordOperation('delete', 'success', Date.now(), { 
                timestamp: timestampOrKey,
                source: typeof timestampOrKey === 'number' ? 'IndexedDB' : 'LocalStorage'
            });
            
            return result;
        } catch (error) {
            console.error('Error en deleteBackup:', error);
            this.recordOperation('delete', 'error', Date.now(), { error: error.message });
            return false;
        }
    }

    /**
     * Limpia backups antiguos (mantener últimos N)
     */
    async cleanupOldBackups(uid = state.currentUid, maxKeep = 10) {
        try {
            const allBackups = await this.listAllBackups(uid);
            const toDelete = allBackups.slice(0, Math.max(0, allBackups.length - maxKeep));
            
            let deletedCount = 0;
            for (const backup of toDelete) {
                await this.deleteBackup(backup.timestamp || backup.key, uid);
                deletedCount++;
            }
            
            this.recordOperation('cleanup', 'success', Date.now(), { 
                deleted: deletedCount,
                kept: Math.min(maxKeep, allBackups.length)
            });
            
            return { success: true, deleted: deletedCount };
        } catch (error) {
            console.error('Error en cleanupOldBackups:', error);
            this.recordOperation('cleanup', 'error', Date.now(), { error: error.message });
            return { success: false, error };
        }
    }

    /**
     * Obtiene historial de operaciones de backup
     */
    getHistory() {
        // Ordenar por timestamp (más reciente primero)
        const sorted = [...this.backupHistory].sort((a, b) => b.timestamp - a.timestamp);
        
        return sorted.map(entry => ({
            operation: entry.operation,
            type: entry.type,
            date: entry.date,
            details: entry.details
        }));
    }

    /**
     * Limpia todo el historial de operaciones
     */
    clearHistory() {
        this.backupHistory = [];
        return true;
    }

    /**
     * Obtiene estadísticas de backups
     */
    getStats(uid = state.currentUid) {
        const allBackups = this.listAllBackups(uid);
        
        // Contar por fuente
        const bySource = {
            'LocalStorage': 0,
            'IndexedDB': 0
        };
        
        for (const backup of allBackups) {
            if (bySource[backup.source] !== undefined) {
                bySource[backup.source]++;
            }
        }
        
        // Obtener fechas de creación
        const dates = allBackups.map(b => b.date || b.timestamp).filter(Boolean);
        
        return {
            total: allBackups.length,
            bySource,
            oldestDate: dates[dates.length - 1] || null,
            newestDate: dates[0] || null,
            historySize: this.backupHistory.length
        };
    }

    /**
     * Verifica si hay datos disponibles para restaurar
     */
    async checkAvailability(uid = state.currentUid) {
        const snapshots = listSnapshots();
        const indexedDBBackups = await listBackups(uid);
        
        return {
            hasLocalStorageBackups: snapshots.length > 0,
            hasIndexedDBBackups: indexedDBBackups.length > 0,
            totalAvailable: snapshots.length + indexedDBBackups.length
        };
    }

    /**
     * Crea snapshot automático (se llama cada vez que se guarda)
     */
    async autoSnapshot(uid = state.currentUid) {
        try {
            await createSnapshot();
            
            this.recordOperation('auto-snapshot', 'success', Date.now(), {});
            return true;
        } catch (error) {
            console.error('Error en autoSnapshot:', error);
            this.recordOperation('auto-snapshot', 'error', Date.now(), { error: error.message });
            return false;
        }
    }

    /**
     * Exporta todos los backups a un archivo JSON
     */
    async exportAllBackups(uid = state.currentUid, filename = 'all_backups.json') {
        try {
            const allBackups = await this.listAllBackups(uid);
            
            // Crear objeto de exportación
            const exportData = {
                exportedAt: new Date().toISOString(),
                version: 1,
                backups: allBackups.map(b => ({
                    timestamp: b.timestamp || b.key,
                    date: b.date,
                    source: b.source,
                    type: b.type,
                    size: b.size
                })),
                stats: this.getStats(uid)
            };
            
            // Crear y descargar archivo
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            this.recordOperation('export', 'success', Date.now(), { filename, count: allBackups.length });
            
            return { success: true, filename, count: allBackups.length };
        } catch (error) {
            console.error('Error en exportAllBackups:', error);
            this.recordOperation('export', 'error', Date.now(), { error: error.message });
            return { success: false, error };
        }
    }

    /**
     * Importa backups desde un archivo JSON
     */
    async importFromJSON(file) {
        try {
            const content = await file.text();
            const data = JSON.parse(content);
            
            // Validar estructura
            if (!data.backups || !Array.isArray(data.backups)) {
                throw new Error('Estructura de archivo inválida');
            }
            
            this.recordOperation('import', 'success', Date.now(), { 
                filename: file.name,
                count: data.backups.length
            });
            
            return { success: true, importedCount: data.backups.length };
        } catch (error) {
            console.error('Error en importFromJSON:', error);
            this.recordOperation('import', 'error', Date.now(), { error: error.message });
            return { success: false, error };
        }
    }

    /**
     * Obtiene el último backup disponible
     */
    async getLastBackup(uid = state.currentUid) {
        const allBackups = await this.listAllBackups(uid);
        
        if (allBackups.length > 0) {
            return allBackups[0]; // El más reciente es primero
        }
        
        return null;
    }

    /**
     * Restaura desde el último backup disponible
     */
    async restoreFromLastBackup(uid = state.currentUid) {
        const lastBackup = await this.getLastBackup(uid);
        
        if (lastBackup) {
            return await this.restoreFromBackup(lastBackup.timestamp || lastBackup.key, uid);
        } else {
            throw new Error('No hay backups disponibles para restaurar');
        }
    }

    /**
     * Obtiene el estado actual de sincronización
     */
    getSyncStatus() {
        return state.syncStatus;
    }

    /**
     * Actualiza estado de sincronización
     */
    async updateSyncStatus(status, lastSyncTime = null) {
        state.syncStatus = status;
        state.lastSyncTime = lastSyncTime || new Date().toISOString();
        
        // Guardar snapshot automático después de cada cambio
        await createSnapshot();
        
        this.recordOperation('sync-status-update', 'info', Date.now(), { 
            status,
            timestamp: lastSyncTime || new Date().toISOString()
        });
    }

    /**
     * Verifica disponibilidad offline (IndexedDB)
     */
    async checkOfflineAvailability(uid = state.currentUid) {
        try {
            const localData = await loadFromIndexedDB(uid);
            return !!localData;
        } catch (error) {
            console.error('Error al verificar disponibilidad offline:', error);
            return false;
        }
    }

    /**
     * Fallback automático a IndexedDB si Firebase falla
     */
    async fallbackToOffline() {
        try {
            console.log('🔄 Cambiando a modo offline (fallback a IndexedDB)...');
            
            // Guardar estado actual en IndexedDB antes de cambiar
            await saveToIndexedDB(state.currentUid, { ...state });
            
            // Actualizar estado
            state.syncStatus = 'offline';
            
            console.log('✅ Modo offline activado. Usando IndexedDB como fuente primaria.');
            
            this.recordOperation('fallback', 'success', Date.now(), {});
            return true;
        } catch (error) {
            console.error('Error en fallback a offline:', error);
            state.syncStatus = 'error';
            this.recordOperation('fallback', 'error', Date.now(), { error: error.message });
            return false;
        }
    }

    /**
     * Obtiene resumen completo del sistema de backups
     */
    async getFullReport(uid = state.currentUid) {
        const availability = await this.checkAvailability(uid);
        const stats = this.getStats(uid);
        const history = this.getHistory();
        
        return {
            overview: {
                syncStatus: state.syncStatus,
                lastSyncTime: state.lastSyncTime || null,
                currentBackupPoint: state.currentBackupPoint || null,
                ...availability
            },
            stats,
            recentOperations: history.slice(0, 10), // Últimas 10 operaciones
            allBackupsCount: stats.total,
            indexedDBBackupsCount: stats.bySource['IndexedDB'] || 0,
            localStorageBackupsCount: stats.bySource['LocalStorage'] || 0
        };
    }
}

// Exportar instancia global para acceso desde HTML/JS
window.BackupManager = BackupManager;

/**
 * Funciones globales para acceso directo desde HTML/CSS
 */

/**
 * Crea un backup manual del estado actual
 */
async function createManualBackup(uid = state.currentUid) {
    try {
        console.log('💾 Creando backup manual...');
        
        // Guardar en IndexedDB
        const indexedDBResult = await saveToIndexedDB(uid, { ...state });
        
        // Crear punto de backup
        const backupPoint = await createBackupPoint({
            text: 'Manual',
            date: new Date().toISOString(),
            type: 'manual'
        }, uid);
        
        console.log('✅ Backup manual creado:', indexedDBResult);
        
        // Notificar cambio
        notifyStateChange();
        
        return { success: true, data: indexedDBResult };
    } catch (error) {
        console.error('❌ Error al crear backup manual:', error);
        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Restaura desde el último backup disponible
 */
async function restoreFromLastBackup(uid = state.currentUid) {
    try {
        console.log('↩️ Restaurando desde último backup...');
        
        const backups = await listAllBackups(uid);
        
        if (backups.length === 0) {
            throw new Error('No hay backups disponibles para restaurar.');
        }
        
        // Usar el más reciente
        const lastBackup = backups[0];
        console.log('📅 Restaurando desde:', formatDate(lastBackup.date || lastBackup.timestamp));
        
        const result = await restoreFromAnyPoint(lastBackup, uid);
        
        if (result.success) {
            console.log('✅ Restauración completada');
            
            // Guardar snapshot después de restaurar
            createSnapshot({ text: 'After Restore', date: new Date().toISOString() }, uid);
            
            notifyStateChange();
            window.renderTasks(); // Actualizar UI
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error al restaurar último backup:', error);
        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Crea un snapshot automático del estado actual
 */
async function createAutoSnapshot(uid = state.currentUid) {
    try {
        console.log('📸 Creando snapshot automático...');
        
        const result = await createSnapshot({
            text: 'Auto',
            date: new Date().toISOString()
        }, uid);
        
        console.log('✅ Snapshot creado:', result.key);
        notifyStateChange();
        
        return { success: true, data: result };
    } catch (error) {
        console.error('❌ Error al crear snapshot automático:', error);
        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Exporta todos los backups a un archivo JSON
 */
async function exportAllBackups(uid = state.currentUid) {
    try {
        console.log('📤 Exportando todos los backups...');
        
        const backups = await listAllBackups(uid);
        const report = await getFullReport(uid);
        
        // Crear objeto de exportación
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                totalBackups: backups.length,
                ...report.overview
            },
            stats: report.stats,
            recentOperations: report.recentOperations,
            allBackups: backups.map(b => ({
                key: b.key,
                date: b.date || b.timestamp,
                source: b.source,
                type: b.type
            }))
        };
        
        // Crear archivo JSON
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Crear elemento temporal para descarga
        const a = document.createElement('a');
        a.href = url;
        a.download = `backups-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        
        console.log('✅ Exportación completada');
        notifyStateChange();
        
        return { success: true, downloads: 1 };
    } catch (error) {
        console.error('❌ Error al exportar backups:', error);
        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Limpia backups antiguos manteniendo la cantidad especificada
 */
async function cleanupOldBackups(uid = state.currentUid, keepCount = 10) {
    try {
        console.log(`🧹 Limpiando backups antiguos (mantener ${keepCount})...`);
        
        const backups = await listAllBackups(uid);
        
        if (backups.length <= keepCount) {
            console.log('✅ No es necesario limpiar (hay', backups.length, 'backups).');
            notifyStateChange();
            return { success: true, deleted: 0 };
        }
        
        // Calcular cuántos eliminar
        const toDelete = backups.slice(keepCount);
        let deletedCount = 0;
        
        for (const backup of toDelete) {
            try {
                await deleteBackup(backup.key, uid);
                deletedCount++;
            } catch (error) {
                console.error('Error al eliminar backup:', backup.key, error.message);
            }
        }
        
        const result = {
            success: true,
            deleted: deletedCount,
            remaining: backups.length - deletedCount
        };
        
        console.log(`✅ Eliminados ${deletedCount} backups antiguos.`);
        notifyStateChange();
        
        return result;
    } catch (error) {
        console.error('❌ Error al limpiar backups:', error);
        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Obtiene detalles de un backup específico para visualización
 */
async function viewBackupDetails(backupKey, uid = state.currentUid) {
    try {
        console.log('👁️ Visualizando detalles del backup:', backupKey);
        
        const backups = await listAllBackups(uid);
        const backup = backups.find(b => b.key === backupKey);
        
        if (!backup) {
            throw new Error('Backup no encontrado.');
        }
        
        // Obtener datos completos del backup
        let backupData;
        try {
            backupData = await loadFromAnyPoint(backup, uid);
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar los datos completos:', error.message);
            backupData = { key: backup.key };
        }
        
        const report = await getFullReport(uid);
        
        // Crear objeto de visualización
        const viewData = {
            metadata: {
                key: backupKey,
                date: formatDate(backup.date || backup.timestamp),
                source: backup.source,
                type: backup.type
            },
            overview: report.overview,
            stats: report.stats,
            recentOperations: report.recentOperations.slice(0, 5) // Últimos 5
        };
        
        console.log('✅ Detalles cargados:', viewData);
        notifyStateChange();
        
        return { success: true, data: viewData };
    } catch (error) {
        console.error('❌ Error al obtener detalles del backup:', error);
        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Formatea fecha para display
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Verifica si Firebase está online
 */
function isFirebaseOnline() {
    try {
        // Intentar conexión simple a Firestore
        const db = getFirestore(app);
        
        // Crear referencia y verificar existencia
        const docRef = doc(db, 'userData', state.currentUid || '');
        
        if (state.currentUid) {
            return !docRef.id.includes('undefined');
        }
        
        return true;
    } catch (error) {
        console.error('Error al verificar estado Firebase:', error);
        return false;
    }
}

/**
 * Abre el panel de backups y lo inicializa
 */
async function openBackupsPanel() {
    try {
        // Mostrar panel
        const panel = document.getElementById('backupsPanel');
        if (panel) {
            panel.style.display = 'flex';
            
            // Inicializar panel
            await initBackupsPanel();
            
            console.log('✅ Panel de backups abierto');
        } else {
            console.warn('⚠️ Panel no encontrado en el DOM');
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error al abrir panel:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cierra el panel de backups
 */
function closeBackupsPanel() {
    try {
        const panel = document.getElementById('backupsPanel');
        if (panel) {
            panel.style.display = 'none';
            console.log('✅ Panel de backups cerrado');
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error al cerrar panel:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Inicializa el panel de backups
 */
async function initBackupsPanel() {
    try {
        // Cargar lista de backups
        await renderBackupsList();
        
        // Actualizar estado online/offline
        updateOnlineStatus();
        
        console.log('✅ Panel inicializado');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al inicializar panel:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Renderiza la lista de backups disponibles
 */
async function renderBackupsList() {
    try {
        const backups = await listAllBackups();
        
        // Actualizar contador
        document.getElementById('backupsCount').textContent = backups.length;
        
        // Mostrar/ocultar mensaje si no hay backups
        const noBackupsMessageEl = document.getElementById('noBackupsMessage');
        if (backups.length === 0) {
            noBackupsMessageEl.style.display = 'block';
        } else {
            noBackupsMessageEl.style.display = 'none';
        }
        
        // Renderizar cada backup
        const backupsListEl = document.getElementById('backupsList');
        if (backupsListEl) {
            backupsListEl.innerHTML = '';
            
            for (const backup of backups) {
                const item = document.createElement('div');
                item.className = 'backup-item';
                
                // Icono según fuente
                let sourceIcon = '💾';
                if (backup.source === 'Firebase') {
                    sourceIcon = '🌐';
                } else if (backup.source === 'IndexedDB') {
                    sourceIcon = '🗄️';
                }

                item.innerHTML = `
                    <span class="backup-source-icon">${sourceIcon}</span>
                    <div class="backup-info">
                        <div class="backup-date">
                            📅 ${formatDate(backup.date || backup.timestamp)}
                        </div>
                        <span class="backup-type-badge">${backup.type || 'Backup'}</span>
                    </div>
                    <div class="backup-actions">
                        <button class="action-btn btn-primary" onclick="window.viewBackupDetails('${backup.key}')">👁️</button>
                        <button class="action-btn btn-success" onclick="window.confirmRestoreFromItem('${backup.key}')">↩️</button>
                    </div>
                `;

                backupsListEl.appendChild(item);
            }

            // Actualizar estadísticas detalladas
            updateDetailedStats(backups);

        }

        console.log('✅ Lista de backups renderizada');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al renderizar lista:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Actualiza estadísticas detalladas
 */
function updateDetailedStats(backups) {
    try {
        const statsContent = document.getElementById('detailedStatsContent');
        
        // Contar por fuente y tipo
        const bySource = {};
        const byType = {};
        
        for (const backup of backups) {
            if (!bySource[backup.source]) bySource[backup.source] = 0;
            bySource[backup.source]++;
            
            if (!byType[backup.type]) byType[backup.type] = 0;
            byType[backup.type]++;
        }

        // Crear string de estadísticas
        const statsString = `Total: ${backups.length} backups
----------------------------------------
Por Fuente:
${Object.entries(bySource).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
----------------------------------------
Por Tipo:
${Object.entries(byType).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;

        if (statsContent) {
            statsContent.textContent = statsString;
        }

        console.log('✅ Estadísticas actualizadas');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al actualizar estadísticas:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Actualiza indicador online/offline
 */
function updateOnlineStatus() {
    try {
        const isOnline = isFirebaseOnline();
        
        if (isOnline) {
            document.getElementById('statOnlineBox').style.display = 'flex';
            document.getElementById('statOfflineBox').style.display = 'none';
        } else {
            document.getElementById('statOnlineBox').style.display = 'none';
            document.getElementById('statOfflineBox').style.display = 'flex';
        }

        console.log('✅ Estado online/offline actualizado');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al actualizar estado:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Confirma restauración desde un backup específico
 */
async function confirmRestoreFromItem(backupKey) {
    try {
        // Guardar el backup seleccionado para restaurar
        window.selectedBackupToRestore = backupKey;
        
        // Mostrar modal de confirmación
        const modal = document.getElementById('restoreConfirmModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Obtener detalles del backup para mostrar mensaje
            const backups = await listAllBackups();
            const backup = backups.find(b => b.key === backupKey);
            
            const messageDiv = document.getElementById('restoreConfirmMessage');
            if (messageDiv) {
                let sourceName = 'IndexedDB';
                if (backup.source === 'Firebase') sourceName = 'Firebase Firestore';
                
                messageDiv.innerHTML = `
                    <strong>Restaurar desde:</strong><br>
                    📅 ${formatDate(backup.date || backup.timestamp)}<br>
                    💾 Fuente: ${sourceName}<br>
                    <small style="color: #666;">Esto restaurará el estado del sistema a cómo estaba en ese momento.</small>
                `;
            }
        }

        console.log('✅ Confirmación de restauración mostrada');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al mostrar confirmación:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Ejecuta la restauración confirmada
 */
async function confirmRestore() {
    try {
        if (!window.selectedBackupToRestore) {
            throw new Error('No hay backup seleccionado para restaurar.');
        }
        
        const backups = await listAllBackups();
        const backup = backups.find(b => b.key === window.selectedBackupToRestore);
        
        // Cerrar modal
        const modal = document.getElementById('restoreConfirmModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Restaurar desde el backup seleccionado
        const result = await restoreFromAnyPoint(backup, state.currentUid);
        
        if (result.success) {
            console.log('✅ Restauración completada');
            
            // Guardar snapshot después de restaurar
            createSnapshot({ text: 'After Restore', date: new Date().toISOString() }, state.currentUid);
            
            notifyStateChange();
            window.renderTasks(); // Actualizar UI
            
            // Recargar lista de backups
            await renderBackupsList();
        } else {
            throw new Error(result.error || 'Error desconocido');
        }

        console.log('✅ Restauración completada con éxito');
        return result;
    } catch (error) {
        console.error('❌ Error al restaurar:', error);
        
        // Mostrar mensaje de error en el modal
        const modal = document.getElementById('restoreConfirmModal');
        if (modal) {
            const messageDiv = document.getElementById('restoreConfirmMessage');
            if (messageDiv) {
                messageDiv.innerHTML = `<strong style="color: #d32f2f;">Error:</strong> ${error.message}`;
            }
        }

        notifyStateChange();
        return { success: false, error: error.message };
    }
}

/**
 * Muestra detalles del estado actual (para visualización)
 */
async function viewCurrentState() {
    try {
        // Obtener snapshot más reciente o estado actual
        const snapshots = listSnapshots();
        
        let currentState;
        if (snapshots.length > 0) {
            // Usar el snapshot más reciente
            currentState = snapshots[0];
        } else {
            // Si no hay snapshots, usar estado actual
            currentState = { text: 'Current', date: new Date().toISOString() };
        }

        const report = await getFullReport(state.currentUid);
        
        // Crear objeto de visualización
        const viewData = {
            metadata: {
                key: currentState.key,
                date: formatDate(currentState.date || currentState.timestamp),
                source: currentState.source,
                type: currentState.type
            },
            overview: report.overview,
            stats: report.stats,
            recentOperations: report.recentOperations.slice(0, 5) // Últimos 5
        };

        const modal = document.getElementById('currentStateModal');
        if (modal) {
            const contentPre = document.getElementById('currentStateContent');
            if (contentPre) {
                contentPre.textContent = JSON.stringify(viewData, null, 2);
            }
            
            modal.style.display = 'flex';
        }

        console.log('✅ Estado actual visualizado');
        return { success: true, data: viewData };
    } catch (error) {
        console.error('❌ Error al obtener estado actual:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cerrar modal de confirmación de restauración
 */
function closeRestoreConfirmModal() {
    const modal = document.getElementById('restoreConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    window.selectedBackupToRestore = null;
}

/**
 * Cerrar modal de estado actual
 */
function closeCurrentStateModal() {
    const modal = document.getElementById('currentStateModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Exponer funciones globales para acceso desde HTML/CSS
window.createManualBackup = createManualBackup;
window.restoreFromLastBackup = restoreFromLastBackup;
window.createAutoSnapshot = createAutoSnapshot;
window.exportAllBackups = exportAllBackups;
window.cleanupOldBackups = cleanupOldBackups;
window.viewBackupDetails = viewBackupDetails;
window.confirmRestoreFromItem = confirmRestoreFromItem;
window.confirmRestore = confirmRestore;
window.viewCurrentState = viewCurrentState;
window.closeRestoreConfirmModal = closeRestoreConfirmModal;
window.closeCurrentStateModal = closeCurrentStateModal;

/**
 * Inicializa el panel de backups (llamado al abrir)
 */
async function initPanel() {
    try {
        // Cargar lista de backups
        await renderBackupsList();
        
        // Actualizar estado online/offline
        updateOnlineStatus();
        
        console.log('✅ Panel inicializado');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al inicializar panel:', error);
        return { success: false, error: error.message };
    }
}

// Exponer función de inicialización
window.initBackupsPanel = initPanel;
