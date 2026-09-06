import { createHmac } from "node:crypto";

/**
 * Umbrales del límite de uso (`docs/features/limite-de-uso.md`) — pensados para tráfico bajo y
 * por invitación (`docs/prd.md` → "Disponibilidad"): con margen para que alguien reintente varias
 * veces, sin hueco para un bucle automatizado que vacíe el saldo de la API de Claude.
 */
export const VENTANA_HORAS = 24;
export const UMBRAL_CREAR_CONVERSACION = 10;
export const UMBRAL_ENVIAR_MENSAJE = 150;

/**
 * Protección contra abuso (`docs/architecture.md`): el chat es público y cada mensaje cuesta
 * dinero real en la API de Claude. Se guarda un hash de la IP, nunca la IP en claro — pero un
 * SHA-256 desnudo sobre una IPv4 se revierte por fuerza bruta en minutos (el espacio de
 * direcciones es pequeño). Por eso HMAC con un secreto de despliegue (`IP_HASH_PEPPER`): sin ese
 * secreto, el hash guardado no es reversible.
 */
export function hashIp(ip: string): string {
  const pepper = process.env.IP_HASH_PEPPER;
  if (!pepper) {
    throw new Error("IP_HASH_PEPPER no está configurada. Rellénala en .env.local (ver .env.example).");
  }
  return createHmac("sha256", pepper).update(ip).digest("hex");
}

/**
 * `x-forwarded-for` es lo que Vercel (destino de despliegue) inyecta de forma fiable; puede traer
 * varias IPs separadas por comas (proxies encadenados) — la primera es la del cliente original.
 * `x-real-ip` como respaldo. En local, sin ninguna de las dos, un valor fijo para no romper el
 * flujo de desarrollo (no hay proxy que las añada).
 */
export function obtenerIpVisitante(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "local";
}
