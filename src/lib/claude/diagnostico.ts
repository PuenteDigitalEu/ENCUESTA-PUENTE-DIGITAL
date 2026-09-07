import type Anthropic from "@anthropic-ai/sdk";

import type { ResultadoRubrica, RespuestasEncuesta } from "@/lib/rubrica";

import { clienteClaude, MODELO_ENTREVISTA } from "./client";
import { cargarSystemPromptDiagnostico } from "./system-prompt";
import type { UsoIa } from "@/lib/supabase/persistencia";

/**
 * Fase de diagnóstico (2ª llamada a Claude): redacta el texto que ve el visitante a partir del
 * `ResultadoRubrica` YA calculado por `src/lib/rubrica/`. Esta llamada **no calcula nada** — solo
 * traduce a lenguaje llano (M-06).
 */

/** Texto fijo de M-13, palabra por palabra, en todo diagnóstico. Se guarda con el diagnóstico. */
export const NOTA_ALCANCE =
  "Esto es una orientación preliminar hecha con tus respuestas, no un análisis vinculante ni un " +
  "compromiso. Si quieres, lo revisamos contigo en detalle antes de dar cualquier paso.";

export interface SeccionDiagnostico {
  titulo: string;
  contenido: string;
}

export interface DiagnosticoGenerado {
  markdown: string;
  secciones: SeccionDiagnostico[];
  uso: UsoIa;
}

/** Solo lo que el diagnóstico necesita citar en prosa. Las cifras/orden ya vienen en `resultado`. */
function resumenRespuestas(r: RespuestasEncuesta) {
  return {
    sector: r.sector.valor,
    tamano: r.tamanoRango.valor,
    procesoMasCostoso: r.procesoMasCostoso.valor,
    presupuesto: r.presupuestoRango.valor,
    apetito: r.apetito.valor,
  };
}

export async function generarDiagnostico(
  respuestas: RespuestasEncuesta,
  resultado: ResultadoRubrica,
): Promise<DiagnosticoGenerado> {
  const claude = clienteClaude();

  const datos = { rubrica: resultado, contexto: resumenRespuestas(respuestas) };

  const instruccion = `Redacta el diagnóstico para el visitante siguiendo la estructura de tus
instrucciones. Usa EXCLUSIVAMENTE los valores del siguiente JSON ya calculado — no recalcules, no
inventes cifras ni casos de uso que no estén en la lista. Si "completo" es false, di con
naturalidad qué falta (campos de "datosFaltantes") y que por eso el análisis está condicionado.
Nunca llames "sin preparar" a un nivel: si "nivelPreparacion" es "sin_preparar", habla de "punto
de partida". Responde ÚNICAMENTE con el markdown del diagnóstico, sin envolverlo en un bloque de
código, sin preámbulo ni despedida.

Datos (JSON):
${JSON.stringify(datos, null, 2)}`;

  const respuesta = await claude.messages.create({
    model: MODELO_ENTREVISTA,
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: cargarSystemPromptDiagnostico(),
    messages: [{ role: "user", content: instruccion }],
  });

  const texto = respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const markdown = quitarVallaDeCodigo(texto).trim();

  return {
    markdown,
    secciones: seccionar(markdown),
    uso: {
      input_tokens: respuesta.usage.input_tokens,
      output_tokens: respuesta.usage.output_tokens,
      cache_read_input_tokens: respuesta.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: respuesta.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

function quitarVallaDeCodigo(texto: string): string {
  const match = texto.trim().match(/^```[a-z]*\n([\s\S]*)\n```$/);
  return match ? match[1] : texto;
}

/** Descompone el markdown en secciones por los encabezados `##`. Mecánico, no llama a Claude. */
export function seccionar(markdown: string): SeccionDiagnostico[] {
  const secciones: SeccionDiagnostico[] = [];
  let titulo: string | null = null;
  let lineas: string[] = [];

  const cerrar = () => {
    if (titulo === null) return;
    secciones.push({ titulo, contenido: lineas.join("\n").trim() });
    lineas = [];
  };

  for (const linea of markdown.split("\n")) {
    const h = linea.match(/^##\s+(.*)$/);
    if (h) {
      cerrar();
      titulo = h[1].trim();
      continue;
    }
    if (titulo !== null) lineas.push(linea);
  }
  cerrar();
  return secciones;
}
