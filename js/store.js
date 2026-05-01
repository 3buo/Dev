// ============================================
// STORE.JS - Estado Centralizado con Backups Offline
// ============================================
import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * IndexedDB como almacenamiento principal persistente (offline-first)
 */
const DB_NAME = 'ActivitiesAppDB';
const STORE_VERSION = 1;
const DB_VERSION = 1;

export const state = {
    currentUid: null, 
    masterPin: "1234", 
    tasks: [], 
    reminders: [], 
    balances: { facebank: 0, binance: 0, bs: 0 },
    expenses: [], 
    notes: [], 
    recurringTasks: [], 
    checklists: [], 
    tabOrder: [], 
    activityLog: {},
    syncStatus: 'offline', // 'online' | 'syncing' | 'offline' | 'error'
    lastSyncTime: null,
    currentBackupPoint: null
};

export let unsubSnapshot = null;

// ============================================
// INDEXEDDB SETUP (Offline Storage)
// ============================================

/**
 * Inicializa IndexedDB como almacenamiento principal persistente
 */
export async function initIndexedDB() {
    return new Promise((resolve, reject) => {
        if (window.indexedDB && !window.cordova) {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.error('Error al abrir IndexedDB:', request.error);
                state.syncStatus = 'error';
                resolve(); // Asegurar que la app siga funcionando
            };
            
            request.onsuccess = (event) => {
                const dbInstance = event.target.result;
                
                // Crear objeto store si no existe
                dbInstance.createObjectStore('userData', { keyPath: 'uid' });
                dbInstance.createObjectStore('backups', { keyPath: 'timestamp' });
                
                state.syncStatus = 'offline';
                console.log('✅ IndexedDB inicializado correctamente');
                resolve(dbInstance);
            };
            
            request.onupgradeneeded = (event) => {
                // Migraciones futuras si cambiamos la estructura
                const dbInstance = event.target.result;
                if (!dbInstance.objectStoreNames.contains('userData')) {
                    dbInstance.createObjectStore('userData', { keyPath: 'uid' });
                }
                if (!dbInstance.objectStoreNames.contains('backups')) {
                    dbInstance.createObjectStore('backups', { keyPath: 'timestamp' });
                }
            };
        } else {
            state.syncStatus = 'offline';
            console.warn('⚠️ IndexedDB no disponible, usando almacenamiento en memoria');
            resolve();
        }
    });
}

/**
 * Guarda datos en IndexedDB (almacenamiento principal)
 */
export async function saveToIndexedDB(uid, data) {
    try {
        const dbInstance = await initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['userData'], 'readwrite');
            const store = transaction.objectStore('userData');
            
            // Guardar o actualizar
            const request = uid ? 
                store.put({ uid, ...data }) : 
                store.add(data);
            
            request.onsuccess = () => {
                state.syncStatus = 'offline';
                console.log('✅ Datos guardados en IndexedDB');
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error al guardar en IndexedDB:', error);
        state.syncStatus = 'error';
        return Promise.resolve(); // No bloquear la app
    }
}

/**
 * Lee datos de IndexedDB
 */
export async function loadFromIndexedDB(uid) {
    try {
        const dbInstance = await initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['userData'], 'readonly');
            const store = transaction.objectStore('userData');
            const request = store.get(uid);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error al cargar de IndexedDB:', error);
        return Promise.resolve(null);
    }
}

/**
 * Limpia todos los datos de IndexedDB
 */
export async function clearIndexedDB() {
    try {
        const dbInstance = await initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['userData', 'backups'], 'readwrite');
            const store = transaction.objectStore('userData');
            const backupStore = transaction.objectStore('backups');
            
            // Borrar todo
            store.clear();
            backupStore.clear();
            
            transaction.oncomplete = () => {
                console.log('✅ IndexedDB limpiada completamente');
                resolve();
            };
        });
    } catch (error) {
        console.error('Error al limpiar IndexedDB:', error);
        return Promise.resolve();
    }
}

// ============================================
// LOCALSTORAGE SNAPSHOTS (Auto-backup Offline)
// ============================================

/**
 * Crea un snapshot automático del estado actual en LocalStorage
 * Se ejecuta cada vez que se guarda en cloud o IndexedDB
 */
