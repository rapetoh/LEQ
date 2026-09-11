-- pgTAP tests for the "socle" migration. Run with: supabase test db
-- Everything happens in one transaction that is rolled back at the end.
--
-- Helpers are defined inline (schema tests_leq) instead of the dbdev test
-- helpers so the suite needs no network access to install. They emulate what
-- PostgREST does: set the role and the request.jwt.claims setting.
--
-- Fixed identifiers used below:
--   A  11111111-1111-4111-8111-111111111111  signed-in user
--   B  22222222-2222-4222-8222-222222222222  another signed-in user
--   C  33333333-3333-4333-8333-333333333333  anonymous user
--   D  44444444-4444-4444-8444-444444444444  admin (Rebecca)

begin;

create extension if not exists pgtap with schema extensions;

select plan(133);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create schema tests_leq;

create function tests_leq.creer_utilisateur(p_id uuid, p_email text, p_anonyme boolean)
returns void
language plpgsql
as $$
begin
  insert into auth.users (id, email, is_anonymous, raw_app_meta_data, raw_user_meta_data)
  values (p_id, p_email, p_anonyme, '{}'::jsonb, '{}'::jsonb);
end;
$$;

-- Acts as a signed-in user. Call "reset role;" before switching users.
create function tests_leq.connecter(p_id uuid, p_anonyme boolean, p_role_app text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_id,
      'role', 'authenticated',
      'aud', 'authenticated',
      'email', '',
      'is_anonymous', p_anonyme,
      'app_metadata', jsonb_build_object('role', p_role_app)
    )::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Acts as the server (service role key).
create function tests_leq.connecter_service()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  perform set_config('role', 'service_role', true);
end;
$$;

-- Back to postgres with no claims at all.
create function tests_leq.deconnecter()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------

select tests_leq.creer_utilisateur('11111111-1111-4111-8111-111111111111', 'a@test.leq', false);
select tests_leq.creer_utilisateur('22222222-2222-4222-8222-222222222222', 'b@test.leq', false);
select tests_leq.creer_utilisateur('33333333-3333-4333-8333-333333333333', 'c@test.leq', true);
select tests_leq.creer_utilisateur('44444444-4444-4444-8444-444444444444', 'd@test.leq', false);

-- Configuration and flags may already be seeded; make sure the rows exist.
insert into public.configuration (cle, type, valeur, description)
values ('points_par_defi', 'nombre', '25', 'Points gagnés pour un défi réussi')
on conflict (cle) do nothing;

insert into public.drapeaux (cle, actif) values ('arene', false)
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- RLS is enabled everywhere
-- ---------------------------------------------------------------------------

select ok((select relrowsecurity from pg_class where oid = 'public.profils'::regclass), 'RLS on profils');
select ok((select relrowsecurity from pg_class where oid = 'public.configuration'::regclass), 'RLS on configuration');
select ok((select relrowsecurity from pg_class where oid = 'public.drapeaux'::regclass), 'RLS on drapeaux');
select ok((select relrowsecurity from pg_class where oid = 'public.tentatives'::regclass), 'RLS on tentatives');
select ok((select relrowsecurity from pg_class where oid = 'public.analyses'::regclass), 'RLS on analyses');
select ok((select relrowsecurity from pg_class where oid = 'public.grilles'::regclass), 'RLS on grilles');
select ok((select relrowsecurity from pg_class where oid = 'public.criteres_grille'::regclass), 'RLS on criteres_grille');
select ok((select relrowsecurity from pg_class where oid = 'public.evaluations'::regclass), 'RLS on evaluations');
select ok((select relrowsecurity from pg_class where oid = 'public.jobs'::regclass), 'RLS on jobs');

select is((select count(*) from storage.buckets where id in ('audio-tentatives', 'audio-public')), 2::bigint, 'both buckets exist');

-- ---------------------------------------------------------------------------
-- Helpers est_admin / est_anonyme, profil creation trigger
-- ---------------------------------------------------------------------------

