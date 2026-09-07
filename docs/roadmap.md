# Roadmap

**Estado del documento:** Vigente (v1)
**Última actualización:** 2026-09-07
**Acompaña a:** `docs/prd.md` (requisitos) · `docs/features/` (fichas de cada unidad de trabajo)

---

## Cómo se lee este documento

Ordena el trabajo en fases. Cada elemento de la Fase 1 se convierte en una **ficha de feature**
(`/feature`) antes de escribir código: la ficha concreta el alcance y la tabla de cobertura; este
roadmap solo dice el orden y qué requisitos del PRD cierra cada bloque.

**Alcance nuevo entra por aquí.** Cuando aparezca algo que no está en el PRD, se añade a
`docs/prd.md` con su ID y su criterio de aceptación, y se coloca en una fase de este documento. No
se implementa nada que no esté en los dos sitios.

**Estado global (2026-09-07):** Fase 0 y el grueso de Fase 1 (F1–F4, F6, F7 en pasada ligera)
**implementados y probados en local**. Pendiente: F5 con dominio propio, favicon, calibración de
la rúbrica (Fase 2), fichas de `docs/features/` formalizadas, despliegue y `/security-review`.

---

## Fase 0 · Fundaciones (antes de código de producto)

Desbloquea todo lo demás. Sin esto, `/api/chat` no arranca (hace `readFileSync` de archivos que se
borraron) y no hay dónde persistir.

| # | Trabajo | Cierra | Puerta |
|---|---------|--------|--------|
| 0.1 | Cerrar los 8 documentos de `docs/` y resolver sus decisiones abiertas. | — | Los 8 en estado "Vigente". **Hecho (2026-09-07).** |
| 0.2 | Crear el proyecto Supabase nuevo, `supabase link`, `.env.local` con todas las claves, `.env.example` al día. | — | `pnpm dev` levanta sin errores de variables; MCP de Supabase autenticado. |
| 0.3 | Escribir `guion-entrevista.md` + `instrucciones-sistema.md` (raíz del repo) y confirmarlos. `instrucciones-rubrica.md` (prompt del diagnóstico) se escribe con F4. | Base de `M-03`, `M-04` | El guion cubre los 8 bloques; el contrato de la ficha está cerrado; el usuario da el visto bueno. **Borrador hecho (2026-09-07).** |
| 0.4 | Diseñar la rúbrica: niveles de `nivel_preparacion`, catálogo de casos de uso, fórmula impacto × viabilidad, umbrales, reglas de completitud. | Base de `M-05` | Documentada en `docs/rubrica.md`; enum `nivel_preparacion` fijado en `data-model.md`. **Borrador hecho (2026-09-07).** |
| 0.5 | Reescribir `supabase/migrations/001` con el esquema de `docs/data-model.md` (8 tablas, estado `respondida`, `coste_ia`, renombrados, `on delete cascade`). | Base de `M-09` | **Hecho (2026-09-07).** `verificar-persistencia.mjs` en verde. |
| 0.6 | Refactor mecánico de vocabulario: `lib/motor/`→`lib/rubrica/`, `asesor`→`consultor` (tabla, `es_consultor()`, módulo email, `CONSULTOR_NOTIFICATION_EMAIL`), `informes`/`planes`→`resultados_rubrica`/`diagnosticos`. | — | **Hecho (2026-09-07).** `pnpm build` y `pnpm test` en verde. |
| 0.7 | Contraste del acento coral: token a `#c9402a` + `--color-accent-hover` `#a8351f`. | `RNF-05` (parte) | Hecho en `globals.css` y `design-system.md` (2026-09-07). Falta que `CtaButton` use `accent-hover` (va en F7). |
| 0.8 | Ampliar CI: `pnpm lint` + `pnpm test` + `pnpm build` además de la cobertura. | `RNF-06` (soporte) | **Hecho (2026-09-07):** `.github/workflows/pruebas.yml`. |

Fases 0.3–0.6 pueden solaparse, pero 0.5 va antes de cualquier feature que escriba en base de
datos.

---

## Fase 1 · MVP (la v1 del PRD)

Cada bloque = una ficha de feature. Estado a 2026-09-07:

