<h1 align="center">Puente Digital EU · Diagnóstico de preparación para IA</h1>

<p align="center">
  Encuesta conversacional que evalúa si una pyme o autónomo está preparado para implantar IA
  (automatizaciones u otras), y le devuelve en el propio chat un diagnóstico y una lista
  priorizada de casos de uso por los que empezar.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-blue"></a>
  <img alt="pnpm v11" src="https://img.shields.io/badge/pnpm-v11-f69220">
</p>

---

## Qué es

Una herramienta de **captación y cualificación de leads** para la consultoría de implantación de IA
de Puente Digital EU. El visitante entra por un enlace (que se reparte por Instagram, email, etc.),
acepta el consentimiento y responde una entrevista guiada por un agente conversacional sobre cómo
trabaja su negocio. Al terminar deja sus datos de contacto y recibe, ahí mismo en el chat, una
lectura de su preparación para la IA y automatizaciones candidatas ordenadas por impacto y
viabilidad. Cada encuesta completada dispara un aviso por email al consultor, que además puede
revisar los leads en un panel.

El detalle está en `docs/` (`prd.md`, `architecture.md`, `data-model.md`, `rubrica.md`,
`user-flows.md`, `roadmap.md`, `testing.md`, `design-system.md`, `business.md`).

## Cómo funciona (resumen técnico)

- **Entrevista.** `POST /api/chat` conduce la conversación turno a turno con Claude
  (`claude-sonnet-5`), siguiendo `guion-entrevista.md` + `instrucciones-sistema.md`. Al cubrir los
  ocho bloques, el modelo emite una ficha estructurada; se parsea, se guarda en `respuestas` y la
  encuesta pasa a estado `respondida`.
- **Rúbrica.** `src/lib/rubrica/` calcula, de forma **determinista y testeada** (no la calcula el
  modelo), el nivel de preparación y el ranking de casos de uso. Reglas en `docs/rubrica.md`.
- **Diagnóstico.** `POST /api/cierre` recibe el contacto, ejecuta la rúbrica, pide a Claude que
  redacte el texto a partir del resultado ya calculado (`instrucciones-rubrica.md`), lo persiste y
  dispara el aviso al consultor (Resend).
- **Panel.** `/panel` (login con Supabase Auth + lista blanca `consultores`) lista las encuestas y
  muestra respuestas y diagnóstico de cada una.

## Stack

Next.js 16 (App Router) · Supabase (PostgreSQL + Auth) · Anthropic Claude API · Resend · Tailwind
CSS v4 · Vercel. Gestor de paquetes: **pnpm v11** (no `npm` ni `yarn`).

## Puesta en marcha (local)

1. **Dependencias:**
   ```bash
   pnpm install
   ```
2. **Variables de entorno:** copia `.env.example` a `.env.local` y rellena los valores (proyecto
   Supabase propio, clave de Claude, Resend, `IP_HASH_PEPPER` con `openssl rand -hex 32`).
3. **Base de datos:** en el SQL Editor de Supabase, ejecuta el contenido de
   `supabase/migrations/001_esquema_inicial.sql` y luego `002_retencion.sql`.
4. **Consultor del panel:** crea un usuario en Supabase → Authentication → Add user, y añade su
   fila:
   ```sql
   insert into consultores (id, nombre) values ('<uuid-del-usuario>', 'Tu nombre');
   ```
5. **Arrancar:**
   ```bash
   pnpm dev
   ```
   Landing en `http://localhost:3000`, panel en `http://localhost:3000/panel`.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` / `pnpm start` | Build de producción y arranque. |
| `pnpm test` | Tests (Vitest). |
| `pnpm lint` | ESLint. |
| `node scripts/verificar-persistencia.mjs` | Ejercita el esquema real contra PGlite. |
| `node scripts/verificar-cobertura.mjs` | Valida las tablas de cobertura de `docs/features/`. |

## Despliegue

Ver `docs/architecture.md` → "Despliegue". Resumen: repositorio en GitHub → proyecto en Vercel →
variables de entorno de producción en Vercel → la migración se aplica al Supabase de producción
desde su SQL Editor. El botón de deploy lo pulsa el responsable del proyecto, no el agente.

## Licencia

MIT — ver [LICENSE](./LICENSE).
