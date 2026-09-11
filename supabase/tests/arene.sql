-- pgTAP tests for migration 0010 (Arena and duels). One rolled-back transaction.
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
-- An analysed take of the given type, with a grid total, as the worker leaves it.
create function tests_leq.prise_analysee(p_uid uuid, p_type text, p_duel uuid, p_note numeric)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.tentatives (id, utilisateur_id, type, duel_id, enregistre_le, fuseau_horaire,
                                 decalage_minutes, statut, chemin_audio)
  values (v_id, p_uid, p_type, p_duel, now(), 'Europe/Paris', 120, 'retour_disponible',
          p_uid::text || '/' || v_id::text || '.m4a');
  insert into public.evaluations (tentative_id, note_totale) values (v_id, p_note);
  return v_id;
end; $$;

select tests_leq.creer_utilisateur('11111111-1111-4111-8111-111111111111', 'a@test.leq', false);
select tests_leq.creer_utilisateur('22222222-2222-4222-8222-222222222222', 'b@test.leq', false);
select tests_leq.creer_utilisateur('33333333-3333-4333-8333-333333333333', 'c@test.leq', false);
select tests_leq.creer_utilisateur('44444444-4444-4444-8444-444444444444', 'admin@test.leq', false);
select tests_leq.creer_utilisateur('55555555-5555-4555-8555-555555555555', 'anon@test.leq', true);
update public.profils set role = 'admin' where id = '44444444-4444-4444-8444-444444444444';
update public.profils set prenom = 'Camille', publier_sous_prenom = true
 where id = '11111111-1111-4111-8111-111111111111';
insert into public.configuration (cle, type, valeur, description)
values ('duree_sujet_arene_jours', 'nombre', '7', 'x'), ('points_par_vote', 'nombre', '5', 'x'),
       ('duree_duel_heures', 'nombre', '48', 'x'), ('plafond_duree_duel_gratuit_s', 'nombre', '90', 'x')
on conflict (cle) do nothing;
insert into public.sujets_arene (cle, texte, ordre) values
  ('sujet_un', 'Faut-il dire la vérité à tout prix ?', 1),
  ('sujet_deux', 'Le talent existe-t-il ?', 2)
on conflict (cle) do nothing;
create temp table ctx as select
  '11111111-1111-4111-8111-111111111111'::uuid as a,
  '22222222-2222-4222-8222-222222222222'::uuid as b,
  '33333333-3333-4333-8333-333333333333'::uuid as c;
grant select on ctx to authenticated;

-- RLS is on everywhere ----------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.sujets_arene'::regclass), 'RLS on sujets_arene');
select ok((select relrowsecurity from pg_class where oid = 'public.prises_publiques'::regclass), 'RLS on prises_publiques');
select ok((select relrowsecurity from pg_class where oid = 'public.votes'::regclass), 'RLS on votes');
select ok((select relrowsecurity from pg_class where oid = 'public.duels'::regclass), 'RLS on duels');
select ok((select relrowsecurity from pg_class where oid = 'public.impressions'::regclass), 'RLS on impressions');
select ok((select relrowsecurity from pg_class where oid = 'public.moderations'::regclass), 'RLS on moderations');

-- the rotation activates one subject at a time ----------------------------------------------------
select is((select id from public.sujet_arene_actif()), null, 'no subject before the first rotation');
select is((select cle from public.sujets_arene where id = public.roter_sujet_arene()), 'sujet_un', 'the first subject is activated');
select is((select cle from public.sujets_arene where id = public.roter_sujet_arene()), 'sujet_un', 'a rotation inside the week changes nothing');
select is((select count(*) from public.sujets_arene where actif_le is not null), 1::bigint, 'exactly one activated');
create temp table sujet as select id from public.sujet_arene_actif();
grant select on sujet to authenticated;

-- publishing is a deliberate gesture, and only for an analysed take ---------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ select public.publier_prise(gen_random_uuid()) $$, 'P0002', 'tentative_introuvable', 'nothing to publish');
reset role; select tests_leq.deconnecter();
create temp table prises as select
  tests_leq.prise_analysee((select a from ctx), 'arene', null, 20) as ta,
  tests_leq.prise_analysee((select b from ctx), 'arene', null, 18) as tb,
  tests_leq.prise_analysee((select c from ctx), 'arene', null, 25) as tc;
grant select on prises to authenticated;
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok($$ select public.publier_prise((select ta from prises)) $$, 'A publishes a take');
select is((select public.publier_prise((select ta from prises))), (select id from public.prises_publiques where tentative_id = (select ta from prises)), 'publishing twice answers the same take');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select lives_ok($$ select public.publier_prise((select tb from prises)) $$, 'B publishes a take');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('33333333-3333-4333-8333-333333333333', false, 'utilisateur');
select lives_ok($$ select public.publier_prise((select tc from prises)) $$, 'C publishes a take');
reset role; select tests_leq.deconnecter();
select is((select count(*) from public.prises_publiques), 3::bigint, 'three public takes');

