# Rúbrica de preparación para IA

**Estado del documento:** Borrador para validar (v1)
**Última actualización:** 2026-09-07
**Implementa:** `src/lib/rubrica/` (código determinista, `M-05`)
**Acompaña a:** `docs/data-model.md` (`resultados_rubrica`) · `instrucciones-sistema.md` (ficha de
entrada) · `guion-entrevista.md`

---

## 1. Qué es y qué no

La rúbrica convierte las respuestas de la encuesta (la ficha parseada) en:

- un **nivel de preparación para IA** (`nivel_preparacion`),
- un **ranking de casos de uso** por impacto × viabilidad,
- una marca de si el resultado está **completo** y, si no, qué falta.

Es **código determinista y testeado**. La misma ficha produce siempre el mismo resultado. **El
modelo de lenguaje no participa aquí** (CLAUDE.md → "Qué NO hacer"). El modelo solo redacta
después el diagnóstico narrativo a partir de este objeto ya calculado.

**Pesos y umbrales de este documento son de la v1 y se calibran** con encuestas reales (roadmap
Fase 2). Cada número lleva por eso `version_rubrica`, para poder reproducir y comparar.

## 2. Objeto de salida

Forma del objeto que produce `src/lib/rubrica/` y que se guarda en `resultados_rubrica`
(`contenido` guarda el objeto entero; las columnas sueltas son copia):

```jsonc
{
  "version_rubrica": "2026-09-07",
  "nivel_preparacion": "inicial",        // sin_preparar | inicial | en_desarrollo | consolidada
  "preparacion_score": 4,                 // 0-10, trazabilidad del nivel
  "senales": {                            // desglose del score
    "digitalizacion": 2,                  // 0-4
    "madurez_equipo": 1,                  // 0-3
    "claridad_procesos": 1                // 0-3
  },
  "completo": false,                      // M-07
  "datos_faltantes": [
    { "campo": "madurez_digital", "para_que": "estimar el riesgo de adopción del equipo" }
  ],
  "cautela_datos": false,                 // datos sensibles / restricciones fuertes
  "casos_uso": [
    {
      "id": "presupuestos",
      "nombre": "Automatización de presupuestos y ofertas",
      "descripcion": "Generar presupuestos a partir de plantillas y datos de cliente/servicio.",
      "impacto": 4,                        // 1-5
      "viabilidad": 2,                     // 1-5
      "puntuacion": 8,                     // impacto * viabilidad, 1-25
      "justificacion": "Es el proceso que más tiempo te lleva y lo haces varias veces al día; la contra es que ahora mismo no hay sistemas conectados."
    }
  ]
}
```

`coste_ia` **no** lo pone la rúbrica: lo añade la ruta al persistir (`respuestas.coste_ia`).

## 3. Nivel de preparación

Mide **cómo de listo está el negocio para adoptar IA/automatización con éxito** — no cuánta
necesidad tiene. Un negocio puede tener mucha necesidad y poca preparación.

**Decisión de tono:** no hay un indicador de "necesidad" aparte. Un "necesidad: ALTA" se lee como
"tu negocio va atrasado" e incomoda al visitante justo cuando quieres que confíe. La necesidad se
transmite de forma implícita por el ranking de casos de uso (muchas puntuaciones de impacto altas
= mucho margen de mejora), y el diagnóstico lo cuenta en positivo ("hay recorrido en…"), no como
un suspenso.

### 3.1 Señales (todas salen de campos enum de la ficha)

**`digitalizacion` (0-4):**

| Campo | Valor → puntos |
|-------|----------------|
| `uso_nube` | `no` → 0 · `parcial` → 1 · `si` → 2 |
| `integracion_actual` | `ninguna` → 0 · `parcial` → 1 · `alta` → 2 |

**`madurez_equipo` (0-3):**

| Campo | Valor → puntos |
|-------|----------------|
| `madurez_digital` | `baja` → 0 · `media` → 1 · `alta` → 2 |
| `referente_interno` | `no` → 0 · `si` → 1 |

