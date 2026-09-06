import { CtaButton } from "./cta-button";

/**
 * M-01 del PRD: presentación de la asesoría y del agente, con punto de entrada claro al chat.
 * "[Nombre de la asesoría]" es un placeholder deliberado — ver docs/design-system.md: el nombre
 * comercial está pendiente de decidir y no se inventa aquí.
 */
export function Hero() {
  return (
    <section className="bg-surface">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-secondary shadow-sm">
          Diagnóstico financiero gratuito
        </span>

        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
          Descubre en minutos si vas camino de tu meta financiera
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-text-secondary">
          Habla con el asistente de <strong>[Nombre de la asesoría]</strong>, cuéntale tu
          situación con tus propias palabras, y recibe al momento una foto clara de dónde estás
          hoy — sin cita previa, sin compromiso.
        </p>

        <div className="flex flex-col items-center gap-3 pt-2">
          <CtaButton href="/chat">Empezar mi diagnóstico</CtaButton>
          <p className="max-w-sm text-xs text-text-secondary">
            Orientación educativa a partir de tus propios números. No es asesoramiento de
            inversión regulado.
          </p>
        </div>
      </div>
    </section>
  );
}
