import { CtaButton } from "./cta-button";

/** M-01: presentación y punto de entrada al chat. */
export function Hero() {
  return (
    <section className="bg-surface">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-secondary shadow-sm">
          Diagnóstico gratuito · unos 10 minutos
        </span>

        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight text-text-primary sm:text-5xl">
          Descubre por dónde puede empezar tu negocio con la inteligencia artificial
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-text-secondary">
          Responde unas preguntas sobre cómo trabaja tu negocio y <strong>Puente Digital EU</strong>{" "}
          te devuelve al momento una lectura de tu preparación para la IA y una lista de
          automatizaciones por las que empezar — sin cita previa, sin compromiso.
        </p>

        <div className="flex flex-col items-center gap-3 pt-2">
          <CtaButton href="/chat">Empezar mi diagnóstico</CtaButton>
          <p className="max-w-sm text-xs text-text-secondary">
            Orientación preliminar a partir de tus propias respuestas, no un análisis vinculante.
          </p>
        </div>
      </div>
    </section>
  );
}
