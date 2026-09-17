-- LEQ, migration "arene_publiee_sur_envoi" (2026-09-17).
--
-- The approval queue of Phase 7 is gone. It was my addition, not the cahier's: chapter 11 asks
-- that Rebecca can withdraw a public take or suspend an account, and nothing more. Held for
-- review, every take waited in a queue nobody was staffing, and Roch's own passage sat there for
-- a day. From now on:
--
--   1. A take is live the moment the person publishes it.
--   2. The worker screens the transcript of an Arena or duel take at analysis time and writes its
--      verdict in `analyses.moderation`. `publier_prise()` reads it: a flagged take gets the
--      status `signalee` and waits for Rebecca; everything else is `publiee` at once. A take the
--      screening never reached (no verdict) publishes: an outage of the filter must not close
--      the Arena.
--   3. A flag queues `notifier_moderation`: the person is told their passage waits, the admins
--      are told a take waits for them. Every decision of `moderer_prise()` queues the same job
--      with its decision, so the person learns it went live or was withdrawn.
--   4. Rebecca reads the transcript and the verdict of that public take through
--      `lire_prise_a_relire()`, admin only, scoped to public takes: nothing else of anyone's
--      analyses opens up. The storage policy lets an admin play the audio of a public take.
--
-- `en_moderation` disappears. The rows it held (one, Roch's) are published: nothing ever flagged
-- them.

-- ---------------------------------------------------------------------------
-- 1. The verdict, next to the transcript it was read from
-- ---------------------------------------------------------------------------

alter table public.analyses add column if not exists moderation jsonb;
comment on column public.analyses.moderation is
  'Verdict du filtre automatique sur la transcription : {version, signalee, categories, fournisseur, evalue_le}. Null pour une prise privée, ou quand le filtre n''a pas tourné.';

-- ---------------------------------------------------------------------------
-- 2. The statuses: signalee replaces en_moderation, and the default is live
-- ---------------------------------------------------------------------------

update public.prises_publiques set statut = 'publiee' where statut = 'en_moderation';
alter table public.prises_publiques drop constraint if exists prises_publiques_statut_check;
alter table public.prises_publiques
  add constraint prises_publiques_statut_check check (statut in ('signalee', 'publiee', 'retiree'));
alter table public.prises_publiques alter column statut set default 'publiee';
comment on column public.prises_publiques.statut is
  'publiee dès l''envoi ; signalee quand le filtre a retenu la prise pour Rebecca ; retiree par sa décision.';

-- ---------------------------------------------------------------------------
-- 3. publier_prise: the same guards, then the verdict decides
-- ---------------------------------------------------------------------------

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
  -- The copy kept for the length of the contest is what an Arena card and a duel verdict play.
  -- Without it the row would be published mute, and a silent card costs the person their whole
  -- week: nobody votes for a voice they cannot hear.
  if v_t.chemin_audio_public is null then
    raise exception 'analyse_incomplete' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.prises_publiques where tentative_id = p_tentative_id) then
    return (select id from public.prises_publiques where tentative_id = p_tentative_id);
  end if;

  -- The screening's verdict. A flagged take waits for Rebecca; anything else, a verdict that says
  -- nothing or no verdict at all, is live at once.
  select a.moderation into v_moderation from public.analyses a where a.tentative_id = p_tentative_id;
  v_statut := case
    when coalesce((v_moderation ->> 'signalee')::boolean, false) then 'signalee'
    else 'publiee'
  end;

  if v_t.type = 'arene' then
    select * into v_sujet from public.sujet_arene_actif();
    if v_sujet.id is null then raise exception 'aucun_sujet' using errcode = 'P0001'; end if;
    -- A clean refusal, so the person reads a sentence instead of a constraint error.
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
  end if;

  -- A flag is told at once: to the person, and to the admins who now have a decision to make.
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

-- ---------------------------------------------------------------------------
-- 4. moderer_prise: a decision is logged, and told to the person
-- ---------------------------------------------------------------------------

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
         -- A withdrawn take loses its audio at the next sweep (chapter 2); a published one keeps
         -- whatever deletion date its week or duel gave it.
         date_suppression = case when p_decision = 'retiree' then now() else date_suppression end
   where id = p_prise;
  if not found then raise exception 'prise introuvable' using errcode = 'P0002'; end if;
  insert into public.moderations (prise_id, decision, motif, decide_par)
  values (p_prise, p_decision, p_motif, (select auth.uid()))
  returning id into v_decision;
  -- The person learns the decision. One job per decision row: deciding twice tells twice, which
  -- is the truth, and a retry of the same decision never tells twice.
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
-- 5. What Rebecca reads before she decides: that take's transcript and verdict, nothing else
-- ---------------------------------------------------------------------------

