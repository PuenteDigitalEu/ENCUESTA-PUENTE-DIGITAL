const pasos = [
  {
    numero: "1",
    titulo: "Cuéntanos tu situación",
    descripcion:
      "Responde unas preguntas sencillas sobre tus ingresos, tu ahorro y lo que quieres conseguir. Unos 10-15 minutos, a tu ritmo.",
  },
  {
    numero: "2",
    titulo: "Lo calculamos con reglas claras",
    descripcion:
      "Nada de fórmulas mágicas ni cifras al azar: aplicamos el mismo criterio que usa tu asesor, con cálculos reales detrás de cada número.",
  },
  {
    numero: "3",
    titulo: "Recibe tu plan al momento",
    descripcion:
      "Sin esperas ni segunda cita: ves tu diagnóstico y una propuesta orientativa en la misma conversación.",
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
            <h3 className="font-display text-lg font-semibold text-text-primary">
              {paso.titulo}
            </h3>
            <p className="text-base leading-relaxed text-text-secondary">{paso.descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
