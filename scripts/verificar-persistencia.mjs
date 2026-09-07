#!/usr/bin/env node
/**
 * Verifica, contra un Postgres real (PGlite, WASM — no un mock), que las escrituras que hace
 * `src/lib/supabase/persistencia.ts` respetan el esquema de `supabase/migrations/001_esquema_inicial.sql`:
 * columnas, `not null`, `check`, claves foráneas, `unique` y `on delete cascade`.
 *
 * Qué SÍ prueba: que un juego de columnas con esta forma pasa (o falla, en los casos negativos)
 * contra el esquema real, y que borrar una `encuestas` arrastra en cascada sus filas dependientes.
 * Qué NO prueba: que `persistencia.ts` genere exactamente estas columnas — eso lo cubren los tests
 * de `persistencia.test.ts`. Los juegos de columnas de aquí se mantienen a mano en paralelo a
 * `persistencia.ts`; si esas funciones cambian una columna, este script se actualiza en el mismo commit.
 *
 * No corre en CI (descarga el WASM de PGlite y tarda). Se ejecuta a mano antes de cerrar una
 * feature que toque el esquema.
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
const ok = (d) => console.log(`  OK  ${d}`);
const fallo = (d, detalle) => {
  fallos++;
  console.log(`  FALLO  ${d}`);
  if (detalle) console.log(`         ${detalle}`);
};

async function esperarError(descripcion, accion) {
  try {
    await accion();
    fallo(descripcion, 'se esperaba que la escritura fallara, y no falló');
  } catch {
    ok(descripcion);
  }
}

async function main() {
  const db = new PGlite();

  // Supabase provee auth.users / auth.uid() / los tres roles de forma nativa; PGlite no, así que
  // se simulan aquí solo lo justo para que la migración aplique limpia.
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role authenticated;
    create role anon;
    create role service_role;
  `);

  await db.exec(readFileSync(MIGRACION, 'utf-8'));
  console.log('Migración aplicada sin errores.\n');

  // ── Cadena feliz ────────────────────────────────────────────────────────────
  console.log('Cadena de escritura de la encuesta:');

  // 1. Alta de la encuesta al consentir (crearEncuesta()).
  const enc = await db.query(
    `insert into encuestas (consentimiento_en, consentimiento_version)
     values (now(), '2026-09-07') returning id, token, estado`,
    [],
  );
  const encuestaId = enc.rows[0].id;
  if (enc.rows[0].estado !== 'en_curso') fallo('encuestas: estado por defecto en_curso', `fue ${enc.rows[0].estado}`);
  else ok('encuestas: insert con consentimiento_en + consentimiento_version, estado en_curso');

  // 2. Límite de uso por IP (comprobarLimiteUso()).
  await db.query(`insert into limites_uso (ip_hash, accion) values ($1, 'crear_encuesta')`, ['hash-de-prueba']);
  await db.query(`insert into limites_uso (ip_hash, accion) values ($1, 'enviar_mensaje')`, ['hash-de-prueba']);
  ok('limites_uso: insert con acciones crear_encuesta / enviar_mensaje');

  // 3. Fin de la entrevista: persistir respuestas + estado respondida (persistirRespuestas()).
  const contenidoFicha = {
    sector: { valor: 'taller mecánico', etiqueta: 'confirmado' },
    tamano_rango: { valor: '1-9', etiqueta: 'confirmado' },
    procesos: [{ nombre: 'presupuestos', tiempo_aprox: 'media hora x 6/día', dolor: 'repetir datos a mano', etiqueta: 'confirmado' }],
  };
  const resp = await db.query(
    `insert into respuestas (
       encuesta_id, contenido, sector, tamano_rango, madurez_digital, presupuesto_rango, decision_quien, coste_ia
     ) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [
      encuestaId,
      JSON.stringify(contenidoFicha),
      'taller mecánico',
      '1-9',
      'baja',
      '1k-5k',
      'yo',
      JSON.stringify({ entrevista: { input_tokens: 82000, output_tokens: 2300 }, diagnostico: null }),
    ],
  );
  const respuestaId = resp.rows[0].id;
  ok('respuestas: insert con contenido jsonb + columnas promovidas + coste_ia (persistirRespuestas)');

  await db.query(`update encuestas set estado = 'respondida' where id = $1`, [encuestaId]);
  ok("encuestas: update a estado 'respondida'");

  // 4. Cierre: contacto → resultado → diagnóstico → estado completada (persistirCierre()).
  const cont = await db.query(
    `insert into contactos (nombre, email, telefono, empresa)
     values ($1, $2, $3, $4) returning id`,
    ['Ana López', 'ana@example.com', '600123123', 'Talleres López SL'],
  );
  const contactoId = cont.rows[0].id;
  ok('contactos: insert con los cuatro campos not null');

  await db.query(`update encuestas set contacto_id = $1 where id = $2`, [contactoId, encuestaId]);
  ok('encuestas: enlace de contacto_id');

  const res = await db.query(
    `insert into resultados_rubrica (
       respuesta_id, nivel_preparacion, completo, datos_faltantes, casos_uso, contenido, version_rubrica
     ) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      respuestaId,
      'inicial',
      false,
      JSON.stringify([{ campo: 'uso_nube', para_que: 'señal de digitalización' }]),
      JSON.stringify([
        { id: 'presupuestos', nombre: 'Automatización de presupuestos', impacto: 4, viabilidad: 2, puntuacion: 8, justificacion: '…' },
      ]),
      JSON.stringify({ preparacion_score: 3, senales: { digitalizacion: 1, madurez_equipo: 1, claridad_procesos: 1 } }),
      '2026-09-07',
    ],
  );
  const resultadoId = res.rows[0].id;
  ok('resultados_rubrica: insert con nivel + completo + jsonb + version_rubrica');

  await db.query(
    `insert into diagnosticos (resultado_id, markdown, secciones, nota_alcance)
     values ($1, $2, $3, $4)`,
    [
      resultadoId,
      '## Punto de partida\nTexto.',
      JSON.stringify([{ titulo: 'Punto de partida', contenido: 'Texto.' }]),
      'Esto es una orientación preliminar, no vinculante.',
    ],
  );
  ok('diagnosticos: insert con markdown + secciones + nota_alcance');

  await db.query(`update encuestas set estado = 'completada', finalizada_en = now() where id = $1`, [encuestaId]);
  ok("encuestas: update a estado 'completada' + finalizada_en (cierre de persistirCierre)");

  // 5. Aviso al consultor (registrarNotificacionConsultor()).
  await db.query(
    `insert into notificaciones_consultor (encuesta_id, destinatario, enviado_en, estado)
     values ($1, $2, now(), 'enviado')`,
    [encuestaId, 'consultor@example.com'],
  );
  ok("notificaciones_consultor: insert estado 'enviado'");
  await db.query(
    `insert into notificaciones_consultor (encuesta_id, destinatario, enviado_en, estado)
     values ($1, $2, null, 'fallido')`,
    [encuestaId, 'consultor@example.com'],
  );
  ok("notificaciones_consultor: insert estado 'fallido' con enviado_en null");

  // ── Cascada de borrado (cambio respecto al clon) ────────────────────────────
  console.log('\nBorrado en cascada al eliminar una encuesta:');
  await db.query(`delete from encuestas where id = $1`, [encuestaId]);
  for (const [tabla, filtro, params] of [
    ['respuestas', 'encuesta_id = $1', [encuestaId]],
    ['resultados_rubrica', 'respuesta_id = $1', [respuestaId]],
    ['diagnosticos', 'resultado_id = $1', [resultadoId]],
    ['notificaciones_consultor', 'encuesta_id = $1', [encuestaId]],
  ]) {
    const { rows } = await db.query(`select count(*)::int as n from ${tabla} where ${filtro}`, params);
    if (rows[0].n === 0) ok(`${tabla}: borrada en cascada`);
    else fallo(`${tabla}: quedaron ${rows[0].n} filas tras borrar la encuesta`);
  }

  // ── Casos negativos ────────────────────────────────────────────────────────
  console.log('\nRestricciones (tienen que fallar):');

  await esperarError('contactos: email duplicado rechazado por el unique', async () => {
    await db.query(`insert into contactos (nombre, email, telefono, empresa) values ('X','dup@example.com','1','Y')`);
    await db.query(`insert into contactos (nombre, email, telefono, empresa) values ('Z','dup@example.com','2','W')`);
  });

  await esperarError('contactos: telefono not null', () =>
    db.query(`insert into contactos (nombre, email, empresa) values ('X','ntn@example.com','Y')`),
  );

  await esperarError('encuestas: consentimiento_en not null', () =>
    db.query(`insert into encuestas (consentimiento_version) values ('v1')`),
  );

  await esperarError('encuestas: consentimiento_version not null', () =>
    db.query(`insert into encuestas (consentimiento_en) values (now())`),
  );

  await esperarError('encuestas: estado fuera del check rechazado', () =>
    db.query(`insert into encuestas (consentimiento_en, consentimiento_version, estado) values (now(),'v1','inventado')`),
  );

  await esperarError('respuestas: encuesta_id not null', () =>
    db.query(`insert into respuestas (contenido) values ('{}'::jsonb)`),
  );

  {
    const e2 = await db.query(`insert into encuestas (consentimiento_en, consentimiento_version) values (now(),'v1') returning id`);
    await db.query(`insert into respuestas (encuesta_id, contenido) values ($1, '{}'::jsonb)`, [e2.rows[0].id]);
    await esperarError('respuestas: una segunda fila para la misma encuesta rechazada (unique 1:1)', () =>
      db.query(`insert into respuestas (encuesta_id, contenido) values ($1, '{}'::jsonb)`, [e2.rows[0].id]),
    );
  }

  await esperarError('resultados_rubrica: respuesta_id inexistente rechazado por la FK', () =>
    db.query(
      `insert into resultados_rubrica (respuesta_id, nivel_preparacion, completo, casos_uso, contenido, version_rubrica)
       values ('00000000-0000-0000-0000-000000000000','inicial',true,'[]'::jsonb,'{}'::jsonb,'v1')`,
    ),
  );

  await esperarError('notificaciones_consultor: estado fuera del check rechazado', () =>
    db.query(
      `insert into notificaciones_consultor (encuesta_id, destinatario, estado)
       select id, 'x@example.com', 'pendiente' from encuestas limit 1`,
    ),
  );

  await esperarError('limites_uso: accion fuera del check rechazada', () =>
    db.query(`insert into limites_uso (ip_hash, accion) values ('h','borrar_todo')`),
  );

  console.log(`\n${fallos === 0 ? 'Todo en orden.' : `${fallos} fallo(s).`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Error inesperado ejecutando la verificación:', error);
  process.exit(1);
});