select is(public.est_admin(), false, 'est_admin is false without a JWT');
select is(public.est_anonyme(), false, 'est_anonyme is false without a JWT');

select is((select count(*) from public.profils where id = '11111111-1111-4111-8111-111111111111'), 1::bigint, 'a profil is created for every auth user');
select is((select role from public.profils where id = '11111111-1111-4111-8111-111111111111'), 'utilisateur', 'default role is utilisateur');

-- The service role promotes D to admin (the only allowed path).
select tests_leq.connecter_service();
select lives_ok(
  $$ update public.profils set role = 'admin' where id = '44444444-4444-4444-8444-444444444444' $$,
  'service role can set role'
);
reset role;
select tests_leq.deconnecter();
select is((select role from public.profils where id = '44444444-4444-4444-8444-444444444444'), 'admin', 'D is now admin');

-- ---------------------------------------------------------------------------
-- profils as user A
-- ---------------------------------------------------------------------------

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');

select is(public.est_admin(), false, 'A is not admin');
select is(public.est_anonyme(), false, 'A is not anonymous');
select is((select count(*) from public.profils), 1::bigint, 'A sees only own profil');

select lives_ok(
  $$ update public.profils set prenom = 'Roch', fuseau_horaire = 'Europe/Paris' where id = '11111111-1111-4111-8111-111111111111' $$,
  'A can update own prenom'
);
select is((select prenom from public.profils where id = '11111111-1111-4111-8111-111111111111'), 'Roch', 'prenom was saved');
select is((select modifie_le from public.profils where id = '11111111-1111-4111-8111-111111111111'), now(), 'modifie_le is maintained by trigger');

select throws_ok(
  $$ update public.profils set role = 'admin' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'A cannot change own role'
);
select throws_ok(
  $$ update public.profils set suspendu_le = now() where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'A cannot change own suspendu_le'
);

-- Updating someone else is silently filtered by RLS.
update public.profils set prenom = 'Pirate' where id = '22222222-2222-4222-8222-222222222222';

reset role;
select tests_leq.deconnecter();
select is((select prenom from public.profils where id = '22222222-2222-4222-8222-222222222222'), null, 'A cannot update another profil');

-- ---------------------------------------------------------------------------
-- profils as anonymous C and admin D
-- ---------------------------------------------------------------------------

select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select is(public.est_anonyme(), true, 'C is anonymous');
select is((select count(*) from public.profils), 1::bigint, 'anonymous C sees own profil');
select lives_ok(
  $$ update public.profils set prenom = 'Anonyme' where id = '33333333-3333-4333-8333-333333333333' $$,
  'anonymous C can update own profil'
);
reset role;

select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select is(public.est_admin(), true, 'D is admin');
select ok((select count(*) from public.profils) >= 4, 'admin sees every profil');
reset role;
select tests_leq.deconnecter();

-- ---------------------------------------------------------------------------
-- configuration and drapeaux
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.configuration (cle, type, valeur, description) values ('test_type', 'nombre', '"abc"', 'x') $$,
  '23514', null,
  'valeur must match type'
);

-- anonymous reads
select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select ok((select count(*) from public.configuration) >= 1, 'anonymous C reads configuration');
select ok((select count(*) from public.drapeaux) >= 1, 'anonymous C reads drapeaux');
update public.configuration set valeur = '999' where cle = 'points_par_defi';
select is((select valeur from public.configuration where cle = 'points_par_defi'), '25'::jsonb, 'anonymous C cannot update configuration');
reset role;

-- plain user cannot update
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
update public.configuration set valeur = '999' where cle = 'points_par_defi';
select is((select valeur from public.configuration where cle = 'points_par_defi'), '25'::jsonb, 'A cannot update configuration');
update public.drapeaux set actif = true where cle = 'arene';
select is((select actif from public.drapeaux where cle = 'arene'), false, 'A cannot update drapeaux');
reset role;

