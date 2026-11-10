# DESIGN_SPEC.md — Taskify Design System "Cero Fricción" (v1.0)

> Especificación de diseño, psicología, color y tipografía para el refactor SaaS de Taskify.
> Creada a partir del brief del Product Owner. Cada fase del refactor cita las secciones de este documento.

---

## 1. Filosofía y principios

1. **Cero fricción**: cada interacción debe resolverse en ≤2 pasos visibles. Nada de paneles ocultos para acciones frecuentes (capturar una nota, registrar un gasto).
2. **Rapidez cognitiva**: jerarquía visual clara (cifra grande → etiqueta → acción), un solo acento primario, máximo 4 destinos de navegación primarios.
3. **Visual fresco día/noche**: temas Light y Dark completos, neutros "slate" modernos (no grises planos), acento índigo y superficies con bordes sutiles en lugar de sombras pesadas.
4. **Coherencia total**: los componentes consumen únicamente tokens (sección 2). Cero colores hardcodeados.
5. **Accesibilidad real**: contraste WCAG AA en ambos temas, targets táctiles ≥44px (≥48px en acciones críticas), foco visible, `prefers-reduced-motion` respetado.

---

## 2. Tokens de color (Light + Dark)

Nomenclatura obligatoria: `--bg-canvas`, `--bg-surface`, `--text-primary`, `--accent-primary`, etc.
Todos los pares texto/fondo cumplen WCAG AA (≥4.5:1 texto normal, ≥3:1 texto grande).

### 2.1 Dark (default)

| Token | Valor | Uso |
|---|---|---|
| `--bg-canvas` | `#0d1017` | fondo de la app |
| `--bg-inset` | `#0a0d13` | inputs, código, paneles empotrados |
| `--bg-surface` | `#151a24` | tarjetas y contenedores |
| `--bg-surface-raised` | `#1c2330` | elementos elevados (chips, filas, hover) |
| `--border-subtle` | `#272f40` | bordes de tarjetas |
| `--border-strong` | `#3d4a61` | bordes de inputs |
| `--text-primary` | `#f2f5fa` | texto principal (15.7:1 sobre canvas) |
| `--text-secondary` | `#a9b3c8` | texto de apoyo (9.4:1) |
| `--text-tertiary` | `#8b97ad` | metadatos/labels (6.7:1) |
| `--text-on-accent` | `#0d1017` | texto sobre `--accent-primary` (4.9:1) |
| `--accent-primary` | `#7c6cf0` | acción principal, selección, foco |
| `--accent-primary-hover` | `#8d80f4` | hover del primario |
| `--accent-secondary` | `#2dd4bf` | acento teal de apoyo |
| `--accent-sky` | `#4cc3ff` | acento informativo (Notas, voz) |
| `--status-success` | `#34d399` | éxito / completado |
| `--status-warning` | `#fbbf24` | advertencia |
| `--status-error` | `#f87171` | error / gasto / eliminar |
| `--brand-amber` | `#f5c344` | Binance / ámbar |
| `--brand-blue` | `#4d9fff` | Facebank / azul marca |

Tints (fondos translúcidos para chips/badges/hover) y efectos: `--tint-accent`, `--tint-sky`, `--tint-teal`, `--tint-success`, `--tint-warning`, `--tint-error`, `--tint-amber`, `--tint-neutral`, `--overlay`, `--overlay-strong`, `--shadow-color`, `--glow-color`, `--glow-sky`, `--ring-color`, `--chart-1..6`, `--chart-pastel-1..6`, `--chart-mono-1..6`, `--chart-fade`.

### 2.2 Light

| Token | Valor |
|---|---|
| `--bg-canvas` | `#f5f7fb` |
| `--bg-inset` | `#eceff6` |
| `--bg-surface` / `--bg-surface-raised` | `#ffffff` |
| `--border-subtle` | `#dde3ee` |
| `--border-strong` | `#b9c4d6` |
| `--text-primary` | `#141a26` (15.9:1) |
| `--text-secondary` | `#4a5468` (7.7:1) |
| `--text-tertiary` | `#5d6779` (5.3:1) |
| `--text-on-accent` | `#ffffff` (5.2:1 sobre accent) |
| `--accent-primary` | `#6357e8` |
| `--accent-secondary` | `#0d9488` |
| `--accent-sky` | `#0284c7` |
| `--status-success` | `#15803d` |
| `--status-warning` | `#b45309` |
| `--status-error` | `#dc2626` |
| `--brand-amber` | `#b45309` |
| `--brand-blue` | `#1d6fd6` |

**Reglas de uso**
- Prohibido usar hex/rgb/rgba directos fuera de `tokens.css`.
- El tema se activa con `data-theme="light"` en `<html>`; sin atributo = dark. Persistido en `localStorage('taskify-theme')`.
- El texto sobre `--accent-primary` usa siempre `--text-on-accent` (nunca blanco en dark, nunca negro en light).
- Colores de gráficos (canvas) se resuelven en JS desde las variables CSS (`--chart-*`) vía `getComputedStyle`, para mantener tokens como única fuente.

---

## 3. Tipografía

