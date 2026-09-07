import { NextResponse } from "next/server";

import { hashIp, obtenerIpVisitante, UMBRAL_CREAR_ENCUESTA, VENTANA_HORAS } from "@/lib/ip";
import { clienteSupabase } from "@/lib/supabase/server";
import { comprobarLimiteUso, crearEncuesta } from "@/lib/supabase/persistencia";

export const runtime = "nodejs";

/** Versión del texto de consentimiento que muestra `ConsentScreen`. Cambiar aquí si cambia el texto. */
const CONSENTIMIENTO_VERSION = "2026-09-07";

/**
 * M-02: crea la encuesta al aceptar el consentimiento de tratamiento de datos. Hasta esta llamada
 * no existe ninguna fila ni ningún dato personal. Antes de crearla se comprueba el límite por IP.
 */
export async function POST(request: Request) {
  try {
    const supabase = clienteSupabase();
    const ipHash = hashIp(obtenerIpVisitante(request));

    const permitido = await comprobarLimiteUso(
      supabase,
      ipHash,
      "crear_encuesta",
      UMBRAL_CREAR_ENCUESTA,
      VENTANA_HORAS,
    );
    if (!permitido) {
      return NextResponse.json(
        { error: "No se pueden iniciar más encuestas desde aquí por ahora. Inténtalo más tarde." },
        { status: 429 },
      );
    }

    const { token } = await crearEncuesta(supabase, CONSENTIMIENTO_VERSION);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error creando la encuesta en /api/conversacion:", error);
    return NextResponse.json(
      { error: "No se pudo iniciar la encuesta. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}
