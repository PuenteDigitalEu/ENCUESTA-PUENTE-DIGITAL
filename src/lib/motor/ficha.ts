/**
 * ficha.ts — El contrato de datos del sistema.
 *
 * Las claves son las mismas de `instrucciones-sistema.md` (contrato de la ficha) y de la tabla
 * `fichas`/`deudas` en `docs/data-model.md`. No renombrar sin actualizar los tres a la vez: el
 * motor, el parseo de la ficha en `app/api/chat/` y la fase 4 (redacción del plan) dependen de que
 * coincidan exactamente.
 */

import type { PerfilRiesgo } from './supuestos';

/** Calidad del dato (R9). Decide el modo del informe. */
export type Etiqueta = 'confirmado' | 'estimado' | 'pendiente';

/** Un dato de la ficha nunca viaja solo: lleva su calidad. Sin ella no se puede decidir el modo. */
export interface Dato<T> {
  valor: T | null;
  etiqueta: Etiqueta;
}

export type EstabilidadIngresos = 'estable' | 'variable';
export type ToleranciaRiesgo = 'baja' | 'media' | 'alta';
export type DeudaInteresAltoDeclarado = 'si' | 'no' | 'no_facilitado';

/**
 * Cada campo lleva su propia etiqueta (igual que `deudas` en `data-model.md`): el interés puede
 * quedar pendiente (C8) aunque el importe y la cuota estén confirmados.
 */
export interface Deuda {
  tipo: Dato<string>;
  importe: Dato<number>;
  cuota: Dato<number>;
  /** TAE en %. R1: > 7-8 % es deuda cara, prioridad absoluta sobre invertir. */
  interes: Dato<number>;
}

export interface Ficha {
  nombre: Dato<string>;
  /**
   * Del contrato de la ficha (bloque 0), pero `lib/motor/` nunca lo usa para ningún cálculo — solo
   * lo consume la capa de persistencia para crear o enlazar el `cliente` (ver
   * `docs/data-model.md` → `clientes`: el email vive ahí, no en `fichas`).
   */
  email: Dato<string>;
  /**
   * Único campo de la ficha sin etiqueta `[confirmado|estimado|pendiente]` en el contrato de texto
   * (`instrucciones-sistema.md`: `fecha_entrevista: [YYYY-MM-DD]`) — no es un dato que el cliente
   * pueda ignorar o estimar, lo rellena el propio agente con la fecha real. Por eso es un `string`
   * plano, no un `Dato<string>`.
   */
  fechaEntrevista: string | null;

  ingresosNetosMensual: Dato<number>;
  ingresosEstabilidad: Dato<EstabilidadIngresos>;
  gastosFijosMensual: Dato<number>;

  /**
   * R9 · Bloque 3 es el único de la entrevista con protocolo de insistencia — nunca se "no
   * preguntó". Por eso `etiqueta === 'pendiente'` aquí siempre implica negativa explícita del
   * cliente, y basta para determinar el modo `suspendido` (§4 de instrucciones-motor.md).
   */
  deudas: Dato<Deuda[]>;
  /** Fallback de C17 cuando `deudas` queda pendiente. No sustituye a `deudas`. */
  deudasInteresAltoDeclarado: Dato<DeudaInteresAltoDeclarado>;

  patrimonioLiquido: Dato<number>;
  patrimonioInvertido: Dato<number>;
  /** Reparto aproximado por clase de activo, en prosa. "no aplica" si patrimonioInvertido es 0. */
  patrimonioDistribucion: Dato<string>;
  aportacionMensualActual: Dato<number>;

  colchonMeses: Dato<number>;

  objetivoProposito: Dato<string>;
  /** Cifra en € totales si la meta es de patrimonio; null si es cualitativa. */
  objetivoImporte: Dato<number>;
  objetivoPlazoAnios: Dato<number>;

  riesgoToleranciaDeclarada: Dato<ToleranciaRiesgo>;
  /** "sin dato" si nunca vivió una caída real — prevalece sobre la tolerancia declarada (R3/C6). */
  riesgoComportamientoReal: Dato<string>;
  /**
   * Clasificado por la Fase 2 (agente) a partir de las dos anteriores — `lib/motor/` lo usa tal
   * cual, nunca interpreta texto libre por su cuenta (ver instrucciones-sistema.md).
   */
  riesgoPerfilDerivado: Dato<PerfilRiesgo>;

