import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Ficha } from "@/lib/motor/ficha";
import type { Informe } from "@/lib/motor/informe";

import { clienteClaude, MODELO_ENTREVISTA } from "./client";

/**
 * System prompt de la Fase 4 (§8 de `instrucciones-motor.md`): traduce el informe interno ya
 * calculado a un plan en llano para el visitante. Ruta en literal por la misma razón que
 * `cargarSystemPromptEntrevista` (ver docs/architecture.md → "Trampas conocidas del stack").
 */
function cargarSystemPromptPlan(): string {
  return readFileSync(join(process.cwd(), "instrucciones-motor.md"), "utf-8");
}

/**
 * Solo los campos de `Ficha` que el plan necesita citar en prosa (meta en sus propias palabras,
 * comportamiento ante el riesgo...). Los campos puramente numéricos no se pasan desde aquí: viajan
 * ya calculados en `informe`, para que Claude no tenga ni la tentación de recalcular una cifra.
 */
function resumenFichaParaPlan(ficha: Ficha) {
  return {
    nombre: ficha.nombre.valor,
    objetivoProposito: ficha.objetivoProposito.valor,
    objetivoPlazoAnios: ficha.objetivoPlazoAnios.valor,
    riesgoComportamientoReal: ficha.riesgoComportamientoReal.valor,
    situacionLaboral: ficha.situacionLaboral.valor,
  };
}

/**
 * Fase 4: redacta el plan que ve el visitante, a partir del informe YA calculado por
 * `lib/motor/`. Esta llamada no calcula nada — solo traduce a lenguaje llano siguiendo la
 * estructura fija de §8, con el gating de secciones por modo que impone esa misma sección.
 */
export async function generarPlan(ficha: Ficha, informe: Informe): Promise<string> {
  const claude = clienteClaude();

  const datos = {
    ficha: resumenFichaParaPlan(ficha),
    informe,
  };

  const instruccion = `Redacta el plan para el visitante siguiendo exactamente la estructura y el
gating de la sección "8 · Entrega del plan al visitante (Fase 4)" de tus instrucciones. Usa
EXCLUSIVAMENTE las cifras del siguiente informe ya calculado — no recalcules ni aproximes nada.
El modo de este informe es "${informe.modo}": aplica la tabla de esa sección para decidir qué
secciones incluir. Responde ÚNICAMENTE con el markdown del plan en sí, listo para mostrarse tal
cual en el chat — sin envolverlo en un bloque de código (nada de \`\`\`), sin preámbulo ni cierre
tuyo por fuera del plan.

Datos (JSON):
${JSON.stringify(datos, null, 2)}`;

  const respuesta = await claude.messages.create({
    model: MODELO_ENTREVISTA,
    max_tokens: 4096,
    // Sin razonamiento extendido a propósito: el análisis ya lo hizo `lib/motor/` de forma
    // determinista, aquí solo se traduce a lenguaje llano. El "thinking" consume el mismo
    // presupuesto de max_tokens que la respuesta — con él activado, un plan largo (con las 8
    // secciones de §8) se queda sin tokens para el texto real y sale vacío o cortado a mitad.
    thinking: { type: "disabled" },
    system: cargarSystemPromptPlan(),
    messages: [{ role: "user", content: instruccion }],
  });

  const texto = respuesta.content
    .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
    .map((bloque) => bloque.text)
    .join("\n");

  return quitarVallaDeCodigo(texto);
}

/**
 * Defensa contra el modelo envolviendo la respuesta en un bloque ```markdown ... ``` pese a que se
 * le pide explícitamente que no lo haga — ocurre lo bastante a menudo como para no confiar solo en
 * la instrucción del prompt.
 */
function quitarVallaDeCodigo(texto: string): string {
  const match = texto.trim().match(/^```[a-z]*\n([\s\S]*)\n```$/);
  return match ? match[1] : texto;
}

export interface SeccionPlan {
  titulo: string;
  contenido: string;
}

/**
 * Descompone el markdown del plan en sus secciones (`planes.secciones` de `docs/data-model.md`),
 * partiendo por los encabezados `## ` que impone la estructura fija de §8. Mecánico, no vuelve a
 * llamar a Claude: la información ya está en el markdown, esto solo la reorganiza.
 */
export function seccionarPlan(markdown: string): SeccionPlan[] {
  const secciones: SeccionPlan[] = [];
  let tituloActual: string | null = null;
  let lineasActuales: string[] = [];

  function cerrarSeccion() {
    if (tituloActual === null) return;
    secciones.push({ titulo: tituloActual, contenido: lineasActuales.join("\n").trim() });
    lineasActuales = [];
  }

  for (const linea of markdown.split("\n")) {
    const encabezado = linea.match(/^##\s+(.*)$/);
    if (encabezado) {
      cerrarSeccion();
      tituloActual = encabezado[1].trim();
      continue;
    }
    if (tituloActual !== null) lineasActuales.push(linea);
  }
  cerrarSeccion();

  return secciones;
}

/**
 * Texto fijo de la sección 8 ("La letra pequeña honesta"), tal cual lo exige
 * `instrucciones-motor.md` §8 punto 8 — palabra por palabra, siempre el mismo, en todo plan
 * entregado sin excepción. Se guarda como constante en vez de extraerlo de la respuesta de Claude:
 * así `planes.descargo` es exacto siempre, sin depender de que el modelo lo redacte igual cada vez.
 */
export const DESCARGO_FIJO =
  "Esto es orientación educativa hecha con tus números y supuestos prudentes, no asesoramiento " +
  "financiero regulado ni una promesa de rentabilidad. Un asesor humano revisará tu caso; para " +
  "ejecutar cualquier paso (elegir productos concretos, temas fiscales), contrasta primero con él.";
