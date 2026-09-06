-- pgTAP tests for migration 0002 (Phase 1 additions). Same conventions as socle.sql:
-- one transaction, rolled back at the end; helpers in schema tests_leq.
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

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
select tests_leq.creer_utilisateur('33333333-3333-4333-8333-333333333333', 'c@test.leq', true);

-- schema ---------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.reponses_accueil'::regclass), 'RLS on reponses_accueil');
select ok((select relrowsecurity from pg_class where oid = 'public.jetons_push'::regclass), 'RLS on jetons_push');
select is((select notif_rappel from public.profils where id = '11111111-1111-4111-8111-111111111111'), true, 'notification switches default to on');
select is((select heure_rappel::text from public.profils where id = '11111111-1111-4111-8111-111111111111'), '21:30:00', 'reminder defaults to 21:30');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tentatives'), 'tentatives is in the realtime publication');

-- reponses_accueil as anonymous C -------------------------------------------
select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select lives_ok(
  $$ insert into public.reponses_accueil (utilisateur_id, contexte, blocage, objectif)
     values ('33333333-3333-4333-8333-333333333333', 'travail', 'trac', 'stress') $$,
  'anonymous C stores own onboarding answers');
select throws_ok(
  $$ insert into public.reponses_accueil (utilisateur_id, contexte, blocage, objectif)
     values ('11111111-1111-4111-8111-111111111111', 'travail', 'trac', 'stress') $$,
  '42501', null, 'C cannot store answers for A');
select throws_ok(
  $$ update public.reponses_accueil set contexte = 'ailleurs' where utilisateur_id = '33333333-3333-4333-8333-333333333333' $$,
  '23514', null, 'an unknown code is refused');
select lives_ok(
  $$ update public.reponses_accueil set objectif = 'presence' where utilisateur_id = '33333333-3333-4333-8333-333333333333' $$,
  'C updates own answers');
select is((select objectif from public.reponses_accueil where utilisateur_id = '33333333-3333-4333-8333-333333333333'), 'presence', 'the update is stored');
reset role;
select tests_leq.deconnecter();

-- reponses_accueil visibility --------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.reponses_accueil), 0::bigint, 'A does not see the answers of C');
reset role;
select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'admin');
select is((select count(*) from public.reponses_accueil), 1::bigint, 'admin sees every answer');
reset role;
select tests_leq.deconnecter();

-- jetons_push as A ---------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok(
  $$ insert into public.jetons_push (utilisateur_id, jeton, plateforme)
     values ('11111111-1111-4111-8111-111111111111', 'ExponentPushToken[aaa]', 'ios') $$,
  'A registers a token');
select throws_ok(
  $$ insert into public.jetons_push (utilisateur_id, jeton, plateforme)
     values ('22222222-2222-4222-8222-222222222222', 'ExponentPushToken[bbb]', 'ios') $$,
  '42501', null, 'A cannot register a token for B');
select lives_ok(
  $$ delete from public.jetons_push where jeton = 'ExponentPushToken[aaa]' $$,
  'A removes own token');
select is((select count(*) from public.jetons_push where utilisateur_id = '11111111-1111-4111-8111-111111111111'), 0::bigint, 'the token is gone');
reset role;
select tests_leq.deconnecter();

-- profils: notification switches are the person's, deletion request is not ----
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok(
  $$ update public.profils set notif_annonces = false, heure_rappel = '08:15' where id = '11111111-1111-4111-8111-111111111111' $$,
  'A switches a notification off and moves the reminder');
select throws_ok(
  $$ update public.profils set suppression_demandee_le = now() where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'A cannot set suppression_demandee_le directly');

-- demander_suppression_compte() as A ----------------------------------------------
select lives_ok($$ select public.demander_suppression_compte() $$, 'A asks for deletion');
select lives_ok($$ select public.demander_suppression_compte() $$, 'asking twice is harmless');
reset role;
select tests_leq.deconnecter();
select ok((select suppression_demandee_le is not null from public.profils where id = '11111111-1111-4111-8111-111111111111'), 'the request is stamped');
select is((select count(*) from public.jobs where type = 'supprimer_compte' and cle_idempotence = 'supprimer:11111111-1111-4111-8111-111111111111'), 1::bigint, 'one supprimer_compte job, not two');

select * from finish();

rollback;
