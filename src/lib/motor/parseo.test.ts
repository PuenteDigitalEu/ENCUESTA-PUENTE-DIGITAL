import { describe, expect, it } from 'vitest';

import { contieneFicha, parsearFicha } from './parseo';

const FICHA_COMPLETA = `
nombre: Silvia [confirmado]
email: silvia@example.com [confirmado]
fecha_entrevista: 2026-08-25

ingresos_netos_mensual: 2800 [confirmado]
ingresos_estabilidad: estable [confirmado]
gastos_fijos_mensual: 2000 [confirmado]

deudas_numero: 1
deuda_1_tipo: hipoteca [confirmado]
deuda_1_importe: no_facilitado [pendiente]
deuda_1_cuota: 620 [confirmado]
deuda_1_interes: 1.9 [confirmado]
deudas_interes_alto_declarado: no_facilitado [pendiente]

patrimonio_liquido: 12000 [confirmado]
patrimonio_invertido: 10000 [confirmado]
patrimonio_distribucion: todo en un fondo indexado [confirmado]
aportacion_mensual_actual: 150 [confirmado]

colchon_meses: 5 [confirmado]

objetivo_proposito: bajar el ritmo a los 60 [confirmado]
objetivo_importe: 150000 [confirmado]
objetivo_plazo_anios: 20 [confirmado]

riesgo_tolerancia_declarada: media [confirmado]
riesgo_comportamiento_real: aguantó la caída del covid sin vender [confirmado]
riesgo_perfil_derivado: moderado [confirmado]

edad: 40 [confirmado]
personas_a_cargo: 0 [confirmado]
situacion_laboral: diseñadora gráfica en plantilla [confirmado]
`;

describe('contieneFicha', () => {
  it('reconoce un mensaje que trae la ficha completa', () => {
    expect(contieneFicha(FICHA_COMPLETA)).toBe(true);
  });

  it('no confunde una pregunta normal de la entrevista con la ficha', () => {
    expect(contieneFicha('¿Cuánto ingresas al mes, en neto?')).toBe(false);
  });

  it('NO dispara con un resumen intermedio que menciona dos claves sueltas (regresión)', () => {
    const resumenParcial = [
      'Voy anotando: fecha_entrevista: 2026-09-02',
      'ingresos_netos_mensual: 2000 — nómina fija',
      'Seguimos con los gastos, ¿cuánto te dejas al mes?',
    ].join('\n');
    expect(contieneFicha(resumenParcial)).toBe(false);
  });

  it('NO dispara con una recapitulación de los primeros bloques, sin los finales', () => {
    const hastaObjetivo = [
      'nombre: Prueba [confirmado]',
      'email: prueba@example.com [confirmado]',
      'fecha_entrevista: 2026-09-02',
      'ingresos_netos_mensual: 2800 [confirmado]',
      'ingresos_estabilidad: estable [confirmado]',
      'gastos_fijos_mensual: 1500 [confirmado]',
      'deudas_numero: 0',
      'patrimonio_liquido: 8000 [confirmado]',
      'patrimonio_invertido: 17000 [confirmado]',
      'aportacion_mensual_actual: 300 [confirmado]',
      'colchon_meses: 5 [confirmado]',
      'objetivo_proposito: complementar la jubilación [confirmado]',
      '¿Cómo llevarías una caída fuerte del mercado?',
    ].join('\n');
    // Le faltan las claves ancla de los bloques finales (riesgo/edad/situación).
    expect(contieneFicha(hastaObjetivo)).toBe(false);
  });
});

