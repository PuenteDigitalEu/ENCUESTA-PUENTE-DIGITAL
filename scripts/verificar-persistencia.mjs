#!/usr/bin/env node
/**
 * Verifica, contra un Postgres real (PGlite, WASM — no un mock), que las escrituras que hace
 * `lib/supabase/persistencia.ts` al cerrar una conversación (cliente, ficha, deudas, informe,
 * plan) respetan de verdad el esquema: columnas, `not null`, `check`, claves foráneas y el `unique`
 * de `clientes.email`.
 *
 * Qué SÍ prueba esto: que un juego de columnas con esta forma pasa (o falla, en los casos
 * negativos) contra el esquema real de `supabase/migrations/001_esquema_inicial.sql`.
 * Qué NO prueba: que `persistencia.ts` genere exactamente estas columnas — eso lo cubren los tests
 * mockeados de `persistencia.test.ts`, que sí importan el código real. Los dos juegos de columnas
 * de aquí abajo se mantienen a mano en paralelo a `fichaAFila`/`deudasAFilas`/`informeAFila`/
 * `planAFila` — si esas funciones cambian una columna, este script hay que actualizarlo también
 * (ver docs/features/consentimiento-y-persistencia.md → "Decisiones tomadas").
 *
 * No corre en CI (descarga el WASM de PGlite y tarda varios segundos) — se ejecuta a mano antes de
 * cerrar la feature, igual que se hizo con la migración original.
 *
 * Uso:  node scripts/verificar-persistencia.mjs
 */

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRACION = join(RAIZ, 'supabase', 'migrations', '001_esquema_inicial.sql');

let fallos = 0;
function ok(descripcion) {
  console.log(`  OK  ${descripcion}`);
}
function fallo(descripcion, detalle) {
  fallos++;
  console.log(`  FALLO  ${descripcion}`);
  if (detalle) console.log(`         ${detalle}`);
}

