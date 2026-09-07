/**
 * tipos.ts — Contrato de datos de la rúbrica.
 *
 * `RespuestasEncuesta` es el objeto canónico que se guarda en `respuestas.contenido`
 * (ver docs/data-model.md). Sus campos son los del contrato de la ficha de cierre de
 * `instrucciones-sistema.md`. `ResultadoRubrica` es la salida determinista de `calcularRubrica`
 * (ver docs/rubrica.md), que se guarda en `resultados_rubrica`.
 */

/** Calidad de cada respuesta (docs/rubrica.md §1). */
export type Etiqueta = 'confirmado' | 'estimado' | 'pendiente';

/** Un dato nunca viaja solo: lleva su calidad. `pendiente` ⇒ `valor` es `null`. */
export interface Dato<T> {
  valor: T | null;
  etiqueta: Etiqueta;
}

export type TamanoRango = 'autonomo' | '1-9' | '10-49' | '50+';
export type SiNo = 'si' | 'no';
export type IntegracionActual = 'ninguna' | 'parcial' | 'alta';
export type UsoNube = 'si' | 'no' | 'parcial';
export type MadurezDigital = 'baja' | 'media' | 'alta';
export type PresupuestoRango = 'sin_definir' | '<1k' | '1k-5k' | '5k-20k' | '>20k';
export type Apetito = 'bajo' | 'medio' | 'alto';
export type ModeloPreferido = 'puntual' | 'continuo' | 'sin_definir';
export type DecisionQuien = 'yo' | 'socios' | 'comite' | 'superior' | 'sin_definir';

export interface Proceso {
  nombre: Dato<string>;
  tiempoAprox: Dato<string>;
  dolor: Dato<string>;
}

export interface Tarea {
  descripcion: Dato<string>;
  frecuencia: Dato<string>;
  volumen: Dato<string>;
}

export interface Herramienta {
  nombre: Dato<string>;
  paraQue: Dato<string>;
}

export interface RespuestasEncuesta {
  // Bloque 1
  sector: Dato<string>;
  tamanoRango: Dato<TamanoRango>;
  estacionalidad: Dato<SiNo>;
  estacionalidadDetalle: Dato<string>;
  // Bloque 2
  procesos: Proceso[];
  procesoMasCostoso: Dato<string>;
  procesosConErrores: Dato<string>;
  // Bloque 3
  tareas: Tarea[];
  trabajoConDatos: Dato<string>;
  cuelloBotellaPersonas: Dato<SiNo>;
  cuelloBotellaDetalle: Dato<string>;
  // Bloque 4
  herramientas: Herramienta[];
  integracionActual: Dato<IntegracionActual>;
  procesosEnPapel: Dato<string>;
  usoNube: Dato<UsoNube>;
  // Bloque 5
  madurezDigital: Dato<MadurezDigital>;
  intentosPrevios: Dato<string>;
  referenteInterno: Dato<SiNo>;
  // Bloque 6
  datosSensibles: Dato<SiNo>;
  datosSensiblesTipo: Dato<string>;
  requisitosCumplimiento: Dato<string>;
  restriccionesDatos: Dato<string>;
  // Bloque 7
  presupuestoRango: Dato<PresupuestoRango>;
  apetito: Dato<Apetito>;
  modeloPreferido: Dato<ModeloPreferido>;
  // Bloque 8
  decisionQuien: Dato<DecisionQuien>;
  responsableImplantacion: Dato<string>;
}

// ── Salida de la rúbrica ─────────────────────────────────────────────────────

export type NivelPreparacion = 'sin_preparar' | 'inicial' | 'en_desarrollo' | 'consolidada';

export interface CasoUso {
  id: string;
  nombre: string;
  descripcion: string;
  /** 1-5 */
  impacto: number;
  /** 1-5 */
  viabilidad: number;
  /** impacto × viabilidad, 1-25 */
  puntuacion: number;
  justificacion: string;
}

export interface DatoFaltante {
  campo: string;
  paraQue: string;
}

export interface ResultadoRubrica {
  versionRubrica: string;
  nivelPreparacion: NivelPreparacion;
  /** 0-10, trazabilidad del nivel */
  preparacionScore: number;
  senales: {
    digitalizacion: number;
    madurezEquipo: number;
    claridadProcesos: number;
  };
  /** M-07: false si falta algún campo crítico */
  completo: boolean;
  datosFaltantes: DatoFaltante[];
  /** datos sensibles / restricciones fuertes */
  cautelaDatos: boolean;
  casosUso: CasoUso[];
}
