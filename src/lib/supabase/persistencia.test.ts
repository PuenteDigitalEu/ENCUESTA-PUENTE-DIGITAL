import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  comprobarLimiteUso,
  crearEncuesta,
  incrementarTurno,
  persistirCierre,
  persistirRespuestas,
  registrarNotificacionConsultor,
  validarToken,
} from "./persistencia";
import type { RespuestasEncuesta, ResultadoRubrica } from "@/lib/rubrica";

/**
 * Mock encadenable de Supabase: cada `.from(tabla)` devuelve un builder que registra la operación
 * y las columnas, y resuelve al valor que el test haya configurado para esa tabla+operación.
 */
function fakeSupabase(config: Record<string, unknown>) {
  const registro: { tabla: string; op: string; payload?: unknown }[] = [];

  function builder(tabla: string) {
    const estado: { op: string; payload?: unknown } = { op: "select" };
    const b: Record<string, unknown> = {};
    const passthrough = () => b;
    b.select = passthrough;
    b.eq = passthrough;
    b.gte = passthrough;
    b.insert = (payload: unknown) => {
      estado.op = "insert";
      estado.payload = payload;
      registro.push({ tabla, op: "insert", payload });
      return b;
    };
    b.update = (payload: unknown) => {
      estado.op = "update";
      estado.payload = payload;
      registro.push({ tabla, op: "update", payload });
      return b;
    };
    const resolver = () => {
      const key = `${tabla}.${estado.op}`;
      return Promise.resolve(config[key] ?? config[tabla] ?? { data: null, error: null });
    };
    b.single = resolver;
    b.maybeSingle = resolver;
    // Para `comprobarLimiteUso`, que hace await del builder tras los .eq()/.gte().
    (b as { then: unknown }).then = (onF: (v: unknown) => unknown) => resolver().then(onF);
    return b;
  }

  const client = { from: (tabla: string) => builder(tabla) } as unknown as SupabaseClient;
  return { client, registro };
}

