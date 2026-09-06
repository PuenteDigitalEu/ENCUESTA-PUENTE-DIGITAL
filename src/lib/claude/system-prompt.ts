import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * System prompt de las Fases 1-2 (entrevista y ficha). Se lee directamente de los `.md` de la
 * raíz del repo en vez de copiar su contenido aquí — así el prompt nunca se desincroniza de
 * `instrucciones-sistema.md` / `plantilla-entrevista.md`, que son la fuente de verdad.
 *
 * `instrucciones-sistema.md` por sí solo no basta: dice "sigue plantilla-entrevista.md como
 * guion" pero no incluye su contenido — hay que concatenar los dos.
 *
 * Rutas escritas en literal (no vía parámetro) a propósito: con una ruta dinámica, el trazador de
 * Next.js no puede saber qué archivos hacen falta y empaqueta el proyecto entero para desplegar
 * (aviso real de `pnpm build` — ver docs/architecture.md → "Trampas conocidas del stack").
 */
export function cargarSystemPromptEntrevista(): string {
  const instrucciones = readFileSync(join(process.cwd(), "instrucciones-sistema.md"), "utf-8");
  const plantilla = readFileSync(join(process.cwd(), "plantilla-entrevista.md"), "utf-8");
  return `${instrucciones}\n\n---\n\n${plantilla}`;
}