export async function createSnapshot() {
    try {
        const timestamp = Date.now();
        const snapshotData = JSON.stringify({
            version: STORE_VERSION,
            timestamp,
            state: { ...state }, // Copia completa del estado actual
            metadata: {
                lastCloudSync: state.lastSyncTime || null,
                currentBackupPoint: state.currentBackupPoint || null
            }
        });
        
        const snapshotKey = `snapshot_${timestamp}`;
        localStorage.setItem(snapshotKey, snapshotData);
        
        console.log(`✅ Snapshot creado: ${snapshotKey} (${new Date(timestamp).toISOString()})`);
        return { timestamp, key: snapshotKey };
    } catch (error) {
        console.error('Error al crear snapshot:', error);
        state.syncStatus = 'error';
        return null;
    }
}

/**
 * Lista todos los snapshots disponibles en LocalStorage
 */
export function listSnapshots() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('snapshot_'));
    
    // Ordenar por timestamp (más reciente primero)
    return keys
        .map(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                return {
                    key,
                    timestamp: data.timestamp,
                    date: new Date(data.timestamp).toISOString(),
                    version: data.version,
                    size: localStorage.getItem(key).length
                };
            } catch (e) {
                return { key, timestamp: null, date: 'unknown', version: 'unknown', size: 0 };
            }
        })
        .sort((a, b) => b.timestamp - a.timestamp); // Más reciente primero
}

/**
 * Elimina un snapshot específico
 */
export async function deleteSnapshot(key) {
    try {
        localStorage.removeItem(key);
        console.log(`✅ Snapshot eliminado: ${key}`);
        
        // Actualizar estado si era el backup actual
        if (state.currentBackupPoint === key) {
            state.currentBackupPoint = null;
        }
        
        return true;
    } catch (error) {
        console.error('Error al eliminar snapshot:', error);
        return false;
    }
}

/**
 * Limpia todos los snapshots antiguos (opcional, mantener últimos N)
 */
export async function cleanupOldSnapshots(maxKeep = 10) {
    const allSnapshots = listSnapshots();
    const toDelete = allSnapshots.slice(0, Math.max(0, allSnapshots.length - maxKeep));
    
    for (const snapshot of toDelete) {
        await deleteSnapshot(snapshot.key);
    }
    
    console.log(`✅ Limpieza completada. Manteniendo ${Math.min(maxKeep, allSnapshots.length)} snapshots más recientes`);
}

// ============================================
// BACKUPS SYSTEM (Puntos de Restauración Previos)
// ============================================

/**
 * Crea un punto de restauración permanente en IndexedDB
 * Cada vez que se guarda en cloud o IndexedDB
 */
export async function createBackupPoint(uid, data) {
    try {
        const dbInstance = await initIndexedDB();
        
        // Guardar backup completo con timestamp y versión
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['backups'], 'readwrite');
            const store = transaction.objectStore('backups');
            
            const backupData = {
                uid,
                timestamp: Date.now(),
                date: new Date().toISOString(),
                version: STORE_VERSION,
                data: JSON.stringify({ ...state }), // Snapshot completo del estado
                metadata: {
                    lastCloudSync: state.lastSyncTime || null,
                    syncStatus: state.syncStatus
                }
            };
            
            const request = store.put(backupData);
            
            request.onsuccess = () => {
                console.log(`✅ Backup creado en IndexedDB: ${new Date(backupData.timestamp).toISOString()}`);
                
                // También guardar en LocalStorage como copia de seguridad adicional
                createSnapshot();
                
                resolve(backupData);
            };
            
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error al crear backup:', error);
        state.syncStatus = 'error';
        return null;
    }
}

/**
 * Lista todos los backups disponibles en IndexedDB
 */
export async function listBackups(uid) {
    try {
        const dbInstance = await initIndexedDB();
        
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['backups'], 'readonly');
            const store = transaction.objectStore('backups');
            
            // Filtrar por uid si se proporciona
            const request = uid ? 
                store.index('uid').getAll(uid) : 
                store.getAll();
            
            request.onsuccess = () => {
                return request.result.map(backup => ({
                    ...backup,
                    date: new Date(backup.timestamp).toISOString(),
                    size: backup.data.length
                }));
            };
            
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error al listar backups:', error);
        return [];
    }
}

/**
 * Elimina un backup específico
 */
export async function deleteBackup(uid, timestamp) {
    try {
        const dbInstance = await initIndexedDB();
        
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['backups'], 'readwrite');
            const store = transaction.objectStore('backups');
            
            // Buscar y eliminar por timestamp (dentro del uid filtrado si aplica)
            const backupToDelete = Array.isArray(timestamp) ? 
                store.getAll().result.find(b => b.uid === uid && b.timestamp === timestamp[0]) :
                store.get({ uid, timestamp }).result;
            
            if (backupToDelete) {
                const request = store.delete(backupToDelete);
                
                request.onsuccess = () => {
                    console.log(`✅ Backup eliminado: ${new Date(timestamp).toISOString()}`);
                    resolve(true);
                };
            } else {
                resolve(false); // No encontrado
            }
        });
    } catch (error) {
        console.error('Error al eliminar backup:', error);
        return false;
    }
}

