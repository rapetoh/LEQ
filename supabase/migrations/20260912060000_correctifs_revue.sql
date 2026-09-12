-- LEQ, migration "correctifs_revue". Defects found by a review of everything built since
-- Phase 7, each one confirmed against the project before being fixed.

-- ---------------------------------------------------------------------------
-- 1. A published take was always silent
-- ---------------------------------------------------------------------------
-- The pipeline deletes the audio object and nulls `tentatives.chemin_audio` before it sets
-- `retour_disponible`, and `publier_prise` requires that status. So it copied NULL, every time:
-- the Arena asked people to compare two voices they could not hear, and the duel verdict had
-- nothing to play. Chapter 2 is explicit that an Arena or duel take stays online for the time of
-- the contest, so the worker keeps a copy in `audio-public` and records where.

alter table public.tentatives
  add column if not exists chemin_audio_public text;
comment on column public.tentatives.chemin_audio_public is
  'Copie dans audio-public, gardée le temps du concours pour une prise d''Arène ou de duel. Null pour tout le reste.';

create or replace function public.publier_prise(p_tentative_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_t record;
  v_sujet public.sujets_arene;
  v_duel record;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;

  select * into v_t from public.tentatives where id = p_tentative_id and utilisateur_id = v_uid;
  if v_t.id is null then raise exception 'tentative_introuvable' using errcode = 'P0002'; end if;
  if v_t.type not in ('arene', 'duel') then
    raise exception 'type_incompatible' using errcode = '23514';
  end if;
  if v_t.type = 'arene' and (select public.est_anonyme()) then
    raise exception 'compte_requis' using errcode = '42501';
  end if;
  if v_t.statut <> 'retour_disponible' then
    raise exception 'analyse_incomplete' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prises_publiques where tentative_id = p_tentative_id) then
    return (select id from public.prises_publiques where tentative_id = p_tentative_id);
  end if;

  if v_t.type = 'arene' then
    select * into v_sujet from public.sujet_arene_actif();
    if v_sujet.id is null then raise exception 'aucun_sujet' using errcode = 'P0001'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, sujet_id, chemin_audio)
    values (v_uid, p_tentative_id, 'arene', v_sujet.id, v_t.chemin_audio_public)
    returning id into v_id;
  else
    select * into v_duel from public.duels
     where id = v_t.duel_id and statut = 'ouvert'
       and (inviteur_id = v_uid or invite_id = v_uid);
    if v_duel.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, duel_id, chemin_audio)
    values (v_uid, p_tentative_id, 'duel', v_duel.id, v_t.chemin_audio_public)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.publier_prise(uuid) from public, anon;
