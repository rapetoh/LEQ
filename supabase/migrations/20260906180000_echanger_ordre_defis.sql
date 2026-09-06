-- LEQ, migration "echanger_ordre_defis" (Phase 4, admin). Swaps the order of two défis of the
-- same act in one transaction. `defis (ordre_acte, ordre)` is unique and PostgreSQL checks
-- uniqueness row by row, so a single UPDATE cannot swap; the function parks one row on a
-- negative order first. Admin only (the role carried by the token).

create or replace function public.echanger_ordre_defis(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a record;
  v_b record;
begin
  if not (select public.est_admin()) then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_a = p_b then
    return;
  end if;
  select id, ordre, ordre_acte into v_a from public.defis where id = p_a for update;
  select id, ordre, ordre_acte into v_b from public.defis where id = p_b for update;
  if v_a.id is null or v_b.id is null then
    raise exception 'défi introuvable' using errcode = 'P0002';
  end if;
  if v_a.ordre_acte <> v_b.ordre_acte then
    raise exception 'les deux défis doivent appartenir au même acte' using errcode = '23514';
  end if;
  update public.defis set ordre = -v_a.ordre where id = p_a;
  update public.defis set ordre = v_a.ordre where id = p_b;
  update public.defis set ordre = v_b.ordre where id = p_a;
end;
$$;

revoke execute on function public.echanger_ordre_defis(uuid, uuid) from public, anon;
grant execute on function public.echanger_ordre_defis(uuid, uuid) to authenticated;
comment on function public.echanger_ordre_defis(uuid, uuid) is 'Admin : échange l''ordre de deux défis du même acte, atomiquement.';
