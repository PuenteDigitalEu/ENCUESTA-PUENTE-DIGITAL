<h1 align="center">Landing · Agente de diagnóstico financiero</h1>

<p align="center">
  Landing page con un chatbot de diagnóstico financiero inicial para una asesoría financiera.<br>
  El visitante llega por una URL enviada por email, completa una entrevista guiada y recibe en el
  propio chat un diagnóstico y una propuesta preliminar.
</p>

<p align="center">
  <a href="./LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-blue"></a>
  <img alt="pnpm v11" src="https://img.shields.io/badge/pnpm-v11-f69220">
</p>

---

## ¿Qué es esto?

Una asesoría financiera necesita una primera entrevista con cada persona interesada para recoger
datos básicos (ingresos, gastos, deudas, objetivo) antes de saber si el caso encaja y qué línea de
trabajo tiene sentido. Esta landing traslada esa primera entrevista a un agente conversacional:
el visitante llega desde un enlace que le manda el asesor por email, acepta el consentimiento de
tratamiento de datos, habla con el chat, y al cerrar la conversación recibe ahí mismo un
diagnóstico de su situación y una propuesta preliminar, generados por un motor de análisis
determinista sobre la política de inversión de la asesoría — nunca por el modelo de lenguaje.

Cada conversación completada se persiste en Supabase y dispara un aviso automático por email al
asesor, que decide después cómo continuar con ese lead (llamada, reunión) fuera del sistema. El
chat es de acceso público, así que cada IP tiene un límite de conversaciones y mensajes por día.

No es una herramienta de asesoramiento de inversión regulado: el chat lo deja explícito con un
disclaimer al inicio de la conversación y junto al propio diagnóstico. Es orientación educativa a
partir de los datos que da el visitante; la relación de asesoramiento real la establece el asesor
después.

**Estado actual:** Fase 1 (MVP) completa — landing, entrevista guiada, diagnóstico y propuesta
automáticos, consentimiento, persistencia, aviso al asesor y límite de uso, todos construidos y
verificados en vivo contra las APIs reales (Claude, Supabase, Resend). Pendiente: desplegar a
producción, y el panel de consulta del asesor (`S-01`, Fase 2 — deliberadamente en espera hasta
que revisar los emails de aviso uno a uno se quede corto en volumen; ver `docs/roadmap.md`).

---

## Requisitos previos

- Node.js y [pnpm](https://pnpm.io/) v11 — no se usa `npm` ni `yarn` en este proyecto.
- Un proyecto de [Supabase](https://supabase.com/) con la migración
  `supabase/migrations/001_esquema_inicial.sql` aplicada (base de datos + autenticación del futuro
  panel del asesor).
- Una clave de la [API de Anthropic (Claude)](https://console.anthropic.com/) para el agente
  conversacional.
- Una cuenta de [Resend](https://resend.com/) (gratuita) para el aviso automático al asesor.

## Variables de entorno

Copia `.env.example` como `.env.local` y rellena los valores reales. Nunca comitees `.env.local`
ni ningún archivo con credenciales.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase (segura para el navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio — solo servidor, nunca expuesta al cliente |
| `ANTHROPIC_API_KEY` | API de Claude, entrevista y redacción del plan |
| `RESEND_API_KEY` | Envío del aviso al asesor (`M-05`) |
| `ADVISOR_NOTIFICATION_EMAIL` | A qué email llega ese aviso |
| `IP_HASH_PEPPER` | Secreto para hashear la IP en el límite de uso (`M-08`) — cualquier cadena larga y aleatoria, p. ej. `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | URL pública del despliegue (`http://localhost:3000` en desarrollo) |

Detalle de cada decisión en `docs/architecture.md`.

## Instalación y desarrollo

```bash
pnpm install
pnpm dev
```

```bash
pnpm test          # suite completa (vitest, todo mockeado — no gasta cuota de ninguna API)
pnpm build          # build de producción + comprobación de tipos
node scripts/verificar-cobertura.mjs      # que ninguna ficha deje un requisito sin validar
node scripts/verificar-persistencia.mjs   # esquema de Supabase contra Postgres real (PGlite)
```

## Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx              → Landing pública
│   ├── chat/                 → UI del chat (consentimiento + entrevista + diagnóstico)
│   └── api/
│       ├── conversacion/      → POST: crea la conversación al aceptar el consentimiento (M-06)
│       └── chat/               → POST: un turno de la entrevista; al cerrar, calcula y persiste
│                                  el diagnóstico y avisa al asesor
├── components/
│   ├── landing/                → Hero, cómo funciona, protección de datos, CTA
│   └── chat/                   → ChatWindow, ConsentScreen, ChatBubble, MarkdownLite
├── lib/
│   ├── motor/                  → Cálculo determinista (R1-R10), nunca el modelo de lenguaje
│   ├── claude/                 → Cliente Anthropic, system prompts, redacción del plan
│   ├── supabase/                → Cliente con clave de servicio + todas las escrituras
│   ├── email/                   → Aviso al asesor (Resend)
│   └── ip.ts                    → Hash de IP + límite de uso

docs/             → documentación del proyecto: producto, arquitectura, modelo de datos,
                     design system, roadmap, flujos de usuario, testing
docs/features/    → fichas de las features acordadas, con su tabla de cobertura
changelog/        → registro de cada cambio importante
mejoras/          → ideas futuras no implementadas
scripts/          → verificación de cobertura y de persistencia contra Postgres real
supabase/migrations/ → migraciones SQL versionadas
```

## Documentos de trabajo del negocio

Además de `docs/`, la raíz del repo tiene los documentos originales que definen las reglas del
propio agente y de la asesoría — son la fuente de verdad del negocio, y el código se construye
traduciéndolos, no reescribiéndolos libremente:

- `instrucciones-sistema.md` — guion y contrato de datos de las Fases 1-2 (entrevista y ficha).
- `instrucciones-motor.md` — pipeline, catálogo de casos borde y entrega del plan (Fases 3-4).
- `plantilla-entrevista.md` — guion completo de la entrevista, pregunta a pregunta.
- `docs/criterio/reglas-recomendacion.md` — fuente única de criterio financiero del motor (R1–R10).

## Despliegue

Un único entorno de producción en [Vercel](https://vercel.com/) (ver `docs/architecture.md` →
"Estrategia de despliegue"). El despliegue lo ejecuta quien administra el proyecto, no el agente de
código.

1. Conecta este repositorio desde tu cuenta de Vercel (**Add New → Project**).
2. En **Environment Variables**, añade todas las de la tabla de arriba — con los valores reales de
   producción, no los de desarrollo local (en particular, `NEXT_PUBLIC_APP_URL` debe ser el dominio
   real, no `localhost`).
3. Confirma que la migración de Supabase está aplicada contra el proyecto de producción antes del
   primer despliegue (si usas un proyecto Supabase distinto al de desarrollo).
4. **Deploy.**

La URL resultante es la que se envía por email a cada persona interesada — no hay SEO ni tráfico
orgánico por diseño (ver `docs/prd.md`).

## Cómo contribuir

Este proyecto sigue el protocolo de `CLAUDE.md`: toda sesión de trabajo empieza leyendo `docs/`,
cada feature se acuerda en una ficha de `docs/features/` antes de construirse, y cada cambio
importante deja registro en `changelog/`. Si usas Claude Code, `CLAUDE.md` se lee automáticamente;
si no, léelo antes de tocar nada.

## Licencia

MIT © 2026 Rafael Moreno Vicens. Ver [`LICENSE`](./LICENSE).