grant execute on function public.publier_prise(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. A suspended account could still vote and still join duels
-- ---------------------------------------------------------------------------
-- Every sibling function refuses one. These two did not, so someone suspended for abusing the
-- Arena kept steering its ranking and kept earning points for doing it.

create or replace function public.voter(p_gagnante uuid, p_perdante uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sujet uuid;
  v_points integer;
  v_paire text;
  v_insere boolean;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  if p_gagnante = p_perdante then raise exception 'paire_invalide' using errcode = '23514'; end if;

  select p.sujet_id into v_sujet from public.prises_publiques p
   where p.id = p_gagnante and p.statut = 'publiee';
  if v_sujet is null then raise exception 'prise_introuvable' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.prises_publiques p
                  where p.id = p_perdante and p.statut = 'publiee' and p.sujet_id = v_sujet) then
    raise exception 'paire_invalide' using errcode = '23514';
  end if;
  if exists (select 1 from public.prises_publiques p
              where p.id in (p_gagnante, p_perdante) and p.utilisateur_id = v_uid) then
    raise exception 'vote_sur_soi' using errcode = '42501';
  end if;
  if not public.a_parle_sur(v_sujet) then
    raise exception 'parle_d_abord' using errcode = '42501';
  end if;

  -- The pair must be one the server actually offered. Without this, anyone could read the
  -- ranking, enumerate every take and vote on every possible pair: one person could decide the
  -- podium and farm the points that buy a workshop seat.
  if not exists (
    select 1 from public.impressions i
     where i.votant_id = v_uid and i.prise_id = p_gagnante
  ) or not exists (
    select 1 from public.impressions i
     where i.votant_id = v_uid and i.prise_id = p_perdante
  ) then
    raise exception 'paire_invalide' using errcode = '23514';
  end if;

  v_paire := public.cle_paire(p_gagnante, p_perdante);
  insert into public.votes (votant_id, sujet_id, gagnante_id, perdante_id, paire)
  values (v_uid, v_sujet, p_gagnante, p_perdante, v_paire)
  on conflict (votant_id, paire) do nothing
  returning true into v_insere;
  if v_insere is null then raise exception 'deja_vote' using errcode = '23505'; end if;

  update public.prises_publiques set votes_recus = votes_recus + 1 where id = p_gagnante;

  select coalesce((valeur #>> '{}')::integer, 5) into v_points
    from public.configuration where cle = 'points_par_vote';
  insert into public.mouvements_points (utilisateur_id, points, motif, reference)
  values (v_uid, coalesce(v_points, 5), 'vote_arene', v_paire)
  on conflict (motif, reference) do nothing;
end;
$$;
revoke execute on function public.voter(uuid, uuid) from public, anon;
grant execute on function public.voter(uuid, uuid) to authenticated;

create or replace function public.rejoindre_duel(p_jeton text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_d public.duels;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  select * into v_d from public.duels where jeton = p_jeton for update;
  if v_d.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'ouvert' then raise exception 'duel_clos' using errcode = 'P0001'; end if;
  if v_d.echeance <= now() then raise exception 'duel_expire' using errcode = 'P0001'; end if;
  if v_d.inviteur_id = v_uid then raise exception 'duel_sur_soi' using errcode = '42501'; end if;
  if v_d.invite_id is not null and v_d.invite_id <> v_uid then
    raise exception 'duel_complet' using errcode = 'P0001';
  end if;
  update public.duels set invite_id = v_uid where id = v_d.id;
  return v_d.id;
end;
$$;
revoke execute on function public.rejoindre_duel(text) from public, anon;
grant execute on function public.rejoindre_duel(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Anyone could read another person's plan through their quota
-- ---------------------------------------------------------------------------
-- `quota_debats(p_uid)` took any identifier and never checked it against the caller. A duel
-- participant reads their opponent's id, so they could learn whether that person subscribes.

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
  select coalesce((valeur #>> '{}')::integer, 0) into v_plafond
    from public.configuration
   where cle = case when v_formule = 'complet' then 'quota_face_a_face_complet'
                    else 'quota_face_a_face_gratuit' end;
  v_plafond := coalesce(v_plafond, 0);
  v_debut := date_trunc('month', now() at time zone coalesce(
    (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));
  select count(*) into v_utilises
    from public.debats
   where utilisateur_id = v_uid
     and commence_le >= v_debut
     and issue is distinct from 'interrompue_par_nous'
     and issue is not null;
  return jsonb_build_object(
    'formule', v_formule, 'plafond', v_plafond, 'utilises', v_utilises,
    'restants', greatest(v_plafond - v_utilises, 0));
end;
$$;
revoke execute on function public.quota_debats(uuid) from public, anon;
grant execute on function public.quota_debats(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. An interrupted debate could never be resumed
-- ---------------------------------------------------------------------------
-- A dropped socket closed the session as `interrompue`, and every resume path requires
-- `ouverte`. So E3b offered a "Reprendre" button that always answered "ce débat est terminé",
-- and the per-turn writes that exist precisely to make a resume possible were for nothing.

create or replace function public.debat_a_reprendre()
returns setof public.debats
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_minutes integer;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  return query
    select * from public.debats
     where utilisateur_id = v_uid
       and (statut = 'ouverte' or (statut = 'interrompue' and issue = 'interrompue_par_nous'))
       and derniere_activite_le > now() - make_interval(mins => coalesce(v_minutes, 30))
     order by derniere_activite_le desc
     limit 1;
end;
$$;
revoke execute on function public.debat_a_reprendre() from public, anon;
grant execute on function public.debat_a_reprendre() to authenticated;

/**
 * Reopens a session that our own cut closed, when the person comes back inside the window.
 * Answers the debate, or nothing when there is none to reopen. Service role: the server calls
 * it when a socket says hello about an interrupted debate.
 */
create or replace function public.reprendre_debat(p_debat uuid)
returns setof public.debats
language plpgsql
security definer
set search_path = ''
as $$
declare v_minutes integer;
begin
  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  return query
    update public.debats
       set statut = 'ouverte', issue = null, termine_le = null, derniere_activite_le = now()
     where id = p_debat
       and statut = 'interrompue'
       and issue = 'interrompue_par_nous'
       and derniere_activite_le > now() - make_interval(mins => coalesce(v_minutes, 30))
    returning *;
end;
$$;
revoke execute on function public.reprendre_debat(uuid) from public, anon, authenticated;
grant execute on function public.reprendre_debat(uuid) to service_role;
