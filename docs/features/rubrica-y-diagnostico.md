# Rúbrica y diagnóstico

**Estado:** Verificada
**Requisitos que cierra:** M-05, M-06, M-07, M-08, M-13
**Fecha de acuerdo:** 2026-09-07

## Qué se construye

`src/lib/rubrica/`: parseo de la ficha y `calcularRubrica` (determinista) → nivel de preparación,
señales, `completo`/`datos_faltantes`, ranking de casos de uso por impacto × viabilidad. Y el
cierre: `POST /api/cierre` recibe el contacto (4 campos obligatorios), ejecuta la rúbrica, pide a
Claude que redacte el diagnóstico a partir del resultado ya calculado
(`src/lib/claude/diagnostico.ts` + `instrucciones-rubrica.md`), lo persiste con su
`nota_alcance` fija, y lo muestra en el chat (`src/components/chat/diagnostico.tsx`).

## Decisiones tomadas

- El nivel mide preparación, no necesidad. `sin_preparar` se muestra como "punto de partida".
- `presupuesto_rango`/`apetito`/`decision_quien` no bloquean el diagnóstico.
- El modelo redacta pero no calcula: recibe el `ResultadoRubrica` como dato de entrada.
- Pesos y umbrales de la v1, a calibrar en Fase 2 (`version_rubrica`).

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-05 | `src/lib/rubrica/rubrica.ts`, `catalogo.ts` | `src/lib/rubrica/rubrica.test.ts` |
| M-06 | `src/lib/claude/diagnostico.ts`, `instrucciones-rubrica.md` | no verificable por interfaz: el diagnóstico lo redacta el modelo; se comprueba por revisión de que `diagnostico.ts` pasa el resultado ya calculado y por muestreo manual del texto |
| M-07 | `src/lib/rubrica/rubrica.ts` | `src/lib/rubrica/rubrica.test.ts` |
| M-08 | `src/app/api/cierre/route.ts`, `src/components/chat/formulario-contacto.tsx`, `src/lib/supabase/persistencia.ts` | `src/lib/supabase/persistencia.test.ts` |
| M-13 | `src/lib/claude/diagnostico.ts` (`NOTA_ALCANCE`) | no verificable por interfaz: texto fijo; se revisa que la constante no menciona inversión y que se guarda en `diagnosticos.nota_alcance` |

Nota M-08: `persistencia.test.ts` fija la cadena del cierre y el email normalizado; que el
diagnóstico no aparezca sin los 4 campos se comprueba en el recorrido manual y por revisión de la
validación en `src/app/api/cierre/route.ts`.

## Fuera de esta feature

Estimación de ahorro en €/horas (decidido: cualitativo en la v1). Casos de uso específicos de
sector (Fase 2).
