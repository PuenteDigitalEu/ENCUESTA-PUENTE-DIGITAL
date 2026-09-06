/**
 * calculos.ts — Funciones puras del motor (R1–R10 de `docs/criterio/reglas-recomendacion.md`).
 *
 * Módulo puro: sin acceso a red, a base de datos ni al modelo de lenguaje (ver decisión técnica
 * en `docs/architecture.md`). Cada función corresponde a una regla o combinación de reglas
 * concreta — el comentario de cada una cita su regla para poder auditarla contra
 * `docs/criterio/reglas-recomendacion.md` sin tener que releer el código.
 *
 * Lo que este archivo NO es: el pipeline completo de `instrucciones-motor.md` §1 que recibe una
 * `Ficha` y devuelve un informe entero (clasificación de meta, catálogo de casos borde C1–C17,
 * elección de escenario de inviabilidad R4, transición de patrimonio R7...). Esa orquestación se
 * construye junto con `app/api/chat/`, porque depende de cómo se parsea la ficha y de qué hace
 * falta exactamente en cada modo — hacerlo aparte, a ciegas, se rehace en cuanto se integre.
 * Lo de aquí son los cálculos atómicos que esa orquestación va a necesitar, ya correctos y
 * probados uno a uno.
 */

import { normalesEstandar } from './aleatorio';
import { percentil, redondear } from './numerico';
import {
  BANDAS_PROBABILIDAD,
  type BandaProbabilidad,
  CARTERAS_BASE,
  type Cartera,
  type ClaseActivo,
  COSTES_ANUALES,
  correlacion,
  type HorizonteRetirada,
  INFLACION,
  N_TRAYECTORIAS,
  type PerfilRiesgo,
  RETORNO_NOMINAL,
  SEMILLA,
  TASA_RETIRADA,
  TOPE_APORTACION,
  VOLATILIDAD,
} from './supuestos';

/**
 * R3 · El plazo prevalece sobre el perfil.
 * C2 · Frontera de banda (p. ej. exactamente 3 años) → banda más conservadora.
 * C3 · Puntos de renta variable retirados van a renta fija de corta duración. [estimado]
 */
export function ajustarCarteraPorPlazo(perfil: PerfilRiesgo, plazoAnios: number): Cartera {
  const base = { ...CARTERAS_BASE[perfil] };
  const rv = base.renta_variable ?? 0;

  let recorte: number;
  if (plazoAnios <= 3) {
    const rvMax = 0.1;
    recorte = Math.max(0, rv - rvMax);
  } else if (plazoAnios <= 7) {
    recorte = 0.1; // banda −10 a −20 puntos: se usa el extremo prudente, −10.
  } else {
    recorte = 0;
  }

  const resultado: Cartera = {
    ...base,
    renta_variable: redondear(rv - recorte, 4),
    renta_fija: redondear((base.renta_fija ?? 0) + recorte, 4),
  };

  const suma = Object.values(resultado).reduce((acc, v) => acc + (v ?? 0), 0);
  if (Math.abs(suma - 1) > 1e-9) {
    throw new Error(`ajustarCarteraPorPlazo: los pesos no suman 1 (suman ${suma})`);
  }
  return resultado;
}

/** R5 · Media ponderada por composición, neta de costes. Anual nominal. */
export function rentabilidadCartera(pesos: Cartera): number {
  const bruta = (Object.entries(pesos) as [ClaseActivo, number][]).reduce(
    (acc, [clase, peso]) => acc + peso * RETORNO_NOMINAL[clase],
    0,
  );
  return bruta - COSTES_ANUALES;
}

/** Volatilidad anual de la cartera con las correlaciones de R10. */
export function volatilidadCartera(pesos: Cartera): number {
  const clases = Object.keys(pesos) as ClaseActivo[];
  let varianza = 0;
  for (const a of clases) {
    for (const b of clases) {
      const rho = correlacion(a, b);
      varianza += (pesos[a] ?? 0) * (pesos[b] ?? 0) * VOLATILIDAD[a] * VOLATILIDAD[b] * rho;
    }
  }
  return Math.sqrt(varianza);
}

/** R2 + C1 · Flujo libre = ingresos − gasto (− cuotas de deuda, si no están ya en el gasto). */
export function flujoLibre(
  ingresosMes: number,
  gastoMes: number,
  cuotasIncluidasEnGasto: boolean,
  cuotasMes = 0,
): number {
  return ingresosMes - gastoMes - (cuotasIncluidasEnGasto ? 0 : cuotasMes);
}

export interface AportacionPropuesta {
  propuesta: number | [number, number];
  rangoSostenible: readonly [number, number];
  tope: number;
  viable: boolean;
}

/**
 * R2 · La meta manda, acotada al tope sostenible.
 * C14 · Si la requerida cabe en el tope, se propone la requerida (no el tope máximo).
 * `requerida === null` → no hay meta convertible que evaluar; se devuelve el rango sostenible y
 * `viable: true` no significa "meta alcanzada", significa "no hay meta que declarar inviable".
 */
export function aportacionPropuesta(
  requerida: number | null,
  flujo: number,
  colchonCompleto: boolean,
  provisionesOk: boolean,
): AportacionPropuesta {
  const tope = flujo * (colchonCompleto && provisionesOk ? 1 : TOPE_APORTACION[1]);
  const rangoSostenible: [number, number] = [flujo * TOPE_APORTACION[0], flujo * TOPE_APORTACION[1]];

  if (requerida !== null && requerida <= tope) {
    return { propuesta: requerida, rangoSostenible, tope, viable: true };
  }
  return {
    propuesta: rangoSostenible,
    rangoSostenible,
    tope,
    viable: requerida === null,
  };
}

