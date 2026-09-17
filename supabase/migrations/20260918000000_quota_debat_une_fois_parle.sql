-- LEQ, migration "quota_debat_une_fois_parle" (2026-09-18).
--
-- Found on Roch's phone on 2026-09-17: a debate whose audio never started on the phone stayed
-- `ouverte` with no turn at all. The chooser then read one session left, because an open row has
-- no `issue` and did not count. The next tap on « Commencer le débat » made `ouvrir_debat` close
-- that stale row as `abandonnee`, which made it count, then refused for `quota_epuise`, and the
-- exception rolled the close back. Every tap replayed the same loop: the screen said one, the
-- tap said none, and nothing the person could do would change either. Rebecca's account was in
-- the same state.
--
-- The rule becomes the one a person would state: a session is consumed once you have spoken in
-- it. A debate in which the person never said a word costs nothing, whatever closed it, and a
-- debate in which they did counts from their first turn, open or closed, so the number on the
-- chooser and the check behind the button are the same number. A session we cut ourselves still
-- costs nothing, as before (ADR-009).

create or replace function public.quota_debats(p_uid uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_uid, (select auth.uid()));
  v_formule text;
  v_plafond integer;
  v_utilises integer;
  v_debut timestamptz;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  -- A signed-in client reads its own quota and no one else's. A null uid here is the server.
  if (select auth.uid()) is not null and v_uid <> (select auth.uid()) then
    raise exception 'not yours' using errcode = '42501';
  end if;
  v_formule := public.formule_de(v_uid);
  select debats_par_mois into v_plafond from public.formules where cle = v_formule and actif;
  v_plafond := coalesce(v_plafond, 0);
  v_debut := date_trunc('month', now() at time zone coalesce(
    (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));
  -- Consumed: the person spoke in it, and we did not cut it ourselves. Open or closed alike.
  select count(*) into v_utilises
    from public.debats d
   where d.utilisateur_id = v_uid
     and d.commence_le >= v_debut
     and d.issue is distinct from 'interrompue_par_nous'
     and exists (select 1 from public.tours_debat x
                  where x.debat_id = d.id and x.locuteur = 'utilisateur');
  return jsonb_build_object(
    'formule', v_formule, 'plafond', v_plafond, 'utilises', v_utilises,
    'restants', greatest(v_plafond - v_utilises, 0));
end;
$$;

comment on column public.debats.issue is
  'Comment la session s''est finie. Le quota compte les sessions où la personne a parlé, sauf interrompue_par_nous.';
