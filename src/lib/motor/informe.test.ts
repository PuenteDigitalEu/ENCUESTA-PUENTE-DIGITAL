import { describe, expect, it } from 'vitest';

import type { Dato, Deuda, Ficha } from './ficha';
import { calcularInforme } from './informe';

function dato<T>(valor: T): Dato<T> {
  return { valor, etiqueta: 'confirmado' };
}
function pendiente<T>(): Dato<T> {
  return { valor: null, etiqueta: 'pendiente' };
}

function deuda(parcial: Partial<{ tipo: string; importe: number; cuota: number; interes: number }>): Deuda {
  return {
    tipo: dato(parcial.tipo ?? 'préstamo personal'),
    importe: parcial.importe !== undefined ? dato(parcial.importe) : pendiente(),
    cuota: parcial.cuota !== undefined ? dato(parcial.cuota) : pendiente(),
    interes: parcial.interes !== undefined ? dato(parcial.interes) : pendiente(),
  };
}

/** Ficha base: modo completo, meta de patrimonio, flujo libre claramente positivo. */
function fichaCompleta(overrides: Partial<Ficha> = {}): Ficha {
  return {
    nombre: dato('Silvia'),
    email: dato('silvia@example.com'),
    fechaEntrevista: '2026-08-25',
    ingresosNetosMensual: dato(2800),
    ingresosEstabilidad: dato('estable'),
    gastosFijosMensual: dato(1600),
    deudas: dato([deuda({ tipo: 'hipoteca', importe: 150000, cuota: 620, interes: 1.9 })]),
    deudasInteresAltoDeclarado: dato('no'),
    patrimonioLiquido: dato(12000),
    patrimonioInvertido: dato(10000),
    patrimonioDistribucion: dato('todo en un fondo indexado'),
    aportacionMensualActual: dato(150),
    colchonMeses: dato(5),
    objetivoProposito: dato('bajar el ritmo a los 60'),
    objetivoImporte: dato(150000),
    objetivoPlazoAnios: dato(20),
    riesgoToleranciaDeclarada: dato('media'),
    riesgoComportamientoReal: dato('aguantó la caída del covid sin vender'),
    riesgoPerfilDerivado: dato('moderado'),
    edad: dato(40),
    personasACargo: dato(0),
    situacionLaboral: dato('diseñadora gráfica en plantilla'),
    ...overrides,
  };
}

describe('calcularInforme · modo completo, meta de patrimonio', () => {
  it('calcula flujo libre, propuesta ejecutable y proyección', () => {
    const informe = calcularInforme(fichaCompleta());

    expect(informe.modo).toBe('completo');
    expect(informe.tipoMeta).toBe('patrimonio');
    expect(informe.flujoLibre).toBe(2800 - 1600 - 620); // 580
    expect(informe.colchonCompleto).toBe(true); // 5 >= 3 (ingresos estables)
    expect(informe.perfil).toBe('moderado');
    expect(informe.perfilPendiente).toBe(false);

    expect(informe.aportacionPropuesta).not.toBeNull();
    expect(informe.carteraObjetivo).not.toBeNull();
    expect(informe.rentabilidadEsperadaNeta).not.toBeNull();
    expect(informe.proyeccionValorFuturo).not.toBeNull();
    expect(informe.porcentajeCaminoRecorrido).not.toBeNull();
    expect(informe.mcPercentilCentral).not.toBeNull();
    expect(informe.mcProbabilidadCumplimiento).not.toBeNull();
    expect(informe.metaViable).not.toBeNull();
  });

  it('la aportación propuesta nunca supera el tope sostenible del flujo libre', () => {
    const informe = calcularInforme(fichaCompleta());
    expect(informe.aportacionPropuesta!).toBeLessThanOrEqual(informe.flujoLibre! * 0.8 + 1e-6);
  });
});

describe('calcularInforme · C5, perfil de riesgo pendiente', () => {
  it('usa conservador por defecto y lo señala en pendientesReunion, sin bajar el modo', () => {
    const informe = calcularInforme(fichaCompleta({ riesgoPerfilDerivado: pendiente() }));
    expect(informe.modo).toBe('completo'); // riesgoPerfilDerivado no es variable crítica
    expect(informe.perfil).toBe('conservador');
    expect(informe.perfilPendiente).toBe(true);
    expect(informe.pendientesReunion.some((p) => p.includes('conservador por defecto'))).toBe(true);
    // La propuesta ejecutable se sigue calculando con normalidad.
    expect(informe.aportacionPropuesta).not.toBeNull();
  });
});

describe('calcularInforme · modo condicionado', () => {
  it('sin objetivo_importe: no hay propuesta ejecutable, pero sí flujo libre', () => {
    const informe = calcularInforme(fichaCompleta({ objetivoImporte: pendiente() }));
    expect(informe.modo).toBe('condicionado');
    expect(informe.flujoLibre).not.toBeNull();
    expect(informe.aportacionPropuesta).toBeNull();
    expect(informe.carteraObjetivo).toBeNull();
    expect(informe.proyeccionValorFuturo).toBeNull();
    expect(informe.mcPercentilCentral).toBeNull();
    expect(informe.pendientesReunion.some((p) => p.includes('objetivoImporte'))).toBe(true);
  });
});

