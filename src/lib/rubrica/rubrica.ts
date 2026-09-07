/**
 * rubrica.ts — `RespuestasEncuesta` → `ResultadoRubrica` (docs/rubrica.md).
 *
 * Determinista y sin dependencias externas: la misma entrada produce siempre la misma salida.
 * El modelo de lenguaje no participa (CLAUDE.md → "Qué NO hacer"). Los pesos y umbrales son de la
 * v1 y se calibran en Fase 2 — por eso todo resultado lleva `versionRubrica`.
 */

import { CATALOGO, type EntradaCatalogo } from './catalogo';
import type {
  CasoUso,
  Dato,
  DatoFaltante,
  NivelPreparacion,
  Proceso,
  RespuestasEncuesta,
  ResultadoRubrica,
  Tarea,
} from './tipos';

export const VERSION_RUBRICA = '2026-09-07';

const sinAcentos = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const tiene = <T>(d: Dato<T>): boolean => d.valor !== null && d.etiqueta !== 'pendiente';

// ── Señales del nivel de preparación (§3.1) ──────────────────────────────────

function señalDigitalizacion(r: RespuestasEncuesta): number {
  const nube = r.usoNube.valor === 'si' ? 2 : r.usoNube.valor === 'parcial' ? 1 : 0;
  const integ =
    r.integracionActual.valor === 'alta' ? 2 : r.integracionActual.valor === 'parcial' ? 1 : 0;
  return nube + integ;
}

function señalMadurezEquipo(r: RespuestasEncuesta): number {
  const mad = r.madurezDigital.valor === 'alta' ? 2 : r.madurezDigital.valor === 'media' ? 1 : 0;
  const ref = r.referenteInterno.valor === 'si' ? 1 : 0;
  return mad + ref;
}

function señalClaridadProcesos(r: RespuestasEncuesta): number {
  let p = 0;
  if (r.procesos.length >= 2) p += 1;
  if (r.tareas.length >= 2) p += 1;
  if (tiene(r.procesoMasCostoso)) p += 1;
  return p;
}

function nivelDesdeScore(score: number): NivelPreparacion {
  if (score <= 2) return 'sin_preparar';
  if (score <= 5) return 'inicial';
  if (score <= 8) return 'en_desarrollo';
  return 'consolidada';
}

// ── Completitud (§5) ────────────────────────────────────────────────────────

const CRITICOS: { campo: keyof RespuestasEncuesta; nombre: string; paraQue: string }[] = [
  { campo: 'sector', nombre: 'sector', paraQue: 'elegir y adaptar los casos de uso' },
  { campo: 'tamanoRango', nombre: 'tamano_rango', paraQue: 'dimensionar qué es realista' },
  { campo: 'integracionActual', nombre: 'integracion_actual', paraQue: 'la señal de digitalización' },
  { campo: 'usoNube', nombre: 'uso_nube', paraQue: 'la señal de digitalización' },
  { campo: 'madurezDigital', nombre: 'madurez_digital', paraQue: 'la señal de madurez del equipo' },
];

function datosFaltantes(r: RespuestasEncuesta): DatoFaltante[] {
  const faltan: DatoFaltante[] = [];
  for (const c of CRITICOS) {
    if (!tiene(r[c.campo] as Dato<unknown>)) faltan.push({ campo: c.nombre, paraQue: c.paraQue });
  }
  if (r.procesos.length + r.tareas.length === 0) {
    faltan.push({
      campo: 'procesos / tareas',
      paraQue: 'sin al menos un proceso o tarea no hay nada que puntuar',
    });
  }
  return faltan;
}

// ── cautela_datos (§3.3) ────────────────────────────────────────────────────

function cautelaDatos(r: RespuestasEncuesta): boolean {
  if (r.datosSensibles.valor === 'si') return true;
  const t = sinAcentos(r.restriccionesDatos.valor ?? '');
  return /no puede salir|no debe salir|externo|confidencial|secreto/.test(t);
}

// ── Ranking de casos de uso (§4.2) ──────────────────────────────────────────

const FRECUENCIA_ALTA = /varias veces|constante|diari|al dia|cada dia|todo el dia|continu|muchas veces/;

interface Match {
  texto: string;
  esMasCostoso: boolean;
  frecuenciaAlta: boolean;
}

function buscarMatch(entrada: EntradaCatalogo, r: RespuestasEncuesta): Match | null {
  const claves = entrada.palabrasClave.map(sinAcentos);
  const nombreMasCostoso = sinAcentos(r.procesoMasCostoso.valor ?? '');

  const encaja = (txt: string) => {
    const t = sinAcentos(txt);
    return claves.some((k) => t.includes(k));
  };

  for (const p of r.procesos as Proceso[]) {
    const partes = [p.nombre.valor, p.dolor.valor].filter(Boolean).join(' ');
    if (partes && encaja(partes)) {
      const nombre = sinAcentos(p.nombre.valor ?? '');
      return {
        texto: p.nombre.valor ?? 'ese proceso',
        esMasCostoso: nombreMasCostoso !== '' && nombre.includes(nombreMasCostoso.slice(0, 12)),
        frecuenciaAlta: FRECUENCIA_ALTA.test(sinAcentos(p.tiempoAprox.valor ?? '')),
      };
    }
  }
  for (const ta of r.tareas as Tarea[]) {
    const partes = [ta.descripcion.valor].filter(Boolean).join(' ');
    if (partes && encaja(partes)) {
      return {
        texto: ta.descripcion.valor ?? 'esa tarea',
        esMasCostoso: false,
        frecuenciaAlta: FRECUENCIA_ALTA.test(sinAcentos(ta.frecuencia.valor ?? '')),
      };
    }
  }
  return null;
}