**`claridad_procesos` (0-3):** un negocio que no sabe nombrar dónde le duele no está listo para
acotar una automatización.

| Condición | Puntos |
|-----------|--------|
| `procesos_numero ≥ 2` | +1 |
| `tareas_numero ≥ 2` | +1 |
| `proceso_mas_costoso` no está `pendiente` | +1 |

`preparacion_score` = suma de las tres señales (0-10).

### 3.2 Del score al nivel

| `preparacion_score` | `nivel_preparacion` |
|:-------------------:|---------------------|
| 0 – 2 | `sin_preparar` |
| 3 – 5 | `inicial` |
| 6 – 8 | `en_desarrollo` |
| 9 – 10 | `consolidada` |

### 3.3 `cautela_datos`

`true` si `datos_sensibles = si` **o** `restricciones_datos` indica información que no puede salir
de la empresa (heurística de palabras clave sobre el texto: "no puede salir", "externo",
"confidencial", "secreto"). No cambia el nivel; obliga al diagnóstico a mencionarlo y **limita la
viabilidad** de los casos de uso que muevan datos a servicios externos (§4.2).

## 4. Ranking de casos de uso

### 4.1 Catálogo (v1, transversal)

Casos de uso candidatos, válidos para la mayoría de pymes/autónomos. Es una lista de
**oportunidades comunes de automatización**, no un menú de servicios cerrado: el consultor todavía
está montando la práctica a partir de esta herramienta, así que el catálogo es ancho a propósito y
se irá afinando (y especializando por sector) con lo que pidan las primeras encuestas y clientes
reales.

| id | Nombre | Ataca sobre todo… |
|----|--------|-------------------|
| `presupuestos` | Automatización de presupuestos y ofertas | crear presupuestos repetitivos |
| `entrada_datos` | Traspaso de datos entre sistemas | copiar información de un sitio a otro |
| `facturacion` | Facturación y conciliación | emitir facturas y cuadrar cobros |
| `atencion_faq` | Asistente de atención a clientes (consultas frecuentes, estado de pedido) | responder lo mismo una y otra vez |
| `citas` | Gestión de citas y recordatorios | reservas y avisos manuales |
| `crm_ligero` | Seguimiento comercial / CRM ligero | leads que se pierden sin seguimiento |
| `generacion_docs` | Generación de documentos (contratos, partes, informes) | rellenar los mismos documentos |
| `compras` | Compras y pedidos a proveedores | pedidos recurrentes y comparativas |
| `informes` | Informes y cuadros de mando | consolidar datos dispersos a mano |
| `enrutado_mensajes` | Clasificación y derivación de correo/mensajes | ordenar y repartir la entrada |
| `extraccion_docs` | Extracción de datos de documentos recibidos (OCR + IA) | teclear facturas/albaranes/tickets |
| `redaccion` | Redacción asistida (respuestas, textos de producto/marketing) | escribir textos repetitivos desde cero |

### 4.2 Puntuación de cada caso de uso

**Impacto (1-5)** — cuánto dolor quita en este negocio. Base 1, se suman:

| Señal | +pts |
|-------|------|
| El caso encaja con algún `proceso_i_*` o `tarea_i_*` de la ficha (match por palabras clave del catálogo) | +2 |
| Ese proceso/tarea es `proceso_mas_costoso`, o su frecuencia es alta ("varias veces al día", "constante", "diari…") | +1 |
| `cuello_botella_personas = si` y el caso alivia esa dependencia | +1 |
| `trabajo_con_datos` es relevante para el caso (p. ej. `entrada_datos`, `informes`, `extraccion_docs`) y no es "poco" | +1 |

Tope 5.

**Viabilidad (1-5)** — cómo de fácil es implantarlo aquí. Base 2, se ajusta:

| Señal | ±pts |
|-------|------|
| `integracion_actual` (para casos que dependen de conectar sistemas) | `alta` +2 · `parcial` +1 · `ninguna` 0 |
| `uso_nube = si` | +1 |
| `madurez_digital` | `alta` +1 · `media` 0 · `baja` −1 |
| `referente_interno = si` | +1 |
| `cautela_datos = true` **y** el caso mueve datos a un servicio externo | −2 (y se marca "con cautela" en la justificación) |

