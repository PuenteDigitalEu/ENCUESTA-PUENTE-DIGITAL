import { NextResponse } from "next/server";

import { hashIp, obtenerIpVisitante, UMBRAL_CREAR_CONVERSACION, VENTANA_HORAS } from "@/lib/ip";
import { clienteSupabase } from "@/lib/supabase/server";
import { comprobarLimiteUso, crearConversacion } from "@/lib/supabase/persistencia";

// Igual que app/api/chat/: necesita el runtime de Node para leer variables de entorno de servidor
// y usar el cliente de Supabase con la clave de servicio.
export const runtime = "nodejs";

/**
 * M-06: crea la conversación al aceptar el consentimiento de tratamiento de datos. Hasta esta
 * llamada no existe ninguna fila ni ningún dato personal — la pantalla de consentimiento la llama
 * al pulsar "Acepto y empiezo", antes de que exista el resto de la conversación.
 *
 * Sin body: `consentimiento_en` se marca con la hora del servidor en el momento de la llamada, no
 * con nada que mande el cliente (no hay nada que el visitante pueda falsear aquí).
 *
 * Límite de uso (`docs/features/limite-de-uso.md`): antes de crear la conversación, se comprueba
 * cuántas veces ha creado una esta misma IP (por su hash) en las últimas 24h — por encima del
 * umbral, 429 con mensaje genérico, sin decir cuál es el límite (`FLOW-01` → "Casos de error").
 */
export async function POST(request: Request) {
  try {
    const supabase = clienteSupabase();
    const ipHash = hashIp(obtenerIpVisitante(request));

    const permitido = await comprobarLimiteUso(
      supabase,
      ipHash,
      "crear_conversacion",
      UMBRAL_CREAR_CONVERSACION,
      VENTANA_HORAS,
    );
    if (!permitido) {
      return NextResponse.json(
        { error: "No se pueden iniciar más conversaciones desde aquí por ahora. Inténtalo más tarde." },
        { status: 429 },
      );
    }

    const { token } = await crearConversacion(supabase);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error creando la conversación en /api/conversacion:", error);
    return NextResponse.json(
      { error: "No se pudo iniciar la conversación. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}
