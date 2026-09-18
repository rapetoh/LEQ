-- LEQ, migration "arene_ecoutable_duels_lisibles" (2026-09-18).
--
-- Roch, on build 26, with two people in the Arena and one duel answered by the link:
--
--   1. The ranking listed « Voix 2 » and nothing let him hear it. The only way to hear another
--      passage was the vote, and a vote needs two other passages. With one, `paire_a_voter()`
--      answered `rien_a_comparer` and the screen said « Tu as tout écouté » to someone who had
--      heard nothing. Chapter 11 masks the others' takes until you have spoken; it never said
--      they stay masked afterwards. The ranking now carries the path of every passage the caller
--      may hear (their own, and the others' once they have spoken), and the pair function says
--      how many other passages exist when it has no pair to offer, so the screen can say the
--      truth: nobody else yet, one other (listen to it in the ranking), or every pair voted.
--   2. « Tu peux le réécouter ou le retirer » was on the Arena card and nothing withdrew a take.
--      `retirer_ma_prise()` does, by the person, while the subject is open; a withdrawn take
--      leaves the ranking, loses its audio at the next sweep, and the person may publish another.
--      `retiree_par` says who withdrew it, so the screen can tell Rebecca's decision from the
--      person's own gesture.
--   3. The duel screen said « À toi de parler » and nothing else: not who had joined, not that
--      she had already answered, not that her take would be heard after his. `mes_duels()`
--      answers, for each duel of the caller, the other person's name and picture, whether each
--      side has spoken, the paths each side may hear, the length of each take, and once the duel
--      is closed the three measures of each take, so a duel the grid cannot judge yet still
--      shows what was measured.
--   4. A duel closed up to fifteen minutes after the second answer, by the cron. The second
--      `publier_prise()` now closes it on the spot. And the audio of a closed duel used to be
--      marked for deletion at closing, so it was gone within thirty minutes of the verdict,
--      before the inviter had opened the app. It now stays `duree_duel_heures` after the verdict
--      (chapter 2: the time of the contest; the contest includes hearing the other side).
--   5. Nobody was told anything: not that someone joined, not that they answered, not the
--      verdict. Every event queues `notifier_duel`; the worker pushes the other side and, for
--      an invitee who answered by the link, sends the e-mail the page promised.

-- ---------------------------------------------------------------------------
-- 1. The ranking carries what the caller may hear, and how long each passage is
-- ---------------------------------------------------------------------------

create or replace function public.classement_arene(p_sujet uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sujet uuid := p_sujet;
  v_a_parle boolean;
  v_lignes jsonb;
begin
  if v_sujet is null then
    select id into v_sujet from public.sujet_arene_actif();
  end if;
  if v_sujet is null then return jsonb_build_object('sujet_id', null, 'classement', '[]'::jsonb); end if;
  -- Chapter 11: the others' takes stay masked until you have spoken. Own take: always.
  v_a_parle := public.a_parle_sur(v_sujet);
  select coalesce(jsonb_agg(ligne order by (ligne ->> 'rang')::int), '[]'::jsonb) into v_lignes
    from (
      select jsonb_build_object(
               'rang', rang,
               'prise_id', prise_id,
               'votes', votes,
               'moi', moi,
               'nom', case when (moi or publier_sous_prenom) and prenom is not null then prenom
                           else 'Voix ' || rang end,
               'pseudonyme', not ((moi or publier_sous_prenom) and prenom is not null),
               'avatar', case when (moi or publier_sous_prenom) and prenom is not null then avatar_chemin
                              else null end,
               'duree_s', duree_s,
               'chemin_audio', case when (moi or v_a_parle) and audio_supprime_le is null
                                    then chemin_audio else null end
             ) as ligne
        from (
          select row_number() over (order by p.votes_recus desc, p.cree_le) as rang,
                 p.id as prise_id,
                 p.votes_recus as votes,
                 p.utilisateur_id = v_uid as moi,
                 p.chemin_audio,
                 p.audio_supprime_le,
                 t.duree_s,
                 pr.publier_sous_prenom,
                 pr.prenom,
                 pr.avatar_chemin
            from public.prises_publiques p
            join public.profils pr on pr.id = p.utilisateur_id
            join public.tentatives t on t.id = p.tentative_id
           where p.sujet_id = v_sujet and p.statut = 'publiee'
        ) brut
    ) lignes;
  return jsonb_build_object('sujet_id', v_sujet, 'classement', v_lignes);
end;
$$;
revoke execute on function public.classement_arene(uuid) from public, anon;
grant execute on function public.classement_arene(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The pair says why there is none, and how long each voice is
-- ---------------------------------------------------------------------------

create or replace function public.paire_a_voter()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sujet public.sujets_arene;
  v_a record;
  v_b record;
  v_plafond integer;
  v_ecoutees integer;
  v_autres integer;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_sujet from public.sujet_arene_actif();
  if v_sujet.id is null then
    return jsonb_build_object('raison', 'aucun_sujet');
  end if;
  if not public.a_parle_sur(v_sujet.id) then
    return jsonb_build_object('raison', 'parle_d_abord');
  end if;

  select coalesce((valeur #>> '{}')::integer, 6) into v_plafond
    from public.configuration where cle = 'prises_ecoutees_par_jour';
  v_plafond := coalesce(v_plafond, 6);
  select count(distinct i.prise_id) into v_ecoutees
    from public.impressions i
    join public.prises_publiques p on p.id = i.prise_id
   where i.votant_id = v_uid
     and p.sujet_id = v_sujet.id
     and i.cree_le >= date_trunc('day', now() at time zone coalesce(
           (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));
  if v_plafond > 0 and v_ecoutees >= v_plafond then
    return jsonb_build_object('raison', 'assez_ecoute');
  end if;

  -- How many other passages there are at all: the screen says « nobody else yet », « one other,
  -- listen to it in the ranking » or « you have heard every pair » from this number.
  select count(*) into v_autres
    from public.prises_publiques p
   where p.sujet_id = v_sujet.id and p.statut = 'publiee' and p.utilisateur_id <> v_uid;

  select p.id, p.utilisateur_id, t.duree_s,
         (select count(*) from public.impressions i where i.prise_id = p.id and i.votant_id = v_uid) as vues
    into v_a
    from public.prises_publiques p
    join public.tentatives t on t.id = p.tentative_id
   where p.sujet_id = v_sujet.id and p.statut = 'publiee' and p.utilisateur_id <> v_uid
   order by vues, p.votes_recus, random()
   limit 1;
  if v_a.id is null then
    return jsonb_build_object('raison', 'rien_a_comparer', 'autres', v_autres);
  end if;

  select p.id, t.duree_s
    into v_b
    from public.prises_publiques p
    join public.tentatives t on t.id = p.tentative_id
   where p.sujet_id = v_sujet.id and p.statut = 'publiee' and p.utilisateur_id <> v_uid
     and p.id <> v_a.id
     and not exists (
       select 1 from public.votes v
        where v.votant_id = v_uid and v.paire = public.cle_paire(v_a.id, p.id))
   order by (select count(*) from public.impressions i where i.prise_id = p.id and i.votant_id = v_uid),
            p.votes_recus, random()
   limit 1;
  if v_b.id is null then
    return jsonb_build_object('raison', 'rien_a_comparer', 'autres', v_autres);
  end if;

  insert into public.impressions (votant_id, prise_id) values (v_uid, v_a.id), (v_uid, v_b.id)
  on conflict (votant_id, prise_id) do nothing;

  return jsonb_build_object(
    'raison', 'ok',
    'sujet', jsonb_build_object('id', v_sujet.id, 'texte', v_sujet.texte, 'consigne', v_sujet.consigne),
    'a', jsonb_build_object('id', v_a.id, 'duree_s', v_a.duree_s),
    'b', jsonb_build_object('id', v_b.id, 'duree_s', v_b.duree_s));
end;
$$;
revoke execute on function public.paire_a_voter() from public, anon;
grant execute on function public.paire_a_voter() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A person withdraws their own passage
-- ---------------------------------------------------------------------------

alter table public.prises_publiques
  add column if not exists retiree_par text check (retiree_par in ('personne', 'admin'));
comment on column public.prises_publiques.retiree_par is
  'Qui a retiré la prise : la personne elle-même, ou Rebecca (admin). Null tant qu''elle n''est pas retirée.';

-- One passage per person per week counts the passages that stand: a withdrawn one leaves room
-- for another, which is what « le retirer » promises.
drop index if exists public.prises_publiques_une_par_semaine_idx;
create unique index prises_publiques_une_par_semaine_idx
  on public.prises_publiques (sujet_id, utilisateur_id)
  where sujet_id is not null and statut <> 'retiree';

create or replace function public.retirer_ma_prise(p_prise uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_p public.prises_publiques;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_p from public.prises_publiques
   where id = p_prise and utilisateur_id = v_uid and contexte = 'arene' for update;
  if v_p.id is null then raise exception 'prise_introuvable' using errcode = 'P0002'; end if;
  if v_p.statut = 'retiree' then return; end if;
  -- Only while the subject is open: a closed week keeps its ranking as it ended.
  if v_p.sujet_id is distinct from (select id from public.sujet_arene_actif()) then
    raise exception 'sujet_ferme' using errcode = 'P0001';
  end if;
  update public.prises_publiques
     set statut = 'retiree',
         retiree_par = 'personne',
         motif_retrait = null,
         date_suppression = now()
   where id = v_p.id;
end;
$$;
revoke execute on function public.retirer_ma_prise(uuid) from public, anon;
grant execute on function public.retirer_ma_prise(uuid) to authenticated;

-- Rebecca's withdrawal says so too. Faithful copy of the function, one column added.
create or replace function public.moderer_prise(p_prise uuid, p_decision text, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decision uuid;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_decision not in ('publiee', 'retiree') then
    raise exception 'decision inconnue' using errcode = '23514';
  end if;
  update public.prises_publiques
     set statut = p_decision,
         motif_retrait = case when p_decision = 'retiree' then p_motif else null end,
         retiree_par = case when p_decision = 'retiree' then 'admin' else null end,
         date_suppression = case when p_decision = 'retiree' then now() else date_suppression end
   where id = p_prise;
  if not found then raise exception 'prise introuvable' using errcode = 'P0002'; end if;
  insert into public.moderations (prise_id, decision, motif, decide_par)
  values (p_prise, p_decision, p_motif, (select auth.uid()))
  returning id into v_decision;
  insert into public.jobs (type, charge, cle_idempotence)
  values ('notifier_moderation',
          jsonb_build_object('prise_id', p_prise, 'evenement', p_decision),
          'moderation:' || p_decision || ':' || p_prise::text || ':' || v_decision::text)
  on conflict (cle_idempotence) do nothing;
end;
$$;
revoke execute on function public.moderer_prise(uuid, text, text) from public, anon;
grant execute on function public.moderer_prise(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The duels of the caller, read the way the screen needs them
-- ---------------------------------------------------------------------------

/**
 * One row per duel of the caller. `adversaire` is null until someone joins. `moi` and `lui`
 * say whether each side has spoken; a path is given only where the storage policy would let
 * the caller play it (their own take while it exists, the other's once the duel is closed);
 * the measures of both takes come only once the duel is closed, so nobody reads the other's
 * analysis before having spoken. The token is given to the inviter only, to share the link again.
 */
create or replace function public.mes_duels()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lignes jsonb;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(ligne order by cree_le desc), '[]'::jsonb) into v_lignes
    from (
      select d.cree_le,
             jsonb_build_object(
               'id', d.id,
               'sujet', d.sujet,
               'statut', d.statut,
               'verdict', d.verdict,
               'echeance', d.echeance,
               'cree_le', d.cree_le,
               'clos_le', d.clos_le,
               'duree_max_s', d.duree_max_s,
               'role', case when d.inviteur_id = v_uid then 'inviteur' else 'invite' end,
               'jeton', case when d.inviteur_id = v_uid then d.jeton else null end,
               'adversaire', case
                 when d.inviteur_id = v_uid and d.invite_id is null then null
                 when d.inviteur_id = v_uid then jsonb_build_object(
                   'prenom', coalesce(nullif(btrim(coalesce(d.invite_prenom, '')), ''), pv.prenom),
                   'avatar', pv.avatar_chemin)
                 else jsonb_build_object('prenom', pi.prenom, 'avatar', pi.avatar_chemin)
               end,
               'moi', public.cote_duel(d, v_uid, true),
               'lui', public.cote_duel(d, case when d.inviteur_id = v_uid then d.invite_id else d.inviteur_id end, false)
             ) as ligne
        from public.duels d
        left join public.profils pi on pi.id = d.inviteur_id
        left join public.profils pv on pv.id = d.invite_id
       where d.inviteur_id = v_uid or d.invite_id = v_uid
    ) lignes;
  return v_lignes;
end;
$$;

/** One side of a duel: spoken or not, what may be heard, how long, and the measures once closed. */
create or replace function public.cote_duel(p_duel public.duels, p_qui uuid, p_moi boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'a_parle', true,
              'prise_id', p.id,
              'chemin_audio', case when p.audio_supprime_le is null
                                    and (p_moi or p_duel.statut = 'clos')
                                   then p.chemin_audio else null end,
              'duree_s', t.duree_s,
              'mesures', case when p_duel.statut = 'clos' then jsonb_build_object(
                  'mots_par_minute', (a.mesures #>> '{debit,mots_par_minute}')::numeric,
                  'bequilles', (a.mesures #>> '{mots_bequilles,total}')::integer,
                  'silences_tenus', (a.mesures #>> '{silences,tenus}')::integer)
                else null end)
       from public.prises_publiques p
       join public.tentatives t on t.id = p.tentative_id
       left join public.analyses a on a.tentative_id = p.tentative_id
      where p.duel_id = p_duel.id and p.utilisateur_id = p_qui and p_qui is not null
      limit 1),
    jsonb_build_object('a_parle', false, 'prise_id', null, 'chemin_audio', null,
                       'duree_s', null, 'mesures', null));
$$;
revoke execute on function public.cote_duel(public.duels, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.mes_duels() from public, anon;
grant execute on function public.mes_duels() to authenticated;

-- The invitation names the person who sent it. Faithful copy, one field added.
create or replace function public.lire_duel_par_jeton(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d public.duels;
  v_uid uuid := (select auth.uid());
begin
  select * into v_d from public.duels where jeton = p_jeton;
  if v_d.id is null then return jsonb_build_object('raison', 'introuvable'); end if;
  return jsonb_build_object(
    'raison', 'ok',
    'id', v_d.id,
    'sujet', v_d.sujet,
    'statut', v_d.statut,
    'duree_max_s', v_d.duree_max_s,
    'echeance', v_d.echeance,
    'deja_repondu', v_d.invite_id is not null,
    'c_est_moi', v_uid is not null and v_d.invite_id = v_uid,
    'c_est_mon_duel', v_uid is not null and v_d.inviteur_id = v_uid,
    'inviteur_prenom', (select prenom from public.profils where id = v_d.inviteur_id));
end;
$$;
grant execute on function public.lire_duel_par_jeton(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Every event of a duel queues its notification
-- ---------------------------------------------------------------------------

/** Queues `notifier_duel` once per event and actor: a retry never tells the same thing twice. */
create or replace function public.notifier_duel(p_duel uuid, p_evenement text, p_acteur uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.jobs (type, charge, cle_idempotence)
  values ('notifier_duel',
          jsonb_strip_nulls(jsonb_build_object('duel_id', p_duel, 'evenement', p_evenement, 'acteur_id', p_acteur)),
          'duel:' || p_evenement || ':' || p_duel::text || coalesce(':' || p_acteur::text, ''))
  on conflict (cle_idempotence) do nothing;
$$;
revoke execute on function public.notifier_duel(uuid, text, uuid) from public, anon, authenticated;

-- Joining tells the inviter. Faithful copy of the function, the queue added on the first join.
create or replace function public.rejoindre_duel(
  p_jeton text,
  p_prenom text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_d public.duels;
  v_anonyme boolean := (select public.est_anonyme());
  v_prenom text := nullif(btrim(coalesce(p_prenom, '')), '');
  v_email text := nullif(btrim(lower(coalesce(p_email, ''))), '');
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

  if v_anonyme then
    if v_prenom is null then raise exception 'prenom_requis' using errcode = '23514'; end if;
    if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'email_requis' using errcode = '23514';
    end if;
    update public.profils set prenom = v_prenom where id = v_uid;
  end if;

  update public.duels
     set invite_id = v_uid,
         invite_prenom = coalesce(v_prenom, invite_prenom),
         invite_email = coalesce(v_email, invite_email)
   where id = v_d.id;
  if v_d.invite_id is null then
    perform public.notifier_duel(v_d.id, 'rejoint', v_uid);
  end if;
  return v_d.id;
end;
$$;
revoke execute on function public.rejoindre_duel(text, text, text) from public;
revoke execute on function public.rejoindre_duel(text, text, text) from anon;
grant execute on function public.rejoindre_duel(text, text, text) to authenticated;

-- Closing tells both sides, and keeps the two voices audible for the length of a duel after the
-- verdict. Faithful copy of the function otherwise.
create or replace function public.cloturer_duel(p_duel uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.duels;
  v_inviteur numeric;
  v_invite numeric;
  v_a_parle_inviteur boolean;
  v_a_parle_invite boolean;
  v_verdict text;
  v_heures integer;
begin
  select * into v_d from public.duels where id = p_duel for update;
  if v_d.id is null or v_d.statut <> 'ouvert' then return null; end if;

  select exists (select 1 from public.prises_publiques p
                  where p.duel_id = v_d.id and p.utilisateur_id = v_d.inviteur_id),
         exists (select 1 from public.prises_publiques p
                  where p.duel_id = v_d.id and p.utilisateur_id = v_d.invite_id)
    into v_a_parle_inviteur, v_a_parle_invite;

  if not v_a_parle_inviteur or not v_a_parle_invite then
    if v_d.echeance > now() then return null; end if;  -- still time to answer
    update public.duels set statut = 'expire', clos_le = now() where id = v_d.id;
    update public.prises_publiques set date_suppression = now()
     where duel_id = v_d.id and date_suppression is null;
    perform public.notifier_duel(v_d.id, 'expire');
    return 'expire';
  end if;

  select e.note_totale into v_inviteur
    from public.prises_publiques p
    join public.evaluations e on e.tentative_id = p.tentative_id
   where p.duel_id = v_d.id and p.utilisateur_id = v_d.inviteur_id;
  select e.note_totale into v_invite
    from public.prises_publiques p
    join public.evaluations e on e.tentative_id = p.tentative_id
   where p.duel_id = v_d.id and p.utilisateur_id = v_d.invite_id;

  v_verdict := case
    when v_inviteur is null or v_invite is null then 'sans_verdict'
    when v_inviteur > v_invite then 'inviteur'
    when v_invite > v_inviteur then 'invite'
    else 'egalite' end;
  update public.duels set statut = 'clos', verdict = v_verdict, clos_le = now() where id = v_d.id;
  -- The two voices stay the length of a duel after the verdict, so each side can hear the
  -- other; then they go (chapter 2).
  select coalesce((valeur #>> '{}')::integer, 48) into v_heures
    from public.configuration where cle = 'duree_duel_heures';
  update public.prises_publiques
     set date_suppression = now() + make_interval(hours => coalesce(v_heures, 48))
   where duel_id = v_d.id and date_suppression is null;
  perform public.notifier_duel(v_d.id, 'verdict');
  return v_verdict;
end;
$$;
revoke execute on function public.cloturer_duel(uuid) from public, anon, authenticated;
grant execute on function public.cloturer_duel(uuid) to service_role;

-- The second answer closes the duel on the spot; the first one tells the other side. Faithful
-- copy of the function otherwise.
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
  v_moderation jsonb;
  v_statut text;
  v_autre_a_parle boolean;
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
  if v_t.chemin_audio_public is null then
    raise exception 'analyse_incomplete' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prises_publiques where tentative_id = p_tentative_id) then
    return (select id from public.prises_publiques where tentative_id = p_tentative_id);
  end if;

  select a.moderation into v_moderation from public.analyses a where a.tentative_id = p_tentative_id;
  v_statut := case
    when coalesce((v_moderation ->> 'signalee')::boolean, false) then 'signalee'
    else 'publiee'
  end;

  if v_t.type = 'arene' then
    select * into v_sujet from public.sujet_arene_actif();
    if v_sujet.id is null then raise exception 'aucun_sujet' using errcode = 'P0001'; end if;
    if exists (select 1 from public.prises_publiques
                where sujet_id = v_sujet.id and utilisateur_id = v_uid and statut <> 'retiree') then
      raise exception 'deja_publie' using errcode = 'P0001';
    end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, sujet_id, chemin_audio, statut)
    values (v_uid, p_tentative_id, 'arene', v_sujet.id, v_t.chemin_audio_public, v_statut)
    returning id into v_id;
  else
    select * into v_duel from public.duels
     where id = v_t.duel_id and statut = 'ouvert'
       and (inviteur_id = v_uid or invite_id = v_uid);
    if v_duel.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, duel_id, chemin_audio, statut)
    values (v_uid, p_tentative_id, 'duel', v_duel.id, v_t.chemin_audio_public, v_statut)
    returning id into v_id;
    -- Both have spoken: the verdict is rendered now, and closing tells both sides. Otherwise the
    -- other side learns that this one has answered.
    select exists (select 1 from public.prises_publiques p
                    where p.duel_id = v_duel.id and p.utilisateur_id <> v_uid)
      into v_autre_a_parle;
    if v_autre_a_parle then
      perform public.cloturer_duel(v_duel.id);
    else
      perform public.notifier_duel(v_duel.id, 'repondu', v_uid);
    end if;
  end if;

  if v_statut = 'signalee' then
    insert into public.jobs (type, charge, cle_idempotence)
    values ('notifier_moderation',
            jsonb_build_object('prise_id', v_id, 'evenement', 'signalee'),
            'moderation:signalee:' || v_id::text)
    on conflict (cle_idempotence) do nothing;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.publier_prise(uuid) from public, anon;
grant execute on function public.publier_prise(uuid) to authenticated;
