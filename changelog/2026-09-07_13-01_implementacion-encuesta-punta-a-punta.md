# Implementación de la encuesta de punta a punta (esquema, rúbrica, flujo, landing)

**Fecha:** 2026-09-07 13:01
**Tipo:** Feature
**Requisitos:** M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-08, M-12, M-13, M-15, RNF-05 (parcial); base de M-09

## Qué se hizo

Tareas 0.5 y 0.6 del roadmap y el grueso de F1–F4 + F7, en un empujón para tener una encuesta
probable en local (sin panel ni verificación formal de fichas todavía).

**Esquema (0.5):** `supabase/migrations/001_esquema_inicial.sql` reescrito con las 8 tablas de
`docs/data-model.md` (estado `respondida`, `respuestas.coste_ia`, renombrados,
`on delete cascade`). `scripts/verificar-persistencia.mjs` reescrito y en verde (cadena de
escritura, cascada de borrado, 10 restricciones).

**Rúbrica (F3):** nuevo `src/lib/rubrica/` — `tipos.ts`, `parseo.ts` (`contieneFicha` +
`parsearRespuestas` del contrato `FICHA-ENCUESTA-IA`), `catalogo.ts` (12 casos de uso),
`rubrica.ts` (`calcularRubrica` determinista: nivel por 3 señales, casos por impacto × viabilidad,
completitud). Tests: `rubrica.test.ts` (determinismo, umbrales, completitud), `parseo.test.ts`.

**Renombrado (0.6):** `src/lib/motor/` eliminado. `asesor` → `consultor` en email
(`aviso-consultor.ts`), variable de entorno (`CONSULTOR_NOTIFICATION_EMAIL`), persistencia y
tablas. `plan.ts` → `diagnostico.ts`. `crear_conversacion` → `crear_encuesta`,
`UMBRAL_CREAR_CONVERSACION` → `UMBRAL_CREAR_ENCUESTA`.

**Flujo (F1/F2/F4):**
- `src/lib/supabase/persistencia.ts` reescrito: `crearEncuesta`, `validarToken(estados)`,
  `persistirRespuestas` (+ estado `respondida`), `leerRespuestas`, `persistirCierre`
  (contacto → resultado → diagnóstico → `completada`), `registrarNotificacionConsultor`,
  `comprobarLimiteUso`.
- `POST /api/conversacion`: `crearEncuesta`.
- `POST /api/chat`: turnos de entrevista; al detectar `FICHA-ENCUESTA-IA` persiste `respuestas`,
  marca `respondida` y devuelve `fin_entrevista`.
- `POST /api/cierre` (nuevo): recibe token + contacto, calcula la rúbrica, pide el diagnóstico a
  Claude a partir del resultado ya calculado, persiste el cierre, dispara el aviso (no bloqueante).
- `instrucciones-rubrica.md` (nuevo): system prompt de la 2ª llamada (redacción del diagnóstico).
- Componentes: `chat-window.tsx` con fases entrevista → contacto → diagnóstico;
  `formulario-contacto.tsx` (4 campos obligatorios, M-08); `diagnostico.tsx` (markdown + badge de
  nivel + nota de alcance + copiar). Foco visible y `prefers-reduced-motion` (RNF-05 parcial).

**Landing (F7, pasada ligera):** copy de `Hero`, `ComoFunciona`, `ProteccionDatos`, `Footer`,
`ConsentScreen`, `DisclosureBanner` y `metadata` reescrito a "preparación para IA"; sin menciones
a inversión. `CtaButton` usa `accent-hover`.

## Estado de verificación

- `pnpm test` → 39/39. `pnpm build` → OK. `pnpm lint` → OK. `node scripts/verificar-persistencia.mjs` → OK.
- Pendiente: aplicar la migración `001` al proyecto Supabase (SQL Editor); recorrido manual
  completo; panel del consultor (F6); email real (F5); fichas de `docs/features/` y su verificación.

## Qué se modificó

Ver `git show`. Resumen: `supabase/migrations/001_*.sql`, `scripts/verificar-persistencia.mjs`,
`src/lib/rubrica/*` (nuevo), `src/lib/supabase/persistencia.ts`, `src/lib/claude/*`,
`src/lib/email/aviso-consultor.ts`, `src/lib/ip.ts`, `src/app/api/{chat,conversacion,cierre}/*`,
`src/components/chat/*`, `src/components/landing/*`, `src/app/layout.tsx`, `.env.example`,
`instrucciones-rubrica.md`. Eliminado `src/lib/motor/`, `plan.ts`, `aviso-asesor.ts`.

## Por qué

El usuario pidió priorizar tener una encuesta funcional y probable en local por encima del ritmo
de revisión documento a documento.
