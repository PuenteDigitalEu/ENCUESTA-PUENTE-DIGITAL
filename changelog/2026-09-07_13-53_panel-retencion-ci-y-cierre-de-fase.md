# Panel del consultor, retención, CI, y cierre de la Fase 1

**Fecha:** 2026-09-07 13:53
**Tipo:** Feature
**Requisitos:** M-11, S-02, S-03, M-14 (verificados); cierre de M-01..M-15, S-02, S-03

## Qué se hizo

**Panel del consultor (F6 · M-11, S-02, S-03):**
- `@supabase/ssr` como dependencia. `src/lib/supabase/navegador.ts` (cliente de navegador) y
  `src/lib/supabase/servidor.ts` (cliente de servidor + `requerirConsultor`: sesión válida + fila
  en `consultores`, o redirige a `/panel/login`).
- `src/app/panel/login/` (formulario de acceso), `src/app/panel/page.tsx` (listado de encuestas
  `completada`/`respondida`), `src/app/panel/[id]/page.tsx` (detalle: contacto, respuestas por los
  8 bloques, diagnóstico). `src/components/panel/respuestas-detalle.tsx`.

**Retención (M-14):** `supabase/migrations/002_retencion.sql` — job de `pg_cron` diario que purga
encuestas de >24 meses (cascada), marca `abandonada` las vencidas y limpia `limites_uso`.

**CI (0.8):** `.github/workflows/pruebas.yml` — `pnpm lint` + `pnpm test` + `pnpm build` en cada PR.

**Fichas de features:** `docs/features/{persistencia-y-limites, entrevista-conversacional,
rubrica-y-diagnostico, aviso-y-panel, landing-y-marca}.md`, todas **Verificada**;
`node scripts/verificar-cobertura.mjs` en verde (solo avisos de `S-01`/`C-*`, que son Fase 1.5).

**Cierre de fase:** `README.md` reescrito; `PENDIENTE-CLON.md` borrado; `CLAUDE.md`,
`docs/architecture.md` (§11 Despliegue con pasos GitHub + Vercel) y `docs/roadmap.md` al día.

## Qué se modificó

- Nuevo: `src/app/panel/**`, `src/components/panel/`, `src/lib/supabase/navegador.ts`,
  `src/lib/supabase/servidor.ts`, `supabase/migrations/002_retencion.sql`,
  `.github/workflows/pruebas.yml`, `docs/features/*.md`.
- Modificado: `package.json` + `pnpm-lock.yaml` (`@supabase/ssr`), `README.md`, `CLAUDE.md`,
  `docs/architecture.md`, `docs/roadmap.md`.
- Borrado: `PENDIENTE-CLON.md`.

## Estado de verificación

`pnpm test` 39/39 · `pnpm lint` OK · `pnpm build` OK · `verificar-persistencia.mjs` OK ·
`verificar-cobertura.mjs` OK. Pendiente: recorrido manual del panel con cuenta real,
`/security-review`, verificar dominio en Resend (F5), desplegar.

## Por qué

El usuario pidió cerrar todo lo pendiente para tener la herramienta lista para recibir tráfico
(Instagram → encuesta → leads en el panel).
