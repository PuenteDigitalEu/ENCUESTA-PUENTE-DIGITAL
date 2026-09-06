import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCrearConversacion = vi.fn();
const mockComprobarLimiteUso = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  clienteSupabase: () => ({}),
}));

vi.mock("@/lib/supabase/persistencia", () => ({
  crearConversacion: (...args: unknown[]) => mockCrearConversacion(...args),
  comprobarLimiteUso: (...args: unknown[]) => mockComprobarLimiteUso(...args),
}));

const { POST } = await import("./route");

const PEPPER_ORIGINAL = process.env.IP_HASH_PEPPER;

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/conversacion", { method: "POST", headers });
}

describe("POST /api/conversacion", () => {
  beforeEach(() => {
    mockCrearConversacion.mockReset();
    mockComprobarLimiteUso.mockReset();
    mockComprobarLimiteUso.mockResolvedValue(true);
    process.env.IP_HASH_PEPPER = "pepper-de-prueba";
  });

  afterEach(() => {
    process.env.IP_HASH_PEPPER = PEPPER_ORIGINAL;
  });

  it("devuelve el token de la conversación recién creada", async () => {
    mockCrearConversacion.mockResolvedValue({ id: "conv-1", token: "tok-1" });

    const res = await POST(req());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ token: "tok-1" });
  });

  it("nunca devuelve el id interno de la conversación, solo el token", async () => {
    mockCrearConversacion.mockResolvedValue({ id: "conv-1", token: "tok-1" });
    const res = await POST(req());
    const data = await res.json();
    expect(data).not.toHaveProperty("id");
  });

  it("devuelve 502 (no 500 sin explicación) si falla la creación", async () => {
    mockCrearConversacion.mockRejectedValue(new Error("boom"));
    const res = await POST(req());
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  describe("límite de uso por IP", () => {
    it("por encima del límite: 429 con mensaje genérico, no crea la conversación", async () => {
      mockComprobarLimiteUso.mockResolvedValue(false);
      const res = await POST(req({ "x-forwarded-for": "203.0.113.5" }));
      expect(res.status).toBe(429);
      expect(mockCrearConversacion).not.toHaveBeenCalled();
      const data = await res.json();
      expect(data.error).toBeTruthy();
    });

    it("comprueba el límite con la acción 'crear_conversacion'", async () => {
      mockCrearConversacion.mockResolvedValue({ id: "conv-1", token: "tok-1" });
      await POST(req({ "x-forwarded-for": "203.0.113.5" }));
      expect(mockComprobarLimiteUso).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        "crear_conversacion",
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("si falla la comprobación del límite, responde 502 sin crear la conversación", async () => {
      mockComprobarLimiteUso.mockRejectedValue(new Error("boom"));
      const res = await POST(req());
      expect(res.status).toBe(502);
      expect(mockCrearConversacion).not.toHaveBeenCalled();
    });
  });
});
