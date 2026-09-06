import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enviarAvisoAsesor } from "./aviso-asesor";

const DATOS = {
  nombreCliente: "Silvia",
  emailCliente: "silvia@example.com",
  modo: "completo",
  fichaId: "ficha-1",
  informeId: "informe-1",
  planMarkdown: "## 1. Tu meta\nTexto.",
};

describe("enviarAvisoAsesor", () => {
  const entornoOriginal = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "clave-de-prueba";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = entornoOriginal;
    vi.unstubAllGlobals();
  });

  it("lanza si RESEND_API_KEY no está configurada", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(enviarAvisoAsesor("asesor@example.com", DATOS)).rejects.toThrow(/RESEND_API_KEY/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("llama a la API de Resend con el destinatario, asunto y cuerpo correctos", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await enviarAvisoAsesor("asesor@example.com", DATOS);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer clave-de-prueba" }),
      }),
    );
    const cuerpo = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(cuerpo.to).toBe("asesor@example.com");
    expect(cuerpo.subject).toContain("Silvia");
    expect(cuerpo.subject).toContain("completo");
    expect(cuerpo.text).toContain("silvia@example.com");
    expect(cuerpo.text).toContain("## 1. Tu meta");
  });

  it("nombre/email ausentes no rompen el envío, se marcan como tal", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await enviarAvisoAsesor("asesor@example.com", { ...DATOS, nombreCliente: null, emailCliente: null });
    const cuerpo = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(cuerpo.subject).toContain("visitante sin nombre");
    expect(cuerpo.text).toContain("sin email");
  });

  it("lanza con detalle si Resend responde con error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("clave inválida", { status: 401 }));
    await expect(enviarAvisoAsesor("asesor@example.com", DATOS)).rejects.toThrow(/401/);
  });
});
