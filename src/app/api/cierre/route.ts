import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generarDiagnostico, NOTA_ALCANCE } from "@/lib/claude/diagnostico";
import { enviarAvisoConsultor } from "@/lib/email/aviso-consultor";
import { calcularRubrica } from "@/lib/rubrica";
import { clienteSupabase } from "@/lib/supabase/server";
import {
  leerRespuestas,
  persistirCierre,
  registrarNotificacionConsultor,
  validarToken,
  type DatosContacto,
} from "@/lib/supabase/persistencia";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * M-08: cierre de la encuesta. Recibe el token y los cuatro datos de contacto; sin ellos no hay
 * diagnóstico. Calcula la rúbrica (determinista), pide el diagnóstico a Claude a partir del
 * resultado ya calculado, persiste el cierre y dispara el aviso al consultor (que nunca bloquea
 * esta respuesta).
 */
export async function POST(request: Request) {
  let body: { token?: unknown; contacto?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body.token !== "string" || body.token.length === 0) {
    return NextResponse.json({ error: 'El cuerpo debe incluir "token".' }, { status: 400 });
  }

  const contacto = validarContacto(body.contacto);
  if (!contacto) {
    return NextResponse.json(
      { error: "Faltan datos de contacto o el email no es válido." },
      { status: 400 },
    );
  }

  const supabase = clienteSupabase();

  let encuesta;
  try {
    encuesta = await validarToken(supabase, body.token, ["respondida"]);
  } catch (error) {
    console.error("Error validando el token en /api/cierre:", error);
    return NextResponse.json({ error: "No se pudo procesar. Inténtalo de nuevo." }, { status: 502 });
  }
  if (!encuesta) {
    return NextResponse.json({ error: "Esta encuesta ya no está disponible." }, { status: 401 });
  }

  try {
    const respuestas = await leerRespuestas(supabase, encuesta.id);
    if (!respuestas) {
      return NextResponse.json({ error: "No se encontraron las respuestas de la encuesta." }, { status: 409 });
    }

    const resultado = calcularRubrica(respuestas.contenido);
    const diagnostico = await generarDiagnostico(respuestas.contenido, resultado);

    await persistirCierre(supabase, {
      encuestaId: encuesta.id,
      respuestaId: respuestas.respuestaId,
      contacto,
      resultado,
      diagnostico: {
        markdown: diagnostico.markdown,
        secciones: diagnostico.secciones,
        notaAlcance: NOTA_ALCANCE,
      },
      costeDiagnostico: diagnostico.uso,
    });

    void avisarConsultorSinBloquear(supabase, encuesta.id, contacto, resultado, respuestas.contenido.sector.valor);

    return NextResponse.json({
      diagnostico: {
        markdown: diagnostico.markdown,
        notaAlcance: NOTA_ALCANCE,
        nivelPreparacion: resultado.nivelPreparacion,
        completo: resultado.completo,
        datosFaltantes: resultado.datosFaltantes,
        casosUso: resultado.casosUso,
      },
    });
  } catch (error) {
    console.error("Error cerrando la encuesta en /api/cierre:", error);
    return NextResponse.json(
      { error: "No se pudo generar el diagnóstico. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}

async function avisarConsultorSinBloquear(
  supabase: SupabaseClient,
  encuestaId: string,
  contacto: DatosContacto,
  resultado: ReturnType<typeof calcularRubrica>,
  sector: string | null,
): Promise<void> {
  const destinatario = process.env.CONSULTOR_NOTIFICATION_EMAIL;
  if (!destinatario) {
    console.warn("CONSULTOR_NOTIFICATION_EMAIL no está configurada — no se envía aviso.");
    return;
  }
  let exito = true;
  try {
    await enviarAvisoConsultor(destinatario, {
      contacto,
      sector,
      nivelPreparacion: resultado.nivelPreparacion,
      completo: resultado.completo,
      casosUso: resultado.casosUso,
    });
  } catch (error) {
    exito = false;
    console.error("Error enviando el aviso al consultor:", error);
  }
  try {
    await registrarNotificacionConsultor(supabase, { encuestaId, destinatario, exito });
  } catch (error) {
    console.error("Error registrando la notificación al consultor:", error);
  }
}

function validarContacto(valor: unknown): DatosContacto | null {
  if (typeof valor !== "object" || valor === null) return null;
  const c = valor as Record<string, unknown>;
  const campos = ["nombre", "email", "telefono", "empresa"] as const;
  for (const campo of campos) {
    if (typeof c[campo] !== "string" || (c[campo] as string).trim() === "") return null;
  }
  const email = (c.email as string).trim();
  if (!EMAIL_RE.test(email)) return null;
  return {
    nombre: (c.nombre as string).trim(),
    email,
    telefono: (c.telefono as string).trim(),
    empresa: (c.empresa as string).trim(),
  };
}
