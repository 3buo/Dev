// sidebar.js

export function renderSidebar(containerId = 'app') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sidebar = document.createElement('aside');
  sidebar.id = 'sidebar';
  sidebar.innerHTML = `
    <nav>
      <ul>
        <li><button id="dashboard-btn">Dashboard</button></li>
        <li><button id="add-item-btn">Agregar Dato</button></li>
        <li><button id="logout-btn">Cerrar Sesión</button></li>
      </ul>
    </nav>
  `;

  container.prepend(sidebar);

  // Listeners de ejemplo
  document.getElementById('dashboard-btn').addEventListener('click', () => {
    console.log('Mostrar dashboard');
  });
  document.getElementById('add-item-btn').addEventListener('click', () => {
    console.log('Abrir formulario de agregar');
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    console.log('Cerrar sesión');
  });
}
