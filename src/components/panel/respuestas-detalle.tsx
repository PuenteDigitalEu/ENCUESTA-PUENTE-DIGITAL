import type { Dato, RespuestasEncuesta } from "@/lib/rubrica";

/** Muestra las respuestas de la encuesta agrupadas por los 8 bloques del guion (S-02). */

function val<T>(d: Dato<T> | undefined): string {
  if (!d || d.valor === null || d.etiqueta === "pendiente") return "—";
  const texto = String(d.valor);
  return d.etiqueta === "estimado" ? `${texto} (estimado)` : texto;
}

function Campo({ etiqueta, dato }: { etiqueta: string; dato: Dato<unknown> | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <dt className="text-xs text-text-secondary">{etiqueta}</dt>
      <dd className="text-sm text-text-primary">{val(dato)}</dd>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-surface py-3">
      <h3 className="mb-1 font-display text-sm font-semibold text-text-primary">{titulo}</h3>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function RespuestasDetalle({ contenido }: { contenido: RespuestasEncuesta }) {
  const c = contenido;
  return (
    <div>
      <Bloque titulo="1 · Tamaño y sector">
        <Campo etiqueta="Sector" dato={c.sector} />
        <Campo etiqueta="Tamaño" dato={c.tamanoRango} />
        <Campo etiqueta="Estacionalidad" dato={c.estacionalidad} />
        <Campo etiqueta="Detalle" dato={c.estacionalidadDetalle} />
      </Bloque>

      <Bloque titulo="2 · Procesos actuales">
        {c.procesos.length === 0 && <Campo etiqueta="Procesos" dato={undefined} />}
        {c.procesos.map((p, i) => (
          <div key={i} className="col-span-full rounded-lg bg-surface/60 p-2">
            <p className="text-sm font-medium">{val(p.nombre)}</p>
            <p className="text-xs text-text-secondary">{val(p.tiempoAprox)} · {val(p.dolor)}</p>
          </div>
        ))}
        <Campo etiqueta="El más costoso" dato={c.procesoMasCostoso} />
        <Campo etiqueta="Con errores" dato={c.procesosConErrores} />
      </Bloque>

      <Bloque titulo="3 · Tareas repetitivas y datos">
        {c.tareas.map((t, i) => (
          <div key={i} className="col-span-full rounded-lg bg-surface/60 p-2">
            <p className="text-sm font-medium">{val(t.descripcion)}</p>
            <p className="text-xs text-text-secondary">{val(t.frecuencia)} · {val(t.volumen)}</p>
          </div>
        ))}
        <Campo etiqueta="Trabajo con datos" dato={c.trabajoConDatos} />
        <Campo etiqueta="Cuello de botella (personas)" dato={c.cuelloBotellaPersonas} />
        <Campo etiqueta="Detalle" dato={c.cuelloBotellaDetalle} />
      </Bloque>

      <Bloque titulo="4 · Herramientas y sistemas">
        {c.herramientas.map((h, i) => (
          <div key={i} className="col-span-full text-sm">
            <span className="font-medium">{val(h.nombre)}</span>
            <span className="text-text-secondary"> — {val(h.paraQue)}</span>
          </div>
        ))}
        <Campo etiqueta="Integración actual" dato={c.integracionActual} />
        <Campo etiqueta="En papel" dato={c.procesosEnPapel} />
        <Campo etiqueta="Uso de nube" dato={c.usoNube} />
      </Bloque>

      <Bloque titulo="5 · Madurez digital del equipo">
        <Campo etiqueta="Madurez" dato={c.madurezDigital} />
        <Campo etiqueta="Intentos previos" dato={c.intentosPrevios} />
        <Campo etiqueta="Referente interno" dato={c.referenteInterno} />
      </Bloque>

      <Bloque titulo="6 · Sensibilidad de datos y cumplimiento">
        <Campo etiqueta="Datos sensibles" dato={c.datosSensibles} />
        <Campo etiqueta="Tipo" dato={c.datosSensiblesTipo} />
        <Campo etiqueta="Requisitos de cumplimiento" dato={c.requisitosCumplimiento} />
        <Campo etiqueta="Restricciones" dato={c.restriccionesDatos} />
      </Bloque>

      <Bloque titulo="7 · Presupuesto y disposición">
        <Campo etiqueta="Presupuesto" dato={c.presupuestoRango} />
        <Campo etiqueta="Apetito" dato={c.apetito} />
        <Campo etiqueta="Modelo preferido" dato={c.modeloPreferido} />
      </Bloque>

      <Bloque titulo="8 · Quién decide">
        <Campo etiqueta="Decisor" dato={c.decisionQuien} />
        <Campo etiqueta="Responsable de implantación" dato={c.responsableImplantacion} />
      </Bloque>
    </div>
  );
}