-- admin can update, cannot insert or delete
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok(
  $$ update public.configuration set valeur = '42' where cle = 'points_par_defi' $$,
  'admin can update configuration'
);
select is((select valeur from public.configuration where cle = 'points_par_defi'), '42'::jsonb, 'configuration value changed');
select is((select modifie_par from public.configuration where cle = 'points_par_defi'), '44444444-4444-4444-8444-444444444444'::uuid, 'modifie_par records the admin');
select lives_ok(
  $$ update public.drapeaux set actif = true where cle = 'arene' $$,
  'admin can update drapeaux'
);
select is((select actif from public.drapeaux where cle = 'arene'), true, 'flag changed');
select throws_ok(
  $$ insert into public.configuration (cle, type, valeur, description) values ('cle_pirate', 'nombre', '1', 'x') $$,
  '42501', null,
  'admin cannot insert configuration'
);
delete from public.configuration where cle = 'points_par_defi';
select is((select count(*) from public.configuration where cle = 'points_par_defi'), 1::bigint, 'admin cannot delete configuration');
reset role;
select tests_leq.deconnecter();

-- ---------------------------------------------------------------------------
-- tentatives
-- ---------------------------------------------------------------------------

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');

select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, duree_s, chemin_audio, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'diagnostic', now() - interval '1 minute', 'Europe/Paris', 120, 75.5,
             '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.m4a', 'envoyee') $$,
  'A inserts a diagnostic tentative'
);
select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'etape', now(), 'Europe/Paris', 120, 'envoyee') $$,
  'A inserts an etape tentative'
);
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'etape', now(), 'Europe/Paris', 120, 'en_transcription') $$,
  '42501', null,
  'A cannot insert with a statut other than envoyee'
);
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'etape', now(), 'Europe/Paris', 120, 'envoyee') $$,
  '42501', null,
  'A cannot insert for another user'
);
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'etape', now() + interval '1 day', 'Europe/Paris', 120, 'envoyee') $$,
  '23514', null,
  'enregistre_le in the future is rejected'
);
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'etape', now() - interval '10 days', 'Europe/Paris', 120, 'envoyee') $$,
  '23514', null,
  'enregistre_le older than 8 days is rejected'
);
select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'etape', now() - interval '7 days', 'Europe/Paris', 120, 'envoyee') $$,
  'a 7 day old offline take is accepted'
);

-- Duplicate id (retry after a lost response) is a plain unique violation.
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'diagnostic', now(), 'Europe/Paris', 120, 'envoyee') $$,
  '23505', null,
  'same id twice is a unique violation'
);

select is((select count(*) from public.tentatives), 3::bigint, 'A sees own tentatives');

