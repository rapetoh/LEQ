-- The long-form arc, in its v1 (Rebecca and Roch, 12 September 2026, item 16): a goal stated up
-- front, a run of recorded steps building to it, a final take, and the closing screen reading
-- the arc from its first take to its last. Same engine, same grid. The goal is content, so it
-- lives on the act model Rebecca edits; an act without one is an ordinary act.
alter table public.modeles_actes add column if not exists objectif text;
comment on column public.modeles_actes.objectif is
  'The goal of the act, stated to the person before the first step. Set, the act is an arc: its closing screen reads the way from the first take to the last.';
