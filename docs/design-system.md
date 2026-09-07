# Sistema de diseño

**Estado del documento:** Vigente (v1)
**Última actualización:** 2026-09-07
**Fuente de verdad de los tokens:** este documento. `src/app/globals.css` es su espejo — se cambia
aquí primero y luego allí, nunca al revés ni en los componentes sueltos.

---

## 1. Herencia del clon

El clon trae un sistema de diseño montado y coherente: tokens en `globals.css`, tipografía en
`layout.tsx`, y componentes de landing y chat que ya lo usan. **La estructura se conserva; el
contenido cambia.**

| Se conserva | Cambia |
|-------------|--------|
| Tokens de color, tipografía (Sora/Inter), radios, contenedores, `.tabular-figures`. | Todo el **copy**: es de asesoría financiera. |
| `CtaButton`, `ChatBubble`, `MarkdownLite`, estructura de `ConsentScreen`, layout de landing. | El **disclaimer regulatorio de inversión** desaparece: `DisclosureBanner` pasa a decir "orientación preliminar, no vinculante" (`M-13`). |
| Patrón "card propia, no una burbuja más" para avisos. | El placeholder `[Nombre de la asesoría]` → `[Nombre de la marca]`. |
| Paleta de estados (success/error/warning). | Se añaden superficies nuevas: formulario de contacto, panel del consultor, diagnóstico de IA. |

## 2. Principios

1. **La conversación es la interfaz.** El visitante pasa casi todo el tiempo en el chat. Todo lo
   demás (landing, formulario, diagnóstico) es marco: sobrio, sin robar atención.
2. **Honestidad visual.** Nada de cifras que "bailan", barras de progreso falsas ni lenguaje que
   prometa un resultado. El diagnóstico es orientación, y se ve como tal.
3. **Sobriedad.** Es una herramienta de diagnóstico para un profesional que decide si invertir
   dinero, no una landing de captación agresiva. Un color de acento, una tipografía de titular, y
   ya.
4. **Legible antes que vistoso**, sobre todo en el panel: es una herramienta interna de una sola
   persona; que se lea de un vistazo importa más que que impresione.

## 3. Marca

**Sin decidir.** En todo el copy se usa el marcador `[Nombre de la marca]` (o `[la marca]` en
frase). **No se inventa un nombre** hasta que el usuario lo confirme. Cuando se decida: se sustituye
en landing (`Hero`, `Footer`), en `metadata` de `layout.tsx`, en el asunto del email de aviso y en
el texto de consentimiento.

Logo, favicon y dominio también pendientes. El `favicon.ico` heredado es el de la asesoría — se
reemplaza al tener marca.

## 4. Tokens de color

Valores actuales (heredados). **Provisionales** hasta que haya marca: sirven para construir, se
revisan al cerrar identidad.

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-primary` | `#3457d5` | Azul. Acciones principales del chat (botón Enviar), acentos de estructura, borde de la burbuja del agente, foco de inputs. Blanco encima cumple AA. |
| `--color-secondary` | `#2f9e6e` | Verde. Etiquetas de refuerzo, confirmaciones suaves. |
| `--color-accent` | `#c9402a` | Coral oscurecido. CTA de entrada ("Empezar", "Acepto y empiezo"). Texto blanco encima: ~4.9:1, cumple AA. |
| `--color-accent-hover` | `#a8351f` | Estado hover del CTA. Se **oscurece** el acento, no se aclara con opacidad (aclararlo rompía el AA). |
| `--color-background` | `#ffffff` | Fondo base. |
| `--color-surface` | `#f4f6fb` | Fondo de secciones alternas, cards, burbuja del agente, bordes suaves. |
| `--color-text-primary` | `#1a1f36` | Texto principal. |
| `--color-text-secondary` | `#5b6478` | Texto secundario, descripciones. AA sobre `background` y sobre `surface`. |
| `--color-success` | `#22c55e` | Estado de éxito. |
| `--color-error` | `#e5484d` | Errores de formulario y de turno. |
| `--color-warning` | `#f5a623` | Avisos (fondo `warning/10`, borde `warning/40`). |

> **Contraste del CTA (`RNF-05`) — resuelto.** El `#ff6b4a` heredado daba ~2.8:1 con texto
> blanco (no cumplía AA). Se oscureció a `#c9402a` (~4.9:1). El hover **no** puede aclarar el
> botón (`hover:bg-accent/90` bajaba el contraste): usa `--color-accent-hover` (`#a8351f`,
> ~6.6:1). El tono definitivo del coral puede reajustarse al fijar la identidad de marca,
> manteniendo el mínimo AA.

No se usan colores fuera de estos tokens. Un tono nuevo se añade aquí antes de usarse.

## 5. Tipografía

