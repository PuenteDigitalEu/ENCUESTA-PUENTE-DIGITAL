import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockValidarToken = vi.fn();
const mockIncrementarTurno = vi.fn();
const mockPersistirCierre = vi.fn();
const mockRegistrarNotificacionAsesor = vi.fn();
const mockEnviarAvisoAsesor = vi.fn();
const mockComprobarLimiteUso = vi.fn();

// Mockeado a propósito: esto verifica la LÓGICA de la ruta (validación, tope de turnos, token de
// sesión, manejo de errores) sin necesitar una ANTHROPIC_API_KEY ni un Supabase reales. Lo único
// que este archivo NO prueba es si las llamadas reales funcionan — eso se verifica en local con
// credenciales de verdad (ver docs/roadmap.md).
vi.mock("@/lib/claude/client", () => ({
  clienteClaude: () => ({ messages: { create: mockCreate } }),
  MODELO_ENTREVISTA: "claude-sonnet-5",
}));

vi.mock("@/lib/claude/system-prompt", () => ({
  cargarSystemPromptEntrevista: () => "system prompt de prueba",
}));

vi.mock("@/lib/supabase/server", () => ({
  clienteSupabase: () => ({}),
}));

vi.mock("@/lib/supabase/persistencia", () => ({
  validarToken: (...args: unknown[]) => mockValidarToken(...args),
  incrementarTurno: (...args: unknown[]) => mockIncrementarTurno(...args),
  persistirCierre: (...args: unknown[]) => mockPersistirCierre(...args),
  registrarNotificacionAsesor: (...args: unknown[]) => mockRegistrarNotificacionAsesor(...args),
  comprobarLimiteUso: (...args: unknown[]) => mockComprobarLimiteUso(...args),
}));

vi.mock("@/lib/email/aviso-asesor", () => ({
  enviarAvisoAsesor: (...args: unknown[]) => mockEnviarAvisoAsesor(...args),
}));

const { POST } = await import("./route");

const TOKEN = "tok-valido";
const ADVISOR_EMAIL_ORIGINAL = process.env.ADVISOR_NOTIFICATION_EMAIL;
const PEPPER_ORIGINAL = process.env.IP_HASH_PEPPER;

