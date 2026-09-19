-- LEQ, migration "le_podium_nomme_ses_trois" (2026-09-19).
--
-- Roch, on the podium of a closed week: whoever won has to be named, with their picture, even
-- when they never asked to publish under their first name. His reason is that the recordings are
-- gone by then, so a name attached to nothing is what makes the page unreadable as a result.
--
-- The plan's rule (docs/OPEN-INPUTS.md) was « anonymity during the votes, names on the podium
-- only for the people who opted in ». The half that matters is the first one: chapter 11 wants
-- the vote anonymous so the week is not a popularity contest between people who know each other.
-- That concern lives entirely inside the week, while the votes are open. Once the week is
-- closed, no vote can be swayed and there is nothing left to hear, so naming the three who
-- carried it takes nothing away from the rule and gives the result its meaning.
--
-- So: the first three lines of a **closed** week carry the first name and the picture whatever
-- the person chose; the fourth line down keeps « Anonyme N », and nothing changes while the week
-- is open. The switch of Réglages and of the publishing screen says exactly this, in the same
-- change, because it is a promise made to the person before they speak.

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
  v_fermee boolean;
  v_lignes jsonb;
begin
  if v_sujet is null then
    select id into v_sujet from public.sujet_arene_actif();
  end if;
  if v_sujet is null then return jsonb_build_object('sujet_id', null, 'classement', '[]'::jsonb); end if;
  v_a_parle := public.a_parle_sur(v_sujet);
  -- A closed week: the votes are counted and the recordings are gone.
  select ferme_le is not null into v_fermee from public.sujets_arene where id = v_sujet;
  v_fermee := coalesce(v_fermee, false);
  select coalesce(jsonb_agg(ligne order by (ligne ->> 'rang')::int), '[]'::jsonb) into v_lignes
    from (
      select jsonb_build_object(
               'rang', rang,
               'prise_id', prise_id,
               'votes', votes,
               'moi', moi,
               -- One's own line always, an opted-in name always, and the three of a closed
               -- week's podium: a result nobody can be named in is not a result.
               'nom', case when nomme and prenom is not null then prenom
                           else 'Anonyme ' || arrivee end,
               'pseudonyme', not (nomme and prenom is not null),
               'avatar', case when nomme and prenom is not null then avatar_chemin else null end,
               'duree_s', duree_s,
               'chemin_audio', case when (moi or v_a_parle) and audio_supprime_le is null
                                    then chemin_audio else null end
             ) as ligne
        from (
          select rang, arrivee, prise_id, votes, moi, chemin_audio, audio_supprime_le, duree_s,
                 prenom, avatar_chemin,
                 (moi or publier_sous_prenom or (v_fermee and rang <= 3)) as nomme
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
        ) nomme
    ) lignes;
  return jsonb_build_object('sujet_id', v_sujet, 'classement', v_lignes);
end;
$$;
revoke execute on function public.classement_arene(uuid) from public, anon;
grant execute on function public.classement_arene(uuid) to authenticated;
