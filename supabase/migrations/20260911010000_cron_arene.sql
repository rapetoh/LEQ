-- LEQ, migration "cron_arene" (Phase 7). pg_cron only inserts jobs; the worker executes them.
-- Three schedules for the Arena and duels, idempotent (cron.schedule replaces by name).

do $leq$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- The rotation checks every hour; roter_sujet_arene() itself does nothing before the week is over.
    perform cron.schedule(
      'leq_roter_sujet_arene',
      '5 * * * *',
      $job$
        insert into public.jobs (type, charge, cle_idempotence)
        values ('roter_sujet_arene', '{}'::jsonb, 'arene:' || date_trunc('hour', now())::text)
        on conflict (cle_idempotence) do nothing
      $job$
    );
    perform cron.schedule(
      'leq_fermer_duels',
      '*/15 * * * *',
      $job$
        insert into public.jobs (type, charge, cle_idempotence)
        values ('fermer_duels', '{}'::jsonb, 'duels:' || date_trunc('minute', now())::text)
        on conflict (cle_idempotence) do nothing
      $job$
    );
    perform cron.schedule(
      'leq_supprimer_audio_public',
      '*/30 * * * *',
      $job$
        insert into public.jobs (type, charge, cle_idempotence)
        values ('supprimer_audio_public', '{}'::jsonb, 'audiopublic:' || date_trunc('minute', now())::text)
        on conflict (cle_idempotence) do nothing
      $job$
    );
  end if;
end
$leq$;
