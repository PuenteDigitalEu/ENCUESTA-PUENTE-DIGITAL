/**
 * catalogo.ts — Casos de uso candidatos (docs/rubrica.md §4.1). Lista ancha a propósito: la
 * práctica de consultoría está arrancando y se afina con clientes reales.
 *
 * `palabrasClave`: para emparejar el caso con un proceso o tarea que el visitante ha mencionado
 * (match por inclusión de subcadena, sin acentos, en minúsculas).
 * `dependeIntegracion`: su viabilidad sube con `integracion_actual`.
 * `mueveDatosExternos`: `cautela_datos` le resta viabilidad.
 * `relevanteDatos`: `trabajo_con_datos` le suma impacto.
 */

export interface EntradaCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  palabrasClave: string[];
  dependeIntegracion: boolean;
  mueveDatosExternos: boolean;
  relevanteDatos: boolean;
}

export const CATALOGO: readonly EntradaCatalogo[] = [
  {
    id: 'presupuestos',
    nombre: 'Automatización de presupuestos y ofertas',
    descripcion: 'Generar presupuestos a partir de plantillas y datos de cliente o servicio, sin reescribirlos a mano.',
    palabrasClave: ['presupuesto', 'oferta', 'cotizacion', 'cotización', 'valoracion'],
    dependeIntegracion: true,
    mueveDatosExternos: false,
    relevanteDatos: false,
  },
  {
    id: 'entrada_datos',
    nombre: 'Traspaso de datos entre sistemas',
    descripcion: 'Mover información de un sitio a otro (correo, formularios, hojas, programas) sin copiar y pegar.',
    palabrasClave: ['copiar', 'pegar', 'pasar datos', 'traspasar', 'volcar', 'introducir datos', 'meter datos', 'excel', 'hoja de calculo', 'hoja de cálculo'],
    dependeIntegracion: true,
    mueveDatosExternos: false,
    relevanteDatos: true,
  },
  {
    id: 'facturacion',
    nombre: 'Facturación y conciliación',
    descripcion: 'Emitir facturas desde albaranes o partes y cuadrar los cobros automáticamente.',
    palabrasClave: ['factura', 'facturacion', 'facturación', 'albaran', 'albarán', 'cobro', 'conciliacion', 'conciliación', 'contabilidad'],
    dependeIntegracion: true,
    mueveDatosExternos: false,
    relevanteDatos: false,
  },
  {
    id: 'atencion_faq',
    nombre: 'Asistente de atención a clientes',
    descripcion: 'Responder consultas frecuentes y dar el estado de un pedido de forma automática.',
    palabrasClave: ['atencion', 'atención', 'cliente', 'consulta', 'whatsapp', 'email', 'correo', 'responder', 'preguntas', 'soporte', 'estado del pedido'],
    dependeIntegracion: false,
    mueveDatosExternos: true,
    relevanteDatos: false,
  },
  {
    id: 'citas',
    nombre: 'Gestión de citas y recordatorios',
    descripcion: 'Reservas online y recordatorios automáticos para reducir huecos y ausencias.',
    palabrasClave: ['cita', 'reserva', 'agenda', 'calendario', 'recordatorio', 'turno'],
    dependeIntegracion: false,
    mueveDatosExternos: false,
    relevanteDatos: false,
  },
  {
    id: 'crm_ligero',
    nombre: 'Seguimiento comercial / CRM ligero',
    descripcion: 'Registrar contactos y oportunidades y automatizar el seguimiento para que no se pierdan.',
    palabrasClave: ['seguimiento', 'comercial', 'lead', 'oportunidad', 'crm', 'clientes potenciales', 'contactos'],
    dependeIntegracion: true,
    mueveDatosExternos: false,
    relevanteDatos: true,
  },
  {
    id: 'generacion_docs',
    nombre: 'Generación de documentos',
    descripcion: 'Crear contratos, partes, informes o certificados a partir de datos estructurados.',
    palabrasClave: ['documento', 'contrato', 'informe', 'parte', 'certificado', 'plantilla', 'rellenar', 'redactar documento'],
    dependeIntegracion: false,
    mueveDatosExternos: false,
    relevanteDatos: false,
  },
  {
    id: 'compras',
    nombre: 'Compras y pedidos a proveedores',
    descripcion: 'Automatizar peticiones recurrentes a proveedores y comparar precios y plazos.',
    palabrasClave: ['compra', 'pedido', 'proveedor', 'aprovisionamiento', 'stock', 'inventario', 'reponer'],
    dependeIntegracion: true,
    mueveDatosExternos: false,
    relevanteDatos: true,
  },
  {
    id: 'informes',
    nombre: 'Informes y cuadros de mando',
    descripcion: 'Consolidar datos dispersos en un panel que se actualiza solo.',
    palabrasClave: ['informe', 'reporte', 'cuadro de mando', 'kpi', 'metricas', 'métricas', 'seguimiento de ventas', 'panel', 'dashboard'],
    dependeIntegracion: true,
    mueveDatosExternos: false,
    relevanteDatos: true,
  },
  {
    id: 'enrutado_mensajes',
    nombre: 'Clasificación y derivación de correo y mensajes',
    descripcion: 'Ordenar la entrada (email, WhatsApp) y derivar cada mensaje a quien corresponde.',
    palabrasClave: ['clasificar', 'ordenar correo', 'bandeja', 'derivar', 'enrutar', 'triaje', 'reparto'],
    dependeIntegracion: false,
    mueveDatosExternos: true,
    relevanteDatos: false,
  },
  {
    id: 'extraccion_docs',
    nombre: 'Extracción de datos de documentos recibidos',
    descripcion: 'Leer facturas, albaranes o tickets que llegan y volcar sus datos automáticamente (OCR + IA).',
    palabrasClave: ['facturas recibidas', 'tickets', 'escanear', 'ocr', 'digitalizar', 'teclear', 'introducir facturas', 'papel'],
    dependeIntegracion: true,
    mueveDatosExternos: true,
    relevanteDatos: true,
  },
  {
    id: 'redaccion',
    nombre: 'Redacción asistida',
    descripcion: 'Borradores de respuestas, descripciones de producto o textos de marketing a partir de una indicación breve.',
    palabrasClave: ['redactar', 'escribir', 'texto', 'descripcion de producto', 'descripción de producto', 'marketing', 'contenido', 'respuestas'],
    dependeIntegracion: false,
    mueveDatosExternos: false,
    relevanteDatos: false,
  },
] as const;
