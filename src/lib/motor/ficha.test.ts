import { describe, expect, it } from 'vitest';

import { clasificarMeta, determinarModo, type Ficha } from './ficha';

/** Ficha base "completa": todas las variables críticas confirmadas. Los tests la clonan y tocan
 * solo lo que necesitan probar. */
function fichaCompleta(): Ficha {
  return {
    nombre: { valor: 'Silvia', etiqueta: 'confirmado' },
    email: { valor: 'silvia@example.com', etiqueta: 'confirmado' },
    fechaEntrevista: '2026-08-25',
    ingresosNetosMensual: { valor: 2800, etiqueta: 'confirmado' },
    ingresosEstabilidad: { valor: 'estable', etiqueta: 'confirmado' },
    gastosFijosMensual: { valor: 2000, etiqueta: 'confirmado' },
    deudas: {
      valor: [
        {
          tipo: { valor: 'hipoteca', etiqueta: 'confirmado' },
          importe: { valor: null, etiqueta: 'pendiente' },
          cuota: { valor: 620, etiqueta: 'confirmado' },
          interes: { valor: 1.9, etiqueta: 'confirmado' },
        },
      ],
      etiqueta: 'confirmado',
    },
    deudasInteresAltoDeclarado: { valor: null, etiqueta: 'pendiente' },
    patrimonioLiquido: { valor: 12000, etiqueta: 'confirmado' },
    patrimonioInvertido: { valor: 10000, etiqueta: 'confirmado' },
    patrimonioDistribucion: { valor: 'todo en fondo indexado', etiqueta: 'confirmado' },
    aportacionMensualActual: { valor: 150, etiqueta: 'confirmado' },
    colchonMeses: { valor: 5, etiqueta: 'confirmado' },
    objetivoProposito: { valor: 'bajar el ritmo a los 60', etiqueta: 'confirmado' },
    objetivoImporte: { valor: 150000, etiqueta: 'confirmado' },
    objetivoPlazoAnios: { valor: 20, etiqueta: 'confirmado' },
    riesgoToleranciaDeclarada: { valor: 'media', etiqueta: 'confirmado' },
    riesgoComportamientoReal: { valor: 'aguantó la caída del covid sin vender', etiqueta: 'confirmado' },
    riesgoPerfilDerivado: { valor: 'moderado', etiqueta: 'confirmado' },
    edad: { valor: 40, etiqueta: 'confirmado' },
    personasACargo: { valor: 0, etiqueta: 'confirmado' },
    situacionLaboral: { valor: 'diseñadora gráfica en plantilla', etiqueta: 'confirmado' },
  };
}

describe('§4 · determinarModo', () => {
  it('todas las variables críticas presentes (aunque alguna estimada) → completo', () => {
    const ficha = fichaCompleta();
    ficha.ingresosNetosMensual.etiqueta = 'estimado';
    expect(determinarModo(ficha)).toEqual({ modo: 'completo', faltantes: [] });
  });

  it('falta una variable crítica (no deudas) → condicionado, se listan las faltantes', () => {
    const ficha = fichaCompleta();
    ficha.colchonMeses = { valor: null, etiqueta: 'pendiente' };
    const r = determinarModo(ficha);
    expect(r.modo).toBe('condicionado');
    expect(r.faltantes).toEqual(['colchonMeses']);
  });

  it('varias variables críticas pendientes se listan todas', () => {
    const ficha = fichaCompleta();
    ficha.colchonMeses = { valor: null, etiqueta: 'pendiente' };
    ficha.objetivoImporte = { valor: null, etiqueta: 'pendiente' };
    const r = determinarModo(ficha);
    expect(r.modo).toBe('condicionado');
    expect(r.faltantes.sort()).toEqual(['colchonMeses', 'objetivoImporte'].sort());
  });

  it('deudas pendiente (negativa explícita, único caso posible) → suspendido, no condicionado', () => {
    const ficha = fichaCompleta();
    ficha.deudas = { valor: null, etiqueta: 'pendiente' };
    expect(determinarModo(ficha)).toEqual({ modo: 'suspendido', faltantes: ['deudas'] });
  });

  it('deudas pendiente prevalece aunque el resto de la ficha esté completo', () => {
    const ficha = fichaCompleta();
    ficha.deudas = { valor: null, etiqueta: 'pendiente' };
    ficha.deudasInteresAltoDeclarado = { valor: 'si', etiqueta: 'confirmado' };
    const r = determinarModo(ficha);
    expect(r.modo).toBe('suspendido');
  });

  it('variable no crítica pendiente (p. ej. situación laboral) no cambia el modo', () => {
    const ficha = fichaCompleta();
    ficha.situacionLaboral = { valor: null, etiqueta: 'pendiente' };
    expect(determinarModo(ficha).modo).toBe('completo');
  });
});

describe('§3 · clasificarMeta', () => {
  it('objetivoImporte en € totales + plazo → patrimonio', () => {
    expect(clasificarMeta(fichaCompleta())).toBe('patrimonio');
  });

  it('renta mensual sin negocio de por medio → renta_cartera', () => {
    const ficha = fichaCompleta();
    ficha.objetivoProposito = { valor: 'vivir de las rentas, unos 2.000 al mes', etiqueta: 'confirmado' };
    ficha.objetivoImporte = { valor: null, etiqueta: 'pendiente' };
    expect(clasificarMeta(ficha)).toBe('renta_cartera');
  });

  it('renta procedente de negocio propio → renta_negocio, no se convierte', () => {
    const ficha = fichaCompleta();
    ficha.objetivoProposito = { valor: 'vivir de mi negocio propio', etiqueta: 'confirmado' };
    ficha.situacionLaboral = { valor: 'autónoma, tengo mi propia tienda', etiqueta: 'confirmado' };
    expect(clasificarMeta(ficha)).toBe('renta_negocio');
  });

  it('sin cifra ni plazo → mixta_ambigua, no se inventa una clasificación', () => {
    const ficha = fichaCompleta();
    ficha.objetivoProposito = { valor: 'quiero ahorrar más', etiqueta: 'confirmado' };
    ficha.objetivoImporte = { valor: null, etiqueta: 'pendiente' };
    ficha.objetivoPlazoAnios = { valor: null, etiqueta: 'pendiente' };
    expect(clasificarMeta(ficha)).toBe('mixta_ambigua');
  });
});
