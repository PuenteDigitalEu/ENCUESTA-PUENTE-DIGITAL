/**
 * informe.ts — El orquestador: `Ficha` → `Informe` (§7 de `instrucciones-motor.md`).
 *
 * Recorre el catálogo de casos borde C1-C17 y aplica R1-R10 con las funciones puras de
 * `calculos.ts`. Ninguna cifra ejecutable (aportación, cartera, proyección, gap, Monte Carlo) sale
 * de aquí si `modo !== 'completo'` o si el flujo libre no es positivo (R8/C10) — es la línea roja
 * de `instrucciones-motor.md` §4 y §8, y de "Qué NO hacer" en CLAUDE.md.
 */

import {
  aEurosActuales,
  ajustarCarteraPorPlazo,
  aniosHastaMeta,
  aportacionPropuesta,
  aportacionRequerida,
  convertirMetaRenta,
  flujoLibre,
  monteCarlo,
  rentabilidadCartera,
  vfDeterminista,
} from './calculos';
import { clasificarMeta, determinarModo, type Ficha, type ModoInforme, type TipoMeta } from './ficha';
import { redondear } from './numerico';
import {
  type BandaProbabilidad,
  type Cartera,
  type HorizonteRetirada,
  type PerfilRiesgo,
  VERSION_MOTOR,
  VERSION_REGLAS,
} from './supuestos';

export interface EscenarioInviabilidad {
  tipo: 'plazo_mayor' | 'meta_reducida';
  descripcion: string;
  anios?: number;
  importe?: number;
}

export interface Informe {
  modo: ModoInforme;
  tipoMeta: TipoMeta;

  /** "Tu foto de hoy" (§8) — se calcula siempre que haya ingresos y gastos, sea cual sea el modo. */
  flujoLibre: number | null;
  colchonCompleto: boolean | null;

  perfil: PerfilRiesgo;
  /** true si `riesgoPerfilDerivado` estaba pendiente y se aplicó el conservador por defecto (C5). */
  perfilPendiente: boolean;

  porcentajeCaminoRecorrido: number | null;
  proyeccionValorFuturo: number | null;
  gapEuros: number | null;
  gapAnios: number | null;

  /** Solo en modo `completo` con flujo libre positivo — nunca antes (línea roja). */
  aportacionPropuesta: number | null;
  aportacionRangoSostenible: readonly [number, number] | null;
  carteraObjetivo: Cartera | null;
  rentabilidadEsperadaNeta: number | null;

  mcPercentilPesimista: number | null;
  mcPercentilCentral: number | null;
  mcPercentilOptimista: number | null;
  mcProbabilidadCumplimiento: number | null;
  mcBanda: BandaProbabilidad | null;

  /** R4: null si no hay meta convertible que evaluar; false dispara `escenariosInviabilidad`. */
  metaViable: boolean | null;
  escenariosInviabilidad: EscenarioInviabilidad[];

  /** Casos borde y datos pendientes para que el asesor los trate en la reunión (§7 Parte C). */
  pendientesReunion: string[];

  versionMotor: string;
  versionReglas: string;
}

function sumaCuotasDeuda(ficha: Ficha): number {
  if (!ficha.deudas.valor) return 0;
  return ficha.deudas.valor.reduce((acc, d) => acc + (d.cuota.valor ?? 0), 0);
}

/**
 * R6 · El horizonte de retirada se deriva del propio plazo hasta el objetivo: no es un dato que
 * la ficha recoja aparte. Interpolación prudente entre las tres bandas con nombre de la tabla.
 */
function horizonteRetiradaDesdePlazo(anios: number): HorizonteRetirada {
  if (anios >= 40) return '>=40';
  if (anios >= 25) return '~30';
  return '~20';
}

function baseInforme(
  modo: ModoInforme,
  tipoMeta: TipoMeta,
  flujoLibreValor: number | null,
  colchonCompleto: boolean | null,
  perfil: PerfilRiesgo,
  perfilPendiente: boolean,
  pendientesReunion: string[],
): Informe {
  return {
    modo,
    tipoMeta,
    flujoLibre: flujoLibreValor,
    colchonCompleto,
    perfil,
    perfilPendiente,
    porcentajeCaminoRecorrido: null,
    proyeccionValorFuturo: null,
    gapEuros: null,
    gapAnios: null,
    aportacionPropuesta: null,
    aportacionRangoSostenible: null,
    carteraObjetivo: null,
    rentabilidadEsperadaNeta: null,
    mcPercentilPesimista: null,
    mcPercentilCentral: null,
    mcPercentilOptimista: null,
    mcProbabilidadCumplimiento: null,
    mcBanda: null,
    metaViable: null,
    escenariosInviabilidad: [],
    pendientesReunion,
    versionMotor: VERSION_MOTOR,
    versionReglas: VERSION_REGLAS,
  };
}