/**
 * Limpia todos los backups antiguos (opcional, mantener últimos N)
 */
export async function cleanupOldBackups(uid, maxKeep = 10) {
    try {
        const allBackups = await listBackups(uid);
        const toDelete = allBackups.slice(0, Math.max(0, allBackups.length - maxKeep));
        
        for (const backup of toDelete) {
            await deleteBackup(uid, backup.timestamp);
        }
        
        console.log(`✅ Backup cleanup completado. Manteniendo ${Math.min(maxKeep, allBackups.length)} backups más recientes`);
    } catch (error) {
        console.error('Error en backup cleanup:', error);
    }
}

// ============================================
// RESTORE SYSTEM (Puntos de Restauración Previos)
// ============================================

/**
 * Restaura estado desde un snapshot específico (LocalStorage)
 */
export async function restoreFromSnapshot(timestampOrKey, uid = state.currentUid) {
    try {
        let snapshotData;
        
        // Buscar por timestamp o key
        if (typeof timestampOrKey === 'number') {
            const keys = listSnapshots();
            const snapshot = keys.find(s => s.timestamp === timestampOrKey);
            if (!snapshot) throw new Error('Snapshot no encontrado');
            
            snapshotData = JSON.parse(localStorage.getItem(snapshot.key));
        } else {
            // Buscar por key string
            const keys = listSnapshots();
            const snapshot = keys.find(s => s.key === timestampOrKey || 
                (s.timestamp === parseInt(timestampOrKey)));
            if (!snapshot) throw new Error('Snapshot no encontrado');
            
            snapshotData = JSON.parse(localStorage.getItem(snapshot.key));
        }
        
        // Restaurar estado
        Object.assign(state, snapshotData.state);
        state.currentUid = uid;
        state.syncStatus = 'restoring';
        
        console.log(`✅ Estado restaurado desde snapshot: ${new Date(timestampOrKey).toISOString()}`);
        
        // Guardar en IndexedDB y Cloud después de restaurar
        await saveToIndexedDB(uid, { ...state });
        await saveDataToCloud();
        
        state.syncStatus = 'offline'; // Inicialmente offline hasta re-sync
        
        return true;
    } catch (error) {
        console.error('Error al restaurar desde snapshot:', error);
        state.syncStatus = 'error';
        return false;
    }
}

/**
 * Restaura estado desde un backup específico (IndexedDB)
 */
