/**
 * M-05: aviso automático al asesor cuando se completa una conversación (FLOW-02).
 *
 * Resend por API HTTP directa (ver decisión en docs/architecture.md, 2026-08-27) — sin SDK ni
 * Edge Function, nada que desplegar aparte de esta misma llamada desde `app/api/chat/`.
 */

export interface DatosAvisoAsesor {
  nombreCliente: string | null;
  emailCliente: string | null;
  modo: string;
  fichaId: string;
  informeId: string;
  planMarkdown: string;
}

/**
 * Lanza si Resend no confirma el envío — quien llama decide qué hacer con el fallo (FLOW-02: se
 * registra como `fallido` en `notificaciones_asesor`, pero nunca bloquea la respuesta al
 * visitante, que ya tiene su plan calculado y persistido independientemente de este email).
 */
export async function enviarAvisoAsesor(destinatario: string, datos: DatosAvisoAsesor): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada. Rellénala en .env.local (ver .env.example).");
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Landing Agente Financiero <onboarding@resend.dev>",
      to: destinatario,
      subject: `Nuevo caso: ${datos.nombreCliente ?? "visitante sin nombre"} (modo ${datos.modo})`,
      text: cuerpoTexto(datos),
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Resend devolvió ${respuesta.status}: ${detalle}`);
  }
}

function cuerpoTexto(datos: DatosAvisoAsesor): string {
  return [
    "Se ha completado una conversación nueva.",
    "",
    `Cliente: ${datos.nombreCliente ?? "(sin nombre)"} <${datos.emailCliente ?? "sin email"}>`,
    `Modo del informe: ${datos.modo}`,
    `Ficha: ${datos.fichaId}`,
    `Informe: ${datos.informeId}`,
    "",
    "--- Plan mostrado al visitante ---",
    "",
    datos.planMarkdown,
  ].join("\n");
}