describe('calcularInforme · modo suspendido (deudas pendiente)', () => {
  it('la negativa a hablar de deudas suspende la propuesta entera, aunque el resto esté completo', () => {
    const informe = calcularInforme(fichaCompleta({ deudas: pendiente() }));
    expect(informe.modo).toBe('suspendido');
    expect(informe.aportacionPropuesta).toBeNull();
    expect(informe.carteraObjetivo).toBeNull();
    // "Tu foto de hoy" se sigue mostrando (§8): sin cuotas de deuda que restar, pero el flujo libre
    // calculado con lo que sí se sabe.
    expect(informe.flujoLibre).toBe(2800 - 1600);
  });
});

describe('calcularInforme · R8/C10, flujo libre <= 0', () => {
  it('gasto igual a ingresos: modo de estabilización, sin cartera aunque el resto esté completo', () => {
    const informe = calcularInforme(fichaCompleta({ gastosFijosMensual: dato(2180) })); // flujo = 0
    expect(informe.modo).toBe('completo'); // los datos están completos...
    expect(informe.flujoLibre).toBe(0);
    expect(informe.aportacionPropuesta).toBeNull(); // ...pero R8 bloquea la propuesta igual
    expect(informe.carteraObjetivo).toBeNull();
    expect(informe.pendientesReunion.some((p) => p.includes('estabilización'))).toBe(true);
  });
});

describe('calcularInforme · C8, TAE de deuda pendiente', () => {
  it('señala en pendientesReunion que esa deuda no se puede priorizar como cara o barata', () => {
    const informe = calcularInforme(
      fichaCompleta({
        deudas: dato([deuda({ tipo: 'préstamo coche', importe: 8000, cuota: 200 })]), // sin interés
      }),
    );
    expect(informe.pendientesReunion.some((p) => p.includes('interés (TAE) desconocido'))).toBe(true);
  });
});

describe('calcularInforme · C15, patrimonio invertido sin distribución', () => {
  it('señala la transición pendiente cuando hay patrimonio invertido > 0 sin distribución conocida', () => {
    const informe = calcularInforme(fichaCompleta({ patrimonioDistribucion: pendiente() }));
    expect(informe.pendientesReunion.some((p) => p.includes('transición del patrimonio'))).toBe(true);
  });
});

describe('calcularInforme · R6, meta de renta_cartera', () => {
  it('convierte la renta mensual a patrimonio objetivo y sí calcula propuesta', () => {
    const informe = calcularInforme(
      fichaCompleta({
        objetivoProposito: dato('vivir de las rentas, 1500 al mes'),
        objetivoImporte: dato(1500), // renta mensual, no patrimonio total
        objetivoPlazoAnios: dato(25),
      }),
    );
    expect(informe.tipoMeta).toBe('renta_cartera');
    expect(informe.aportacionPropuesta).not.toBeNull();
    expect(informe.porcentajeCaminoRecorrido).not.toBeNull();
    expect(informe.gapEuros).not.toBeNull();
  });
});

describe('calcularInforme · renta_negocio, R6 no convierte', () => {
  it('sí propone aportación/cartera, pero sin gap ni proyección contra una cifra objetivo', () => {
    const informe = calcularInforme(
      fichaCompleta({
        objetivoProposito: dato('montar mi propio negocio'),
        situacionLaboral: dato('quiero dejar mi empleo para montar mi negocio'),
      }),
    );
    expect(informe.tipoMeta).toBe('renta_negocio');
    expect(informe.aportacionPropuesta).not.toBeNull();
    expect(informe.gapEuros).toBeNull();
    expect(informe.porcentajeCaminoRecorrido).toBeNull();
    expect(informe.mcProbabilidadCumplimiento).toBeNull(); // sin objetivo, monteCarlo no da probabilidad
    expect(informe.pendientesReunion.some((p) => p.includes('renta_negocio'))).toBe(true);
  });
});

describe('calcularInforme · R4, meta inviable', () => {
  it('objetivo alto en plazo corto pero alcanzable a más largo plazo: viable=false y dos escenarios', () => {
    const informe = calcularInforme(
      fichaCompleta({
        objetivoImporte: dato(500_000),
        objetivoPlazoAnios: dato(5),
      }),
    );
    expect(informe.metaViable).toBe(false);
    expect(informe.escenariosInviabilidad).toHaveLength(2);
    expect(informe.escenariosInviabilidad.map((e) => e.tipo)).toEqual(['plazo_mayor', 'meta_reducida']);
  });
});

describe('calcularInforme · C9, deudas_numero = 0', () => {
  it('sin deudas declaradas: flujo libre no resta cuotas, modo completo si el resto está bien', () => {
    const informe = calcularInforme(fichaCompleta({ deudas: dato([]) }));
    expect(informe.modo).toBe('completo');
    expect(informe.flujoLibre).toBe(2800 - 1600);
  });
});

describe('calcularInforme · colchón según estabilidad de ingresos (R9)', () => {
  it('ingresos variables: el umbral sube a 6 meses', () => {
    const informe = calcularInforme(
      fichaCompleta({ ingresosEstabilidad: dato('variable'), colchonMeses: dato(4) }),
    );
    expect(informe.colchonCompleto).toBe(false); // 4 < 6
  });

  it('ingresos estables: el umbral se queda en 3 meses', () => {
    const informe = calcularInforme(
      fichaCompleta({ ingresosEstabilidad: dato('estable'), colchonMeses: dato(4) }),
    );
    expect(informe.colchonCompleto).toBe(true); // 4 >= 3
  });
});