| | Estado |
|--|--|
| F1 Persistencia + límite IP + retención | **Hecho.** `002_retencion.sql` para el job. |
| F2 Entrevista conversacional | **Hecho.** |
| F3 Rúbrica determinista | **Hecho.** Pesos por calibrar (Fase 2). |
| F4 Cierre: contacto + diagnóstico | **Hecho.** |
| F5 Aviso por email | **Código hecho.** Envío real bloqueado por verificar dominio en Resend. |
| F6 Panel del consultor | **Hecho.** Login Supabase Auth + lista blanca + listado + detalle. |
| F7 Landing, copy y accesibilidad | **Pasada ligera hecha.** Falta favicon y repaso fino. |

### F1 · Persistencia y protección contra abuso
**Cierra:** `M-09`, `M-12`, `M-14` · **Depende de:** 0.5
Reapuntar `lib/supabase/persistencia.ts` al esquema nuevo; `crearEncuesta`, `validarToken`,
`persistirCierre` con las tablas nuevas. Límite por IP con la acción `crear_encuesta`. Job de
`pg_cron` de retención a 24 meses.
**Puerta:** `persistencia.test.ts` + `verificar-persistencia.mjs` en verde; recuperar una encuesta
completa por su token; una fila de >24 meses desaparece al correr el job.

### F2 · Entrevista conversacional
**Cierra:** `M-01`, `M-02`, `M-03`, `M-04` · **Depende de:** 0.3, F1
`/api/conversacion` crea la encuesta al consentir (con `consentimiento_version`). `/api/chat`
reapuntado al guion nuevo: una pregunta por turno, historial completo del cliente, tope de turnos,
sin estado en servidor. Al detectar la ficha de cierre: parsear y **persistir `respuestas`** +
`estado = 'respondida'` + `coste_ia.entrevista`. `ConsentScreen` con el copy nuevo.
**Puerta:** tests de ruta en verde; recorrido manual: consentir → 8 bloques → se persiste
`respuestas` y la encuesta pasa a `respondida`; sin consentir no se crea nada.

### F3 · Rúbrica determinista
**Cierra:** `M-05`, `M-07` · **Depende de:** 0.4
`src/lib/rubrica/`: de las respuestas parseadas a `nivel_preparacion` + `casos_uso` ordenados +
`completo` + `datos_faltantes`. `version_rubrica`. Sin ninguna cifra pedida al modelo.
**Puerta:** tests unitarios: determinismo (misma entrada → misma salida), umbrales, incompletitud
sin imputación silenciosa. Cobertura de ramas cerca del 100 %.

### F4 · Cierre: contacto + diagnóstico
**Cierra:** `M-06`, `M-07` (render), `M-08`, `M-13` · **Depende de:** F1, F2, F3
`FormularioContacto` (4 campos obligatorios, email validado) antes del diagnóstico. Segundo prompt
a Claude con el resultado de la rúbrica ya calculado. `DatosFaltantes` cuando el resultado es
incompleto. `nota_alcance` fija guardada con el diagnóstico. `persistirCierre` encadena
contacto → resultado → diagnóstico, completa `respuestas.coste_ia.diagnostico` y pasa la encuesta
de `respondida` a `completada`.
**Puerta:** sin los 4 campos no hay diagnóstico; con ellos, se persiste el cierre y se muestra; el
diagnóstico cita el nivel y los casos de la rúbrica (muestreo manual). Abandonar aquí deja la
encuesta en `respondida` con sus respuestas guardadas.

### F5 · Aviso por email al consultor
**Cierra:** `M-10` · **Depende de:** F4
`email/aviso-consultor.ts` con remitente propio y dominio verificado en Resend. Un email por
cierre con contacto + empresa + nivel + casos priorizados. Registro `enviado`/`fallido`; un fallo
no bloquea al visitante.
**Puerta:** tests de ruta en verde; envío real de prueba a la dirección configurada, con captura
pegada en el PR.

### F6 · Panel del consultor
**Cierra:** `M-11`, `S-02` · **Depende de:** F1, F4
Rutas `(panel)/` con Supabase Auth + lista blanca (`consultores` / `es_consultor()`). Listado por
fecha de encuestas `completada` y `respondida` (empresa, contacto, badge de nivel, nº de casos;
las `respondida` marcadas "sin contacto"). Detalle: contacto (si hay), respuestas por los 8
bloques, diagnóstico como lo vio el visitante (solo `completada`).
**Puerta:** sin sesión → redirige; con sesión sin fila en `consultores` → no expone; con ambas →
listado y detalle. Recorrido manual con cuenta real.

