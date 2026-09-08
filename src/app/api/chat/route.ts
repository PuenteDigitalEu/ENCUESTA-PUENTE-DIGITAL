import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { clienteClaude, MODELO_ENTREVISTA } from "@/lib/claude/client";
import { cargarSystemPromptEntrevista } from "@/lib/claude/system-prompt";
import { hashIp, obtenerIpVisitante, UMBRAL_ENVIAR_MENSAJE, VENTANA_HORAS } from "@/lib/ip";
import { contieneFicha, parsearRespuestas } from "@/lib/rubrica";
import { clienteSupabase } from "@/lib/supabase/server";
import {
  comprobarLimiteUso,
  incrementarTurno,
  persistirRespuestas,
  validarToken,
} from "@/lib/supabase/persistencia";

// fs.readFileSync (en system-prompt.ts) necesita el runtime de Node, no Edge.
export const runtime = "nodejs";

interface MensajeChat {
  role: "user" | "assistant";
  content: string;
}

/**
 * Tope duro de mensajes (usuario + agente) en una conversación: red de seguridad del servidor
 * contra una conversación descontrolada, no el límite de uso por IP. Una entrevista completa del
 * guion ronda los 40-45 mensajes con el resumen final y la ficha; 70 deja margen sobrado.
 */
const MAX_MENSAJES = 70;

const MENSAJE_CIERRE =
  "Perfecto, ya tengo todo lo que necesito. Antes de enseñarte el diagnóstico necesito que me " +
  "dejes unos datos de contacto.";

/**
 * Un turno de la entrevista. Sin estado en servidor: el cliente manda el historial completo con
 * el `token` que autoriza a escribir en esa encuesta. Cuando el modelo emite la ficha de cierre
 * (`FICHA-ENCUESTA-IA`), se parsea, se persiste `respuestas`, la encuesta pasa a `respondida` y se
 * devuelve `fin_entrevista: true` — el cliente muestra entonces el formulario de contacto.
 */
export async function POST(request: Request) {
  let body: { token?: unknown; messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body.token !== "string" || body.token.length === 0) {
    return NextResponse.json({ error: 'El cuerpo debe incluir "token".' }, { status: 400 });
  }

  const mensajes = validarMensajes(body.messages);
  if (!mensajes) {
    return NextResponse.json(
      { error: 'El cuerpo debe incluir "messages": [{ role, content }, ...].' },
      { status: 400 },
    );
  }
  if (mensajes.length === 0) {
    return NextResponse.json({ error: "La conversación no puede empezar vacía." }, { status: 400 });
  }
  if (mensajes.length > MAX_MENSAJES) {
    return NextResponse.json(
      { error: "Esta conversación ha alcanzado su límite de turnos." },
      { status: 400 },
    );
  }

  const supabase = clienteSupabase();

  let encuesta;
  try {
    encuesta = await validarToken(supabase, body.token, ["en_curso"]);
  } catch (error) {
    console.error("Error validando el token en /api/chat:", error);
    return NextResponse.json({ error: "No se pudo procesar el mensaje. Inténtalo de nuevo." }, { status: 502 });
  }
  if (!encuesta) {
    return NextResponse.json({ error: "Esta conversación ya no está disponible." }, { status: 401 });
  }

  try {
    const ipHash = hashIp(obtenerIpVisitante(request));
    const permitido = await comprobarLimiteUso(
      supabase,
      ipHash,
      "enviar_mensaje",
      UMBRAL_ENVIAR_MENSAJE,
      VENTANA_HORAS,
    );
    if (!permitido) {
      return NextResponse.json(
        { error: "Se han enviado demasiados mensajes desde aquí. Inténtalo más tarde." },
        { status: 429 },
      );
    }
  } catch (error) {
    console.error("Error comprobando el límite de uso en /api/chat:", error);
    return NextResponse.json({ error: "No se pudo procesar el mensaje. Inténtalo de nuevo." }, { status: 502 });
  }

  try {
    const claude = clienteClaude();
    const respuesta = await claude.messages.create({
      model: MODELO_ENTREVISTA,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: cargarSystemPromptEntrevista(),
      messages: mensajes,
    });

    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    await incrementarTurno(supabase, encuesta.id, encuesta.turnosTotales);

    if (contieneFicha(texto)) {
      const { respuestas, anomalias } = parsearRespuestas(texto);
      if (anomalias.length > 0) {
        console.warn("Anomalías al parsear la ficha en /api/chat:", anomalias);
      }
      // El coste de la entrevista se aproxima con el uso del último turno (el que cierra). La
      // acumulación turno a turno es un refinamiento de Fase 2 (docs/business.md §7).
      await persistirRespuestas(supabase, {
        encuestaId: encuesta.id,
        respuestas,
        costeEntrevista: {
          input_tokens: respuesta.usage.input_tokens,
          output_tokens: respuesta.usage.output_tokens,
          cache_read_input_tokens: respuesta.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: respuesta.usage.cache_creation_input_tokens ?? 0,
        },
      });

      return NextResponse.json({
        fin_entrevista: true,
        message: { role: "assistant", content: MENSAJE_CIERRE },
      });
    }

    return NextResponse.json({ message: { role: "assistant", content: texto } });
  } catch (error) {
    console.error("Error procesando el turno en /api/chat:", error);
    return NextResponse.json(
      { error: "No se pudo procesar el mensaje. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}

function validarMensajes(valor: unknown): MensajeChat[] | null {
  if (!Array.isArray(valor)) return null;
  const validos = valor.every(
    (m): m is MensajeChat =>
      typeof m === "object" &&
      m !== null &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );
  return validos ? (valor as MensajeChat[]) : null;
}
