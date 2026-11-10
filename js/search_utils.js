// ==========================================================================
// MÓDULO DE BÚSQUEDA INTELIGENTE (FUSE.JS)
// ==========================================================================
// Este módulo proporciona utilidades para búsquedas difusas (fuzzy search)
// en Notas y Actividades usando la librería Fuse.js.

import Fuse from 'fuse.js';

/**
 * Realiza una búsqueda difusa en un array de objetos basada en campos específicos.
 * @param {Array<Object>} data - Los datos a buscar.
 *include: Array<string> - Los campos que deben ser indexados.
 * @param {string} query - El término de búsqueda.
 * @returns {Array<Object>} - Los resultados coincidentes.
 */
export function fuzzySearch(data, query, include = ['title', 'content', 'description']) {
    if (!query || query.trim().length === 0) return data;
    
    const fuse = new Fuse(data, {
        keys: include,
        threshold: 0.4, // Ajuste de precisión (0.0 = exacto, 1.0 = muy difuso)
        useExtendedSearch: true,
        includeMatches: false
    });

    const results = fuse.search(query);
    // Fuse retorna un array de objetos con la propiedad 'item', extraemos el item.
    return results.map(r => r.item);
}

/**
 * Formatea un texto para que sea compatible con la búsqueda si es necesario
 * (Ej: limpiar HTML o normalizar caracteres).
 */
export function normalizeContent(content) {
    if (!content) return "";
    // Eliminar etiquetas HTML básicas para que la búsqueda no se vea afectada por ellas
    return content.replace(/<\/?[^>]+(>|$)/g, "").trim();
}
