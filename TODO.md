# TODO - DevMode Evolución 2026 (Draggable Persistent UI)

## Plan aprobado (iteración actual)

- [ ] Paso 1: Implementar adaptador de pipeline tipo `actions.setProp` para persistencia implícita de inline editing (onInput/onBlur, sin botón aplicar texto).
- [ ] Paso 2: Refactorizar menú contextual a panel flotante arrastrable con cabecera y grip `⋮⋮`.
- [ ] Paso 3: Añadir tabs compactas: Tipografía, Apariencia/Fondo, Layout, Data/Acciones.
- [ ] Paso 4: Conectar todos los controles a guardado en tiempo real por `data-dev-id` sobre estado V2.
- [ ] Paso 5: Mantener compatibilidad legacy de lectura y no romper serialización previa.
- [ ] Paso 6: Validación funcional final (flujo inline persistente + draggable + tabs + persistencia por nodo).