describe('parsearFicha', () => {
  it('parsea una ficha completa sin anomalías', () => {
    const { ficha, anomalias } = parsearFicha(FICHA_COMPLETA);
    expect(anomalias).toEqual([]);
    expect(ficha.nombre).toEqual({ valor: 'Silvia', etiqueta: 'confirmado' });
    expect(ficha.email).toEqual({ valor: 'silvia@example.com', etiqueta: 'confirmado' });
    expect(ficha.fechaEntrevista).toBe('2026-08-25');
    expect(ficha.ingresosNetosMensual).toEqual({ valor: 2800, etiqueta: 'confirmado' });
    expect(ficha.ingresosEstabilidad).toEqual({ valor: 'estable', etiqueta: 'confirmado' });
    expect(ficha.riesgoPerfilDerivado).toEqual({ valor: 'moderado', etiqueta: 'confirmado' });
  });

  it('parsea correctamente el grupo repetible de deudas, con el interés como campo propio', () => {
    const { ficha } = parsearFicha(FICHA_COMPLETA);
    expect(ficha.deudas.etiqueta).toBe('confirmado');
    expect(ficha.deudas.valor).toHaveLength(1);
    const deuda = ficha.deudas.valor![0];
    expect(deuda.tipo).toEqual({ valor: 'hipoteca', etiqueta: 'confirmado' });
    expect(deuda.importe).toEqual({ valor: null, etiqueta: 'pendiente' });
    expect(deuda.cuota).toEqual({ valor: 620, etiqueta: 'confirmado' });
    expect(deuda.interes).toEqual({ valor: 1.9, etiqueta: 'confirmado' });
  });

  it('"no_facilitado" en deudas_interes_alto_declarado se conserva como valor, no como null', () => {
    const { ficha } = parsearFicha(FICHA_COMPLETA);
    expect(ficha.deudasInteresAltoDeclarado).toEqual({
      valor: 'no_facilitado',
      etiqueta: 'pendiente',
    });
  });

  it('deudas_numero = 0 da un array vacío confirmado, no pendiente (C9)', () => {
    const texto = FICHA_COMPLETA.replace(
      /deudas_numero: 1[\s\S]*?deudas_interes_alto_declarado: no_facilitado \[pendiente\]/,
      'deudas_numero: 0\ndeudas_interes_alto_declarado: no_facilitado [pendiente]',
    );
    const { ficha } = parsearFicha(texto);
    expect(ficha.deudas).toEqual({ valor: [], etiqueta: 'confirmado' });
  });

  it('clave ausente → pendiente + anomalía, no lanza excepción (C16)', () => {
    const texto = FICHA_COMPLETA.replace('colchon_meses: 5 [confirmado]\n', '');
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.colchonMeses).toEqual({ valor: null, etiqueta: 'pendiente' });
    expect(anomalias.some((a) => a.includes('colchon_meses'))).toBe(true);
  });

  it('valor sin etiqueta reconocida → estimado + anomalía', () => {
    const texto = FICHA_COMPLETA.replace(
      'situacion_laboral: diseñadora gráfica en plantilla [confirmado]',
      'situacion_laboral: diseñadora gráfica en plantilla',
    );
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.situacionLaboral.etiqueta).toBe('estimado');
    expect(anomalias.some((a) => a.includes('situacion_laboral'))).toBe(true);
  });

  it('enum con valor no reconocido → pendiente + anomalía, no lo fuerza a un valor válido', () => {
    const texto = FICHA_COMPLETA.replace(
      'ingresos_estabilidad: estable [confirmado]',
      'ingresos_estabilidad: depende [confirmado]',
    );
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.ingresosEstabilidad).toEqual({ valor: null, etiqueta: 'pendiente' });
    expect(anomalias.some((a) => a.includes('ingresos_estabilidad'))).toBe(true);
  });

  it('número no reconocible → pendiente + anomalía', () => {
    const texto = FICHA_COMPLETA.replace(
      'ingresos_netos_mensual: 2800 [confirmado]',
      'ingresos_netos_mensual: bastante [confirmado]',
    );
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.ingresosNetosMensual).toEqual({ valor: null, etiqueta: 'pendiente' });
    expect(anomalias.some((a) => a.includes('ingresos_netos_mensual'))).toBe(true);
  });

  it('edad con decimales ("59 y medio" → 59.5) se redondea a entero + anomalía', () => {
    const texto = FICHA_COMPLETA.replace('edad: 40 [confirmado]', 'edad: 59.5 [confirmado]');
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.edad).toEqual({ valor: 60, etiqueta: 'confirmado' });
    expect(Number.isInteger(ficha.edad.valor)).toBe(true);
    expect(anomalias.some((a) => a.includes('edad') && a.includes('decimales'))).toBe(true);
  });

  it('edad y personas_a_cargo enteras se dejan tal cual, sin anomalía', () => {
    const { ficha, anomalias } = parsearFicha(FICHA_COMPLETA);
    expect(ficha.edad).toEqual({ valor: 40, etiqueta: 'confirmado' });
    expect(ficha.personasACargo).toEqual({ valor: 0, etiqueta: 'confirmado' });
    expect(anomalias.some((a) => a.includes('decimales'))).toBe(false);
  });

  it('fecha_entrevista ausente → null + anomalía (nunca se adivina la fecha)', () => {
    const texto = FICHA_COMPLETA.replace('fecha_entrevista: 2026-08-25\n', '');
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.fechaEntrevista).toBeNull();
    expect(anomalias.some((a) => a.includes('fecha_entrevista'))).toBe(true);
  });

  it('fecha_entrevista con formato inválido → null + anomalía', () => {
    const texto = FICHA_COMPLETA.replace('fecha_entrevista: 2026-08-25', 'fecha_entrevista: 25/08/2026');
    const { ficha, anomalias } = parsearFicha(texto);
    expect(ficha.fechaEntrevista).toBeNull();
    expect(anomalias.some((a) => a.includes('fecha_entrevista'))).toBe(true);
  });

  it('patrimonio_distribucion = "no aplica" se guarda como texto, no como no_facilitado', () => {
    const texto = FICHA_COMPLETA.replace(
      'patrimonio_distribucion: todo en un fondo indexado [confirmado]',
      'patrimonio_distribucion: no aplica [confirmado]',
    );
    const { ficha } = parsearFicha(texto);
    expect(ficha.patrimonioDistribucion).toEqual({ valor: 'no aplica', etiqueta: 'confirmado' });
  });
});