function req(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Body válido por defecto: incluye el token, salvo que el test lo sobrescriba explícitamente. */
function reqConToken(body: { messages?: unknown; token?: unknown }): Request {
  return req({ token: TOKEN, ...body });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockValidarToken.mockReset();
    mockIncrementarTurno.mockReset();
    mockPersistirCierre.mockReset();
    mockRegistrarNotificacionAsesor.mockReset();
    mockEnviarAvisoAsesor.mockReset();
    // Por defecto, un token válido de una conversación recién creada (0 turnos hasta ahora) —
    // los tests que no son sobre el token en sí no necesitan repetir esto.
    mockValidarToken.mockResolvedValue({ id: "conv-1", turnosTotales: 0 });
    mockIncrementarTurno.mockResolvedValue(undefined);
    mockPersistirCierre.mockResolvedValue({
      clienteId: "cli-1",
      fichaId: "ficha-1",
      informeId: "informe-1",
      planId: "plan-1",
    });
    mockRegistrarNotificacionAsesor.mockResolvedValue(undefined);
    mockEnviarAvisoAsesor.mockResolvedValue(undefined);
    mockComprobarLimiteUso.mockReset();
    mockComprobarLimiteUso.mockResolvedValue(true);
    process.env.ADVISOR_NOTIFICATION_EMAIL = "asesor@example.com";
    process.env.IP_HASH_PEPPER = "pepper-de-prueba";
  });

  afterEach(() => {
    process.env.ADVISOR_NOTIFICATION_EMAIL = ADVISOR_EMAIL_ORIGINAL;
    process.env.IP_HASH_PEPPER = PEPPER_ORIGINAL;
  });

  it("rechaza JSON inválido", async () => {
    const res = await POST(
      new Request("http://localhost/api/chat", { method: "POST", body: "{invalido" }),
    );
    expect(res.status).toBe(400);
  });

  it('rechaza si falta "token"', async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(400);
    expect(mockValidarToken).not.toHaveBeenCalled();
  });

  it('rechaza si "token" no es un string', async () => {
    const res = await POST(req({ token: 123, messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(400);
  });

  it('rechaza si "messages" no es un array', async () => {
    const res = await POST(reqConToken({ messages: "hola" }));
    expect(res.status).toBe(400);
  });

  it("rechaza mensajes con role inválido", async () => {
    const res = await POST(reqConToken({ messages: [{ role: "system", content: "x" }] }));
    expect(res.status).toBe(400);
  });

  it("rechaza mensajes sin content de tipo string", async () => {
    const res = await POST(reqConToken({ messages: [{ role: "user", content: 42 }] }));
    expect(res.status).toBe(400);
  });

  it("rechaza conversación vacía", async () => {
    const res = await POST(reqConToken({ messages: [] }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rechaza por encima del tope de turnos", async () => {
    const mensajes = Array.from({ length: 41 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x",
    }));
    const res = await POST(reqConToken({ messages: mensajes }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("acepta justo en el tope de turnos", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const mensajes = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x",
    }));
    const res = await POST(reqConToken({ messages: mensajes }));
    expect(res.status).toBe(200);
  });

  describe("validación del token (M-06)", () => {
    it("token inexistente, expirado o de conversación ya cerrada → 401 con mensaje genérico", async () => {
      mockValidarToken.mockResolvedValue(null);
      const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(res.status).toBe(401);
      expect(mockCreate).not.toHaveBeenCalled();
      const data = await res.json();
      // Genérico a propósito: no debe distinguir "no existe" de "expiró" de "ya se cerró".
      expect(data.error.toLowerCase()).not.toMatch(/expir|token|no existe/);
    });

    it("token válido: procesa el turno con normalidad", async () => {
      mockCreate.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
      const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(res.status).toBe(200);
      expect(mockValidarToken).toHaveBeenCalledWith(expect.anything(), TOKEN);
    });

    it("un turno procesado con éxito incrementa el contador de turnos", async () => {
      mockValidarToken.mockResolvedValue({ id: "conv-9", turnosTotales: 3 });
      mockCreate.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
      await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(mockIncrementarTurno).toHaveBeenCalledWith(expect.anything(), "conv-9", 3);
    });

    it("si falla la validación del token contra Supabase, responde 502", async () => {
      mockValidarToken.mockRejectedValue(new Error("boom"));
      const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(res.status).toBe(502);
    });
  });

  describe("límite de uso por IP", () => {
    it("por encima del límite: 429 con mensaje genérico, no llama a Claude", async () => {
      mockComprobarLimiteUso.mockResolvedValue(false);
      const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(res.status).toBe(429);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("comprueba el límite con la acción 'enviar_mensaje'", async () => {
      mockCreate.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
      await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(mockComprobarLimiteUso).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        "enviar_mensaje",
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("si falla la comprobación del límite, responde 502 sin llamar a Claude", async () => {
      mockComprobarLimiteUso.mockRejectedValue(new Error("boom"));
      const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
      expect(res.status).toBe(502);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  it("llama a Claude con el system prompt correcto y devuelve su respuesta", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hola, ¿cómo te llamas?" }],
    });
    const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toEqual({ role: "assistant", content: "Hola, ¿cómo te llamas?" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5",
        system: "system prompt de prueba",
        messages: [{ role: "user", content: "Hola" }],
      }),
    );
  });

  it("concatena solo los bloques de texto de una respuesta con varios bloques", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Primera parte." },
        { type: "text", text: "Segunda parte." },
      ],
    });
    const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
    const data = await res.json();
    expect(data.message.content).toBe("Primera parte.\nSegunda parte.");
  });

  it("devuelve 502 (no 500 sin explicación) si la llamada a Claude falla", async () => {
    mockCreate.mockRejectedValue(new Error("boom"));
    const res = await POST(reqConToken({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  describe("cuando el mensaje del agente trae la ficha de cierre", () => {
    const FICHA_MINIMA = `
nombre: Silvia [confirmado]
email: silvia@example.com [confirmado]
fecha_entrevista: 2026-08-25

ingresos_netos_mensual: 2800 [confirmado]
ingresos_estabilidad: estable [confirmado]
gastos_fijos_mensual: 1600 [confirmado]

deudas_numero: 1
deuda_1_tipo: hipoteca [confirmado]
deuda_1_importe: 150000 [confirmado]
deuda_1_cuota: 620 [confirmado]
deuda_1_interes: 1.9 [confirmado]
deudas_interes_alto_declarado: no [confirmado]

patrimonio_liquido: 12000 [confirmado]
patrimonio_invertido: 10000 [confirmado]
patrimonio_distribucion: todo en un fondo indexado [confirmado]
aportacion_mensual_actual: 150 [confirmado]

colchon_meses: 5 [confirmado]

objetivo_proposito: bajar el ritmo a los 60 [confirmado]
objetivo_importe: 150000 [confirmado]
objetivo_plazo_anios: 20 [confirmado]

riesgo_tolerancia_declarada: media [confirmado]
riesgo_comportamiento_real: aguantó la caída del covid sin vender [confirmado]
riesgo_perfil_derivado: moderado [confirmado]

edad: 40 [confirmado]
personas_a_cargo: 0 [confirmado]
situacion_laboral: diseñadora gráfica en plantilla [confirmado]
`;

    it("no enseña el volcado en crudo: calcula el informe, lo persiste y devuelve el plan redactado", async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: "text", text: FICHA_MINIMA }] })
        .mockResolvedValueOnce({ content: [{ type: "text", text: "## Tu meta\n..." }] });

      const res = await POST(reqConToken({ messages: [{ role: "user", content: "ya está" }] }));

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message.content).toBe("## Tu meta\n...");
      expect(data.message.content).not.toContain("ingresos_netos_mensual");
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockPersistirCierre).toHaveBeenCalledTimes(1);
      const llamada = mockPersistirCierre.mock.calls[0][1];
      expect(llamada.conversacionId).toBe("conv-1");
      expect(llamada.planMarkdown).toBe("## Tu meta\n...");
      expect(llamada.ficha.email.valor).toBe("silvia@example.com");
    });

    it("la segunda llamada (redacción del plan) usa un system prompt distinto al de la entrevista", async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: "text", text: FICHA_MINIMA }] })
        .mockResolvedValueOnce({ content: [{ type: "text", text: "plan" }] });

      await POST(reqConToken({ messages: [{ role: "user", content: "ya está" }] }));

      const segundaLlamada = mockCreate.mock.calls[1][0];
      expect(segundaLlamada.system).not.toBe("system prompt de prueba");
      expect(segundaLlamada.system).toContain("Entrega del plan al visitante");
    });

    it("si falla la llamada de redacción del plan, responde 502", async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: "text", text: FICHA_MINIMA }] })
        .mockRejectedValueOnce(new Error("boom"));

      const res = await POST(reqConToken({ messages: [{ role: "user", content: "ya está" }] }));
      expect(res.status).toBe(502);
      expect(mockPersistirCierre).not.toHaveBeenCalled();
    });

    it("si falla la persistencia del cierre, responde 502 y no se le muestra el plan al visitante", async () => {
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: "text", text: FICHA_MINIMA }] })
        .mockResolvedValueOnce({ content: [{ type: "text", text: "## Tu meta\n..." }] });
      mockPersistirCierre.mockRejectedValue(new Error("constraint violation"));

      const res = await POST(reqConToken({ messages: [{ role: "user", content: "ya está" }] }));
      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toBeTruthy();
    });

    describe("aviso al asesor (M-05)", () => {
      async function cerrarConversacion() {
        mockCreate
          .mockResolvedValueOnce({ content: [{ type: "text", text: FICHA_MINIMA }] })
          .mockResolvedValueOnce({ content: [{ type: "text", text: "## Tu meta\n..." }] });
        return POST(reqConToken({ messages: [{ role: "user", content: "ya está" }] }));
      }

      it("envía el aviso y lo registra como enviado", async () => {
        const res = await cerrarConversacion();
        expect(res.status).toBe(200);
        expect(mockEnviarAvisoAsesor).toHaveBeenCalledWith(
          "asesor@example.com",
          expect.objectContaining({ fichaId: "ficha-1", informeId: "informe-1", modo: expect.any(String) }),
        );
        expect(mockRegistrarNotificacionAsesor).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ conversacionId: "conv-1", destinatario: "asesor@example.com", exito: true }),
        );
      });

      it("si falla el envío, se registra como fallido pero el visitante SÍ recibe su plan", async () => {
        mockEnviarAvisoAsesor.mockRejectedValue(new Error("Resend caído"));
        const res = await cerrarConversacion();

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message.content).toBe("## Tu meta\n...");
        expect(mockRegistrarNotificacionAsesor).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ exito: false }),
        );
      });

      it("sin ADVISOR_NOTIFICATION_EMAIL configurado, no intenta enviar ni registrar, y no rompe el turno", async () => {
        delete process.env.ADVISOR_NOTIFICATION_EMAIL;
        const res = await cerrarConversacion();
        expect(res.status).toBe(200);
        expect(mockEnviarAvisoAsesor).not.toHaveBeenCalled();
        expect(mockRegistrarNotificacionAsesor).not.toHaveBeenCalled();
      });

      it("si falla incluso el registro de la notificación, el visitante sigue recibiendo su plan", async () => {
        mockRegistrarNotificacionAsesor.mockRejectedValue(new Error("boom"));
        const res = await cerrarConversacion();
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message.content).toBe("## Tu meta\n...");
      });
    });
  });
});