- **Display — Sora** (`--font-display`), pesos 600/700. Titulares de landing, encabezados de
  sección, número de paso, badge de nivel de preparación.
- **Cuerpo — Inter** (`--font-body`), peso normal y 600. Todo el texto corrido, el chat, los
  formularios, el panel.
- Cargadas con `next/font/google` en `layout.tsx` (self-hosted por Next, sin request a Google en
  runtime).

Escala (la que ya usan los componentes, formalizada):

| Rol | Clase Tailwind | Nota |
|-----|----------------|------|
| H1 landing | `text-4xl` / `sm:text-5xl`, `font-bold`, display | Solo en `Hero`. |
| H2 sección | `text-2xl` / `sm:text-3xl`, `font-semibold`, display | |
| H3 / subtítulo | `text-lg`, `font-semibold`, display | |
| Cuerpo | `text-base` (`leading-relaxed`) | |
| Chat | `text-[15px]` (`leading-relaxed`) | Ligeramente menor que el cuerpo, más "mensajería". |
| Auxiliar / legal | `text-sm` o `text-xs`, `text-secondary` | Notas de alcance, footer. |
| Cifras | añadir clase `.tabular-figures` | Nivel, puntuaciones, cualquier número que se actualice. |

## 6. Layout, espaciado y forma

- **Contenedores:** landing `max-w-[1120px]`; chat `max-w-[640px]`; formulario/consentimiento
  `max-w-[560px]`; panel puede ir más ancho (`max-w-[1200px]`), es ddenso.
- **Padding de página:** `px-4 sm:px-6`. Secciones: `py-16` a `py-28` en landing; `py-6` en el
  área de chat.
- **Radios:** botones e inputs `rounded-lg`; cards y burbujas `rounded-2xl`; badges/píldoras
  `rounded-full`.
- **Sombra:** mínima. `shadow-sm` en píldoras sobre `surface`. Sin sombras grandes ni glows.
- **Bordes:** `border-surface` para divisores suaves; `border-primary` solo como acento
  intencionado (burbuja del agente, foco).
- **Móvil primero.** Un solo breakpoint real, `sm:` (640px). El chat y el formulario ya son de
  columna única en cualquier ancho.

## 7. Iconografía

El clon no usa iconos. La v1 tampoco los necesita en el flujo del visitante. Si el panel pide
alguno (estado, orden), se usa un set SVG inline ligero (p. ej. Lucide, copiando el SVG, sin
dependencia de runtime) — decisión menor, se toma en la feature del panel.

## 8. Inventario de componentes

### Heredados — se conservan

| Componente | Ajuste para la v1 |
|------------|-------------------|
| `CtaButton` (`primary` = fondo acento, `outline` = borde primario) | Copy. Cambiar el hover de `hover:bg-accent/90` a `hover:bg-accent-hover` (§4). |
| `ChatBubble` (agente: `surface` + borde izq. `primary`; visitante: `primary` + texto blanco) | Sin cambios de estilo. |
| `MarkdownLite` (encabezados 1–3, negrita, listas, párrafos) | Sin cambios: el diagnóstico llega en markdown, igual que el plan heredado. |
| `ConsentScreen` | Reescribir el texto: qué se pregunta (negocio, no finanzas personales), retención **24 meses** (`M-14`), quién recibe los datos (el consultor). |
| `DisclosureBanner` | Nuevo texto: "orientación preliminar, no vinculante". Fuera toda mención a inversión regulada. |
| Landing (`Hero`, `ComoFunciona`, `ProteccionDatos`, `Footer`) | Copy nuevo de arriba abajo. Misma estructura y ritmo visual. |

### Nuevos

- **`FormularioContacto` (`M-08`).** Cuatro campos: nombre de contacto, email, teléfono, empresa.
  Todos obligatorios; el email se valida en cliente y servidor. Aparece en el chat al cerrar la
  entrevista, **antes** del diagnóstico. Inputs con el mismo estilo que el del chat
  (`rounded-lg border-surface`, `focus:border-primary`). Error por campo en `text-error text-sm`.
  Botón de envío `primary`. Estado de carga: botón deshabilitado + texto "Un momento…".
- **`NivelPreparacionBadge`.** Píldora `rounded-full`, tipografía display, con el `nivel_preparacion`
  (`sin preparar` · `inicial` · `en desarrollo` · `consolidada` — provisional). Color por nivel
  usando la paleta de estados (de `error` a `success` pasando por `warning`), no un color nuevo.
- **Ranking de casos de uso.** Lista ordenada de cards. Cada card: nombre del caso (display,
  `text-base font-semibold`), una línea de descripción, y dos medidas — **impacto** y
  **viabilidad** (1–5) — representadas de forma discreta (puntos rellenos/vacíos o barra corta),
  con `.tabular-figures` si se muestra el número. Sin gráficos grandes.
