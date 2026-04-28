// app.js
import { createClient } from '@supabase/supabase-js';
import { state } from './state.js';
import { initCloudData, fetchData, addData, updateData, deleteData } from './supabase-actions.js';
import { renderHeader } from './components/header.js';
import { renderSidebar } from './components/sidebar.js';
import { renderDashboard } from './components/dashboard.js';

// ------------------------------
// Configuración de Supabase
// ------------------------------
const supabaseUrl = 'https://snruccregkwcsnptojvw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNucnVjY3JlZ2t3Y3NucHRvanZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjE5MDUsImV4cCI6MjA5Mjg5NzkwNX0.1Tl9DKHx8LMrHisaNvktl9fW3P0KRJnlVdQH3pdEMYo';
export const supabase = createClient(supabaseUrl, supabaseKey);

// ------------------------------
// Inicialización de la App
// ------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
});

async function initApp() {
  try {
    // Inicializar datos desde Supabase
    await initCloudData();
    
    // Renderizar componentes principales
    renderUI();

    // Configurar listeners de eventos
    setupEventListeners();

    console.log('App iniciada correctamente.');
  } catch (error) {
    console.error('Error al iniciar la app:', error.message);
    alert('Hubo un problema al iniciar la app. Revisa la consola.');
  }
}

// ------------------------------
// Renderizado de UI con componentes
// ------------------------------
function renderUI() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Limpiar container
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

  // Lista de datos (dashboard-list) se maneja dentro de dashboard.js
  refreshDataList();
}

// ------------------------------
// Listeners de eventos
// ------------------------------
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
      alert('No se pudo agregar el dato. Revisa la consola.');
    }
  });
}

// ------------------------------
// Refrescar lista de datos
// ------------------------------
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
    dataList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', handleEdit);
    });
    dataList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDelete);
    });

  } catch (error) {
    console.error('Error al cargar datos:', error.message);
    dataList.innerHTML = '<p>No se pudieron cargar los datos.</p>';
  }
}

// ------------------------------
// Editar dato
// ------------------------------
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

// ------------------------------
// Borrar dato
// ------------------------------
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
