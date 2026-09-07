# Aviso al consultor y panel

**Estado:** Verificada
**Requisitos que cierra:** M-10, M-11, S-02, S-03
**Fecha de acuerdo:** 2026-09-07

## Qué se construye

- **Aviso (M-10):** al cerrar una encuesta, `POST /api/cierre` dispara `enviarAvisoConsultor`
  (Resend, HTTP) con el resumen del lead y registra el intento en `notificaciones_consultor`
  (`enviado`/`fallido`); un fallo no bloquea al visitante.
- **Panel (M-11, S-02, S-03):** rutas `/panel` con login de Supabase Auth (`@supabase/ssr`) y
  lista blanca `consultores` (`requerirConsultor`). Listado de encuestas `completada` y
  `respondida`, y detalle con contacto, respuestas agrupadas por los 8 bloques y el diagnóstico.
  El diagnóstico en el chat lleva botón "Copiar" (S-03).

## Decisiones tomadas

- El panel solo lee (`SELECT` con RLS); no edita estados de lead en la v1.
- Sin refresco de token por proxy: si la sesión caduca (~1 h), se vuelve a iniciar sesión.
- El panel muestra también las `respondida`, marcadas "sin contacto".

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-10 | `src/lib/email/aviso-consultor.ts`, `src/app/api/cierre/route.ts`, `src/lib/supabase/persistencia.ts` | `src/lib/supabase/persistencia.test.ts` |
| M-11 | `src/lib/supabase/servidor.ts` (`requerirConsultor`), `src/app/panel/` | no verificable por interfaz: sesión + lista blanca; se comprueba en el recorrido manual del panel con cuenta real (sin sesión redirige; con sesión sin fila en `consultores` no expone datos) |
| S-02 | `src/components/panel/respuestas-detalle.tsx` | no verificable por interfaz: render del panel; se comprueba en el recorrido manual que el detalle agrupa las respuestas por los 8 bloques del guion |
| S-03 | `src/components/chat/diagnostico.tsx` | no verificable por interfaz: botón de portapapeles; se comprueba en el recorrido manual que "Copiar" copia el markdown del diagnóstico |

Nota M-10: `persistencia.test.ts` fija el registro `enviado`/`fallido`. El envío real necesita un
dominio verificado en Resend y se comprueba con un envío de prueba pegado en el PR.

## Fuera de esta feature

Estados de lead y filtro (`C-02`), reenvío manual del aviso (`C-03`), export a PDF (`C-01`).