-- No client update or delete: silently filtered.
update public.tentatives set statut = 'retour_disponible' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select is((select statut from public.tentatives where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'envoyee', 'A cannot update own tentative');
delete from public.tentatives where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select is((select count(*) from public.tentatives where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, 'A cannot delete own tentative');

select throws_ok(
  $$ select count(*) from public.jobs $$,
  '42501', null,
  'A has no access to jobs'
);

reset role;

-- B sees nothing of A.
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select is((select count(*) from public.tentatives), 0::bigint, 'B sees no tentative of A');
reset role;

-- Anonymous C: diagnostic only.
select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('cccccccc-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'diagnostic', now(), 'Europe/Paris', 120, 'envoyee') $$,
  'anonymous C inserts a diagnostic tentative'
);
select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('cccccccc-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'etape', now(), 'Europe/Paris', 120, 'envoyee') $$,
  'anonymous C inserts an etape tentative (the path is open before the account, migration 0005)'
);
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('cccccccc-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'arene', now(), 'Europe/Paris', 120, 'envoyee') $$,
  '42501', null,
  'anonymous C cannot insert an arene tentative'
);
select is((select count(*) from public.tentatives), 2::bigint, 'anonymous C sees own tentatives (the diagnostic and the step)');
reset role;
select tests_leq.deconnecter();

-- The insert trigger queued one job per tentative.
select is(
  (select count(*) from public.jobs where cle_idempotence = 'analyser:aaaaaaaa-0000-4000-8000-000000000001'),
  1::bigint,
  'insert trigger created the analyser_tentative job'
);
select is(
  (select charge ->> 'tentative_id' from public.jobs where cle_idempotence = 'analyser:aaaaaaaa-0000-4000-8000-000000000001'),
  'aaaaaaaa-0000-4000-8000-000000000001',
  'job charge carries the tentative id'
);
select is(
  (select type from public.jobs where cle_idempotence = 'analyser:aaaaaaaa-0000-4000-8000-000000000001'),
  'analyser_tentative',
  'job type is analyser_tentative'
);
select is((select count(*) from public.jobs where type = 'analyser_tentative' and cle_idempotence ~ '^analyser:(aaaaaaaa|bbbbbbbb|cccccccc)-'), 5::bigint, 'one job per accepted tentative');

-- ---------------------------------------------------------------------------
-- analyses and evaluations (service writes, users read own)
-- ---------------------------------------------------------------------------

insert into public.analyses (tentative_id, mesures, transcription, fournisseur_transcription)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '{"version": 1}'::jsonb, '{"texte": "", "mots": []}'::jsonb, 'stub'),
  ('cccccccc-0000-4000-8000-000000000001', '{"version": 1}'::jsonb, '{"texte": "", "mots": []}'::jsonb, 'stub');

insert into public.evaluations (tentative_id)
values ('aaaaaaaa-0000-4000-8000-000000000001'), ('cccccccc-0000-4000-8000-000000000001');

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.analyses), 1::bigint, 'A reads own analyse');
select is((select count(*) from public.evaluations), 1::bigint, 'A reads own evaluation');
select throws_ok(
  $$ insert into public.analyses (tentative_id, mesures, transcription, fournisseur_transcription)
     values ('aaaaaaaa-0000-4000-8000-000000000002', '{}'::jsonb, '{}'::jsonb, 'stub') $$,
  '42501', null,
  'A cannot insert an analyse'
);
update public.evaluations set note_totale = 30 where tentative_id = 'aaaaaaaa-0000-4000-8000-000000000001';
select is((select note_totale from public.evaluations where tentative_id = 'aaaaaaaa-0000-4000-8000-000000000001'), null, 'A cannot update own evaluation');
reset role;

select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select is((select count(*) from public.analyses), 0::bigint, 'B reads no analyse of others');
select is((select count(*) from public.evaluations), 0::bigint, 'B reads no evaluation of others');
reset role;

select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select is((select count(*) from public.analyses), 1::bigint, 'anonymous C reads own analyse');
select is((select count(*) from public.evaluations), 1::bigint, 'anonymous C reads own evaluation');
reset role;
select tests_leq.deconnecter();

-- ---------------------------------------------------------------------------
-- grilles and criteres_grille
-- ---------------------------------------------------------------------------

insert into public.grilles (id, version, publiee_le, notes)
values
  ('99999999-0000-4000-8000-000000000001', 1, now(), 'publiée'),
  ('99999999-0000-4000-8000-000000000002', 2, null, 'brouillon');

insert into public.criteres_grille (grille_id, cle, nom, definition, regle, ordre)
values
  ('99999999-0000-4000-8000-000000000001', 'debit', 'Débit', 'Vitesse de parole', '{"version": 1, "score_max": 10, "elements": []}'::jsonb, 1),
  ('99999999-0000-4000-8000-000000000002', 'debit', 'Débit', 'Vitesse de parole', '{"version": 1, "score_max": 10, "elements": []}'::jsonb, 1);

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.grilles), 1::bigint, 'A sees only the published grille');
select is((select count(*) from public.criteres_grille), 1::bigint, 'A sees only criteres of the published grille');
select throws_ok(
  $$ insert into public.grilles (version) values (3) $$,
  '42501', null,
  'A cannot insert a grille'
);
reset role;

