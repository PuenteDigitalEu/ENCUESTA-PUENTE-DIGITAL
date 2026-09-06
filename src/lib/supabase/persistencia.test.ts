import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Dato, Deuda, Ficha } from "@/lib/motor/ficha";
import { calcularInforme } from "@/lib/motor/informe";

import {
  comprobarLimiteUso,
  crearConversacion,
  incrementarTurno,
  persistirCierre,
  registrarNotificacionAsesor,
  validarToken,
} from "./persistencia";

type Respuesta = { data: unknown; error: { message: string } | null; count?: number };

/**
 * Doble mínimo del cliente Supabase (`from().select/insert/update().eq().gte().single/maybeSingle()`),
 * con una cola de respuestas por tabla — cada llamada a una tabla consume la siguiente respuesta
 * de su cola, en el orden en que persistencia.ts las hace. Registra también cada llamada, para
 * poder comprobar qué se mandó a cada tabla, no solo qué se devolvió.
 */
function crearSupabaseFake(colasPorTabla: Record<string, Respuesta[]>) {
  const llamadas: { tabla: string; metodo: string; payload?: unknown }[] = [];

  const from = vi.fn((tabla: string) => {
    const cola = colasPorTabla[tabla] ?? [];
    const siguiente = (): Respuesta => cola.shift() ?? { data: null, error: null };

    const builder = {
      select: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        llamadas.push({ tabla, metodo: "insert", payload });
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        llamadas.push({ tabla, metodo: "update", payload });
        return builder;
      }),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(siguiente())),
      maybeSingle: vi.fn(() => Promise.resolve(siguiente())),
      then: (resolve: (r: Respuesta) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(siguiente()).then(resolve, reject),
    };
    return builder;
  });

  return { from, llamadas } as unknown as { from: typeof from; llamadas: typeof llamadas };
}

function dato<T>(valor: T): Dato<T> {
  return { valor, etiqueta: "confirmado" };
}

function fichaMinima(overrides: Partial<Ficha> = {}): Ficha {
  const deuda: Deuda = {
    tipo: dato("hipoteca"),
    importe: dato(150000),
    cuota: dato(620),
    interes: dato(1.9),
  };
  return {
    nombre: dato("Silvia"),
    email: dato("Silvia@Example.com"),
    fechaEntrevista: "2026-08-27",
    ingresosNetosMensual: dato(2800),
    ingresosEstabilidad: dato("estable"),
    gastosFijosMensual: dato(1600),
    deudas: dato([deuda]),
    deudasInteresAltoDeclarado: dato("no"),
    patrimonioLiquido: dato(12000),
    patrimonioInvertido: dato(10000),
    patrimonioDistribucion: dato("todo en un fondo indexado"),
    aportacionMensualActual: dato(150),
    colchonMeses: dato(5),
    objetivoProposito: dato("bajar el ritmo a los 60"),
    objetivoImporte: dato(150000),
    objetivoPlazoAnios: dato(20),
    riesgoToleranciaDeclarada: dato("media"),
    riesgoComportamientoReal: dato("aguantó la caída del covid sin vender"),
    riesgoPerfilDerivado: dato("moderado"),
    edad: dato(40),
    personasACargo: dato(0),
    situacionLaboral: dato("diseñadora gráfica en plantilla"),
    ...overrides,
  } as Ficha;
}

describe("crearConversacion", () => {
  it("inserta con consentimiento_en y devuelve id + token", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [{ data: { id: "conv-1", token: "tok-1" }, error: null }],
    });

    const resultado = await crearConversacion(supabase as never);

    expect(resultado).toEqual({ id: "conv-1", token: "tok-1" });
    const insercion = supabase.llamadas.find((l) => l.tabla === "conversaciones" && l.metodo === "insert");
    expect(insercion?.payload).toHaveProperty("consentimiento_en");
  });

  it("lanza un error claro si falla el insert", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [{ data: null, error: { message: "boom" } }],
    });
    await expect(crearConversacion(supabase as never)).rejects.toThrow(/No se pudo crear la conversación/);
  });
});

