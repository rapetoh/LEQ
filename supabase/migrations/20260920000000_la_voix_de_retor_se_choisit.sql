-- ---------------------------------------------------------------------------------------------
-- La voix de Rétor se choisit.
--
-- Il parlait d'une seule voix, un homme, parce que c'est celle que j'avais choisie en écrivant
-- le code. Rien dans le produit ne l'impose, et s'entraîner à contredire quelqu'un n'a pas la
-- même couleur selon la voix qu'on a en face : la personne choisit, au moment où elle choisit
-- déjà le sujet et le ton.
--
-- La colonne garde « homme » ou « femme », pas le nom de la voix du fournisseur : le jour où on
-- change de fournisseur ou de voix, c'est une ligne de code et aucune migration de données.
-- Le coût ne bouge pas d'un centime : c'est le même modèle, la même facturation.
-- ---------------------------------------------------------------------------------------------

alter table public.debats
  add column if not exists voix_adversaire text not null default 'homme'
  check (voix_adversaire in ('homme', 'femme'));

comment on column public.debats.voix_adversaire is
  'La voix que la personne a choisie pour Rétor : homme ou femme.';

-- La signature change : l'ancienne fonction part, sinon les deux restent appelables et un appel
-- par position ne veut plus dire la même chose.
drop function if exists public.ouvrir_debat(uuid, text, text);

create or replace function public.ouvrir_debat(
  p_these_id uuid default null,
  p_these_texte text default null,
  p_ton text default null,
  p_voix text default null
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
  v_voix text;
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

  -- Une valeur qu'on ne connaît pas est la valeur par défaut, jamais un refus : la voix n'est
  -- pas une raison de ne pas ouvrir un débat.
  v_voix := case when btrim(coalesce(p_voix, '')) = 'femme' then 'femme' else 'homme' end;

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
                             ton_adversaire, voix_adversaire, duree_max_s)
  values (v_uid, p_these_id, v_texte, v_origine, v_ton, v_voix, coalesce(v_duree, 180))
  returning * into v_debat;
  return v_debat;
end;
$$;

revoke execute on function public.ouvrir_debat(uuid, text, text, text) from public, anon;
grant execute on function public.ouvrir_debat(uuid, text, text, text) to authenticated;
