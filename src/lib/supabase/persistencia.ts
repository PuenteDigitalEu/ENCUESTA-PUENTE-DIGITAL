import type { SupabaseClient } from "@supabase/supabase-js";

import { DESCARGO_FIJO, seccionarPlan } from "@/lib/claude/plan";
import type { Deuda, Ficha } from "@/lib/motor/ficha";
import type { Informe } from "@/lib/motor/informe";

/**
 * Todas las escrituras de `M-04`/`M-06`, agrupadas aquí para que `app/api/` no tenga SQL disperso.
 * Nunca se llama directamente al cliente Supabase fuera de este archivo (salvo la validación de
 * token, igual de sencilla) — así el mapeo `Ficha`/`Informe` (camelCase) → columnas (snake_case)
 * vive en un único sitio, no repetido en cada ruta.
 *
 * Sin transacción SQL (decisión de la ficha `docs/features/consentimiento-y-persistencia.md`):
 * las escrituras del cierre van como inserts secuenciales. Si una falla a mitad, se acepta el
 * riesgo de una fila huérfana (p. ej. ficha sin informe) para el MVP — se detecta por los logs del
 * servidor (`console.error` en la ruta que llama a `persistirCierre`), no hay compensación
 * automática todavía.
 */

/** M-06: crea la conversación al aceptar el consentimiento. Nada más existe antes de esto. */
export async function crearConversacion(
  supabase: SupabaseClient,
): Promise<{ id: string; token: string }> {
  const { data, error } = await supabase
    .from("conversaciones")
    .insert({ consentimiento_en: new Date().toISOString() })
    .select("id, token")
    .single();

  if (error) throw new Error(`No se pudo crear la conversación: ${error.message}`);
  return { id: data.id as string, token: data.token as string };
}

export interface ConversacionValida {
  id: string;
  turnosTotales: number;
}

/**
 * El token es lo único que autoriza a `/api/chat` a escribir en una conversación concreta (ver
 * `docs/architecture.md` → "Estrategia de autenticación"). `null` cubre los tres motivos por los
 * que un turno se rechaza (no existe, no está en curso, ha expirado) con el mismo mensaje genérico
 * hacia el visitante — el detalle solo importa para depurar, nunca se expone (`FLOW-01`).
 */
export async function validarToken(
  supabase: SupabaseClient,
  token: string,
): Promise<ConversacionValida | null> {
  const { data, error } = await supabase
    .from("conversaciones")
    .select("id, estado, expira_en, turnos_totales")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`No se pudo validar el token: ${error.message}`);
  if (!data) return null;
  if (data.estado !== "en_curso") return null;
  if (new Date(data.expira_en as string).getTime() < Date.now()) return null;

  return { id: data.id as string, turnosTotales: data.turnos_totales as number };
}

/**
 * Incremento no atómico a propósito (lee-modifica-escribe desde `route.ts`, que ya tiene
 * `turnosActuales` de `validarToken`): un token lo usa un único visitante de forma secuencial, no
 * hay escritura concurrente real que proteger en esta versión.
 */
export async function incrementarTurno(
  supabase: SupabaseClient,
  conversacionId: string,
  turnosActuales: number,
): Promise<void> {
  const { error } = await supabase
    .from("conversaciones")
    .update({ turnos_totales: turnosActuales + 1 })
    .eq("id", conversacionId);

  if (error) throw new Error(`No se pudo actualizar el contador de turnos: ${error.message}`);
}

/**
 * Exportadas (no solo de uso interno) para que `scripts/verificar-persistencia.mjs` pueda
 * ejercitar las filas REALES que este módulo produciría contra un Postgres de verdad (PGlite) —
 * sin reimplementar el mapeo por segunda vez en el script, que se habría desincronizado tarde o
 * temprano del código real.
 */
