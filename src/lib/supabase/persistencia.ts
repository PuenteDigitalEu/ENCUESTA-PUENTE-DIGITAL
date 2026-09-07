import type { SupabaseClient } from '@supabase/supabase-js';

import type { RespuestasEncuesta, ResultadoRubrica } from '@/lib/rubrica';

/**
 * Toda la escritura en Supabase de la encuesta, agrupada aquí para que `app/api/` no tenga SQL
 * disperso. El mapeo camelCase ↔ snake_case vive en un único sitio.
 *
 * Sin transacción SQL (docs/data-model.md §8): las escrituras van como inserts secuenciales, en
 * dos momentos — fin de entrevista (`persistirRespuestas`) y cierre (`persistirCierre`). Si una
 * falla a mitad se acepta el riesgo de una fila huérfana para el MVP; se detecta por los
 * `console.error` de la ruta que llama.
 */

// ── Alta de la encuesta ─────────────────────────────────────────────────────

/** M-02: crea la encuesta al aceptar el consentimiento. Nada más existe antes de esto. */
export async function crearEncuesta(
  supabase: SupabaseClient,
  consentimientoVersion: string,
): Promise<{ id: string; token: string }> {
  const { data, error } = await supabase
    .from('encuestas')
    .insert({
      consentimiento_en: new Date().toISOString(),
      consentimiento_version: consentimientoVersion,
    })
    .select('id, token')
    .single();

  if (error) throw new Error(`No se pudo crear la encuesta: ${error.message}`);
  return { id: data.id as string, token: data.token as string };
}

export interface EncuestaValida {
  id: string;
  estado: string;
  turnosTotales: number;
}

/**
 * El token es lo único que autoriza a escribir en una encuesta concreta. `estadosPermitidos`
 * acota para qué vale: la entrevista solo procesa `en_curso`; el cierre solo procesa `respondida`.
 * `null` cubre todos los motivos de rechazo con el mismo mensaje genérico hacia el visitante.
 */
export async function validarToken(
  supabase: SupabaseClient,
  token: string,
  estadosPermitidos: readonly string[],
): Promise<EncuestaValida | null> {
  const { data, error } = await supabase
    .from('encuestas')
    .select('id, estado, expira_en, turnos_totales')
    .eq('token', token)
    .maybeSingle();

  if (error) throw new Error(`No se pudo validar el token: ${error.message}`);
  if (!data) return null;
  if (!estadosPermitidos.includes(data.estado as string)) return null;
  if (new Date(data.expira_en as string).getTime() < Date.now()) return null;

  return {
    id: data.id as string,
    estado: data.estado as string,
    turnosTotales: data.turnos_totales as number,
  };
}

export async function incrementarTurno(
  supabase: SupabaseClient,
  encuestaId: string,
  turnosActuales: number,
): Promise<void> {
  const { error } = await supabase
    .from('encuestas')
    .update({ turnos_totales: turnosActuales + 1 })
    .eq('id', encuestaId);
  if (error) throw new Error(`No se pudo actualizar el contador de turnos: ${error.message}`);
}

// ── Fin de la entrevista ────────────────────────────────────────────────────

