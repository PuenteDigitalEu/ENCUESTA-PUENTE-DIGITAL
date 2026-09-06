import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Ficha } from "@/lib/motor/ficha";
import { calcularInforme } from "@/lib/motor/informe";

const mockCreate = vi.fn();

vi.mock("./client", () => ({
  clienteClaude: () => ({ messages: { create: mockCreate } }),
  MODELO_ENTREVISTA: "claude-sonnet-5",
}));

const { generarPlan, seccionarPlan, DESCARGO_FIJO } = await import("./plan");

function dato<T>(valor: T) {
  return { valor, etiqueta: "confirmado" as const };
}

function fichaMinima(): Ficha {
  return {
    nombre: dato("Silvia"),
    email: dato("silvia@example.com"),
    fechaEntrevista: "2026-08-25",
    ingresosNetosMensual: dato(2800),
    ingresosEstabilidad: dato("estable"),
    gastosFijosMensual: dato(1600),
    deudas: dato([]),
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
  };
}

describe("generarPlan", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("desactiva el razonamiento extendido (thinking) — consume el mismo presupuesto que la respuesta", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "plan" }] });
    await generarPlan(fichaMinima(), calcularInforme(fichaMinima()));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ thinking: { type: "disabled" } }),
    );
  });

  it("usa el system prompt de la Fase 4 (§8), no el de la entrevista", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "plan" }] });
    await generarPlan(fichaMinima(), calcularInforme(fichaMinima()));
    const llamada = mockCreate.mock.calls[0][0];
    expect(llamada.system).toContain("Entrega del plan al visitante");
  });

  it("quita la valla de código si el modelo envuelve la respuesta en ```markdown pese a la instrucción", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "```markdown\n# Tu plan\n\nHola.\n```" }],
    });
    const plan = await generarPlan(fichaMinima(), calcularInforme(fichaMinima()));
    expect(plan).toBe("# Tu plan\n\nHola.");
  });

  it("no toca el texto si no viene envuelto en una valla de código", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "# Tu plan\n\nHola." }] });
    const plan = await generarPlan(fichaMinima(), calcularInforme(fichaMinima()));
    expect(plan).toBe("# Tu plan\n\nHola.");
  });

  it("nunca pasa datos numéricos ya calculados como si Claude tuviera que rehacerlos: el prompt cita el modo", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "plan" }] });
    const informe = calcularInforme(fichaMinima());
    await generarPlan(fichaMinima(), informe);
    const llamada = mockCreate.mock.calls[0][0];
    const contenido = llamada.messages[0].content as string;
    expect(contenido).toContain(`"${informe.modo}"`);
    expect(contenido).toContain(String(informe.aportacionPropuesta));
  });
});

describe("seccionarPlan", () => {
  it("parte el markdown en secciones por cada encabezado ## ", () => {
    const markdown = [
      "## 1. Tu meta",
      "Bajar el ritmo a los 60.",
      "",
      "## 2. Tu foto de hoy",
      "Cada mes te sobran 580 €.",
      "Tu colchón está completo.",
    ].join("\n");

    const secciones = seccionarPlan(markdown);

    expect(secciones).toHaveLength(2);
    expect(secciones[0]).toEqual({ titulo: "1. Tu meta", contenido: "Bajar el ritmo a los 60." });
    expect(secciones[1]).toEqual({
      titulo: "2. Tu foto de hoy",
      contenido: "Cada mes te sobran 580 €.\nTu colchón está completo.",
    });
  });

  it("un título de nivel 1 (#) o de contenido dentro de la sección no la corta", () => {
    const markdown = "## 1. Tu meta\n# Esto no es un encabezado de sección\nTexto normal.";
    const secciones = seccionarPlan(markdown);
    expect(secciones).toHaveLength(1);
    expect(secciones[0].contenido).toBe("# Esto no es un encabezado de sección\nTexto normal.");
  });

  it("markdown sin ningún encabezado ## da una lista vacía, no lanza excepción", () => {
    expect(seccionarPlan("Solo un párrafo, sin secciones.")).toEqual([]);
  });
});

describe("DESCARGO_FIJO", () => {
  it("es el texto exacto de §8 punto 8, palabra por palabra", () => {
    expect(DESCARGO_FIJO).toContain("no asesoramiento financiero regulado");
    expect(DESCARGO_FIJO).toContain("Un asesor humano revisará tu caso");
  });
});