async function main() {
  const db = new PGlite();

  // Supabase provee auth.users/auth.uid()/los tres roles de forma nativa; PGlite no, así que se
  // simulan aquí solo lo justo para que la migración (que sí depende de ellos) aplique limpia.
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role authenticated;
    create role anon;
    create role service_role;
  `);

  const migracion = readFileSync(MIGRACION, 'utf-8');
  await db.exec(migracion);
  console.log('Migración aplicada sin errores.\n');

  // ── Cadena feliz: cliente → conversación → ficha → deudas → informe → plan ──────────────────
  console.log('Cadena de escritura del cierre (persistirCierre):');

  const cliente = await db.query(
    `insert into clientes (nombre, email) values ($1, $2) returning id`,
    ['Silvia', 'silvia@example.com'],
  );
  const clienteId = cliente.rows[0].id;
  ok('clientes: insert con nombre + email (mismas columnas que enlazarCliente())');

  const conversacion = await db.query(
    `insert into conversaciones (cliente_id, consentimiento_en) values ($1, now())
     returning id, token`,
    [clienteId],
  );
  const conversacionId = conversacion.rows[0].id;
  ok('conversaciones: insert con consentimiento_en (mismas columnas que crearConversacion())');

  // Columnas exactas de fichaAFila() en persistencia.ts — mantener sincronizado si esa función cambia.
  const ficha = await db.query(
    `insert into fichas (
       conversacion_id, nombre, nombre_estado, fecha_entrevista,
       ingresos_netos_mensual, ingresos_netos_mensual_estado,
       ingresos_estabilidad, ingresos_estabilidad_estado,
       gastos_fijos_mensual, gastos_fijos_mensual_estado,
       deudas_interes_alto_declarado, deudas_interes_alto_declarado_estado,
       patrimonio_liquido, patrimonio_liquido_estado,
       patrimonio_invertido, patrimonio_invertido_estado,
       patrimonio_distribucion, patrimonio_distribucion_estado,
       aportacion_mensual_actual, aportacion_mensual_actual_estado,
       colchon_meses, colchon_meses_estado,
       objetivo_proposito, objetivo_proposito_estado,
       objetivo_importe, objetivo_importe_estado,
       objetivo_plazo_anios, objetivo_plazo_anios_estado,
       riesgo_tolerancia_declarada, riesgo_tolerancia_declarada_estado,
       riesgo_comportamiento_real, riesgo_comportamiento_real_estado,
       riesgo_perfil_derivado, riesgo_perfil_derivado_estado,
       edad, edad_estado, personas_a_cargo, personas_a_cargo_estado,
       situacion_laboral, situacion_laboral_estado
     ) values (
       $1, $2, 'confirmado', $3,
       2800, 'confirmado', 'estable', 'confirmado',
       1600, 'confirmado',
       'no', 'confirmado',
       12000, 'confirmado', 10000, 'confirmado',
       'todo en un fondo indexado', 'confirmado',
       150, 'confirmado',
       5, 'confirmado',
       'bajar el ritmo a los 60', 'confirmado', 150000, 'confirmado', 20, 'confirmado',
       'media', 'confirmado', 'aguantó la caída del covid sin vender', 'confirmado',
       'moderado', 'confirmado',
       40, 'confirmado', 0, 'confirmado',
       'diseñadora gráfica en plantilla', 'confirmado'
     ) returning id`,
    [conversacionId, 'Silvia', '2026-08-27'],
  );
  const fichaId = ficha.rows[0].id;
  ok('fichas: insert con las 41 columnas de fichaAFila()');

  await db.query(
    `insert into deudas (ficha_id, orden, tipo, tipo_estado, importe, importe_estado, cuota, cuota_estado, interes, interes_estado)
     values ($1, 1, 'hipoteca', 'confirmado', 150000, 'confirmado', 620, 'confirmado', 1.9, 'confirmado')`,
    [fichaId],
  );
  ok('deudas: insert con las columnas de deudasAFilas()');

  const informe = await db.query(
    `insert into informes (
       ficha_id, modo, tipo_meta, flujo_libre, porcentaje_camino_recorrido, proyeccion_valor_futuro,
       gap_euros, gap_anios, aportacion_propuesta, cartera_objetivo, rentabilidad_esperada_neta,
       mc_percentil_pesimista, mc_percentil_central, mc_percentil_optimista, mc_probabilidad_cumplimiento,
       mc_banda, contenido, pendientes_reunion, version_motor, version_reglas
     ) values (
       $1, 'completo', 'patrimonio', 580, 6.7, 117614, 32386, 25.4, 406,
       $2, 0.0425, 84405, 114373, 155067, 0.1261, 'baja', $3, $4, '0.1.0', '2026-08-06'
     ) returning id`,
    [
      fichaId,
      JSON.stringify({ renta_variable: 0.5, renta_fija: 0.4, liquidez: 0.1 }),
      JSON.stringify({ modo: 'completo' }),
      JSON.stringify([]),
    ],
  );
  const informeId = informe.rows[0].id;
  ok('informes: insert con las columnas de informeAFila() (incluido cartera_objetivo/contenido jsonb)');

  await db.query(
    `insert into planes (informe_id, secciones, markdown, descargo) values ($1, $2, $3, $4)`,
    [
      informeId,
      JSON.stringify([{ titulo: '1. Tu meta', contenido: 'Texto.' }]),
      '## 1. Tu meta\nTexto.',
      'Esto es orientación educativa...',
    ],
  );
  ok('planes: insert con las columnas de planAFila()');

  await db.query(`update conversaciones set estado = 'completada', finalizada_en = now() where id = $1`, [
    conversacionId,
  ]);
  ok('conversaciones: update a completada (cierre de persistirCierre())');

  // ── Casos negativos: las restricciones reales tienen que rechazar lo que deben rechazar ──────
  console.log('\nRestricciones (tienen que fallar, si no fallan es un fallo de este script):');

  await esperarError(
    'email duplicado en clientes rechazado por el unique',
    () => db.query(`insert into clientes (nombre, email) values ('Otro', 'silvia@example.com')`),
  );

  await esperarError(
    'conversación sin consentimiento_en rechazada (not null)',
    () => db.query(`insert into conversaciones (cliente_id) values (null)`),
  );

  await esperarError(
    'ficha sin conversacion_id rechazada (not null)',
    () => db.query(`insert into fichas (fecha_entrevista) values ('2026-08-27')`),
  );

  await esperarError(
    'modo de informe fuera de la lista rechazado por el check',
    () =>
      db.query(
        `insert into informes (ficha_id, modo, contenido, pendientes_reunion, version_motor, version_reglas)
         values ($1, 'inventado', '{}', '[]', 'x', 'y')`,
        [fichaId],
      ),
  );

  await esperarError(
    'deuda con ficha_id inexistente rechazada por la clave foránea',
    () =>
      db.query(
        `insert into deudas (ficha_id, orden) values ('00000000-0000-0000-0000-000000000000', 1)`,
      ),
  );

  console.log(`\n${fallos === 0 ? 'Todo en orden.' : `${fallos} fallo(s).`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

async function esperarError(descripcion, accion) {
  try {
    await accion();
    fallo(descripcion, 'se esperaba que la escritura fallara, y no falló');
  } catch {
    ok(descripcion);
  }
}

main().catch((error) => {
  console.error('Error inesperado ejecutando la verificación:', error);
  process.exit(1);
});
