import { createHmac } from "node:crypto";

/**
 * Umbrales del límite de uso — pensados para tráfico bajo y por enlace (docs/prd.md → "Supuestos"):
 * con margen para reintentar varias veces, sin hueco para un bucle automatizado que vacíe el saldo
 * de la API de Claude. Heredados del clon; a revisar con el volumen real (roadmap Fase 2).
 */
export const VENTANA_HORAS = 24;
export const UMBRAL_CREAR_ENCUESTA = 10;
export const UMBRAL_ENVIAR_MENSAJE = 150;

/**
 * Protección contra abuso: el chat es público y cada mensaje cuesta dinero real en la API de
 * Claude. Se guarda un hash de la IP, nunca la IP en claro — pero un SHA-256 desnudo sobre una
 * IPv4 se revierte por fuerza bruta en minutos. Por eso HMAC con un secreto de despliegue
 * (`IP_HASH_PEPPER`): sin ese secreto, el hash guardado no es reversible.
 */
export function hashIp(ip: string): string {
  const pepper = process.env.IP_HASH_PEPPER;
  if (!pepper) {
    throw new Error("IP_HASH_PEPPER no está configurada. Rellénala en .env.local (ver .env.example).");
  }
  return createHmac("sha256", pepper).update(ip).digest("hex");
}

/**
 * `x-forwarded-for` es lo que Vercel inyecta de forma fiable; puede traer varias IPs separadas por
 * comas (proxies encadenados) — la primera es la del cliente original. `x-real-ip` como respaldo.
 * En local, sin ninguna de las dos, un valor fijo para no romper el flujo de desarrollo.
 */
export function obtenerIpVisitante(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "local";
}
