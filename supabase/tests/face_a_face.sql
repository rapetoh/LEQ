-- pgTAP tests for migration 0015 (the face-à-face, Phase 8). One rolled-back transaction.
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
select tests_leq.creer_utilisateur('55555555-5555-4555-8555-555555555555', 'anon@test.leq', true);
update public.profils set role = 'admin' where id = '44444444-4444-4444-8444-444444444444';

-- A is a subscriber, B stays on the free plan.
insert into public.abonnements (utilisateur_id, formule, source, actif_jusqu_a)
values ('11111111-1111-4111-8111-111111111111', 'complet', 'revenuecat', now() + interval '30 days')
on conflict do nothing;

insert into public.configuration (cle, type, valeur, description) values
  ('quota_face_a_face_gratuit', 'nombre', '0', 'x'),
  ('quota_face_a_face_complet', 'nombre', '8', 'x'),
  ('duree_face_a_face_gratuit_s', 'nombre', '180', 'x'),
  ('duree_face_a_face_complet_s', 'nombre', '480', 'x'),
  ('reprise_debat_minutes', 'nombre', '30', 'x')
on conflict (cle) do update set valeur = excluded.valeur;

-- The suite owns this bank: the project holds real rows whose `ordre` would collide with
-- the fixtures, and whose presence would change what the rotation answers. Rolled back
-- with everything else.
delete from public.theses;
insert into public.theses (cle, texte, ton_suggere, ordre) values
  ('these_un', 'Le télétravail a tué la vie de bureau.', 'ferme', 1),
  ('these_deux', 'On devrait tirer les responsables politiques au sort.', 'provocateur', 2)
on conflict (cle) do nothing;

create temp table ctx as select
  '11111111-1111-4111-8111-111111111111'::uuid as a,
  '22222222-2222-4222-8222-222222222222'::uuid as b,
  (select id from public.theses where cle = 'these_un') as t1;
grant select on ctx to authenticated;

-- RLS is on everywhere ----------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.theses'::regclass), 'RLS on theses');
select ok((select relrowsecurity from pg_class where oid = 'public.debats'::regclass), 'RLS on debats');
select ok((select relrowsecurity from pg_class where oid = 'public.tours_debat'::regclass), 'RLS on tours_debat');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'debats' and cmd in ('INSERT', 'UPDATE', 'DELETE')), 0::bigint,
  'no client writes a debate directly: everything goes through the functions');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'tours_debat' and cmd <> 'SELECT'), 0::bigint,
  'no client writes a turn: only the server has heard both voices');

-- the flag gates everything ----------------------------------------------------------------------
update public.drapeaux set actif = false where cle = 'face_a_face';
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ select public.ouvrir_debat((select t1 from ctx)) $$, 'P0001', 'face_a_face_eteint',
  'nothing opens while the flag is off');
reset role; select tests_leq.deconnecter();
update public.drapeaux set actif = true where cle = 'face_a_face';

-- an account is required, and a suspended one is refused ------------------------------------------
select tests_leq.connecter('55555555-5555-4555-8555-555555555555', true, 'utilisateur');
select throws_ok($$ select public.ouvrir_debat((select t1 from ctx)) $$, '42501', 'compte_requis',
  'an anonymous visitor does not debate');
reset role; select tests_leq.deconnecter();

-- the free plan has no session, and says so as a quota rather than a locked door -------------------
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select is((public.quota_debats()) ->> 'formule', 'gratuit', 'B is on the free plan');
select is(((public.quota_debats()) ->> 'plafond')::integer, 0, 'the free plan has no session this month');
select throws_ok($$ select public.ouvrir_debat((select t1 from ctx)) $$, 'P0001', 'quota_epuise',
  'and opening one is refused for that reason');
reset role; select tests_leq.deconnecter();

-- opening a session from the bank -----------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(((public.quota_debats()) ->> 'plafond')::integer, 8, 'a subscriber has eight sessions a month');
select is(((public.quota_debats()) ->> 'restants')::integer, 8, 'and has used none of them');
select is((select count(*) from public.theses_proposees(2)), 2::bigint, 'the bank proposes its theses in order');
create temp table debat as select * from public.ouvrir_debat((select t1 from ctx));
grant select on debat to authenticated;
select is((select these_texte from debat), 'Le télétravail a tué la vie de bureau.',
  'the thesis is copied into the session, so editing the bank never rewrites a past debate');
select is((select origine_these from debat), 'banque', 'it came from the bank');
select is((select ton_adversaire from debat), 'ferme', 'the suggested tone applies when none is given');
select is((select duree_max_s from debat), 480, 'the subscriber cap applies');
select is((select statut from debat), 'ouverte', 'the session is open');
select is((select issue from debat), null, 'and its outcome is not written yet');

-- a running session is not counted, but it is resumed ----------------------------------------------
select is(((public.quota_debats()) ->> 'utilises')::integer, 0, 'a running session costs nothing yet');
select is((select id from public.debat_a_reprendre()), (select id from debat), 'it is the session to come back to');
select throws_ok($$ select public.ouvrir_debat((select t1 from ctx)) $$, 'P0001', 'debat_en_cours',
  'opening another while one is running is refused rather than silently answering the old one');
select is((select count(*) from public.debats where utilisateur_id = (select a from ctx)), 1::bigint,
  'so there is still exactly one session');
reset role; select tests_leq.deconnecter();

-- turns are written by the server, and they are text ------------------------------------------------
select lives_ok($$ select public.enregistrer_tour((select id from debat), 1, 'utilisateur', 'Je pense que non.', 12.5) $$,
  'the server writes the first turn');
