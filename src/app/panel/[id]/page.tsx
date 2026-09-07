import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownLite } from "@/components/chat/markdown-lite";
import { RespuestasDetalle } from "@/components/panel/respuestas-detalle";
import type { RespuestasEncuesta } from "@/lib/rubrica";
import { clienteServidor, requerirConsultor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

type Nivel = "sin_preparar" | "inicial" | "en_desarrollo" | "consolidada";
const NIVEL: Record<Nivel, string> = {
  sin_preparar: "Punto de partida",
  inicial: "Inicial",
  en_desarrollo: "En desarrollo",
  consolidada: "Consolidada",
};

interface CasoUso {
  nombre: string;
  descripcion: string;
  impacto: number;
  viabilidad: number;
  puntuacion: number;
  justificacion: string;
}

function primer<T>(x: T[] | T | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function DetalleEncuesta({ params }: { params: Promise<{ id: string }> }) {
  await requerirConsultor();
  const { id } = await params;
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("encuestas")
    .select(
      `id, estado, iniciada_en, finalizada_en,
       contacto:contactos(nombre, empresa, email, telefono),
       respuesta:respuestas(contenido, coste_ia,
         resultado:resultados_rubrica(nivel_preparacion, completo, datos_faltantes, casos_uso, version_rubrica,
           diagnostico:diagnosticos(markdown, nota_alcance, generado_en)))`,
    )
    .eq("id", id)
    .in("estado", ["completada", "respondida"])
    .maybeSingle();

  if (!data) notFound();

  const contacto = primer(data.contacto as unknown[]) as
    | { nombre: string; empresa: string; email: string; telefono: string }
    | null;
  const respuesta = primer(data.respuesta as unknown[]) as
    | { contenido: RespuestasEncuesta; coste_ia: unknown; resultado: unknown }
    | null;
  const resultado = primer(respuesta?.resultado as unknown[]) as
    | {
        nivel_preparacion: Nivel;
        completo: boolean;
        datos_faltantes: { campo: string; paraQue: string }[];
        casos_uso: CasoUso[];
        version_rubrica: string;
        diagnostico: unknown;
      }
    | null;
  const diagnostico = primer(resultado?.diagnostico as unknown[]) as
    | { markdown: string; nota_alcance: string; generado_en: string }
    | null;

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-4 py-8 sm:px-6">
      <Link href="/panel" className="text-sm text-primary hover:underline">
        ← Encuestas
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary">
          {contacto?.empresa ?? "Encuesta sin contacto"}
        </h1>
        <p className="text-sm text-text-secondary tabular-figures">
          {new Date(data.iniciada_en).toLocaleString("es-ES")}
          {data.estado === "respondida" && " · sin contacto (no completada)"}
        </p>
      </header>

      {contacto && (
        <section className="mb-6 rounded-2xl border border-surface bg-surface/50 p-4 text-sm">
          <h2 className="mb-2 font-display font-semibold">Contacto</h2>
          <p>{contacto.nombre}</p>
          <p className="text-text-secondary">{contacto.email} · {contacto.telefono}</p>
        </section>
      )}

      {resultado && (
        <section className="mb-6 rounded-2xl border-l-4 border-primary bg-surface px-4 py-3 text-sm">
          <p>
            <strong>{NIVEL[resultado.nivel_preparacion] ?? resultado.nivel_preparacion}</strong>
            {!resultado.completo && <span className="text-text-secondary"> · análisis incompleto</span>}
            <span className="text-text-secondary"> · rúbrica {resultado.version_rubrica}</span>
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {resultado.casos_uso.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.nombre}</span>{" "}
                <span className="text-text-secondary tabular-figures">
                  (impacto {c.impacto}/5 · viabilidad {c.viabilidad}/5)
                </span>
                <br />
                <span className="text-text-secondary">{c.justificacion}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <h2 className="mb-2 font-display text-lg font-semibold">Respuestas</h2>
      {respuesta ? (
        <RespuestasDetalle contenido={respuesta.contenido} />
      ) : (
        <p className="text-sm text-text-secondary">No hay respuestas guardadas.</p>
      )}

      {diagnostico && (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-lg font-semibold">Diagnóstico mostrado al visitante</h2>
          <div className="rounded-2xl border border-surface p-4">
            <MarkdownLite texto={diagnostico.markdown} />
            <p className="mt-3 text-xs text-text-secondary">{diagnostico.nota_alcance}</p>
          </div>
        </section>
      )}
    </main>
  );
}
