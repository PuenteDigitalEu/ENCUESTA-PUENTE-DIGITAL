# Los 8 documentos de docs/ pasan a "Vigente" y se resuelven sus decisiones abiertas

**Fecha:** 2026-09-07 08:39
**Tipo:** Documentación
**Requisitos:** Ninguno (afina requisitos ya declarados; no cierra ninguno)

## Qué se hizo

Cierre de la tarea 0.1 del roadmap. Los ocho documentos de `docs/` pasan de "Borrador para
validar" a **"Vigente (v1)"**, tras resolver con el usuario las decisiones que quedaban abiertas:

1. **Contraste del acento coral (`RNF-05`).** El `#ff6b4a` heredado daba ~2.8:1 con texto blanco,
   no cumplía WCAG AA. Se oscurece el token a `#c9402a` (~4.9:1) y se añade
   `--color-accent-hover` `#a8351f` (~6.6:1), porque el hover heredado (`hover:bg-accent/90`)
   aclaraba el botón y rompía el AA. Cambio aplicado en `src/app/globals.css`; el cambio de
   `CtaButton` para usar `accent-hover` queda para la feature F7.
2. **Ampliar CI.** Se decide añadir un workflow con `pnpm lint` + `pnpm test` + `pnpm build`
   además de la cobertura. Se crea en la tarea 0.8 del roadmap. Deja de ser "decisión abierta" en
   `testing.md`.
3. **Persistir las respuestas sin contacto.** Se decide **sí**: al detectar la ficha de cierre se
   persiste `respuestas` y la encuesta pasa a un estado nuevo `respondida` (entrevista terminada,
   sin contacto ni diagnóstico). El cierre completo (contacto → resultado → diagnóstico →
   `completada`) ocurre después, al rellenar el formulario. El panel muestra también las
   `respondida`, marcadas "sin contacto".
4. **Registrar el coste de IA por encuesta desde la v1.** Se añade `respuestas.coste_ia jsonb`
   con el `usage` de las dos llamadas a Claude (`{ entrevista, diagnostico }`). Alimenta la
   métrica de coste de `business.md`; deja de estar pendiente para Fase 2.

## Qué se modificó

- `src/app/globals.css` — `--color-accent` a `#c9402a`; nuevo `--color-accent-hover` `#a8351f`
  (definido en `:root` y expuesto en `@theme inline`).
- `docs/data-model.md` — estado `respondida` en `encuestas`; `respuestas` se persiste al terminar
  la entrevista (no al cerrar); nueva columna `respuestas.coste_ia`; §7 invariantes, §8 (dos
  momentos de escritura), §9 comparativa y §10 al día.
- `docs/user-flows.md` — FLOW-01 reescrito (persistencia en dos momentos, estado `respondida`,
  casos de error nuevos); FLOW-03 y FLOW-05 contemplan `respondida`.
- `docs/architecture.md` — §5 flujo runtime (pasos 4, 5, 8); §7 persistencia en dos momentos +
  `coste_ia`; §11 CI; estado "Vigente".
- `docs/design-system.md` — tokens `--color-accent` / `--color-accent-hover`; aviso de contraste
  marcado como resuelto; `CtaButton` nota de hover.
- `docs/testing.md` — §6 CI ya decidido; §7 filas `M-08`/`M-09` con el estado `respondida`; §8 sin
  la decisión de CI.
- `docs/roadmap.md` — 0.1 hecho; 0.7 y 0.8 concretados; F2/F4/F6 con la persistencia en dos
  momentos y el estado `respondida`.
- `docs/business.md` — §4 métricas con `respondida` y `coste_ia`; §7 instrumentación (parte ya en
  v1); §8 decisiones abiertas actualizadas.
- `docs/prd.md` — `M-09` (persistencia en dos momentos) y `M-11` (el panel lista también
  `respondida`); estado "Vigente".

## Por qué

Sin cerrar estas decisiones, la reescritura de la migración `001` (tarea 0.5) y las features de
persistencia y panel (F1, F4, F6) se harían sobre un modelo a medias. El estado `respondida` y la
columna `coste_ia` son cambios de esquema: entran ahora, antes de escribir el SQL, no después.
