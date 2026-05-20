# TODO - DevMode Modernización (Fase 1: Encapsulamiento Shadow DOM + Bridge)

## Plan aprobado

- [x] Paso 1: Crear `components/devmode/devmode-shadow.js` con host + ShadowRoot y render encapsulado del login/panel.
- [x] Paso 2: Migrar estilos de `components/devmode/devmode.css` al ShadowRoot (scoped, sin contaminación global).
- [x] Paso 3: Eliminar handlers inline (`onclick`) del markup devmode y reemplazar por listeners internos.
- [x] Paso 4: Refactor de `components/devmode/devmode.js` para desacoplar globals y exponer interfaz puente (compatibilidad temporal).
- [x] Paso 5: Encapsular inyección dinámica de estilos del builder dentro del ShadowRoot.
- [x] Paso 6: Mantener persistencia (`localStorage`) con capa de estado interna reactiva (sin romper formato actual).
- [x] Paso 7: Actualizar `index.html` para iniciar devmode por bridge y retirar CSS global legacy de devmode.
- [ ] Paso 8: Verificación manual de flujo completo: Alt+Shift+D, login, inspector, guardar, reset, factory reset, override de texto.
