-- ---------------------------------------------------------------------------------------------
-- Le tableau de bord lit toute la table.
--
-- `tableau_de_bord()` counts this week's takes three times over `tentatives`, and there was no
-- index on `cree_le`: every load of the admin home read every attempt ever recorded. It is fast
-- today because the table is small. It is the kind of thing nobody notices until the page takes
-- ten seconds and the cause is a year old.
-- ---------------------------------------------------------------------------------------------

create index if not exists tentatives_cree_le_idx on public.tentatives (cree_le);
create index if not exists tentatives_validees_idx
  on public.tentatives (cree_le) where resultat = 'etape_validee';
create index if not exists profils_cree_le_idx on public.profils (cree_le);