select lives_ok($$ select public.enregistrer_tour((select id from debat), 2, 'retor', 'Vous confondez deux choses.', null) $$,
  'and the answer');
select is((select secondes_parlees from public.debats where id = (select id from debat)), 12.50,
  'only what the person said counts towards the cap, to the measured second');
select lives_ok($$ select public.enregistrer_tour((select id from debat), 1, 'utilisateur', 'Je pense que non, vraiment.', 13) $$,
  'a turn rewritten by a retry replaces itself instead of duplicating');
select is((select count(*) from public.tours_debat where debat_id = (select id from debat)), 2::bigint,
  'so the transcript still holds two turns');
select is((select secondes_parlees from public.debats where id = (select id from debat)), 13.00,
  'and the retry adds only the difference: our retry never eats the person''s time');

select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(jsonb_array_length(public.transcription_debat((select id from debat))), 2,
  'the person reads their own transcript');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select is((select count(*) from public.tours_debat), 0::bigint, 'nobody reads someone else''s debate');
select is((select count(*) from public.debats), 0::bigint, 'not even the session row');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select is((select count(*) from public.debats), 0::bigint,
  'the admin does not read a debate either: it is practice, not public speech');
reset role; select tests_leq.deconnecter();

-- a session cut on our side costs nothing (chapter 10) -----------------------------------------------
select lives_ok($$ select public.cloturer_debat((select id from debat), 'interrompue_par_nous') $$,
  'the server closes the session as our own cut');
select is((select statut from public.debats where id = (select id from debat)), 'interrompue', 'the row says interrupted');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(((public.quota_debats()) ->> 'utilises')::integer, 0, 'and the month still counts none used');
select is(((public.quota_debats()) ->> 'restants')::integer, 8, 'the eight sessions are intact');
-- Our own cut is exactly the session that must come back: the turns are written, and E3b's
-- "Reprendre" button existed for months answering "ce débat est terminé".
select is((select id from public.debat_a_reprendre()), (select id from debat),
  'a session we cut ourselves is offered back');
reset role; select tests_leq.deconnecter();
select is((select statut from public.reprendre_debat((select id from debat))), 'ouverte',
  'and reopening it puts it back in play');
select is((select issue from public.debats where id = (select id from debat)), null,
  'its outcome is cleared, so it charges nothing until it really ends');
select is((select count(*) from public.reprendre_debat((select id from debat))), 0::bigint,
  'a session already open is not reopened twice');
-- Put it back where the suite found it: closed by our own cut, charging nothing, so the counts
-- that follow still measure what they were written to measure.
reset role; select tests_leq.deconnecter();
select lives_ok($$ select public.cloturer_debat((select id from debat), 'interrompue_par_nous') $$,
  'the resumed session is closed again as our own cut');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');

-- a session that went to the end does cost one --------------------------------------------------------
select throws_ok($$ select public.ouvrir_debat(null, '   ') $$, '23514', 'these_requise',
  'an empty thesis is refused before anything else is even looked at');
select lives_ok($$ select public.abandonner_debat() $$, 'the person chooses to start another one instead');
create temp table debat2 as select * from public.ouvrir_debat(null, 'Les notes à l''école sont inutiles.', 'academique');
grant select on debat2 to authenticated;
select is((select origine_these from debat2), 'personnelle', 'a thesis of one''s own is allowed, and named as such');
select is((select ton_adversaire from debat2), 'academique', 'the chosen tone applies');
reset role; select tests_leq.deconnecter();
select lives_ok($$ select public.cloturer_debat((select id from debat2), 'terminee') $$, 'the session goes to the end');
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(((public.quota_debats()) ->> 'utilises')::integer, 1, 'that one is counted');
select is(((public.quota_debats()) ->> 'restants')::integer, 7, 'seven left');

-- an abandoned session is counted, and stops blocking the way ------------------------------------------
create temp table debat3 as select * from public.ouvrir_debat((select t1 from ctx));
grant select on debat3 to authenticated;
reset role; select tests_leq.deconnecter();
update public.debats set derniere_activite_le = now() - interval '2 hours' where id = (select id from debat3);
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
create temp table debat4 as select * from public.ouvrir_debat((select t1 from ctx));
grant select on debat4 to authenticated;
select isnt((select id from debat4), (select id from debat3), 'a stale session is not resumed, a new one starts');
select is((select issue from public.debats where id = (select id from debat3)), 'abandonnee',
  'the stale one is closed as abandoned');
select is(((public.quota_debats()) ->> 'utilises')::integer, 2, 'and it cost a session');
reset role; select tests_leq.deconnecter();

-- the quota actually stops the ninth session -------------------------------------------------------------
select lives_ok($$ select public.cloturer_debat((select id from debat4), 'terminee') $$, 'close the current one');
update public.configuration set valeur = '3' where cle = 'quota_face_a_face_complet';
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is(((public.quota_debats()) ->> 'restants')::integer, 0, 'the month is used up at the new cap');
select throws_ok($$ select public.ouvrir_debat((select t1 from ctx)) $$, 'P0001', 'quota_epuise',
  'and the next session is refused');
reset role; select tests_leq.deconnecter();

-- the bank is Rebecca's, and hers alone -------------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ insert into public.theses (cle, texte, ordre) values ('x', 'y', 99) $$, '42501',
  'new row violates row-level security policy for table "theses"', 'a person does not write the bank');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok($$ insert into public.theses (cle, texte, ordre) values ('these_trois', 'Le mérite est un mythe.', 3) $$,
  'the admin writes the bank');
reset role; select tests_leq.deconnecter();

select * from finish();
rollback;
