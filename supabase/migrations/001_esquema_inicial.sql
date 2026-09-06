-- 001_esquema_inicial.sql
-- Esquema inicial del proyecto. Ver docs/data-model.md para el detalle narrativo de cada tabla,
-- relación y política — este archivo es su traducción ejecutable, no una fuente nueva de criterio.

-- gen_random_uuid() es nativo desde Postgres 13 (pgcrypto ya no hace falta para esto).

-- Reproduce la etiqueta que usan instrucciones-sistema.md / instrucciones-motor.md en cada dato
-- de la ficha: [confirmado|estimado|pendiente].
create type dato_estado as enum ('confirmado', 'estimado', 'pendiente');

-- ── asesores ─────────────────────────────────────────────────────────────────
-- Lista blanca de quién puede ver el panel (S-01). Estar en esta tabla ES el permiso — no basta
-- con tener una cuenta de Supabase Auth válida (ver "Estrategia de autenticación" en architecture.md).
create table asesores (
  id         uuid primary key references auth.users (id),
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

-- ── clientes ─────────────────────────────────────────────────────────────────
-- Se crea cuando el visitante da nombre y email dentro del chat, no antes (minimización RGPD).
-- Email normalizado a minúsculas antes de insertar, para enlazar leads repetidos en vez de duplicarlos.
create table clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text,
  email      text not null unique,
  creado_en  timestamptz not null default now()
);

-- ── conversaciones ───────────────────────────────────────────────────────────
-- Una fila por cada visitante que abre el chat, exista o no llegue a completarlo.
create table conversaciones (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid references clientes (id),
  -- Secreto de la URL de esta sesión concreta; NO es una URL personalizada por destinatario
  -- (eso sigue fuera de alcance, ver docs/prd.md) — es un identificador de sesión efímero.
  token               uuid not null unique default gen_random_uuid(),
  -- M-06: la conversación no existe sin consentimiento previo de tratamiento de datos.
  consentimiento_en   timestamptz not null,
  expira_en           timestamptz not null default (now() + interval '30 days'),
  iniciada_en         timestamptz not null default now(),
  finalizada_en       timestamptz,
  estado              text not null default 'en_curso'
                       check (estado in ('en_curso', 'completada', 'abandonada')),
  turnos_totales      int not null default 0
);

-- ── limites_uso ──────────────────────────────────────────────────────────────
-- Protección contra abuso (ver architecture.md): la entrevista es pública y cada mensaje cuesta
-- dinero real en la API de Claude. Se guarda un hash de la IP, nunca la IP en claro.
create table limites_uso (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  accion     text not null check (accion in ('crear_conversacion', 'enviar_mensaje')),
  creado_en  timestamptz not null default now()
);
create index limites_uso_ip_hash_creado_en_idx on limites_uso (ip_hash, creado_en);

-- ── fichas ───────────────────────────────────────────────────────────────────
-- Una fila por conversación completada — las claves fijas del contrato de instrucciones-sistema.md,
-- salvo las deudas (tabla deudas aparte, por ser un grupo repetible) y el email (vive en clientes).
create table fichas (
  id                 uuid primary key default gen_random_uuid(),
  conversacion_id    uuid not null unique references conversaciones (id),

  nombre             text,
  nombre_estado      dato_estado,
  fecha_entrevista   date not null,

  ingresos_netos_mensual        numeric,
  ingresos_netos_mensual_estado dato_estado,
  ingresos_estabilidad          text check (ingresos_estabilidad in ('estable', 'variable')),
  ingresos_estabilidad_estado   dato_estado,

  gastos_fijos_mensual          numeric,
  gastos_fijos_mensual_estado   dato_estado,

  -- Fallback de instrucciones-motor.md C17 cuando el detalle completo de deudas queda pendiente.
  deudas_interes_alto_declarado        text
    check (deudas_interes_alto_declarado in ('si', 'no', 'no_facilitado')),
  deudas_interes_alto_declarado_estado dato_estado,

  patrimonio_liquido            numeric,
  patrimonio_liquido_estado     dato_estado,
  patrimonio_invertido          numeric,
  patrimonio_invertido_estado   dato_estado,
  patrimonio_distribucion       text,
  patrimonio_distribucion_estado dato_estado,

  aportacion_mensual_actual        numeric,
  aportacion_mensual_actual_estado dato_estado,

  colchon_meses         numeric,
  colchon_meses_estado  dato_estado,

  objetivo_proposito        text,
  objetivo_proposito_estado dato_estado,
  objetivo_importe          numeric,
  objetivo_importe_estado   dato_estado,
  objetivo_plazo_anios          numeric,
  objetivo_plazo_anios_estado   dato_estado,

  riesgo_tolerancia_declarada        text
    check (riesgo_tolerancia_declarada in ('baja', 'media', 'alta')),
  riesgo_tolerancia_declarada_estado dato_estado,
  riesgo_comportamiento_real         text,
  riesgo_comportamiento_real_estado  dato_estado,
  -- Clasificado por la Fase 2 (agente): interpretar texto libre no es un calculo determinista.
  riesgo_perfil_derivado        text
    check (riesgo_perfil_derivado in ('conservador', 'moderado', 'dinamico')),
  riesgo_perfil_derivado_estado dato_estado,

  edad             int,
  edad_estado      dato_estado,
  personas_a_cargo         int,
  personas_a_cargo_estado  dato_estado,
  situacion_laboral        text,
  situacion_laboral_estado dato_estado,

  created_at timestamptz not null default now()
);

