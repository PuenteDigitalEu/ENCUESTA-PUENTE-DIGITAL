"use client";

import { useState } from "react";

import { MarkdownLite } from "./markdown-lite";

type Nivel = "sin_preparar" | "inicial" | "en_desarrollo" | "consolidada";

interface CasoUso {
  id: string;
  nombre: string;
  descripcion: string;
  impacto: number;
  viabilidad: number;
  puntuacion: number;
  justificacion: string;
}

export interface DatosDiagnostico {
  markdown: string;
  notaAlcance: string;
  nivelPreparacion: Nivel;
  completo: boolean;
  datosFaltantes: { campo: string; paraQue: string }[];
  casosUso: CasoUso[];
}

const NIVEL_ETIQUETA: Record<Nivel, string> = {
  sin_preparar: "Punto de partida",
  inicial: "Nivel inicial",
  en_desarrollo: "En desarrollo",
  consolidada: "Consolidada",
};

const NIVEL_COLOR: Record<Nivel, string> = {
  sin_preparar: "bg-error/15 text-error",
  inicial: "bg-warning/20 text-text-primary",
  en_desarrollo: "bg-secondary/15 text-secondary",
  consolidada: "bg-success/15 text-success",
};

export function Diagnostico({ datos }: { datos: DatosDiagnostico }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(datos.markdown);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin portapapeles: no pasa nada */
    }
  }

  return (
    <div className="rounded-2xl border-l-4 border-primary bg-surface px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 font-display text-xs font-semibold tabular-figures ${NIVEL_COLOR[datos.nivelPreparacion]}`}
        >
          {NIVEL_ETIQUETA[datos.nivelPreparacion]}
        </span>
        {!datos.completo && (
          <span className="text-xs text-text-secondary">análisis provisional</span>
        )}
      </div>

      <MarkdownLite texto={datos.markdown} />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-text-secondary">{datos.notaAlcance}</p>
        <button
          onClick={() => void copiar()}
          className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
