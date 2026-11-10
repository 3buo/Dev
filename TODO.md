# Taskify — Roadmap post-auditoría

## Design System "Cero Fricción" (DESIGN_SPEC.md, 2026-11-10)
- [x] `DESIGN_SPEC.md` creado (filosofía, tokens, tipografía Inter, layout, componentes, QA).
- [x] `tokens.css` v4: paleta oscura rediseñada a neutros cálidos tipo Notion (#191919/#202020/#2f3437, texto #ededed, acento azul #4a9df5) — sin violeta/neón "AI slop"; light armonizado a azul #1f6fba. Contrastes verificados por script (todos AA).
- [x] Tipografía Inter (Google Fonts) global; eliminado Poppins; nada < 12px.
- [x] Navegación: 4 primarios + **Checklists y Recordatorios en el panel izquierdo (sección "Más módulos")** en desktop; tema y logout en el pie del sidebar; Bottom Bar móvil mantiene 4 + menú "Más".
- [x] Modo claro operativo: toggle persiste en localStorage, aplica `[data-theme]` en <html>.
- [x] ~300 colores hardcodeados migrados a tokens (0 hex/rgba fuera de tokens.css, salvo fallbacks defensivos de canvas documentados, actualizados a paleta v4).
- [x] Notas: input de Captura Rápida (Enter crea la nota, misma persistencia).
- [x] Finanzas: saldos en `--text-2xl`; contenedor Insights; **recuperación de PIN "¿Olvidaste el PIN?"** (código Firebase al correo → nuevo PIN + confirmación, sin backend, funciona para cualquier usuario; primera configuración va directo a definir PIN).
- [x] Alarmas: **cola de alarmas** (sin sobrescritura), snooze según `snoozeMins` configurado (5/10/15/30), snooze también para hábitos (bug corregido), beep WebAudio de respaldo sin red/autoplay, vibración, `role=alertdialog` + foco inicial, botones ≥48×48px, recordatorios ordenados cronológicamente.
- [x] DevMode: **credenciales por usuario** (PBKDF2 en state.devAuth; crear al primer uso, recuperar con contraseña de Taskify o código al correo, sin credenciales en el bundle).
- [x] DevMode: **"Mi Estilo"** — asistente no-code de 3 pasos (fondo color/imagen del dispositivo ≤260KB optimizada, fuente global, animaciones clásicas/divertidas/silencio) persistido por usuario en Firestore; fix del bug de shadow-scoping (estilos por-elemento ahora en DOM light, antes nunca se aplicaban); grupo de animación por-elemento conectado.
- [x] QA: node --check OK (19 .js), 0 mojibake, contraste AA verificado en ambos temas, 0 texto <12px, 0 IDs duplicados.

## Correcciones aplicadas (auditoría Fase 2, 2026-11-10)
- [x] Boot: `js/store.js` reescrito vanilla sin zustand (Proxy vivo, exports para backup-ui, fecha local en actividad).
- [x] XSS: nuevo `js/escape.js`; escapado en notas, checklists, recordatorios, actividades, finanzas.
- [x] PIN: nuevo `js/pin.js` (PBKDF2 WebCrypto); modal de cambio de PIN; sin `masterPin` en claro (migración en store).
- [x] Credenciales dev: eliminadas del bundle (allowlist vacía en `devmode.js`).
- [x] Finanzas: bloque duplicado (219-300) eliminado; toast en vez de alert; timeout 8s en tasas; CSV anti-fórmulas.
- [x] Snooze persistente (`snoozeUntil`) en alarm.js + app.js.
- [x] Timezone: `nextTrigger` en ISO real; calendario compara en hora local.
- [x] A11y: tabs con role/aria, labels en auth/PIN, aria-labels, focus trap (`feedback.js`), reduced-motion, targets 44px, safe-areas.
- [x] Color: `tokens.css` v2 (pares WCAG AA); contrastes corregidos (botones azul/naranja, textos tenues); fondo claro de actividades corregido.
- [x] Copy: marca unificada a Taskify, errores de auth mapeados, "Checklist", "Vacío.", pluralización, locales es-VE.
- [x] Perf: eliminados marked y vis-network (~740 KB muertos); pretext pineado a 1.0.0; MutationObserver de devmode solo con sesión dev.
- [x] Export de datos disponible para usuarios autenticados (GDPR Art.20); import sigue gated a dev.
- [x] Dashboard itera `state.wallets`; microcopys y color de vacíos corregidos.
- [x] Purga: theme.js, voice.js, security.js, alarm.html, devmode.html/css, bulk-input.html eliminados.
- [x] `package.json` (type:module) y `firestore.rules` (dueño único, prohíbe masterPin) creados.

## Pendientes (requieren servicios externos o refactor mayor)
- [ ] F06 Billing: Stripe Checkout + Customer Portal + webhook (necesita cuenta Stripe).
- [ ] F21 Datos: mover expenses/notes/activityLog a subcolecciones paginadas (límite 1 MiB por doc).
- [ ] F38 Auditoría: eventos con timestamp en vez de contador por día.
- [ ] Firebase: desplegar `firestore.rules`; habilitar App Check y verificación de email en Auth.
- [ ] Medición: Lighthouse CI / PageSpeed para LCP/INP/CLS reales.
- [ ] F27 restantes: prompts numéricos no sensibles (saldo, tasa manual) → modales.
- [ ] F31: vía táctil para clasificar checklists (el menú Clasificar ya funciona en touch; falta DnD táctil).
- [ ] Cobertura de tests (hoy 0): al menos smoke test de store.js y de los parsers.