-- ── deudas ───────────────────────────────────────────────────────────────────
-- Grupo repetible de la ficha (0 a N filas). deudas_numero = 0 (caso borde C9) se representa
-- como ausencia de filas, no como una fila especial.
create table deudas (
  id             uuid primary key default gen_random_uuid(),
  ficha_id       uuid not null references fichas (id),
  orden          int not null,
  tipo           text,
  tipo_estado    dato_estado,
  importe        numeric,
  importe_estado dato_estado,
  cuota          numeric,
  cuota_estado   dato_estado,
  -- TAE en %. Decide si es "deuda cara" (R1, umbral 7-8%); pendiente si no se pudo ni estimar (C8).
  interes        numeric,
  interes_estado dato_estado
);
create index deudas_ficha_id_idx on deudas (ficha_id);

-- ── informes ─────────────────────────────────────────────────────────────────
-- Diagnóstico técnico interno generado por lib/motor/ (instrucciones-motor.md §7). Relación 1:1
-- con fichas en esta versión; si se reprocesa la misma ficha, se versiona con una fila nueva.
create table informes (
  id            uuid primary key default gen_random_uuid(),
  ficha_id      uuid not null references fichas (id),
  modo          text not null check (modo in ('completo', 'condicionado', 'suspendido')),
  tipo_meta     text
    check (tipo_meta in ('patrimonio', 'renta_cartera', 'renta_negocio', 'mixta_ambigua')),

  flujo_libre                  numeric,
  porcentaje_camino_recorrido  numeric,
  proyeccion_valor_futuro      numeric,
  gap_euros                    numeric,
  gap_anios                    numeric,
  aportacion_propuesta         numeric,
  cartera_objetivo             jsonb,
  rentabilidad_esperada_neta   numeric,

  -- Monte Carlo (R10, M-07) — nulos si el caso no cumple meta convertible + modo completo.
  mc_percentil_pesimista       numeric,
  mc_percentil_central         numeric,
  mc_percentil_optimista       numeric,
  mc_probabilidad_cumplimiento numeric,
  mc_banda                     text check (mc_banda in ('alta', 'razonable', 'fragil', 'baja')),

  contenido           jsonb not null,
  pendientes_reunion  jsonb not null default '[]'::jsonb,

  -- Trazabilidad: sin esto, un informe antiguo es imposible de reproducir si las reglas cambian.
  version_motor   text not null,
  version_reglas  text not null,

  created_at timestamptz not null default now()
);
create index informes_ficha_id_idx on informes (ficha_id);

-- ── planes ───────────────────────────────────────────────────────────────────
-- Lo que de verdad ve el visitante (Fase 4, instrucciones-motor.md §8) — separado de informes a
-- propósito: informes es el registro técnico interno, planes es su traducción ya entregada.
create table planes (
  id           uuid primary key default gen_random_uuid(),
  informe_id   uuid not null references informes (id),
  secciones    jsonb not null,
  markdown     text not null,
  -- Texto exacto del disclaimer mostrado con este plan, guardado con el plan (no solo con la
  -- plantilla), para auditar después qué vio cada visitante.
  descargo     text not null,
  generado_en  timestamptz not null default now()
);
create index planes_informe_id_idx on planes (informe_id);

-- ── notificaciones_asesor ────────────────────────────────────────────────────
-- Registro del aviso automático (M-05), para poder confirmar que se envió y depurar fallos.
create table notificaciones_asesor (
  id                uuid primary key default gen_random_uuid(),
  conversacion_id   uuid not null references conversaciones (id),
  destinatario      text not null,
  enviado_en        timestamptz,
  estado            text not null check (estado in ('enviado', 'fallido')),
  creado_en         timestamptz not null default now()
);
create index notificaciones_asesor_conversacion_id_idx on notificaciones_asesor (conversacion_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ══════════════════════════════════════════════════════════════════════════════
-- Ningún visitante habla con Supabase directamente: todas las escrituras pasan por app/api/chat/
-- en el servidor, con la clave de servicio (que no pasa por RLS). Por eso ninguna tabla lleva
-- policy de INSERT/UPDATE/DELETE para "authenticated" ni "anon" — todas las escrituras vienen del
-- backend. Solo se conceden policies de SELECT, y solo a quien está en la tabla asesores.

alter table asesores               enable row level security;
alter table clientes               enable row level security;
alter table conversaciones         enable row level security;
alter table limites_uso            enable row level security;
alter table fichas                 enable row level security;
alter table deudas                 enable row level security;
alter table informes               enable row level security;
alter table planes                 enable row level security;
alter table notificaciones_asesor  enable row level security;

-- Estar en la tabla asesores ES el permiso — no basta con que auth.uid() devuelva un valor.
-- security definer + search_path fijo: patrón recomendado de Supabase para evitar que la función
-- quede sujeta a las RLS de la tabla que consulta (si no, se autobloquearía).
create function es_asesor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from asesores where id = auth.uid());
$$;

create policy "asesores_select" on asesores
  for select to authenticated using (es_asesor());
create policy "clientes_select" on clientes
  for select to authenticated using (es_asesor());
create policy "conversaciones_select" on conversaciones
  for select to authenticated using (es_asesor());
create policy "fichas_select" on fichas
  for select to authenticated using (es_asesor());
create policy "deudas_select" on deudas
  for select to authenticated using (es_asesor());
create policy "informes_select" on informes
  for select to authenticated using (es_asesor());
create policy "planes_select" on planes
  for select to authenticated using (es_asesor());
create policy "notificaciones_asesor_select" on notificaciones_asesor
  for select to authenticated using (es_asesor());

-- limites_uso no lleva policy de SELECT: ni siquiera el asesor necesita leerla desde el cliente.
