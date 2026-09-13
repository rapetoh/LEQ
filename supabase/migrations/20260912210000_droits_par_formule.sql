-- ---------------------------------------------------------------------------------------------
-- Les droits se lisent sur la formule, plus sur des clés nommées une par formule.
--
-- `etapes_par_jour_gratuit`, `quota_face_a_face_complet`, `duree_face_a_face_gratuit_s` : chaque
-- droit avait une clé par formule, donc une troisième formule demandait une clé de plus partout
-- et une livraison. Les trois fonctions qui décident ce à quoi une personne a droit lisent
-- maintenant la ligne de sa formule.
--
-- Les anciennes clés restent en base sans être lues : les effacer ici jetterait des valeurs que
-- Rebecca a peut-être déjà changées, et la table `formules` en est partie.
-- ---------------------------------------------------------------------------------------------

create or replace function public.etape_du_jour()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_parcours uuid;
  v_tz text;
  v_jour date;
  v_formule text;
  v_lim_etapes integer;
  v_lim_essais integer;
  v_validees integer;
  v_essais integer := 0;
  v_etape record;
  v_raison text;
  v_nb_etapes_acte integer;
  v_a_des_etapes boolean;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  v_parcours := public.obtenir_parcours();
  select coalesce(fuseau_horaire, 'Europe/Paris') into v_tz from public.profils where id = v_uid;
  v_tz := coalesce(v_tz, 'Europe/Paris');
  v_jour := (now() at time zone v_tz)::date;
  v_formule := public.formule_de(v_uid);

  -- The tier's own row, so a third tier is a setting and not a release.
  select etapes_par_jour into v_lim_etapes from public.formules where cle = v_formule and actif;
  v_lim_etapes := coalesce(v_lim_etapes, 1);
  select coalesce((valeur #>> '{}')::integer, 3) into v_lim_essais from public.configuration where cle = 'essais_max_etape_par_jour';
  v_lim_essais := coalesce(v_lim_essais, 3);

  select count(*) into v_validees
    from public.etapes e
   where e.parcours_id = v_parcours and e.statut = 'validee'
     and (e.validee_le at time zone v_tz)::date = v_jour;

  select e.id, e.ordre_global, e.ordre, e.statut, e.nombre_echecs, e.rattrapage_propose, e.seuil_reussite,
         a.ordre as acte_ordre, a.titre as acte_titre, a.sous_titre as acte_sous_titre, a.id as acte_id,
         d.id as defi_id, d.cle, d.format, d.titre, d.consigne, d.focus, d.plan, d.texte_a_lire,
         d.duree_lecture_s, d.duree_preparation_s, d.duree_max_s, d.points, d.competence, d.provisoire
    into v_etape
    from public.etapes e
    join public.actes a on a.id = e.acte_id
    join public.defis d on d.id = e.defi_id
   where e.parcours_id = v_parcours and e.statut = 'disponible'
   order by e.ordre_global
   limit 1;

  select exists (select 1 from public.etapes where parcours_id = v_parcours) into v_a_des_etapes;

  if v_etape.id is not null then
    select count(*) into v_essais
      from public.tentatives t
     where t.utilisateur_id = v_uid and t.type = 'etape' and t.etape_id = v_etape.id
       and t.statut <> 'abandon_technique'
       and (t.enregistre_le at time zone v_tz)::date = v_jour;
    select count(*) into v_nb_etapes_acte from public.etapes where acte_id = v_etape.acte_id;
  end if;

  v_raison := case
    when v_etape.id is null and v_a_des_etapes then 'parcours_termine'
    when v_etape.id is null then 'aucune_etape'
    when v_lim_etapes > 0 and v_validees >= v_lim_etapes then 'limite_jour'
    when v_lim_essais > 0 and v_essais >= v_lim_essais then 'limite_essais'
    else 'ok'
  end;

  return jsonb_build_object(
    'formule', v_formule,
    'rythme', jsonb_build_object(
      'jour', v_jour,
      'fuseau_horaire', v_tz,
      'etapes_validees_aujourdhui', v_validees,
      'essais_aujourdhui', v_essais,
      'limite_etapes', v_lim_etapes,
      'limite_essais', v_lim_essais,
      'peut_enregistrer', v_raison = 'ok',
      'raison', v_raison
    ),
    'etape', case when v_etape.id is null then null else jsonb_build_object(
      'id', v_etape.id, 'ordre_global', v_etape.ordre_global, 'ordre', v_etape.ordre, 'statut', v_etape.statut,
      'nombre_echecs', v_etape.nombre_echecs, 'rattrapage_propose', v_etape.rattrapage_propose,
      'seuil_reussite', v_etape.seuil_reussite, 'nb_etapes_acte', v_nb_etapes_acte
    ) end,
    'acte', case when v_etape.id is null then null else jsonb_build_object(
      'id', v_etape.acte_id, 'ordre', v_etape.acte_ordre, 'titre', v_etape.acte_titre, 'sous_titre', v_etape.acte_sous_titre
    ) end,
    'defi', case when v_etape.id is null then null else jsonb_build_object(
      'id', v_etape.defi_id, 'cle', v_etape.cle, 'format', v_etape.format, 'titre', v_etape.titre,
      'consigne', v_etape.consigne, 'focus', v_etape.focus, 'plan', v_etape.plan, 'texte_a_lire', v_etape.texte_a_lire,
      'duree_lecture_s', v_etape.duree_lecture_s, 'duree_preparation_s', v_etape.duree_preparation_s,
      'duree_max_s', v_etape.duree_max_s, 'points', v_etape.points, 'competence', v_etape.competence,
      'provisoire', v_etape.provisoire
    ) end
  );
end;
$$;
revoke execute on function public.etape_du_jour() from public, anon;
grant execute on function public.etape_du_jour() to authenticated, service_role;

create or replace function public.quota_debats(p_uid uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(p_uid, (select auth.uid()));
  v_formule text;
  v_plafond integer;
  v_utilises integer;
  v_debut timestamptz;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  -- A signed-in client reads its own quota and no one else's. A null uid here is the server.
  if (select auth.uid()) is not null and v_uid <> (select auth.uid()) then
    raise exception 'not yours' using errcode = '42501';
  end if;
  v_formule := public.formule_de(v_uid);
  select debats_par_mois into v_plafond from public.formules where cle = v_formule and actif;
  v_plafond := coalesce(v_plafond, 0);
  v_debut := date_trunc('month', now() at time zone coalesce(
    (select fuseau_horaire from public.profils where id = v_uid), 'Europe/Paris'));
  select count(*) into v_utilises
    from public.debats
   where utilisateur_id = v_uid
     and commence_le >= v_debut
     and issue is distinct from 'interrompue_par_nous'
     and issue is not null;
  return jsonb_build_object(
    'formule', v_formule, 'plafond', v_plafond, 'utilises', v_utilises,
    'restants', greatest(v_plafond - v_utilises, 0));
end;
$$;
revoke execute on function public.quota_debats(uuid) from public, anon;
grant execute on function public.quota_debats(uuid) to authenticated, service_role;

create or replace function public.ouvrir_debat(
  p_these_id uuid default null,
  p_these_texte text default null,
  p_ton text default null
)
returns public.debats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_these public.theses;
  v_texte text;
  v_origine text;
  v_ton text;
  v_duree integer;
  v_minutes integer;
  v_quota jsonb;
  v_debat public.debats;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_anonyme()) then raise exception 'compte_requis' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  if not exists (select 1 from public.drapeaux where cle = 'face_a_face' and actif) then
    raise exception 'face_a_face_eteint' using errcode = 'P0001';
  end if;

  -- The thesis is checked before anything else: a malformed request is a malformed request,
  -- whatever the state of the person's sessions.
  if p_these_id is not null then
    select * into v_these from public.theses where id = p_these_id and actif;
    if v_these.id is null then raise exception 'these_introuvable' using errcode = 'P0002'; end if;
    v_texte := v_these.texte;
    v_origine := 'banque';
    v_ton := coalesce(nullif(btrim(coalesce(p_ton, '')), ''), v_these.ton_suggere);
  else
    v_texte := btrim(coalesce(p_these_texte, ''));
    if v_texte = '' then raise exception 'these_requise' using errcode = '23514'; end if;
    v_origine := 'personnelle';
    v_ton := coalesce(nullif(btrim(coalesce(p_ton, '')), ''), 'ferme');
  end if;

  select coalesce((valeur #>> '{}')::integer, 30) into v_minutes
    from public.configuration where cle = 'reprise_debat_minutes';
  v_minutes := coalesce(v_minutes, 30);

  if exists (
    select 1 from public.debats
     where utilisateur_id = v_uid and statut = 'ouverte'
       and derniere_activite_le > now() - make_interval(mins => v_minutes)
  ) then
    raise exception 'debat_en_cours' using errcode = 'P0001';
  end if;

  -- An older open session was walked away from: it consumes its slot and stops blocking.
  update public.debats
     set statut = 'abandonnee', issue = 'abandonnee', termine_le = now()
   where utilisateur_id = v_uid and statut = 'ouverte';

  v_quota := public.quota_debats(v_uid);
  if (v_quota ->> 'restants')::integer <= 0 then
    raise exception 'quota_epuise' using errcode = 'P0001';
  end if;

  select duree_debat_s into v_duree
    from public.formules where cle = (v_quota ->> 'formule') and actif;

  insert into public.debats (utilisateur_id, these_id, these_texte, origine_these,
                             ton_adversaire, duree_max_s)
  values (v_uid, p_these_id, v_texte, v_origine, v_ton, coalesce(v_duree, 180))
  returning * into v_debat;
  return v_debat;
end;
$$;
revoke execute on function public.ouvrir_debat(uuid, text, text) from public, anon;
grant execute on function public.ouvrir_debat(uuid, text, text) to authenticated;