describe("validarToken", () => {
  it("token inexistente → null", async () => {
    const supabase = crearSupabaseFake({ conversaciones: [{ data: null, error: null }] });
    expect(await validarToken(supabase as never, "x")).toBeNull();
  });

  it("conversación no en_curso → null (aunque el token exista)", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [
        {
          data: { id: "conv-1", estado: "completada", expira_en: futura(), turnos_totales: 3 },
          error: null,
        },
      ],
    });
    expect(await validarToken(supabase as never, "x")).toBeNull();
  });

  it("conversación expirada → null", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [
        { data: { id: "conv-1", estado: "en_curso", expira_en: pasada(), turnos_totales: 3 }, error: null },
      ],
    });
    expect(await validarToken(supabase as never, "x")).toBeNull();
  });

  it("token válido y vigente → devuelve id y turnosTotales", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [
        { data: { id: "conv-1", estado: "en_curso", expira_en: futura(), turnos_totales: 3 }, error: null },
      ],
    });
    expect(await validarToken(supabase as never, "x")).toEqual({ id: "conv-1", turnosTotales: 3 });
  });
});

describe("incrementarTurno", () => {
  it("actualiza turnos_totales a turnosActuales + 1", async () => {
    const supabase = crearSupabaseFake({ conversaciones: [{ data: null, error: null }] });
    await incrementarTurno(supabase as never, "conv-1", 3);
    const actualizacion = supabase.llamadas.find((l) => l.tabla === "conversaciones" && l.metodo === "update");
    expect(actualizacion?.payload).toEqual({ turnos_totales: 4 });
  });
});

