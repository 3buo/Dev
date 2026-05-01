// ============================================
// FIREBASE-CONFIG.JS - Configuración con Soporte Offline
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * Configuración de Firebase (puede ser cargada desde LocalStorage en modo offline)
 */
const defaultFirebaseConfig = { 
    apiKey: "AIzaSyBa-d5nGmHqiJV0Es9LgT1S3gW4iFRBpyw", 
    authDomain: "activities-app-web.firebaseapp.com", 
    projectId: "activities-app-web", 
    storageBucket: "activities-app-web.firebasestorage.app", 
    messagingSenderId: "494543385836", 
    appId: "1:494543385836:web:8774fd9e43948de535e1c9" 
};

/**
 * Exportaciones globales para acceso directo desde HTML/JS
 */
let appInstance = null;
let dbInstance = null;
let authInstance = null;

/**
 * Intenta cargar configuración de Firebase desde LocalStorage (offline)
 */
export function getFirebaseConfig() {
    // Primero intentar cargar desde LocalStorage (si se guardó previamente)
    const storedConfig = localStorage.getItem('firebase_config');
    
    if (storedConfig) {
        try {
            return JSON.parse(storedConfig);
        } catch (e) {
            console.warn('⚠️ Error al parsear firebase_config de LocalStorage, usando default');
        }
    }
    
    // Usar configuración por defecto
    return defaultFirebaseConfig;
}

/**
 * Guarda configuración de Firebase en LocalStorage para uso offline futuro
 */
export function saveFirebaseConfig(config) {
    try {
        localStorage.setItem('firebase_config', JSON.stringify(config));
        console.log('✅ Configuración de Firebase guardada en LocalStorage');
        return true;
    } catch (error) {
        console.error('Error al guardar firebase_config:', error);
        return false;
    }
}

/**
 * Actualiza configuración de Firebase y guarda en LocalStorage
 */
export function updateFirebaseConfig(config) {
    try {
        localStorage.setItem('firebase_config', JSON.stringify(config));
        console.log('✅ Configuración de Firebase actualizada');
        return true;
    } catch (error) {
        console.error('Error al actualizar firebase_config:', error);
        return false;
    }
}

/**
 * Inicializa Firebase con configuración (soporte offline)
 */
export async function initFirebase() {
    try {
        const config = getFirebaseConfig();
        
        // Guardar instancia de app para reutilización en modo offline
        appInstance = initializeApp(config);
        
        // Exportar instancias principales
        dbInstance = getFirestore(appInstance);
        authInstance = getAuth(appInstance);
        
        console.log('✅ Firebase inicializado (config cargada desde LocalStorage o default)');
        
        return { app: appInstance, db: dbInstance, auth: authInstance };
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        throw error;
    }
}

/**
 * Verifica si Firebase está disponible (online/offline)
 */
export function isFirebaseOnline() {
    return !!appInstance && dbInstance !== undefined;
}

/**
 * Limpia configuración de Firebase de LocalStorage
 */
export function clearFirebaseConfig() {
    try {
        localStorage.removeItem('firebase_config');
        console.log('✅ Configuración de Firebase eliminada de LocalStorage');
        return true;
    } catch (error) {
        console.error('Error al limpiar firebase_config:', error);
        return false;
    }
}

/**
 * Exporta las instancias globales para acceso directo desde HTML/JS
 */
export function getInstances() {
    return { app: appInstance, db: dbInstance, auth: authInstance };
}

// ============================================
// EXPORTS GLOBALES (para acceso directo desde HTML)
// ============================================
const firebaseConfig = defaultFirebaseConfig; // Default config
export const app = appInstance; // Will be set by initFirebase()
export const db = dbInstance;   // Will be set by initFirebase()
export const auth = authInstance; // Will be set by initFirebase()
