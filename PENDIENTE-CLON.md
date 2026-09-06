# Estado del clon — léeme antes de empezar

Este repo se creó el **2026-09-06** copiando el stack de `landing-agente-financiero` (una landing
con agente conversacional de diagnóstico financiero para una asesoría, ya en producción) para
reaprovecharlo en un proyecto distinto:

> Una **encuesta conversacional** que evalúa la **necesidad de una pyme o autónomo de implantar IA**
> (automatizaciones u otras implantaciones): guía a un responsable por una serie de preguntas sobre
> su negocio y, al cerrarla, le devuelve en el propio chat un diagnóstico de preparación para IA y
> una lista priorizada de posibles actuaciones.

El repo de la asesoría **no se toca**. Este es independiente: git nuevo, y necesita su propio
proyecto Supabase, su propio despliegue en Vercel y sus propias claves.

---

## Cómo arrancar (según `CLAUDE.md`)

`docs/` está vacío a propósito. **No escribas código todavía.** Empieza por
*"¿Qué quieres construir y para quién?"*, decide con el usuario qué documentos de `docs/` aplican
(tabla en `CLAUDE.md`) y redáctalos uno a uno con su visto bueno. Para este proyecto lo esperable es
"Producto" o "Producto con negocio detrás".

---

## Qué se hereda y funciona tal cual (~60-70%)

Todo esto está en `src/` y probado para el flujo de la asesoría. Sirve de andamio; la lógica de
dominio hay que reapuntarla.

- Landing pública + chat embebido, acceso por URL genérica sin cuentas de usuario.
- Consentimiento de tratamiento de datos antes de crear nada (`ConsentScreen` + `POST /api/conversacion`).
- Bucle de turnos `POST /api/chat`: sin estado en servidor, el cliente manda el historial completo
  cada turno, una pregunta cada vez, tope de turnos. Acumulación de historial ya con test de regresión.
- Persistencia en Supabase encadenada por un `token` de sesión: conversación → (ficha) → (informe) →
  (plan). Sin transacción SQL (riesgo asumido para MVP).
- Aviso automático por email al completarse (`src/lib/email/`, Resend por API HTTP).
- Límite de uso por IP: HMAC-SHA256 + `IP_HASH_PEPPER`, en `src/lib/ip.ts` (con tests).
- Renderizador markdown ligero para pintar el diagnóstico en el chat.
- Despliegue Vercel + Supabase; CI de cobertura (`.github/workflows/cobertura.yml`).
- Disciplina **"Claude conduce, no calcula"**: el resultado numérico vive en código determinista,
  el modelo solo redacta a partir de él.

## Qué hay que reescribir

- **Guion de la entrevista.** No hay `plantilla-entrevista.md` ni `instrucciones-sistema.md` (se
  borraron: eran financieros). Nuevo guion: tamaño y sector, procesos actuales, tareas repetitivas o
  con mucho dato, herramientas en uso, madurez digital del equipo, sensibilidad de datos y
  cumplimiento, presupuesto y apetito, quién decide.
- **`supabase/migrations/001_esquema_inicial.sql`** — se conserva como referencia, pero la tabla
  `fichas` trae ~30 columnas de ingresos/deudas/patrimonio que no aplican. Rehacer el esquema con
  las columnas del guion nuevo. Se reaprovechan las piezas transversales: `conversaciones`,
  consentimiento, `notificaciones_asesor`, tablas de límite por IP, función `es_asesor()`.
- **`src/lib/motor/`** (cálculo financiero determinista) y **`src/lib/motor/parseo.ts`**
  (`contieneFicha`, parseo de la ficha) → una **rúbrica**: de las respuestas a un nivel de
  preparación para IA + ranking de casos de uso por impacto × viabilidad. Mantener una capa
  determinista mínima aunque el resultado sea cualitativo, para que sea consistente y defendible.
- **`src/lib/claude/`** (segundo prompt que traduce cifras a plan) → redacción del diagnóstico de IA.
- **Copy y sistema de diseño**: rebranding completo. Marca sin decidir — no inventar nombre.
- Fuera el disclaimer regulatorio de inversión; a lo sumo un "orientación preliminar, no vinculante".

## Qué se borró al clonar

- Toda la documentación de `docs/` (prd, architecture, testing, design-system, data-model, roadmap,
  user-flows) y `docs/criterio/`. Queda solo `docs/features/README.md` (proceso).
- Todo `changelog/` salvo su `README.md`.
- Fixtures y documentos de trabajo financieros de la raíz (`plantilla-entrevista.md`,
  `instrucciones-*.md`, `ficha-*.md`, `informe-*.md`, `diagnostico-*.md`, etc.).
- **La capa de vigilancia de mercado (M-09) entera**: `supabase/migrations/0002_alertas_de_mercado.sql`,
  `src/lib/alertas/`, `scripts/revision.ts`, `scripts/verificar-revision.mjs`,
  `supabase/functions/`. También se limpió `supabase/config.toml`, `.env.example` y el script
  `revision` de `package.json`.
- `.mcp.json` se vació (tenía el MCP apuntando al Supabase de la asesoría).

## Ojo

- **El chat no arranca tal cual.** `src/lib/claude/system-prompt.ts` y `src/lib/claude/plan.ts`
  hacen `readFileSync` de `instrucciones-sistema.md` / `instrucciones-motor.md` en la raíz, que se
  borraron. `pnpm build` y `tsc` pasan (la lectura es en tiempo de ejecución), pero un turno de
  `/api/chat` dará error hasta que se escriban el guion nuevo y la rúbrica y se reapunten esos dos
  archivos.
- `.github/workflows/cobertura.yml` fallará hasta que `docs/prd.md` y las fichas de
  `docs/features/` existan de nuevo.
- No hay `.env.local` (no se copió: tenía secretos de la asesoría). Hay que crear uno con las claves
  del proyecto nuevo.
- `package.json` sigue llamándose por dentro… ya no: se renombró a `encuesta-ia`. Pero `README.md`
  todavía describe la asesoría — reescribir cuando el PRD esté.
- Borra este archivo cuando `docs/` esté montado y ya no aporte.
