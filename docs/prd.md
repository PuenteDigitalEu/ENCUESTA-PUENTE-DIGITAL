# PRD — Encuesta conversacional de preparación para IA

**Estado del documento:** Borrador para validar (v1)
**Última actualización:** 2026-09-06
**Clasificación (CLAUDE.md):** Producto con negocio detrás

---

## 1. Problema y oportunidad

Un consultor que vende servicios de implantación de IA (automatizaciones y otras) necesita una
forma de **cualificar** a responsables de pymes y autónomos antes de dedicarles tiempo: saber si el
negocio tiene procesos automatizables, datos aprovechables, madurez digital suficiente y
presupuesto, y con qué casos de uso empezar.

Hoy esa cualificación se hace en una primera llamada, que consume tiempo tanto si el lead encaja
como si no. Una **encuesta conversacional guiada** que el propio interesado completa a su ritmo, y
que le devuelve algo de valor en el momento (un diagnóstico), traslada ese trabajo al principio del
embudo: el consultor recibe leads ya descritos y priorizados, y el interesado recibe una primera
lectura útil de su situación.

## 2. Para quién

- **Visitante:** responsable de una pyme o autónomo, de cualquier sector, con tamaño típico de
  microempresa o pequeña empresa. No es necesariamente técnico. Llega por un enlace que el
  consultor comparte (email, redes, tarjeta, evento). No tiene cuenta ni la necesita.
- **Consultor:** una sola persona (tú). Recibe los leads, lee el diagnóstico y decide a quién
  contactar. Vende después los servicios de implantación. Es el único usuario con acceso
  autenticado (panel).

## 3. Propuesta de valor

- **Para el visitante:** en 5–10 minutos de conversación obtiene un diagnóstico de preparación para
  IA de su negocio y una lista priorizada de automatizaciones/implantaciones candidatas, sin coste
  y sin compromiso.
- **Para el consultor:** cada encuesta completada es un lead con contacto, con su situación descrita
  de forma estructurada y con un punto de partida concreto para la conversación comercial.

## 4. Cómo funciona (visión de producto)

1. El visitante abre el enlace y ve una landing breve que explica qué es y cuánto lleva.
2. Acepta la pantalla de consentimiento de tratamiento de datos.
3. Entra en un chat. Un agente conversacional le hace preguntas, **una cada vez**, sobre su
   negocio: tamaño y sector, cómo trabaja hoy, qué tareas repite, qué herramientas usa, cómo de
   digitalizado está el equipo, qué datos maneja y con qué sensibilidad, cuánto podría invertir y
   quién decide.
4. Al terminar, se le piden **nombre de contacto, email, teléfono y empresa**. Sin esos datos no se
   muestra el diagnóstico.
5. El sistema **calcula** (código determinista, no el modelo) un nivel de preparación para IA y un
   ranking de casos de uso por impacto × viabilidad.
6. El agente **redacta** el diagnóstico a partir de esos valores y lo muestra en el propio chat,
   con la nota de que es orientación preliminar no vinculante. Si faltan respuestas, lo dice y no
   inventa.
7. Se dispara un email de aviso al consultor con el resumen del lead.
8. El consultor entra a su panel (con login), ve la lista de encuestas completadas y el detalle de
   cada una.

## 5. Alcance de la v1

- Landing de acceso cerrado (URL genérica) sin cuentas de visitante.
- Pantalla de consentimiento previo.
- Encuesta conversacional guiada con guion propio (reescrito desde cero; el heredado era
  financiero).
- Rúbrica determinista: nivel de preparación + ranking de casos de uso.
- Diagnóstico narrativo redactado por el modelo a partir de la rúbrica, mostrado en el chat.
- Captura obligatoria de datos de contacto antes del diagnóstico.
- Persistencia en Supabase encadenada por token de sesión.
- Email de aviso al consultor por cada encuesta completada.
- Panel del consultor protegido con Supabase Auth: listado y detalle.
- Límite de uso por IP.
- Español, un solo idioma.
- Retención de datos: 24 meses.

## 6. Fuera de alcance de la v1

Se registran en `docs/roadmap.md` como fases siguientes:

- **SaaS multi-tenant:** registro de consultores, aislamiento de datos por tenant, cobro por
  suscripción, guion y marca personalizables por cada consultor.
- Multi-idioma y selector de idioma.
- Integración con CRM externo (HubSpot, Pipedrive…).
- Edición del guion de la entrevista desde la interfaz, sin tocar código.
- Analítica de producto embebida (embudo dentro de la app).
- Exportación a PDF y estados de lead en el panel (candidatos a fase 1.5; ver requisitos `C-*`).

## 7. Requisitos funcionales

Notación MoSCoW: `M-` imprescindible para la v1, `S-` recomendable, `C-` opcional. Cada requisito
lleva su criterio de aceptación tras el guion largo.

### Imprescindibles (Must)

