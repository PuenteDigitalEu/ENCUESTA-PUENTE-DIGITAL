import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashIp, obtenerIpVisitante } from "./ip";

describe("obtenerIpVisitante", () => {
  it("usa la primera IP de x-forwarded-for (encadenado de proxies)", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" },
    });
    expect(obtenerIpVisitante(req)).toBe("203.0.113.5");
  });

  it("usa x-real-ip si no hay x-forwarded-for", () => {
    const req = new Request("http://localhost", { headers: { "x-real-ip": "203.0.113.9" } });
    expect(obtenerIpVisitante(req)).toBe("203.0.113.9");
  });

  it('sin ninguna cabecera, devuelve "local" (desarrollo)', () => {
    const req = new Request("http://localhost");
    expect(obtenerIpVisitante(req)).toBe("local");
  });
});

describe("hashIp", () => {
  const pepperOriginal = process.env.IP_HASH_PEPPER;

  beforeEach(() => {
    process.env.IP_HASH_PEPPER = "pepper-de-prueba";
  });
  afterEach(() => {
    process.env.IP_HASH_PEPPER = pepperOriginal;
  });

  it("lanza si IP_HASH_PEPPER no está configurado", () => {
    delete process.env.IP_HASH_PEPPER;
    expect(() => hashIp("203.0.113.5")).toThrow(/IP_HASH_PEPPER/);
  });

  it("misma IP y mismo pepper → mismo hash, siempre", () => {
    expect(hashIp("203.0.113.5")).toBe(hashIp("203.0.113.5"));
  });

  it("nunca devuelve la IP en claro dentro del hash", () => {
    expect(hashIp("203.0.113.5")).not.toContain("203.0.113.5");
  });

  it("el mismo IP con distinto pepper da un hash distinto (por eso protege)", () => {
    const conUnPepper = hashIp("203.0.113.5");
    process.env.IP_HASH_PEPPER = "otro-pepper-distinto";
    const conOtroPepper = hashIp("203.0.113.5");
    expect(conUnPepper).not.toBe(conOtroPepper);
  });
});
