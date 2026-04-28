// app.js - Versión lista para navegador con CDN de Supabase

import { state } from './state.js';
import { initCloudData, fetchData, addData, updateData, deleteData } from './supabase-actions.js';
import { renderHeader } from './components/header.js';
import { renderSidebar } from './components/sidebar.js';
import { renderDashboard } from './components/dashboard.js';

// Supabase URL y Publishable Key
const supabaseUrl = 'https://snruccregkwcsnptojvw.supabase.co';
const supabaseKey = 'sb_publishable_c-NOpMRqd0E2P-QW3IEfOw_MHRuq9FO';

// Creamos el cliente Supabase usando la variable global creada por CDN
export const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Inicialización de la App
document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
});

async function initApp() {
  try {
    // Inicializar datos desde Supabase
    await initCloudData();

    // Renderizar UI completa
    renderUI();

    // Configurar listeners de eventos
    setupEventListeners();

    console.log('App iniciada correctamente.');
  } catch (error) {
    console.error('Error al iniciar la app:', error.message);
    alert('Hubo un problema al iniciar la app. Revisa la consola.');
  }
}

// Renderizado de UI con componentes
function renderUI() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Limpiamos container
  appContainer.innerHTML = '';

  // Render de componentes
  renderHeader();
  renderSidebar();
  renderDashboard();

  // Crear formulario de ingreso de datos
  const formSection = document.createElement('section');
  formSection.id = 'form-section';
  formSection.innerHTML = `
    <input type="text" id="data-input" placeholder="Escribe algo..." />
    <button id="add-btn">Agregar</button>
  `;
  appContainer.appendChild(formSection);

  // Refrescar la lista inicial
  refreshDataList();
}

// Configuración de eventos
function setupEventListeners() {
  const addBtn = document.getElementById('add-btn');
  const dataInput = document.getElementById('data-input');

  addBtn.addEventListener('click', async () => {
    const value = dataInput.value.trim();
    if (!value) return alert('Escribe algo antes de agregar.');

    try {
      await addData({ content: value });
      dataInput.value = '';
      await refreshDataList();
    } catch (error) {
      console.error('Error al agregar dato:', error.message);
      alert('No se pudo agregar el dato.');
    }
  });
}

// Refrescar lista de datos
export async function refreshDataList() {
  const dataList = document.getElementById('data-list');
  if (!dataList) return;

  try {
    const data = await fetchData();
    dataList.innerHTML = data
      .map(item => `
        <div class="data-item" data-id="${item.id}">
          <span>${item.content}</span>
          <button class="edit-btn">✏️</button>
          <button class="delete-btn">🗑️</button>
        </div>
      `)
      .join('');

    // Configurar botones de edición y borrado
    dataList.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', handleEdit));
    dataList.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', handleDelete));
  } catch (error) {
    console.error('Error al cargar datos:', error.message);
    dataList.innerHTML = '<p>No se pudieron cargar los datos.</p>';
  }
}

// Editar dato
async function handleEdit(event) {
  const id = event.target.parentElement.dataset.id;
  const currentContent = event.target.parentElement.querySelector('span').textContent;
  const newContent = prompt('Editar contenido:', currentContent);
  if (newContent === null) return;

  try {
    await updateData(id, { content: newContent });
    await refreshDataList();
  } catch (error) {
    console.error('Error al editar dato:', error.message);
    alert('No se pudo editar el dato.');
  }
}

// Borrar dato
async function handleDelete(event) {
  const id = event.target.parentElement.dataset.id;
  if (!confirm('¿Estás seguro de borrar este dato?')) return;

  try {
    await deleteData(id);
    await refreshDataList();
  } catch (error) {
    console.error('Error al borrar dato:', error.message);
    alert('No se pudo borrar el dato.');
  }
}
