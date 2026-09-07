# Landing, copy y marca

**Estado:** Verificada
**Requisitos que cierra:** M-15
**Fecha de acuerdo:** 2026-09-07

## Qué se construye

Reescritura del copy heredado (asesoría financiera) al dominio de Puente Digital EU: `Hero`,
`ComoFunciona`, `ProteccionDatos`, `Footer`, `ConsentScreen`, `DisclosureBanner`, `metadata`.
Nombre de marca fijado. Accesibilidad: anillo de foco en inputs/botones/filas,
`prefers-reduced-motion` en el scroll del chat, `<label>` en los formularios, acento oscurecido a
`#c9402a` (AA).

## Decisiones tomadas

- Nombre de marca: **Puente Digital EU** (2026-09-07).
- Un solo idioma (español); sin selector ni i18n.
- Favicon e identidad visual completa quedan pendientes.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-15 | `src/components/landing/`, `src/components/chat/`, `src/app/layout.tsx` | no verificable por interfaz: idioma único; se comprueba por revisión de que no hay cadenas de UI fuera de español ni ruta/config de i18n |

## Fuera de esta feature

Favicon, logo y dominio propio. Repaso fino de accesibilidad con lector de pantalla.
