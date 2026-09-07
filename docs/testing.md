# Estrategia de pruebas

**Estado del documento:** Vigente (v1)
**Última actualización:** 2026-09-07
**Acompaña a:** `docs/features/README.md` (tablas de cobertura) · `docs/prd.md` (requisitos)

---

## 1. Qué se prueba y qué no

**Se prueba con test automático:**

- La **lógica determinista**: la rúbrica (`src/lib/rubrica/`), el hash de IP y sus umbrales
  (`src/lib/ip.ts`), la acumulación de historial (`src/components/chat/historial.ts`), el parseo
  de la ficha que emite Claude.
- La **lógica de las rutas de API**: validación de entrada, token de sesión, tope de turnos,
  límite por IP, códigos de error, orquestación del cierre. Con las dependencias externas
  (Claude, Supabase, Resend) **mockeadas**.
- El **esquema de base de datos**: que las escrituras reales respetan columnas, `not null`,
  `check`, claves foráneas y `unique`, contra un Postgres de verdad (PGlite, no un mock).
- La **cobertura de las fichas**: que ningún requisito declarado se queda sin validación.

**No se prueba con test automático — se verifica a mano en local:**

- Que las llamadas **reales** a Claude, Supabase y Resend funcionan (los tests las mockean).
- El **recorrido del visitante** de punta a punta en el navegador (landing → consentimiento →
  entrevista → contacto → diagnóstico).
- La **calidad de la conversación y del diagnóstico** que redacta el modelo: que hace una
  pregunta por turno, que cita las cifras de la rúbrica sin recalcularlas, que declara lo que
  falta. Es comportamiento del modelo, no una función con salida fija — se comprueba por muestreo.
- El **panel** en el navegador con una sesión real de Supabase Auth.

Estas comprobaciones manuales son parte de "Validar" en el ciclo de la feature: se hacen contra
`localhost` (límite de ejecución 1 del proyecto) y su resultado se pega en el PR.

## 2. Herramientas

| Herramienta | Para qué | Corre en CI |
|-------------|----------|:-----------:|
| **Vitest** (`pnpm test`) | Tests unitarios y de ruta. Archivos `*.test.ts` junto al código. | Sí (ver §6) |
| **PGlite** (`@electric-sql/pglite`) | Postgres real en WASM para `scripts/verificar-persistencia.mjs`. | No (descarga el WASM, tarda) |
| **`scripts/verificar-cobertura.mjs`** | Valida las tablas de cobertura de `docs/features/` contra `docs/prd.md`. Solo Node nativo. | Sí (`.github/workflows/cobertura.yml`) |
| **`scripts/verificar-persistencia.mjs`** | Ejercita el esquema real de `supabase/migrations/` con inserts felices y casos negativos. | No — a mano antes de cerrar una feature que toque el esquema |
| **`pnpm build` / `pnpm lint`** | Que el proyecto compila y pasa ESLint. | Sí (ver §6) |

No hay framework de E2E (Playwright/Cypress) en la v1. Si el recorrido del visitante crece hasta
que la comprobación manual deje de ser fiable, se añade — decisión para `roadmap.md`, no para
ahora.

## 3. Niveles de prueba

### 3.1 Unitario — lógica determinista

El núcleo. `src/lib/rubrica/` es la pieza con más peso porque de ella sale el resultado que ve el
visitante (`M-05`).

- **Determinismo:** la misma entrada de respuestas produce siempre el mismo `nivel_preparacion` y
  el mismo orden de `casos_uso`. Un test lo fija con varios juegos de respuestas.
- **Casos límite:** respuestas mínimas, bloques enteros sin responder, valores en los bordes de
  cada umbral de la rúbrica.
- **Incompletitud (`M-07`):** cuando falta un dato que la rúbrica necesita, `completo === false`,
  `datos_faltantes` lista qué falta y por qué, y **no** se imputa un valor por defecto.
- **Trazabilidad:** el resultado lleva `version_rubrica`.

Mismo enfoque, menor tamaño, para `src/lib/ip.ts` (el HMAC no es reversible sin el pepper; falla
explícito si falta el pepper), `historial.ts` (acumulación correcta, ya con test de regresión
heredado) y el parseo de la ficha (campos, etiquetas `confirmado|estimado|pendiente`, anomalías).