select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select is((select count(*) from public.grilles), 1::bigint, 'anonymous C reads the published grille (migration 0007)');
select is((select count(*) from public.criteres_grille), 1::bigint, 'anonymous C reads the criteres of the published grille (migration 0005)');
reset role;

select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select is((select count(*) from public.grilles), 2::bigint, 'admin sees draft and published grilles');
select is((select count(*) from public.criteres_grille), 2::bigint, 'admin sees every critere');
select lives_ok(
  $$ insert into public.grilles (version, notes) values (3, 'nouvelle') $$,
  'admin can insert a grille'
);
select lives_ok(
  $$ update public.grilles set publiee_le = now() where version = 2 $$,
  'admin can publish a grille'
);
select lives_ok(
  $$ delete from public.grilles where version = 3 $$,
  'admin can delete a grille'
);
reset role;
select tests_leq.deconnecter();

-- ---------------------------------------------------------------------------
-- Job queue functions
-- ---------------------------------------------------------------------------

select ok(not has_function_privilege('authenticated', 'public.reclamer_job(text, text[])', 'execute'), 'authenticated cannot execute reclamer_job');
select ok(not has_function_privilege('anon', 'public.reclamer_job(text, text[])', 'execute'), 'anon cannot execute reclamer_job');
select ok(not has_function_privilege('authenticated', 'public.terminer_job(bigint)', 'execute'), 'authenticated cannot execute terminer_job');
select ok(not has_function_privilege('authenticated', 'public.echouer_job(bigint, text)', 'execute'), 'authenticated cannot execute echouer_job');
select ok(not has_function_privilege('authenticated', 'public.liberer_jobs_bloques(interval)', 'execute'), 'authenticated cannot execute liberer_jobs_bloques');
select ok(has_function_privilege('service_role', 'public.reclamer_job(text, text[])', 'execute'), 'service_role can execute reclamer_job');

-- Start from a clean queue for the ordering tests.
delete from public.jobs;

insert into public.jobs (type, charge, statut, disponible_a, verrouille_a, verrouille_par, cle_idempotence, essais_max) values
  ('analyser_tentative', '{"n": 1}', 'en_attente', now() - interval '2 minutes', null, null, 'test:j1', 5),
  ('analyser_tentative', '{"n": 2}', 'en_attente', now() - interval '1 minute', null, null, 'test:j2', 5),
  ('balayer_audio', '{"n": 3}', 'en_attente', now() + interval '1 hour', null, null, 'test:j3', 5),
  ('analyser_tentative', '{"n": 4}', 'en_cours', now() - interval '3 minutes', now(), 'autre-worker', 'test:j4', 5),
  ('supprimer_compte', '{"n": 5}', 'en_attente', now() - interval '1 minute', null, null, 'test:j5', 2);

select tests_leq.connecter_service();

select is(
  (select cle_idempotence from public.reclamer_job('w1', array['analyser_tentative'])),
  'test:j1',
  'reclamer_job hands out the oldest available job'
);
select is(
  (select cle_idempotence from public.reclamer_job('w1', array['analyser_tentative'])),
  'test:j2',
  'reclamer_job hands out the next one'
);
select is(
  (select count(*) from public.reclamer_job('w1', array['analyser_tentative'])),
  0::bigint,
  'reclamer_job skips the job locked by another worker and the future job'
);
select is(
  (select count(*) from public.reclamer_job('w1', array['balayer_audio'])),
  0::bigint,
  'a job with disponible_a in the future is not handed out'
);
select is(
  (select cle_idempotence from public.reclamer_job('w2', null)),
  'test:j5',
  'null types means any type'
);

reset role;
select tests_leq.deconnecter();