export function calcularInforme(ficha: Ficha): Informe {
  const { modo, faltantes } = determinarModo(ficha);
  const tipoMeta = clasificarMeta(ficha);
  const pendientesReunion: string[] = faltantes.map((f) => `dato pendiente: ${f}`);

  // Flujo libre (§8 "Tu foto de hoy"): se intenta siempre que haya ingresos y gastos, sea cual sea
  // el modo — se muestra incluso en condicionado/suspendido.
  const cuotasTotal = sumaCuotasDeuda(ficha);
  const flujoLibreValor =
    ficha.ingresosNetosMensual.valor !== null && ficha.gastosFijosMensual.valor !== null
      ? flujoLibre(ficha.ingresosNetosMensual.valor, ficha.gastosFijosMensual.valor, false, cuotasTotal)
      : null;

  // Perfil (C5): riesgo_perfil_derivado ya viene clasificado por la Fase 2; si falta, conservador
  // por defecto — esto NO baja el modo del informe (ver instrucciones-motor.md §4).
  const perfilPendiente = ficha.riesgoPerfilDerivado.valor === null;
  const perfil: PerfilRiesgo = ficha.riesgoPerfilDerivado.valor ?? 'conservador';
  if (perfilPendiente) {
    pendientesReunion.push('perfil de riesgo no calculable a partir de la entrevista — se usó conservador por defecto (C5)');
  }

  // Colchón (C4): umbral según estabilidad de ingresos; si no se sabe, el más exigente (6 meses)
  // por prudencia (R9: el dato que falta se resuelve siempre contra el optimismo).
  const umbralColchon = ficha.ingresosEstabilidad.valor === 'estable' ? 3 : 6;
  const colchonCompleto = ficha.colchonMeses.valor !== null ? ficha.colchonMeses.valor >= umbralColchon : null;

  // C15: patrimonio ya invertido sin distribución conocida — la transición (R7) queda pendiente.
  if (
    ficha.patrimonioInvertido.valor !== null &&
    ficha.patrimonioInvertido.valor > 0 &&
    ficha.patrimonioDistribucion.etiqueta === 'pendiente'
  ) {
    pendientesReunion.push(
      'transición del patrimonio pendiente: no se conoce la composición de lo ya invertido (C15)',
    );
  }

  // C8: deuda con interés (TAE) pendiente — no se puede clasificar como cara/barata.
  if (ficha.deudas.valor) {
    for (const [i, deuda] of ficha.deudas.valor.entries()) {
      if (deuda.interes.etiqueta === 'pendiente') {
        pendientesReunion.push(
          `deuda ${i + 1} (${deuda.tipo.valor ?? 'sin tipo'}): interés (TAE) desconocido, no se puede priorizar como cara o barata (C8)`,
        );
      }
    }
  }
  // C17: deudas sin detalle pero el cliente confirmó interés alto — se prioriza como si hubiera deuda cara.
  if (ficha.deudas.etiqueta === 'pendiente' && ficha.deudasInteresAltoDeclarado.valor === 'si') {
    pendientesReunion.push(
      'deudas sin detalle, pero el cliente confirmó tener interés alto — se prioriza como si hubiera deuda cara (C17)',
    );
  }

  const base = baseInforme(modo, tipoMeta, flujoLibreValor, colchonCompleto, perfil, perfilPendiente, pendientesReunion);

  // R8/C10: flujo libre desconocido o <= 0 → modo de estabilización, sin cartera ejecutable,
  // cualquiera que sea el modo de calidad del dato.
  if (flujoLibreValor === null || flujoLibreValor <= 0) {
    if (flujoLibreValor !== null && flujoLibreValor <= 0) {
      pendientesReunion.push('flujo libre ≤ 0 — plan de estabilización (R8), sin cartera ejecutable');
    }
    return base;
  }

  // Línea roja (CLAUDE.md / instrucciones-motor.md §4 y §8): nunca propuesta ejecutable fuera de
  // modo completo.
  if (modo !== 'completo') {
    return base;
  }

  // A partir de aquí: modo === 'completo' y flujoLibre > 0 — sí se calcula la propuesta.
  const plazoAnios = ficha.objetivoPlazoAnios.valor!; // crítica: garantizada no-null en modo completo
  const cartera = ajustarCarteraPorPlazo(perfil, plazoAnios);
  const rentabilidad = rentabilidadCartera(cartera);
  const patrimonioBase = ficha.patrimonioInvertido.valor ?? 0;

  // R6: la meta se convierte a patrimonio objetivo solo cuando tiene sentido — nunca en
  // renta_negocio (no se estima el valor de un negocio) ni en mixta_ambigua (clasificación no
  // resuelta: proyectar contra un número sería fingir una certeza que no hay).
  let objetivoReal: number | null = null;
  if (tipoMeta === 'patrimonio') {
    objetivoReal = ficha.objetivoImporte.valor;
  } else if (tipoMeta === 'renta_cartera' && ficha.objetivoImporte.valor !== null) {
    const horizonte = horizonteRetiradaDesdePlazo(plazoAnios);
    objetivoReal = convertirMetaRenta(ficha.objetivoImporte.valor, horizonte);
  } else if (tipoMeta === 'renta_negocio' || tipoMeta === 'mixta_ambigua') {
    pendientesReunion.push(
      `meta clasificada como "${tipoMeta}" — no se proyecta contra una cifra objetivo (R6); se propone aportación y cartera sin gap asociado`,
    );
  }

  const requerida =
    objetivoReal !== null ? aportacionRequerida(patrimonioBase, objetivoReal, rentabilidad, plazoAnios) : null;

  // provisionesOk: la ficha no recoge este dato — se asume prudentemente que no, así el tope de
  // aportación nunca sube al 100 % del flujo libre sin confirmación explícita (R9).
  const propuesta = aportacionPropuesta(requerida, flujoLibreValor, colchonCompleto ?? false, false);
  const aportacionFinal = typeof propuesta.propuesta === 'number' ? propuesta.propuesta : propuesta.rangoSostenible[0];

  const proyeccionNominal = vfDeterminista(patrimonioBase, aportacionFinal, rentabilidad, plazoAnios);
  const proyeccionReal = aEurosActuales(proyeccionNominal, plazoAnios);

  const porcentajeCamino =
    objetivoReal !== null && objetivoReal > 0 ? redondear((patrimonioBase / objetivoReal) * 100, 1) : null;
  const gapEuros = objetivoReal !== null ? redondear(objetivoReal - proyeccionReal) : null;

  const metaViable = objetivoReal !== null ? propuesta.viable : null;
  const escenariosInviabilidad: EscenarioInviabilidad[] = [];
  if (metaViable === false && objetivoReal !== null) {
    const aportacionMaxima = propuesta.rangoSostenible[1];
    const aniosNecesarios = aniosHastaMeta(patrimonioBase, aportacionMaxima, rentabilidad, objetivoReal);
    if (aniosNecesarios !== null) {
      escenariosInviabilidad.push({
        tipo: 'plazo_mayor',
        descripcion: 'Mismo objetivo, más tiempo — aportando el máximo sostenible',
        anios: aniosNecesarios,
      });
    }
    const alcanzadoEnPlazo = aEurosActuales(
      vfDeterminista(patrimonioBase, aportacionMaxima, rentabilidad, plazoAnios),
      plazoAnios,
    );
    escenariosInviabilidad.push({
      tipo: 'meta_reducida',
      descripcion: 'Mismo plazo, meta ajustada al máximo sostenible',
      importe: redondear(alcanzadoEnPlazo),
    });
  }

  // R10/M-07: Monte Carlo solo con meta convertible a patrimonio — sin objetivo no hay
  // probabilidad de cumplimiento que calcular, solo la banda de percentiles.
  const mc = monteCarlo(patrimonioBase, aportacionFinal, cartera, plazoAnios, objetivoReal);

  const gapAnios =
    objetivoReal !== null ? aniosHastaMeta(patrimonioBase, aportacionFinal, rentabilidad, objetivoReal) : null;

  return {
    ...base,
    porcentajeCaminoRecorrido: porcentajeCamino,
    proyeccionValorFuturo: redondear(proyeccionReal),
    gapEuros,
    gapAnios,
    aportacionPropuesta: redondear(aportacionFinal),
    aportacionRangoSostenible: propuesta.rangoSostenible,
    carteraObjetivo: cartera,
    rentabilidadEsperadaNeta: rentabilidad,
    mcPercentilPesimista: redondear(mc.pesimista),
    mcPercentilCentral: redondear(mc.central),
    mcPercentilOptimista: redondear(mc.optimista),
    mcProbabilidadCumplimiento: mc.probabilidadCumplimiento,
    mcBanda: mc.banda,
    metaViable,
    escenariosInviabilidad,
    pendientesReunion,
  };
}
