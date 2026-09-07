# Flujos con estado

**Estado del documento:** Borrador para validar (v1)
**Última actualización:** 2026-09-07
**Acompaña a:** `docs/prd.md` · `docs/architecture.md` (§5 resumen del runtime) · `docs/data-model.md`

---

## Cómo se usa este documento

Cada flujo tiene un identificador `FLOW-NN` que el código cita en comentarios (p. ej.
`src/app/api/chat/route.ts` → "FLOW-01 → Casos de error"). Describe **qué cambia de estado**, en
qué orden, y qué pasa cuando algo falla — no el detalle de implementación, que vive en el código y
en las fichas de `docs/features/`.

Flujos de la v1:

| ID | Flujo | Actor |
|----|-------|-------|
| `FLOW-01` | El visitante completa la encuesta y recibe su diagnóstico | Visitante |
| `FLOW-02` | Aviso por email al consultor al completarse una encuesta | Sistema |
| `FLOW-03` | El consultor revisa los leads en el panel | Consultor |
| `FLOW-04` | Reanudar una encuesta a medias | Visitante |
| `FLOW-05` | Retención: purga automática a 24 meses | Sistema |

---

## FLOW-01 · El visitante completa la encuesta

**Requisitos:** `M-01`, `M-02`, `M-03`, `M-04`, `M-05`, `M-06`, `M-07`, `M-08`, `M-09`, `M-12`, `M-13`

### Precondiciones

- El visitante tiene el enlace (URL genérica). No hay cuenta ni login (`M-01`).
- Su IP no ha superado el límite de encuestas iniciadas en la ventana de 24 h (`M-12`).

### Camino feliz

```mermaid
sequenceDiagram
    participant V as Visitante
    participant UI as Chat (cliente)
    participant AC as POST /api/conversacion
    participant ACH as POST /api/chat
    participant CL as Claude API
    participant RB as src/lib/rubrica/
    participant DB as Supabase

    V->>UI: Abre /chat
    UI->>V: Pantalla de consentimiento (ConsentScreen)
    V->>UI: "Acepto y empiezo"
    UI->>AC: POST (sin body)
    AC->>DB: insert encuestas (consentimiento_en, consentimiento_version)
    AC-->>UI: { token }
    loop Un bloque temático por vez
        UI->>ACH: POST { token, messages (historial completo) }
        ACH->>DB: validar token + límite por IP
        ACH->>CL: system prompt (guion) + historial
        CL-->>ACH: una pregunta
        ACH->>DB: incrementar turnos_totales
        ACH-->>UI: { message }
    end
    CL-->>ACH: respuesta con la ficha de cierre
    ACH->>UI: señal de cierre (sin enseñar la ficha en crudo)
    UI->>V: FormularioContacto (nombre, email, teléfono, empresa)
    V->>UI: 4 campos válidos
    UI->>ACH: POST { token, messages, contacto }
    ACH->>RB: calcular(nivel_preparacion, casos_uso, completo, datos_faltantes)
    ACH->>CL: 2º prompt — redactar diagnóstico con el resultado YA calculado
    CL-->>ACH: markdown del diagnóstico
    ACH->>DB: persistirCierre: contacto → respuestas → resultado_rubrica → diagnostico; encuesta.estado = completada
    ACH-->>UI: { diagnóstico }
    UI->>V: Diagnóstico + nivel + ranking + DatosFaltantes (si aplica) + nota de alcance
    Note over ACH: dispara FLOW-02 (no bloquea esta respuesta)
```

### Cambios de estado

| Momento | Qué cambia |
|---------|------------|
| Acepta consentimiento | Fila nueva en `encuestas` (`estado = 'en_curso'`, `consentimiento_en`, `consentimiento_version`, `token`). Nada de datos personales todavía. |
| Cada turno de entrevista | `encuestas.turnos_totales += 1`. Fila nueva en `limites_uso` (`accion = 'enviar_mensaje'`). El historial vive en el cliente, no en el servidor. |
| Envía el formulario de contacto (4 campos válidos) | Se ejecuta la rúbrica y el 2º prompt, y **entonces** `persistirCierre` escribe, encadenado por el token: `contactos` → `respuestas` → `resultados_rubrica` → `diagnosticos`, y `encuestas.estado = 'completada'` + `finalizada_en`. |
| Respuesta al visitante | Se muestra el diagnóstico. Se dispara `FLOW-02`. |

### Casos de error

