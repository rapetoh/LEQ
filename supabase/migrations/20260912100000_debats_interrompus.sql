-- ---------------------------------------------------------------------------------------------
-- Une coupure est gratuite tant qu'on peut revenir dedans.
--
-- A session cut on our side costs nothing, which is right: our outage is not the person's
-- problem (chapter 10). But nothing ever closed those sessions afterwards, so killing the app
-- instead of pressing « Terminer » gave a whole face-à-face for free, every time.
--
-- The window is the line. Inside it the session is waiting to be resumed and costs nothing.
-- Past it, a session where the person actually spoke is counted like any other; a session where
-- nothing was ever said still costs nothing, because nothing was used.
-- ---------------------------------------------------------------------------------------------

create or replace function public.fermer_debats_interrompus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
  n integer;
begin
  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  v_minutes := coalesce(v_minutes, 30);

  update public.debats d
     set statut = 'abandonnee', issue = 'abandonnee', termine_le = now(), session_id = null
   where d.statut = 'interrompue'
     and d.issue = 'interrompue_par_nous'
     and d.derniere_activite_le < now() - make_interval(mins => v_minutes)
     and exists (
       select 1 from public.tours_debat t
        where t.debat_id = d.id and t.locuteur = 'utilisateur');
  get diagnostics n = row_count;
  return n;
end;
$$;
comment on function public.fermer_debats_interrompus() is 'Ferme les sessions coupées que personne n''est venu reprendre. Celles où rien n''a été dit restent gratuites.';
revoke execute on function public.fermer_debats_interrompus() from public;
revoke execute on function public.fermer_debats_interrompus() from anon, authenticated;
grant execute on function public.fermer_debats_interrompus() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'leq_fermer_debats_interrompus',
      '*/10 * * * *',
      $job$ select public.fermer_debats_interrompus() $job$
    );
  else
    raise notice 'pg_cron absent: leq_fermer_debats_interrompus was not scheduled';
  end if;
end;
$$;
