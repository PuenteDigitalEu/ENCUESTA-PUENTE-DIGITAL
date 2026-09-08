/**
 * M-10: aviso automático al consultor cuando se completa una encuesta.
 *
 * Resend por API HTTP directa (docs/architecture.md §3) — sin SDK ni Edge Function, solo esta
 * llamada `fetch` desde `app/api/cierre/`.
 */

import type { CasoUso, NivelPreparacion } from "@/lib/rubrica";

export interface DatosAvisoConsultor {
  contacto: { nombre: string; email: string; telefono: string; empresa: string };
  sector: string | null;
  nivelPreparacion: NivelPreparacion;
  completo: boolean;
  casosUso: CasoUso[];
}

const NIVEL_TEXTO: Record<NivelPreparacion, string> = {
  sin_preparar: "punto de partida",
  inicial: "inicial",
  en_desarrollo: "en desarrollo",
  consolidada: "consolidada",
};

/**
 * Lanza si Resend no confirma el envío — quien llama lo registra como `fallido` en
 * `notificaciones_consultor`, pero nunca bloquea la respuesta al visitante.
 */
export async function enviarAvisoConsultor(
  destinatario: string,
  datos: DatosAvisoConsultor,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada. Rellénala en .env.local (ver .env.example).");
  }

  // Dominio puentedigital.eu ya verificado en Resend. Se puede sobrescribir con RESEND_FROM.
  const from = process.env.RESEND_FROM ?? "Puente Digital EU <avisos@puentedigital.eu>";

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: destinatario,
      subject: `Nueva encuesta: ${datos.contacto.empresa} (${NIVEL_TEXTO[datos.nivelPreparacion]})`,
      text: cuerpo(datos),
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Resend devolvió ${respuesta.status}: ${detalle}`);
  }
}

function cuerpo(datos: DatosAvisoConsultor): string {
  const { contacto } = datos;
  const casos = datos.casosUso
    .map((c, i) => `  ${i + 1}. ${c.nombre} — impacto ${c.impacto}/5, viabilidad ${c.viabilidad}/5`)
    .join("\n");

  return [
    "Se ha completado una encuesta nueva.",
    "",
    `Empresa:   ${contacto.empresa}`,
    `Contacto:  ${contacto.nombre}`,
    `Email:     ${contacto.email}`,
    `Teléfono:  ${contacto.telefono}`,
    `Sector:    ${datos.sector ?? "(sin dato)"}`,
    "",
    `Nivel de preparación: ${NIVEL_TEXTO[datos.nivelPreparacion]}${datos.completo ? "" : " (análisis incompleto)"}`,
    "",
    "Casos de uso priorizados:",
    casos || "  (ninguno)",
  ].join("\n");
}
