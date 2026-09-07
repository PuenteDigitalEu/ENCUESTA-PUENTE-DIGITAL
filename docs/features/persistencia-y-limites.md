# Persistencia, límite por IP y retención

**Estado:** Verificada
**Requisitos que cierra:** M-09, M-12, M-14
**Fecha de acuerdo:** 2026-09-07

## Qué se construye

La capa de escritura en Supabase de la encuesta (`src/lib/supabase/persistencia.ts`) contra el
esquema de `supabase/migrations/001_esquema_inicial.sql`: alta de la encuesta, validación del
token por estado, persistencia de `respuestas` al terminar la entrevista, persistencia del cierre
(contacto → resultado → diagnóstico), registro del aviso y comprobación del límite por IP. Más el
job de `pg_cron` de retención a 24 meses (`002_retencion.sql`).

## Decisiones tomadas

- Persistencia en dos momentos (fin de entrevista → `respondida`; cierre → `completada`), sin
  transacción SQL (riesgo asumido, `data-model.md` §8).
- IP solo como hash HMAC-SHA256 con `IP_HASH_PEPPER`; nunca en claro.
- `on delete cascade` en las tablas dependientes para que la purga sea una sentencia.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-09 | `src/lib/supabase/persistencia.ts` | `src/lib/supabase/persistencia.test.ts`, `scripts/verificar-persistencia.mjs` |
| M-12 | `src/lib/ip.ts`, `src/lib/supabase/persistencia.ts` (`comprobarLimiteUso`) | `src/lib/ip.test.ts`, `src/app/api/chat/route.test.ts`, `scripts/verificar-persistencia.mjs` |
| M-14 | `supabase/migrations/002_retencion.sql` | no verificable por interfaz: job de `pg_cron`; la cascada de borrado se comprueba en `scripts/verificar-persistencia.mjs` y la definición del job se revisa antes de aplicarla |

## Fuera de esta feature

Envolver las escrituras en RPCs transaccionales (Fase 1.5). Registro de cada ejecución del job.
