-- 001_esquema_inicial.sql
-- Esquema inicial del proyecto. Ver docs/data-model.md para el detalle narrativo de cada tabla,
-- relación y política — este archivo es su traducción ejecutable, no una fuente nueva de criterio.
--
-- gen_random_uuid() es nativo desde Postgres 13.

-- Calidad de cada respuesta de la ficha: [confirmado | estimado | pendiente].
-- No se usa como tipo de ninguna columna: las respuestas y sus etiquetas viven dentro de
-- respuestas.contenido (jsonb). Se define aquí como vocabulario del dominio y por si una
-- migración futura promueve algún campo a columna.
create type dato_estado as enum ('confirmado', 'estimado', 'pendiente');

-- ── consultores ──────────────────────────────────────────────────────────────
-- Lista blanca de quién puede ver el panel (M-11). Estar en esta tabla ES el permiso — no basta
-- con tener una cuenta de Supabase Auth válida (ver "Autenticación" en docs/architecture.md).
create table consultores (
  id         uuid primary key references auth.users (id),
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

-- ── contactos ────────────────────────────────────────────────────────────────
-- Se crea cuando el visitante rellena el formulario de contacto con los cuatro campos (M-08), no
-- antes (minimización RGPD). Email normalizado a minúsculas antes de insertar, para enlazar a la
-- misma persona si repite la encuesta en vez de duplicarla.
create table contactos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  email      text not null unique,
  telefono   text not null,
  empresa    text not null,
  creado_en  timestamptz not null default now()
);

-- ── encuestas ────────────────────────────────────────────────────────────────
-- Una fila por cada visitante que acepta el consentimiento y abre el chat, complete la encuesta o
-- no.
--
-- estado:
--   en_curso    → entrevista en marcha
--   respondida  → entrevista terminada, respuestas persistidas, sin contacto ni diagnóstico
--   completada  → cierre completo (contacto + resultado de rúbrica + diagnóstico)
--   abandonada  → marcada por el job de retención al vencer expira_en
create table encuestas (
  id                     uuid primary key default gen_random_uuid(),
  contacto_id            uuid references contactos (id),
  -- Secreto de la sesión: es lo único que autoriza a /api/chat a escribir en esta encuesta.
  -- NO es una URL personalizada por destinatario.
  token                  uuid not null unique default gen_random_uuid(),
  -- M-02: la encuesta no existe sin consentimiento previo de tratamiento de datos.
  consentimiento_en      timestamptz not null,
  -- Versión del texto de consentimiento aceptada, para auditar qué aceptó cada visitante.
  consentimiento_version text not null,
  expira_en              timestamptz not null default (now() + interval '30 days'),
  iniciada_en            timestamptz not null default now(),
  finalizada_en          timestamptz,
  estado                 text not null default 'en_curso'
                          check (estado in ('en_curso', 'respondida', 'completada', 'abandonada')),
  turnos_totales         int not null default 0
);

-- ── limites_uso ──────────────────────────────────────────────────────────────
-- Protección contra abuso (docs/architecture.md → "Protección contra abuso"): la encuesta es
-- pública y cada turno cuesta dinero real en la API de Claude. Se guarda un hash de la IP
-- (HMAC-SHA256 con IP_HASH_PEPPER), nunca la IP en claro.
create table limites_uso (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  accion     text not null check (accion in ('crear_encuesta', 'enviar_mensaje')),
  creado_en  timestamptz not null default now()
);
create index limites_uso_ip_hash_creado_en_idx on limites_uso (ip_hash, creado_en);

-- ── respuestas ───────────────────────────────────────────────────────────────
-- Una fila por encuesta que llega al final de la entrevista. Se persiste al detectar la ficha de
-- cierre que emite Claude, antes del formulario de contacto.
--
-- contenido (jsonb) es la fuente canónica: el objeto RespuestasEncuesta de src/lib/rubrica/, con
-- los ocho bloques y cada campo como { valor, etiqueta } (etiqueta ∈ dato_estado). Las columnas
-- sueltas son copia desnormalizada de los campos que el panel filtra y el análisis de negocio
-- agrega (ver docs/data-model.md → respuestas).
create table respuestas (
  id                 uuid primary key default gen_random_uuid(),
  encuesta_id        uuid not null unique references encuestas (id) on delete cascade,
  contenido          jsonb not null,

  sector             text,
  tamano_rango       text,
  madurez_digital    text,
  presupuesto_rango  text,
  decision_quien     text,

  -- usage de las llamadas a Claude de esta encuesta: { entrevista, diagnostico | null }.
  -- diagnostico se rellena al cerrar; en estado respondida queda null.
  coste_ia           jsonb not null default '{}'::jsonb,

  creado_en          timestamptz not null default now()
);

