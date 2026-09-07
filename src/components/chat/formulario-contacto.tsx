"use client";

import { useState } from "react";

export interface Contacto {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
}

interface Props {
  onEnviar: (contacto: Contacto) => void;
  cargando: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAMPOS: { clave: keyof Contacto; etiqueta: string; tipo: string; autoComplete: string }[] = [
  { clave: "nombre", etiqueta: "Tu nombre", tipo: "text", autoComplete: "name" },
  { clave: "empresa", etiqueta: "Nombre de la empresa", tipo: "text", autoComplete: "organization" },
  { clave: "email", etiqueta: "Email", tipo: "email", autoComplete: "email" },
  { clave: "telefono", etiqueta: "Teléfono", tipo: "tel", autoComplete: "tel" },
];

/**
 * M-08: los cuatro campos son obligatorios; el diagnóstico no se muestra hasta que están todos y
 * el email tiene formato válido. La validación también corre en el servidor (`/api/cierre`).
 */
export function FormularioContacto({ onEnviar, cargando }: Props) {
  const [valores, setValores] = useState<Contacto>({ nombre: "", email: "", telefono: "", empresa: "" });
  const [tocado, setTocado] = useState(false);

  const faltan = CAMPOS.some(({ clave }) => valores[clave].trim() === "");
  const emailMal = valores.email.trim() !== "" && !EMAIL_RE.test(valores.email.trim());
  const invalido = faltan || emailMal;

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setTocado(true);
    if (invalido || cargando) return;
    onEnviar({
      nombre: valores.nombre.trim(),
      email: valores.email.trim(),
      telefono: valores.telefono.trim(),
      empresa: valores.empresa.trim(),
    });
  }

  return (
    <form
      onSubmit={enviar}
      className="rounded-2xl border border-surface bg-surface/60 p-5 text-left"
    >
      <h2 className="mb-1 font-display text-base font-semibold text-text-primary">
        Ya casi está
      </h2>
      <p className="mb-4 text-sm text-text-secondary">
        Déjame estos datos y te enseño el diagnóstico aquí mismo.
      </p>

      <div className="flex flex-col gap-3">
        {CAMPOS.map(({ clave, etiqueta, tipo, autoComplete }) => (
          <div key={clave} className="flex flex-col gap-1">
            <label htmlFor={`c-${clave}`} className="text-sm font-medium text-text-primary">
              {etiqueta}
            </label>
            <input
              id={`c-${clave}`}
              type={tipo}
              autoComplete={autoComplete}
              value={valores[clave]}
              onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))}
              disabled={cargando}
              className="rounded-lg border border-surface bg-background px-3 py-2 text-[15px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        ))}
      </div>

      {tocado && faltan && (
        <p className="mt-2 text-sm text-error">Rellena los cuatro campos.</p>
      )}
      {tocado && !faltan && emailMal && (
        <p className="mt-2 text-sm text-error">El email no tiene un formato válido.</p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="mt-4 w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {cargando ? "Preparando tu diagnóstico…" : "Ver mi diagnóstico"}
      </button>
    </form>
  );
}
