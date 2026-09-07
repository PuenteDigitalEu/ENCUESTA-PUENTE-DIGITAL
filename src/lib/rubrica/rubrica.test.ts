import { describe, expect, it } from "vitest";

import { calcularRubrica, VERSION_RUBRICA } from "./rubrica";
import type { Dato, RespuestasEncuesta } from "./tipos";

const d = <T>(valor: T | null, etiqueta: Dato<T>["etiqueta"] = "confirmado"): Dato<T> => ({ valor, etiqueta });
const pend = <T>(): Dato<T> => ({ valor: null, etiqueta: "pendiente" });

/** Negocio poco digitalizado con procesos claros — nivel esperado bajo. */
function bajo(): RespuestasEncuesta {
  return {
    sector: d("taller"),
    tamanoRango: d("1-9"),
    estacionalidad: d("no"),
    estacionalidadDetalle: pend(),
    procesos: [
      { nombre: d("hacer presupuestos"), tiempoAprox: d("varias veces al día"), dolor: d("repetir datos a mano") },
      { nombre: d("facturación"), tiempoAprox: d("un día al mes"), dolor: d("cuadrar albaranes") },
    ],
    procesoMasCostoso: d("presupuestos"),
    procesosConErrores: pend(),
    tareas: [{ descripcion: d("pasar datos al excel"), frecuencia: d("varias veces al día"), volumen: pend() }],
    trabajoConDatos: d("un excel con clientes"),
    cuelloBotellaPersonas: d("si"),
    cuelloBotellaDetalle: d("solo el jefe"),
    herramientas: [{ nombre: d("excel"), paraQue: d("clientes") }],
    integracionActual: d("ninguna"),
    procesosEnPapel: d("partes"),
    usoNube: d("no"),
    madurezDigital: d("baja"),
    intentosPrevios: pend(),
    referenteInterno: d("no"),
    datosSensibles: d("no"),
    datosSensiblesTipo: pend(),
    requisitosCumplimiento: pend(),
    restriccionesDatos: pend(),
    presupuestoRango: d("1k-5k"),
    apetito: d("medio"),
    modeloPreferido: d("sin_definir"),
    decisionQuien: d("yo"),
    responsableImplantacion: d("el jefe"),
  };
}

/** Mismo negocio pero digitalizado y con equipo maduro — nivel esperado alto. */
function alto(): RespuestasEncuesta {
  return {
    ...bajo(),
    integracionActual: d("alta"),
    usoNube: d("si"),
    madurezDigital: d("alta"),
    referenteInterno: d("si"),
  };
}

describe("calcularRubrica", () => {
  it("es determinista: misma entrada, misma salida", () => {
    const a = calcularRubrica(bajo());
    const b = calcularRubrica(bajo());
    expect(a).toEqual(b);
    expect(a.versionRubrica).toBe(VERSION_RUBRICA);
  });

  it("más digitalización y madurez ⇒ mayor nivel y mayor score", () => {
    const b = calcularRubrica(bajo());
    const a = calcularRubrica(alto());
    expect(a.preparacionScore).toBeGreaterThan(b.preparacionScore);
    const orden = ["sin_preparar", "inicial", "en_desarrollo", "consolidada"];
    expect(orden.indexOf(a.nivelPreparacion)).toBeGreaterThanOrEqual(orden.indexOf(b.nivelPreparacion));
  });

  it("marca completo=false y lista los campos críticos que faltan", () => {
    const r = bajo();
    r.usoNube = pend();
    r.madurezDigital = pend();
    const res = calcularRubrica(r);
    expect(res.completo).toBe(false);
    expect(res.datosFaltantes.map((x) => x.campo)).toEqual(expect.arrayContaining(["uso_nube", "madurez_digital"]));
  });

  it("sin procesos ni tareas ⇒ incompleto", () => {
    const r = bajo();
    r.procesos = [];
    r.tareas = [];
    expect(calcularRubrica(r).completo).toBe(false);
  });

  it("devuelve casos de uso ordenados por puntuación desc y con justificación", () => {
    const res = calcularRubrica(bajo());
    expect(res.casosUso.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < res.casosUso.length; i++) {
      expect(res.casosUso[i - 1].puntuacion).toBeGreaterThanOrEqual(res.casosUso[i].puntuacion);
    }
    for (const c of res.casosUso) {
      expect(c.puntuacion).toBe(c.impacto * c.viabilidad);
      expect(c.justificacion.length).toBeGreaterThan(0);
    }
  });

  it("datos sensibles ⇒ cautelaDatos y menos viabilidad en casos que sacan datos fuera", () => {
    const sin = calcularRubrica(bajo());
    const con = calcularRubrica({ ...bajo(), datosSensibles: d("si"), datosSensiblesTipo: d("datos de clientes") });
    expect(con.cautelaDatos).toBe(true);

    const buscar = (res: typeof sin, id: string) => res.casosUso.find((c) => c.id === id);
    const faqSin = buscar(sin, "atencion_faq");
    const faqCon = buscar(con, "atencion_faq");
    if (faqSin && faqCon) expect(faqCon.viabilidad).toBeLessThanOrEqual(faqSin.viabilidad);
  });
});
