/**
 * M-13: nota de alcance — card propia, no una burbuja de chat más (docs/design-system.md), para
 * que no se confunda con contenido conversacional. Sin disclaimer regulatorio de inversión.
 */
export function DisclosureBanner() {
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text-primary">
      Lo que sale de aquí es una orientación preliminar hecha con tus respuestas, no un análisis
      vinculante. Sirve para ver por dónde empezar; el detalle lo vemos contigo.
    </div>
  );
}