| Situación | Qué ve el visitante | Qué queda persistido |
|-----------|---------------------|----------------------|
| Cierra la pantalla de consentimiento sin aceptar | Nada; puede volver a entrar | **Nada.** Ninguna fila. |
| Límite por IP superado al crear la encuesta | 429, mensaje genérico ("no se pueden iniciar más… inténtalo más tarde"), sin decir el umbral | Nada nuevo. |
| Límite por IP superado a mitad de entrevista | 429 en ese turno, mensaje genérico | La encuesta sigue `en_curso`; puede reintentar cuando expire la ventana. |
| `token` inválido, expirado o de encuesta ya cerrada | 401, **mensaje genérico único** — no distingue el motivo | Sin cambios. |
| Falla la llamada a Claude (entrevista o redacción) | 502, "no se pudo procesar… inténtalo de nuevo" — nunca un 500 mudo ni detalle técnico | Sin cambios. Si falla la redacción del diagnóstico, **no** se ha llamado a `persistirCierre`. |
| Falla `persistirCierre` a mitad | 502; **el diagnóstico no se muestra** aunque ya estuviera redactado (un diagnóstico que no se guardó no se puede auditar) | Posible fila huérfana (sin transacción SQL, riesgo asumido — `architecture.md` §8). Se detecta por `console.error`. |
| Abandona en el formulario de contacto | — | La encuesta queda `en_curso`. **Las respuestas de la entrevista no se persisten** (solo existían parseadas en memoria). Ver decisión abierta. |
| Recarga la página a mitad | Pierde el hilo (comportamiento v1) | La encuesta queda `en_curso` hasta expirar. Ver `FLOW-04`. |

### Decisiones abiertas

- **Persistir las respuestas aunque no haya contacto.** Hoy, si el visitante abandona en el
  formulario, se pierde todo lo que respondió. Alternativa: guardar `respuestas` al detectar la
  ficha de cierre (antes del contacto), aceptando tener filas sin `contacto_id` ni resultado. A
  favor de guardar: el consultor ve "casi-leads". En contra: guarda datos de negocio de alguien
  que no dejó contacto ni pidió el diagnóstico. **Sin resolver.**
- **Reintento del formulario de contacto.** Si el email no valida en servidor, ¿se re-muestra el
  formulario con el error sin perder las respuestas parseadas? (Sí, pero hay que mantener ese
  estado en el cliente hasta el cierre.)

---

## FLOW-02 · Aviso por email al consultor

**Requisitos:** `M-10` · **Disparado por:** cierre con éxito de `FLOW-01`

### Pasos

1. `FLOW-01` termina de persistir el cierre.
2. Si `CONSULTOR_NOTIFICATION_EMAIL` no está configurada → se registra un aviso en el log y **no
   se hace nada más**. El visitante ya tiene su diagnóstico.
3. Se llama a `enviarAvisoConsultor(destinatario, { contacto, empresa, nivel, casos_uso… })`
   (Resend, API HTTP).
4. Se registra el intento en `notificaciones_consultor`:
   - envío confirmado → `estado = 'enviado'`, `enviado_en = now()`.
   - Resend devuelve error o la llamada lanza → `estado = 'fallido'`, `enviado_en = null`.
5. Si incluso el registro en `notificaciones_consultor` falla → solo `console.error`.

### Invariante

**Nada en este flujo bloquea ni revierte `FLOW-01`.** El diagnóstico del visitante ya está
calculado y persistido de forma independiente. Un fallo de email no se reintenta aquí (candidato a
`C-03`, reenvío manual desde el panel).

---

## FLOW-03 · El consultor revisa los leads en el panel

**Requisitos:** `M-11`, `S-02`

### Precondiciones

- El consultor tiene una cuenta en Supabase Auth **y** una fila en `consultores` con ese `id`.
  Ambas cosas: tener cuenta no basta (`es_consultor()`). El alta de la fila es manual (un
  `insert`), no hay pantalla de registro.

### Pasos

