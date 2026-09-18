-- LEQ, migration "numero_stable_et_ecoute_du_jour" (2026-09-18).
--
-- Two things the screens could not say, because the database was not answering them.
--
--   1. **« Anonyme N » moved when the votes moved.** The number came from the rank, so a passage
--      was « Anonyme 1 » in the morning and « Anonyme 3 » in the afternoon, and a person could
--      not tell the voice they had already heard from a new one. It is the order of arrival now:
--      « Anonyme 1 » is the first person who spoke this week, and it never changes. The rank
--      stays what it always was, the place by votes.
--   2. **The vote screen had no idea where the person stood.** Six passages a day is the
--      listening allowance (`prises_ecoutees_par_jour`), and the screen showed « Paire 3 » with
--      no total. `paire_a_voter()` answers `ecoutees` and `plafond` on every answer, so the
--      screen can draw the day's progress instead of a number that means nothing on its own.

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
               -- The number of a line with no name is its place in the week, not its place in
               -- the ranking: it must still name the same voice tomorrow.
               'nom', case when (moi or publier_sous_prenom) and prenom is not null then prenom
                           else 'Anonyme ' || arrivee end,
               'pseudonyme', not ((moi or publier_sous_prenom) and prenom is not null),
               'avatar', case when (moi or publier_sous_prenom) and prenom is not null then avatar_chemin
                              else null end,
               'duree_s', duree_s,
               'chemin_audio', case when (moi or v_a_parle) and audio_supprime_le is null
                                    then chemin_audio else null end
             ) as ligne
        from (
          select row_number() over (order by p.votes_recus desc, p.cree_le) as rang,
                 row_number() over (order by p.cree_le) as arrivee,
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
    return jsonb_build_object('raison', 'assez_ecoute', 'ecoutees', v_ecoutees, 'plafond', v_plafond);
  end if;

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
    return jsonb_build_object('raison', 'rien_a_comparer', 'autres', v_autres,
                              'ecoutees', v_ecoutees, 'plafond', v_plafond);
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
    return jsonb_build_object('raison', 'rien_a_comparer', 'autres', v_autres,
                              'ecoutees', v_ecoutees, 'plafond', v_plafond);
  end if;

  insert into public.impressions (votant_id, prise_id) values (v_uid, v_a.id), (v_uid, v_b.id)
  on conflict (votant_id, prise_id) do nothing;

  -- What this person has heard today, this pair included: the screen draws the day's listening
  -- from it instead of numbering pairs against nothing.
  select count(distinct i.prise_id) into v_ecoutees
    from public.impressions i
    join public.prises_publiques p on p.id = i.prise_id
   where i.votant_id = v_uid
     and p.sujet_id = v_sujet.id
     and i.cree_le >= date_trunc('day', now() at time zone coalesce(
           (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));

  return jsonb_build_object(
    'raison', 'ok',
    'sujet', jsonb_build_object('id', v_sujet.id, 'texte', v_sujet.texte, 'consigne', v_sujet.consigne),
    'ecoutees', v_ecoutees,
    'plafond', v_plafond,
    'a', jsonb_build_object('id', v_a.id, 'duree_s', v_a.duree_s),
    'b', jsonb_build_object('id', v_b.id, 'duree_s', v_b.duree_s));
end;
$$;
revoke execute on function public.paire_a_voter() from public, anon;
grant execute on function public.paire_a_voter() to authenticated;