  edad: Dato<number>;
  personasACargo: Dato<number>;
  situacionLaboral: Dato<string>;
}

/** §3 de instrucciones-motor.md · Clasificación de la meta. Determina si es convertible a patrimonio. */
export type TipoMeta = 'patrimonio' | 'renta_cartera' | 'renta_negocio' | 'mixta_ambigua';

/** §4 de instrucciones-motor.md · Modo del informe según la calidad del dato (R9). */
export type ModoInforme = 'completo' | 'condicionado' | 'suspendido';

/**
 * R9 · Variables críticas. Si alguna está `pendiente` (y no es el caso especial de deudas, que
 * suspende directamente), el informe no puede emitir propuesta ejecutable.
 *
 * `riesgoPerfilDerivado` NO está aquí a propósito, aunque R9 la nombra entre las críticas: tiene
 * su propio colchón (C5 de instrucciones-motor.md — perfil no calculable → conservador por
 * defecto), así que su ausencia no baja el modo del informe entero.
 */
export const VARIABLES_CRITICAS = [
  'ingresosNetosMensual',
  'gastosFijosMensual',
  'deudas',
  'colchonMeses',
  'patrimonioInvertido',
  'objetivoImporte',
  'objetivoPlazoAnios',
] as const satisfies ReadonlyArray<keyof Ficha>;

/**
 * §4 · Determina el modo del informe.
 *
 * La negativa del cliente a hablar de deudas no es «un dato menos»: suspende la recomendación
 * entera, porque sin ella el plan podría aconsejar invertir a alguien que primero debería cancelar
 * una deuda cara.
 */
export function determinarModo(ficha: Ficha): { modo: ModoInforme; faltantes: string[] } {
  if (ficha.deudas.etiqueta === 'pendiente') {
    return { modo: 'suspendido', faltantes: ['deudas'] };
  }

  const faltantes = VARIABLES_CRITICAS.filter(
    (clave) => (ficha[clave] as Dato<unknown>).etiqueta === 'pendiente',
  );

  return {
    modo: faltantes.length > 0 ? 'condicionado' : 'completo',
    faltantes: [...faltantes],
  };
}

/**
 * §3 · Clasifica el tipo de meta a partir de `objetivoProposito` y `situacionLaboral`.
 *
 * Heurística de texto simple y deliberadamente conservadora: ante la duda, `mixta_ambigua` — que
 * es justo el modo que obliga a no proyectar nada sin dejarlo dicho (§3 de instrucciones-motor.md).
 *
 * La clasificación depende solo del texto, nunca de si `objetivoImporte` tiene valor: para
 * `renta_cartera`, ese mismo campo se reutiliza más adelante como la renta mensual a convertir
 * (R6) — exigir que estuviera vacío para clasificar como renta habría hecho imposible convertirla
 * después.
 */
export function clasificarMeta(ficha: Ficha): TipoMeta {
  const proposito = (ficha.objetivoProposito.valor ?? '').toLowerCase();
  const laboral = (ficha.situacionLaboral.valor ?? '').toLowerCase();
  const textoNegocio = /negocio|autónomo|autonomo|empresa propia|mi empresa|facturación|facturacion/;
  const textoRentaMensual = /renta|vivir de|al mes|mensual/;

  const esDeNegocio = textoNegocio.test(proposito) || textoNegocio.test(laboral);
  const esRentaMensual = textoRentaMensual.test(proposito);

  if (esDeNegocio) return 'renta_negocio';
  if (esRentaMensual) return 'renta_cartera';

  const objetivoImporteValido =
    ficha.objetivoImporte.etiqueta !== 'pendiente' && ficha.objetivoImporte.valor !== null;
  const plazoValido =
    ficha.objetivoPlazoAnios.etiqueta !== 'pendiente' && ficha.objetivoPlazoAnios.valor !== null;
  if (objetivoImporteValido && plazoValido) return 'patrimonio';
  return 'mixta_ambigua';
}
