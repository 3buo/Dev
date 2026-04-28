// dashboard.js

import { state } from '../state.js';
import { refreshDataList } from '../app.js';

export function renderDashboard(containerId = 'app') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let dashboardSection = document.getElementById('dashboard');
  if (!dashboardSection) {
    dashboardSection = document.createElement('section');
    dashboardSection.id = 'dashboard';
    container.appendChild(dashboardSection);
  }

  dashboardSection.innerHTML = `
    <h2>Dashboard de Datos</h2>
    <div id="data-list" class="dashboard-list"></div>
  `;

  // Renderiza datos actuales
  refreshDataList();
}
