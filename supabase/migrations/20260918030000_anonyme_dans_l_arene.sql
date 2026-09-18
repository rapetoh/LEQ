-- LEQ, migration "anonyme_dans_l_arene" (2026-09-18).
--
-- What an Arena line calls a person who has not opted in. It was « Voix N », which collided with
-- « N voix », the votes; this morning it became « Passage N », which reads as a name for
-- something that has none. Roch chose the word that says the thing itself: « Anonyme ». The
-- number stays so two lines are told apart, and « passage » goes back to meaning only what it
-- means everywhere else in the app, the recording itself.
--
-- Whether a person appears under their first name and picture or under this label is theirs to
-- set: `profils.publier_sous_prenom`, offered in Réglages and at the moment a passage is sent.

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
                           else 'Anonyme ' || rang end,
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