```mermaid
sequenceDiagram
    participant C as Consultor
    participant P as Rutas (panel)/
    participant AUTH as Supabase Auth
    participant DB as Supabase (RLS)

    C->>P: Abre /encuestas (o un enlace directo a /encuestas/:id)
    P->>AUTH: ¿hay sesión válida?
    alt Sin sesión
        P-->>C: Redirige a /login
        C->>AUTH: email + enlace mágico / contraseña
        AUTH-->>C: sesión
        C->>P: vuelve a /encuestas
    end
    P->>DB: SELECT encuestas completadas (policy: es_consultor())
    alt Sesión pero sin fila en consultores
        DB-->>P: 0 filas (RLS no deja ver nada)
        P-->>C: Listado vacío / aviso de acceso no autorizado
    else Consultor válido
        DB-->>P: filas
        P-->>C: Listado por fecha desc (empresa, contacto, nivel, nº casos)
        C->>P: Clic en una fila
        P->>DB: SELECT respuestas + resultado_rubrica + diagnostico de esa encuesta
        P-->>C: Detalle: contacto · respuestas por los 8 bloques (S-02) · diagnóstico como lo vio el visitante
    end
```

### Casos de error

| Situación | Resultado |
|-----------|-----------|
| Sin sesión, cualquier ruta de `(panel)/` | Redirige a `/login`. No se renderiza nada del panel. |
| Sesión válida pero sin fila en `consultores` | RLS devuelve 0 filas en toda tabla. El panel no expone datos; muestra un estado neutro. |
| Enlace directo a `/encuestas/:id` de una encuesta que no existe o no está completada | 404 / "no encontrada". |
| Sesión expirada a mitad de uso | La siguiente navegación redirige a `/login`. |

### Nota

El panel **solo lee** (`SELECT`). No edita ni borra nada en la v1 (los estados de lead son `C-02`,
Fase 1.5). Todas las escrituras del sistema siguen viniendo de `src/app/api/` con la clave de
servicio.

---

## FLOW-04 · Reanudar una encuesta a medias

**Requisito:** `S-01` (Fase 1.5) — aquí se documenta el comportamiento **actual de la v1** y el
**objetivo**.

### Comportamiento en la v1 (antes de `S-01`)

El `token` vive solo en el estado de React del chat, **nunca en `localStorage`** (decisión
heredada). Recargar la página, cerrar la pestaña o volver más tarde **pierde el hilo**: no hay
forma de retomar. La encuesta queda `en_curso` en Supabase hasta que `expira_en` la marca vencida
(30 días) y `FLOW-05` la limpia.

Es una pérdida aceptada para el MVP: el visitante empieza de cero, y como no se persistió nada de
sus respuestas (ver `FLOW-01`), no hay dato huérfano suyo salvo la fila de `encuestas` vacía.

### Objetivo de `S-01`

Con el `token` guardado en el navegador (`sessionStorage` o `localStorage`, a decidir en la
ficha), al volver:

1. El cliente recupera el `token` y pide el historial de esa encuesta.
2. Si la encuesta sigue `en_curso` y no ha expirado → se rehidrata la conversación y se puede
   seguir respondiendo.
3. Si está `completada`, `abandonada` o expirada → se empieza una nueva (mismo mensaje genérico
   que `FLOW-01`, sin explicar el motivo).

Requiere que el servidor pueda devolver el historial de una encuesta por su token — hoy no lo
hace (el historial solo vive en el cliente). Detalle en la ficha de `S-01`.

---

## FLOW-05 · Retención: purga automática a 24 meses

**Requisito:** `M-14`

### Pasos (job de `pg_cron` en Supabase)

1. Selecciona las `encuestas` con `iniciada_en < now() - interval '24 months'`.
2. Las borra. Por `on delete cascade` caen: `respuestas` → `resultados_rubrica` → `diagnosticos`,
   y `notificaciones_consultor` de esa encuesta.
3. En la misma pasada, marca `abandonada` (o borra) las `encuestas` con `estado = 'en_curso'` y
   `expira_en < now()` — encuestas que nadie completó ni va a completar.
4. Purga los `contactos` que ya no están referenciados por ninguna `encuesta` (consulta aparte,
   documentada junto al job: `contactos` no cae en cascada porque una persona puede tener varias
   encuestas).

### Garantías

- El plazo de 24 meses aparece en el texto de consentimiento (`consentimiento_version` permite
  auditar qué versión aceptó cada visitante).
- `limites_uso` tiene su propia limpieza por antigüedad (su ventana útil son 24 h; se puede purgar
  agresivamente). No contiene datos personales, solo hashes de IP.
- El job no toca `consultores`.

### Decisión abierta

- **Frecuencia y hora del job** (p. ej. diario de madrugada) y si se registra cada ejecución en
  algún sitio para poder confirmar que corrió. Se fija en la ficha de la feature de retención.