export function fichaAFila(conversacionId: string, ficha: Ficha) {
  return {
    conversacion_id: conversacionId,
    nombre: ficha.nombre.valor,
    nombre_estado: ficha.nombre.etiqueta,
    // Único campo del contrato sin etiqueta — si el parseo no pudo leerla (C16), se usa la fecha
    // de hoy como respaldo operativo: es metadato de cuándo se persiste, no un dato del cliente
    // que se esté adivinando.
    fecha_entrevista: ficha.fechaEntrevista ?? new Date().toISOString().slice(0, 10),
    ingresos_netos_mensual: ficha.ingresosNetosMensual.valor,
    ingresos_netos_mensual_estado: ficha.ingresosNetosMensual.etiqueta,
    ingresos_estabilidad: ficha.ingresosEstabilidad.valor,
    ingresos_estabilidad_estado: ficha.ingresosEstabilidad.etiqueta,
    gastos_fijos_mensual: ficha.gastosFijosMensual.valor,
    gastos_fijos_mensual_estado: ficha.gastosFijosMensual.etiqueta,
    deudas_interes_alto_declarado: ficha.deudasInteresAltoDeclarado.valor,
    deudas_interes_alto_declarado_estado: ficha.deudasInteresAltoDeclarado.etiqueta,
    patrimonio_liquido: ficha.patrimonioLiquido.valor,
    patrimonio_liquido_estado: ficha.patrimonioLiquido.etiqueta,
    patrimonio_invertido: ficha.patrimonioInvertido.valor,
    patrimonio_invertido_estado: ficha.patrimonioInvertido.etiqueta,
    patrimonio_distribucion: ficha.patrimonioDistribucion.valor,
    patrimonio_distribucion_estado: ficha.patrimonioDistribucion.etiqueta,
    aportacion_mensual_actual: ficha.aportacionMensualActual.valor,
    aportacion_mensual_actual_estado: ficha.aportacionMensualActual.etiqueta,
    colchon_meses: ficha.colchonMeses.valor,
    colchon_meses_estado: ficha.colchonMeses.etiqueta,
    objetivo_proposito: ficha.objetivoProposito.valor,
    objetivo_proposito_estado: ficha.objetivoProposito.etiqueta,
    objetivo_importe: ficha.objetivoImporte.valor,
    objetivo_importe_estado: ficha.objetivoImporte.etiqueta,
    objetivo_plazo_anios: ficha.objetivoPlazoAnios.valor,
    objetivo_plazo_anios_estado: ficha.objetivoPlazoAnios.etiqueta,
    riesgo_tolerancia_declarada: ficha.riesgoToleranciaDeclarada.valor,
    riesgo_tolerancia_declarada_estado: ficha.riesgoToleranciaDeclarada.etiqueta,
    riesgo_comportamiento_real: ficha.riesgoComportamientoReal.valor,
    riesgo_comportamiento_real_estado: ficha.riesgoComportamientoReal.etiqueta,
    riesgo_perfil_derivado: ficha.riesgoPerfilDerivado.valor,
    riesgo_perfil_derivado_estado: ficha.riesgoPerfilDerivado.etiqueta,
    edad: ficha.edad.valor,
    edad_estado: ficha.edad.etiqueta,
    personas_a_cargo: ficha.personasACargo.valor,
    personas_a_cargo_estado: ficha.personasACargo.etiqueta,
    situacion_laboral: ficha.situacionLaboral.valor,
    situacion_laboral_estado: ficha.situacionLaboral.etiqueta,
  };
}

export function deudasAFilas(fichaId: string, deudas: Deuda[]) {
  return deudas.map((deuda, indice) => ({
    ficha_id: fichaId,
    orden: indice + 1,
    tipo: deuda.tipo.valor,
    tipo_estado: deuda.tipo.etiqueta,
    importe: deuda.importe.valor,
    importe_estado: deuda.importe.etiqueta,
    cuota: deuda.cuota.valor,
    cuota_estado: deuda.cuota.etiqueta,
    interes: deuda.interes.valor,
    interes_estado: deuda.interes.etiqueta,
  }));
}

