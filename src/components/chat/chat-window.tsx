"use client";

import { useEffect, useState } from "react";

import { ChatBubble } from "./chat-bubble";
import { ConsentScreen } from "./consent-screen";
import { DisclosureBanner } from "./disclosure-banner";
import { conRespuesta, mensajesParaApi, type Mensaje } from "./historial";

/**
 * M-02 + M-06: entrevista guiada por chat, detrás del consentimiento de tratamiento de datos.
 * Sin estado adicional en el cliente más allá del `token` de sesión (ver
 * src/app/api/chat/route.ts) — el historial completo de mensajes sigue viviendo aquí y se manda
 * entero en cada turno; lo único que cambia es que ahora cada turno viaja con el `token` que
 * autoriza al servidor a escribir en esa conversación concreta.
 *
 * El `token` vive solo en este estado de React, nunca en `localStorage` (ver
 * docs/features/consentimiento-y-persistencia.md → "Decisiones tomadas"): recargar la página
 * pierde el hilo, a propósito — no hay forma de recuperar una conversación anterior en esta
 * versión (`C-01` queda fuera del MVP).
 */
export function ChatWindow() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Cada mensaje nuevo (o el indicador de "Escribiendo…") empuja el scroll hacia abajo — si no,
  // la respuesta más reciente puede quedar fuera de la vista, especialmente en pantallas pequeñas
  // o cuando la conversación ya lleva varias preguntas.
  //
  // Se desplaza la PÁGINA entera (window.scrollTo), no un punto dentro del área de mensajes: un
  // intento anterior usaba scrollIntoView sobre un centinela colocado ANTES del formulario de
  // respuesta — llevaba la última pregunta a la vista, pero el cuadro de texto (que viene después,
  // fuera de esa zona) se quedaba igualmente cortado. Desplazando la página entera hasta su final
  // de verdad, el cuadro de texto (lo último del DOM) siempre queda visible.
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [mensajes, cargando]);

  /**
   * `historialVisible` es exactamente lo que ya está (o va a estar) en pantalla — nunca incluye el
   * "Hola" sintético del arranque, que se antepone aquí mismo solo para lo que se manda al
   * servidor. Al terminar, la respuesta se añade SOBRE ese mismo historial (nunca lo sustituye):
   * sustituirlo en vez de acumularlo era el bug real — a partir del tercer turno, el servidor
   * dejaba de recibir el nombre/email dados en el bloque 0 y Claude, sin ese contexto, volvía a
   * preguntarlo desde el principio (ver changelog).
   */
  async function enviarTurno(tokenActivo: string, historialVisible: Mensaje[]) {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenActivo, messages: mensajesParaApi(historialVisible) }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error ?? "Algo ha ido mal.");
      }
      setMensajes(conRespuesta(historialVisible, datos.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha ido mal. Recarga e inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  /**
   * M-06: al aceptar, crea la conversación (consentimiento + token) y arranca la entrevista con
   * ese mismo token. Sin este paso no existe ninguna fila en `conversaciones` — ver
   * `docs/user-flows.md` → FLOW-01.
   */
  async function aceptarConsentimiento() {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/conversacion", { method: "POST" });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error ?? "No se pudo iniciar la conversación.");
      }
      setToken(datos.token as string);
      void enviarTurno(datos.token as string, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha ido mal. Recarga e inténtalo de nuevo.");
      setCargando(false);
    }
  }

  function handleEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    const texto = entrada.trim();
    if (!texto || cargando || !token) return;
    const nuevoMensaje: Mensaje = { role: "user", content: texto };
    const historialVisible = [...mensajes, nuevoMensaje];
    setMensajes(historialVisible);
    setEntrada("");
    void enviarTurno(token, historialVisible);
  }

  if (!token) {
    return <ConsentScreen onAceptar={() => void aceptarConsentimiento()} cargando={cargando} error={error} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        <DisclosureBanner />
        {mensajes.map((mensaje, indice) => (
          <ChatBubble
            key={indice}
            sender={mensaje.role === "assistant" ? "agent" : "visitor"}
            content={mensaje.content}
          />
        ))}
        {cargando && <p className="text-sm text-text-secondary">Escribiendo…</p>}
        {error && <p className="text-sm text-error">{error}</p>}
      </div>

      <form onSubmit={handleEnviar} className="flex gap-2 border-t border-surface p-4">
        <input
          value={entrada}
          onChange={(evento) => setEntrada(evento.target.value)}
          disabled={cargando}
          placeholder="Escribe tu respuesta…"
          className="flex-1 rounded-lg border border-surface px-4 py-2 text-[15px] focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={cargando || !entrada.trim()}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
