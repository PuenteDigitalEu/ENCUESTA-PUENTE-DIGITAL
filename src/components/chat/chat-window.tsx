"use client";

import { useEffect, useRef, useState } from "react";

import { ChatBubble } from "./chat-bubble";
import { ConsentScreen } from "./consent-screen";
import { DisclosureBanner } from "./disclosure-banner";
import { FormularioContacto, type Contacto } from "./formulario-contacto";
import { Diagnostico, type DatosDiagnostico } from "./diagnostico";
import { conRespuesta, mensajesParaApi, type Mensaje } from "./historial";

type Fase = "entrevista" | "contacto" | "diagnostico";

/**
 * M-02 + M-08: entrevista guiada por chat detrás del consentimiento, y al terminar un formulario
 * de contacto obligatorio antes de mostrar el diagnóstico. Sin estado en el servidor más allá del
 * `token`; el historial completo viaja en cada turno.
 *
 * El `token` vive solo en el estado de React: recargar la página pierde el hilo, a propósito
 * (reanudar una encuesta a medias es `S-01`, fuera del MVP).
 */
export function ChatWindow() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("entrevista");
  const [diagnostico, setDiagnostico] = useState<DatosDiagnostico | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: reduceMotion.current ? "auto" : "smooth",
    });
  }, [mensajes, cargando, fase]);

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
      if (!respuesta.ok) throw new Error(datos.error ?? "Algo ha ido mal.");

      setMensajes(conRespuesta(historialVisible, datos.message));
      if (datos.fin_entrevista) setFase("contacto");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha ido mal. Recarga e inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function aceptarConsentimiento() {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/conversacion", { method: "POST" });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo iniciar la encuesta.");
      setToken(datos.token as string);
      void enviarTurno(datos.token as string, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha ido mal. Recarga e inténtalo de nuevo.");
      setCargando(false);
    }
  }

  async function enviarCierre(contacto: Contacto) {
    if (!token) return;
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, contacto }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error ?? "No se pudo generar el diagnóstico.");
      setDiagnostico(datos.diagnostico as DatosDiagnostico);
      setFase("diagnostico");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo ha ido mal. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  function handleEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    const texto = entrada.trim();
    if (!texto || cargando || !token) return;
    const historialVisible = [...mensajes, { role: "user", content: texto } as Mensaje];
    setMensajes(historialVisible);
    setEntrada("");
    void enviarTurno(token, historialVisible);
  }

  if (!token) {
    return (
      <ConsentScreen onAceptar={() => void aceptarConsentimiento()} cargando={cargando} error={error} />
    );
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
        {cargando && fase === "entrevista" && (
          <p className="text-sm text-text-secondary">Escribiendo…</p>
        )}

        {fase === "contacto" && (
          <FormularioContacto onEnviar={enviarCierre} cargando={cargando} />
        )}
        {fase === "diagnostico" && diagnostico && <Diagnostico datos={diagnostico} />}

        {error && <p className="text-sm text-error">{error}</p>}
      </div>

      {fase === "entrevista" && (
        <form onSubmit={handleEnviar} className="flex gap-2 border-t border-surface p-4">
          <label htmlFor="respuesta" className="sr-only">
            Tu respuesta
          </label>
          <input
            id="respuesta"
            value={entrada}
            onChange={(evento) => setEntrada(evento.target.value)}
            disabled={cargando}
            placeholder="Escribe tu respuesta…"
            className="flex-1 rounded-lg border border-surface px-4 py-2 text-[15px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <button
            type="submit"
            disabled={cargando || !entrada.trim()}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-colors disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