-- ── resultados_rubrica ───────────────────────────────────────────────────────
-- Salida de src/lib/rubrica/ (código determinista, M-05). Relación 1:1 con respuestas en esta
-- versión; si se reprocesa la misma ficha con reglas nuevas, se versiona con una fila nueva.
create table resultados_rubrica (
  id                 uuid primary key default gen_random_uuid(),
  respuesta_id       uuid not null references respuestas (id) on delete cascade,
  -- sin_preparar | inicial | en_desarrollo | consolidada (ver docs/rubrica.md).
  nivel_preparacion  text not null,
  -- false si faltan respuestas que la rúbrica necesita (M-07).
  completo           boolean not null,
  datos_faltantes    jsonb not null default '[]'::jsonb,
  -- Array ordenado por puntuación desc: { nombre, descripcion, impacto, viabilidad, puntuacion, justificacion }.
  casos_uso          jsonb not null,
  -- Salida completa de la rúbrica (incluye lo anterior + señales intermedias).
  contenido          jsonb not null,
  -- Trazabilidad: sin esto un resultado antiguo no se puede reproducir si las reglas cambian.
  version_rubrica    text not null,
  creado_en          timestamptz not null default now()
);
create index resultados_rubrica_respuesta_id_idx on resultados_rubrica (respuesta_id);

-- ── diagnosticos ─────────────────────────────────────────────────────────────
-- Lo que de verdad ve el visitante en el chat. Separado de resultados_rubrica a propósito: uno es
-- el registro técnico, el otro su traducción entregada.
create table diagnosticos (
  id            uuid primary key default gen_random_uuid(),
  resultado_id  uuid not null references resultados_rubrica (id) on delete cascade,
  -- Redactado por Claude a partir del resultado YA calculado (M-06).
  markdown      text not null,
  -- El markdown descompuesto por encabezados ##, mecánicamente.
  secciones     jsonb not null,
  -- Texto fijo "orientación preliminar, no vinculante" (M-13), guardado con el diagnóstico para
  -- auditar qué vio cada visitante.
  nota_alcance  text not null,
  generado_en   timestamptz not null default now()
);
create index diagnosticos_resultado_id_idx on diagnosticos (resultado_id);

-- ── notificaciones_consultor ─────────────────────────────────────────────────
-- Registro del aviso automático por email (M-10), para confirmar envíos y depurar fallos. Un
-- fallo se registra como 'fallido', no se reintenta ni bloquea al visitante (RNF-07).
create table notificaciones_consultor (
  id                uuid primary key default gen_random_uuid(),
  encuesta_id       uuid not null references encuestas (id) on delete cascade,
  destinatario      text not null,
  enviado_en        timestamptz,
  estado            text not null check (estado in ('enviado', 'fallido')),
  creado_en         timestamptz not null default now()
);
create index notificaciones_consultor_encuesta_id_idx on notificaciones_consultor (encuesta_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════════════════════
-- Ningún visitante habla con Supabase directamente: todas las escrituras pasan por src/app/api/
-- en el servidor, con la clave de servicio (que no pasa por RLS). Por eso ninguna tabla lleva
-- policy de INSERT/UPDATE/DELETE para "authenticated" ni "anon" — todas las escrituras vienen del
-- backend. Solo se conceden policies de SELECT, y solo a quien está en la tabla consultores.

alter table consultores               enable row level security;
alter table contactos                 enable row level security;
alter table encuestas                 enable row level security;
alter table limites_uso               enable row level security;
alter table respuestas                enable row level security;
alter table resultados_rubrica        enable row level security;
alter table diagnosticos              enable row level security;
alter table notificaciones_consultor  enable row level security;

-- Estar en la tabla consultores ES el permiso — no basta con que auth.uid() devuelva un valor.
-- security definer + search_path fijo: patrón recomendado de Supabase para que la función no
-- quede sujeta a las RLS de la tabla que consulta (si no, se autobloquearía).
create function es_consultor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from consultores where id = auth.uid());
$$;

create policy "consultores_select" on consultores
  for select to authenticated using (es_consultor());
create policy "contactos_select" on contactos
  for select to authenticated using (es_consultor());
create policy "encuestas_select" on encuestas
  for select to authenticated using (es_consultor());
create policy "respuestas_select" on respuestas
  for select to authenticated using (es_consultor());
create policy "resultados_rubrica_select" on resultados_rubrica
  for select to authenticated using (es_consultor());
create policy "diagnosticos_select" on diagnosticos
  for select to authenticated using (es_consultor());
create policy "notificaciones_consultor_select" on notificaciones_consultor
  for select to authenticated using (es_consultor());

-- limites_uso no lleva policy de SELECT: ni siquiera el consultor necesita leerla desde el cliente.
