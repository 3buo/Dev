# 项目持久记忆 Project Memory

> 本文件由 dsh-memoir 插件维护：记录本项目历次会话的工作归纳、经验教训与行动指南，
> 作为未来 AGENTS 接手本项目时的行动指南；它是人类可读的投影，不是 system prompt 的完整注入内容。
> 新会话只注入有界的 Hot Memory，完整历史通过 memoir_read 按需检索。

## 工作记录 Work Log

- [2026-11-09 06:51] [工作记录] 项目架构审计与 SaaS 就绪诊断总结 — ### 工作记录 (Work)
- 完成了项目的全面架构审计，识别出核心模块（活动、清单、提醒、财务、笔记）及当前基于 Firebase + LocalStorage 的技术栈。
- 识别了当前采用的延迟加载 (Lazy Loading) 和命令调色板 (Command Palette) 作为核心交互亮点。

### 经验教训 (Lessons)
- **安全风险**：目前使用 `innerHTML` 加载模块和用户内容存在 XSS 风险，SaaS 化必须引入 DOMPurify 或类似的净化机制。
- **性能瓶颈**：当前的定时器驱动的警报系统在处理大规模数据时可能引起 UI 阻塞，建议未来考虑 Web Workers。
- **架构扩展性**：目前的全局 `state` 对象在模块增加后维护成本较高，需考虑引入 Zustand 或 Redux。

### 行动指南 (Actions)
- **UI/UX**：建立统一的 Design System（组件库、颜色规范）以确保跨模块一致性，并开发一个聚合型的 Dashboard 作为首屏。
- **后端/架构**：引入状态管理库处理复杂数据流，并优化云端同步逻辑（处理冲突解决）。
- **安全性**：立即加入 HTML 输入过滤，并配置细粒度的 Firebase Security Rules。
- **产品策略**：加入“连续完成” (Streaks) 和成就系统以提升用户留存。
- [2026-11-09 10:16] [工作记录] Refactorización de UI y Dashboard Móvil — Se implementó el Dashboard de Smart Home responsivo y se refactorizaron los componentes de Actividades y Finanzas para un diseño mobile-first, integrándolos en la navegación principal.

## 经验教训 Lessons Learned

- [2026-11-09 07:31] [经验教训] Pivote de estrategia por fallos de escritura en unidad E: — ### 经验教训 (Lessons)
- **Filesystem Constraint**: Identifidado un problema de permisos o ruta larga en la unidad `E:` que impide la creación de archivos nuevos (`write`). Se debe evitar intentar crear archivos y optar por `edit` sobre archivos existentes para este entorno específico.
- **Strategy Pivot**: La estrategia de "Inyección de Mejoras" es más robusta para este escenario, permitiendo implementar XSS protection, Dashboard y lógica reactiva sin depender de la creación de archivos `js/store.js` o `js/security.js`.

### 行动指南 (Actions)
- **XSS Protection**: Inyectar una función de sanitización en `js/app.js` y aplicarla en la carga de todos los módulos HTML.
- **Professional Dashboard**: Modificar `js/app.js` para renderizar un dashboard de resumen como la pestaña por defecto, unificando datos de finanzas, tareas y hábitos.
- **Reactive UI**: Implementar un sistema de suscripción de eventos en `js/app.js` para asegurar que los cambios en el estado refresquen la UI sin intervención manual del usuario.
- **UI Refactoring**: Aplicar mejoras de diseño (Cards, Grids, Badges) directamente en los archivos `.html` de los componentes actuales.