- **`DatosFaltantes` (`M-07`).** Card con `warning/10` / borde `warning/40` (mismo patrón que
  `DisclosureBanner`), titulada "Datos que faltan para completar el análisis", con la lista de lo
  que la rúbrica no pudo usar. Siempre visible cuando el resultado es incompleto.
- **Botón "Copiar diagnóstico" (`S-03`).** Discreto, `outline` o solo texto, junto al diagnóstico.
  Feedback breve al copiar ("Copiado").
- **Panel — listado.** Tabla legible: fecha, empresa, contacto, nivel de preparación (badge),
  nº de casos de uso. Orden por fecha descendente. Fila clicable → detalle. Estado vacío: un
  texto centrado en `text-secondary` ("Todavía no hay encuestas completadas").
- **Panel — detalle.** Tres bloques apilados: (1) contacto y empresa; (2) respuestas agrupadas por
  los 8 bloques del guion (`S-02`); (3) el diagnóstico tal cual lo vio el visitante, con su badge
  de nivel, su ranking y su nota de alcance.
- **Login del consultor.** Pantalla mínima de Supabase Auth (email + enlace mágico o contraseña).
  Sin ilustración ni marketing: título, campo, botón.

## 9. Estados

| Estado | Tratamiento |
|--------|-------------|
| Cargando (turno de chat) | Texto `text-sm text-text-secondary`: "Escribiendo…". Sin spinner. |
| Cargando (acción de botón) | Botón deshabilitado (`disabled:opacity-50`) + texto de espera. |
| Error (turno o formulario) | `text-sm text-error` bajo el elemento. Mensaje en llano, accionable ("Recarga e inténtalo de nuevo"). Nunca un detalle técnico. |
| Vacío (panel) | Texto centrado en `text-secondary`, sin ilustración. |
| Deshabilitado | `opacity-50`, cursor por defecto. |
| Foco | Anillo visible en todo elemento interactivo (§10). |

## 10. Accesibilidad (`RNF-05`)

- **Contraste AA** en todo texto e icono con significado. Pendiente: el acento coral (§4).
- **Foco visible.** Los inputs heredados hacen `focus:border-primary` pero **sin anillo**. Añadir
  `focus-visible:ring-2 focus-visible:ring-primary/40` (o equivalente) a inputs, botones y filas
  clicables del panel. El foco nunca se elimina sin sustituto.
- **Teclado.** Todo el flujo del visitante y el panel se completan sin ratón: el formulario de
  contacto se envía con Enter, las filas del panel son `<a>`/`<button>` reales, no `div` con
  `onClick`.
- **Movimiento.** El chat hace `window.scrollTo({ behavior: "smooth" })`. Envolver en
  `prefers-reduced-motion`: si el usuario lo pide, scroll instantáneo.
- **Semántica.** `lang="es"` (ya está). Encabezados en orden. La tabla del panel es `<table>` con
  `<th>`, no un grid de `div`.
- **Formularios.** `<label>` asociado a cada campo (no solo `placeholder`); errores enlazados con
  `aria-describedby`.

## 11. Copy y tono

- **Español, tuteo.** El clon ya tutea ("Cuéntanos", "tu situación") — se mantiene.
- **Frases cortas, sin jerga.** "Automatizar" sí; "hiperautomatización RPA end-to-end" no. El
  visitante es un responsable de negocio, no necesariamente técnico.
- **Sin promesas.** "Una lectura de por dónde podrías empezar", no "descubre cómo triplicar tu
  productividad".
- **La nota de alcance** ("orientación preliminar, no vinculante") acompaña siempre al
  diagnóstico, en `text-xs`/`text-sm text-secondary`, sin alarmismo.
- **Nombre de la marca:** `[Nombre de la marca]` hasta que se decida.

## 12. Qué NO hacer

- No reintroducir disclaimers de inversión ni lenguaje regulatorio financiero.
- No inventar el nombre de la marca en el copy.
- No usar colores, radios ni sombras fuera de los tokens de §4–§6.
- No animaciones de entrada, parallax, contadores animados ni barras de progreso decorativas.
- No sustituir `<label>` por `placeholder`, ni `<table>` por `div`s en el panel.
- No quitar el anillo de foco sin poner otro.

## 13. Decisiones abiertas

- **Valores y colores de `nivel_preparacion`** — dependen de la rúbrica (paso siguiente).
- **Representación de impacto/viabilidad** en el ranking (puntos vs. barra vs. número) — se cierra
  al maquetar esa card, con datos reales de la rúbrica delante.
- **Set de iconos del panel** — si hace falta, se elige en la feature del panel.
- Identidad de marca completa (nombre, logo, favicon, dominio, y si eso mueve la paleta).
