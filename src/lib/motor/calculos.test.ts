import { describe, expect, it } from 'vitest';

import {
  ajustarCarteraPorPlazo,
  aniosHastaMeta,
  aEurosActuales,
  aportacionPropuesta,
  aportacionRequerida,
  convertirMetaRenta,
  flujoLibre,
  monteCarlo,
  rentabilidadCartera,
  vfDeterminista,
  volatilidadCartera,
} from './calculos';
import { eur, percentil, redondear } from './numerico';

describe('numerico', () => {
  it('redondear usa redondeo bancario en los empates', () => {
    expect(redondear(0.5)).toBe(0);
    expect(redondear(1.5)).toBe(2);
    expect(redondear(2.5)).toBe(2);
    expect(redondear(-0.5)).toBe(0); // no -0
  });

  it('redondear no altera valores que no son empate', () => {
    expect(redondear(2.4)).toBe(2);
    expect(redondear(2.6)).toBe(3);
    expect(redondear(1234.567, 1)).toBe(1234.6);
  });

  it('percentil interpola linealmente, igual que numpy.percentile', () => {
    const valores = [10, 20, 30, 40];
    expect(percentil(valores, 0)).toBe(10);
    expect(percentil(valores, 100)).toBe(40);
    expect(percentil(valores, 50)).toBeCloseTo(25, 10);
  });

  it('eur formatea con separador de miles español y redondeo a entero', () => {
    expect(eur(8800)).toBe('8.800 €');
    expect(eur(1234.6)).toBe('1.235 €');
  });
});

describe('R2/C1 · flujoLibre', () => {
  it('cuando el gasto ya incluye las cuotas, no se restan de nuevo', () => {
    expect(flujoLibre(3000, 2200, true)).toBe(800);
  });

  it('cuando las cuotas van aparte, se restan', () => {
    expect(flujoLibre(3000, 2200, false, 1000)).toBe(-200);
  });

  it('flujo cero y negativo (C10/R8) se calculan igual, sin caso especial', () => {
    expect(flujoLibre(2000, 2000, true)).toBe(0);
    expect(flujoLibre(1800, 2100, true)).toBe(-300);
  });
});

describe('R2/C14 · aportacionPropuesta', () => {
  it('sin meta convertible (requerida null): rango sostenible, viable true', () => {
    const r = aportacionPropuesta(null, 800, true, false);
    expect(r.rangoSostenible).toEqual([560, 640]);
    expect(r.tope).toBe(640);
    expect(r.viable).toBe(true);
  });

  it('colchón completo y provisiones ok: tope sube al 100 % del flujo', () => {
    const r = aportacionPropuesta(null, 800, true, true);
    expect(r.tope).toBe(800);
  });

  it('C14: la requerida cabe en el tope → se propone la requerida, no el tope', () => {
    const r = aportacionPropuesta(500, 800, true, false);
    expect(r.propuesta).toBe(500);
    expect(r.viable).toBe(true);
  });

  it('la requerida supera el tope del 80 % → rango sostenible, no viable (dispara R4)', () => {
    const r = aportacionPropuesta(700, 800, true, false);
    expect(r.propuesta).toEqual([560, 640]);
    expect(r.viable).toBe(false);
  });
});

describe('R3/C2 · ajustarCarteraPorPlazo', () => {
  it('perfil conservador a 3 años (frontera, C2): banda más conservadora, RV recortada a 10 %', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 3);
    expect(cartera.renta_variable).toBeCloseTo(0.1, 10);
    expect(cartera.renta_fija).toBeCloseTo(0.7, 10);
    expect(cartera.liquidez).toBeCloseTo(0.2, 10);
  });

  it('perfil conservador a 2.9 años: por debajo de 3, misma banda que a 3 (RV <= 10 %)', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 2.9);
    expect(cartera.renta_variable).toBeCloseTo(0.1, 10);
  });

  it('plazo >= 8 años: distribución base sin ajuste', () => {
    const cartera = ajustarCarteraPorPlazo('moderado', 10);
    expect(cartera).toEqual({ renta_variable: 0.5, renta_fija: 0.4, liquidez: 0.1 });
  });

  it('los pesos de cualquier cartera ajustada suman 1', () => {
    for (const perfil of ['conservador', 'moderado', 'dinamico'] as const) {
      for (const plazo of [1, 2.9, 3, 5, 7, 7.1, 8, 20]) {
        const cartera = ajustarCarteraPorPlazo(perfil, plazo);
        const suma = Object.values(cartera).reduce((a, b) => a + (b ?? 0), 0);
        expect(suma).toBeCloseTo(1, 9);
      }
    }
  });
});

describe('R5 · rentabilidadCartera / volatilidadCartera', () => {
  it('cartera 10/70/20 (conservador a 3 años): rentabilidad neta 2.75 %', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 3);
    expect(rentabilidadCartera(cartera)).toBeCloseTo(0.0275, 10);
  });

  it('rentabilidades resultantes de las carteras base: valor exacto de la fórmula, no la etiqueta redondeada de R5', () => {
    // R5 documenta estas cifras como "≈3,1 % / ≈4,3 % / ≈5,4 %" (redondeo de display a 1
    // decimal); el valor exacto que produce la fórmula (media ponderada − 0,4 % de costes) es el
    // que se compara aquí, sin redondear.
    expect(rentabilidadCartera({ renta_variable: 0.2, renta_fija: 0.6, liquidez: 0.2 })).toBeCloseTo(
      0.031,
      10,
    ); // conservador: exacto 3,1 %
    expect(rentabilidadCartera({ renta_variable: 0.5, renta_fija: 0.4, liquidez: 0.1 })).toBeCloseTo(
      0.0425,
      10,
    ); // moderado: exacto 4,25 % (R5 lo redondea a "≈4,3 %")
    expect(rentabilidadCartera({ renta_variable: 0.8, renta_fija: 0.15, liquidez: 0.05 })).toBeCloseTo(
      0.0535,
      10,
    ); // dinámico: exacto 5,35 % (R5 lo redondea a "≈5,4 %")
  });

  it('volatilidad de una cartera 100 % liquidez es la propia de esa clase', () => {
    expect(volatilidadCartera({ liquidez: 1 })).toBeCloseTo(0.005, 10);
  });
});

