# DevMode SaaS Upgrade TODO

## FASE 1 — Visual Flexbox Engine
- [x] Revisar arquitectura actual en `components/devmode` (shadow UI + lógica + persistencia local).
- [x] Diseñar controles visuales Flexbox en inspector flotante.
- [x] Implementar UI encapsulada (Shadow DOM) para Row/Column, Wrap, Justify, Align, Gap.
- [x] Conectar eventos para aplicar cambios en tiempo real al nodo seleccionado.
- [x] Persistir estilos flex en `state.dynamicStylesById` sin romper compatibilidad.
- [x] Sincronizar controles flex desde estilos actuales (computed + overrides).
- [ ] Validación funcional en ejecución (pendiente confirmación de compilación por el usuario).

## FASE 2 — Dynamic Data Binding
- [x] Añadir UI de “Vincular Dato Dinámico” en inspector.
- [x] Implementar popover de variables dinámicas.
- [x] Persistir binding por nodo sin romper contenido local.
- [x] Renderizar tokens `{{...}}` en tiempo real.

## FASE 3 — Element Tree Navigator
- [x] Añadir panel Tree Navigator encapsulado.
- [x] Construir árbol jerárquico desde DOM actual.
- [x] Sincronizar selección árbol ↔ lienzo.

## FASE 4 — Auto-Save & UX Feedback
- [x] Implementar autosave con debounce (1500ms).
- [x] Estado visual premium de guardado (gris/pulsante/verde).
- [x] Mantener compatibilidad con flujo manual existente.
