-- Who paid, when, and how much a month (Rebecca, 12 September 2026, item 13).
--
-- `abonnements` says which tier a person is on; it says nothing about money. Payments are a
-- ledger of their own (ADR-009): one row per event the stores report through RevenueCat, kept
-- even when the account goes, because the accounts are the accounts. Nothing here is computed
-- from prices in the code: the amount is what the store said the person paid.
create table if not exists public.paiements (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid references public.profils (id) on delete set null,
  formule text references public.formules (cle) on update cascade,
  produit_store text,
  magasin text not null check (magasin in ('apple', 'google', 'autre')),
  type text not null check (type in ('achat', 'renouvellement', 'remboursement', 'essai')),
  -- What the person paid, in the currency the store charged. A refund is a negative amount.
  montant numeric(10, 2) not null,
  devise text not null,
  -- What reaches LEQ after the store's share, when the store says it.
  montant_net numeric(10, 2),
  paye_le timestamptz not null,
  source text not null default 'revenuecat' check (source in ('revenuecat', 'manuel')),
  -- The store's or RevenueCat's own identifier of the event, so a webhook retried twice
  -- writes one row.
  evenement_id text unique,
  cree_le timestamptz not null default now()
);
comment on table public.paiements is 'Ledger of payment events from the stores. Written by the server (RevenueCat webhook) or by hand; read by the admin.';
create index if not exists paiements_paye_le on public.paiements (paye_le desc);
create index if not exists paiements_utilisateur on public.paiements (utilisateur_id);

alter table public.paiements enable row level security;
drop policy if exists paiements_select_admin on public.paiements;
create policy paiements_select_admin on public.paiements for select to authenticated
  using ((select public.est_admin()));
-- No client writes: the ledger is the server's.

/**
 * What the admin's subscriptions page shows: who is on a paid tier today, the last twelve
 * months of new subscribers and payments, and the last payments one by one. One function, one
 * round trip, admin only, like `tableau_de_bord()`.
 */
create or replace function public.resume_abonnements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debut timestamptz := date_trunc('month', now()) - interval '11 months';
begin
  if not (select public.est_admin()) then raise exception 'admin only' using errcode = '42501'; end if;

  return jsonb_build_object(
    'actifs', jsonb_build_object(
      'total', (select count(*) from public.abonnements a
                 where a.formule <> 'gratuit' and (a.actif_jusqu_a is null or a.actif_jusqu_a > now())),
      'par_formule', coalesce((
        select jsonb_agg(jsonb_build_object('cle', f.cle, 'nom', f.nom, 'actifs', coalesce(n.actifs, 0))
                         order by f.ordre)
          from public.formules f
          left join (
            select formule, count(*) as actifs from public.abonnements
             where actif_jusqu_a is null or actif_jusqu_a > now()
             group by formule) n on n.formule = f.cle
         where f.cle <> 'gratuit'), '[]'::jsonb)),

    'mois', (
      select jsonb_agg(jsonb_build_object(
          'mois', to_char(m.mois, 'YYYY-MM'),
          'nouveaux', (select count(*) from public.abonnements a
                        where a.formule <> 'gratuit'
                          and a.cree_le >= m.mois and a.cree_le < m.mois + interval '1 month'),
          'paiements', (select count(*) from public.paiements p
                         where p.type in ('achat', 'renouvellement')
                           and p.paye_le >= m.mois and p.paye_le < m.mois + interval '1 month'),
          'remboursements', (select count(*) from public.paiements p
                              where p.type = 'remboursement'
                                and p.paye_le >= m.mois and p.paye_le < m.mois + interval '1 month'),
          'montants', coalesce((select jsonb_object_agg(s.devise, s.total) from (
              select devise, sum(montant) as total from public.paiements p
               where p.paye_le >= m.mois and p.paye_le < m.mois + interval '1 month'
               group by devise) s), '{}'::jsonb),
          'net', coalesce((select jsonb_object_agg(s.devise, s.total) from (
              select devise, sum(montant_net) as total from public.paiements p
               where p.montant_net is not null
                 and p.paye_le >= m.mois and p.paye_le < m.mois + interval '1 month'
               group by devise) s), '{}'::jsonb))
        order by m.mois desc)
      from generate_series(v_debut, date_trunc('month', now()), interval '1 month') as m(mois)),

    'derniers', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'paye_le', p.paye_le, 'type', p.type, 'montant', p.montant,
          'devise', p.devise, 'formule', p.formule, 'magasin', p.magasin,
          'utilisateur_id', p.utilisateur_id, 'prenom', pr.prenom)
        order by p.paye_le desc)
      from (select * from public.paiements order by paye_le desc limit 50) p
      left join public.profils pr on pr.id = p.utilisateur_id), '[]'::jsonb));
end;
$$;
revoke execute on function public.resume_abonnements() from public, anon;
grant execute on function public.resume_abonnements() to authenticated;
