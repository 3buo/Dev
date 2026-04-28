// supabase-actions.js
import { setData } from './state.js';

// Configuración Supabase
const supabaseUrl = 'https://snruccregkwcsnptojvw.supabase.co';
const supabaseKey = 'TU_PUBLISHABLE_KEY';

// Usar variable global del CDN
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// CRUD
export async function initCloudData() {
  try {
    const { data, error } = await supabaseClient.from('mi_tabla').select('*').order('id', { ascending: true });
    if (error) throw error;
    setData(data);
    return data;
  } catch (error) {
    console.error('Error al inicializar datos:', error.message);
    throw error;
  }
}

export async function fetchData() {
  try {
    const { data, error } = await supabaseClient.from('mi_tabla').select('*').order('id', { ascending: true });
    if (error) throw error;
    setData(data);
    return data;
  } catch (error) {
    console.error('Error al obtener datos:', error.message);
    throw error;
  }
}

export async function addData(item) {
  try {
    const { data, error } = await supabaseClient.from('mi_tabla').insert([item]);
    if (error) throw error;
    await fetchData();
    return data;
  } catch (error) {
    console.error('Error al agregar dato:', error.message);
    throw error;
  }
}

export async function updateData(id, updatedItem) {
  try {
    const { data, error } = await supabaseClient.from('mi_tabla').update(updatedItem).eq('id', id);
    if (error) throw error;
    await fetchData();
    return data;
  } catch (error) {
    console.error('Error al actualizar dato:', error.message);
    throw error;
  }
}

export async function deleteData(id) {
  try {
    const { data, error } = await supabaseClient.from('mi_tabla').delete().eq('id', id);
    if (error) throw error;
    await fetchData();
    return data;
  } catch (error) {
    console.error('Error al borrar dato:', error.message);
    throw error;
  }
}
