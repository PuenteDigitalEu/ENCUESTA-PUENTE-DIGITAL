import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { clienteClaude, MODELO_ENTREVISTA } from "@/lib/claude/client";
import { generarPlan } from "@/lib/claude/plan";
import { cargarSystemPromptEntrevista } from "@/lib/claude/system-prompt";
import { enviarAvisoAsesor } from "@/lib/email/aviso-asesor";
import { hashIp, obtenerIpVisitante, UMBRAL_ENVIAR_MENSAJE, VENTANA_HORAS } from "@/lib/ip";
import type { Ficha } from "@/lib/motor/ficha";
import type { Informe } from "@/lib/motor/informe";
import { calcularInforme } from "@/lib/motor/informe";
import { contieneFicha, parsearFicha } from "@/lib/motor/parseo";
import { clienteSupabase } from "@/lib/supabase/server";
import {
  comprobarLimiteUso,
  incrementarTurno,
  persistirCierre,
  registrarNotificacionAsesor,
  validarToken,
  type ResultadoCierre,
} from "@/lib/supabase/persistencia";
import type { SupabaseClient } from "@supabase/supabase-js";

// fs.readFileSync (en system-prompt.ts) necesita el runtime de Node, no Edge.
export const runtime = "nodejs";

interface MensajeChat {
  role: "user" | "assistant";
  content: string;
}

/**
 * Tope duro de turnos, muy por encima del ~15 que pide `plantilla-entrevista.md` — es una red de
 * seguridad del servidor (evita una conversación descontrolada), no el límite de uso por IP
 * (`docs/architecture.md` → "Protección contra abuso", `docs/features/limite-de-uso.md`), que
 * limita cuántos turnos procesa una misma IP, no cuántos tiene una conversación concreta.
 */
const MAX_MENSAJES = 40;

/**
 * Fases 1-4 del flujo, en un turno: entrevista (`instrucciones-sistema.md`) y, al cerrar,
 * diagnóstico y plan (`instrucciones-motor.md`).
 *
 * `token` es obligatorio (M-06): lo crea `POST /api/conversacion` al aceptar el consentimiento, y
 * es lo único que autoriza a esta ruta a procesar un turno de esa conversación concreta — sin
 * token válido, 401 con mensaje genérico (nunca detalle técnico, ver `FLOW-01` → "Casos de
 * error"). El resto del historial sigue viajando completo en cada turno (sin estado adicional en
 * el servidor más allá de lo que ya vive en `conversaciones`).
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

  let conversacion;
  try {
    conversacion = await validarToken(supabase, body.token);
  } catch (error) {
    console.error("Error validando el token en /api/chat:", error);
    return NextResponse.json({ error: "No se pudo procesar el mensaje. Inténtalo de nuevo." }, { status: 502 });
  }
  if (!conversacion) {
    // Mensaje genérico a propósito: no revela si el token no existe, ya expiró, o la conversación
    // ya se cerró — el visitante no necesita saber cuál de las tres es (FLOW-01 → "Casos de error").
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
      // Sin razonamiento extendido: conducir un turno de entrevista no lo necesita, y consume el
      // mismo presupuesto de max_tokens que la respuesta visible (ver la misma nota en
      // lib/claude/plan.ts, donde este límite sí llegó a vaciar la respuesta real).
      thinking: { type: "disabled" },
      system: cargarSystemPromptEntrevista(),
      messages: mensajes,
    });

    const texto = respuesta.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n");

    await incrementarTurno(supabase, conversacion.id, conversacion.turnosTotales);

    // Fase 2 → Fase 3-4: cuando el mensaje del agente trae la ficha de cierre, no se le enseña el
    // volcado en crudo al visitante — se calcula el informe (determinista, lib/motor/), se
    // persiste el cierre completo (M-04) y se sustituye por el plan ya redactado (§8 de
    // instrucciones-motor.md).
    if (contieneFicha(texto)) {
      const { ficha, anomalias } = parsearFicha(texto);
      if (anomalias.length > 0) {
        console.warn("Anomalías al parsear la ficha en /api/chat:", anomalias);
      }

      const informe = calcularInforme(ficha);
      const plan = await generarPlan(ficha, informe);

      // Si la persistencia falla, no se le muestra el plan al visitante (aunque ya esté
      // calculado): un diagnóstico que nunca se guardó no se puede auditar después ni consultar
      // desde el panel del asesor — mejor un error claro que invite a reintentar (FLOW-01).
      const resultado = await persistirCierre(supabase, {
        conversacionId: conversacion.id,
        ficha,
        informe,
        planMarkdown: plan,
      });

      // M-05/FLOW-02: el aviso al asesor nunca bloquea la respuesta al visitante — su plan ya está
      // calculado y persistido de forma independiente. Un fallo de envío se registra como
      // `fallido`, no se reintenta aquí ni impide que el visitante vea su diagnóstico.
      await avisarAsesorSinBloquear(supabase, conversacion.id, ficha, informe, plan, resultado);

      return NextResponse.json({ message: { role: "assistant", content: plan } });
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

/**
 * M-05/FLOW-02: envía el aviso al asesor y deja constancia en `notificaciones_asesor`, siempre —
 * el intento se registra tanto si Resend confirma el envío como si falla. Nunca lanza: un problema
 * aquí no debe tirar abajo el turno que ya le está devolviendo el plan al visitante.
 */
async function avisarAsesorSinBloquear(
  supabase: SupabaseClient,
  conversacionId: string,
  ficha: Ficha,
  informe: Informe,
  planMarkdown: string,
  resultado: ResultadoCierre,
): Promise<void> {
  const destinatario = process.env.ADVISOR_NOTIFICATION_EMAIL;
  if (!destinatario) {
    console.warn("ADVISOR_NOTIFICATION_EMAIL no está configurada — no se envía aviso al asesor.");
    return;
  }

  let exito = true;
  try {
    await enviarAvisoAsesor(destinatario, {
      nombreCliente: ficha.nombre.valor,
      emailCliente: ficha.email.valor,
      modo: informe.modo,
      fichaId: resultado.fichaId,
      informeId: resultado.informeId,
      planMarkdown,
    });
  } catch (error) {
    exito = false;
    console.error("Error enviando el aviso al asesor:", error);
  }

  try {
    await registrarNotificacionAsesor(supabase, { conversacionId, destinatario, exito });
  } catch (error) {
    console.error("Error registrando la notificación al asesor:", error);
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