describe("persistirCierre", () => {
  it("cliente nuevo: lo crea, lo enlaza, y persiste ficha/deudas/informe/plan en orden", async () => {
    const supabase = crearSupabaseFake({
      clientes: [
        { data: null, error: null }, // select: no existe
        { data: { id: "cli-1" }, error: null }, // insert
      ],
      conversaciones: [
        { data: null, error: null }, // update cliente_id
        { data: null, error: null }, // update estado completada
      ],
      fichas: [{ data: { id: "ficha-1" }, error: null }],
      deudas: [{ data: null, error: null }],
      informes: [{ data: { id: "informe-1" }, error: null }],
      planes: [{ data: { id: "plan-1" }, error: null }],
    });

    const ficha = fichaMinima();
    const informe = calcularInforme(ficha);
    const resultado = await persistirCierre(supabase as never, {
      conversacionId: "conv-1",
      ficha,
      informe,
      planMarkdown: "## 1. Tu meta\nTexto.",
    });

    expect(resultado).toEqual({
      clienteId: "cli-1",
      fichaId: "ficha-1",
      informeId: "informe-1",
      planId: "plan-1",
    });

    // El email se normaliza a minúsculas antes de crear el cliente.
    const insercionCliente = supabase.llamadas.find((l) => l.tabla === "clientes" && l.metodo === "insert");
    expect(insercionCliente?.payload).toEqual({ nombre: "Silvia", email: "silvia@example.com" });

    const insercionFicha = supabase.llamadas.find((l) => l.tabla === "fichas");
    expect(insercionFicha?.payload).toMatchObject({ conversacion_id: "conv-1", fecha_entrevista: "2026-08-27" });

    const insercionDeudas = supabase.llamadas.find((l) => l.tabla === "deudas");
    expect(insercionDeudas?.payload).toEqual([
      {
        ficha_id: "ficha-1",
        orden: 1,
        tipo: "hipoteca",
        tipo_estado: "confirmado",
        importe: 150000,
        importe_estado: "confirmado",
        cuota: 620,
        cuota_estado: "confirmado",
        interes: 1.9,
        interes_estado: "confirmado",
      },
    ]);

    const insercionInforme = supabase.llamadas.find((l) => l.tabla === "informes");
    expect(insercionInforme?.payload).toMatchObject({ ficha_id: "ficha-1", modo: informe.modo });

    const insercionPlan = supabase.llamadas.find((l) => l.tabla === "planes");
    expect(insercionPlan?.payload).toMatchObject({
      informe_id: "informe-1",
      markdown: "## 1. Tu meta\nTexto.",
      secciones: [{ titulo: "1. Tu meta", contenido: "Texto." }],
    });
    expect((insercionPlan?.payload as { descargo: string }).descargo).toContain("no asesoramiento financiero regulado");

    const cierre = supabase.llamadas.filter((l) => l.tabla === "conversaciones" && l.metodo === "update");
    expect(cierre[1]?.payload).toMatchObject({ estado: "completada" });
  });

  it("cliente ya existente (mismo email): lo enlaza sin crear uno nuevo", async () => {
    const supabase = crearSupabaseFake({
      clientes: [{ data: { id: "cli-existente" }, error: null }],
      conversaciones: [{ data: null, error: null }, { data: null, error: null }],
      fichas: [{ data: { id: "ficha-1" }, error: null }],
      deudas: [{ data: null, error: null }],
      informes: [{ data: { id: "informe-1" }, error: null }],
      planes: [{ data: { id: "plan-1" }, error: null }],
    });

    const resultado = await persistirCierre(supabase as never, {
      conversacionId: "conv-1",
      ficha: fichaMinima(),
      informe: calcularInforme(fichaMinima()),
      planMarkdown: "## 1. Tu meta\nTexto.",
    });

    expect(resultado.clienteId).toBe("cli-existente");
    expect(supabase.llamadas.some((l) => l.tabla === "clientes" && l.metodo === "insert")).toBe(false);
  });

  it("sin email: no crea ni enlaza cliente, pero sí persiste el resto", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [{ data: null, error: null }],
      fichas: [{ data: { id: "ficha-1" }, error: null }],
      deudas: [{ data: null, error: null }],
      informes: [{ data: { id: "informe-1" }, error: null }],
      planes: [{ data: { id: "plan-1" }, error: null }],
    });

    const ficha = fichaMinima({ email: { valor: null, etiqueta: "pendiente" } });
    const resultado = await persistirCierre(supabase as never, {
      conversacionId: "conv-1",
      ficha,
      informe: calcularInforme(ficha),
      planMarkdown: "## 1. Tu meta\nTexto.",
    });

    expect(resultado.clienteId).toBeNull();
    expect(supabase.llamadas.some((l) => l.tabla === "clientes")).toBe(false);
    // Solo una actualización de conversaciones (el cierre), no la de cliente_id.
    expect(supabase.llamadas.filter((l) => l.tabla === "conversaciones" && l.metodo === "update")).toHaveLength(1);
  });

  it("sin deudas (deudas_numero = 0): no llama a la tabla deudas", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [{ data: null, error: null }],
      fichas: [{ data: { id: "ficha-1" }, error: null }],
      informes: [{ data: { id: "informe-1" }, error: null }],
      planes: [{ data: { id: "plan-1" }, error: null }],
    });

    const ficha = fichaMinima({
      email: { valor: null, etiqueta: "pendiente" },
      deudas: { valor: [], etiqueta: "confirmado" },
    });
    await persistirCierre(supabase as never, {
      conversacionId: "conv-1",
      ficha,
      informe: calcularInforme(ficha),
      planMarkdown: "## 1. Tu meta\nTexto.",
    });

    expect(supabase.llamadas.some((l) => l.tabla === "deudas")).toBe(false);
  });

  it("un fallo a mitad (p. ej. guardar el informe) se propaga con un mensaje claro", async () => {
    const supabase = crearSupabaseFake({
      conversaciones: [{ data: null, error: null }],
      fichas: [{ data: { id: "ficha-1" }, error: null }],
      deudas: [{ data: null, error: null }],
      informes: [{ data: null, error: { message: "constraint violation" } }],
    });

    const ficha = fichaMinima({ email: { valor: null, etiqueta: "pendiente" } });
    await expect(
      persistirCierre(supabase as never, {
        conversacionId: "conv-1",
        ficha,
        informe: calcularInforme(ficha),
        planMarkdown: "texto",
      }),
    ).rejects.toThrow(/No se pudo guardar el informe/);
  });
});