- **Familia**: `Inter` (Google Fonts, pesos 400/500/600/700/800, `display=swap`). Fallback: `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- **Escala** (tamaño / line-height):

| Token | Tamaño | Line-height | Uso |
|---|---|---|---|
| `--text-xs` | 12px | 1.4 | metadatos, badges (mínimo absoluto) |
| `--text-sm` | 14px | 1.45 | texto de apoyo |
| `--text-base` | 16px | 1.5 | texto base |
| `--text-lg` | 18px | 1.4 | subtítulos |
| `--text-xl` | 20px | 1.3 | títulos de sección |
| `--text-2xl` | 28px | 1.2 | cifras de saldo (Finanzas) |
| `--text-3xl` | 36px | 1.15 | títulos principales |

- **Regla**: ningún texto visible puede ser menor de 12px. Queda prohibido `0.7em`/`0.75em`/`0.8em` para texto: usar los tokens de escala.
- Una sola familia en toda la app (se elimina Poppins de Actividades). `--font-mono` para código.

---

## 4. Layout, espaciado y navegación

1. **Espaciado 8pt**: `--space-1: 4px · --space-2: 8px · --space-3: 12px · --space-4: 16px · --space-5: 20px · --space-6: 24px · --space-8: 32px · --space-10: 40px · --space-12: 48px · --space-16: 64px`. Paddings/margins/gaps usan solo esta escala.
2. **Contenedores**: el `body` usa `--bg-canvas`; las tarjetas usan `--bg-surface` con `border: 1px solid var(--border-subtle)` y sombra sutil (`--shadow-1`). Radio `--radius-md` (10px) para tarjetas.
3. **Navegación (máximo 4 destinos primarios)**:
   - Móvil (`≤900px`): **Bottom Bar** fija con 4 ítems primarios (Inicio, Tareas, Finanzas, Notas) + botón de desbordamiento "Más" (Checklists, Recordatorios, tema, cerrar sesión). Respeta `env(safe-area-inset-bottom)`.
   - Desktop (`>900px`): **Sidebar** fija a la izquierda con los mismos 4 ítems + "Más"; el contenido fluye a la derecha.
   - Orden persistente (drag & drop conservado solo para los 4 ítems primarios).
4. **Botones primarios**: fondo `--accent-primary`, texto `--text-on-accent`, `hover: --accent-primary-hover` + `transform: translateY(-1px)`, `focus-visible: --focus-ring` (anillo 3px `--ring-color`).

---

## 5. Componentes

1. **Notas — Captura Rápida**: input de captura en la parte superior del módulo (textarea de 1 línea auto-expandible + botón). Enter crea la nota al instante (misma función de guardado existente; cero lógica nueva de persistencia).
2. **Finanzas — Saldo**: las cifras de las tarjetas de saldo usan `--text-2xl` (28px, `tabular-nums`). Se añade un contenedor **Insights** con: gasto del mes vs. mes anterior, top 3 conceptos recurrentes y alertas de suscripciones probables (mismo concepto en ≥2 meses distintos). Render puro (no cambia el modelo de datos).
3. **Alarmas**: botones Posponer/Entendido con área táctil mínima **48×48px** y máximo contraste (`--text-on-accent` sobre `--accent-primary`; outline con `--accent-secondary`). El botón flotante 🔊 mide 48×48px.
4. **Microinteracciones**: transiciones de **150–200ms** en `transform` y `opacity` (botones, tarjetas, cambio de pestaña con fade+slide sutil). `prefers-reduced-motion` desactiva todo.

---

## 6. Accesibilidad

- Contraste WCAG AA en ambos temas (pares documentados en sección 2).
- Ningún texto < 12px.
- Targets táctiles ≥44px (`--target-min`), ≥48px en acciones críticas (`--target-critical`: posponer alarma, confirmar).
- `:focus-visible` con anillo de 3px en todo control interactivo.
- Estados hover NO como único canal de información (el estado activo de navegación usa color + peso + indicador).
- `@media (prefers-reduced-motion: reduce)` → duraciones 0.

---

## 7. Criterios de aceptación (QA)

1. **Tokens**: 0 hexadecimales/rgba hardcodeados en `components/**`, `js/**` (excepto colores de datos de usuario y resolución de canvas vía tokens), `index.html` y `global.css`. Única fuente: `tokens.css`.
2. **Contraste**: todos los pares texto/fondo ≥ AA en Light y Dark (verificados con cálculo de luminancia relativa).
3. **Tipografía**: Inter cargada y aplicada globalmente; ningún texto < 12px (grep de `font-size` < 12px vacío).
4. **Navegación**: máximo 4 destinos primarios; Bottom Bar en móvil y Sidebar en desktop; todos los módulos siguen accesibles (Checklists/Recordatorios vía "Más").
5. **Táctil y feedback**: targets ≥44px (48px en alarmas); hover/focus visibles en primarios; microinteracciones 150–200ms; `prefers-reduced-motion` respetado.
6. **Cero regresiones**: `node --check` OK en todos los `.js`; imports intactos; funciones de guardado/fetch/auth sin cambios de lógica; todos los módulos cargan.
