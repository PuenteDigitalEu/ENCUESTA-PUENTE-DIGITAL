import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCrearEncuesta = vi.fn();
const mockComprobarLimiteUso = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ clienteSupabase: () => ({}) }));

vi.mock("@/lib/supabase/persistencia", () => ({
  crearEncuesta: (...args: unknown[]) => mockCrearEncuesta(...args),
  comprobarLimiteUso: (...args: unknown[]) => mockComprobarLimiteUso(...args),
}));

const { POST } = await import("./route");

const PEPPER_ORIGINAL = process.env.IP_HASH_PEPPER;

const req = () => new Request("http://localhost/api/conversacion", { method: "POST" });

describe("POST /api/conversacion", () => {
  beforeEach(() => {
    mockCrearEncuesta.mockReset();
    mockComprobarLimiteUso.mockReset();
    mockComprobarLimiteUso.mockResolvedValue(true);
    mockCrearEncuesta.mockResolvedValue({ id: "e1", token: "tok-123" });
    process.env.IP_HASH_PEPPER = "pepper-de-prueba";
  });
  afterEach(() => {
    process.env.IP_HASH_PEPPER = PEPPER_ORIGINAL;
  });

  it("crea la encuesta y devuelve el token", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "tok-123" });
  });

  it("comprueba el límite con la acción 'crear_encuesta'", async () => {
    await POST(req());
    expect(mockComprobarLimiteUso).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "crear_encuesta",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("por encima del límite responde 429 y no crea nada", async () => {
    mockComprobarLimiteUso.mockResolvedValue(false);
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(mockCrearEncuesta).not.toHaveBeenCalled();
  });

  it("si falla la creación responde 502", async () => {
    mockCrearEncuesta.mockRejectedValue(new Error("boom"));
    const res = await POST(req());
    expect(res.status).toBe(502);
  });
});
