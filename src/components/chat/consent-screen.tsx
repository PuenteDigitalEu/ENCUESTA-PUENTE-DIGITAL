interface ConsentScreenProps {
  onAceptar: () => void;
  cargando: boolean;
  error: string | null;
}

/**
 * M-06: se muestra antes de que exista ninguna conversación. Hasta que se pulsa "Acepto y
 * empiezo" no se ha creado ninguna fila ni guardado ningún dato — cerrar esta pantalla sin aceptar
 * no deja ningún rastro (ver `docs/user-flows.md` → FLOW-01, "Casos de error").
 */
export function ConsentScreen({ onAceptar, cargando, error }: ConsentScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-6 py-16 text-center">
      <div className="rounded-2xl border border-surface bg-surface/60 px-6 py-6 text-left text-sm leading-relaxed text-text-primary">
        <h2 className="mb-3 text-base font-semibold text-text-primary">
          Antes de empezar, esto es lo que va a pasar
        </h2>
        <p className="mb-3">
          Te voy a hacer unas preguntas sobre tu situación financiera — ingresos, gastos, deudas,
          ahorro, tus objetivos — para poder darte, al final, un diagnóstico orientativo y una
          propuesta preliminar, ahí mismo en el chat.
        </p>
        <p className="mb-3">
          Esos datos se guardan de forma segura para que un asesor humano pueda revisar tu caso
          después y ponerse en contacto contigo. No se comparten con nadie más ni se usan para
          nada distinto.
        </p>
        <p>
          Si no aceptas, o cierras esta pantalla sin pulsar el botón, no se crea ningún registro ni
          se guarda ningún dato tuyo — puedes volver a intentarlo cuando quieras.
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        onClick={onAceptar}
        disabled={cargando}
        className="mx-auto rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
      >
        {cargando ? "Un momento…" : "Acepto y empiezo"}
      </button>
    </div>
  );
}