describe("registrarNotificacionAsesor", () => {
  it("éxito: enviado_en con fecha, estado 'enviado'", async () => {
    const supabase = crearSupabaseFake({ notificaciones_asesor: [{ data: null, error: null }] });
    await registrarNotificacionAsesor(supabase as never, {
      conversacionId: "conv-1",
      destinatario: "asesor@example.com",
      exito: true,
    });
    const insercion = supabase.llamadas.find((l) => l.tabla === "notificaciones_asesor");
    expect(insercion?.payload).toMatchObject({
      conversacion_id: "conv-1",
      destinatario: "asesor@example.com",
      estado: "enviado",
    });
    expect((insercion?.payload as { enviado_en: string | null }).enviado_en).not.toBeNull();
  });

  it("fallo: enviado_en null, estado 'fallido'", async () => {
    const supabase = crearSupabaseFake({ notificaciones_asesor: [{ data: null, error: null }] });
    await registrarNotificacionAsesor(supabase as never, {
      conversacionId: "conv-1",
      destinatario: "asesor@example.com",
      exito: false,
    });
    const insercion = supabase.llamadas.find((l) => l.tabla === "notificaciones_asesor");
    expect(insercion?.payload).toEqual({
      conversacion_id: "conv-1",
      destinatario: "asesor@example.com",
      enviado_en: null,
      estado: "fallido",
    });
  });

  it("lanza con mensaje claro si falla el propio registro", async () => {
    const supabase = crearSupabaseFake({
      notificaciones_asesor: [{ data: null, error: { message: "boom" } }],
    });
    await expect(
      registrarNotificacionAsesor(supabase as never, {
        conversacionId: "conv-1",
        destinatario: "asesor@example.com",
        exito: true,
      }),
    ).rejects.toThrow(/No se pudo registrar la notificación/);
  });
});

describe("comprobarLimiteUso", () => {
  it("por debajo del umbral: permite y registra el uso", async () => {
    const supabase = crearSupabaseFake({
      limites_uso: [{ data: null, error: null, count: 3 }, { data: null, error: null }],
    });
    const permitido = await comprobarLimiteUso(supabase as never, "hash-1", "enviar_mensaje", 10, 24);
    expect(permitido).toBe(true);
    const insercion = supabase.llamadas.find((l) => l.tabla === "limites_uso" && l.metodo === "insert");
    expect(insercion?.payload).toEqual({ ip_hash: "hash-1", accion: "enviar_mensaje" });
  });

  it("en el umbral exacto: rechaza sin insertar (>=, no solo >)", async () => {
    const supabase = crearSupabaseFake({
      limites_uso: [{ data: null, error: null, count: 10 }],
    });
    const permitido = await comprobarLimiteUso(supabase as never, "hash-1", "enviar_mensaje", 10, 24);
    expect(permitido).toBe(false);
    expect(supabase.llamadas.some((l) => l.tabla === "limites_uso" && l.metodo === "insert")).toBe(false);
  });

  it("por encima del umbral: rechaza sin insertar", async () => {
    const supabase = crearSupabaseFake({
      limites_uso: [{ data: null, error: null, count: 25 }],
    });
    const permitido = await comprobarLimiteUso(supabase as never, "hash-1", "crear_conversacion", 10, 24);
    expect(permitido).toBe(false);
  });

  it("lanza con mensaje claro si falla el conteo", async () => {
    const supabase = crearSupabaseFake({
      limites_uso: [{ data: null, error: { message: "boom" } }],
    });
    await expect(comprobarLimiteUso(supabase as never, "hash-1", "enviar_mensaje", 10, 24)).rejects.toThrow(
      /No se pudo comprobar el límite de uso/,
    );
  });

  it("lanza con mensaje claro si falla el registro del uso permitido", async () => {
    const supabase = crearSupabaseFake({
      limites_uso: [
        { data: null, error: null, count: 0 },
        { data: null, error: { message: "boom" } },
      ],
    });
    await expect(comprobarLimiteUso(supabase as never, "hash-1", "enviar_mensaje", 10, 24)).rejects.toThrow(
      /No se pudo registrar el uso/,
    );
  });
});

function futura(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}
function pasada(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