select is((select statut from public.jobs where cle_idempotence = 'test:j1'), 'en_cours', 'claimed job is en_cours');
select is((select essais from public.jobs where cle_idempotence = 'test:j1'), 1, 'claimed job has essais = 1');
select is((select verrouille_par from public.jobs where cle_idempotence = 'test:j1'), 'w1', 'claimed job records the worker');
select ok((select verrouille_a from public.jobs where cle_idempotence = 'test:j1') is not null, 'claimed job records the lock time');
select is((select statut from public.jobs where cle_idempotence = 'test:j3'), 'en_attente', 'future job untouched');
select is((select verrouille_par from public.jobs where cle_idempotence = 'test:j4'), 'autre-worker', 'locked job untouched');

-- terminer_job
select tests_leq.connecter_service();
select lives_ok(
  $$ select public.terminer_job((select id from public.jobs where cle_idempotence = 'test:j2')) $$,
  'terminer_job runs'
);
reset role;
select tests_leq.deconnecter();
select is((select statut from public.jobs where cle_idempotence = 'test:j2'), 'termine', 'terminer_job sets termine');
select ok((select termine_le from public.jobs where cle_idempotence = 'test:j2') is not null, 'terminer_job sets termine_le');

-- echouer_job: j5 (essais_max 2) was claimed once, so essais = 1.
select tests_leq.connecter_service();
select lives_ok(
  $$ select public.echouer_job((select id from public.jobs where cle_idempotence = 'test:j5'), 'panne 1') $$,
  'echouer_job runs'
);
reset role;
select tests_leq.deconnecter();
select is((select statut from public.jobs where cle_idempotence = 'test:j5'), 'en_attente', 'first failure goes back to en_attente');
select is((select erreur from public.jobs where cle_idempotence = 'test:j5'), 'panne 1', 'failure records the error');
select ok((select verrouille_par from public.jobs where cle_idempotence = 'test:j5') is null, 'failure releases the lock');
select ok(
  (select disponible_a between now() + interval '59 seconds' and now() + interval '61 seconds'
   from public.jobs where cle_idempotence = 'test:j5'),
  'backoff after 1 attempt is 60 seconds'
);

-- Make it available again, claim (essais = 2), fail: terminal.
update public.jobs set disponible_a = now() where cle_idempotence = 'test:j5';
select tests_leq.connecter_service();
select is(
  (select essais from public.reclamer_job('w1', array['supprimer_compte'])),
  2,
  'second claim raises essais to 2'
);
select lives_ok(
  $$ select public.echouer_job((select id from public.jobs where cle_idempotence = 'test:j5'), 'panne 2') $$,
  'echouer_job runs again'
);
select is(
  (select count(*) from public.reclamer_job('w1', array['supprimer_compte'])),
  0::bigint,
  'a failed job is never handed out again'
);
reset role;
select tests_leq.deconnecter();
select is((select statut from public.jobs where cle_idempotence = 'test:j5'), 'echoue', 'failure at essais_max is terminal');
select is((select erreur from public.jobs where cle_idempotence = 'test:j5'), 'panne 2', 'last error is kept');

-- liberer_jobs_bloques: j1 has been en_cours for 20 minutes, j4 for 0 minutes.
update public.jobs set verrouille_a = now() - interval '20 minutes' where cle_idempotence = 'test:j1';
select tests_leq.connecter_service();
select is(public.liberer_jobs_bloques(interval '15 minutes'), 1, 'liberer_jobs_bloques releases exactly one job');
reset role;
select tests_leq.deconnecter();
select is((select statut from public.jobs where cle_idempotence = 'test:j1'), 'en_attente', 'stuck job is back to en_attente');
select ok((select verrouille_par from public.jobs where cle_idempotence = 'test:j1') is null, 'stuck job lock is cleared');
select is((select statut from public.jobs where cle_idempotence = 'test:j4'), 'en_cours', 'fresh job stays en_cours');

