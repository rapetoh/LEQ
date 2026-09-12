-- LEQ, migration "boutique_image". The shop query carries the reward's image with the rest of
-- the row, so the phone draws a card in one query instead of two.

-- The shop carries the image with the rest of a reward, so the phone needs no second query.
create or replace function public.mes_recompenses()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'points', public.points_de((select auth.uid())),
    'recompenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'cle', r.cle, 'ordre', r.ordre, 'type', r.type, 'titre', r.titre,
        'sous_titre', r.sous_titre, 'description', r.description, 'cout_points', r.cout_points,
        'plafond_par_mois', r.plafond_par_mois, 'echangeable', r.echangeable, 'provisoire', r.provisoire,
        'image_chemin', r.image_chemin,
        'restantes_ce_mois', case when r.plafond_par_mois is null then null
                                  else greatest(r.plafond_par_mois - public.echanges_du_mois(r.id), 0) end,
        'mes_echanges', (select count(*) from public.echanges_recompenses e
                          where e.recompense_id = r.id and e.utilisateur_id = (select auth.uid()) and e.statut <> 'annule'))
        order by r.ordre)
      from public.recompenses r where r.actif), '[]'::jsonb),
    'echanges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'recompense_id', e.recompense_id, 'titre', r.titre, 'cout_points', e.cout_points,
        'statut', e.statut, 'cree_le', e.cree_le, 'traite_le', e.traite_le)
        order by e.cree_le desc)
      from public.echanges_recompenses e join public.recompenses r on r.id = e.recompense_id
      where e.utilisateur_id = (select auth.uid())), '[]'::jsonb));
$$;
revoke execute on function public.mes_recompenses() from public, anon;
grant execute on function public.mes_recompenses() to authenticated;