Límites 1-5.

**Puntuación** = `impacto × viabilidad` (1-25). Orden descendente. Empate → mayor `impacto`, luego
mayor `viabilidad`, luego orden del catálogo.

### 4.3 Qué se devuelve

- Todos los casos con `impacto ≥ 3`, y si son menos de 3, se completa hasta 3 con los siguientes
  por puntuación. Máximo 6.
- Cada uno con su `justificacion` de una o dos frases, generada por plantilla determinista a partir
  de las señales que sumaron (no por el modelo).

## 5. Completitud (`M-07`)

### 5.1 Campos críticos

Su ausencia deja el resultado **incompleto** (`completo = false`) y entra en `datos_faltantes`:

| Campo | Para qué se necesita |
|-------|----------------------|
| `sector` | elegir y adaptar los casos de uso |
| `tamano_rango` | dimensionar qué es realista |
| `integracion_actual` | señal `digitalizacion` |
| `uso_nube` | señal `digitalizacion` |
| `madurez_digital` | señal `madurez_equipo` |
| `procesos_numero` + `tareas_numero` (que sumen ≥ 1) | sin al menos un proceso o tarea no hay nada que puntuar |

### 5.2 Qué NO es crítico

`presupuesto_rango`, `apetito`, `modelo_preferido`, `decision_quien`, `responsable_implantacion`:
si están `pendiente`, el diagnóstico se entrega igual (el visitante recibe su lectura), pero el
lead queda **menos cualificado** para el consultor. No cuentan para `completo`.

### 5.3 Regla del dato ausente

Un campo crítico `pendiente` **no se imputa en silencio**. La rúbrica:

1. usa para el cálculo el **valor más conservador** del enum (el que da menor preparación / menor
   viabilidad — "el dato que falta se resuelve contra el optimismo", CLAUDE.md),
2. pone `completo = false`,
3. añade el campo a `datos_faltantes` con su `para_que`.

El diagnóstico narrativo tiene que decir explícitamente qué falta y que el análisis está
condicionado por ello.

## 6. Trazabilidad y versión

- `version_rubrica` (string, fecha ISO de la versión de reglas) se guarda en cada
  `resultados_rubrica`. Cambiar cualquier peso, umbral o entrada del catálogo = nueva versión.
- `preparacion_score` y `senales` se guardan aunque sean internos: permiten entender por qué salió
  un nivel sin re-ejecutar.
- Reprocesar una ficha con una versión nueva crea una fila nueva en `resultados_rubrica`, no
  sobrescribe.

## 7. Decisiones tomadas

- **El nivel mide preparación, no necesidad** (§3). No hay indicador de necesidad separado, por
  tono.
- **`sin_preparar` se mantiene como valor del enum**, pero en el texto del diagnóstico se llama
  **"punto de partida"** — nunca "sin preparar" de cara al visitante. Esto va en
  `instrucciones-rubrica.md` (el prompt del diagnóstico, F4).
- **`presupuesto_rango` / `apetito` / `decision_quien` no bloquean el diagnóstico** (§5.2): el
  visitante recibe su lectura aunque no los dé; solo baja la cualificación del lead.

## 8. Decisiones abiertas

- **Umbrales del nivel** (§3.2) y **pesos de impacto/viabilidad** (§4.2): son estimaciones de la
  v1. Se calibran con las primeras ~20-30 encuestas reales (Fase 2).
- **Catálogo de casos de uso**: 12 transversales en la v1. Añadir específicos de sector (taller,
  comercio, hostelería, servicios profesionales…) cuando haya volumen que lo justifique.
- **Match caso ↔ proceso por palabras clave**: la lista de palabras clave por caso de uso se
  define al implementar `src/lib/rubrica/`; empieza corta y se amplía con casos reales.
- **`justificacion` por plantilla**: acordar el juego de frases-plantilla al implementar, para que
  suene natural sin que lo escriba el modelo.
