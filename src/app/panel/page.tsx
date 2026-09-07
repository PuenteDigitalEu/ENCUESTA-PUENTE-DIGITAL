import Link from "next/link";

import { clienteServidor, requerirConsultor } from "@/lib/supabase/servidor";
import { CerrarSesion } from "./cerrar-sesion";

export const metadata = { title: "Panel · Encuestas" };
export const dynamic = "force-dynamic";

type Nivel = "sin_preparar" | "inicial" | "en_desarrollo" | "consolidada";

const NIVEL_ETIQUETA: Record<Nivel, string> = {
  sin_preparar: "Punto de partida",
  inicial: "Inicial",
  en_desarrollo: "En desarrollo",
  consolidada: "Consolidada",
};

interface Fila {
  id: string;
  estado: string;
  iniciada_en: string;
  contacto: { nombre: string; empresa: string } | null;
  respuesta: { resultado: { nivel_preparacion: Nivel; casos_uso: unknown[] }[] | null }[] | null;
}

function primer<T>(x: T[] | T | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default async function PanelPage() {
  const consultor = await requerirConsultor();
  const supabase = await clienteServidor();

  const { data, error } = await supabase
    .from("encuestas")
    .select(
      "id, estado, iniciada_en, contacto:contactos(nombre, empresa), respuesta:respuestas(resultado:resultados_rubrica(nivel_preparacion, casos_uso))",
    )
    .in("estado", ["completada", "respondida"])
    .order("iniciada_en", { ascending: false });

  const filas = (data ?? []) as unknown as Fila[];

  return (
    <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-text-primary">Encuestas</h1>
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span>{consultor.nombre}</span>
          <CerrarSesion />
        </div>
      </div>

      {error && <p className="text-sm text-error">No se pudieron cargar las encuestas.</p>}

      {filas.length === 0 && !error && (
        <p className="py-16 text-center text-text-secondary">Todavía no hay encuestas completadas.</p>
      )}

      {filas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Empresa</th>
                <th className="py-2 pr-4 font-medium">Contacto</th>
                <th className="py-2 pr-4 font-medium">Nivel</th>
                <th className="py-2 pr-4 font-medium">Casos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const resultado = primer(primer(f.respuesta)?.resultado);
                return (
                  <tr key={f.id} className="border-b border-surface/60 hover:bg-surface/50">
                    <td className="py-2 pr-4 tabular-figures">
                      <Link href={`/panel/${f.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        {new Date(f.iniciada_en).toLocaleDateString("es-ES")}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={`/panel/${f.id}`} className="block">
                        {f.contacto?.empresa ?? <span className="text-text-secondary">sin contacto</span>}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{f.contacto?.nombre ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {resultado ? NIVEL_ETIQUETA[resultado.nivel_preparacion] ?? resultado.nivel_preparacion : "—"}
                    </td>
                    <td className="py-2 pr-4 tabular-figures">{resultado?.casos_uso?.length ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
