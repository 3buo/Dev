// supabase-actions.js
import { supabase } from './app.js';
import { setData } from './state.js';

// ------------------------------
// Inicializar datos desde Supabase
// ------------------------------
export async function initCloudData() {
  try {
    const { data, error } = await supabase.from('mi_tabla').select('*').order('id', { ascending: true });
    if (error) throw error;
    setData(data);
    return data;
  } catch (error) {
    console.error('Error al inicializar datos:', error.message);
    throw error;
  }
}

// ------------------------------
// Obtener datos (fetch)
// ------------------------------
export async function fetchData() {
  try {
    const { data, error } = await supabase.from('mi_tabla').select('*').order('id', { ascending: true });
    if (error) throw error;
    setData(data);
    return data;
  } catch (error) {
    console.error('Error al obtener datos:', error.message);
    throw error;
  }
}

// ------------------------------
// Agregar dato
// ------------------------------
export async function addData(item) {
  try {
    const { data, error } = await supabase.from('mi_tabla').insert([item]);
    if (error) throw error;
    await fetchData(); // Actualizar estado
    return data;
  } catch (error) {
    console.error('Error al agregar dato:', error.message);
    throw error;
  }
}

// ------------------------------
// Actualizar dato
// ------------------------------
export async function updateData(id, updatedItem) {
  try {
    const { data, error } = await supabase.from('mi_tabla').update(updatedItem).eq('id', id);
    if (error) throw error;
    await fetchData(); // Actualizar estado
    return data;
  } catch (error) {
    console.error('Error al actualizar dato:', error.message);
    throw error;
  }
}

// ------------------------------
// Borrar dato
// ------------------------------
export async function deleteData(id) {
  try {
    const { data, error } = await supabase.from('mi_tabla').delete().eq('id', id);
    if (error) throw error;
    await fetchData(); // Actualizar estado
    return data;
  } catch (error) {
    console.error('Error al borrar dato:', error.message);
    throw error;
  }
}