-- an anonymous account publishes nothing in the Arena (it would be ranked) --------------------------
select tests_leq.connecter('55555555-5555-4555-8555-555555555555', true, 'utilisateur');
select throws_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values (gen_random_uuid(), '55555555-5555-4555-8555-555555555555', 'arene', now(), 'Europe/Paris', 120, 'envoyee') $$,
  '42501', null, 'an anonymous account cannot even record for the Arena');
reset role; select tests_leq.deconnecter();
-- and the function guards the Arena too, whatever the row came from
create temp table prise_anon as select
  tests_leq.prise_analysee('55555555-5555-4555-8555-555555555555', 'arene', null, 15) as t;
grant select on prise_anon to authenticated;
select tests_leq.connecter('55555555-5555-4555-8555-555555555555', true, 'utilisateur');
select throws_ok($$ select public.publier_prise((select t from prise_anon)) $$, '42501', 'compte_requis', 'an anonymous account cannot publish in the Arena');
reset role; select tests_leq.deconnecter();

-- takes stay hidden until you have spoken, and until moderation lets them through --------------------
select tests_leq.creer_utilisateur('66666666-6666-4666-8666-666666666666', 'd@test.leq', false);
select tests_leq.connecter('66666666-6666-4666-8666-666666666666', false, 'utilisateur');
select is((select count(*) from public.prises_publiques), 0::bigint, 'D has not spoken: sees nothing');
select is((select (public.paire_a_voter()) ->> 'raison'), 'parle_d_abord', 'and is asked to speak first');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.prises_publiques), 1::bigint, 'A has spoken but the others wait for moderation');
reset role; select tests_leq.deconnecter();
update public.prises_publiques set statut = 'publiee';
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select is((select count(*) from public.prises_publiques), 3::bigint, 'once published, A sees the three');

