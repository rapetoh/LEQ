-- LEQ, migration "duel_prive_et_passages_nommes" (2026-09-18).
--
-- Roch answered his duel against Rebecca on build 28 and still could not hear her: the screen
-- offered « Écouter sa réponse » and the playback failed. Two faults, both mine.
--
--   1. **The automatic screening held her take, and a duel is private.** Her passage sits in
--      `signalee`, so the storage policy refuses it to anyone but her, while `cote_duel` handed
--      the path out anyway. Chapter 11 asks for the control to be « léger sur ce qui reste privé
--      et strict sur ce qui devient public », and it names the free entries that become public:
--      the Arena's passages and the face-à-face thesis. A duel take is read by one person, the
--      one who was challenged; holding it breaks the duel for both and nobody reviews a duel
--      flag. So the screening no longer holds a duel take: only an Arena passage can wait for
--      Rebecca. The verdict is still written next to the transcript, so a reported duel can be
--      read. Her passage, held by that filter, is published by this migration.
--   2. **`cote_duel` gave a path the storage would refuse.** It now hands a path only where the
--      policy would allow it, and says `retenue` when the other take is held or withdrawn, so
--      the screen says what happened instead of failing on a dead player.
--
--   3. **« Voix 2 » and « 2 voix » were the same word for two things.** An anonymous passage was
--      named « Voix N » while a vote is « une voix », so the ranking read « Voix 2 · 2 voix ».
--      A passage is « un passage » (chapter 11's own word, and the one the app already uses for
--      the person's own take), so an anonymous one is « Passage N ».

-- ---------------------------------------------------------------------------
-- 1. Only an Arena passage can be held by the screening
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

  if v_t.type = 'arene' then
    -- The screening's verdict, on what becomes public. A flagged passage waits for Rebecca;
    -- anything else, a verdict that says nothing or no verdict at all, is live at once.
    select a.moderation into v_moderation from public.analyses a where a.tentative_id = p_tentative_id;
    v_statut := case
      when coalesce((v_moderation ->> 'signalee')::boolean, false) then 'signalee'
      else 'publiee'
    end;
    select * into v_sujet from public.sujet_arene_actif();
    if v_sujet.id is null then raise exception 'aucun_sujet' using errcode = 'P0001'; end if;
    if exists (select 1 from public.prises_publiques
                where sujet_id = v_sujet.id and utilisateur_id = v_uid and statut <> 'retiree') then
      raise exception 'deja_publie' using errcode = 'P0001';
    end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, sujet_id, chemin_audio, statut)
    values (v_uid, p_tentative_id, 'arene', v_sujet.id, v_t.chemin_audio_public, v_statut)
    returning id into v_id;
    if v_statut = 'signalee' then
      insert into public.jobs (type, charge, cle_idempotence)
      values ('notifier_moderation',
              jsonb_build_object('prise_id', v_id, 'evenement', 'signalee'),
              'moderation:signalee:' || v_id::text)
      on conflict (cle_idempotence) do nothing;
    end if;
  else
    -- A duel is private: one person reads this take, the one who was challenged. The screening
    -- never holds it (chapter 11: light on what stays private), and its verdict stays readable
    -- next to the transcript should the duel ever be reported.
    select * into v_duel from public.duels
     where id = v_t.duel_id and statut = 'ouvert'
       and (inviteur_id = v_uid or invite_id = v_uid);
    if v_duel.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
    insert into public.prises_publiques (utilisateur_id, tentative_id, contexte, duel_id, chemin_audio, statut)
    values (v_uid, p_tentative_id, 'duel', v_duel.id, v_t.chemin_audio_public, 'publiee')
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
  return v_id;
end;
$$;
revoke execute on function public.publier_prise(uuid) from public, anon;
grant execute on function public.publier_prise(uuid) to authenticated;

-- The one duel take the filter held before this rule existed. Guarded on the context, so no
-- Arena passage waiting for Rebecca is touched.
update public.prises_publiques
   set statut = 'publiee'
 where contexte = 'duel' and statut = 'signalee';

-- ---------------------------------------------------------------------------
-- 2. A side of a duel hands out a path only where the storage would allow it
-- ---------------------------------------------------------------------------

/**
 * One side of a duel: whether they answered, what may be heard, how long, the measures once the
 * duel is closed, and `retenue` when the take exists but nobody may play it (held by the
 * screening, withdrawn, or its audio already deleted), so the screen says so instead of
 * offering a control that fails.
 */
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
              -- Exactly what `audio_public_select` allows: one's own take always, the other's
              -- only once the duel is closed and the take stands.
              'chemin_audio', case when p.audio_supprime_le is null
                                    and (p_moi or (p_duel.statut = 'clos' and p.statut = 'publiee'))
                                   then p.chemin_audio else null end,
              'retenue', p.audio_supprime_le is not null or p.statut <> 'publiee',
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
                       'retenue', false, 'duree_s', null, 'mesures', null));
$$;
revoke execute on function public.cote_duel(public.duels, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. An anonymous passage is « Passage N », never « Voix N »: a vote is a voix
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
  v_a_parle := public.a_parle_sur(v_sujet);
  select coalesce(jsonb_agg(ligne order by (ligne ->> 'rang')::int), '[]'::jsonb) into v_lignes
    from (
      select jsonb_build_object(
               'rang', rang,
               'prise_id', prise_id,
               'votes', votes,
               'moi', moi,
               'nom', case when (moi or publier_sous_prenom) and prenom is not null then prenom
                           else 'Passage ' || rang end,
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
