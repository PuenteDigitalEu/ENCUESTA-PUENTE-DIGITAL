/**
 * Lógica de acumulación del historial del chat, separada de `ChatWindow` para poder probarla sin
 * React. Existe por un bug real (2026-08-28, ver changelog): `ChatWindow` sustituía el historial
 * visible en cada turno en vez de acumularlo — a partir del tercer turno, el servidor dejaba de
 * recibir el nombre/email dados en el bloque 0, y Claude, sin ese contexto, volvía a preguntarlo
 * desde el principio. Nunca se detectó porque ningún test (ni el manual, por curl, construyendo el
 * historial a mano) pasaba por esta lógica real del componente.
 */

export interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

/**
 * El "Hola" que dispara la apertura de la entrevista nunca se muestra como burbuja del
 * visitante (`ChatWindow` lo oculta a propósito), pero Claude sí necesita verlo delante del resto
 * para reconocer el arranque de la conversación en cada turno.
 */
const HOLA_SINTETICO: Mensaje = { role: "user", content: "Hola" };

/** Lo que se manda a `/api/chat`: el "Hola" sintético delante del historial visible completo. */
export function mensajesParaApi(historialVisible: Mensaje[]): Mensaje[] {
  return [HOLA_SINTETICO, ...historialVisible];
}

/**
 * Historial visible tras recibir la respuesta del agente — se acumula sobre lo que ya había.
 * Sustituirlo en vez de acumularlo (en vez de esto, `setMensajes(respuesta)` sin más) fue
 * exactamente el bug: cada turno perdía todo lo anterior, tanto en pantalla como en lo que se le
 * mandaba después a Claude.
 */
export function conRespuesta(historialVisible: Mensaje[], respuesta: Mensaje): Mensaje[] {
  return [...historialVisible, respuesta];
}
