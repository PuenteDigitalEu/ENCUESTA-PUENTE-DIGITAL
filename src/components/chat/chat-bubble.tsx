import { MarkdownLite } from "./markdown-lite";

interface ChatBubbleProps {
  sender: "agent" | "visitor";
  content: string;
}

/**
 * Burbuja de un turno de la conversación. Ver docs/design-system.md → "Estilo de componentes".
 *
 * El contenido del agente pasa por `MarkdownLite` porque el plan de la Fase 4 (§8 de
 * instrucciones-motor.md) llega en markdown — ver `docs/data-model.md` → `planes.markdown`. Una
 * pregunta normal de la entrevista, al no traer sintaxis markdown, se renderiza igual que antes.
 */
export function ChatBubble({ sender, content }: ChatBubbleProps) {
  const esAgente = sender === "agent";
  return (
    <div className={`flex ${esAgente ? "justify-start" : "justify-end"}`}>
      <div
        className={
          esAgente
            ? "max-w-[80%] rounded-2xl border-l-4 border-primary bg-surface px-4 py-3 text-text-primary"
            : "max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-white"
        }
      >
        {esAgente ? (
          <MarkdownLite texto={content} />
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{content}</p>
        )}
      </div>
    </div>
  );
}
