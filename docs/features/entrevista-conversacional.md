# Entrevista conversacional

**Estado:** Verificada
**Requisitos que cierra:** M-01, M-02, M-03, M-04
**Fecha de acuerdo:** 2026-09-07

## Qué se construye

El recorrido del visitante hasta el fin de la entrevista: landing → `ConsentScreen` →
`POST /api/conversacion` (alta al consentir) → turnos de `POST /api/chat` conducidos por Claude
con `instrucciones-sistema.md` + `guion-entrevista.md`, una pregunta por turno, sin estado en
servidor, con tope de turnos. Al emitir el modelo la ficha `FICHA-ENCUESTA-IA` se parsea, se
persiste `respuestas` y la encuesta pasa a `respondida`.

## Decisiones tomadas

- Acceso sin cuentas para el visitante; el `token` es lo único que autoriza a escribir.
- El guion cubre 8 bloques; impacto cualitativo (no se cuantifican horas/€).
- La ficha de cierre se detecta por la línea marcador `FICHA-ENCUESTA-IA`.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-01 | `src/app/api/conversacion/route.ts`, `src/app/api/chat/route.ts` | no verificable por interfaz: ausencia de auth de visitante; se comprueba en el recorrido manual y revisando que las rutas de API no invocan `supabase.auth` |
| M-02 | `src/app/api/conversacion/route.ts`, `src/components/chat/consent-screen.tsx` | `src/app/api/conversacion/route.test.ts` |
| M-03 | `src/app/api/chat/route.ts` | `src/app/api/chat/route.test.ts` |
| M-04 | `guion-entrevista.md`, `src/lib/rubrica/parseo.ts` | `src/lib/rubrica/parseo.test.ts` |

Nota M-04: `parseo.test.ts` fija que el parseo reconoce los campos de los 8 bloques; que el guion
los cubra de verdad se revisa sobre `guion-entrevista.md`.

## Fuera de esta feature

Reanudar una encuesta a medias (`S-01`, Fase 1.5). Acumulación de coste turno a turno (Fase 2).
