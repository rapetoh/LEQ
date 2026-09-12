-- LEQ, migration "medias". A picture on what Rebecca publishes.
--
-- An atelier, an annonce and a récompense are things a person is invited to, and an invitation
-- with no image reads as a system message. This is the one place in LEQ where an image is
-- content rather than decoration, so it gets a bucket of its own.
--
-- Why a public bucket, when every other one is private: these images are what the application
-- shows to everyone it invites. They hold no personal data, they are chosen by Rebecca, and a
-- signed URL per image per screen would cost a round trip for nothing. The voice keeps its
-- private buckets; nothing here changes that.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medias', 'medias', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only an admin writes here. Reading is public by the bucket itself.
drop policy if exists medias_admin_insert on storage.objects;
create policy medias_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medias' and (select public.est_admin()));

drop policy if exists medias_admin_update on storage.objects;
create policy medias_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'medias' and (select public.est_admin()))
  with check (bucket_id = 'medias' and (select public.est_admin()));

drop policy if exists medias_admin_delete on storage.objects;
create policy medias_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'medias' and (select public.est_admin()));

-- The column is the object path inside `medias`, never a full URL: the project can move hosts
-- without rewriting rows.
alter table public.ateliers add column if not exists image_chemin text;
alter table public.annonces add column if not exists image_chemin text;
alter table public.recompenses add column if not exists image_chemin text;

comment on column public.ateliers.image_chemin is 'Chemin dans le bucket medias. L''image de l''atelier, montrée dans B1 et B1b.';
comment on column public.annonces.image_chemin is 'Chemin dans le bucket medias. Illustration de l''annonce, reprise dans la notification.';
comment on column public.recompenses.image_chemin is 'Chemin dans le bucket medias. L''image de la récompense dans la boutique (D2).';

-- `publier_annonce` gains the image and nothing else. The 4-argument version is dropped rather
-- than left beside it: two overloads with defaults make the call ambiguous through PostgREST.

drop function if exists public.publier_annonce(text, text, uuid, text[]);

create or replace function public.publier_annonce(
  p_titre text,
  p_corps text,
  p_atelier uuid default null,
  p_regions text[] default null,
  p_image text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plafond integer;
  v_id uuid;
  v_regions text[] := case when p_regions is null or cardinality(p_regions) = 0 then null else p_regions end;
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_titre is null or btrim(p_titre) = '' or p_corps is null or btrim(p_corps) = '' then
    raise exception 'titre et corps requis' using errcode = '23514';
  end if;
  if p_atelier is not null and not exists (select 1 from public.ateliers where id = p_atelier) then
    raise exception 'atelier introuvable' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('annonces'));
  select coalesce((valeur #>> '{}')::integer, 2) into v_plafond from public.configuration where cle = 'plafond_annonces_par_mois';
  v_plafond := coalesce(v_plafond, 2);
  if public.annonces_du_mois() >= v_plafond then
    raise exception 'plafond_annonces_atteint' using errcode = 'P0001';
  end if;
  insert into public.annonces (titre, corps, atelier_id, regions, image_chemin, cree_par)
  values (btrim(p_titre), btrim(p_corps), p_atelier, v_regions,
          nullif(btrim(coalesce(p_image, '')), ''), (select auth.uid()))
  returning id into v_id;
  insert into public.jobs (type, charge, cle_idempotence)
  values ('envoyer_annonce', jsonb_build_object('annonce_id', v_id), 'annonce:' || v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.publier_annonce(text, text, uuid, text[], text) from public, anon;
grant execute on function public.publier_annonce(text, text, uuid, text[], text) to authenticated;
