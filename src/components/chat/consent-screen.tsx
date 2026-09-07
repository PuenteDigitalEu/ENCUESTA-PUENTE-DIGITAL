interface ConsentScreenProps {
  onAceptar: () => void;
  cargando: boolean;
  error: string | null;
}

/**
 * M-02: se muestra antes de que exista ninguna encuesta. Hasta que se pulsa "Acepto y empiezo" no
 * se ha creado ninguna fila ni guardado ningún dato — cerrar esta pantalla sin aceptar no deja
 * rastro (docs/user-flows.md → FLOW-01).
 */
export function ConsentScreen({ onAceptar, cargando, error }: ConsentScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-6 py-16 text-center">
      <div className="rounded-2xl border border-surface bg-surface/60 px-6 py-6 text-left text-sm leading-relaxed text-text-primary">
        <h2 className="mb-3 text-base font-semibold text-text-primary">
          Antes de empezar, esto es lo que va a pasar
        </h2>
        <p className="mb-3">
          Te voy a hacer unas preguntas sobre tu negocio — a qué te dedicas, cómo trabajáis hoy,
          qué tareas se repiten, qué herramientas usáis — para darte al final una lectura de por
          dónde podríais empezar con la IA, ahí mismo en el chat.
        </p>
        <p className="mb-3">
          Tus respuestas y tus datos de contacto se guardan de forma segura durante un máximo de
          24 meses, para poder revisar tu caso y ponerme en contacto contigo si quieres seguir
          adelante. No se comparten con nadie más ni se usan para otra cosa.
        </p>
        <p>
          Si no aceptas, o cierras esta pantalla sin pulsar el botón, no se crea ningún registro ni
          se guarda ningún dato tuyo.
        </p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        onClick={onAceptar}
        disabled={cargando}
        className="mx-auto rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {cargando ? "Un momento…" : "Acepto y empiezo"}
      </button>
    </div>
  );
}