export async function restoreFromBackup(timestamp, uid = state.currentUid) {
    try {
        const dbInstance = await initIndexedDB();
        
        return new Promise((resolve, reject) => {
            const transaction = dbInstance.transaction(['backups'], 'readonly');
            const store = transaction.objectStore('backups');
            
            // Buscar backup por timestamp (filtrando por uid si aplica)
            const request = uid ? 
                store.index('uid').getAll(uid).get({ uid, timestamp }) :
                store.get({ uid, timestamp });
            
            request.onsuccess = () => {
                const backupData = request.result;
                
                if (!backupData) {
                    console.error('Backup no encontrado');
                    resolve(false);
                    return;
                }
                
                // Restaurar estado
                Object.assign(state, JSON.parse(backupData.data));
                state.currentUid = uid;
                state.syncStatus = 'restoring';
                
                console.log(`✅ Estado restaurado desde backup: ${new Date(timestamp).toISOString()}`);
                
                // Guardar en IndexedDB y Cloud después de restaurar
                saveToIndexedDB(uid, { ...state }).then(() => 
                    saveDataToCloud().then(() => {
                        state.syncStatus = 'offline';
                        resolve(true);
                    })
                );
                
                return true;
            };
            
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error al restaurar desde backup:', error);
        state.syncStatus = 'error';
        return false;
    }
}

/**
 * Restaura estado desde el último backup disponible
 */
export async function restoreFromLastBackup(uid = state.currentUid) {
    const backups = await listBackups(uid);
    
    if (backups.length === 0) {
        console.warn('⚠️ No hay backups disponibles para restaurar');
        return false;
    }
    
    // Obtener el más reciente
    const lastBackup = backups[0];
    return await restoreFromBackup(lastBackup.timestamp, uid);
}

/**
 * Restaura estado desde un snapshot específico (LocalStorage) o backup (IndexedDB)
 * Versión unificada que busca en ambos lugares
 */
export async function restoreFromAnyPoint(timestampOrKey, uid = state.currentUid) {
    try {
        // 1. Intentar buscar en LocalStorage primero (snapshots más recientes)
        const snapshots = listSnapshots();
        let foundSnapshot;
        
        if (typeof timestampOrKey === 'number') {
            foundSnapshot = snapshots.find(s => s.timestamp === timestampOrKey);
        } else {
            // Buscar por key string o timestamp
            const keys = Object.keys(localStorage).filter(k => k.startsWith('snapshot_'));
            for (const key of keys) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.timestamp === timestampOrKey || 
                        (key.includes(timestampOrKey.toString()))) {
                        foundSnapshot = { key, ...data };
                        break;
                    }
                } catch (e) {}
            }
        }
        
        if (foundSnapshot) {
            return await restoreFromSnapshot(foundSnapshot.timestamp, uid);
        }
        
        // 2. Si no encontrado en LocalStorage, buscar en IndexedDB (backups permanentes)
        const backups = await listBackups(uid);
        let foundBackup;
        
        if (typeof timestampOrKey === 'number') {
            foundBackup = backups.find(b => b.timestamp === timestampOrKey);
        } else {
            // Buscar por key string o timestamp aproximado
            for (const backup of backups) {
                const timeDiff = Math.abs(new Date(backup.timestamp).getTime() - new Date(timestampOrKey).getTime());
                if (timeDiff < 60000) { // Diferencia menor a 1 minuto
                    foundBackup = backup;
                    break;
                }
            }
        }
        
        if (foundBackup) {
            return await restoreFromBackup(foundBackup.timestamp, uid);
        }
        
        console.warn('⚠️ Punto de restauración no encontrado en ningún almacén');
        state.syncStatus = 'error';
        return false;
    } catch (error) {
        console.error('Error en restore unificado:', error);
        state.syncStatus = 'error';
        return false;
    }
}

// ============================================
// SYNC STATUS & FALLBACK
// ============================================

/**
 * Actualiza estado de sincronización y guarda snapshot automático
 */
export async function updateSyncStatus(status, lastSyncTime = null) {
    state.syncStatus = status;
    state.lastSyncTime = lastSyncTime || new Date().toISOString();
    
    // Guardar snapshot automático después de cada cambio de estado
    await createSnapshot();
}

/**
 * Fallback automático a IndexedDB si Firebase falla
 */
export async function fallbackToOffline() {
    try {
        console.log('🔄 Cambiando a modo offline (fallback a IndexedDB)...');
        
        // Guardar estado actual en IndexedDB antes de cambiar
        await saveToIndexedDB(state.currentUid, { ...state });
        
        // Actualizar estado
        state.syncStatus = 'offline';
        
        console.log('✅ Modo offline activado. Usando IndexedDB como fuente primaria.');
        return true;
    } catch (error) {
        console.error('Error en fallback a offline:', error);
        state.syncStatus = 'error';
        return false;
    }
}

/**
 * Verifica si hay datos en IndexedDB para usar como fallback
 */
export async function checkOfflineAvailability(uid) {
    try {
        const localData = await loadFromIndexedDB(uid);
        return !!localData;
    } catch (error) {
        console.error('Error al verificar disponibilidad offline:', error);
        return false;
    }
}

// ============================================
// ORIGINAL FUNCTIONS (Updated with Offline Support)
// ============================================

/**
 * Inicializa datos en la nube (Firebase) y IndexedDB local
 */