- **[M-01] Acceso sin cuentas para el visitante** — Un visitante sin credenciales llega a la
  landing, inicia el chat y completa la encuesta; en todo el recorrido del visitante no existe
  ningún formulario de registro ni de login.
- **[M-02] Consentimiento previo de tratamiento de datos** — Antes de crear ninguna conversación se
  muestra una pantalla de consentimiento que hay que aceptar explícitamente; sin aceptarla no se
  llama a la API de conversación ni se persiste nada, y al aceptarla se registran la marca de
  tiempo y la versión del texto aceptado.
- **[M-03] Encuesta guiada, una pregunta por turno** — El agente conduce la entrevista turno a
  turno sin estado en servidor (el cliente envía el historial completo cada turno), con un tope
  máximo de turnos; cada respuesta del agente contiene una sola pregunta y, alcanzado el tope, la
  conversación pasa a la fase de diagnóstico.
- **[M-04] Cobertura temática del guion** — Existe un guion documentado en `docs/` cuyas secciones
  cubren los ocho bloques: tamaño y sector; procesos y tareas actuales; tareas repetitivas o
  intensivas en datos; herramientas y sistemas en uso; madurez digital del equipo; sensibilidad de
  datos y cumplimiento; presupuesto y disposición a invertir; quién decide. Una encuesta completada
  tiene, por cada bloque, o una respuesta registrada o una marca explícita de "no respondido".
- **[M-05] Cálculo determinista del resultado** — El nivel de preparación para IA y el ranking de
  casos de uso (impacto × viabilidad) se calculan en código determinista y testeado en `src/lib/`;
  dado el mismo conjunto de respuestas la rúbrica devuelve siempre el mismo nivel y el mismo orden,
  hay test unitario que lo fija, y ninguna cifra mostrada al visitante procede de una respuesta del
  modelo.
- **[M-06] Diagnóstico redactado a partir del resultado ya calculado** — El prompt de diagnóstico
  recibe los valores de la rúbrica como datos de entrada; el texto resultante cita el mismo nivel y
  los mismos casos de uso priorizados que devolvió la rúbrica, sin recalcularlos ni contradecirlos.
- **[M-07] El diagnóstico incompleto se declara** — Ante una encuesta con bloques sin responder, el
  diagnóstico incluye una sección visible de "datos que faltan para completar el análisis" y la
  rúbrica no imputa valores por defecto de forma silenciosa.
- **[M-08] Captura de contacto obligatoria antes del diagnóstico** — Al cerrar la encuesta se piden
  nombre de contacto, email, teléfono y empresa; el diagnóstico no se muestra hasta que los cuatro
  campos están rellenos y el email tiene formato válido; con ellos, se persisten junto a la
  conversación y se muestra el diagnóstico.
- **[M-09] Persistencia encadenada por token de sesión** — Conversación, respuestas estructuradas,
  datos de contacto y texto del diagnóstico se guardan en Supabase enlazados por un token de
  sesión; dado ese token se pueden recuperar los cuatro.
- **[M-10] Aviso por email al consultor** — Completar una encuesta genera exactamente un email a la
  dirección configurada, con los datos de contacto, la empresa, el nivel de preparación y los casos
  de uso priorizados.
- **[M-11] Panel del consultor con Supabase Auth** — Ruta protegida por login (Supabase Auth,
  cuentas dadas de alta manualmente); sin sesión válida redirige al login y no expone datos; con
  sesión válida muestra el listado de encuestas completadas ordenado por fecha y el detalle de cada
  una (respuestas, contacto, diagnóstico).
- **[M-12] Límite de uso por IP** — Superado el número de encuestas iniciadas por IP en la ventana
  de tiempo configurada, un nuevo intento desde esa IP recibe un rechazo controlado; en la base de
  datos la IP solo aparece como hash (HMAC-SHA256 con pepper), nunca en claro.
- **[M-13] Aviso de alcance del diagnóstico** — El diagnóstico mostrado incluye la nota
  "orientación preliminar, no vinculante" y no contiene ningún disclaimer ni referencia a
  asesoramiento financiero o de inversión.
- **[M-14] Retención de datos a 24 meses** — Existe un mecanismo documentado que elimina las
  conversaciones, respuestas, contactos y diagnósticos con más de 24 meses de antigüedad; el texto
  de consentimiento menciona ese plazo.
- **[M-15] Español como único idioma** — Toda la interfaz de cara al visitante, el guion y el
  diagnóstico están en español; no existe ruta ni componente de cambio de idioma.

### Recomendables (Should)

- **[S-01] Reanudar una encuesta a medias** — Con el token de una encuesta no completada, al
  recargar o volver en la misma sesión de navegador el chat recupera el historial y permite seguir
  respondiendo.
- **[S-02] Respuestas normalizadas en el panel** — El detalle de una encuesta en el panel presenta
  las respuestas organizadas por los ocho bloques del guion, no solo la transcripción cruda del
  chat.