function puntuarCaso(
  entrada: EntradaCatalogo,
  r: RespuestasEncuesta,
  cautela: boolean,
): CasoUso {
  const match = buscarMatch(entrada, r);
  const motivos: string[] = [];
  const contras: string[] = [];

  // Impacto (base 1)
  let impacto = 1;
  if (match) {
    impacto += 2;
    motivos.push(`encaja con «${match.texto}»`);
    if (match.esMasCostoso || match.frecuenciaAlta) {
      impacto += 1;
      motivos.push(match.esMasCostoso ? 'que es lo que más tiempo te lleva' : 'que haces con mucha frecuencia');
    }
    if (r.cuelloBotellaPersonas.valor === 'si') {
      impacto += 1;
      motivos.push('y ahora depende de una sola persona');
    }
  }
  const datosUtiles = tiene(r.trabajoConDatos) && !/poco|apenas|casi nada/.test(sinAcentos(r.trabajoConDatos.valor ?? ''));
  if (entrada.relevanteDatos && datosUtiles) {
    impacto += 1;
    if (!match) motivos.push('trabajáis bastante con datos a mano');
  }
  impacto = Math.max(1, Math.min(5, impacto));

  // Viabilidad (base 2)
  let viabilidad = 2;
  if (entrada.dependeIntegracion) {
    if (r.integracionActual.valor === 'alta') viabilidad += 2;
    else if (r.integracionActual.valor === 'parcial') viabilidad += 1;
    else contras.push('ahora mismo no hay sistemas conectados');
  }
  if (r.usoNube.valor === 'si') viabilidad += 1;
  if (r.madurezDigital.valor === 'alta') viabilidad += 1;
  else if (r.madurezDigital.valor === 'baja') {
    viabilidad -= 1;
    contras.push('el equipo está poco habituado a lo digital');
  }
  if (r.referenteInterno.valor === 'si') viabilidad += 1;
  if (cautela && entrada.mueveDatosExternos) {
    viabilidad -= 2;
    contras.push('hay que tratarlo con cuidado por los datos sensibles');
  }
  viabilidad = Math.max(1, Math.min(5, viabilidad));

  const justificacion = construirJustificacion(motivos, contras);

  return {
    id: entrada.id,
    nombre: entrada.nombre,
    descripcion: entrada.descripcion,
    impacto,
    viabilidad,
    puntuacion: impacto * viabilidad,
    justificacion,
  };
}

function construirJustificacion(motivos: string[], contras: string[]): string {
  const frases: string[] = [];
  if (motivos.length > 0) {
    frases.push(capitalizar(motivos.join(', ')) + '.');
  } else {
    frases.push('Es una mejora habitual en negocios como el tuyo.');
  }
  if (contras.length > 0) {
    frases.push('A tener en cuenta: ' + contras.join('; ') + '.');
  }
  return frases.join(' ');
}

const capitalizar = (s: string) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));

function ordenarYRecortar(casos: CasoUso[]): CasoUso[] {
  const ordenCatalogo = new Map(CATALOGO.map((e, i) => [e.id, i]));
  const ordenados = [...casos].sort((a, b) => {
    if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
    if (b.impacto !== a.impacto) return b.impacto - a.impacto;
    if (b.viabilidad !== a.viabilidad) return b.viabilidad - a.viabilidad;
    return (ordenCatalogo.get(a.id) ?? 0) - (ordenCatalogo.get(b.id) ?? 0);
  });

  const conImpacto = ordenados.filter((c) => c.impacto >= 3);
  const seleccion = conImpacto.length >= 3 ? conImpacto : ordenados.slice(0, 3);
  return seleccion.slice(0, 6);
}

// ── Entrada pública ─────────────────────────────────────────────────────────

export function calcularRubrica(respuestas: RespuestasEncuesta): ResultadoRubrica {
  const senales = {
    digitalizacion: señalDigitalizacion(respuestas),
    madurezEquipo: señalMadurezEquipo(respuestas),
    claridadProcesos: señalClaridadProcesos(respuestas),
  };
  const preparacionScore =
    senales.digitalizacion + senales.madurezEquipo + senales.claridadProcesos;

  const faltan = datosFaltantes(respuestas);
  const cautela = cautelaDatos(respuestas);

  const casosUso = ordenarYRecortar(
    CATALOGO.map((entrada) => puntuarCaso(entrada, respuestas, cautela)),
  );

  return {
    versionRubrica: VERSION_RUBRICA,
    nivelPreparacion: nivelDesdeScore(preparacionScore),
    preparacionScore,
    senales,
    completo: faltan.length === 0,
    datosFaltantes: faltan,
    cautelaDatos: cautela,
    casosUso,
  };
}