export function informeAFila(fichaId: string, informe: Informe) {
  return {
    ficha_id: fichaId,
    modo: informe.modo,
    tipo_meta: informe.tipoMeta,
    flujo_libre: informe.flujoLibre,
    porcentaje_camino_recorrido: informe.porcentajeCaminoRecorrido,
    proyeccion_valor_futuro: informe.proyeccionValorFuturo,
    gap_euros: informe.gapEuros,
    gap_anios: informe.gapAnios,
    aportacion_propuesta: informe.aportacionPropuesta,
    cartera_objetivo: informe.carteraObjetivo,
    rentabilidad_esperada_neta: informe.rentabilidadEsperadaNeta,
    mc_percentil_pesimista: informe.mcPercentilPesimista,
    mc_percentil_central: informe.mcPercentilCentral,
    mc_percentil_optimista: informe.mcPercentilOptimista,
    mc_probabilidad_cumplimiento: informe.mcProbabilidadCumplimiento,
    mc_banda: informe.mcBanda,
    // Estructura completa del informe (docs/data-model.md → informes.contenido): se guarda el
    // objeto entero, ya que Informe ya reúne todo lo que el §7 pide (diagnóstico + propuesta +
    // control) — no se recorta a un subconjunto que habría que mantener sincronizado a mano.
    contenido: informe,
    pendientes_reunion: informe.pendientesReunion,
    version_motor: informe.versionMotor,
    version_reglas: informe.versionReglas,
  };
}

export function planAFila(informeId: string, markdown: string) {
  return {
    informe_id: informeId,
    secciones: seccionarPlan(markdown),
    markdown,
    descargo: DESCARGO_FIJO,
  };
}

export interface ResultadoCierre {
  clienteId: string | null;
  fichaId: string;
  informeId: string;
  planId: string;
}

/**
 * M-04: persiste el cierre completo de una conversación — cliente (si hay email), ficha, deudas,
 * informe y plan — y marca la conversación como `completada`. Se llama una sola vez, en el mismo
 * turno donde `app/api/chat/route.ts` detecta la ficha de cierre (`contieneFicha`).
 */
export async function persistirCierre(
  supabase: SupabaseClient,
  params: { conversacionId: string; ficha: Ficha; informe: Informe; planMarkdown: string },
): Promise<ResultadoCierre> {
  const { conversacionId, ficha, informe, planMarkdown } = params;

  const clienteId = await enlazarCliente(supabase, conversacionId, ficha);

  const { data: filaFicha, error: errorFicha } = await supabase
    .from("fichas")
    .insert(fichaAFila(conversacionId, ficha))
    .select("id")
    .single();
  if (errorFicha) throw new Error(`No se pudo guardar la ficha: ${errorFicha.message}`);
  const fichaId = filaFicha.id as string;

  const deudas = ficha.deudas.valor ?? [];
  if (deudas.length > 0) {
    const { error: errorDeudas } = await supabase.from("deudas").insert(deudasAFilas(fichaId, deudas));
    if (errorDeudas) throw new Error(`No se pudieron guardar las deudas: ${errorDeudas.message}`);
  }

  const { data: filaInforme, error: errorInforme } = await supabase
    .from("informes")
    .insert(informeAFila(fichaId, informe))
    .select("id")
    .single();
  if (errorInforme) throw new Error(`No se pudo guardar el informe: ${errorInforme.message}`);
  const informeId = filaInforme.id as string;

  const { data: filaPlan, error: errorPlan } = await supabase
    .from("planes")
    .insert(planAFila(informeId, planMarkdown))
    .select("id")
    .single();
  if (errorPlan) throw new Error(`No se pudo guardar el plan: ${errorPlan.message}`);
  const planId = filaPlan.id as string;

  const { error: errorCierre } = await supabase
    .from("conversaciones")
    .update({ estado: "completada", finalizada_en: new Date().toISOString() })
    .eq("id", conversacionId);
  if (errorCierre) throw new Error(`No se pudo cerrar la conversación: ${errorCierre.message}`);

  return { clienteId, fichaId, informeId, planId };
}

