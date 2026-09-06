import { describe, expect, it } from "vitest";

import { conRespuesta, mensajesParaApi, type Mensaje } from "./historial";

describe("mensajesParaApi", () => {
  it("antepone el Hola sintético al historial visible", () => {
    const historial: Mensaje[] = [{ role: "assistant", content: "¿Cómo te llamas?" }];
    expect(mensajesParaApi(historial)).toEqual([
      { role: "user", content: "Hola" },
      { role: "assistant", content: "¿Cómo te llamas?" },
    ]);
  });

  it("con historial vacío (primer turno), solo manda el Hola", () => {
    expect(mensajesParaApi([])).toEqual([{ role: "user", content: "Hola" }]);
  });
});

describe("conRespuesta", () => {
  it("añade la respuesta sin tocar lo que ya había", () => {
    const historial: Mensaje[] = [{ role: "assistant", content: "Q1" }];
    const resultado = conRespuesta(historial, { role: "assistant", content: "Q2" });
    expect(resultado).toEqual([
      { role: "assistant", content: "Q1" },
      { role: "assistant", content: "Q2" },
    ]);
    // El array original no se muta.
    expect(historial).toEqual([{ role: "assistant", content: "Q1" }]);
  });
});

describe("regresión del bug de 2026-08-28: el historial nunca se pierde a lo largo de varios turnos", () => {
  it("tras 4 turnos completos, mensajesParaApi sigue incluyendo TODO lo dicho desde el principio", () => {
    let historialVisible: Mensaje[] = [];

    // Turno 1: apertura (sin mensaje del visitante todavía).
    historialVisible = conRespuesta(historialVisible, {
      role: "assistant",
      content: "¿Cómo te llamas y tu email?",
    });

    // Turno 2: visitante responde al bloque 0.
    historialVisible = [...historialVisible, { role: "user", content: "Silvia, silvia@example.com" }];
    historialVisible = conRespuesta(historialVisible, {
      role: "assistant",
      content: "Encantado, Silvia. ¿Cuánto ingresas al mes?",
    });

    // Turno 3: visitante responde a ingresos — este es el turno que reproducía el bug real.
    historialVisible = [...historialVisible, { role: "user", content: "2800 al mes" }];
    const mensajesEnviadosTurno3 = mensajesParaApi(historialVisible);
    // El bug real: en este punto, el historial ya había perdido el nombre/email del turno 2.
    expect(mensajesEnviadosTurno3).toContainEqual({ role: "user", content: "Silvia, silvia@example.com" });
    expect(mensajesEnviadosTurno3.map((m) => m.content)).toContain("¿Cómo te llamas y tu email?");

    historialVisible = conRespuesta(historialVisible, {
      role: "assistant",
      content: "¿Cuáles son tus gastos fijos al mes?",
    });

    // Turno 4: sigue sin perder nada de los tres turnos anteriores.
    historialVisible = [...historialVisible, { role: "user", content: "1600 al mes" }];
    const mensajesEnviadosTurno4 = mensajesParaApi(historialVisible);
    expect(mensajesEnviadosTurno4).toHaveLength(7); // Hola + 6 mensajes acumulados
    expect(mensajesEnviadosTurno4[0]).toEqual({ role: "user", content: "Hola" });
    expect(mensajesEnviadosTurno4.map((m) => m.content)).toEqual([
      "Hola",
      "¿Cómo te llamas y tu email?",
      "Silvia, silvia@example.com",
      "Encantado, Silvia. ¿Cuánto ingresas al mes?",
      "2800 al mes",
      "¿Cuáles son tus gastos fijos al mes?",
      "1600 al mes",
    ]);
  });
});
