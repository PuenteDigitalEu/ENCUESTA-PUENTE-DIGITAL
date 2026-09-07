# Negocio

**Estado del documento:** Vigente (v1)
**Última actualización:** 2026-09-07
**Acompaña a:** `docs/prd.md` (§9 métricas) · `docs/roadmap.md` (Fase 2, instrumentación)

---

## 1. Qué es este negocio y qué papel juega la herramienta

El negocio es la **consultoría de implantación de IA** (automatizaciones y otras) para pymes y
autónomos: se cobra por proyecto de implantación, no por la herramienta. La práctica está
**arrancando** — esta encuesta es, ahora mismo, el principal mecanismo para conseguir los primeros
clientes, no un complemento de una cartera ya montada.

La encuesta conversacional **no se monetiza**: es gratis para el visitante. Su función es
**captar y cualificar** leads antes de dedicarles tiempo:

- **Reduce el coste de cualificación.** Hoy esa criba se hace en una primera llamada, que consume
  tiempo encaje o no el lead. La encuesta la mueve al principio del embudo y la automatiza.
- **Aumenta la conversión de la conversación comercial.** El consultor llega a la llamada con la
  situación del negocio ya descrita y con casos de uso priorizados: la charla empieza en "hablemos
  de estos tres", no en "cuéntame a qué te dedicas".
- **Da algo de valor al visitante** (el diagnóstico), que es lo que justifica pedirle 10 minutos y
  sus datos de contacto.

## 2. Construir esto en vez de un formulario

| | Herramienta a medida (esta) | Typeform / Tally + Calendly |
|---|---|---|
| Captura de lead | Sí | Sí |
| Cualificación estructurada | Sí, con rúbrica propia y ajustable | Limitada a lógica de saltos |
| "Algo de valor al momento" | Diagnóstico narrativo en el chat | Un "gracias" y una cita |
| Control del criterio y de los datos | Total | Del proveedor |
| Coste fijo | ~infra (§3) | ~50 €/mes el plan que hace falta |
| Tiempo hasta tener algo en pie | Semanas (Fase 0 + Fase 1 del roadmap) | Una tarde |
| Riesgo | Si el diagnóstico es flojo, resta credibilidad | Bajo, pero techo de valor bajo |

La apuesta: el **diagnóstico conversacional** funciona a la vez como gancho de conversión y como
instrumento de cualificación, y eso no lo da un formulario. Si en la práctica el diagnóstico no
aporta, esto es peor que un formulario limpio — por eso la calidad del diagnóstico es un riesgo de
negocio, no solo técnico (§6).

## 3. Costes

### Coste variable — IA por encuesta

Dos llamadas a Claude por encuesta completada (`claude-sonnet-5`; **precios a 2026-09: 2 $/1M
tokens de entrada, 10 $/1M de salida** — verificar los vigentes):

1. **Entrevista:** ~15 turnos. Cada turno reenvía el system prompt (guion + instrucciones) y el
   historial acumulado. Estimación sin caché de prompt: ~80–90k tokens de entrada + ~2–3k de
   salida en total.
2. **Diagnóstico:** 1 llamada. ~5k de entrada (instrucciones + resultado de la rúbrica) + ~1,5–2,5k
   de salida.

| Escenario | Coste aproximado por encuesta completada |
|-----------|:---------------------------------------:|
| Sin caché de prompt (estado actual del código) | **~0,20–0,35 $** |
| Con caché del system prompt de la entrevista | **~0,10–0,15 $** |
| Encuesta abandonada a mitad (~6 turnos) | ~0,05–0,08 $ |

Activar la **caché de prompt** en la llamada de entrevista (hoy no está) reduce el coste variable
a la mitad o menos. Candidato claro para `mejoras/`.

**Techo por abuso:** el límite por IP (10 encuestas / 150 mensajes por IP y 24 h) y el tope duro de
40 mensajes por conversación acotan el gasto. Peor caso de una IP saturando el límite: ~1–2 $/día.
Bounded, pero se vigila con la métrica de coste (§4).

### Coste fijo — infraestructura

Con el volumen esperado (decenas de encuestas al mes):

| Servicio | Plan | Coste/mes |
|----------|------|:---------:|
| Vercel | Pro (uso comercial) | ~20 $ |
| Supabase | Free cubre el volumen; Pro cuando haga falta | 0 $ (→ 25 $) |
| Resend | Free (3.000 emails/mes, 100/día) | 0 $ |
| Dominio | — | ~1 $/mes prorrateado |
| **Fijo total** | | **~20 $/mes** |

### Coste real: construir y mantener

El grueso de la inversión es el **desarrollo** (Fase 0 + Fase 1 del roadmap) y el mantenimiento
del código propio. Se amortiza sobre los leads que traiga y el tiempo de cualificación que ahorre;
no tiene sentido evaluarlo por encuesta.

## 4. Métricas

Amplía `docs/prd.md` §9 con la definición y cómo se mide cada una.