/** Proyección central: valor futuro nominal con capitalización mensual. */
export function vfDeterminista(
  patrimonio: number,
  aportacionMes: number,
  rAnual: number,
  anios: number,
): number {
  const rMensual = (1 + rAnual) ** (1 / 12) - 1;
  const meses = Math.round(anios * 12);
  if (rMensual === 0) return patrimonio + aportacionMes * meses;
  return (
    patrimonio * (1 + rMensual) ** meses +
    (aportacionMes * ((1 + rMensual) ** meses - 1)) / rMensual
  );
}

/**
 * Inversa de `vfDeterminista`: la aportación mensual (nominal) que hace falta para llegar a
 * `objetivoReal` (euros actuales) en `anios`, partiendo de `patrimonio`. Fórmula cerrada — no hay
 * que buscar por aproximaciones sucesivas.
 */
export function aportacionRequerida(
  patrimonio: number,
  objetivoReal: number,
  rAnual: number,
  anios: number,
): number {
  const objetivoNominal = objetivoReal * (1 + INFLACION) ** anios;
  const rMensual = (1 + rAnual) ** (1 / 12) - 1;
  const meses = Math.round(anios * 12);
  const patrimonioCrecido = patrimonio * (1 + rMensual) ** meses;
  if (rMensual === 0) return (objetivoNominal - patrimonioCrecido) / meses;
  return ((objetivoNominal - patrimonioCrecido) * rMensual) / ((1 + rMensual) ** meses - 1);
}

/** R5 · Resultados en euros actuales (deflactar con la inflación de referencia). */
export function aEurosActuales(valorNominal: number, anios: number): number {
  return valorNominal / (1 + INFLACION) ** anios;
}

/** En cuántos años se alcanza el objetivo (en euros actuales). `null` si no se alcanza en 100 años. */
export function aniosHastaMeta(
  patrimonio: number,
  aportacionMes: number,
  rAnual: number,
  objetivoReal: number,
  maxAnios = 100,
): number | null {
  for (let mes = 1; mes <= maxAnios * 12; mes++) {
    const anios = mes / 12;
    const valor = aEurosActuales(vfDeterminista(patrimonio, aportacionMes, rAnual, anios), anios);
    if (valor >= objetivoReal) return redondear(anios, 1);
  }
  return null;
}

/**
 * R6 · Convierte solo la renta que debe generar LA CARTERA (ya neta de pensiones u otros ingresos
 * previsibles — eso se descuenta antes de llamar a esta función). Nunca el 4 % automático.
 */
export function convertirMetaRenta(rentaMesCartera: number, horizonteRetirada: HorizonteRetirada): number {
  return (rentaMesCartera * 12) / TASA_RETIRADA[horizonteRetirada];
}

export interface ResultadoMonteCarlo {
  pesimista: number;
  central: number;
  optimista: number;
  n: number;
  muCartera: number;
  sigmaCartera: number;
  probabilidadCumplimiento: number | null;
  banda: BandaProbabilidad | null;
}

/**
 * R10 · Simulación Monte Carlo (≥10.000 trayectorias mensuales, modelo lognormal a nivel cartera).
 * Salida en euros actuales: percentiles p10/p50/p90 y, si se da un objetivo, probabilidad de
 * cumplimiento con su banda. Nunca se presenta como cifra determinista única — ver
 * `instrucciones-motor.md` §5 y §8.
 */
export function monteCarlo(
  patrimonio: number,
  aportacionMes: number,
  pesos: Cartera,
  anios: number,
  objetivoReal: number | null = null,
  semilla = SEMILLA,
  nTrayectorias = N_TRAYECTORIAS,
): ResultadoMonteCarlo {
  const mu = rentabilidadCartera(pesos);
  const sigma = volatilidadCartera(pesos);
  const meses = Math.round(anios * 12);

  const muMensual = Math.log(1 + mu) / 12;
  const sigmaMensual = sigma / Math.sqrt(12);

  const normales = normalesEstandar(nTrayectorias * meses, semilla);
  const valores = new Float64Array(nTrayectorias).fill(patrimonio);

  for (let t = 0; t < meses; t++) {
    for (let i = 0; i < nTrayectorias; i++) {
      const z = normales[t * nTrayectorias + i];
      const factor = Math.exp(muMensual - 0.5 * sigmaMensual ** 2 + sigmaMensual * z);
      valores[i] = valores[i] * factor + aportacionMes;
    }
  }

  const deflactor = (1 + INFLACION) ** anios;
  const reales = Array.from(valores, (v) => v / deflactor);

  let probabilidadCumplimiento: number | null = null;
  let banda: BandaProbabilidad | null = null;
  if (objetivoReal !== null) {
    const cumplidos = reales.filter((v) => v >= objetivoReal).length;
    probabilidadCumplimiento = cumplidos / nTrayectorias;
    banda = BANDAS_PROBABILIDAD.find(([umbral]) => probabilidadCumplimiento! >= umbral)![1];
  }

  return {
    pesimista: percentil(reales, 10),
    central: percentil(reales, 50),
    optimista: percentil(reales, 90),
    n: nTrayectorias,
    muCartera: mu,
    sigmaCartera: sigma,
    probabilidadCumplimiento,
    banda,
  };
}
