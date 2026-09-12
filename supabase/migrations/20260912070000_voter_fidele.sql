-- LEQ, migration "voter_fidele". Corrects the previous migration's rewrite of `voter()`.
--
-- That rewrite was written from memory instead of from the original, and got three things wrong:
-- the ledger column is `montant` and not `points`, the motif is `vote` and not `vote_arene`
-- (a check constraint), and the reference is the vote's own id and not the pair key. The
-- function raised on every call, so nobody could vote at all.
--
-- This is the original, with the two guards that were the point of the change and nothing else:
-- a suspended account no longer votes, and a pair must be one the server actually offered.

create or replace function public.voter(p_gagnante uuid, p_perdante uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_g record;
  v_p record;
  v_points integer;
  v_vote uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  if p_gagnante = p_perdante then raise exception 'paire_invalide' using errcode = '23514'; end if;
  select * into v_g from public.prises_publiques where id = p_gagnante and statut = 'publiee';
  select * into v_p from public.prises_publiques where id = p_perdante and statut = 'publiee';
  if v_g.id is null or v_p.id is null then raise exception 'prise_introuvable' using errcode = 'P0002'; end if;
  if v_g.sujet_id is null or v_g.sujet_id <> v_p.sujet_id then
    raise exception 'paire_invalide' using errcode = '23514';
  end if;
  if v_g.utilisateur_id = v_uid or v_p.utilisateur_id = v_uid then
    raise exception 'vote_sur_soi' using errcode = '42501';
  end if;
  if not public.a_parle_sur(v_g.sujet_id) then
    raise exception 'parle_d_abord' using errcode = '42501';
  end if;

  -- Both takes must be ones this person was actually shown. `paire_a_voter()` writes an
  -- impression for each take it hands out; without this check, anyone could read the ranking,
  -- enumerate every take of the week and vote on every possible pair, deciding the podium alone
  -- and earning the per-vote points on each one.
  if not exists (select 1 from public.impressions i
                  where i.votant_id = v_uid and i.prise_id = p_gagnante)
     or not exists (select 1 from public.impressions i
                     where i.votant_id = v_uid and i.prise_id = p_perdante) then
    raise exception 'paire_invalide' using errcode = '23514';
  end if;

  insert into public.votes (votant_id, sujet_id, gagnante_id, perdante_id, paire)
  values (v_uid, v_g.sujet_id, p_gagnante, p_perdante, public.cle_paire(p_gagnante, p_perdante))
  on conflict (votant_id, paire) do nothing
  returning id into v_vote;
  if v_vote is null then
    raise exception 'deja_vote' using errcode = 'P0001';
  end if;

  update public.prises_publiques set votes_recus = votes_recus + 1 where id = p_gagnante;
  select coalesce((valeur #>> '{}')::integer, 5) into v_points
    from public.configuration where cle = 'points_par_vote';
  insert into public.mouvements_points (utilisateur_id, montant, motif, reference)
  values (v_uid, coalesce(v_points, 5), 'vote', v_vote::text)
  on conflict (motif, reference) do nothing;
end;
$$;
revoke execute on function public.voter(uuid, uuid) from public, anon;
grant execute on function public.voter(uuid, uuid) to authenticated;