/**
 * Crea el cliente o lo enlaza si ya existe (por email normalizado). Sin email (pendiente o no
 * dado), no se crea ningún cliente — `conversaciones.cliente_id` se queda `null`, la ficha se
 * persiste igual (referencia a la conversación, no al cliente).
 */
async function enlazarCliente(
  supabase: SupabaseClient,
  conversacionId: string,
  ficha: Ficha,
): Promise<string | null> {
  if (!ficha.email.valor) return null;
  const email = ficha.email.valor.trim().toLowerCase();

  const { data: existente, error: errorSelect } = await supabase
    .from("clientes")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (errorSelect) throw new Error(`No se pudo comprobar si el cliente ya existía: ${errorSelect.message}`);

  let clienteId: string;
  if (existente) {
    clienteId = existente.id as string;
  } else {
    const { data: nuevo, error: errorInsert } = await supabase
      .from("clientes")
      .insert({ nombre: ficha.nombre.valor, email })
      .select("id")
      .single();
    if (errorInsert) throw new Error(`No se pudo crear el cliente: ${errorInsert.message}`);
    clienteId = nuevo.id as string;
  }

  const { error: errorUpdate } = await supabase
    .from("conversaciones")
    .update({ cliente_id: clienteId })
    .eq("id", conversacionId);
  if (errorUpdate) throw new Error(`No se pudo enlazar el cliente a la conversación: ${errorUpdate.message}`);

  return clienteId;
}

/**
 * M-05/FLOW-02: deja constancia del intento de aviso al asesor, se haya enviado o no. Un fallo de
 * envío nunca debe perder la ficha ni el informe (ya persistidos por `persistirCierre`
 * independientemente) — por eso esto solo registra, no decide si reintentar ni bloquea nada.
 */
export async function registrarNotificacionAsesor(
  supabase: SupabaseClient,
  params: { conversacionId: string; destinatario: string; exito: boolean },
): Promise<void> {
  const { error } = await supabase.from("notificaciones_asesor").insert({
    conversacion_id: params.conversacionId,
    destinatario: params.destinatario,
    enviado_en: params.exito ? new Date().toISOString() : null,
    estado: params.exito ? "enviado" : "fallido",
  });
  if (error) throw new Error(`No se pudo registrar la notificación al asesor: ${error.message}`);
}

export type AccionLimitada = "crear_conversacion" | "enviar_mensaje";

/**
 * Protección contra abuso (`docs/features/limite-de-uso.md`): cuenta cuántas veces ha hecho esta
 * `accion` esa `ipHash` dentro de las últimas `ventanaHoras`. Por debajo del `umbral`, registra
 * este intento (cuenta para la próxima comprobación) y permite seguir; por encima, rechaza SIN
 * insertar — un intento rechazado no infla el contador con sus propios rechazos.
 */
export async function comprobarLimiteUso(
  supabase: SupabaseClient,
  ipHash: string,
  accion: AccionLimitada,
  umbral: number,
  ventanaHoras: number,
): Promise<boolean> {
  const desde = new Date(Date.now() - ventanaHoras * 60 * 60 * 1000).toISOString();

  const { count, error: errorConteo } = await supabase
    .from("limites_uso")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("accion", accion)
    .gte("creado_en", desde);
  if (errorConteo) throw new Error(`No se pudo comprobar el límite de uso: ${errorConteo.message}`);

  if ((count ?? 0) >= umbral) return false;

  const { error: errorInsercion } = await supabase.from("limites_uso").insert({ ip_hash: ipHash, accion });
  if (errorInsercion) throw new Error(`No se pudo registrar el uso: ${errorInsercion.message}`);

  return true;
}
