-- pgTAP tests for migration 0003 (demandes_export).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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
select tests_leq.creer_utilisateur('33333333-3333-4333-8333-333333333333', 'c@test.leq', true);
select tests_leq.creer_utilisateur('44444444-4444-4444-8444-444444444444', 'd@test.leq', false);

select ok((select relrowsecurity from pg_class where oid = 'public.demandes_export'::regclass), 'RLS on demandes_export');

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok(
  $$ insert into public.demandes_export (utilisateur_id, email) values ('11111111-1111-4111-8111-111111111111', 'a@test.leq') $$,
  'A files an export request');
select is((select count(*) from public.demandes_export), 1::bigint, 'A sees own request');
select is((select count(*) from public.demandes_export where traitee_le is null), 1::bigint, 'it is open');
reset role; select tests_leq.deconnecter();

select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select throws_ok(
  $$ insert into public.demandes_export (utilisateur_id) values ('33333333-3333-4333-8333-333333333333') $$,
  '42501', null, 'an anonymous account cannot file a request');
reset role; select tests_leq.deconnecter();

select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok(
  $$ update public.demandes_export set traitee_le = now(), traitee_par = '44444444-4444-4444-8444-444444444444' $$,
  'admin closes the request');
select is((select count(*) from public.demandes_export where traitee_le is not null), 1::bigint, 'the request is closed');
reset role; select tests_leq.deconnecter();

select * from finish();
rollback;
