-- LEQ, migration "photo_de_profil" (2026-09-17).
--
-- A person may put a picture on their account (Roch's request, Mon compte). It is shown on Moi,
-- on Mon compte, and next to their name where their name is shown: the Arena ranking and the
-- podium. It is never shown where the name is hidden behind « Voix N », so the opt-in of G3
-- (publier_sous_prenom) governs the picture exactly as it governs the first name.
--
-- Why a public bucket: the picture is shown to everyone who sees the name, on every ranking
-- line, and a signed URL per line per screen is a round trip for nothing. The path is
-- `<uid>/<horodatage>.jpg`, a new object per change, so a cached image never survives a change
-- and the previous object is deleted by the phone. Deleting an account deletes the folder
-- (the worker's bucket list, apps/serveur/src/stockage.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A person writes only under their own folder. Reading is public by the bucket itself.
drop policy if exists avatars_insert_propre on storage.objects;
create policy avatars_insert_propre on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not (select public.est_anonyme())
  );

drop policy if exists avatars_update_propre on storage.objects;
create policy avatars_update_propre on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_delete_propre on storage.objects;
create policy avatars_delete_propre on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The column is the object path inside `avatars`, never a full URL.
alter table public.profils add column if not exists avatar_chemin text;
comment on column public.profils.avatar_chemin is
  'Chemin dans le bucket avatars, <uid>/<horodatage>.jpg. Null sans photo.';

-- The ranking carries the picture where it carries the name, and says when the name is a
-- pseudonym so the phone draws a neutral mark instead of a letter that means nothing. A person
-- reads their own first name on their own line whatever their opt-in: they know who they are.
create or replace function public.classement_arene(p_sujet uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sujet uuid := p_sujet;
  v_lignes jsonb;
begin
  if v_sujet is null then
    select id into v_sujet from public.sujet_arene_actif();
  end if;
  if v_sujet is null then return jsonb_build_object('sujet_id', null, 'classement', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(ligne order by (ligne ->> 'rang')::int), '[]'::jsonb) into v_lignes
    from (
      select jsonb_build_object(
               'rang', rang,
               'prise_id', prise_id,
               'votes', votes,
               'moi', moi,
               'nom', case when (moi or publier_sous_prenom) and prenom is not null then prenom
                           else 'Voix ' || rang end,
               'pseudonyme', not ((moi or publier_sous_prenom) and prenom is not null),
               'avatar', case when (moi or publier_sous_prenom) and prenom is not null then avatar_chemin
                              else null end
             ) as ligne
        from (
          select row_number() over (order by p.votes_recus desc, p.cree_le) as rang,
                 p.id as prise_id,
                 p.votes_recus as votes,
                 p.utilisateur_id = (select auth.uid()) as moi,
                 pr.publier_sous_prenom,
                 pr.prenom,
                 pr.avatar_chemin
            from public.prises_publiques p
            join public.profils pr on pr.id = p.utilisateur_id
           where p.sujet_id = v_sujet and p.statut = 'publiee'
        ) brut
    ) lignes;
  return jsonb_build_object('sujet_id', v_sujet, 'classement', v_lignes);
end;
$$;
revoke execute on function public.classement_arene(uuid) from public, anon;
grant execute on function public.classement_arene(uuid) to authenticated;
