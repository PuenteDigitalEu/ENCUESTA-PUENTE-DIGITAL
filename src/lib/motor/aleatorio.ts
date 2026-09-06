/**
 * aleatorio.ts — Generador pseudoaleatorio con semilla para el Monte Carlo (R10).
 *
 * Misma semilla y mismos datos ⇒ mismo resultado, siempre — es la garantía que necesita
 * `informes.version_motor` para que un informe antiguo se pueda auditar (ver docs/data-model.md).
 */

/** PRNG mulberry32: rápido, con estado de 32 bits y período suficiente para esto. */
export function generador(semilla: number): () => number {
  let estado = semilla >>> 0;
  return function siguiente(): number {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normales estándar por Box–Muller polar, que consume dos uniformes y devuelve dos normales
 * independientes. Se rellena el array completo de una vez porque el Monte Carlo necesita cientos
 * de miles de muestras.
 */
export function normalesEstandar(n: number, semilla: number): Float64Array {
  const uniforme = generador(semilla);
  const salida = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let u: number;
    let v: number;
    let s: number;
    do {
      u = uniforme() * 2 - 1;
      v = uniforme() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const factor = Math.sqrt((-2 * Math.log(s)) / s);
    salida[i++] = u * factor;
    if (i < n) salida[i++] = v * factor;
  }
  return salida;
}