-- voting by pairs ------------------------------------------------------------------------------------
select is((select (public.paire_a_voter()) ->> 'raison'), 'ok', 'A gets a pair');
select is((select count(*) from public.impressions where votant_id = (select a from ctx)), 2::bigint, 'the two takes shown are recorded');
-- One call only: each call draws its own pair.
create temp table paire_brute as select public.paire_a_voter() as j;
create temp table paire as select (j #>> '{a,id}')::uuid as g, (j #>> '{b,id}')::uuid as p from paire_brute;
select lives_ok($$ select public.voter((select g from paire), (select p from paire)) $$, 'A votes');
select is((select votes_recus from public.prises_publiques where id = (select g from paire)), 1, 'the winner gains a vote');
select is((select count(*) from public.mouvements_points where utilisateur_id = (select a from ctx) and motif = 'vote'), 1::bigint, 'voting earns points');
select throws_ok($$ select public.voter((select g from paire), (select p from paire)) $$, 'P0001', 'deja_vote', 'the same pair is voted once');
select throws_ok($$ select public.voter((select id from public.prises_publiques where utilisateur_id = (select a from ctx)), (select g from paire)) $$, '42501', 'vote_sur_soi', 'nobody votes on their own take');
select is((select (public.paire_a_voter()) ->> 'raison'), 'rien_a_comparer', 'with three takes and one pair voted, nothing is left for A');
select is((select jsonb_array_length((public.classement_arene()) -> 'classement')), 3, 'the ranking lists the three');
select is(
  (select l ->> 'nom' from jsonb_array_elements((public.classement_arene()) -> 'classement') l
    where (l ->> 'moi')::boolean),
  'Camille', 'a first name shows when the person opted in');
select isnt(
  (select l ->> 'nom' from jsonb_array_elements((public.classement_arene()) -> 'classement') l
    where not (l ->> 'moi')::boolean limit 1),
  'Camille', 'the others are not named');
select ok(
  (select bool_and((l ->> 'nom') like 'Voix %')
     from jsonb_array_elements((public.classement_arene()) -> 'classement') l
    where not (l ->> 'moi')::boolean),
  'the others stay anonymous, as Voix N');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select is((select count(*) from public.votes), 0::bigint, 'B does not read A''s vote');
reset role; select tests_leq.deconnecter();

-- the closing of a week deletes the audio and keeps the ranking ---------------------------------------
update public.sujets_arene set actif_le = now() - interval '8 days' where id = (select id from sujet);
select is((select cle from public.sujets_arene where id = public.roter_sujet_arene()), 'sujet_deux', 'the next subject takes the place');
select isnt((select ferme_le from public.sujets_arene where id = (select id from sujet)), null, 'the week is closed');
select is((select count(*) from public.prises_publiques where sujet_id = (select id from sujet) and date_suppression is null), 0::bigint, 'every take of the closed week is marked for deletion');
select is((select count(*) from public.prises_publiques where sujet_id = (select id from sujet)), 3::bigint, 'the rows stay: the ranking is not lost');

-- duels ------------------------------------------------------------------------------------------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select throws_ok($$ select public.creer_duel('  ') $$, '23514', 'sujet_requis', 'a duel needs a subject');
create temp table duel as select * from public.creer_duel('Le talent existe-t-il ?');
grant select on duel to authenticated;
select is((select length(jeton) from duel), 32, 'the invitation token is 32 characters');
select is((select duree_max_s from duel), 90, 'the free cap applies');
select throws_ok($$ select public.rejoindre_duel((select jeton from duel)) $$, '42501', 'duel_sur_soi', 'nobody duels themselves');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select is((select (public.lire_duel_par_jeton((select jeton from duel))) ->> 'sujet'), 'Le talent existe-t-il ?', 'the invitee reads the subject before recording');
select lives_ok($$ select public.rejoindre_duel((select jeton from duel)) $$, 'B joins the duel');
reset role; select tests_leq.deconnecter();
select is(public.cloturer_duel((select id from duel)), null, 'nothing closes while the deadline holds and takes are missing');
create temp table duelprises as select
  tests_leq.prise_analysee((select a from ctx), 'duel', (select id from duel), 22) as ta,
  tests_leq.prise_analysee((select b from ctx), 'duel', (select id from duel), 26) as tb;
grant select on duelprises to authenticated;
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
select lives_ok($$ select public.publier_prise((select ta from duelprises)) $$, 'A answers the duel');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select lives_ok($$ select public.publier_prise((select tb from duelprises)) $$, 'B answers the duel');
reset role; select tests_leq.deconnecter();
select is(public.cloturer_duel((select id from duel)), 'invite', 'the higher grid total wins, and the app says the verdict is automatic');
select is((select count(*) from public.prises_publiques where duel_id = (select id from duel) and date_suppression is null), 0::bigint, 'the duel audio is marked for deletion at closing');
-- an invitee without the app answers by the link, as an anonymous principal (chapter 11) ------------
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
create temp table duel_anon as select * from public.creer_duel('Sans application');
grant select on duel_anon to authenticated;
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('55555555-5555-4555-8555-555555555555', true, 'utilisateur');
select is((select (public.lire_duel_par_jeton((select jeton from duel_anon))) ->> 'sujet'), 'Sans application', 'the anonymous invitee reads the subject');
select lives_ok($$ select public.rejoindre_duel((select jeton from duel_anon)) $$, 'the anonymous invitee joins');
select lives_ok(
  $$ insert into public.tentatives (id, utilisateur_id, type, duel_id, enregistre_le, fuseau_horaire, decalage_minutes, statut)
     values ('dddddddd-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'duel',
             (select id from duel_anon), now(), 'Europe/Paris', 120, 'envoyee') $$,
  'the anonymous invitee records a duel take');
reset role; select tests_leq.deconnecter();
update public.tentatives set statut = 'retour_disponible' where id = 'dddddddd-0000-4000-8000-000000000001';
insert into public.evaluations (tentative_id, note_totale) values ('dddddddd-0000-4000-8000-000000000001', 19);
select tests_leq.connecter('55555555-5555-4555-8555-555555555555', true, 'utilisateur');
select lives_ok($$ select public.publier_prise('dddddddd-0000-4000-8000-000000000001') $$, 'and publishes it, without an account');
reset role; select tests_leq.deconnecter();

-- a duel with one take only expires without verdict
select tests_leq.connecter('11111111-1111-4111-8111-111111111111', false, 'utilisateur');
create temp table duel2 as select * from public.creer_duel('Un seul parle');
grant select on duel2 to authenticated;
reset role; select tests_leq.deconnecter();
update public.duels set echeance = now() - interval '1 hour' where id = (select id from duel2);
select is(public.cloturer_duel((select id from duel2)), 'expire', 'with one take only the duel expires without verdict');
select is((select verdict from public.duels where id = (select id from duel2)), null, 'and no verdict is written');

-- moderation ---------------------------------------------------------------------------------------------
select tests_leq.connecter('22222222-2222-4222-8222-222222222222', false, 'utilisateur');
select throws_ok($$ select public.moderer_prise((select id from public.prises_publiques limit 1), 'retiree', 'x') $$, '42501', null, 'a person moderates nothing');
reset role; select tests_leq.deconnecter();
select tests_leq.connecter('44444444-4444-4444-8444-444444444444', false, 'admin');
select lives_ok($$ select public.moderer_prise((select id from public.prises_publiques where utilisateur_id = (select c from ctx) limit 1), 'retiree', 'Harcèlement') $$, 'the admin withdraws a take');
select is((select statut from public.prises_publiques where utilisateur_id = (select c from ctx) limit 1), 'retiree', 'the take is withdrawn');
select is((select count(*) from public.moderations), 1::bigint, 'the decision is logged');
reset role; select tests_leq.deconnecter();

select * from finish();
rollback;
