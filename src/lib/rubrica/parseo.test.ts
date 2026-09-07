import { describe, expect, it } from "vitest";

import { contieneFicha, parsearRespuestas } from "./parseo";

const FICHA = `FICHA-ENCUESTA-IA

sector: taller de reparación de vehículos [confirmado]
tamano_rango: 1-9 [confirmado]
estacionalidad: si [confirmado]
estacionalidad_detalle: más carga en septiembre [estimado]

procesos_numero: 2
proceso_1_nombre: hacer presupuestos [confirmado]
proceso_1_tiempo_aprox: 6 al día [estimado]
proceso_1_dolor: repetir datos a mano [confirmado]
proceso_2_nombre: facturación [confirmado]
proceso_2_tiempo_aprox: un día al mes [confirmado]
proceso_2_dolor: cuadrar albaranes [confirmado]
proceso_mas_costoso: los presupuestos [confirmado]
procesos_con_errores: ninguno [confirmado]

tareas_numero: 1
tarea_1_descripcion: pasar partes al programa de facturación [confirmado]
tarea_1_frecuencia: varias veces al día [confirmado]
tarea_1_volumen: [pendiente]
trabajo_con_datos: un excel con matrículas [confirmado]
cuello_botella_personas: si [confirmado]
cuello_botella_detalle: solo el jefe hace pedidos [confirmado]

herramientas_numero: 1
herramienta_1_nombre: programa de facturación [confirmado]
herramienta_1_para_que: facturas [confirmado]
integracion_actual: ninguna [confirmado]
procesos_en_papel: partes de taller [confirmado]
uso_nube: no [confirmado]

madurez_digital: baja [estimado]
intentos_previos: ninguno [confirmado]
referente_interno: si [confirmado]

datos_sensibles: no [confirmado]
datos_sensibles_tipo: [pendiente]
requisitos_cumplimiento: ninguno especifico [estimado]
restricciones_datos: ninguna [confirmado]

presupuesto_rango: 1k-5k [estimado]
apetito: medio [estimado]
modelo_preferido: sin_definir [pendiente]

decision_quien: yo [confirmado]
responsable_implantacion: el jefe de taller [confirmado]`;

describe("contieneFicha", () => {
  it("detecta la ficha por la línea marcador", () => {
    expect(contieneFicha(FICHA)).toBe(true);
    expect(contieneFicha("¿A qué te dedicas?")).toBe(false);
    expect(contieneFicha("hablemos de FICHA-ENCUESTA-IA en otra frase")).toBe(false);
  });
});

describe("parsearRespuestas", () => {
  it("mapea campos, enums y grupos repetibles", () => {
    const { respuestas, anomalias } = parsearRespuestas(FICHA);
    expect(anomalias).toEqual([]);
    expect(respuestas.sector.valor).toContain("taller");
    expect(respuestas.tamanoRango.valor).toBe("1-9");
    expect(respuestas.usoNube.valor).toBe("no");
    expect(respuestas.integracionActual.valor).toBe("ninguna");
    expect(respuestas.procesos).toHaveLength(2);
    expect(respuestas.procesos[0].nombre.valor).toBe("hacer presupuestos");
    expect(respuestas.tareas).toHaveLength(1);
    expect(respuestas.herramientas).toHaveLength(1);
  });

  it("un campo [pendiente] queda con valor null", () => {
    const { respuestas } = parsearRespuestas(FICHA);
    expect(respuestas.tareas[0].volumen).toEqual({ valor: null, etiqueta: "pendiente" });
    expect(respuestas.modeloPreferido.valor).toBeNull();
  });

  it("un enum con valor fuera de la lista queda pendiente y se anota", () => {
    const mala = "FICHA-ENCUESTA-IA\ntamano_rango: enorme [confirmado]\nprocesos_numero: 0\ntareas_numero: 0\nherramientas_numero: 0";
    const { respuestas, anomalias } = parsearRespuestas(mala);
    expect(respuestas.tamanoRango.valor).toBeNull();
    expect(anomalias.join(" ")).toMatch(/tamano_rango/);
  });
});
