/**
 * parseo.ts — Convierte la ficha de cierre que emite Claude (contrato de `instrucciones-sistema.md`)
 * en un `RespuestasEncuesta`.
 *
 * Nunca lanza por un dato raro: si algo no encaja, ese campo queda `pendiente` y se anota como
 * anomalía. `instrucciones-sistema.md` obliga a no inventar (M-07), así que aquí tampoco se
 * imputa nada.
 */

import type {
  Apetito,
  Dato,
  DecisionQuien,
  Etiqueta,
  Herramienta,
  IntegracionActual,
  MadurezDigital,
  ModeloPreferido,
  PresupuestoRango,
  Proceso,
  RespuestasEncuesta,
  SiNo,
  Tarea,
  TamanoRango,
  UsoNube,
} from './tipos';

export interface ResultadoParseo {
  respuestas: RespuestasEncuesta;
  anomalias: string[];
}

interface Campo {
  valor: string;
  etiqueta: Etiqueta | null;
}

const MARCADOR = /^\s*FICHA-ENCUESTA-IA\s*$/m;
const CON_ETIQUETA = /^([a-z0-9_]+)\s*:\s*(.*?)\s*\[\s*(confirmado|estimado|pendiente)\s*\]\s*$/i;
const SIN_ETIQUETA = /^([a-z0-9_]+)\s*:\s*(.*)$/i;

/** ¿El mensaje del agente ES la ficha de cierre? Basta con la línea marcador. */
export function contieneFicha(textoMensaje: string): boolean {
  return MARCADOR.test(textoMensaje);
}

function extraerCampos(texto: string): Map<string, Campo> {
  const campos = new Map<string, Campo>();
  for (const lineaCruda of texto.split('\n')) {
    const linea = lineaCruda.trim();
    if (!linea || /^FICHA-ENCUESTA-IA$/i.test(linea)) continue;
    const con = linea.match(CON_ETIQUETA);
    if (con) {
      campos.set(con[1].toLowerCase(), {
        valor: con[2].trim(),
        etiqueta: con[3].toLowerCase() as Etiqueta,
      });
      continue;
    }
    const sin = linea.match(SIN_ETIQUETA);
    if (sin) campos.set(sin[1].toLowerCase(), { valor: sin[2].trim(), etiqueta: null });
  }
  return campos;
}

const VACIOS = new Set(['', 'sin dato', 'sin_dato', 'n/a', 'na', 'ninguno', 'nada', '-']);

function datoTexto(campos: Map<string, Campo>, clave: string, anomalias: string[]): Dato<string> {
  const campo = campos.get(clave);
  if (!campo) {
    anomalias.push(`falta la clave "${clave}"`);
    return { valor: null, etiqueta: 'pendiente' };
  }
  if (campo.etiqueta === 'pendiente') return { valor: null, etiqueta: 'pendiente' };
  if (VACIOS.has(campo.valor.toLowerCase())) return { valor: null, etiqueta: 'pendiente' };
  if (campo.etiqueta === null) {
    anomalias.push(`"${clave}" sin etiqueta reconocida — tratada como estimado`);
  }
  return { valor: campo.valor, etiqueta: campo.etiqueta ?? 'estimado' };
}

function datoEnum<T extends string>(
  campos: Map<string, Campo>,
  clave: string,
  validos: readonly T[],
  anomalias: string[],
): Dato<T> {
  const texto = datoTexto(campos, clave, anomalias);
  if (texto.valor === null) return { valor: null, etiqueta: 'pendiente' };
  const normal = texto.valor.trim().toLowerCase() as T;
  if (!validos.includes(normal)) {
    anomalias.push(`"${clave}" = "${texto.valor}" no es uno de [${validos.join('|')}]`);
    return { valor: null, etiqueta: 'pendiente' };
  }
  return { valor: normal, etiqueta: texto.etiqueta };
}

function numeroGrupo(campos: Map<string, Campo>, clave: string, anomalias: string[]): number {
  const campo = campos.get(clave);
  if (!campo) {
    anomalias.push(`falta "${clave}"`);
    return 0;
  }
  const n = Number(campo.valor.trim());
  if (!Number.isInteger(n) || n < 0) {
    anomalias.push(`"${clave}" no es un entero válido: "${campo.valor}"`);
    return 0;
  }
  return Math.min(n, 5);
}

