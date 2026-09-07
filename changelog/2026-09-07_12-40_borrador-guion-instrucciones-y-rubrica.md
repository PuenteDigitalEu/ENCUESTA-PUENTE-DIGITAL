# Borrador del guion de la entrevista, las instrucciones de sistema y la rúbrica

**Fecha:** 2026-09-07 12:40
**Tipo:** Documentación
**Requisitos:** Ninguno (prepara la base de `M-03`, `M-04`, `M-05`; no cierra ninguno)

## Qué se hizo

Tareas 0.3 y 0.4 del roadmap, en borrador para validar:

- **`guion-entrevista.md`** (raíz) — el guion conversacional: cómo se conduce (una pregunta por
  turno, seguir el hilo, ~15-20 turnos), apertura, los ocho bloques temáticos (cada uno con qué
  busca la rúbrica, por dónde tirar y qué campos alimenta) y el cierre. Impacto cualitativo 1-5
  decidido: el guion no pide cuantificar horas/€.
- **`instrucciones-sistema.md`** (raíz) — reglas de conducta del modelo durante la entrevista y el
  **contrato de la ficha de cierre**: mensaje que empieza por `FICHA-ENCUESTA-IA`, formato
  `clave: valor [etiqueta]`, contrato campo a campo de los ocho bloques, ejemplo completo y reglas
  de parseo. Es lo que `parsearRespuestas` tendrá que leer (F2/F3).
- **`docs/rubrica.md`** (nuevo) — spec determinista de `src/lib/rubrica/`: nivel de preparación
  (`sin_preparar | inicial | en_desarrollo | consolidada`) a partir de tres señales de campos
  enum; catálogo de 12 casos de uso transversales; fórmula impacto × viabilidad; reglas de
  completitud (`M-07`); objeto de salida. Todos los pesos y umbrales son de la v1 y se calibran en
  Fase 2.

Decisiones tomadas con el usuario: el nivel mide preparación, no necesidad (por tono, nada de
"necesidad: ALTA"); `sin_preparar` se llama "punto de partida" de cara al visitante;
`presupuesto_rango`/`apetito`/`decision_quien` no bloquean el diagnóstico; el catálogo es ancho a
propósito porque la práctica de consultoría está arrancando.

`instrucciones-rubrica.md` (el prompt del diagnóstico, 2ª llamada a Claude) se escribe con la
feature F4, no ahora.

## Qué se modificó

- `guion-entrevista.md`, `instrucciones-sistema.md` — nuevos (raíz del repo).
- `docs/rubrica.md` — nuevo.
- `docs/data-model.md` — `nivel_preparacion` deja de ser "provisional"; apunta a `docs/rubrica.md`.
- `docs/roadmap.md` — 0.3 y 0.4 marcadas con borrador hecho; 0.3 aclara que
  `instrucciones-rubrica.md` va con F4.
- `docs/business.md` — §1 reconoce que la práctica de consultoría está empezando.
- `package.json` + `pnpm-lock.yaml` — añadido `supabase` 2.116.0 como devDependency (CLI del
  proyecto; se ejecuta con `pnpm exec supabase` o `node_modules/.bin/supabase`).

## Por qué

El chat heredado (`src/app/api/chat/`) no arranca sin `instrucciones-sistema.md` y
`guion-entrevista.md` (hace `readFileSync` de esos nombres). Redefinir el guion y la rúbrica en
`docs/` antes de tocar ese código es lo que pide `CLAUDE.md`. Con estos tres archivos, las features
F2 (entrevista) y F3 (rúbrica) ya tienen contra qué implementar.
