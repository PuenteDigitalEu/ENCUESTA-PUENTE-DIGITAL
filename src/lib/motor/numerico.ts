/**
 * numerico.ts — Utilidades numéricas del motor.
 *
 * El redondeo bancario ("half to even") es el que usa `round()` de Python — no es el motivo aquí
 * (este port no coteja contra un oráculo Python, es nativo), pero sí es el criterio financiero
 * más extendido para evitar sesgo sistemático al redondear muchas cifras, así que se conserva.
 */

/** Redondeo bancario ("half to even"). */
export function redondear(x: number, decimales = 0): number {
  const factor = 10 ** decimales;
  const escalado = x * factor;
  const suelo = Math.floor(escalado);
  const resto = escalado - suelo;

  // La comparación es exacta a propósito: un empate solo cuenta como tal si el double vale .5
  // exactamente. Con tolerancia difusa, valores como 1.5000000000000002 se tratarían como empate
  // y el redondeo dejaría de ser predecible.
  let redondeado: number;
  if (resto === 0.5) {
    redondeado = suelo % 2 === 0 ? suelo : suelo + 1;
  } else {
    redondeado = Math.round(escalado);
  }
  // El `+ 0` evita devolver -0, que rompe comparaciones estrictas en los tests.
  return redondeado / factor + 0;
}

/**
 * Percentil por interpolación lineal, el método por defecto de `numpy.percentile`. No es
 * casualidad: así los resultados del Monte Carlo son comparables con cualquier verificación hecha
 * en Python durante el diseño de las reglas.
 */
export function percentil(valores: number[], q: number): number {
  if (valores.length === 0) throw new Error('percentil: array vacío');
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicion = (q / 100) * (ordenados.length - 1);
  const inferior = Math.floor(posicion);
  const superior = Math.ceil(posicion);
  if (inferior === superior) return ordenados[inferior];
  const peso = posicion - inferior;
  return ordenados[inferior] * (1 - peso) + ordenados[superior] * peso;
}

/** Formato de euros del plan: entero, con punto de millar. Ej. «24.880 €». */
const FORMATO_EUROS = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });

export function eur(x: number): string {
  return `${FORMATO_EUROS.format(redondear(x))} €`;
}
