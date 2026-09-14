-- pgTAP tests for migration 20260913110000 (payments ledger, subscriptions summary). One rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create schema tests_leq;
create function tests_leq.creer_utilisateur(p_id uuid, p_email text, p_anonyme boolean)
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, is_anonymous, raw_app_meta_data, raw_user_meta_data)
  values (p_id, p_email, p_anonyme, '{}'::jsonb, '{}'::jsonb);
end; $$;
create function tests_leq.connecter(p_id uuid, p_anonyme boolean, p_role_app text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_id, 'role', 'authenticated', 'aud', 'authenticated', 'email', '',
    'is_anonymous', p_anonyme, 'app_metadata', jsonb_build_object('role', p_role_app))::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create function tests_leq.deconnecter() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '', true); end; $$;

select tests_leq.creer_utilisateur('11111111-1111-4111-8111-111111111111', 'a@test.leq', false);
select tests_leq.creer_utilisateur('22222222-2222-4222-8222-222222222222', 'b@test.leq', false);
select tests_leq.creer_utilisateur('44444444-4444-4444-8444-444444444444', 'admin@test.leq', false);
update public.profils set role = 'admin' where id = '44444444-4444-4444-8444-444444444444';
update public.profils set prenom = 'Alix' where id = '11111111-1111-4111-8111-111111111111';

select ok((select relrowsecurity from pg_class where oid = 'public.paiements'::regclass), 'RLS on paiements');

-- A pays for Complet this month; B was on Complet and let it lapse.
insert into public.abonnements (utilisateur_id, formule, source, actif_jusqu_a)
values ('11111111-1111-4111-8111-111111111111', 'complet', 'revenuecat', now() + interval '20 days'),
       ('22222222-2222-4222-8222-222222222222', 'complet', 'revenuecat', now() - interval '3 days');
insert into public.paiements (utilisateur_id, formule, produit_store, magasin, type, montant, devise, montant_net, paye_le, evenement_id)
values ('11111111-1111-4111-8111-111111111111', 'complet', 'leq_complet_mensuel', 'apple', 'achat', 14.99, 'EUR', 10.49, now(), 'ev-1'),
       ('22222222-2222-4222-8222-222222222222', 'complet', 'leq_complet_mensuel', 'google', 'renouvellement', 14.99, 'EUR', 12.74, now() - interval '1 hour', 'ev-2'),
       ('22222222-2222-4222-8222-222222222222', 'complet', 'leq_complet_mensuel', 'google', 'remboursement', -14.99, 'EUR', null, now() - interval '30 minutes', 'ev-3');

select throws_ok(
  $$ insert into public.paiements (utilisateur_id, magasin, type, montant, devise, paye_le, evenement_id)
     values ('11111111-1111-4111-8111-111111111111', 'apple', 'achat', 14.99, 'EUR', now(), 'ev-1') $$,
  '23505', null, 'a webhook retried twice writes one row');

-- the admin reads the summary ----------------------------------------------------------------
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select is((public.resume_abonnements() -> 'actifs' ->> 'total')::integer, 1,
  'one paid subscription is active today: the lapsed one is not counted');
select is((select (e ->> 'actifs')::integer from jsonb_array_elements(public.resume_abonnements() -> 'actifs' -> 'par_formule') e where e ->> 'cle' = 'complet'), 1,
  'and it is on Complet');
select is(jsonb_array_length(public.resume_abonnements() -> 'mois'), 12, 'twelve months, the current one first');
select is((public.resume_abonnements() -> 'mois' -> 0 ->> 'mois'), to_char(now(), 'YYYY-MM'), 'the first month is this one');
select is((public.resume_abonnements() -> 'mois' -> 0 ->> 'nouveaux')::integer, 2, 'two people took a paid tier this month');
select is((public.resume_abonnements() -> 'mois' -> 0 ->> 'paiements')::integer, 2, 'two payments came in');
select is((public.resume_abonnements() -> 'mois' -> 0 ->> 'remboursements')::integer, 1, 'one was refunded');
select is((public.resume_abonnements() -> 'mois' -> 0 -> 'montants' ->> 'EUR')::numeric, 14.99,
  'the month adds up in euros, refund included');
select is((public.resume_abonnements() -> 'mois' -> 0 -> 'net' ->> 'EUR')::numeric, 23.23,
  'and the net side counts only what the store reported as net');
select is(jsonb_array_length(public.resume_abonnements() -> 'derniers'), 3, 'the last payments are listed');
select is((public.resume_abonnements() -> 'derniers' -> 0 ->> 'prenom'), 'Alix', 'with the first name of who paid');
select is((select count(*) from public.paiements), 3::bigint, 'the admin reads the ledger');
reset role; select tests_leq.deconnecter();

-- nobody else does ------------------------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ select public.resume_abonnements() $$, '42501', 'admin only', 'a person cannot read the summary');
select is((select count(*) from public.paiements), 0::bigint, 'nor the ledger, not even their own rows');
select throws_ok(
  $$ insert into public.paiements (magasin, type, montant, devise, paye_le) values ('apple', 'achat', 1, 'EUR', now()) $$,
  '42501', null, 'and nobody writes a payment from a client');
reset role; select tests_leq.deconnecter();

select * from finish();
rollback;