| Métrica | Definición | Cómo se mide |
|---------|------------|-------------|
| Encuestas iniciadas | Filas en `encuestas` | SQL |
| Encuestas respondidas | `estado in ('respondida','completada')` — terminaron la entrevista | SQL |
| Encuestas completadas | `encuestas.estado = 'completada'` | SQL |
| **Tasa de completado** | completadas ÷ iniciadas | SQL |
| Abandono por etapa | `en_curso` sin turnos · `en_curso` con turnos · `respondida` (terminó la entrevista, no dejó contacto) · `completada` | SQL directo sobre `encuestas.estado` (las `respuestas` se persisten al terminar la entrevista) |
| **Leads cualificados** | completadas con `nivel_preparacion` medio/alto **y** `presupuesto_rango` por encima de un umbral | SQL sobre `resultados_rubrica` + `respuestas` (definición provisional hasta tener rúbrica) |
| Coste de IA por encuesta | `respuestas.coste_ia` agregado ÷ nº de encuestas | SQL — `coste_ia` (`usage` de las dos llamadas) se guarda desde la v1 |
| Conversión lead → 1ª reunión → propuesta → cliente | embudo comercial posterior al lead | **Manual** (agenda / notas / CRM del consultor) |
| CAC parcial | (coste IA + prorrateo del fijo) ÷ clientes conseguidos | Manual + SQL |
| Tiempo de cualificación ahorrado | estimación de minutos por lead que ya no requieren primera llamada de criba | Cualitativa |

Las que salen de la base de datos se resuelven con consultas SQL guardadas; el embudo desde
"lead" en adelante vive fuera de la app y lo lleva el consultor.

## 5. Objetivos

No se fijan números en el vacío. Se establece una **línea base con las primeras ~20 encuestas
reales** y a partir de ahí se ponen objetivos. Rangos ilustrativos para orientar, no compromisos:

- **Tasa de completado:** referencia sana > 50 %. Por debajo de ~35 % → revisar el largo del guion
  o el gating del formulario de contacto.
- **Leads cualificados / mes:** depende por completo de cuánto se difunda el enlace (no hay
  captación orgánica en la v1).
- **Coste de IA por lead cualificado:** debería quedar en céntimos; si sube de ~1 $, algo va mal
  (guion demasiado largo, abuso, o caché sin activar).

## 6. Riesgos de negocio

| Riesgo | Mitigación |
|--------|-----------|
| **Volumen insuficiente.** Sin SEO ni captación en la v1, todo depende de que el consultor reparta el enlace. | Es el riesgo principal. La v1 asume distribución manual; la captación es trabajo aparte, fuera del roadmap de producto. |
| **Gating duro del contacto** sube el abandono. | Se acepta a cambio de calidad de lead; se vigila con la tasa de completado y el abandono por etapa. |
| **Rúbrica mal calibrada** → leads mal clasificados (se persiguen malos, se ignoran buenos). | Nace con supuestos; se calibra con encuestas reales (roadmap Fase 2). `version_rubrica` permite comparar. |
| **Diagnóstico de baja calidad** resta credibilidad comercial. | Muestreo manual del diagnóstico en cada feature que lo toque (`testing.md` §1); nota de alcance explícita ("orientación preliminar"). |
| **Coste de IA por abuso.** | Límite por IP + tope de turnos + métrica de coste vigilada. Activar caché de prompt. |
| **RGPD.** Se tratan datos de contacto y datos de negocio de terceros; el responsable del tratamiento es el consultor. | Minimización (solo 4 campos + respuestas), consentimiento con versión, retención 24 meses con purga automática, sin cesión a terceros. |
| **Mantenimiento de código propio** frente a una herramienta de terceros. | Stack pequeño y heredado ya probado; el coste se asume como parte de la apuesta de §2. |

## 7. Instrumentación

**En la v1:**

- **`respuestas.coste_ia`** guarda el `usage` de las dos llamadas a Claude por encuesta (§4). Es
  el dato base de la métrica de coste.
- El **abandono por etapa** sale directo de `encuestas.estado` (`en_curso` / `respondida` /
  `completada`), porque las respuestas se persisten al terminar la entrevista.

**Pendiente para Fase 2:**

- **Consultas SQL guardadas** para el embudo hasta "lead" (iniciadas, respondidas, completadas,
  tasa, abandono por etapa, leads cualificados, coste medio), en el panel o como export.
- **Un sitio para el embudo post-lead** (reunión → propuesta → cliente): CRM ligero o una hoja de
  cálculo; no hace falta que viva en la app.

## 8. Decisiones abiertas

- **Definición exacta de "lead cualificado"** — umbral de `nivel_preparacion` y de
  `presupuesto_rango`. Depende de que exista la rúbrica (Fase 0.4).
- **Objetivos numéricos** — se fijan tras la línea base de las primeras ~20 encuestas.
- **¿Activar caché de prompt en la entrevista dentro de la v1** o dejarlo para `mejoras/`? Baja el
  coste variable a la mitad; el cambio es pequeño.
- **Plan de Vercel** — Pro por uso comercial, a confirmar.
- **Herramienta para el embudo post-lead** — CRM ligero vs. hoja de cálculo.
