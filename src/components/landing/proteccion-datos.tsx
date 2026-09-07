/**
 * Nota de confianza sobre tratamiento de datos. No sustituye el consentimiento explícito de M-02
 * (eso ocurre dentro del chat, antes de crear la encuesta) — aquí solo se explica el porqué.
 */
export function ProteccionDatos() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          Tus datos, con cuidado
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">
          Al terminar te pedimos tu nombre, tu email, tu teléfono y el de tu empresa para poder
          revisar tu caso y contactarte si quieres seguir. Las respuestas y esos datos se guardan de
          forma segura durante un máximo de 24 meses, no se comparten con terceros, y antes de
          empezar te pedimos tu consentimiento explícito. Puedes pedir que se eliminen cuando
          quieras.
        </p>
      </div>
    </section>
  );
}