export async function initCloudData(uid) {
    try {
        state.currentUid = uid;
        
        // 1. Intentar cargar de Firebase primero
        const docRef = doc(db, "userData", uid);
        const docSnap = await getDoc(docRef);
        
        let dataToUse;
        
        if (docSnap.exists()) {
            // Datos en cloud disponibles
            dataToUse = docSnap.data();
            
            // 2. Guardar también en IndexedDB local
            await saveToIndexedDB(uid, dataToUse);
            
            console.log('✅ Datos cargados desde Firebase Cloud');
        } else {
            // 3. Si no hay datos en cloud, crear documento y guardar en IndexedDB
            const defaultData = { 
                tasks: [], reminders: [], balances: {facebank:0,binance:0,bs:0}, 
                expenses: [], notes: [], recurringTasks: [], checklists: [], 
                tabOrder: [], activityLog: {}, masterPin: "1234" 
            };
            
            await setDoc(docRef, defaultData);
            dataToUse = defaultData;
            await saveToIndexedDB(uid, defaultData);
            
            console.log('✅ Documento creado en Firebase y guardado en IndexedDB');
        }
        
        // 4. Suscribirse a cambios en tiempo real (si hay conexión)
        unsubSnapshot = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const cloudData = doc.data();
                
                // Actualizar estado local solo si viene de cloud
                Object.assign(state, cloudData);
                
                // Guardar en IndexedDB después de cada cambio de cloud
                saveToIndexedDB(uid, cloudData).then(() => {
                    notifyStateChange(); // Fuerza re-render de la pestaña activa
                    const syncEl = document.getElementById('syncStatus');
                    if(syncEl) { 
                        syncEl.innerText = "☁️ Sincronizado"; 
                        syncEl.className = "cloud-status cloud-syncing"; 
                        setTimeout(() => syncEl.className = "cloud-status", 2000); 
                    }
                });
            } else {
                // Documento eliminado en cloud, usar IndexedDB local
                const loadPromise = loadFromIndexedDB(uid);
                loadPromise.then((localData) => {
                    if (localData) {
                        Object.assign(state, localData);
                        notifyStateChange();
                        
                        const syncEl = document.getElementById('syncStatus');
                        if(syncEl) {
                            syncEl.innerText = "💾 Local";
                            syncEl.className = "cloud-status cloud-local";
                        }
                    }
                });
            }
        });
        
        // 5. Actualizar estado de sincronización
        await updateSyncStatus('online', new Date().toISOString());
        
    } catch (error) {
        console.error('Error en initCloudData:', error);
        
        // Fallback a IndexedDB si falla Firebase
        const loadPromise = loadFromIndexedDB(uid);
        loadPromise.then((localData) => {
            if (localData) {
                Object.assign(state, localData);
                notifyStateChange();
                
                const syncEl = document.getElementById('syncStatus');
                if(syncEl) {
                    syncEl.innerText = "💾 Local";
                    syncEl.className = "cloud-status cloud-local";
                }
            } else {
                state.syncStatus = 'error';
            }
        });
    }
}

/**
 * Guarda datos en la nube (Firebase) y crea snapshot automático
 */
export async function saveDataToCloud() {
    if(!state.currentUid) return;
    
    const syncEl = document.getElementById('syncStatus');
    if(syncEl) syncEl.innerText = "Subiendo...";
    
    try {
        // Extraemos solo la data que queremos guardar
        const { currentUid, ...dataToSave } = state;
        
        await updateDoc(doc(db, "userData", currentUid), dataToSave);
        
        // 1. Guardar en IndexedDB local después de cada sync cloud
        await saveToIndexedDB(currentUid, { ...state });
        
        // 2. Crear snapshot automático (backup offline)
        await createSnapshot();
        
        console.log('✅ Datos guardados en Firebase Cloud + IndexedDB Local + Snapshot');
        
    } catch (error) {
        console.error('Error al guardar en cloud:', error);
        
        // Fallback: Guardar en IndexedDB aunque cloud falle
        await saveToIndexedDB(currentUid, { ...state });
        await createSnapshot();
        
        if(syncEl) syncEl.innerText = "💾 Local";
    }
    
    // Actualizar estado de sincronización
    await updateSyncStatus('online', new Date().toISOString());
}

/**
 * Registra actividad y crea snapshot automático
 */
export function recordActivity() {
    const today = new Date().toISOString().split('T')[0];
    state.activityLog[today] = (state.activityLog[today] || 0) + 1;
    
    // Guardar en cloud y IndexedDB después de cada actividad
    saveDataToCloud();
}

/**
 * Limpia datos locales (IndexedDB) manteniendo cloud como respaldo
 */
export function clearLocalData() {
    try {
        // Guardar estado actual en cloud antes de limpiar local
        if (state.currentUid) {
            const { currentUid, ...dataToSave } = state;
            setDoc(doc(db, "userData", currentUid), dataToSave);
        }
        
        // Limpiar IndexedDB
        clearIndexedDB();
        
        // Actualizar estado local
        Object.assign(state, { masterPin: "1234", tasks: [], reminders: [], balances: { facebank: 0, binance: 0, bs: 0 }, expenses: [], notes: [], recurringTasks: [], checklists: [], tabOrder: [], activityLog: {} });
        
        notifyStateChange();
        console.log('✅ Datos locales limpiados. Cloud mantenido como respaldo.');
    } catch (error) {
        console.error('Error al limpiar datos locales:', error);
    }
}

/**
 * Notifica cambios de estado a toda la app
 */
export const notifyStateChange = () => window.dispatchEvent(new Event('stateChanged'));