### 3.2 Ruta / integración con mocks

`src/app/api/*/route.test.ts`. Verifican la **lógica de la ruta** sin credenciales reales:
`vi.mock` sustituye `@/lib/claude/*`, `@/lib/supabase/*` y `@/lib/email/*`.

Cubren: JSON inválido → 400; falta `token` → 400; token inválido/expirado/cerrado → 401 con
mensaje **genérico** (no distingue el motivo); `messages` mal formado → 400; conversación vacía →
400; tope de turnos; límite por IP → 429; fallo de una dependencia → 502 (nunca un 500 mudo); y la
orquestación del cierre: detecta la ficha, calcula la rúbrica, pide el diagnóstico con **otro**
system prompt, persiste, y dispara el aviso sin que un fallo de email tumbe la respuesta al
visitante.

### 3.3 Esquema contra Postgres real

`scripts/verificar-persistencia.mjs`. Aplica la migración en PGlite y ejercita la cadena de
escritura del cierre (`contacto → respuestas → resultado → diagnóstico → marcar encuesta`) más
casos negativos que **deben** fallar (email duplicado, `not null`, `check` fuera de lista, clave
foránea rota). Los juegos de columnas se mantienen a mano en paralelo a `persistencia.ts`: si
`persistirCierre` cambia una columna, este script se actualiza en el mismo commit.

Complementa —no sustituye— a `persistencia.test.ts` (mockeado), que sí importa el código real y
verifica que genera esas columnas.

### 3.4 Cobertura de fichas

`scripts/verificar-cobertura.mjs` (en CI). Comprueba que cada requisito de una ficha tiene tercera
columna: o la ruta de un test, o `no verificable por interfaz: <razón concreta>`. Detecta también
tests prometidos que nunca se escribieron cuando la ficha ya dice **Verificada**. Es estructural,
no semántico: no juzga si el test comprueba algo, solo si existe.

### 3.5 Manual en local

Antes de cerrar una feature: levantar la app (`pnpm dev`), recorrer el flujo afectado con
credenciales reales en `.env.local`, y pegar en el PR qué se hizo y qué se vio. Para el panel,
con una fila propia en `consultores` y una sesión de Supabase Auth.

## 4. Cuándo se escriben los tests

**Después de implementar, antes de pasar la ficha a Verificada.** No antes.

La ficha de la feature (`docs/features/`) declara en su tabla de cobertura **la ruta del test que
existirá**; el archivo se escribe cuando el código que valida ya está en pie. `verificar-cobertura`
no exige que el archivo exista mientras la ficha está *Acordada* o *En construcción* — solo al
llegar a *Verificada*.

Por qué en este orden y no en TDD estricto: en un flujo con un agente escribiendo el código, tests
rojos escritos antes de tiempo se normalizan y se aprende a ignorar el rojo. El compromiso es la
línea de la tabla de cobertura, y esa sí se escribe antes: dice qué se va a validar y cómo, y
`verificar-cobertura` no deja cerrar la feature sin cumplirla.

Excepción razonable: para la **rúbrica**, escribir los tests a la vez que la lógica es natural y
recomendable — es una función pura con entrada y salida claras, y el determinismo es justo lo que
hay que fijar cuanto antes.

## 5. Reglas que no se negocian

- **Un test que falla no se desactiva, no se salta (`skip`/`only`), no se vacía de aserciones**
  para que CI pase. Se arregla la causa. (CLAUDE.md → "Qué NO hacer".)
- **No se afirma que algo pasa sin haberlo ejecutado.** Si no se corrió el build o los tests, se
  dice "no ejecutado", no "pasa".
- **La evidencia es la salida del comando, no la casilla.** En el PR van las últimas líneas de
  `pnpm test`, no "los tests pasan".
- **Nada de datos inventados en los tests de la rúbrica.** Un caso de prueba con un dato ausente se
  modela como ausente (`etiqueta: 'pendiente'`), no rellenando el hueco para que el test sea más
  cómodo.
- **Los secretos no entran en los tests.** Se usan valores de prueba (`pepper-de-prueba`,
  `consultor@example.com`), nunca claves reales, ni siquiera recortadas.

## 6. Qué corre en CI

