const pasos = [
  {
    numero: "1",
    titulo: "Cuéntanos cómo trabajáis",
    descripcion:
      "Responde unas preguntas sencillas sobre tu negocio: procesos, tareas repetitivas, herramientas y equipo. Unos 10 minutos, a tu ritmo.",
  },
  {
    numero: "2",
    titulo: "Lo analizamos con criterio",
    descripcion:
      "Nada de valoraciones al azar: aplicamos siempre el mismo criterio para medir tu preparación y ordenar las oportunidades por impacto y por lo fácil que es ponerlas en marcha.",
  },
  {
    numero: "3",
    titulo: "Recibe tu diagnóstico al momento",
    descripcion:
      "En la misma conversación ves tu nivel de preparación y una lista priorizada de automatizaciones por las que empezar.",
  },
];

export function ComoFunciona() {
  return (
    <section className="mx-auto max-w-[1120px] px-4 py-20 sm:px-6">
      <h2 className="text-center font-display text-2xl font-semibold text-text-primary sm:text-3xl">
        Cómo funciona
      </h2>

      <div className="mt-12 grid gap-8 sm:grid-cols-3">
        {pasos.map((paso) => (
          <div key={paso.numero} className="flex flex-col items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-white">
              {paso.numero}
            </span>
            <h3 className="font-display text-lg font-semibold text-text-primary">{paso.titulo}</h3>
            <p className="text-base leading-relaxed text-text-secondary">{paso.descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