describe("persistencia", () => {
  it("crearEncuesta inserta consentimiento_en y consentimiento_version", async () => {
    const { client, registro } = fakeSupabase({
      "encuestas.insert": { data: { id: "e1", token: "tok" }, error: null },
    });
    const r = await crearEncuesta(client, "2026-09-07");
    expect(r).toEqual({ id: "e1", token: "tok" });
    const ins = registro.find((x) => x.tabla === "encuestas");
    expect(ins?.payload).toMatchObject({ consentimiento_version: "2026-09-07" });
    expect((ins?.payload as { consentimiento_en: string }).consentimiento_en).toBeTruthy();
  });

  it("validarToken solo acepta los estados permitidos y no expirados", async () => {
    const futuro = new Date(Date.now() + 3_600_000).toISOString();
    const base = { id: "e1", turnos_totales: 2, expira_en: futuro };

    const okCurso = fakeSupabase({ "encuestas.select": { data: { ...base, estado: "en_curso" }, error: null } });
    expect(await validarToken(okCurso.client, "t", ["en_curso"])).toMatchObject({ id: "e1", turnosTotales: 2 });

    const malEstado = fakeSupabase({ "encuestas.select": { data: { ...base, estado: "respondida" }, error: null } });
    expect(await validarToken(malEstado.client, "t", ["en_curso"])).toBeNull();

    const expirada = fakeSupabase({
      "encuestas.select": { data: { ...base, estado: "en_curso", expira_en: "2000-01-01T00:00:00Z" }, error: null },
    });
    expect(await validarToken(expirada.client, "t", ["en_curso"])).toBeNull();
  });

  it("incrementarTurno suma 1 al contador actual", async () => {
    const { client, registro } = fakeSupabase({ "encuestas.update": { error: null } });
    await incrementarTurno(client, "e1", 4);
    expect(registro[0].payload).toEqual({ turnos_totales: 5 });
  });

  it("persistirRespuestas guarda contenido, columnas promovidas y coste, y pasa a respondida", async () => {
    const { client, registro } = fakeSupabase({
      "respuestas.insert": { data: { id: "r1" }, error: null },
      "encuestas.update": { error: null },
    });
    const respuestas = fichaMinima();
    const r = await persistirRespuestas(client, {
      encuestaId: "e1",
      respuestas,
      costeEntrevista: { input_tokens: 10, output_tokens: 2 },
    });
    expect(r).toEqual({ respuestaId: "r1" });

    const ins = registro.find((x) => x.tabla === "respuestas");
    expect(ins?.payload).toMatchObject({
      encuesta_id: "e1",
      sector: "taller",
      tamano_rango: "1-9",
      madurez_digital: "baja",
    });
    expect((ins?.payload as { coste_ia: unknown }).coste_ia).toMatchObject({ entrevista: { input_tokens: 10 } });

    const upd = registro.find((x) => x.tabla === "encuestas");
    expect(upd?.payload).toEqual({ estado: "respondida" });
  });

  it("persistirCierre encadena contacto → resultado → diagnóstico → completada", async () => {
    const { client, registro } = fakeSupabase({
      "contactos.select": { data: null, error: null },
      "contactos.insert": { data: { id: "c1" }, error: null },
      "resultados_rubrica.insert": { data: { id: "res1" }, error: null },
      "diagnosticos.insert": { data: { id: "d1" }, error: null },
      "encuestas.update": { error: null },
      "respuestas.update": { error: null },
    });

    const r = await persistirCierre(client, {
      encuestaId: "e1",
      respuestaId: "r1",
      contacto: { nombre: "Ana", email: "ANA@EXAMPLE.COM", telefono: "600", empresa: "Talleres" },
      resultado: resultadoMinimo(),
      diagnostico: { markdown: "## x", secciones: [], notaAlcance: "nota" },
      costeDiagnostico: { input_tokens: 5, output_tokens: 1 },
    });
    expect(r).toEqual({ contactoId: "c1", resultadoId: "res1", diagnosticoId: "d1" });

    // email normalizado a minúsculas
    const contactoIns = registro.find((x) => x.tabla === "contactos" && x.op === "insert");
    expect((contactoIns?.payload as { email: string }).email).toBe("ana@example.com");

    const updatesEncuestas = registro.filter((x) => x.tabla === "encuestas" && x.op === "update");
    expect(updatesEncuestas.at(-1)?.payload).toMatchObject({ estado: "completada" });
  });

  it("registrarNotificacionConsultor marca enviado/fallido según exito", async () => {
    const okCase = fakeSupabase({ "notificaciones_consultor.insert": { error: null } });
    await registrarNotificacionConsultor(okCase.client, { encuestaId: "e1", destinatario: "x@y.z", exito: true });
    expect(okCase.registro[0].payload).toMatchObject({ estado: "enviado" });

    const failCase = fakeSupabase({ "notificaciones_consultor.insert": { error: null } });
    await registrarNotificacionConsultor(failCase.client, { encuestaId: "e1", destinatario: "x@y.z", exito: false });
    expect(failCase.registro[0].payload).toMatchObject({ estado: "fallido", enviado_en: null });
  });

  it("comprobarLimiteUso rechaza al llegar al umbral y registra por debajo", async () => {
    const porEncima = fakeSupabase({ "limites_uso.select": { count: 10, error: null } });
    expect(await comprobarLimiteUso(porEncima.client, "h", "crear_encuesta", 10, 24)).toBe(false);
    expect(porEncima.registro.some((x) => x.op === "insert")).toBe(false);

    const porDebajo = fakeSupabase({
      "limites_uso.select": { count: 3, error: null },
      "limites_uso.insert": { error: null },
    });
    expect(await comprobarLimiteUso(porDebajo.client, "h", "enviar_mensaje", 10, 24)).toBe(true);
    expect(porDebajo.registro.some((x) => x.op === "insert")).toBe(true);
  });
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const d = <T>(valor: T | null, etiqueta: "confirmado" | "estimado" | "pendiente" = "confirmado") => ({
  valor,
  etiqueta,
});

function fichaMinima(): RespuestasEncuesta {
  return {
    sector: d("taller"),
    tamanoRango: d("1-9"),
    estacionalidad: d("no"),
    estacionalidadDetalle: d<string>(null, "pendiente"),
    procesos: [],
    procesoMasCostoso: d("presupuestos"),
    procesosConErrores: d<string>(null, "pendiente"),
    tareas: [],
    trabajoConDatos: d("un excel"),
    cuelloBotellaPersonas: d("no"),
    cuelloBotellaDetalle: d<string>(null, "pendiente"),
    herramientas: [],
    integracionActual: d("ninguna"),
    procesosEnPapel: d("partes"),
    usoNube: d("no"),
    madurezDigital: d("baja"),
    intentosPrevios: d<string>(null, "pendiente"),
    referenteInterno: d("no"),
    datosSensibles: d("no"),
    datosSensiblesTipo: d<string>(null, "pendiente"),
    requisitosCumplimiento: d<string>(null, "pendiente"),
    restriccionesDatos: d<string>(null, "pendiente"),
    presupuestoRango: d("1k-5k"),
    apetito: d("medio"),
    modeloPreferido: d("sin_definir"),
    decisionQuien: d("yo"),
    responsableImplantacion: d("el jefe"),
  };
}

function resultadoMinimo(): ResultadoRubrica {
  return {
    versionRubrica: "2026-09-07",
    nivelPreparacion: "inicial",
    preparacionScore: 3,
    senales: { digitalizacion: 1, madurezEquipo: 1, claridadProcesos: 1 },
    completo: true,
    datosFaltantes: [],
    cautelaDatos: false,
    casosUso: [],
  };
}

// Silencia el console.error de telemetría en persistirCierre cuando no se configura respuestas.update.
vi.spyOn(console, "error").mockImplementation(() => {});