El clon solo traía `verificar-cobertura.mjs`. En la Fase 0 del roadmap (0.8) se añade un segundo
workflow que en cada `pull_request` ejecuta, además de la cobertura:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm test` (Vitest, todo mockeado — no necesita credenciales)
- `pnpm build`

**No** corre en CI: `verificar-persistencia.mjs` (descarga PGlite, lento) ni ninguna prueba contra
Claude/Supabase/Resend reales (no hay credenciales en CI y no deben ponerse). Esas son
verificación local.

## 7. Requisito → cómo se valida (orientativo)

La tercera columna definitiva la fija la ficha de cada feature. Esta tabla es el punto de partida.

| Req. | Cómo se valida |
|------|----------------|
| `M-01` | `no verificable por interfaz`: ausencia de auth de visitante. Recorrido manual + revisión de que `/api/*` no invoca `supabase.auth`. |
| `M-02` | Test de ruta `/api/conversacion` (crea con `consentimiento_en` de servidor) + test de componente `ConsentScreen` (no llama a la API sin aceptar). |
| `M-03` | Tests de ruta `/api/chat` (tope de turnos, sin persistir historial). "Una sola pregunta por turno" → muestreo manual + revisión del guion. |
| `M-04` | Test estructural de `guion-entrevista.md` (los 8 bloques) + test del parseo (reconoce los 8). Parte → `no verificable por interfaz`: cobertura temática, revisión. |
| `M-05` | Tests unitarios de `src/lib/rubrica/`: determinismo, umbrales, versión. Revisión de que el prompt del diagnóstico **recibe** los valores, no los pide. |
| `M-06` | Test de ruta: la 2ª llamada a Claude lleva el objeto de rúbrica y un system prompt propio. "Cita el mismo nivel" → muestreo manual. |
| `M-07` | Test unitario de la rúbrica (`completo=false`, `datos_faltantes`) + test de render del diagnóstico (muestra la sección de lo que falta). |
| `M-08` | Test de integración del cierre: sin los 4 campos válidos no hay diagnóstico; con ellos, se persisten y la encuesta pasa de `respondida` a `completada`. |
| `M-09` | `persistencia.test.ts` (mocks) + `verificar-persistencia.mjs` (esquema real): al terminar la entrevista se persiste `respuestas` + `estado = 'respondida'`; al cerrar, se recuperan por token contacto, resultado y diagnóstico. |
| `M-10` | Tests de ruta `/api/chat`: un email por cierre, registro `enviado`/`fallido`, no bloquea al visitante. + `aviso-consultor.test.ts`. |
| `M-11` | Test de integración del layout de `(panel)/`: sin sesión → redirige; con sesión sin fila en `consultores` → no expone; con ambas → lista y detalle. |
| `M-12` | `ip.test.ts` (HMAC no reversible, falla sin pepper) + tests de ruta (429) + `verificar-persistencia.mjs` (no hay IP en claro en ninguna tabla). |
| `M-13` | Test de que `diagnosticos.nota_alcance` es el texto fijo y aparece en el render; no contiene "inversión"/"financiero". |
| `M-14` | `no verificable por interfaz`: job de `pg_cron`. Se comprueba con una consulta de purga sobre un PGlite sembrado con filas de >24 meses + revisión de la definición del cron. Test estructural de que el texto de consentimiento menciona "24 meses". |
| `M-15` | `no verificable por interfaz`: idioma único. Revisión + ausencia de ruta/config de i18n. |
| `S-01` | Test de ruta/integración: con el token de una encuesta `en_curso` no expirada, se recupera el historial. |
| `S-02` | Test de render del detalle en el panel: respuestas agrupadas por los 8 bloques. |
| `S-03` | Test de componente: el control copia el diagnóstico al portapapeles. |
| `C-01`–`C-03` | Se definen si entran; PDF y estados de lead son candidatos a `no verificable por interfaz` parcial (generación de fichero, cambio de estado en BD). |

## 8. Decisiones abiertas

- **Umbral de cobertura de código.** Propuesta: sin porcentaje global obligatorio, pero
  `src/lib/rubrica/` cerca del 100 % de ramas. Se afina cuando la rúbrica exista.
- **E2E.** Fuera de la v1; se reevalúa si el flujo del visitante se vuelve difícil de comprobar a
  mano (`roadmap.md`).
