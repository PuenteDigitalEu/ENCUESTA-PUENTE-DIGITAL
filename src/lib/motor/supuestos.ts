/**
 * supuestos.ts — Transcripción literal de `docs/criterio/reglas-recomendacion.md`.
 *
 * Este archivo es la ÚNICA copia de los valores de criterio en la aplicación. Si las reglas
 * cambian, se cambia aquí y en ningún otro sitio — nunca en calculos.ts.
 */

export type ClaseActivo = 'liquidez' | 'renta_fija' | 'renta_variable' | 'oro';
export type PerfilRiesgo = 'conservador' | 'moderado' | 'dinamico';
export type HorizonteRetirada = '>=40' | '~30' | '~20';

/** Pesos de una cartera por clase de activo. Deben sumar 1. */
export type Cartera = Partial<Record<ClaseActivo, number>>;

/** R5 · escenario central, rentabilidad nominal anual. */
export const RETORNO_NOMINAL: Record<ClaseActivo, number> = {
  liquidez: 0.02,
  renta_fija: 0.03,
  renta_variable: 0.065,
  oro: 0.03,
};

/** R5 · costes anuales sobre la cartera. */
export const COSTES_ANUALES = 0.004;

/** R5 · inflación de referencia (objetivo BCE). */
export const INFLACION = 0.02;

/** R10 · volatilidad anual por clase. [estimado — pendiente de validar] */
export const VOLATILIDAD: Record<ClaseActivo, number> = {
  liquidez: 0.005,
  renta_fija: 0.05,
  renta_variable: 0.15,
  oro: 0.15,
};

/** R10 · correlaciones entre clases. [estimado] Liquidez ≈ 0 con todo. */
const CORRELACION: Record<string, number> = {
  'renta_variable|renta_fija': 0.1,
  'renta_variable|oro': 0.0,
  'renta_fija|oro': 0.2,
};

/** Correlación entre dos clases; 0 si no hay entrada (incluida la liquidez). */
export function correlacion(a: ClaseActivo, b: ClaseActivo): number {
  if (a === b) return 1;
  return CORRELACION[`${a}|${b}`] ?? CORRELACION[`${b}|${a}`] ?? 0;
}

/** R3 · carteras de referencia por perfil. */
export const CARTERAS_BASE: Record<PerfilRiesgo, Cartera> = {
  conservador: { renta_variable: 0.2, renta_fija: 0.6, liquidez: 0.2 },
  moderado: { renta_variable: 0.5, renta_fija: 0.4, liquidez: 0.1 },
  dinamico: { renta_variable: 0.8, renta_fija: 0.15, liquidez: 0.05 },
};

export type BandaProbabilidad = 'alta' | 'razonable' | 'fragil' | 'baja';

/** R10 · bandas de probabilidad de cumplimiento, de mayor a menor umbral. */
export const BANDAS_PROBABILIDAD: ReadonlyArray<readonly [number, BandaProbabilidad]> = [
  [0.8, 'alta'],
  [0.65, 'razonable'],
  [0.5, 'fragil'],
  [0.0, 'baja'],
];

/** R6 · tasa de retirada segura según el horizonte de la retirada. */
export const TASA_RETIRADA: Record<HorizonteRetirada, number> = {
  '>=40': 0.03,
  '~30': 0.0325,
  '~20': 0.04,
};

/** R2 · la aportación propuesta no pasa del 70–80 % del flujo libre. */
export const TOPE_APORTACION: readonly [number, number] = [0.7, 0.8];

/** R1 · deuda cara: TAE por encima de este umbral es prioridad absoluta sobre invertir. */
export const TAE_DEUDA_CARA = 0.08;

/** R10 · mínimo de trayectorias de la simulación. */
export const N_TRAYECTORIAS = 10_000;

/** Semilla fija: dos ejecuciones del mismo informe dan el mismo número (trazabilidad). */
export const SEMILLA = 42;

/** Versión de este puerto — se guarda en `informes.version_motor` (ver docs/data-model.md). */
export const VERSION_MOTOR = '0.1.0';

/** Versión de las reglas de las que se ha hecho el port — se guarda en `informes.version_reglas`. */
export const VERSION_REGLAS = '2026-08-06';