### F7 · Landing, copy y accesibilidad
**Cierra:** `M-15`, `RNF-05` · **Depende de:** 0.7
Reescribir el copy de `Hero`, `ComoFunciona`, `ProteccionDatos`, `Footer`, `DisclosureBanner` y
`metadata` con la marca **Puente Digital EU**. Anillo de foco en inputs/botones/filas;
`prefers-reduced-motion` en el scroll del chat; `<label>` en el formulario.
**Puerta:** revisión de accesibilidad (contraste AA, teclado, foco); sin cadenas fuera de español;
sin menciones a inversión regulada. **Pasada ligera hecha (2026-09-07); falta favicon y repaso fino.**

### Cierre de la Fase 1
- Recorrido manual completo (visitante + panel) contra `localhost`. **Encuesta probada
  2026-09-07; panel pendiente de probar con cuenta real.**
- `/security-review` antes de mergear a producción. **Pendiente.**
- `README.md` reescrito. **Hecho (2026-09-07).**
- Borrar `PENDIENTE-CLON.md`. **Hecho (2026-09-07).**
- Fichas de `docs/features/` con su cobertura; `verificar-cobertura.mjs` en verde. **En curso.**

---

## Fase 1.5 · Mejoras cercanas

No bloquean la v1; se priorizan según lo que pidan las primeras encuestas reales.

| Trabajo | Requisito / origen |
|---------|--------------------|
| Reanudar una encuesta a medias con el token. | `S-01` |
| Botón "Copiar diagnóstico". | `S-03` |
| Exportar el diagnóstico a PDF desde el panel. | `C-01` |
| Estados de lead en el panel (nuevo / contactado / descartado) + filtro. | `C-02` |
| Reenvío manual del aviso desde el detalle. | `C-03` |
| Envolver los dos bloques de escritura (fin de entrevista, cierre) en RPCs transaccionales de Postgres. | Riesgo asumido en `architecture.md` §7 / `data-model.md` §8 |
| E2E (Playwright) del recorrido del visitante. | `testing.md` §8, si el flujo se vuelve difícil de comprobar a mano |

---

## Fase 2 · Producto con negocio (medición y calibración)

Cuando la v1 lleve semanas en uso.

- **Instrumentar el embudo** de `business.md`: consultas guardadas sobre encuestas iniciadas /
  respondidas / completadas / tasa de completado / abandono por etapa / leads cualificados /
  coste de IA por encuesta (el dato `coste_ia` ya se guarda desde la v1). Visible en el panel o
  como export.
- **Calibrar la rúbrica** con las encuestas reales acumuladas: ajustar umbrales de
  `nivel_preparacion` y el catálogo de casos de uso. Nueva `version_rubrica`.
- **Revisar los umbrales del límite por IP** (`UMBRAL_CREAR_ENCUESTA`, `UMBRAL_ENVIAR_MENSAJE`)
  con datos reales de tráfico y de largo del guion.
- Revisar retención y textos legales con el volumen real de datos personales acumulado.

---

## Fase 3 · SaaS multi-tenant (aparcado)

Proyecto mayor, se retoma solo si el negocio lo justifica. Hoy solo se nombra; criterios de
aceptación y desglose se escriben cuando se decida abordarlo, y cada punto pasará por `prd.md`.

- Registro de consultores; aislamiento de datos por tenant (RLS por `tenant_id`, no solo lista
  blanca).
- Guion de entrevista, rúbrica y marca personalizables por consultor.
- Edición del guion desde la interfaz, sin tocar código.
- Cobro por suscripción (Stripe u otro; su propio MCP y su entrada en `architecture.md`).
- Multi-idioma y selector de idioma.
- Integración con CRM externo (HubSpot, Pipedrive…).
- Analítica de producto embebida (embudo dentro de la app).

---

## Fuera del roadmap

No está planificado y no se hará sin una decisión explícita que lo suba al PRD y a una fase:

- App móvil nativa.
- Cuentas para el visitante / histórico de sus encuestas.
- Marca blanca para reventa.
- Generación automática de propuestas comerciales o presupuestos a partir del diagnóstico.
