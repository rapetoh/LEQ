-- LEQ, migration "la_semaine_recompense_ses_trois" (2026-09-19).
--
-- Roch: someone who wins a week must earn something for it. Nothing in the cahier or in
-- docs/OPEN-INPUTS.md said what: chapter 7 sets the points of a validated challenge and of a
-- vote, and stops there. So the three places of a closed week pay, through the ledger of
-- ADR-009 like everything else, with the amounts as configuration rows Rebecca can move:
-- 100, 50 and 25 against the 25 of a challenge and the 5 of a vote, so carrying a week is worth
-- four challenges and no more.
--
-- Two rules the amounts do not decide:
--   * a place pays only if it carried at least one vote, so a week nobody voted in pays nobody
--     and the first line, which is only the first to have spoken, earns nothing;
--   * the credit is keyed by the week and the person, so a rotation that runs twice, or a
--     retried job, never pays twice.
--
-- The podium reads what was actually paid from the ledger rather than recomputing it, so the
-- screen can never promise points that were not credited.

alter table public.mouvements_points drop constraint if exists mouvements_points_motif_check;
alter table public.mouvements_points add constraint mouvements_points_motif_check
  check (motif in ('defi_valide', 'vote', 'echange', 'remboursement', 'ajustement', 'podium_arene'));

insert into public.configuration (cle, type, valeur, description) values
  ('points_podium_arene_1', 'nombre', '100'::jsonb,
   'Points gagnés par la première place d''une semaine de l''Arène. 0 : la place ne rapporte rien.'),
  ('points_podium_arene_2', 'nombre', '50'::jsonb,
   'Points gagnés par la deuxième place d''une semaine de l''Arène.'),
  ('points_podium_arene_3', 'nombre', '25'::jsonb,
   'Points gagnés par la troisième place d''une semaine de l''Arène.')
on conflict (cle) do nothing;

/**
 * Credits the three places of a week that has just closed. Called by the rotation, inside its
 * own transaction; idempotent on (motif, reference).
 */
create or replace function public.recompenser_podium_arene(p_sujet uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payes integer := 0;
begin
  with places as (
    select p.utilisateur_id,
           row_number() over (order by p.votes_recus desc, p.cree_le) as rang,
           p.votes_recus as votes
      from public.prises_publiques p
     where p.sujet_id = p_sujet and p.statut = 'publiee'
  ),
  a_payer as (
    select places.utilisateur_id, places.rang,
           coalesce((c.valeur #>> '{}')::integer, 0) as montant
      from places
      left join public.configuration c
        on c.cle = 'points_podium_arene_' || places.rang::text
     where places.rang <= 3 and places.votes > 0
  )
  insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
  select utilisateur_id, montant, 'podium_arene', p_sujet::text || ':' || utilisateur_id::text
    from a_payer
   where montant > 0
  on conflict (motif, reference) do nothing;
  get diagnostics v_payes = row_count;
  return v_payes;
end;
$$;
revoke execute on function public.recompenser_podium_arene(uuid) from public, anon, authenticated;
grant execute on function public.recompenser_podium_arene(uuid) to service_role;

-- The rotation pays the week it closes. Faithful copy of the function, one call added.
create or replace function public.roter_sujet_arene()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jours integer;
  v_courant public.sujets_arene;
  v_suivant public.sujets_arene;
  v_ferme uuid;
begin
  select coalesce((valeur #>> '{}')::integer, 7) into v_jours
    from public.configuration where cle = 'duree_sujet_arene_jours';
  v_jours := coalesce(v_jours, 7);

  select * into v_courant from public.sujet_arene_actif();
  if v_courant.id is not null then
    if v_courant.actif_le + make_interval(days => v_jours) > now() then
      -- The week is not over: nothing closed, the same subject stays active.
      return jsonb_build_object('ferme', null, 'actif', v_courant.id);
    end if;
    update public.sujets_arene set ferme_le = now() where id = v_courant.id;
    v_ferme := v_courant.id;
    -- The audio of the closed week goes; the ranking stays (chapter 2).
    update public.prises_publiques
       set date_suppression = now()
     where sujet_id = v_courant.id and date_suppression is null;
    -- The three places of that week are paid, once (2026-09-19).
    perform public.recompenser_podium_arene(v_courant.id);
  end if;

  select * into v_suivant from public.sujets_arene
   where actif and actif_le is null
   order by (prevu_le is not null and prevu_le <= current_date) desc,
            case when prevu_le is not null and prevu_le <= current_date then prevu_le end,
            ordre
   limit 1;
  if v_suivant.id is null then
    return jsonb_build_object('ferme', v_ferme, 'actif', null);
  end if;
  update public.sujets_arene set actif_le = now() where id = v_suivant.id;
  return jsonb_build_object('ferme', v_ferme, 'actif', v_suivant.id);
end;
$$;
revoke execute on function public.roter_sujet_arene() from public;
revoke execute on function public.roter_sujet_arene() from anon, authenticated;
grant execute on function public.roter_sujet_arene() to service_role;

-- The ranking carries what each place was actually paid, read from the ledger so the screen
-- never promises points nobody received.
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
  select ferme_le is not null into v_fermee from public.sujets_arene where id = v_sujet;
  v_fermee := coalesce(v_fermee, false);
  select coalesce(jsonb_agg(ligne order by (ligne ->> 'rang')::int), '[]'::jsonb) into v_lignes
    from (
      select jsonb_build_object(
               'rang', rang,
               'prise_id', prise_id,
               'votes', votes,
               'moi', moi,
               'nom', case when nomme and prenom is not null then prenom
                           else 'Anonyme ' || arrivee end,
               'pseudonyme', not (nomme and prenom is not null),
               'avatar', case when nomme and prenom is not null then avatar_chemin else null end,
               'duree_s', duree_s,
               'points', points,
               'chemin_audio', case when (moi or v_a_parle) and audio_supprime_le is null
                                    then chemin_audio else null end
             ) as ligne
        from (
          select rang, arrivee, prise_id, votes, moi, chemin_audio, audio_supprime_le, duree_s,
                 prenom, avatar_chemin,
                 (moi or publier_sous_prenom or (v_fermee and rang <= 3)) as nomme,
                 -- `brut.` is not decoration: unqualified, `utilisateur_id` binds to the
                 -- ledger's own column inside the subquery and matches every row of it.
                 coalesce((select m.montant from public.mouvements_points m
                            where m.motif = 'podium_arene'
                              and m.reference = v_sujet::text || ':' || brut.utilisateur_id::text), 0)
                   as points
            from (
              select row_number() over (order by p.votes_recus desc, p.cree_le) as rang,
                     row_number() over (order by p.cree_le) as arrivee,
                     p.id as prise_id,
                     p.utilisateur_id,
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
