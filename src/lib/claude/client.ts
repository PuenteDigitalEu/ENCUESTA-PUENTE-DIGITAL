import Anthropic from "@anthropic-ai/sdk";

let cliente: Anthropic | null = null;

/**
 * Cliente Anthropic, instanciado una sola vez. Falla explícitamente si falta la clave — mejor un
 * error claro en el log que una ruta que responde 500 sin decir por qué.
 */
export function clienteClaude(): Anthropic {
  if (!cliente) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY no está configurada. Rellénala en .env.local (ver .env.example).",
      );
    }
    cliente = new Anthropic({ apiKey });
  }
  return cliente;
}

/** Sonnet 5: equilibrio de calidad/coste adecuado para conducir una entrevista estructurada. */
export const MODELO_ENTREVISTA = "claude-sonnet-5";