- **[S-03] Copiar el diagnóstico** — El visitante dispone de un control que copia el texto del
  diagnóstico al portapapeles.

### Opcionales (Could)

- **[C-01] Exportar el diagnóstico a PDF** — Desde el panel se genera un PDF con el diagnóstico de
  una encuesta.
- **[C-02] Estados de lead en el panel** — Cada encuesta puede marcarse como "nuevo",
  "contactado" o "descartado", y el listado permite filtrar por estado.
- **[C-03] Reenvío manual del aviso** — Desde el detalle de una encuesta, el consultor puede
  reenviar el email de aviso.

## 8. Requisitos no funcionales

- **RNF-01 — Stack fijo.** Next.js 16 (App Router), Supabase (PostgreSQL + Auth), Anthropic Claude
  API, Tailwind CSS, despliegue en Vercel. Cualquier cambio de stack se justifica en
  `docs/architecture.md`.
- **RNF-02 — Coste por encuesta acotado.** Tope de turnos + límite por IP + modelo de Claude
  elegido y documentado. La estimación de coste por encuesta completada vive en `docs/business.md`.
- **RNF-03 — Datos personales mínimos.** Solo los cuatro campos de contacto y las respuestas de
  negocio. Base legal: consentimiento. Sin cookies de terceros ni tracking publicitario.
- **RNF-04 — Rendimiento percibido.** Primera pintura de la landing por debajo de ~2 s en 4G; la
  respuesta por turno del chat se percibe conversacional (streaming o respuesta en pocos segundos).
- **RNF-05 — Accesibilidad básica.** Navegable por teclado, contraste AA, alternativas de texto en
  imágenes e iconos con significado.
- **RNF-06 — Verificación en local.** Todas las pruebas se ejecutan contra `localhost`. Si la app
  no está levantada en local, el veredicto es "no verificado" (límite de ejecución del proyecto).
- **RNF-07 — Los fallos no se pierden en silencio.** Errores de servidor registrados; un fallo en
  el envío del email de aviso queda visible (log y, si es viable, marca en la fila de la encuesta),
  no se descarta sin rastro.

## 9. Métricas de éxito

Detalle y objetivos numéricos en `docs/business.md`. Indicadores que la v1 debe permitir medir:

- Encuestas **iniciadas** y **completadas** por mes.
- **Tasa de completado**: completadas (con contacto válido) ÷ iniciadas.
- Nº de **leads cualificados**: nivel de preparación medio/alto y presupuesto declarado por encima
  de un umbral.
- **Conversión lead → primera reunión** (medición manual del consultor, fuera de la app).
- **Coste medio de IA por encuesta completada**.

## 10. Supuestos

- Un único consultor usa la herramienta; las cuentas del panel se crean a mano en Supabase.
- Volumen esperado bajo (decenas de encuestas al mes); no requiere escalado especial.
- El tráfico llega por enlaces que el consultor reparte; en la v1 no hay captación orgánica ni SEO.
- La marca / nombre comercial no está decidida; el copy usará un marcador de posición hasta que se
  confirme (no inventar un nombre).

## 11. Riesgos y decisiones abiertas

- **Proveedor de email.** `CLAUDE.md` menciona "Supabase Edge Function + SMTP"; el código heredado
  y `.env.example` usan Resend por API HTTP. Contradicción a resolver en `docs/architecture.md`
  antes de tocar `src/lib/email/`.
- **Rúbrica sin datos reales.** El primer diseño se hará con supuestos; necesitará calibración con
  las primeras encuestas reales. Riesgo de que el nivel de preparación no discrimine bien al
  principio.
- **Persistencia sin transacción SQL** (heredado). Una encuesta puede quedar a medias entre tablas.
  Riesgo asumido para el MVP; se revisa en `docs/architecture.md` y `docs/data-model.md`.
- **Gating duro del diagnóstico** tras el formulario de contacto: puede elevar el abandono. Se
  acepta a cambio de calidad de lead; se vigila con la tasa de completado.
- **Arranque bloqueado.** El chat heredado hace `readFileSync` de `instrucciones-sistema.md` e
  `instrucciones-motor.md`, que se borraron al clonar. La v1 no funciona hasta reescribir el guion
  y la rúbrica y reapuntar esos archivos.

## 12. Glosario

- **Visitante** — responsable de pyme o autónomo que rellena la encuesta.
- **Consultor** — único usuario autenticado; recibe los leads y presta los servicios de
  implantación de IA.
- **Rúbrica** — código determinista que convierte las respuestas en un nivel de preparación para IA
  y un ranking de casos de uso.
- **Diagnóstico** — texto narrativo que el modelo redacta a partir de la rúbrica y se muestra en el
  chat.
- **Caso de uso** — automatización o implantación de IA candidata, puntuada por impacto y
  viabilidad.
- **Lead** — encuesta completada con datos de contacto válidos.
- **Token de sesión** — identificador opaco que encadena las filas de una misma encuesta en
  Supabase.
