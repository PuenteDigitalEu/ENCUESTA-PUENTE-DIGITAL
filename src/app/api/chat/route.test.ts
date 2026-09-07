import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockValidarToken = vi.fn();
const mockIncrementarTurno = vi.fn();
const mockPersistirRespuestas = vi.fn();
const mockComprobarLimiteUso = vi.fn();

vi.mock("@/lib/claude/client", () => ({
  clienteClaude: () => ({ messages: { create: mockCreate } }),
  MODELO_ENTREVISTA: "claude-sonnet-5",
}));
vi.mock("@/lib/claude/system-prompt", () => ({
  cargarSystemPromptEntrevista: () => "system prompt de prueba",
}));
vi.mock("@/lib/supabase/server", () => ({ clienteSupabase: () => ({}) }));
vi.mock("@/lib/supabase/persistencia", () => ({
  validarToken: (...a: unknown[]) => mockValidarToken(...a),
  incrementarTurno: (...a: unknown[]) => mockIncrementarTurno(...a),
  persistirRespuestas: (...a: unknown[]) => mockPersistirRespuestas(...a),
  comprobarLimiteUso: (...a: unknown[]) => mockComprobarLimiteUso(...a),
}));

const { POST } = await import("./route");

const TOKEN = "tok-valido";
const PEPPER_ORIGINAL = process.env.IP_HASH_PEPPER;

const req = (body: unknown) =>
  new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) });
const reqTok = (body: { messages?: unknown; token?: unknown }) => req({ token: TOKEN, ...body });

const texto = (t: string) => ({ content: [{ type: "text", text: t }], usage: { input_tokens: 100, output_tokens: 20 } });

describe("POST /api/chat", () => {
  beforeEach(() => {
    for (const m of [mockCreate, mockValidarToken, mockIncrementarTurno, mockPersistirRespuestas, mockComprobarLimiteUso]) m.mockReset();
    mockValidarToken.mockResolvedValue({ id: "e1", estado: "en_curso", turnosTotales: 0 });
    mockIncrementarTurno.mockResolvedValue(undefined);
    mockPersistirRespuestas.mockResolvedValue({ respuestaId: "r1" });
    mockComprobarLimiteUso.mockResolvedValue(true);
    process.env.IP_HASH_PEPPER = "pepper-de-prueba";
  });
  afterEach(() => {
    process.env.IP_HASH_PEPPER = PEPPER_ORIGINAL;
  });

  it("rechaza JSON inválido", async () => {
    const res = await POST(new Request("http://localhost/api/chat", { method: "POST", body: "{malo" }));
    expect(res.status).toBe(400);
  });

  it("rechaza si falta token", async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(400);
    expect(mockValidarToken).not.toHaveBeenCalled();
  });

  it("token inválido → 401 con mensaje genérico", async () => {
    mockValidarToken.mockResolvedValue(null);
    const res = await POST(reqTok({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.toLowerCase()).not.toMatch(/expir|no existe/);
  });

  it("por encima del límite por IP → 429, no llama a Claude", async () => {
    mockComprobarLimiteUso.mockResolvedValue(false);
    const res = await POST(reqTok({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("turno normal: devuelve la respuesta del agente e incrementa el contador", async () => {
    mockValidarToken.mockResolvedValue({ id: "e9", estado: "en_curso", turnosTotales: 3 });
    mockCreate.mockResolvedValue(texto("¿A qué te dedicas?"));
    const res = await POST(reqTok({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: { role: "assistant", content: "¿A qué te dedicas?" } });
    expect(mockIncrementarTurno).toHaveBeenCalledWith(expect.anything(), "e9", 3);
    expect(mockPersistirRespuestas).not.toHaveBeenCalled();
  });

  it("cuando el agente emite FICHA-ENCUESTA-IA: persiste respuestas y devuelve fin_entrevista", async () => {
    const ficha = "FICHA-ENCUESTA-IA\nsector: taller [confirmado]\ntamano_rango: 1-9 [confirmado]\nprocesos_numero: 0\ntareas_numero: 0\nherramientas_numero: 0";
    mockCreate.mockResolvedValue(texto(ficha));
    const res = await POST(reqTok({ messages: [{ role: "user", content: "ya está" }] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fin_entrevista).toBe(true);
    expect(data.message.content).not.toContain("sector:");
    expect(mockPersistirRespuestas).toHaveBeenCalledTimes(1);
    expect(mockPersistirRespuestas.mock.calls[0][1].encuestaId).toBe("e1");
  });

  it("si falla la llamada a Claude → 502", async () => {
    mockCreate.mockRejectedValue(new Error("boom"));
    const res = await POST(reqTok({ messages: [{ role: "user", content: "Hola" }] }));
    expect(res.status).toBe(502);
  });
});
