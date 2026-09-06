/**
 * Nota de confianza sobre tratamiento de datos. No sustituye el consentimiento explícito de
 * M-06 (eso ocurre dentro del chat, antes de crear la conversación) — aquí solo se explica el
 * porqué, para que el visitante llegue a esa pantalla sin sorpresas.
 */
export function ProteccionDatos() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          Tus datos, con cuidado
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          Solo te pedimos tu nombre y tu email para que tu asesor pueda contactarte si quieres
          seguir adelante — nada más. No compartimos tus datos con terceros, y antes de empezar
          la entrevista te pedimos tu consentimiento explícito para tratarlos. Puedes pedir que
          se eliminen cuando quieras.
        </p>
      </div>
    </section>
  );
}
