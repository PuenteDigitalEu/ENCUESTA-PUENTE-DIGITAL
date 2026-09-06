/**
 * Aviso regulatorio — card propia, no una burbuja de chat más (docs/design-system.md), para que
 * no se confunda con contenido conversacional normal ni se pierda entre los turnos.
 */
export function DisclosureBanner() {
  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text-primary">
      Esto es orientación educativa a partir de tus propios datos — no es asesoramiento de
      inversión regulado. Un asesor humano revisará tu caso después.
    </div>
  );
}
