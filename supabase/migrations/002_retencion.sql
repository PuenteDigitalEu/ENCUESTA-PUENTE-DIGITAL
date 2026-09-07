-- 002_retencion.sql — Job de purga a 24 meses (M-14). Ver docs/data-model.md §6.
--
-- Requiere pg_cron habilitado en el proyecto Supabase. En el SQL Editor esto lo habilita:
create extension if not exists pg_cron;

-- Purga diaria a las 03:30. Todo lo dependiente de una encuesta cae por `on delete cascade`
-- (respuestas → resultados_rubrica → diagnosticos; notificaciones_consultor). `contactos` se
-- purga aparte cuando ya no está referenciado por ninguna encuesta.
select cron.schedule(
  'purga-retencion',
  '30 3 * * *',
  $$
    delete from public.encuestas
      where iniciada_en < now() - interval '24 months';

    update public.encuestas set estado = 'abandonada'
      where estado in ('en_curso', 'respondida') and expira_en < now();

    delete from public.contactos c
      where not exists (select 1 from public.encuestas e where e.contacto_id = c.id);

    delete from public.limites_uso
      where creado_en < now() - interval '35 days';
  $$
);

-- Para ver o quitar el job:
--   select * from cron.job;
--   select cron.unschedule('purga-retencion');