create or replace function public.lire_prise_a_relire(p_prise uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  select jsonb_build_object(
           'texte', a.transcription ->> 'texte',
           'moderation', a.moderation,
           'prenom', pr.prenom)
    into v_resultat
    from public.prises_publiques p
    left join public.analyses a on a.tentative_id = p.tentative_id
    left join public.profils pr on pr.id = p.utilisateur_id
   where p.id = p_prise;
  if v_resultat is null then raise exception 'prise introuvable' using errcode = 'P0002'; end if;
  return v_resultat;
end;
$$;
revoke execute on function public.lire_prise_a_relire(uuid) from public, anon;
grant execute on function public.lire_prise_a_relire(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Rebecca listens: an admin may read the audio of any public take
-- ---------------------------------------------------------------------------

drop policy if exists audio_public_select on storage.objects;
create policy audio_public_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audio-public'
    and exists (
      select 1
        from public.prises_publiques p
       where p.chemin_audio = storage.objects.name
         and p.audio_supprime_le is null
         and (
           p.utilisateur_id = (select auth.uid())
           or (select public.est_admin())
           or (
             p.statut = 'publiee'
             and (
               (p.contexte = 'arene' and public.a_parle_sur(p.sujet_id))
               or (
                 p.contexte = 'duel'
                 and exists (
                   select 1 from public.duels d
                    where d.id = p.duel_id
                      and d.statut = 'clos'
                      and (d.inviteur_id = (select auth.uid()) or d.invite_id = (select auth.uid())))
               )
             )
           )
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. The dashboard counts what actually waits for her: the flagged takes
-- ---------------------------------------------------------------------------

create or replace function public.tableau_de_bord()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debut_semaine timestamptz := date_trunc('week', now());
  v_debut_mois timestamptz := date_trunc('month', now());
  v_plafond_annonces integer;
  v_sujet public.sujets_arene;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;

  select coalesce((valeur #>> '{}')::integer, 2) into v_plafond_annonces
    from public.configuration where cle = 'plafond_annonces_par_mois';
  select * into v_sujet from public.sujet_arene_actif();

  return jsonb_build_object(
    'a_traiter', jsonb_build_object(
      'moderation', (select count(*) from public.prises_publiques where statut = 'signalee'),
      'echanges', (select count(*) from public.echanges_recompenses where statut = 'a_traiter'),
      'demandes_donnees', (select count(*) from public.demandes_export where traitee_le is null)),
    'semaine', jsonb_build_object(
      'prises', (select count(*) from public.tentatives where cree_le >= v_debut_semaine),
      'personnes', (select count(distinct utilisateur_id) from public.tentatives
                     where cree_le >= v_debut_semaine),
      'defis_valides', (select count(*) from public.tentatives
                         where cree_le >= v_debut_semaine and resultat = 'etape_validee'),
      'comptes', (select count(*) from public.profils where cree_le >= v_debut_semaine)),
    'etat', jsonb_build_object(
      'drapeaux', coalesce((select jsonb_object_agg(cle, actif) from public.drapeaux), '{}'::jsonb),
      'sujet_arene', case when v_sujet.id is null then null else jsonb_build_object(
        'texte', v_sujet.texte,
        'jour', greatest(1, least(7, (extract(day from now() - v_sujet.actif_le)::int + 1)))) end,
      'annonces_ce_mois', (select count(*) from public.annonces where envoyee_le >= v_debut_mois),
      'plafond_annonces', coalesce(v_plafond_annonces, 2),
      'grille_publiee', exists (select 1 from public.grilles where publiee_le is not null)),
    'a_ecrire', jsonb_build_object(
      'defis', (select count(*) from public.defis where provisoire and actif),
      'exercices', (select count(*) from public.exercices where provisoire and actif),
      'recompenses', (select count(*) from public.recompenses where provisoire and actif),
      'sujets_arene', (select count(*) from public.sujets_arene where provisoire and actif),
      'theses', (select count(*) from public.theses where provisoire and actif)));
end;
$$;
revoke execute on function public.tableau_de_bord() from public, anon;
grant execute on function public.tableau_de_bord() to authenticated;
