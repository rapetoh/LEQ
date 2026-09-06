-- LEQ, migration "grilles_anonymes" (Phase 4 review, follow-up). Migration 0005 let anonymous
-- people read the criteria of a published grid, but the criteria policy looks the grid up and
-- `grilles_select` still hid published grids from them. A published grid is Rebecca's public
-- wording: anonymous people read it too. Unpublished grids stay the admin's.

drop policy if exists grilles_select on public.grilles;
create policy grilles_select on public.grilles
  for select to authenticated
  using ((select public.est_admin()) or publiee_le is not null);