export function parsearRespuestas(texto: string): ResultadoParseo {
  const campos = extraerCampos(texto);
  const anomalias: string[] = [];

  const procesos: Proceso[] = [];
  for (let i = 1; i <= numeroGrupo(campos, 'procesos_numero', anomalias); i++) {
    procesos.push({
      nombre: datoTexto(campos, `proceso_${i}_nombre`, anomalias),
      tiempoAprox: datoTexto(campos, `proceso_${i}_tiempo_aprox`, anomalias),
      dolor: datoTexto(campos, `proceso_${i}_dolor`, anomalias),
    });
  }

  const tareas: Tarea[] = [];
  for (let i = 1; i <= numeroGrupo(campos, 'tareas_numero', anomalias); i++) {
    tareas.push({
      descripcion: datoTexto(campos, `tarea_${i}_descripcion`, anomalias),
      frecuencia: datoTexto(campos, `tarea_${i}_frecuencia`, anomalias),
      volumen: datoTexto(campos, `tarea_${i}_volumen`, anomalias),
    });
  }

  const herramientas: Herramienta[] = [];
  for (let i = 1; i <= numeroGrupo(campos, 'herramientas_numero', anomalias); i++) {
    herramientas.push({
      nombre: datoTexto(campos, `herramienta_${i}_nombre`, anomalias),
      paraQue: datoTexto(campos, `herramienta_${i}_para_que`, anomalias),
    });
  }

  const respuestas: RespuestasEncuesta = {
    sector: datoTexto(campos, 'sector', anomalias),
    tamanoRango: datoEnum<TamanoRango>(campos, 'tamano_rango', ['autonomo', '1-9', '10-49', '50+'], anomalias),
    estacionalidad: datoEnum<SiNo>(campos, 'estacionalidad', ['si', 'no'], anomalias),
    estacionalidadDetalle: datoTexto(campos, 'estacionalidad_detalle', anomalias),

    procesos,
    procesoMasCostoso: datoTexto(campos, 'proceso_mas_costoso', anomalias),
    procesosConErrores: datoTexto(campos, 'procesos_con_errores', anomalias),

    tareas,
    trabajoConDatos: datoTexto(campos, 'trabajo_con_datos', anomalias),
    cuelloBotellaPersonas: datoEnum<SiNo>(campos, 'cuello_botella_personas', ['si', 'no'], anomalias),
    cuelloBotellaDetalle: datoTexto(campos, 'cuello_botella_detalle', anomalias),

    herramientas,
    integracionActual: datoEnum<IntegracionActual>(campos, 'integracion_actual', ['ninguna', 'parcial', 'alta'], anomalias),
    procesosEnPapel: datoTexto(campos, 'procesos_en_papel', anomalias),
    usoNube: datoEnum<UsoNube>(campos, 'uso_nube', ['si', 'no', 'parcial'], anomalias),

    madurezDigital: datoEnum<MadurezDigital>(campos, 'madurez_digital', ['baja', 'media', 'alta'], anomalias),
    intentosPrevios: datoTexto(campos, 'intentos_previos', anomalias),
    referenteInterno: datoEnum<SiNo>(campos, 'referente_interno', ['si', 'no'], anomalias),

    datosSensibles: datoEnum<SiNo>(campos, 'datos_sensibles', ['si', 'no'], anomalias),
    datosSensiblesTipo: datoTexto(campos, 'datos_sensibles_tipo', anomalias),
    requisitosCumplimiento: datoTexto(campos, 'requisitos_cumplimiento', anomalias),
    restriccionesDatos: datoTexto(campos, 'restricciones_datos', anomalias),

    presupuestoRango: datoEnum<PresupuestoRango>(campos, 'presupuesto_rango', ['sin_definir', '<1k', '1k-5k', '5k-20k', '>20k'], anomalias),
    apetito: datoEnum<Apetito>(campos, 'apetito', ['bajo', 'medio', 'alto'], anomalias),
    modeloPreferido: datoEnum<ModeloPreferido>(campos, 'modelo_preferido', ['puntual', 'continuo', 'sin_definir'], anomalias),

    decisionQuien: datoEnum<DecisionQuien>(campos, 'decision_quien', ['yo', 'socios', 'comite', 'superior', 'sin_definir'], anomalias),
    responsableImplantacion: datoTexto(campos, 'responsable_implantacion', anomalias),
  };

  return { respuestas, anomalias };
}
