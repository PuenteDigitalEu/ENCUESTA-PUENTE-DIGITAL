import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * System prompts leídos de los `.md` de la raíz del repo en tiempo de ejecución (runtime nodejs),
 * para que nunca se desincronicen de su fuente de verdad.
 *
 * Rutas escritas en literal a propósito: con una ruta dinámica, el trazador de Next.js no sabe qué
 * archivos empaquetar y mete el proyecto entero en el despliegue (ver docs/architecture.md §9).
 */

/** Entrevista: cómo se comporta el modelo + el guion de los 8 bloques. */
export function cargarSystemPromptEntrevista(): string {
  const instrucciones = readFileSync(join(process.cwd(), "instrucciones-sistema.md"), "utf-8");
  const guion = readFileSync(join(process.cwd(), "guion-entrevista.md"), "utf-8");
  return `${instrucciones}\n\n---\n\n${guion}`;
}

/** Diagnóstico (2ª llamada): traduce el resultado YA calculado de la rúbrica a texto para el visitante. */
export function cargarSystemPromptDiagnostico(): string {
  return readFileSync(join(process.cwd(), "instrucciones-rubrica.md"), "utf-8");
}
