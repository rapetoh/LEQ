-- ---------------------------------------------------------------------------------------------
-- Répondre à un duel sans dire qui on est.
--
-- The invitation link opens in a browser, signs the person in anonymously and lets them record.
-- Nothing asked who they were: the person who sent the invitation was told they had been answered
-- by an account with no name, and there was no way to reach whoever had spoken.
--
-- Someone answering without the application gives a first name and an e-mail before the slot is
-- claimed. The first name becomes their profile's, so the duel names them; the e-mail stays on
-- the duel, because an anonymous profile has no account to hang it on.
-- ---------------------------------------------------------------------------------------------

alter table public.duels add column if not exists invite_prenom text;
alter table public.duels add column if not exists invite_email text;
comment on column public.duels.invite_email is 'Donnée par l''invité sans compte, pour que la personne qui a invité sache qui a répondu.';

drop function if exists public.rejoindre_duel(text);

create or replace function public.rejoindre_duel(
  p_jeton text,
  p_prenom text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_d public.duels;
  v_anonyme boolean := (select public.est_anonyme());
  v_prenom text := nullif(btrim(coalesce(p_prenom, '')), '');
  v_email text := nullif(btrim(lower(coalesce(p_email, ''))), '');
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if (select public.est_suspendu()) then raise exception 'compte_suspendu' using errcode = '42501'; end if;
  select * into v_d from public.duels where jeton = p_jeton for update;
  if v_d.id is null then raise exception 'duel_introuvable' using errcode = 'P0002'; end if;
  if v_d.statut <> 'ouvert' then raise exception 'duel_clos' using errcode = 'P0001'; end if;
  if v_d.echeance <= now() then raise exception 'duel_expire' using errcode = 'P0001'; end if;
  if v_d.inviteur_id = v_uid then raise exception 'duel_sur_soi' using errcode = '42501'; end if;
  if v_d.invite_id is not null and v_d.invite_id <> v_uid then
    raise exception 'duel_complet' using errcode = 'P0001';
  end if;

  -- Someone answering by the link has no account: without a name the inviter is told they were
  -- answered by nobody, and there is no way to reach the person afterwards.
  if v_anonyme then
    if v_prenom is null then raise exception 'prenom_requis' using errcode = '23514'; end if;
    if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'email_requis' using errcode = '23514';
    end if;
    update public.profils set prenom = v_prenom where id = v_uid;
  end if;

  update public.duels
     set invite_id = v_uid,
         invite_prenom = coalesce(v_prenom, invite_prenom),
         invite_email = coalesce(v_email, invite_email)
   where id = v_d.id;
  return v_d.id;
end;
$$;
revoke execute on function public.rejoindre_duel(text, text, text) from public;
revoke execute on function public.rejoindre_duel(text, text, text) from anon;
grant execute on function public.rejoindre_duel(text, text, text) to authenticated;
