// header.js

export function renderHeader(containerId = 'app') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const header = document.createElement('header');
  header.innerHTML = `
    <div class="header-container">
      <img src="./assets/logo.png" alt="Logo" class="logo">
      <h1>Mi App Funcional</h1>
    </div>
  `;

  container.prepend(header);
}
