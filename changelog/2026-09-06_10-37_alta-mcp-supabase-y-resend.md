# Alta de los servidores MCP de Supabase y Resend

**Fecha:** 2026-09-06 10:37
**Tipo:** Configuración
**Requisitos:** Ninguno

## Qué se hizo

Se aplicó el "Protocolo de MCPs" del `CLAUDE.md` tras cerrar el borrador de `docs/architecture.md`:

- **Supabase MCP** — alcance `project`, servidor remoto por HTTP con OAuth. Añadido a `.mcp.json`
  como `{ "type": "http", "url": "https://mcp.supabase.com/mcp?read_only=true" }`. Sin credenciales
  en el repo; la autenticación es por `/mcp`. No operará hasta que exista el proyecto Supabase de
  este repo; entonces se le añadirá `&project_ref=<ref>` y se quitará `read_only=true` puntualmente
  para aplicar migraciones. Fuente: https://supabase.com/docs/guides/getting-started/mcp
- **Resend MCP** — alcance `local` (no toca el repo). El usuario lo da de alta con
  `claude mcp add --scope local resend -- npx -y resend-mcp --key "$RESEND_API_KEY"`, con
  `RESEND_API_KEY` en el entorno del shell o en `.env.local`. Fuente:
  https://resend.com/docs/mcp-server
- **Vercel MCP** — descartado: desplegar no es tarea del agente (límite de ejecución 2) y el resto
  de utilidades no compensa.

Los comandos se decidieron con el usuario uno a uno (alcance por servidor) y a partir de fuentes
oficiales de cada proveedor.

## Qué se modificó

- `.mcp.json` — añadido el servidor `supabase` (antes `{ "mcpServers": {} }`).
- `docs/architecture.md` — sección "12. MCPs del proyecto" reescrita: pasa de "pendiente" a la
  tabla de servidores con alcance, transporte, uso y credenciales, más las notas de activación.

## Por qué

El stack quedó fijado en el borrador de `docs/architecture.md` (Next.js + Supabase + Claude API +
Resend + Vercel), y el protocolo del proyecto marca este momento —arquitectura cerrada— como el
punto para decidir qué servicios del stack se operan vía MCP. Supabase es el que aporta valor real
durante el desarrollo (esquema y migraciones); Resend es una ayuda puntual de alcance local; Vercel
choca con la regla de que el despliegue lo hace el usuario.
