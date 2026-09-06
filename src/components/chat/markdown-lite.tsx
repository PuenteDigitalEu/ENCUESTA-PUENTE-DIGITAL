import type { ReactNode } from "react";

/**
 * Traductor mínimo de markdown a JSX — no una librería de markdown completa. Cubre justo lo que
 * `instrucciones-motor.md` §8 le pide a Claude que use al redactar el plan (encabezados, negrita,
 * listas de viñetas, párrafos separados por línea en blanco) y nada más: `docs/data-model.md`
 * documenta que `planes.markdown` es "el mismo contenido... tal cual se renderiza en el chat", así
 * que mostrarlo como texto plano con los `#`/`**` literales visibles sería justo el bug que esto
 * evita.
 *
 * Un mensaje normal de la entrevista (prosa sin sintaxis markdown) pasa por el mismo componente:
 * al no contener ninguno de estos patrones, se renderiza igual que antes, como párrafos de texto.
 */
export function MarkdownLite({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  const bloques: ReactNode[] = [];
  let listaActual: string[] = [];

  function cerrarLista() {
    if (listaActual.length === 0) return;
    bloques.push(
      <ul key={`ul-${bloques.length}`} className="list-disc space-y-1 pl-5">
        {listaActual.map((item, i) => (
          <li key={i}>{lineaConNegrita(item, `li-${bloques.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    listaActual = [];
  }

  lineas.forEach((lineaCruda, i) => {
    const linea = lineaCruda.trim();
    if (linea === "") {
      cerrarLista();
      return;
    }

    const encabezado = linea.match(/^(#{1,3})\s+(.*)$/);
    if (encabezado) {
      cerrarLista();
      const nivel = encabezado[1].length;
      const clase =
        nivel === 1
          ? "text-lg font-bold"
          : nivel === 2
            ? "mt-3 text-base font-bold first:mt-0"
            : "mt-2 text-[15px] font-semibold first:mt-0";
      bloques.push(
        <p key={`h-${i}`} className={clase}>
          {lineaConNegrita(encabezado[2], `h-${i}`)}
        </p>,
      );
      return;
    }

    const item = linea.match(/^[-•]\s+(.*)$/);
    if (item) {
      listaActual.push(item[1]);
      return;
    }

    cerrarLista();
    bloques.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {lineaConNegrita(linea, `p-${i}`)}
      </p>,
    );
  });
  cerrarLista();

  return <div className="space-y-2 text-[15px] leading-relaxed">{bloques}</div>;
}

function lineaConNegrita(texto: string, keyPrefix: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) => {
    const negrita = parte.match(/^\*\*(.+)\*\*$/);
    return negrita ? (
      <strong key={`${keyPrefix}-${i}`}>{negrita[1]}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{parte}</span>
    );
  });
}
