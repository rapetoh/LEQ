-- LEQ, migration "tableau_de_bord". What the space shows Rebecca when she opens it.
--
-- The home page was a list of cards pointing at the pages already in the left menu, which told
-- her nothing she could not see by looking at the menu. What she actually needs on opening is
-- three things: what is waiting for a decision from her, what the product is doing this week,
-- and what is still missing before LEQ can be published.
--
-- One function, one round trip, admin only. Counting these in the browser would mean a dozen
-- queries and a dozen chances to be inconsistent with each other.

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
    -- 1. What is waiting for her. These are the numbers that mean "open this page today".
    'a_traiter', jsonb_build_object(
      'moderation', (select count(*) from public.prises_publiques where statut = 'en_moderation'),
      'echanges', (select count(*) from public.echanges_recompenses where statut = 'a_traiter'),
      'demandes_donnees', (select count(*) from public.demandes_export where traitee_le is null)),

    -- 2. What the product did this week. Recorded attempts, not accounts: someone who speaks is
    -- the only activity that means anything here.
    'semaine', jsonb_build_object(
      'prises', (select count(*) from public.tentatives where cree_le >= v_debut_semaine),
      'personnes', (select count(distinct utilisateur_id) from public.tentatives
                     where cree_le >= v_debut_semaine),
      'defis_valides', (select count(*) from public.tentatives
                         where cree_le >= v_debut_semaine and resultat = 'etape_validee'),
      'comptes', (select count(*) from public.profils where cree_le >= v_debut_semaine)),

    -- 3. Where the product stands: what is live, the week running, the announcements left.
    'etat', jsonb_build_object(
      'drapeaux', coalesce((select jsonb_object_agg(cle, actif) from public.drapeaux), '{}'::jsonb),
      'sujet_arene', case when v_sujet.id is null then null else jsonb_build_object(
        'texte', v_sujet.texte,
        'jour', greatest(1, least(7, (extract(day from now() - v_sujet.actif_le)::int + 1)))) end,
      'annonces_ce_mois', (select count(*) from public.annonces where envoyee_le >= v_debut_mois),
      'plafond_annonces', coalesce(v_plafond_annonces, 2),
      'grille_publiee', exists (select 1 from public.grilles where publiee_le is not null)),

    -- 4. What is still provisional, which is the honest answer to "what is left to write".
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