-- ---------------------------------------------------------------------------
-- Access token hook
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('supabase_auth_admin', 'public.hook_jeton_acces(jsonb)', 'execute'), 'supabase_auth_admin can execute the hook');
select ok(not has_function_privilege('authenticated', 'public.hook_jeton_acces(jsonb)', 'execute'), 'authenticated cannot execute the hook');
select ok(not has_function_privilege('anon', 'public.hook_jeton_acces(jsonb)', 'execute'), 'anon cannot execute the hook');
select ok(has_table_privilege('supabase_auth_admin', 'public.profils', 'select'), 'supabase_auth_admin can read profils');

select is(
  (public.hook_jeton_acces(jsonb_build_object(
    'user_id', '44444444-4444-4444-8444-444444444444',
    'claims', '{"role": "authenticated", "app_metadata": {}}'::jsonb,
    'authentication_method', 'password'
  )) -> 'claims' -> 'app_metadata' ->> 'role'),
  'admin',
  'hook writes admin into app_metadata.role'
);
select is(
  (public.hook_jeton_acces(jsonb_build_object(
    'user_id', '11111111-1111-4111-8111-111111111111',
    'claims', '{"role": "authenticated"}'::jsonb,
    'authentication_method', 'password'
  )) -> 'claims' -> 'app_metadata' ->> 'role'),
  'utilisateur',
  'hook writes utilisateur for a plain user, creating app_metadata if missing'
);
select is(
  (public.hook_jeton_acces(jsonb_build_object(
    'user_id', '44444444-4444-4444-8444-444444444444',
    'claims', '{"role": "authenticated", "app_metadata": {"provider": "email"}}'::jsonb
  )) -> 'claims' -> 'app_metadata' ->> 'provider'),
  'email',
  'hook keeps existing app_metadata keys'
);

-- ---------------------------------------------------------------------------
-- Storage: audio-tentatives insert path restriction
-- ---------------------------------------------------------------------------

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-tentatives', '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000001.m4a') $$,
  'A uploads at {uid}/{uuid}.m4a'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-tentatives', '22222222-2222-4222-8222-222222222222/aaaaaaaa-0000-4000-8000-000000000002.m4a') $$,
  '42501', null,
  'A cannot upload under another user folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-tentatives', '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000002.mp3') $$,
  '42501', null,
  'A cannot upload another extension'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-tentatives', '11111111-1111-4111-8111-111111111111/notes.m4a') $$,
  '42501', null,
  'A cannot upload a non uuid file name'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-tentatives', '11111111-1111-4111-8111-111111111111/sous/aaaaaaaa-0000-4000-8000-000000000002.m4a') $$,
  '42501', null,
  'A cannot upload in a nested folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-public', '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000002.m4a') $$,
  '42501', null,
  'A cannot upload to audio-public'
);
select is((select count(*) from storage.objects where bucket_id = 'audio-tentatives'), 0::bigint, 'A cannot list own uploads');
reset role;
-- A direct delete cannot be exercised here: hosted projects refuse any direct delete on
-- storage.objects (storage.protect_delete), so the policies are checked instead. A client never
-- updates or deletes an object; the only client read is the one of Phase 7, which lets a
-- listener hear a public take under the rule of chapter 11 (migration 0012).
select is(
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('UPDATE', 'DELETE')
      and policyname like 'audio_%'),
  0::bigint,
  'no client update or delete policy on audio objects'
);
select is(
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'SELECT'
      and policyname like 'audio_%'),
  1::bigint,
  'exactly one client read policy on audio objects: the public takes of Phase 7'
);

select tests_leq.connecter('33333333-3333-4333-8333-333333333333', true, 'utilisateur');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('audio-tentatives', '33333333-3333-4333-8333-333333333333/cccccccc-0000-4000-8000-000000000001.m4a') $$,
  'anonymous C uploads the diagnostic audio'
);
reset role;
select tests_leq.deconnecter();

select is((select count(*) from storage.objects where bucket_id = 'audio-tentatives'), 2::bigint, 'both uploads are in the bucket');

select * from finish();

rollback;