export interface UsoIa {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** Columnas promovidas de `respuestas`: copia desnormalizada de lo que el panel filtra. */
function columnasPromovidas(r: RespuestasEncuesta) {
  return {
    sector: r.sector.valor,
    tamano_rango: r.tamanoRango.valor,
    madurez_digital: r.madurezDigital.valor,
    presupuesto_rango: r.presupuestoRango.valor,
    decision_quien: r.decisionQuien.valor,
  };
}

/**
 * Al detectar la ficha de cierre: persiste `respuestas` (contenido canónico + columnas
 * promovidas + coste de la entrevista) y marca la encuesta como `respondida`. El diagnóstico y el
 * contacto llegan después, en `persistirCierre`.
 */
export async function persistirRespuestas(
  supabase: SupabaseClient,
  params: { encuestaId: string; respuestas: RespuestasEncuesta; costeEntrevista: UsoIa },
): Promise<{ respuestaId: string }> {
  const { encuestaId, respuestas, costeEntrevista } = params;

  const { data, error } = await supabase
    .from('respuestas')
    .insert({
      encuesta_id: encuestaId,
      contenido: respuestas,
      ...columnasPromovidas(respuestas),
      coste_ia: { entrevista: costeEntrevista, diagnostico: null },
    })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudieron guardar las respuestas: ${error.message}`);

  const { error: errEstado } = await supabase
    .from('encuestas')
    .update({ estado: 'respondida' })
    .eq('id', encuestaId);
  if (errEstado) throw new Error(`No se pudo marcar la encuesta como respondida: ${errEstado.message}`);

  return { respuestaId: data.id as string };
}

/** Recupera las respuestas de una encuesta ya `respondida`, para calcular el diagnóstico. */
export async function leerRespuestas(
  supabase: SupabaseClient,
  encuestaId: string,
): Promise<{ respuestaId: string; contenido: RespuestasEncuesta } | null> {
  const { data, error } = await supabase
    .from('respuestas')
    .select('id, contenido')
    .eq('encuesta_id', encuestaId)
    .maybeSingle();
  if (error) throw new Error(`No se pudieron leer las respuestas: ${error.message}`);
  if (!data) return null;
  return { respuestaId: data.id as string, contenido: data.contenido as RespuestasEncuesta };
}

// ── Cierre ──────────────────────────────────────────────────────────────────

export interface DatosContacto {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
}

export interface DiagnosticoParaGuardar {
  markdown: string;
  secciones: { titulo: string; contenido: string }[];
  notaAlcance: string;
}

export interface ResultadoCierre {
  contactoId: string;
  resultadoId: string;
  diagnosticoId: string;
}

/**
 * M-08: persiste el cierre completo — contacto, resultado de la rúbrica y diagnóstico — y marca la
 * encuesta como `completada`. `respuestas` ya se guardó al terminar la entrevista.
 */
export async function persistirCierre(
  supabase: SupabaseClient,
  params: {
    encuestaId: string;
    respuestaId: string;
    contacto: DatosContacto;
    resultado: ResultadoRubrica;
    diagnostico: DiagnosticoParaGuardar;
    costeDiagnostico: UsoIa;
  },
): Promise<ResultadoCierre> {
  const { encuestaId, respuestaId, contacto, resultado, diagnostico, costeDiagnostico } = params;

  const contactoId = await enlazarContacto(supabase, encuestaId, contacto);

  const { data: filaResultado, error: errResultado } = await supabase
    .from('resultados_rubrica')
    .insert({
      respuesta_id: respuestaId,
      nivel_preparacion: resultado.nivelPreparacion,
      completo: resultado.completo,
      datos_faltantes: resultado.datosFaltantes,
      casos_uso: resultado.casosUso,
      contenido: resultado,
      version_rubrica: resultado.versionRubrica,
    })
    .select('id')
    .single();
  if (errResultado) throw new Error(`No se pudo guardar el resultado de la rúbrica: ${errResultado.message}`);
  const resultadoId = filaResultado.id as string;

  const { data: filaDiag, error: errDiag } = await supabase
    .from('diagnosticos')
    .insert({
      resultado_id: resultadoId,
      markdown: diagnostico.markdown,
      secciones: diagnostico.secciones,
      nota_alcance: diagnostico.notaAlcance,
    })
    .select('id')
    .single();
  if (errDiag) throw new Error(`No se pudo guardar el diagnóstico: ${errDiag.message}`);

  const { error: errCoste } = await supabase
    .from('respuestas')
    .update({ coste_ia: { entrevista: null, diagnostico: costeDiagnostico } })
    .eq('id', respuestaId);
  // El coste es telemetría: si falla, se registra pero no se aborta el cierre.
  if (errCoste) console.error('No se pudo actualizar respuestas.coste_ia:', errCoste.message);

  const { error: errCierre } = await supabase
    .from('encuestas')
    .update({ estado: 'completada', finalizada_en: new Date().toISOString() })
    .eq('id', encuestaId);
  if (errCierre) throw new Error(`No se pudo cerrar la encuesta: ${errCierre.message}`);

  return { contactoId, resultadoId, diagnosticoId: filaDiag.id as string };
}

/** Crea el contacto o lo enlaza si ya existe (por email normalizado), y lo une a la encuesta. */
async function enlazarContacto(
  supabase: SupabaseClient,
  encuestaId: string,
  contacto: DatosContacto,
): Promise<string> {
  const email = contacto.email.trim().toLowerCase();

  const { data: existente, error: errSelect } = await supabase
    .from('contactos')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (errSelect) throw new Error(`No se pudo comprobar si el contacto ya existía: ${errSelect.message}`);

  let contactoId: string;
  if (existente) {
    contactoId = existente.id as string;
    await supabase
      .from('contactos')
      .update({ nombre: contacto.nombre, telefono: contacto.telefono, empresa: contacto.empresa })
      .eq('id', contactoId);
  } else {
    const { data: nuevo, error: errInsert } = await supabase
      .from('contactos')
      .insert({
        nombre: contacto.nombre,
        email,
        telefono: contacto.telefono,
        empresa: contacto.empresa,
      })
      .select('id')
      .single();
    if (errInsert) throw new Error(`No se pudo crear el contacto: ${errInsert.message}`);
    contactoId = nuevo.id as string;
  }

  const { error: errUpdate } = await supabase
    .from('encuestas')
    .update({ contacto_id: contactoId })
    .eq('id', encuestaId);
  if (errUpdate) throw new Error(`No se pudo enlazar el contacto a la encuesta: ${errUpdate.message}`);

  return contactoId;
}

// ── Aviso al consultor ──────────────────────────────────────────────────────

export async function registrarNotificacionConsultor(
  supabase: SupabaseClient,
  params: { encuestaId: string; destinatario: string; exito: boolean },
): Promise<void> {
  const { error } = await supabase.from('notificaciones_consultor').insert({
    encuesta_id: params.encuestaId,
    destinatario: params.destinatario,
    enviado_en: params.exito ? new Date().toISOString() : null,
    estado: params.exito ? 'enviado' : 'fallido',
  });
  if (error) throw new Error(`No se pudo registrar la notificación al consultor: ${error.message}`);
}

// ── Límite de uso por IP ────────────────────────────────────────────────────

export type AccionLimitada = 'crear_encuesta' | 'enviar_mensaje';

/**
 * Protección contra abuso: cuenta cuántas veces ha hecho esta `accion` esa `ipHash` en las
 * últimas `ventanaHoras`. Por debajo del `umbral`, registra el intento y permite; por encima,
 * rechaza sin insertar.
 */
export async function comprobarLimiteUso(
  supabase: SupabaseClient,
  ipHash: string,
  accion: AccionLimitada,
  umbral: number,
  ventanaHoras: number,
): Promise<boolean> {
  const desde = new Date(Date.now() - ventanaHoras * 60 * 60 * 1000).toISOString();

  const { count, error: errConteo } = await supabase
    .from('limites_uso')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('accion', accion)
    .gte('creado_en', desde);
  if (errConteo) throw new Error(`No se pudo comprobar el límite de uso: ${errConteo.message}`);

  if ((count ?? 0) >= umbral) return false;

  const { error: errInsercion } = await supabase
    .from('limites_uso')
    .insert({ ip_hash: ipHash, accion });
  if (errInsercion) throw new Error(`No se pudo registrar el uso: ${errInsercion.message}`);

  return true;
}