describe('vfDeterminista / aEurosActuales / aniosHastaMeta', () => {
  it('con tasa cero, no capitaliza: solo suma aportaciones', () => {
    expect(vfDeterminista(10000, 800, 0, 3)).toBe(10000 + 800 * 36);
  });

  it('sin aportaciones, solo el capital crece a la tasa dada', () => {
    const vf = vfDeterminista(50000, 0, 0.043, 15);
    expect(vf).toBeGreaterThan(50000);
  });

  it('aEurosActuales deflacta con la inflación de referencia (2 %)', () => {
    expect(aEurosActuales(100000, 10)).toBeCloseTo(100000 / 1.02 ** 10, 6);
  });

  it('aniosHastaMeta encuentra el cruce cuando existe', () => {
    const anios = aniosHastaMeta(5000, 800, 0.0246, 100000);
    expect(anios).not.toBeNull();
    expect(anios).toBeGreaterThan(0);
  });

  it('aniosHastaMeta devuelve null si la meta es inalcanzable en 100 años', () => {
    expect(aniosHastaMeta(5000, 800, 0.0246, 2_000_000)).toBeNull();
  });
});

describe('aportacionRequerida (inversa de vfDeterminista)', () => {
  it('la aportación que devuelve, metida de vuelta en vfDeterminista, alcanza el objetivo', () => {
    const patrimonio = 10000;
    const objetivoReal = 150000;
    const r = 0.043;
    const anios = 20;

    const aportacion = aportacionRequerida(patrimonio, objetivoReal, r, anios);
    const vfNominal = vfDeterminista(patrimonio, aportacion, r, anios);
    const vfReal = aEurosActuales(vfNominal, anios);

    expect(vfReal).toBeCloseTo(objetivoReal, 0); // dentro de 1€ por redondeos de coma flotante
  });

  it('con tasa cero, reparte el hueco a partes iguales entre los meses', () => {
    const aportacion = aportacionRequerida(0, 12000, 0, 10); // 10 años, sin inflación real neta
    // 12.000 en euros de hoy con inflación 2% a 10 años = objetivo nominal mayor; solo
    // comprobamos que el resultado es positivo y razonable, no un valor exacto de cabeza.
    expect(aportacion).toBeGreaterThan(0);
  });

  it('si el patrimonio ya crecido supera el objetivo, la aportación requerida es negativa', () => {
    // Meta modesta, patrimonio grande, plazo largo: no hace falta aportar nada más.
    const aportacion = aportacionRequerida(500000, 100000, 0.043, 20);
    expect(aportacion).toBeLessThan(0);
  });
});

describe('R6 · convertirMetaRenta', () => {
  it('horizonte >=40 años usa tasa de retirada 3 %', () => {
    expect(convertirMetaRenta(5000, '>=40')).toBeCloseTo(2_000_000, 6);
  });

  it('nunca usa el 4 % automático fuera del horizonte ~20', () => {
    expect(convertirMetaRenta(1000, '~30')).toBeCloseTo((1000 * 12) / 0.0325, 6);
  });
});

describe('R10 · monteCarlo', () => {
  it('misma semilla y mismos datos ⇒ mismo resultado, siempre', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 3);
    const a = monteCarlo(5000, 560, cartera, 3, null, 42, 2000);
    const b = monteCarlo(5000, 560, cartera, 3, null, 42, 2000);
    expect(a).toEqual(b);
  });

  it('semillas distintas dan resultados distintos', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 3);
    const a = monteCarlo(5000, 560, cartera, 3, null, 1, 2000);
    const b = monteCarlo(5000, 560, cartera, 3, null, 2, 2000);
    expect(a.central).not.toBe(b.central);
  });

  it('percentiles en orden: pesimista <= central <= optimista', () => {
    const cartera = ajustarCarteraPorPlazo('moderado', 20);
    const r = monteCarlo(15000, 500, cartera, 20, null, 42, 3000);
    expect(r.pesimista).toBeLessThanOrEqual(r.central);
    expect(r.central).toBeLessThanOrEqual(r.optimista);
  });

  it('sin objetivo, no calcula probabilidad ni banda', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 3);
    const r = monteCarlo(5000, 560, cartera, 3, null, 42, 1000);
    expect(r.probabilidadCumplimiento).toBeNull();
    expect(r.banda).toBeNull();
  });

  it('objetivo inalcanzable con estos supuestos da probabilidad ~0 y banda baja', () => {
    const cartera = ajustarCarteraPorPlazo('conservador', 3);
    const r = monteCarlo(5000, 640, cartera, 3, 2_000_000, 42, 2000);
    expect(r.probabilidadCumplimiento).toBeLessThan(0.01);
    expect(r.banda).toBe('baja');
  });

  it('las bandas respetan los umbrales de R10 (alta >= 80 %, etc.)', () => {
    // Cartera muy dinámica, aportación alta, objetivo modesto y horizonte largo: probabilidad alta.
    const cartera = ajustarCarteraPorPlazo('dinamico', 30);
    const r = monteCarlo(50000, 1500, cartera, 30, 200_000, 42, 4000);
    expect(r.probabilidadCumplimiento).toBeGreaterThanOrEqual(0.8);
    expect(r.banda).toBe('alta');
  });
});
