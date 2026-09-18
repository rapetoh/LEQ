# Status

Last updated: 2026-09-16, after the brief, the recorder and the feedback were redrawn to the mockup, the simulator window was found again (Device Hub), and build 19 was uploaded from the command line (last section). Update this file in the same commit as any change of state.

How to read it: one line per phase, then the checklist of the phase in progress, then what has actually been verified on a machine versus what has only been written, then what is blocked and by whom, then the next actions in order.

## State by phase

| Phase | Name                                                        | State                                                                                                |
| ----- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 0     | Foundations                                                 | Built, green, schema live and verified, server deployed on Fly and verified; device checks remain    |
| 1     | Socle: flow A end to end with a stub transcriber            | Built (slices 1 to 6), server loop verified; the device walkthrough (slice 7) waits for Roch         |
| 2     | STT bench, then debate cost spike                           | Closed by ADR-011: OpenAI for both modes, harness kept; the debate cost is still to be measured      |
| 3     | Measurement engine, grid engine, feedback, calibration tool | Engine and grid rules exist and are tested; wording and calibration tool not started                 |
| 4     | Path machinery, three formats, entitlements, RevenueCat     | Built and reviewed (seven fixes applied, migrations 0005 and 0007); RevenueCat waits for the account |
| 5     | Streak, points, shop, bridge to Rebecca                     | Slices 1 to 3 built (database, mobile, admin); simulator boot and Roch's tap-through remain          |
| 6     | Admin space, complete                                       | In progress since 2026-09-06 (checklist below); offers content and moderation queue wait             |
| 7     | Arena and duels, shipped off, public web                    | Built, verified against production; the phone's publish gesture was missing until 2026-09-13         |
| 8     | Face-à-face                                                 | Built, verified against the deployed server with the real providers (2026-09-12 and 13)              |
| 9     | Release                                                     | In progress: TestFlight builds 1 to 15, sign-in and PostHog done; Sentry, RevenueCat, stores remain  |

A phase ends when its acceptance list is green and this file says so.

## What exists today

| Workspace          | Content                                                                                                                                                                                                                                                                                                                                                                            | Checks                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/domaine` | Zod schemas and types for every Phase 0 table, the configuration seed definitions, the grid rule engine (`evaluerRegle`, `evaluerCriteres`), job charges                                                                                                                                                                                                                           | typecheck, 27 tests                                                      |
| `packages/moteur`  | The measurement engine over PCM plus transcript (nine measure families of chapter 5), WAV codec, French WER, deterministic transcriber and prosody stubs, synthetic fixtures; the STT bench harness (`bench/`) with the four provider adapters declared and refusing to run without keys                                                                                           | typecheck, 33 tests                                                      |
| `apps/serveur`     | Hono service with `/sante`, the worker loop, the analysis pipeline in the order of the state diagram, the sweep, the anonymous purge and account deletion jobs, ffmpeg decoding, the Praat prosody CLI (Python) with its pytest, Dockerfile, Fly configuration with two process groups                                                                                             | typecheck, 10 tests, 4 Python tests                                      |
| `supabase/`        | Seven migrations (socle, socle_phase1, demandes_export, parcours, correctifs_parcours, serie_points, grilles_anonymes), idempotent seed with the mockup's static path and shop, pgTAP suites (socle 133, socle_phase1 22, demandes_export 7, parcours 59, serie_points 63), CLI config, French auth e-mail templates, two remote runners and a seed applier                        | pushed to the hosted project on 2026-09-06; every suite green against it |
| `apps/mobile`      | Expo SDK 57 app: tokens and Manrope, themes, Bulle placeholder, UI primitives, tab bar honouring the `arene` flag, flow A (A1 to A7) with the recorder, the local queue and the waiting states, G3 with the streak protection, the path (B1, B3, B4, B5 with H2, H1, H3, H4, H5, X5), the streak and points on G1 and B1, D1 and D1b progress, D2 shop, F1 bridge, local reminders | typecheck, lint, 46 tests                                                |
| `apps/admin`       | Vite + React space: login, role gate, layout, home, configuration editor, flags, the banks (défis act by act, exercices), the shop (récompenses with cost and monthly cap) and the exchanges to honour or cancel                                                                                                                                                                   | typecheck, lint, 27 tests                                                |
| `apps/web`         | The public surface: the duel invitation `/duel/:jeton` (read the subject, record in the browser, send, verdict), `/confidentialite` and `/conditions`. Wears the mockup's clothes (bleu nuit, Bulle in SVG, the gold recording ring), served by the public Fly process                                                                                                             | typecheck, lint, 30 tests                                                |
| `docs/`            | This folder, ten ADRs                                                                                                                                                                                                                                                                                                                                                              | prettier                                                                 |
| CI                 | `.github/workflows/check.yml`: typecheck, lint, tests, prettier, Python tests                                                                                                                                                                                                                                                                                                      | not yet run on GitHub                                                    |

`npm run check` and `npm run format:check` are green at the root on Node 25 (Vitest warns about the engine, nothing more).

## Phase 0 checklist

Ticked only when verified on a machine.

1. Repository
   - [x] `git init`, remote `rapetoh/LEQ`, README commit pulled, `Brainstorming/` committed untouched
2. Root tooling
   - [x] Workspaces, scripts `typecheck`, `lint`, `test`, `check`, `format`, `format:check`
   - [x] `tsconfig.base.json` (strict), Prettier, EditorConfig, `.gitignore`, `.nvmrc`
   - [x] `npm install` at the root succeeds (1,143 packages)
   - [x] `npm run check` green locally
3. `packages/domaine`
   - [x] Schemas for every Phase 0 table, rule v1 engine, configuration keys and defaults, flags, jobs
   - [x] Names match docs/DATA-MODEL.md (reviewed file by file)
   - [x] `typecheck` and `test` pass
4. `supabase/`
   - [x] `config.toml` (Postgres 17, anonymous sign-in, manual linking, hook)
   - [x] Migration `20260906000000_socle.sql` written and reviewed by reading; one fix applied (the column-protection trigger now lets a direct database connection change `role`, which the worker and the operator need)
   - [x] Seed written, idempotent
   - [x] Database tests run against the hosted project inside a rolled-back transaction: 133 assertions green (`node supabase/tests/executer-distant.mjs supabase/tests/socle.sql`)
   - [x] Project "LEQ" created on a dedicated account (join.leq@gmail.com, org "LEQ's Org"), ref `gnabuebxleogsuhvdgpk`, eu-west-1 (Ireland; Paris was the plan, kept as is)
   - [x] Migration and seed pushed (`db push --include-seed`, first try clean); auth settings applied with `config push` (anonymous sign-ins, manual linking, access token hook, `leq://auth` redirect); pg_cron confirmed (three `leq_*` schedules active)
5. `apps/mobile`
   - [x] Package `@leq/mobile`, `app.json` with name LEQ, scheme `leq`, bundle identifier `com.leqapp.mobile` (awaiting confirmation), French microphone text
   - [x] Tokens, Manrope, themes, Bulle placeholder
   - [x] `fr.ts` with the Phase 0 strings
   - [x] Tab bar with Aujourd'hui, Défis, Progrès, Moi, and L'Arène only when the flag is on (tested)
   - [x] A1 and A2 implemented, tabs as shells, X1
   - [x] Supabase client with anonymous sign-in at first launch
   - [x] Audio spike (a) as desk research: ADR-007 proposes `react-native-audio-api` for both paths, with a 15-item device checklist for Phase 1
   - [x] `npx expo run:ios --device "iPhone 17" --port 8082` builds, installs and boots the shell on the simulator: A1 renders as in the mockup (screenshot checked 2026-09-06). The tab bar could not be screenshotted: a deep link sent from outside the app triggers an iOS "Open in LEQ?" confirmation the simulator tool cannot answer; the tab logic is covered by the jest test and the manual tap-through is Roch's
   - [x] Native project regenerated with `prebuild --clean`: bundle identifier `com.leqapp.mobile`, French microphone text in the Info.plist
6. `apps/admin`
   - [x] Login, role gate, configuration editor, flags, tests
   - [x] Verified through the API against the hosted project: the admin token carries `app_metadata.role = admin`, the admin update returns one row, an anonymous user reads configuration but its update touches zero rows, may insert a `diagnostic` attempt (201) and not a step (403), and the trigger queues the analysis job. First admin account: join.leq@gmail.com (password in the root `.env`)
7. `apps/serveur`
   - [x] Hono, `/sante`, worker loop, the four job handlers, pipeline tests
   - [x] Dockerfile (ffmpeg, Python, Praat), `prosodie/extraire.py` with 4 passing tests on this Mac
   - [x] `fly.toml` with process groups `worker` and `temps-reel` in `cdg`
   - [x] Deployed on 2026-09-06 (Roch ran `fly auth login`): app `leq-serveur`, region cdg, one `worker` and one `temps-reel` machine, `/sante` answers, a `balayer_audio` job inserted on the hosted database was claimed and finished by the Fly worker in 59 ms (`fly logs`)
   - [x] A seeded `balayer_audio` job claimed and completed by the worker running on this Mac against the hosted database (413 ms). The same check on Fly follows the deploy
8. CI
   - [x] Workflow file present
   - [ ] First green run on GitHub (checked after the push that carries this file)
9. Docs
   - [x] STATUS, RUNBOOK, ARCHITECTURE, DATA-MODEL, SCREENS, EXTERNAL-SERVICES, OPEN-INPUTS, STRINGS, decisions/README, ADR-001 to ADR-008, a README in every workspace
   - [ ] Corpus spike (b): Common Voice FR subsets listed, consent text written, first recordings collected (bench layout and metadata format are written; no audio yet)
10. Commits

- [x] Pushed after the foundations and the CI file
- [x] Pushed after the Phase 0 build (this commit)

## Verified versus unverified

Verified on Roch's Mac on 2026-09-06 by running them:

- `npm install`, `npm run check` (typecheck, lint, tests in the five workspaces), `npm run format:check`.
- `apps/serveur/prosodie`: `pytest` in a virtualenv with `praat-parselmouth` on Python 3.9 (4 tests: a 220 Hz tone reads back within 5 Hz, silence is unvoiced, a too-short sound gives null tracks, the CLI writes JSON).
- ffmpeg 9 installed through Homebrew.

Written and reviewed by reading, never run:

- The Dockerfile image itself: the worker ran from this Mac, not from the container.
- `fly.toml`: no Fly login yet.
- The mobile shell beyond A1 on the simulator (tabs, A2, X1): covered by jest-expo tests only; Roch taps through on his phone or the simulator.
- The admin interface itself in a browser against the project: the RLS round trip was verified through the API, not by clicking through the pages.
- The end-to-end pipeline against a real bucket and database: the order of writes and the failure paths are covered by tests with injected fakes.
- The ADR-007 audio decision: desk research with sources; every claim about device behaviour is in the Phase 1 checklist.

Decisions taken during integration (not in the plan):

- The server's transcriber stub delegates to the engine's deterministic fake transcript instead of returning an empty one, so the feedback screens can be exercised end to end before the STT bench.
- Word timestamps are rounded to the millisecond before every threshold comparison in the engine (a gap of exactly 0.3 s was reading as 0.30000000000000004).
- `expo-audio` stays in the mobile app for the microphone permission only, behind `src/services/micro.ts`; ADR-007 forbids using it for capture and it leaves the project when the Phase 1 recorder lands.
- Node 25 is accepted locally (Vitest warns), CI runs Node 22.
- Expo's experimental typed routes are off (`app.json`, `experiments.typedRoutes: false`): npm keeps `expo-router` nested under `apps/mobile/node_modules` (a fresh install and a dedupe both leave it there, without a stated conflict), and the typed-routes generator inside `@expo/cli` requires `expo-router/_ctx-shared` from the root, where it is not found. Route strings stay plain strings; nothing else changes. Revisit when Expo fixes the resolution or when npm hoists the package.
- Native font embedding through the expo-font plugin was dropped: it resolved font files relative to the app folder, which fails in a workspace; the root layout loads Manrope at runtime.
- The Money App's bundler often occupies port 8081 on this Mac; LEQ runs its bundler on 8082 (`--port 8082`), documented in the runbook.

## Blocked

- Fly.io: resolved on 2026-09-06 (deployed and verified). Redeploy with `--ha=false` so Fly does not add a standby worker (docs/RUNBOOK.md).
- Device checks of ADR-007: run on Roch's iPhone and the simulator first (his testing setup); the Android half waits for an EAS development build on a borrowed or later device, before release.

## Phase 1 checklist (socle)

Written before the work started, as the rule says. Slices are built in this order; each ends with its checks green, `npm run check` green, docs updated, a commit pushed. Boxes are ticked when verified on a machine.

1. Contract and database (migration `0002_socle_phase1`)
   - [ ] `reponses_accueil` (the three onboarding answers, fixed option codes), `jetons_push` (Expo push tokens per device), `profils.prenom` set at A7, `demander_suppression_compte()` RPC that queues the `supprimer_compte` job for the caller, `tentatives` added to the Realtime publication
   - [ ] `@leq/domaine` schemas and option lists; pgTAP additions green against the hosted project
2. Recording stack on the phone (ADR-007)
   - [x] `react-native-audio-api` 0.13.3 installed with its config plugin (microphone text, background mode, Android foreground service of type microphone); the development build compiles and installs on the iPhone 17 simulator with React Native 0.86.3 (ADR-007 item 1)
   - [x] Recording service written (`src/services/enregistrement.ts`): session `record` in `measurement` mode, `.m4a` 22.05 kHz mono 32 kbps in the cache directory, level meter from the raw buffers, an interruption ends the take. Not yet exercised on a device: the simulator flow needs taps (slice 7)
   - [ ] Fallback documented and exercised only if the build fails (ADR-007, expo-audio recorder plus a session module)
3. Local queue and upload
   - [x] Queue written: pure state machine (`fileMachine.ts`), orchestrator with injected dependencies (`file.ts`), real wiring (`prises.ts`: AsyncStorage index, cache files, expo-network, triggers on foreground and network return), upload and insert idempotent by attempt id (`tentatives.ts`), Android backup disabled in `app.json`, expiry from `expiration_file_locale_jours`
   - [x] 11 unit tests: transitions, backoff, expiry, cleanup, interrupted take dropped, offline wait, failure and retry
4. Screens of flow A and the X states
   - [x] Screens written: A3 (`accueil/questions`), A4 with the X4 banner (`accueil/prise`), A5, X2 and X3 as states of one screen (`accueil/analyse`), A6 (`accueil/profil`), A7 (`accueil/compte`, e-mail code path live, Apple and Google buttons present but disabled until credentials). Typecheck, lint and tests green; not yet walked through on a device
   - [x] `useSuiviPrise` follows a take from the queue to the server statuses (Realtime on `tentatives`, polling every 15 s)
5. Server side of the loop
   - [x] `duree_s` written from the decoded audio
   - [x] Push "Ton retour est prêt" sent by the worker through Expo's push API after `retour_disponible`, one attempt, `DeviceNotRegistered` switches the token off (3 tests). Phone side: permission asked at "Quitter, on te préviendra", token registered in `jetons_push` (EAS project `@rxpetoh/leq`, id in `app.json`), a tap opens the take's screen. Not verified on a device (push needs a physical phone)
   - [x] Account deletion written end to end: G3 confirms, calls `demander_suppression_compte()`, cancels the queued takes, signs out, wipes the phone's storage and gets a fresh anonymous session; the worker's `supprimer_compte` job removes objects then the auth user (RPC and job verified by pgTAP; the phone path not yet tapped through)
6. Settings G3, minimal
   - [x] G3 written (`src/app/reglages.tsx`): the voice statement, "Publier sous mon prénom", the export request (table `demandes_export`, migration 0003, 7 pgTAP assertions, anonymous accounts refused), "Supprimer mon compte" with confirmation, the four notification switches and the reminder time (display only until Phase 5), night mode and reduced motion. Reached from the Moi tab
7. End to end on the simulator, then on Roch's iPhone
   - [x] Server side, on a synthetic 66 s M4A pushed exactly as the phone does (`apps/serveur/scripts/simuler-prise.mjs`): anonymous upload 200, insert 201, job claimed, transcription (stub), ffmpeg, Praat (pitch read at the synthesised 160 Hz), measures, analysis and evaluation written, audio object deleted, `retour_disponible` in 3.9 s, `duree_s` 66.00
   - [x] The Phase 1 build (audio, notifications, network, crypto modules) boots on the simulator and renders A1 with no runtime warning
   - [ ] Same loop driven from the app on the simulator (A1 to A6): needs taps, Roch or a later automation
   - [ ] Offline: airplane mode during A4, the take waits, sends when the network returns, the streak day is the recording day (checked in the row)
   - [ ] Failure injection in the worker: X3 shows, no `resultat`, nothing consumed
   - [ ] Deletion leaves no row and no object for the test user
   - [ ] ADR-007 checklist items 1 to 9 on Roch's iPhone (needs him)

Phase 1 acceptance: every box above, plus the privacy text sent for lawyer review (docs/OPEN-INPUTS.md).

## Phase 4 checklist (path machinery)

Built while the device walkthrough of Phase 1 waits for Roch. The generator itself is not written: its rules do not exist yet (cahier chapter 4). A static path, seeded from the validated mockup and marked provisional, exercises everything.

1. Contract and database (migration `0004_parcours`)
   - [x] Banks, per-person path, `abonnements`, the four functions (`obtenir_parcours`, `etape_du_jour`, `marquer_rattrapage_vu`, `appliquer_resultat`): migration 0004 applied on the hosted project
   - [x] Seed from the mockup applied (3 acts, 13 défis, 5 exercices, all `provisoire`); acte III empty until Rebecca's content. Note: `db push --include-seed` reported the seed applied without inserting it; `supabase/scripts/appliquer-seed.mjs` applies it directly
   - [x] pgTAP `tests/parcours.sql`: 43 assertions green on the hosted project (path creation for a user and an anonymous user, RLS, failure and remediation, validation and unlock, daily limit in gratuit lifted by complet, tries limit, abandoned attempt not counted, act closing); socle suite made robust to real jobs on the database
2. Server
   - [x] The pipeline calls `appliquer_resultat()` inside the transaction that writes the evaluation and logs the result; without a published grid the step stays open (13 server tests green)
3. Mobile
   - [x] B1 shows the real step of the day (title, act, position, points, formula and rhythm) in its five states (`etatAujourdhui`, tested); "Je me lance" opens B3, or X5 first when the remediation is proposed (5 render tests)
   - [x] B3 brief for the three formats (standard; texte with the reading time and the text; long with the three steps and the plan), locked and validated steps refused with a sentence, the daily limit redirects to H5; B4 is the diagnostic recorder made shared (`components/EcranPrise.tsx`, type `etape`, `duree_etape_min_s` new configuration key, text shown before the timer, preparation countdown with the plan); the waiting screen is shared too (`components/EcranAnalyse.tsx`, `suite` = profile or feedback); B5 shows the measures, the grid list and the result (H2 on the same screen); H3 opens when the take closed the act (`fermeLActe`, tested)
   - [x] H1 map of acts (mist, open act with its nodes, folded acts), H4 folded act with past results (score "Grille de Rebecca · n sur max", measures, relative date through Intl), H5 and H5b daily limit, X5 remediation with the exercise screen (timed practice, not recorded, not analysed: question for Rebecca in docs/OPEN-INPUTS.md). A tapped push opens the right waiting screen by attempt type
   - [ ] Walked through on the simulator (needs taps: Roch, or a later automation)
4. Admin
   - [x] Défis page (`/defis`): the bank act by act, create (`/defis/nouveau`) and edit (`/defis/:id`) in the three formats with the pure validation of `modele/defis.ts` (tested), reorder with arrows through `echanger_ordre_defis()` (migration 0005, atomic, admin only, 7 pgTAP assertions), mark validated (provisoire off) and deactivate with confirmation, rename or add an act. Exercices page (`/exercices`): list, create, edit, validate, deactivate. Home cards and navigation updated (12 admin tests added, 22 in all)
5. Verification
   - [x] pgTAP green on the hosted project (parcours 50), server tests (13), mobile tests for the rhythm, the result and the B1 card (37), admin tests (22), `npm run check` and `npm run format:check` green
   - [x] Simulator boot with the Phase 4 app: `npx expo run:ios --device "iPhone 17" --port 8082` builds (0 errors), installs, bundles 2,266 modules with no runtime warning, A1 renders (screenshot checked 2026-09-06). The path screens themselves need taps: Roch's walkthrough, or a later automation
6. Review (two independent readers, 2026-09-06)
   - [x] Fixed: the feedback query embedded `etapes` through two foreign keys and PostgREST refused it (every B5 failed); anonymous people could not insert a step attempt (RLS, migration 0005); a deactivated défi vanished from existing paths (RLS, 0005); `etapes.ordre` was the bank position, not a rank (0005); the recorder left the partial file on the phone on cancel; a double tap on "Commencer" could start two recordings; formula names were hardcoded; curly apostrophes; the admin's format switch left stale fields that blocked the save without a visible error; the reorder arrows re-enabled before the list refreshed; the header actions remounted the form and dropped edits; the pgTAP reorder test depended on the live bank order; `defis.ordre` had no positivity check; anonymous people could not read a published grid (0007)

## Phase 5 checklist (streak, points, shop, bridge to Rebecca)

Written before the work started. Cahier chapters 6 and 7, ADR-009. Slices in order; each ends with its checks green, docs updated, a commit pushed.

1. Contract and database (migration `0006_serie_points`)
   - [x] `mouvements_points`, `recuperations_serie`, `recompenses`, `echanges_recompenses`; `calculer_serie` / `ma_serie`, `activer_recuperation_serie`, `mes_points`, `mes_recompenses`, `echanger_recompense`, `traiter_echange`, `resume_progres`; `appliquer_resultat` credits the défi's points; seed of the mockup's four rewards (provisoire); configuration key `heure_alerte_serie`; ADR-009 written
   - [x] pgTAP `tests/serie_points.sql`: 63 assertions green on the hosted project (replay, record, recovery and its two refusals, ledger idempotence, exchange, insufficient points, monthly cap, anonymous refused, admin honours and cancels with refund, progress aggregates); `@leq/domaine` schemas (`progres.ts`)
2. Mobile
   - [x] G1 shows the real streak, points and weeks won; B1 shows the streak chip and the points tile; "Mes récompenses" opens D2
   - [x] D1 and D1b from `resume_progres()`: week strip, the month in three numbers, crutch words per week (pure helpers tested), pace bar with the zone that carries, before and now; the five voices and the month's heading wait for the grid; X1 stays until the first analysed take
   - [x] D2 shop from `mes_recompenses()`: balance, rewards with cost and remaining quantity, exchange with confirmation, the five refusals in plain French, history; the hour with Rebecca shown as a distinction
   - [x] G3 "Protéger ma série": state and activation through `activer_recuperation_serie()`, refusals in plain French
   - [x] F1 bridge to Rebecca (`/rebecca`): the pitch, the one-to-one line, the workshop card as a placeholder until Phase 6 (testimonial and points claims of the mockup not shown: docs/STRINGS.md)
   - [x] Local notifications (`services/rappels.ts`, pure plan tested): the daily reminder at `heure_rappel` and the streak alert at `heure_alerte_serie` when nothing was recorded today, both honouring the G3 switches, recomputed on foreground and after a take
3. Admin
   - [x] Récompenses page: list, create, edit, type, cost, monthly cap, validate, deactivate (validation tested); Échanges: filter by status, honour, cancel with confirmation and refund
4. Verification
   - [x] pgTAP (all suites), server (13), mobile (46) and admin (27) tests green; `npm run check` and `npm run format:check` green
   - [x] Simulator boot with the Phase 5 app: builds (0 errors), installs, bundles 2,274 modules with no runtime warning, A1 renders (screenshot checked 2026-09-06)
   - [ ] Roch: tap through D1, D2, G3 protection and a reminder on his phone

## Phase 6 checklist (admin space, complete)

Written before the work started. Cahier chapters 8, 11 (suspension), 12 (announcements). Offers content waits for Rebecca and RevenueCat; the moderation queue waits for the public takes of Phase 7.

1. Contract and database (migration `0008_admin_phase6`)
   - [x] `ateliers` (Rebecca's workshops: title, place or online, region, date, places, link, optional reward for the place, published flag), `annonces` (an announcement sent once, optional workshop, optional region list, `envoyee_le`, sent and failed counts), `suspensions` (append-only log); `publier_annonce()` enforces the monthly cap (`plafond_annonces_par_mois`) in the database, not in the SPA, and queues the `envoyer_annonce` job; `suspendre_compte()` and `reactiver_compte()` (admin only); `est_suspendu()`; a suspended person can no longer insert attempts or exchange points; configuration key `mots_bequilles` (json list) so Rebecca edits the filler words
   - [x] pgTAP `tests/admin_phase6.sql`: 34 assertions green on the hosted project (workshops visible only when published, cap of two announcements a month, empty region list means everyone, one job per announcement, suspension with a reason and its log, a suspended person records and spends nothing, reactivation); every earlier suite green again after the policy change; `@leq/domaine` schemas (`annonces.ts`, job `envoyer_annonce`, key `mots_bequilles`)
2. Server
   - [x] Job `envoyer_annonce` (`jobs/envoyerAnnonce.ts`): one push per active token of the people who keep `notif_annonces` on, whose region is in the list (everyone when the list is null), not suspended; batches of 100; tokens marked as for the feedback push; counts written back; idempotent; 4 tests with a fake sender (17 server tests)
   - [x] The pipeline reads the filler word list from `configuration.mots_bequilles` at each analysis, falling back to the contract's v1 list
3. Admin
   - [x] Grille (`/grille`): versions as tabs, a draft edited criterion by criterion (key, name, definition, score max, elements with a measure path from the contract or a per-word crutch count, bands, weights; pure validation tested), publish with confirmation (one-way), a new version copied from the selected one, published versions read-only
   - [x] Annonces (`/annonces`): compose (title, body, linked workshop, regions as toggles), the month's counter against the cap, send through `publier_annonce()`, history with the delivery counts; Ateliers (`/ateliers`): create, edit, publish and unpublish, region, places, booking link, the reward that gives a place
   - [x] Utilisateurs (`/utilisateurs`): profiles with search and filters, suspend with a reason, reactivate, the open reason shown on the row
   - [x] Demandes de données (`/exports`): the inbox, mark treated, reopen (31 admin tests in all)
4. Mobile
   - [x] B1 "Avec Rebecca, ce mois-ci": the next published workshop (`components/CarteAtelier.tsx`), "Tout voir" opens B1b (`/aujourdhui/rebecca`) with workshops, the one-to-one line and announcements; F1 shows the workshop card with the points line when a reward gives a place; a tapped announcement (X6, data `annonce_id`) opens B1b
   - [x] G3: the region picker (fixed list of the contract)
   - [x] A suspended account is sent to `/suspendu` from every screen but the settings (`components/GardeSuspension.tsx`), with the two gestures that stay open in G3
5. Verification
   - [x] pgTAP (all suites), server (17), mobile (49) and admin (31) tests green; `npm run check` and `npm run format:check` green
6. Review (two independent readers, 2026-09-06, Phases 5 and 6 together)
   - [x] Fixed (migration 0009): "today" followed Europe/Paris for anyone whose profile had no zone (now the zone of the last take, and the phone writes its zone to the profile at session start); `appliquer_resultat` counted a second failure when the pipeline was replayed; the recovery vanished when the person recorded today before activating it; the announcement job could re-send on a retry (it now claims before sending); re-opening a cancelled exchange deleted the refund (now a compensating movement under the points lock); the export inbox embed was ambiguous (two foreign keys to profils); a distinction kept hidden cost fields; the G3 sentence when the month's recovery is already used; "En ligne" hardcoded. 77 pgTAP assertions on serie_points, 18 server tests
   - [x] Simulator boot with the Phase 6 app: builds (0 errors), installs, bundles with no runtime warning, A1 renders (screenshot checked 2026-09-06)

## What is in TestFlight right now

Build 7 (commit `ed0de0f`, 2026-09-11) is the recording fix and nothing after it. Everything committed since is Phase 7, which ships behind the `arene` and `duels` flags and is therefore invisible in that build. Roch can test flow A and the daily loop on build 7 as it stands; a new build is worth making when he wants to see the Arena, or when Phase 8 starts.

## The recording bug, found and fixed (2026-09-11)

Roch could not record on his iPhone. The recorder never worked, on any device: the iOS AAC encoder refuses to open a 16 kHz file (`AudioConverterSetProperty(converter, kAudioConverterEncodeBitRate, ...)` fails, error 560226676), so `recorder.start()` returned an error and the screen showed "L'enregistrement n'a pas démarré". Found by adding `apps/mobile/src/app/diagnostic.tsx`, a development-only screen that runs the chain and tries several recorder settings; 16 kHz fails, 22.05 kHz and above succeed. The recorder now writes 22.05 kHz mono 32 kbps; the worker already resamples to 16 kHz with ffmpeg, so nothing downstream changes. Verified end to end on the simulator: 3.00 s recorded, 45 kB file, 41 level frames.

## Roch's first device walkthrough (2026-09-10, TestFlight build 3)

Reported: default icon and splash (the logo was never wired), design below the mockup (tab bar, map of acts, mascot), recording does not start on the phone, "J'ai déjà un compte" led to the home screen, no visible account state. Fixed in build 4: the logo as icon and splash, Bulle redrawn from the mockup, the floating tab bar, the map of acts with its winding path, sign-in entry from A1, account state on Moi, light theme by default. The recorder now retries with the plain audio session and shows the technical reason on screen when it fails: Roch's next screenshot of A4 tells which native call refuses on the phone (never reproduced on the simulator).

## Design pass

Roch's rule (2026-09-06): the mockup is the floor, every screen equals it or does slightly better. One reader compared every built screen with its mockup screen; the 28 gaps and their state live in docs/DESIGN-PASS.md. Nine are fixed; the rest (progress ring, the map's winding path, the flame, A2 and A3 on bleu nuit, D2 bars, icons, French no-break spaces) are the next design work, before Phase 7.

## Phase 7 checklist (Arena and duels, shipped off)

Written before the work started. Cahier chapter 11, plan Phase 7. Everything ships behind the `arene` and `duels` flags, which stay off until Rebecca turns them on.

1. Contract and database (migration `0010_arene`)
   - [x] `sujets_arene` (bank with `ordre`, `actif_le`, `ferme_le`; the active subject is derived from the dates), `prises_publiques` (an analysed attempt made public by a deliberate gesture; `contexte` arena or duel, `statut` en_moderation, publiee, retiree; `date_suppression` set at closing), `impressions` (which takes a voter has been shown, for balanced sampling), `votes` (winner, loser, one pair once), `duels` (two people, a subject, 48 h, an invitation token that works without the app), `moderations` (the decision log)
   - [x] Functions: `sujet_arene_actif()`, `publier_prise()`, `paire_a_voter()` (only once the caller has spoken, never their own takes, balanced by impressions), `voter()` (credits `points_par_vote`), `classement_arene()`, `creer_duel()`, `rejoindre_duel(jeton)`, `cloturer_duel()`; RLS hides others' takes until the caller has spoken, and keeps names out of the vote
   - [x] pgTAP `tests/arene.sql`: 55 assertions green on the hosted project (rotation, publishing as a deliberate gesture, takes hidden until you have spoken and until moderation, pair voting with impressions and points, no vote on one's own take, a pair voted once, anonymous ranking with the opted-in first names, closing a week marks the audio for deletion and keeps the ranking, duels with their token, verdict from the grid, expiry without verdict, moderation); `@leq/domaine` schemas (`arene.ts`), `tentatives.duel_id`
2. Server
   - [x] Jobs `roter_sujet_arene` (hourly check, rotates once the week is over), `fermer_duels` (every 15 minutes: closes when both have spoken, expires at the deadline) and `supprimer_audio_public` (every 30 minutes: deletes the audio of closed weeks, finished duels and withdrawn takes, keeps the rows so the ranking is never lost); pg_cron schedules pushed and verified on the hosted project; 5 tests (22 server tests)
3. Mobile
   - [x] C1 to C4: the Arena tab with its two toggles, the subject of the week with its day counter, recording a passage, the take once sent (published or waiting for moderation), the open votes, the anonymous ranking; the duels in progress and finished
   - [x] C5 to C7: creating a duel with its invitation link (copied to the clipboard, works without the app), the duel verdict said to be rendered by the analysis, the duel take, and pair voting with playback of the two takes through signed URLs (migration 0012 lets a listener read only what chapter 11 allows)
   - [x] C8 the podium (`/arene/podium/[sujetId]`): the week that closed, its subject, the three steps drawn the way a podium stands (second, first, third, an empty step left empty rather than moving someone up), the person's own place counted against the whole week, the rest of the ranking, and the sentence that the recordings are gone while the ranking stays. Reached from the Arena tab and from the notification
   - [x] The end-of-week notification: `roter_sujet_arene` now says which week it closed, and queues `envoyer_resultat_arene`, which tells the people who spoke that week and keep the social switch on (chapter 12). Claimed before the first push leaves, so a retry never notifies a week twice. A tap opens that week's podium
4. Web (`apps/web`)
   - [x] `/duel/:jeton`: the subject, the ceiling and what is left of the 48 h, then recording in the browser (MediaRecorder, phone processing off as on the app), sending, and the verdict. The invitee never hears the inviter before recording, which is the rule of chapter 11 and is covered by a test. The seat is claimed (`rejoindre_duel`) before the person speaks, so a refusal is said before the effort. The conservation sentence sits next to the send button, where chapter 2 asks for it. The verdict is labelled as rendered by the analysis
   - [x] The invitee needs no account: anonymous sign-in, widened by migration `0013_duel_invite_anonyme`. The audio object is named `.m4a` because the storage policy asks for that shape; the bytes are the browser's own container (mp4 on Safari, webm on Chrome and Firefox) and the worker decodes by probing the content
   - [x] `/confidentialite` and `/conditions`, carrying the chapter 2 statement and saying out loud that a lawyer has not read it yet
   - [x] Hosting decided (ADR-010): the built pages are served by the `temps-reel` Fly process, the only one reachable from the internet. A duel link reads `https://leq-serveur.fly.dev/duel/<jeton>` until Phase 9 buys a domain; `EXPO_PUBLIC_LIEN_DUEL` is the single place to change
   - [x] Checked in a real browser end to end with the network stubbed (no test row ever reached the production database): invitation, recording, the too-short guard, ready, sending, waiting, verdict, privacy page. No console error, no horizontal scroll, Manrope loaded, the palette and the 56 px pill buttons of the mockup measured on the page
5. Admin
   - [x] Subjects bank (`/arene/sujets`: create, edit, order, ceiling, mark as validated) and moderation queue (`/arene/moderation`: publish or withdraw with a reason); the flags already existed
6. Verification
   - [x] Every database suite green against the hosted project, inside a rolled-back transaction: arene 68, socle 134, socle_phase1 22, parcours 59, serie_points 77, admin_phase6 34, demandes_export 7. Migration `0014_podium_arene` pushed (its first push failed on `create or replace` refusing a return-type change, rolled back clean, fixed with an explicit `drop function`)
   - [x] `npm run check` and `npm run format:check` green: server 33 tests, mobile 74, admin 35, web 30, domaine 32, moteur 33
   - [ ] Simulator walkthrough of the Arena with the flags on, on a week that has actually closed. The podium's wording and its awkward cases (one speaker, a tie, someone who did not speak, nobody at all) are covered by a component test; what is not yet seen on a device is a podium with real votes, which needs Rebecca's subject bank and a week gone by

## Phase 8 checklist (the face-à-face, shipped off)

Written before the work started. Cahier chapter 10, plan Phase 8. Everything ships behind the `face_a_face` flag. The live pieces (speech to text, Claude, a voice) need keys Roch has not provided yet, so the loop is built and tested against a stub, exactly as flow A was built before the transcription provider existed.

1. Contract and database (migrations `0015_face_a_face`, `0016_correctifs_face_a_face`)
   - [x] `theses` (the bank fed from Rebecca's space), `debats` (a session, and the quota ledger: one row per session with its own outcome), `tours_debat` (the written transcript, turn by turn, no audio ever)
   - [x] `quota_debats()`, `theses_proposees()`, `ouvrir_debat()`, `debat_a_reprendre()`, `abandonner_debat()`, `enregistrer_tour()`, `cloturer_debat()`, `transcription_debat()`; RLS gives a debate to its owner and to nobody else, the admin included
   - [x] pgTAP `tests/face_a_face.sql`: 53 assertions green on the hosted project (the flag gates everything, an account is required, the free plan has no session and says so as a quota, the bank and a thesis of one's own, the thesis copied into the session, opening again is refused rather than silently answering the old session, a stale session is abandoned and costs its slot, a session we cut costs nothing, a retried turn adds only its difference, nobody reads someone else's debate)
   - [x] `@leq/domaine` schemas (`debat.ts`) with `consommeUneSession`, tested. Configuration key `quota_face_a_face_gratuit` added so the free plan's zero is a setting, not a hidden constant
   - [x] Three defects found by the suite and fixed before anything ran: a retried turn counted its seconds twice against the cap, seconds were rounded on every turn, and opening a debate silently answered the session already open
2. Server
   - [x] The protocol (`debat/protocole.ts`): typed messages both ways, and a reader that refuses anything it does not know, because a socket is an open door. The answer is sent as text before the voice that says it, and the transcription is sent while the person is still speaking, so the app always has something to show. That is the whole point of chapter 10: the hard part is the waiting
   - [x] The session rules as a pure state machine (`debat/session.ts`): no socket, no database, no provider. The cap counts what the person said and never what Rétor said; the cap ends the session and still writes the last turn; a cut on our side ends it as `interrompue_par_nous`; a finished session ignores everything that arrives late
   - [x] The three providers behind their own interfaces with stubs (`debat/fournisseurs.ts`), named separately in the configuration because the bench may not pick one company for streaming transcription, for the model and for the voice
   - [x] The conductor (`debat/conduite.ts`): writes a turn before answering it, so a machine that dies between the two loses the connection and not the debate. A voice that fails is a degraded turn, not a dead debate. Anything breaking on our side ends the session as our own cut
   - [x] `/debat` on `temps-reel` runs one session per socket; the worker does not offer the route at all. Job `debriefer_debat` writes the note from the written transcript, idempotently
   - [x] 39 server tests for this alone (72 in the workspace). Checked against the real project over a real socket: upgrade, Supabase authentication, refusal and clean close in 889 ms, writing nothing
3. Mobile
   - [x] E0: the face-à-face row on Moi opens the flow, and only exists when the flag is on
   - [x] E2 (`/face-a-face`): the bank first, one's own thesis second and quietly, the tone, the sessions left this month, and the sentence that the text is kept and the voice is not. When the bank is empty (it is, until Rebecca fills it) the screen says so and opens the other door rather than showing an empty list
   - [x] E3 (`/face-a-face/[debatId]`): the thread of the debate, the transcription while the person speaks, Rétor's answer as text the moment it exists. Half duplex per ADR-007: while Rétor speaks the microphone keeps running and nothing leaves the phone
   - [x] E3b: the interrupted state, saying plainly that the cut was ours and the session is not counted, with the two ways out
   - [x] E4 (`.../debrief`): the note, polled until the worker writes it, and one line saying it was written from the text because the voice was never kept
   - [x] The audio path (`services/debatAudio.ts` and the pure `services/pcm.ts`): 16 kHz frames up as Int16, the voice down through a buffer queue so Rétor starts speaking before the answer is fully synthesised. 14 tests on the conversions alone, because an endianness mistake there is inaudible until the transcription is nonsense
4. Admin
   - [x] The thesis bank (`/theses`): create, edit, order, tone, provisional and active, with a badge on the theses the app would offer right now. Checked in a real browser with the network stubbed: the menu entry, the three theses, the badges, no console error
5. Verification
   - [x] The measured cost and the per-turn latency of one real session, measured against production on 2026-09-13 (section « Le coût d'un face-à-face, mesuré »): $0.019 to $0.022 a minute of speech over four runs, $0.09 to $0.11 for five minutes, and a median of 2.5 to 3.2 s from the end of speech to Rétor's text, above the two seconds of chapter 9

## Phase 9 checklist (release)

1. Store material
   - [x] `docs/STORE.md`: the French listing (subtitle, promotional text, description, keywords), the App Store privacy labels and the Play Data safety answers, each line naming the table or bucket it comes from so it can be checked against the contract, and the notes for the reviewer
   - [ ] Screenshots in both required sizes, taken once Rebecca's content replaces the provisional banks
2. Legal
   - [x] The honest draft of the chapter 2 statement, in `apps/web`, saying out loud that a lawyer has not read it yet
   - [ ] A lawyer reads it (**Roch**)
3. Release plumbing
   - [ ] Crash reporting (**Roch**: a Sentry account and a DSN)
   - [ ] Provider DPAs, one per processor, after the bench picks them (**Roch**)
   - [x] Backups verified and written down (`docs/RUNBOOK.md`): the schema is the migrations in
         git, Rebecca's content is saved by `sauvegarde-contenu.mjs` and the file is replayed
         before it is handed over, and people's data is the hosting provider's retention, which
         **Roch has to confirm in the dashboard**: on the free plan there is none
   - [ ] The sentence that defines "version one is done" (**Roch** and Rebecca, chapter 18)

## Build 8 in TestFlight (2026-09-12)

The first build carrying Phase 7 and Phase 8. To make it worth walking through, three things were
switched on in the hosted project, all of them values Rebecca owns and can put back from the
admin (`node supabase/tests/activer-essai.mjs --eteindre` does it in one go):

- the `arene`, `duels` and `face_a_face` flags;
- the first Arena subject activated, so the tab does not open on an empty room;
- `quota_face_a_face_gratuit` set to 1, so the free plan can try one debate. The real value is
  Rebecca's call and the face-à-face is meant to live in Complet.

The banks of Arena subjects and debate theses are seeded provisional (`provisoire = true`, badged
in the admin), the same way the path and the shop already were. Both screens were checked on the
simulator with the flags on: no runtime error.

## What is online, and where (2026-09-12)

| Surface           | Address                                                     | Who it is for                                         |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| The application   | TestFlight, build 8                                         | Roch, then the testers                                |
| Rebecca's space   | https://leq-serveur.fly.dev/admin                           | Rebecca and Roch, behind a sign-in and the admin role |
| The public pages  | https://leq-serveur.fly.dev/confidentialite and /conditions | Anyone, and the stores                                |
| A duel invitation | https://leq-serveur.fly.dev/duel/&lt;jeton&gt;              | Someone with no application at all                    |
| The server        | https://leq-serveur.fly.dev/sante                           | Not a surface: the worker and the debate socket       |

There is nothing else to look at. `apps/serveur` is the backend, `packages/` are libraries.

The public pages had been written, documented as hosted and never deployed: they answered 404 on
the live server until this deploy. Rebecca's space had never been deployed at all, which made it
invisible to the person it is built for.

## The space, made to be worked in (2026-09-12)

Roch's reading of it was right: a stack of form fields with no rhythm, and no way to put a
picture on anything. What changed.

**Images.** An atelier, an annonce and a récompense are invitations, and an invitation with no
image reads as a system message. Migration `0017_medias` adds a public bucket (the only public
one in LEQ: these images are what the application shows to everyone it invites, and they hold
nothing personal), an admin-only write policy, and an `image_chemin` column on the three tables.
The admin has a drop-or-pick field with a preview; the phone shows the picture on the workshop
card and on the reward tile, and shows nothing at all when there is none.

**The configuration page** had twenty-four save buttons, one per row. It now edits on the page
and saves in one gesture, with a bar that appears only when something is unsaved. The human
sentence is the label and the key is a small technical chip beside it, because the person reading
that page thinks in "how long may a duel last", not in `duree_duel_heures`. A search filters it.

**An announcement** is composed against a phone: a preview of the notification sits beside the
form, with the image. It is the one thing in the space that leaves the building and cannot be
taken back, and it was being written blind.

**The shared pieces** live in `composants/Etats.tsx`: search with a result count, filter chips,
an empty state that says what is missing and offers the way out, a skeleton that looks like the
rows that are coming. Buttons gained a danger weight, a small size and an icon size with a real
hit area, and lost the underline that made "Modifier" read as a link somebody forgot to style.

**Two suites were quietly depending on the project being empty**: seeding the banks and switching
the flags on made `socle`, `arene` and `face_a_face` fail. They set up their own state now, and
the flag assertion checks that a value does not move rather than what it happens to be.

Every page that edits a row now opens it in a dialog over a dimmed, blurred page, instead of
unfolding the form between two rows where it was easy to lose track of what was being changed:
exercices, récompenses, sujets, thèses, ateliers and les critères de la grille. Checked in a
browser on the deployed space, including that Escape closes each one.

## Review findings closed (2026-09-12)

Four adversarial review passes over the whole codebase produced about thirty-five findings. What
was closed in this last batch, and why each one mattered:

- **Un débat, une connexion.** Two sockets could hold the same debate (a phone reconnecting
  before the old socket was collected). Both wrote turn n+1 and the upsert on `(debat_id, numero)`
  let the loser replace the live turn, while its close wrote `interrompue` over a session someone
  was still speaking into. `debats.session_id` now names the holder, `prendre_session_debat()`
  claims it, and the connection left behind is refused (55006) and closes nothing. It is told
  `autre_appareil` and stops there.
- **Une coupure gratuite ne le reste pas indéfiniment.** Killing the app instead of pressing
  « Terminer » closed the session as our own cut, which costs nothing, and nothing ever reopened
  the question: a free face-à-face, every time. `fermer_debats_interrompus()` runs every ten
  minutes and counts a session nobody came back to, unless nothing was ever said in it.
- **Un job réussi n'est plus écrit en échec.** The work and the bookkeeping sat in one `try`, so a
  `terminer_job` that could not be written sent the loop into the catch and the job ran a second
  time. They are separated; a claim that cannot be closed simply expires and comes back once
  (`liberer_jobs_bloques`, already on pg_cron every five minutes).
- **Plus aucun fournisseur n'est attendu sans limite.** Rétor's answer, the final transcript of a
  turn and each chunk of voice now have a deadline. A provider that hangs ends the session as our
  own cut, which costs nothing, instead of leaving a person watching a silent screen while the
  session holds its slot.
- **Un job définitivement échoué peut être remis en file.** `creerJob` re-queues on the
  idempotency key when, and only when, the existing job is `echoue`.
- **Le tableau de bord n'a plus à lire toute la table.** `tentatives (cree_le)`, a partial index
  for the validated steps, and `profils (cree_le)`.

Then the phone:

- **La session audio passe par une seule porte.** Recording a take and holding a face-à-face both
  claim the phone's audio session, and leaving one screen for another put the teardown of the
  first after the startup of the second: the new recording began on a session that was no longer
  active and gave back a file of silence, which looks exactly like someone who did not speak.
  `services/sessionAudio.ts` serialises every transition and ignores a release once someone else
  has claimed it.
- **C6 ne propose plus d'enregistrer une prise qui existe déjà.** The duel screen read its takes
  with a query whose error was dropped, so a network failure looked like "you have not spoken
  yet". It is a real query now, with its own error state and a retry. Its two buttons said
  « Continuer » and « Voir » for listening to a recording; they say what they do.
- **Une image remplacée s'affiche.** `ImageMedia` kept a boolean failure flag that never reset
  when the path changed, so a recycled row or an image Rebecca replaced stayed blank for ever.

And one the review had not found, caught while re-running the checks: **the Arena suite was
passing over takes that would have been silent.** `publier_prise` reads `chemin_audio_public`,
the copy the worker keeps for the length of the contest, but the fixture still filled
`chemin_audio`, which is null by then. The fixture matches what the worker leaves now, and an
assertion says a published take can actually be heard. `verif-audio-public.mjs` was a diagnostic
written to demonstrate that bug before it was fixed; it printed the same alarm afterwards and is
gone, the suite covers it.

`publier_prise` now refuses a take with no audio to play, instead of writing a silent card.

**Le face-à-face dit qu'il tourne sur des bouchons.** Without the provider keys the server
transcribes by counting chunks and Rétor answers a placeholder, which on screen reads exactly like
a broken transcription. The `pret` message carries `provisoire`, E3 shows a line saying Rétor is
not connected yet, and the debriefing records how it was produced so E4 says the same instead of
showing an empty note as if it were the real one. The stub no longer invents moments: they were
its own transcript quoted back.

Verified: 91 server tests, 88 mobile tests, 482 database assertions across the eight suites,
`npm run check` and `npm run strings` green. Server deployed, migrations applied,
`verif-securite`, `verif-medias` and `verif-anon` green against the hosted project.

## Le chemin complet d'une prise, vérifié contre la production (2026-09-12)

`supabase/tests/verif-bout-en-bout.mjs` speaks a French sentence with the Mac's own voice, sends
it the way the phone does, and waits. Against the hosted project and the worker on Fly: the
private upload accepted, the job queued by the trigger, transcription, measurement in Praat,
evaluation, the audio object deleted and its column nulled. Eleven checks, about twenty seconds,
green on the deploy of 2026-09-12. The measured rate on that sentence is 113 words per minute,
which is what it sounds like.

The transcription provider still reads `stub` and the evaluation still says « grille aucune »:
those are the two inputs that are not ours to invent, and the check reports them rather than
hiding them.

## L'application tourne sur ce Mac, et un bouton était caché (2026-09-12)

EAS is for store binaries and nothing else. Xcode 26.6 with the iOS 26.5 SDK is installed and both
are released versions, so building and running the app locally needs nothing from anyone: the note
in the plan about a beta host OS forcing cloud builds was wrong, because what Apple rejects is a
beta **SDK**, not a beta macOS. `npx expo run:ios` builds and installs in under a minute, and
`simctl` plus `cliclick` drive it from a script. `docs/RUNBOOK.md` carries the exact commands and
the coordinate mapping.

The first walk through it found one: **on the empty Progrès screen, the floating tab bar sat
entirely on top of « Faire ma première prise »**, the one button on the page. Unreadable, barely
tappable. The bar floats over every tab and nothing said how much room it needs; the other tabs
happened to reserve 120 points by hand and the empty state reserved only the safe-area inset.
`HAUTEUR_BARRE_ONGLETS` and `useEspaceBarreOnglets()` now say it once, and all five tabs use it
instead of a number somebody has to remember.

## Ce qui est dans TestFlight, et la limite des builds (2026-09-12)

**Build 15 est le dernier build iOS de ce mois-ci.** The Expo account is on the free plan, whose
iOS builds are used up; it resets on 1 October 2026, and `eas billing:subscribe starter` lifts it
sooner. Build 15 carries everything of 12 September except the last commit, and that is safe:
nothing on the phone parses `tentatives.resultat` through a schema, so a take written
`non_evaluee` falls into the branch that already says « La grille de Rebecca dira si le défi est
validé ». The duel verdict `sans_verdict` **is** parsed, and build 15 is built from the commit
that added it.

Server v16 and both web surfaces are deployed and current.

## La boucle quotidienne ne tournait pas (2026-09-12)

`verif-parcours.mjs` walks the product itself: the challenge of the day, the take, the verdict on
it, the step validated, the next one opened, the points credited, the day counted. It had never
been run against the hosted project, and the first run showed why that mattered. Four step takes
had been recorded on this project, four analyses delivered, and **not one step validated or
failed**: 4 available, 48 locked, zero done.

`appliquer_resultat` returned `null` when the evaluation carried no total, and wrote nothing. No
grid is published, so that is every take. The feedback screen was honest about it (« La grille de
Rebecca dira si le défi est validé »), but the path itself simply stopped at the first challenge,
for ever.

A take nothing could score is written `non_evaluee` now, and counts as no failure. What it does to
the step is Rebecca's call, so it is the setting `validation_sans_grille`, off by default and
turned on by `activer-essai.mjs` with the other walkthrough values. With it on, against production:
challenge served, take analysed, step validated, next step opened, 25 points credited, day
counted. Twelve checks.

## Le duel par le navigateur, et le trou qu'il a révélé (2026-09-12)

`verif-duel-web.mjs` walks the only path where someone with no account writes audio into the
project: the invitation link, an anonymous session, the slot claimed before anything is recorded,
both takes uploaded and analysed, both published, the verdict, and the two voices dated for
deletion. Twenty-two checks.

It found a real one. `cloturer_duel` decided whether someone had answered by reading their grid
total. No grid is published yet, so both totals are null, both were read as silence, and at the
deadline the duel expired over two takes that were sitting right there: each person had spent a
take and was told nobody had come. Even with a grid, one evaluation that never landed would have
done the same to the other person. Presence is a question about the take now, and when both are
there and nothing can separate them the duel closes on `sans_verdict`, which the app and the
invitation page both say in words. The duels flag is on in TestFlight, so this was live.

## Les deux promesses vérifiées contre la production (2026-09-12)

**« On compare deux voix »**: `verif-arene-audible.mjs` records a take, publishes it, signs a
playback URL, downloads it and compares the bytes. Fourteen checks green, the file identical to
what was sent. It also proved something the first run got wrong: a signed-in person cannot empty
the public bucket, and rightly so, so the copy is given back the way a closed week gives it back,
marked for deletion and swept by the worker. The first run leaked one object doing it the other
way; it was reclaimed through the same sweeper.

**« Cette action est définitive »**: `verif-suppression-compte.mjs` creates a throwaway account,
records a take, publishes it in the Arena, presses G3's button and looks everywhere afterwards.
Eighteen checks green, the account gone in three seconds, nothing left in either bucket. That
sentence in G3 is a legal one as much as a product one, and until today nobody had ever watched it
happen on the real project.

## Un face-à-face entier, contre le serveur déployé (2026-09-12)

`supabase/tests/verif-face-a-face.mjs` opens a session, connects to the socket on Fly, speaks two
turns, ends it, and reads back what the database kept. Fifteen checks green: the protocol
announced, the thesis, the four turns in order, the outcome `terminee`, the connection released,
the month moved from 0 to 1, the debriefing queued and written and marked provisional. It costs
one session and gives it back by deleting the row.

Phase 8 had never been exercised anywhere but in memory: the conductor is tested against an
array, and an array is not a socket on a machine in Paris.

## The copy of someone's data actually exists now (2026-09-12)

G3 has said « Tu recevras une copie de tes données par e-mail » since Phase 1, the request has
landed in `demandes_export` since then, and the admin space has listed it since Phase 6. Nothing
produced the copy. `supabase/tests/exporter-donnees.mjs` does, in sixteen sections, and
`docs/RUNBOOK.md` says how to run it. Checked against a real account: three takes with their
measures and transcripts, thirteen path steps, a duel with its two passages, 35 KB of JSON.

It leaves out what is not the person's to receive: no audio, because there is none; the other
person's identifier and the invitation token of a duel; and which voice they preferred in the
Arena. The file says so at the top, in French.

## Réunion Rebecca du 12 septembre 2026

Read from the transcript, which is the source of truth, with Roch's summary alongside it. The
transcript and the two working notes stay out of git (`.gitignore`): they carry private speech.
What was decided is here, and in the code.

### La note change de forme (chapitre 5 réécrit)

A performance is scored out of 30, over six axes of five. **Four axes are measured** from the
audio: débit, mots béquilles, silences et respiration, énergie de la voix. **Two are judged** by
the model against Rebecca's reference, anchored by a worked example at 5 and at 2 for each:
structure du propos, conviction. Roughly 65 % measure and 35 % judgement, **both weights
configurable from the admin**, because the first real scores will move them.

Two consequences that are not optional:

- **The model listens to the whole performance, not only what the grid covers.** Someone who says
  « euh » two hundred times is told so even if no criterion mentions filler words. What falls
  outside the grid reaches the person's feedback without entering the score, and is flagged to
  Rebecca as a gap in her criteria. No one can enumerate in advance everything people do at a
  microphone, so the grid has to grow from what the app actually hears.
- **Provisional threshold: 18 out of 30.** Below it the step is retried; after two failures the
  targeted exercise. Rebecca's to move.

The grid draft is with her. Until it comes back, everything up to the measurement engine is built
and every threshold stays a setting.

### Ce que Rebecca a demandé, écran par écran

Application:

1. A short onboarding, three screens after the welcome, showing how the app works.
2. The analysis screen needs real motion. Three static bullets do not read as something happening.
3. Bulle glitches.
4. The face-à-face is buried under « mon profil d'orateur ». It belongs with l'Arène, where people
   look for it.
5. « Créer ton compte pour débattre » is red text at the bottom of a screen. It is a modal.
6. Padding and centring are off on the Arène tabs and on « avec Rebecca ce mois-ci ».
7. The duel invitation captures no identity: someone opens the link, records, and nobody knows who
   they are. Ask the invitee for a name and an e-mail before they record.

Espace d'administration:

8. **A challenge cannot be added inside an acte.** The button does not exist. This is what stops
   her filling the app today.
9. Technical keys are typed by hand. Generate them.
10. Duplicate a challenge, assign one challenge to several actes, schedule a recurring weekly
    challenge with varying content.
11. Arena subjects need scheduled dates, finished subjects sort to the bottom, the list needs
    filters.
12. A view per Arena subject: who spoke, who voted, who won.
13. A revenue and subscription dashboard: who paid, when, monthly totals.
14. The left menu goes white when scrolled.

Produit:

15. **L'Arène: six is a listening limit, not a speaking one.** Rebecca's own value in the
    transcript is « pas de hiérarchie, liberté pour tous », and she worried about sitting through
    twelve takes on one subject. So anyone may speak on the active subject, and a voter is never
    shown more than six takes in a session. Ranking stays by vote count.
16. **Long challenges.** She cares about them and described arcade territory: guardians at doors,
    word-collecting runners. Not v1. V1 is a long-form arc inside the path: a goal stated up front,
    roughly two weeks, six or seven recorded steps building to it, a final take scored against the
    whole arc. Same engine, same grid. The arcade is a separate project after launch.
17. **Tiers.** Two at launch, contents fully configurable from the admin so a third is a setting
    and not a release. Community access, if it happens, is a flag on a tier. Prices live in App
    Store Connect and Play Console and block nothing.

Design (flat, too beige, wants illustration and play) goes to Claude Design, not here, unless a
structural change is needed to support it.

## Ce que la réunion a produit, au fur et à mesure (2026-09-12)

Closed so far, from the seventeen items:

1. **La note se fabrique de deux mains.** Six axes out of thirty, four computed from what the
   machine hears and two judged by the model against Rebecca's reference. The balance is a
   setting, `publier_grille()` refuses a grid whose judged axes carry no worked examples, and what
   the model notices outside the grid reaches the person without entering the score.
2. **Un défi s'ajoute dans un acte**, and a technical key is written from the title.
3. **Le menu ne blanchit plus** quand on fait défiler l'espace d'administration.
4. **Le face-à-face vit dans l'Arène**, en troisième onglet, et un refus prend l'écran.
5. **Répondre à un duel demande qui on est** : un prénom et une adresse, avant que la place soit
   prise.
6. **L'analyse tourne** : trois points immobiles ne se lisaient pas comme quelque chose qui se
   passe.
7. **Les semaines de l'Arène se programment** : une date fait passer un sujet devant le jour venu,
   une semaine fermée descend en bas de la liste, et un filtre par état la trie. `resume_sujet_arene()`
   dit qui a parlé, combien de voix et combien de votants.
8. **Un défi se duplique** dans l'acte de son choix, avec une clé à lui. Une copie et pas une ligne
   partagée : le quiz du vendredi change de contenu chaque semaine, donc chaque copie s'édite seule.
9. **Les formules se règlent dans l'espace** (2026-09-13): a page lists the tiers as rows and edits
   what each one gives (steps a day, debates a month, speaking time, community, store product,
   active). Creating one writes its key from its name; the free tier cannot be switched off,
   since everybody starts on it. The three onboarding screens and the six-listen Arena shipped
   on 2026-09-12 and 13.
10. **Les abonnements ont leur page** (2026-09-13): who is on a paid tier today, the last twelve
    months of new subscribers, payments, refunds and amounts by currency, net when the store
    says it, and the last fifty payments one by one. The money lives in a ledger of its own,
    `paiements`, written by the RevenueCat webhook once the account exists; until then the page
    shows the subscriptions and an empty ledger, and says so.
11. **L'arc long, en v1** (2026-09-13, item 16): an act carries a goal (`modeles_actes.objectif`,
    written in the admin next to the title). Set, the person reads it before the first step, the
    folded act shows it, and the closing screen reads the way from the first validated take to
    the last: rate, fillers, score. Same engine, same grid; the steps and the final take are
    Rebecca's content, like any act. The arcade (guardians, runners) stays a separate project.
12. **Le défi qui revient** (item 10) is closed by duplication: the path has no calendar, one
    step follows another, so a Friday quiz is a copy placed every seventh step, each copy with
    its own content. A calendar-bound challenge would be a new concept, and nobody asked for it
    once the copy existed.

13. **The two design items were already closed on 2026-09-12** and the list above had not caught
    up: Bulle's jump came from one effect restarting the float and the blink whenever the mouth
    changed, split into two since (`109ad26`); « Avec Rebecca, ce mois-ci » beside « Tout voir »
    wraps on a small phone, and the row now aligns at the top instead of dragging the action
    down. Both went out in build 15.

Nothing from the seventeen items is open in the code. What remains is Rebecca's eyes on a phone
with build 16 and later, and her content.

## Les vrais fournisseurs sont branchés (2026-09-13)

One OpenAI key, Roch's, covers the four things a debate and a take need. Chosen over the plan's
Anthropic pick because he already held it and because one key gives transcription, the opponent,
the judge and the voice in one place, one DPA, one bill. The bench of chapter 13 can still
compare later; `TRANSCRIPTEUR=stub` puts any of the four back on its stub.

- **Whisper** (`whisper-1`) for a recorded take, the only model of theirs that gives every word a
  start and an end, which the measures need. Live on the worker: a take measured at 204 words per
  minute from real timings, `analyses.fournisseur_transcription = openai:whisper-1`.
- **The realtime session** (`gpt-4o-mini-transcribe`, server VAD) while the person speaks in the
  face-à-face. The GA endpoint refuses anything under 24 kHz and the phone sends 16, so every
  chunk is brought up two-to-three on the way in. Against production: it heard both sentences,
  and Rétor answered 2,3 s after the end of speech on the second turn.
- **Rétor and the debrief** on `gpt-4.1-mini`, with docs/STRINGS.md in the system prompt. The
  model still writes the contrastive pair about one turn in three, so the guard is in code: a
  curly apostrophe is straightened, a « ce n'est pas X, c'est Y » is sent back once to be
  rewritten.
- **The judge** for the two judged axes, against Rebecca's two worked examples, and the remarks
  outside the grid. On its first real call it flagged a « euh » as `mots_bequilles`, which is
  exactly what Rebecca asked the model to do.
- **The voice** (`gpt-4o-mini-tts`, 24 kHz PCM, streamed): first chunk in about a second.

`apps/serveur/scripts/verif-openai.mjs` calls all four against the real API with a spoken French
sentence; `verif-face-a-face.mjs` now speaks two real sentences into the production socket instead
of silence. Both green.

## Sign-in, PostHog and the publish gesture (2026-09-13)

Roch asked for a phone that signs in and a PostHog that counts. Both are in the code; neither has
been tried on a phone yet.

- **Three doors on A7.** The e-mail code was already there; its e-mails now leave through Gmail
  (`join.leq@gmail.com`, an app password in `SMTP_PASS`) instead of Supabase's rate-limited
  sender. Sign in with Apple and Google sign-in are native sheets
  (`apps/mobile/src/services/identite.ts`): a hashed nonce for Apple, the web client id as the
  token audience for Google, then `signInWithIdToken`. The first name the provider gives fills
  the profile; when it gives none, the screen asks. `supabase/config.toml` now declares the SMTP
  server and both providers (Apple with the bundle id, Google with `skip_nonce_check`, which the
  Google SDK's tokens need), and `config push` reports no difference with the hosted project.
  `app.json` carries `usesAppleSignIn` and the Google plugin with the iOS URL scheme; prebuild
  writes the entitlement and the scheme. The Google consent screen is still in Testing on Google's
  side, so only listed testers can pass it.
- **PostHog** (`apps/mobile/src/services/usage.ts`): a closed list of eleven events (the first
  screen passed, a sign-in and its method, a brief opened, a take recorded with its type and
  length, a feedback opened, a step validated, an Arena take published, a vote, a duel created, a
  debate opened and finished, a reward exchanged), the person identified by their Supabase id from
  the root layout, forgotten on sign-out. Nothing about the voice leaves the phone. Without the
  key every call is a no-op, so tests and fresh checkouts stay silent.
- **The gap found on the way.** No screen on the phone called `publier_prise`. An Arena or duel
  take was recorded and analysed, then stayed private forever: the Arena tab kept asking the person
  to speak, and a duel started on the phone could never close. The web invitation had the call,
  the phone did not. The feedback screen now ends an Arena take with « Publier dans l'Arène » and
  « Garder pour moi », and a duel take with « Envoyer ma réponse »; the refusals of `publier_prise`
  are shown in the words the Arena already had. `Retour` carries `duel_id` so the duel take goes
  back to its duel.
- **Verified:** `npm run check` (every workspace, 46 mobile tests, strings), prettier, a prebuild
  of the iOS project with the entitlement and the scheme in place. **Not verified:** an Apple or
  Google sign-in on a device, an e-mail arriving through Gmail, an event arriving in PostHog, the
  publish gesture against production. All four need a phone build, and the phone build needs the
  account below.
- **Build 17 is in TestFlight** (2026-09-15). Its command-line upload was refused twice: the
  Apple account signed into the Xcode 27 beta is visible to the beta's window and to nothing
  else, not even the beta's own `xcodebuild`, and the distribution certificate Apple created for
  build 16 is cloud-managed, behind that account. The archive built by the 26.6 tools was opened
  in the beta's Organizer and uploaded from there, driven by script (docs/RUNBOOK.md). An App
  Store Connect API key would make every next upload one command with no window; it is asked of
  Roch in docs/OPEN-INPUTS.md. Build 17 carries the act objective on the map and the two act
  screens; everything else on the phone is in build 16 already.
- **Build 16 is in TestFlight**, archived and uploaded from this Mac on 2026-09-13 with the
  released Xcode's build tools and Roch's Apple account, signed in through the Xcode 27 beta's
  window because macOS 27 beta refuses to open the released Xcode's own (docs/RUNBOOK.md, "Build
  the mobile app"). It carries the three doors, PostHog, the publish gesture and the Google
  client ids. The Google consent screen went to production the same evening, so Google sign-in
  is open to anyone, and the two legal URLs it required point at the public pages on Fly.

## Le coût d'un face-à-face, mesuré (2026-09-13)

One of the four inputs the plan refused to invent. The server now counts what every provider
call consumed and keeps the total on the session's row (`debats.consommation`, migration
`20260913100000`), and `apps/serveur/scripts/mesurer-debat.mjs` runs a whole session against
production with the Mac's French voice, nine turns of about a hundred words, and reads the row.

**The session of 2026-09-13.** Nine turns, 232 s of audio sent, Rétor answering nine times with
35 to 44 words, 151 s of voice back, the debrief written. What it consumed, in the providers'
units: 2 316 audio tokens transcribed; 11 996 prompt tokens through Rétor, 4 992 of them served
from cache, 523 tokens out; 2 212 characters spoken; 1 935 tokens in and 167 out for the debrief.
At the rates read on OpenAI's pricing page that day (gpt-4.1-mini $0.40 in, $0.10 cached, $1.60
out per million; gpt-4o-mini-transcribe $1.25 per million audio tokens; gpt-4o-mini-tts $0.60 per
million text tokens and $12 per million audio tokens):

| Part                 | Cost             | Note                                                                                                                                                            |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transcription        | $0.008           | from the tokens the provider billed                                                                                                                             |
| Rétor, nine answers  | $0.004           | the cache pays: the whole transcript goes in every turn                                                                                                         |
| Rétor's voice, 151 s | $0.038 to $0.073 | the speech endpoint returns no usage and the page gives no seconds-to-tokens ratio: two bounds from OpenAI's own figures, the higher one is the one to price on |
| Debrief              | $0.001           |                                                                                                                                                                 |
| **Total**            | **$0.086**       | **$0.022 a minute of speech, $0.11 for a five-minute session, with the voice at its high bound**                                                                |

The voice is three quarters of the bill. Rétor's answers average sixteen seconds of speech for
twenty-six seconds of the person's, which is the ratio the prompt's forty-word limit produces.

**What each turn waited for**, from the end of the person's speech: the final transcript at a
median 1.6 s (max 5.0 s, one turn), Rétor's text at 3.2 s (max 5.9 s), his first sound at 3.7 s,
his last at 6.5 s. Chapter 9 asks for under two seconds to the answer. The transcript alone eats
1.6 s of it (700 ms of silence detection before the provider even starts), and the voice waits
for the whole answer before it starts. The two moves that would bring it under two seconds are
streaming Rétor's text and speaking the first sentence while the second is written, and shorter
silence detection; neither is done, and the number is recorded as it stands.

**The bug the measurement found.** The row said 6.9 s of speech for 232 s sent. The speaking time
started a clock on the server at the first transcript of a turn, and this provider transcribes
once the person has stopped, so every turn counted about a second and the cap of a session never
came: a free account's three minutes were unlimited. The second run, on v23, counted the first
turn and nothing after it: the provider's voice detection announces a start once and, after a
turn committed by the button, stays in "speaking" and announces neither a stop nor a new start
(a probe on the raw events showed one `speech_started` at 0 ms over two committed turns). The
time now comes from those boundaries when the detection gives them, and from the audio received
otherwise; a conductor test pins the count. The fourth run, on v24, ended on its own at 181.7 s
of speech against a cap of 180, counted to the tenth of a second, and cost $0.056 for those
three minutes.

## La passe de design, écran par écran (started 2026-09-15)

Roch put the account screen next to the Claude Design mockup and the screen lost; he wants every
screen at the mockup's level or above, and he will not list the gaps himself. The mockup bundle
is split into fifty standalone pages and rendered to images with headless Chrome
(`scratchpad/maquette`, rebuilt from `Brainstorming/App LEQ (1).html` on demand), and each app
screen is put next to its image on the simulator.

Done so far:

- **Every button** is a rounded rectangle of radius 18 with the orange glow on the action, as the
  mockup draws all thirty-two of its tall buttons; it never draws a pill. A `nuit` variant and a
  mark slot carry the sign-in buttons.
- **A7, the account screen**: the profile in a bleu nuit card, a centered title, Apple in bleu nuit
  with its mark, Google in white with the G, e-mail as a text link.
- **G1, Moi**: the identity card at the top is the door to the account (a person who has none is
  sent to create it); under it the last analysed take's measures stand in for the speaker
  archetype Rebecca has not named yet; three white tiles with the numbers in colour; the doors
  with an icon each; Rebecca's workshops in the blue card. The dashed « En construction » card is
  gone from this screen.
- **Mon compte** (`/moi/compte`, new): the first name, editable in place; how the person signed
  in (Apple's relay address is shown as masked, not as a code); the tier and what it gives, read
  from `formules`; then, last, leaving and deleting, through one service shared with Réglages.
  A person without an account is redirected to A7.

- **B1, Aujourd'hui**: the step of the day on a gradient card with the mockup's glow, its pills,
  the act's dots and position on one line, « Je me lance » as a white bar with its arrow, the
  tier's rhythm on a bleu nuit strip with « Enchaîner »; the greeting on one line with the streak
  as a small pill; what to work on next (from the last feedback) beside the points; the week's
  subject as a white card; Rebecca's month with her mark and the next workshop. No dashed
  placeholder left: a card with nothing to show is not shown.
- **H1, the map**: one act under the mist instead of a wall of locked banners; the land painted
  with the mockup's gradient; wider node labels.
- **G3, Réglages**: small section labels, one white card per section, rows of fifteen points,
  blue switches, the privacy rule as the first row, deletion as the last red row.
- **C1, l'Arène**: the toggle as a white pill with the chosen tab in bleu nuit; the subject on a
  gradient hero with the gesture inside it, gold on bleu nuit.
- **D1, Progrès**: the profile in motion on a gradient card (the last take's pace and its zone);
  the week with flames; the month's three numbers on one card; **the voices of the grid, drawn
  from the person's own evaluations**, each axis averaged this month against last month with its
  movement, in place of the dashed placeholder that waited for the grid; the month's heading
  placeholder is gone. X1's two previews are white cards.
- **B3, the brief**: the format and the points as two tinted pills, the 34 point title, the act's
  dots and the position on one blue line, Rebecca's words on a white card beside her mark, the
  focus of the feedback on a blue card with its ring icon, the supports of the plan as numbered
  white tiles in a row (the long format keeps its three steps as rows), the action with its glow.
- **B4, the recording**: two drawings, as the mockup has two. The diagnostic (A4) keeps its
  consigne as the title, the listening line under it and the timer in its ring. Every other take
  (a step, the Arena, a duel) shows its title small at the top, the timer alone at 56 points, the
  gold waveform across the whole width over a faint baseline, Bulle at 26 points on the listening
  line, and the stop circle between « Refaire » and « Terminer » in the mockup's grey.
- **The launch** (`components/Lancement.tsx`, Roch's idea on 2026-09-16): the mark writes itself.
  L, E and Q rise into place one after the other, then the period arrives from above as a dot and
  strikes the end of the word; the letters take the hit and settle; the app fades in underneath.
  The letters are the brand's own glyphs, cut out of the white mark image; the dot is drawn so it
  can fall. About 2.4 s: a beat of plain blue, the letters, the dot's fall and its strike, then the finished mark rests, still, before it fades. Once per cold start, static with Reduce Motion on. Build 21 was too fast and Roch caught it on the device: the gesture started on mount, so its clock ran behind the native launch screen and he met it already half over, and the app being ready cut it off before the mark had settled. It now starts on the overlay's first visible frame and owns its own clock; readiness only decides whether it may leave after the rest, and a slow load simply holds the finished mark, which is a better waiting state than anything else we could draw. Measured on the simulator: 0.17 s of blue, 0.35 s for the letters, 0.45 s for the dot and the settle, 0.86 s at rest, 0.32 s of fade. The native launch screen is now plain bleu nuit (build 21 onwards) so the
  handoff to the overlay is invisible; a development build still shows the old native image first.
- **B5, the feedback**: Bulle at the top with her label and a speech card that carries the outcome
  and, new, **what the model noticed outside the grid** (`evaluations.hors_grille`, written by the
  judge since 2026-09-13 and never read by the app until now); the three tiles in white with blue
  numbers and small uppercase labels; the axes to work on in a bleu nuit card, the first one as its
  title; what worked on a green strip; the grid's lines with a gold check or a grey dash and the
  score in orange when the line is reached; the medal of H2 in its halo. The secondary action of a
  published take is a white button.

Gradients are drawn by `Degrade`, which measures its card: a percentage width on the SVG root
painted three quarters of the first frame. Labels are uppercased by style, never in code, so a
screen reader and a test read the string.

Verified on the simulator screen by screen; the account screen was previewed with the redirect
disabled locally, since the simulator's user is anonymous, and the populated Progrès needs a
phone with takes. Shipped as build 19 on 2026-09-16 at Roch's request.

The simulator itself was invisible for two days: Xcode 27 has no `Simulator.app`, the device
window is Device Hub (`docs/RUNBOOK.md`, « Looking at a screen »), and the old window died with the
Xcode swap while the device kept running headless. My `simctl` screenshots showed the app the whole
time; Roch saw nothing.

## L'Arène publie sur envoi (2026-09-17)

Roch recorded a passage, went to the Arena, and read « en attente de publication ». He asked who
decided that every take waits for an admin. I did, in the plan (decision 12), and the cahier never
did: chapter 11 asks that Rebecca can withdraw a public take or suspend an account, and nothing
more. Nobody had ever approved anything in that queue, and the admin page could not even play the
take. Replaced in one change across the five workspaces:

- **Live on send.** `publier_prise()` publishes at once. `en_moderation` is gone; the one row it
  held (Roch's) is published by the migration, since nothing ever flagged it.
- **The screening.** The worker sends the transcript of an Arena or duel take to OpenAI's
  moderation endpoint (free) at analysis time and writes the verdict in `analyses.moderation`:
  the six categories of chapter 11, politics and religion pass. A flagged take gets the status
  `signalee` and waits for Rebecca; a failed call writes no verdict and the take publishes, because
  an outage of the filter must not close the Arena.
- **Everyone is told.** A new job `notifier_moderation` pushes the person when their passage is
  held, published or withdrawn, in the same words the Arena tab shows, and every admin with the
  app when a take is held. The admin home counts the held takes.
- **Rebecca can review.** The moderation page gets a player (an admin may now read the audio of a
  public take), the transcript and the reasons the filter gave, through `lire_prise_a_relire()`,
  admin only and scoped to public takes: nothing else of anyone's analyses opens up. Publish or
  withdraw as before.
- **A person can listen to their own passage** from the Arena tab.

Verified: pgTAP `arene.sql` 104 green against the hosted project (the flag, its visibility, the
review function refused to a person, both decisions queuing their notification); server 96 tests
plus the screener's category mapping and the notification job; admin and mobile suites green.
Strings by the other session, verbatim. `docs/decisions/ADR-012-arene-publiee-sur-envoi.md`. Deployed: Fly release 27 (10:49 UTC), migration on the hosted project, the served admin bundle checked for the new page. **Build 23 is uploaded** (Organizer, 03:54 local, the usual dSYM warnings) with the app side: the Arena card's three states and listening to one's own passage. Two lines rewritten by the other session after the archive (the conservation promise before recording, the moderation intro) ride in build 24. Next build number: 24.

## La photo, le classement et la voix rendue juste (2026-09-17)

Roch's second batch on the Arena, from listening to his own passage: it sounded like a cartoon.
The player decoded a take on its own, so a 16 kHz recording kept its rate and the phone's 48 kHz
context played it three times too fast and too high; every playback in the app (votes, duels,
one's own passage) went through that line. The context now decodes, at its own rate. Then what
he asked for around it:

- **The ranking line**: a crown in gold, silver and bronze on the first three with the number
  beside it, the person's picture, the person's own name followed by « (toi) » on their own line
  (a person reads their own first name whatever their opt-in), and on that line a play or stop
  control on their own passage. The hero keeps « Écouter mon passage » only for a person the
  ranking does not list (held, withdrawn). `arene.moi` is gone; the podium says the same.
- **A profile picture** (Mon compte): chosen in the library and cropped square by the picker,
  brought to 512 points and compressed on the phone, stored in the public bucket `avatars`
  under the person's folder, a new object per change, the previous one deleted. Shown on Moi,
  Mon compte, the ranking and the podium, under exactly the condition that shows the first name:
  the Réglages switch now reads « Publier sous mon prénom et ma photo », and its promise of
  anonymity holds for the face. Deleting an account empties the folder (the worker's bucket
  list). Two native modules join (`expo-image-picker`, `expo-image-manipulator`), so this needs
  build 24 and a rebuilt development client.

Verified: pgTAP `arene.sql` 110 green (the picture where the name is, none on a pseudonym, the
own line); domaine 50, serveur 112, admin 54, mobile 88; strings and format green. The pitch fix
is verified by the library's contract (decoding by the context resamples to its rate) and by
Roch on build 24; the simulator's anonymous user cannot publish to the Arena, so it cannot play
a public take there. Strings by the other session. Deployed: Fly release 29 (09:30 UTC, the worker empties `avatars` on account deletion); migration 20260917100000 on the hosted project. **Build 24 is uploaded** (Organizer, 04:34 local, "Uploaded to Apple") with the fixed player, the ranking line and the picture; the simulator's development client was rebuilt for the two native modules. Next build number: 25.

## Sans compte : la porte le dit, et la page se rafraîchit (2026-09-17)

Roch, signed out, tapped « Commencer le débat » and reached the next screen: the account was
enforced by the database alone, at the last tap, three screens past the door. Decided and built:

- **What an account-less person can do**: the diagnostic, then the first daily challenge, and
  answering a duel someone sent by link. Everything social, paid or identifying needs an
  account: recording or voting in the Arena, launching a duel, exchanging points, the
  face-à-face, the copy of one's data, and the path from the second challenge on. The best
  apps let a person try before signing up, then gate at the first thing worth keeping.
- **The door says it.** Each of those doors shows a small « Avec un compte » badge to a person
  without an account, and opens A7 with one line saying why (`compte.raisons.*`, in the shape
  the app already used: « Crée ton compte pour… »); A7 returns to the door once the account
  exists. The database refusals stay as fallbacks and say the same sentence. The Arena's
  retention note gives way to the badge for a person who has nothing to keep yet.
- **The path gate**: the brief of any challenge sends a person without an account to A7 once
  one challenge is validated, and the day card's « Je me lance » carries the badge.
- **Pull to refresh** on the eleven screens whose content changes behind the person
  (Aujourd'hui, l'Arène, the map, Progrès, Moi, the shop, both Rebecca screens, the
  face-à-face, a duel, the podium): pulling down refetches every query mounted on the screen.
- **The purge** of anonymous accounts ran 72 h after creation, written when such a person could
  only do the diagnostic; it now runs after 30 days without a take or a sign-in (configuration
  `purge_anonymes_heures` 720, the worker counts from the last take), so playing without an
  account never silently erases progress.

Verified: mobile 88 tests (the two component suites now mock the refresh and the anonymity
hooks), typecheck, lint, strings and format; server 112. Strings by the other session, whose second pass caught A7's title stacking an order on the raison's order and turned the seven raisons into statements; the archive was restarted for it. Deployed: Fly release 30 (the worker's purge counts from the last take), configuration on the hosted project. **Build 25 is uploaded** (Organizer, 05:30 local, "Uploaded to Apple") with the doors, the refresh and the corrected wording; the Arena door and A7 with its raison were read on the simulator's account-less user. Next build number: 27.

## Le face-à-face qui s'interrompait, et la barre d'état (2026-09-17)

Roch's face-à-face ended on « Le débat est interrompu » with the microphone sentence, although
the microphone is granted on his phone, and the screen's second button looked empty. Read from
the code, all three certain:

- **Any failure to start the phone's audio was reported as the microphone.** The debate screen
  now says the microphone sentence only when the permission is actually refused, and otherwise
  « Le son n'a pas pu démarrer sur ton téléphone » followed by the technical detail, so the
  cause comes back from the person's screen. The detail line is temporary, on this screen and on
  the recorder's; it goes once the cause is known.
- **The likely cause, fixed**: the take player kept its audio context alive after playing (the
  Arena tab never unmounts, so its cleanup never ran), and the debate then switched the phone's
  audio session to play-and-record beneath a live playback context. Roch had listened to his
  passage right before. The player now closes its context when it stops, and both the debate and
  the recorder stop the player before claiming the session. The server side is unchanged: its
  loop was measured end to end on 2026-09-13.
- **Three buttons drew bleu nuit on bleu nuit**: the interrupted screen's « Commencer un autre
  débat », the debate's « Terminer », the chooser's « Retour ». That is the « empty » button.
- **The status bar** was black on every dark screen, hiding the clock, the battery and the
  signal. Eleven dark screens now draw it white while they have the focus and give it back on
  leaving (`components/BarreEtat.ts`).

Not verified on a device: the simulator's user cannot open a debate (no account). **Build 26 is
uploaded** (Organizer, 08:36 local, "Upload completed" with the usual missing-symbol warnings)
for Roch to try; his screen will name any remaining cause. After the archive, the peer's reading of
the composed debate screens found the fallback alert's « Créer mon compte » pushing the account
screen without its raison; fixed (548267d), rides in build 27. Next build number: 27.

## Le face-à-face refusait la session que l'écran promettait (2026-09-17, soir)

Roch, build 26, Apple account: the chooser read « Il te reste 1 session ce mois-ci » and the tap
answered « Tu as utilisé tes sessions du mois ». Read in the database, certain: his one debate of
the day, opened at 10:04 UTC when the phone's audio never started, sat `ouverte` with no turn. An
open row has no `issue`, so the chooser did not count it. `ouvrir_debat` closed it as `abandonnee`
(counted), computed the quota (0 left), raised `quota_epuise`, and the exception rolled the close
back. Every tap replayed the loop; Rebecca's account was in the same state.

The rule is now the sentence a person would say: **a session is consumed once you have spoken in
it**, open or closed, unless we cut it ourselves. `quota_debats()` counts the person's turns
(migration 20260918000000, pushed to the hosted project, no build needed); the chooser and the
button read the same number by construction. `face_a_face.sql` carries the regression case on the
free plan at one session: 92 tests green against the hosted database. A rehearsal of Roch's tap
under his identity, rolled back, opens a debate and leaves his one session intact.

Still open, on his phone: whether the audio starts. Build 26 names the cause on the screen.

## Le face-à-face n'a jamais démarré sur un téléphone, et pourquoi (2026-09-17, nuit)

Build 26 put the cause on Roch's screen: « offset must be a finite non-negative number: -1 ».
In react-native-audio-api 0.13.3 the queue source's `start(when = 0, offset = -1)` rejects its own
default, so `file.start()` in `AudioDebat.demarrer` threw on every phone since the queue source
landed (00acf31, 2026-09-12). The native side treats `start(0, 0)` on an empty queue as a plain
start, so that is the call now. The take player's live context (build 26) was real but was not
this failure.

Why nobody saw it: the debate's audio start never ran on iOS after 09-12, because the simulator's
user has no account and the debate screen sits behind one. The development-only diagnostic screen
(`/diagnostic`) now runs the face-à-face's audio too: session, voice context, queue source, mic
frames, one silent chunk queued as Rétor. On the simulator tonight: « face-à-face : audio démarré,
14 trames de micro en 1,5 s, OK ». It runs before any build that touches audio.

The server side was run the same night with `verif-face-a-face.mjs` against Fly: session opened,
Rétor answered both turns (3.8 s then 1.5 s after the end of speech), his voice arrived, four turns
written in order, closed as `terminee`, the month moved from 0 to 1 under the new counting rule,
the debrief queued and written. **Build 27 is uploaded** (Organizer, 19:22 local, "Uploaded to Apple", archived from a clean worktree at 64c27df so another session's uncommitted Arena and duel edits stayed out). Mobile 88 tests, typecheck, lint green. Next build number: 28. The strings guard fails on three
strings in `packages/domaine/src/notifications.ts` left uncommitted by another session at that
moment; not this change.

## L'Arène s'écoute, le duel se lit, l'accueil célèbre (2026-09-18)

Roch, on build 26, with Rebecca's second account in the Arena and one duel answered by the
link: he could neither hear « Voix 2 » nor vote (« il n'y a rien à voter »), the duel screen
said « À toi de parler » without saying who had joined or that she had already answered, the
invitation was a bare URL with a copy button, and the home read below the mockup. All four
were real, none was a wording problem, and each had the same cause: a screen written from the
database's point of view instead of the person's.

- **The Arena lets you hear the others once you have spoken.** The ranking carries the path of
  every passage the caller may hear (`classement_arene` 2026-09-18: their own always, the
  others' once they have spoken, chapter 11 unchanged), and every line plays. The pair vote needs
  two other voices; with one, `paire_a_voter()` used to answer « rien à comparer » and the screen
  said « Tu as tout écouté » to someone who had heard nothing. It now says how many other
  voices there are, and the card says « Encore un passage, et les votes ouvrent » or « Ton
  passage est le seul pour l'instant » instead of a gold button that leads nowhere. The header
  says « 2 ont parlé », as the mockup's pill does.
- **« Retirer » exists.** The card had promised « tu peux le retirer » since Phase 7 and nothing
  did it. `retirer_ma_prise()`: the passage leaves the ranking, its audio goes at the next sweep,
  and the person may publish another while the subject is open (the weekly unique index now
  ignores withdrawn takes). `retiree_par` tells Rebecca's withdrawal from the person's own, so
  the card no longer sends someone to Rebecca for a gesture they made themselves.
- **The duel is read from the person's side.** `mes_duels()` answers, for each duel, who is on
  the other side (name and picture), whether each side has spoken, what may be heard, how long
  each take is, and once closed the measures of both. The duel screen shows two seats face to
  face and one card for the state: the invitation to send (the phone's share sheet, with the
  subject and the link in the message; the bare link stays one tap away), « À toi de parler »
  with « Tu entendras la réponse de Rebecca après la tienne », the wait with the hours left, the
  verdict with the winner's seat crowned, an expiry that says who stayed silent, and « Revanche,
  même sujet ». The list rows say « Contre Rebecca », the subject, whose turn it is and the hours
  left. « Défier un ami » is the subject alone; the duel's own screen takes over.
- **No grid, no verdict, and the screen says so.** Every duel today closes `sans_verdict`
  because no grid is published. The screen used to say « L'analyse n'a pas pu vous départager »,
  which reads as a failure; it now says the grid is not in place yet and puts the three measures
  of both takes side by side (counts, never a note). My decision, listed in docs/OPEN-INPUTS.md.
- **The second answer closes the duel on the spot**, instead of up to fifteen minutes later by
  the cron. And the two voices stay audible `duree_duel_heures` after the verdict: they used to be
  marked for deletion at closing and gone within the half hour, before the inviter had opened
  the app. Also my decision, in docs/OPEN-INPUTS.md.
- **Both sides are told.** Nothing notified anyone about a duel. `notifier_duel` pushes the
  inviter when someone joins, the other side when one answers, both at the verdict or the
  expiry (social switch of chapter 12). The invitee who answered by the link gave an address
  « pour te dire qui a gagné » and nothing ever wrote to it: the worker now sends that e-mail
  through the Gmail account of the sign-in codes (nodemailer, `SMTP_*` on Fly). A tap on a push
  opens the duel; the home shows the duel that waits for the person (« Rebecca a répondu à ton
  duel · À toi de parler », or a fresh verdict), as the mockup's B1 draws it.
- **The invitee page** names who is asking (« Roch te défie. »), shows a returning invitee the
  verdict instead of « ce duel est terminé », with both takes to hear in the browser, and says
  the same truth about a duel without a grid.
- **The home**: the day's step, once done, is a bleu nuit celebration card (gold check, « Défi
  du jour relevé », « Le suivant se débloque demain », the tier strip with « Enchaîner »)
  instead of a pale card with two buttons; the week's subject is a gradient card with the day
  ring, the subject in quotes and where the person stands in it (« Ton passage est en ligne ·
  2 voix »); the duel banner above Rebecca's card. Roch put Gemini's rendering of the same
  screen next to ours; what it did better was the weight of the done state and of the subject
  card, and that is what changed, in our palette.

Verified: pgTAP `arene.sql` 153 green against the hosted project inside one rolled-back
transaction with the migration (the audible ranking, `autres`, the withdrawal by the person and
by Rebecca, the two sides of `mes_duels()`, the queued notifications, the second answer closing
the duel, the listening window); server 119 (the duel job: who hears what, the e-mail with the
outcome in words, the expiry from each side); web 34 (the inviter's name, the returning
invitee's verdict with two players, the grid sentence); mobile 94 (the duel lines in every
state, the hours left, what the home points at, the done-state card); strings and lint green.
Deployed: migration `20260918010000_arene_ecoutable_duels_lisibles` applied on the hosted
project (00:20 UTC, the four functions, the column and the partial index checked there); Fly
release v31 (00:29 UTC, the worker lists `notifier_duel`, the SMTP secrets staged and live). **Build
28 is uploaded** (the released `Xcode.app`'s Organizer, 19:41 local, « Upload completed with
warnings », the dSYM notes; the beta6 Organizer answered « No Accounts », docs/RUNBOOK.md) with
everything above and the face-à-face start fix of the other session (3423e6d). The Organizer's
« Done » sheet was left open on the Mac. Not verified on a device: the share sheet and the push
on a phone, which need the build; the e-mail to an anonymous invitee, which needs the next real
duel by link. Next build number: 29.

## Next

Phases 0 to 8 are built, deployed and covered. What is left is not more code: it is the four
inputs that were never ours to invent, and the accounts that gate the release.

1. **Roch, and only Roch.** Each of these unblocks work that is already written and waiting:
   - a walkthrough of build 16 on his phone: the three sign-in doors, an e-mail through Gmail, an
     event in PostHog, an Arena take published;
   - a Sentry account and its DSN: crash reporting, the last unticked item of Phase 9 plumbing;
   - the RevenueCat account: `abonnements` gets its writer and E1 gets its offers;
   - a lawyer reads the chapter 2 statement now published in `apps/web`;
   - the Supabase plan's backup retention, which the dashboard shows and the API would not tell
     me: on the free plan there is no automated backup at all, and that is a decision, not an
     oversight. The schema itself is safe either way, being the migrations in git.
2. **Rebecca, through Roch (chapter 14).** The grid and its criteria, the path generator rules,
   the challenge and exercise banks, the Arena subjects, the offers and prices, the points rates.
   Every one of these has a screen in the admin space waiting for it, and every provisional row
   is badged `provisoire` in the app so nobody mistakes a placeholder for her work.
3. **Me, meanwhile.** Hardening and the walkthroughs I can run myself. The four review passes are
   closed; what I keep finding now comes from running the real pipeline against the hosted
   project rather than from reading code.

## Acceptance lists of later phases (from the plan, expanded before each phase starts)

- Phase 1: scripted walkthrough A1 to A7 online, then offline with airplane mode and reconnection; storage listing empty after analysis; the deletion job leaves no row or object; failure injection produces X3 with challenge and streak intact; reinstall conversion case tested; privacy text sent for lawyer review; ADR-007 checklist items 1 to 9 green on both devices.
- Phase 2: bench report on both modes (batch and streaming) with accuracy, latency, cost per minute, EU processing and retention terms per provider; ADR naming the provider(s); one scripted 5-minute debate measured for cost and per-turn latency.
- Phase 3: every measure of chapter 5 over fixtures with expected ranges (done), Praat CLI tests (done), real transcriber adapter, grid engine over declarative rules (done), wording validated against a JSON schema, B5 and B5b, calibration tool in the admin.
- Phase 4: acts, steps, three formats, per-step thresholds, two-failure remediation (X5), daily rhythm per offer (H5, H5b), H1 to H4, challenge authoring in the admin, RevenueCat and `abonnements` with a sandbox purchase.
- Phase 5: ledgers for points and streak, one recovery a month, quantity caps, D1, D1b, D2, G3 recovery, F1.
- Phase 6: grid editor, banks, configuration (done), offers content, workshops and announcements with geo filter and monthly cap, moderation queue, suspension, flags (done), export request inbox.
- Phase 7: weekly rotation by job, hidden takes until spoken, pair voting, `prises_publiques`, anonymity during votes, closing deletion, moderation state, `apps/web` invitation flow, duel closure rules, automatic verdict clearly labelled.
- Phase 8: streaming loop under 2 s per turn, per-turn persistence, resume (E3b), session ledger, debrief (E4).
- Phase 9: store listings, privacy labels, provider DPAs, TestFlight and Play internal testing, crash reporting, backups, the sentence that defines "version one is done".

## The words, on every surface a person reads (2026-09-15)

Roch read the shipped French and found it machine-written. The cause was the register: the text
described the product instead of being it. The standard is now the first rule of `CLAUDE.md` and
the section "The voice" of `docs/STRINGS.md`, with a second rule learned on the reward card: a
string is reviewed on the rendered screen, next to the database rows around it, never alone.

What changed, and where it is now:

- Every string of the app, the admin and the public pages reworded on voice; the reward list says
  "provisoire" once above the list instead of on every card; the privacy promise left the act map;
  duplicate lines on the défi screen and the upload state are gone. Commits `b29e016`, `610a6c7`.
- The provisional database content had been reworded in the seed but never reached the hosted
  rows (the seed never overwrites). `20260915000000_textes_provisoires.sql` applies the wording
  to rows with `provisoire = true` and is pushed. Rebecca's own edits are never touched.
- `npm run strings` (inside `npm run check`) fails the build on the mechanical tells, including
  the definitional openers, internal vocabulary, the slogan by apposition and the chat-bot
  opener; it also reads `app.json` and the Supabase e-mail templates, the French that lives
  outside `fr.ts`. It is the floor; the rule in `CLAUDE.md` is the standard.
- Fly is deployed with the reworded admin and public pages (verified in the served bundle).
- The Arena now enforces one passage per person per subject (`20260915010000`, pushed): a
  partial unique index plus a `deja_publie` refusal the app turns into a sentence. The Arena test
  file covers it and passes against the hosted database.
- Build 18 (`ios.buildNumber` 18) carries the new strings, verified in the archived bundle, and
  was uploaded to App Store Connect on 2026-09-15 through the released Xcode 27.0's Organizer,
  where Roch's account is signed in (the App Store update of the 14th replaced 26.6; the beta
  copy is now redundant). The Organizer shows 0.1.0 (18) "Uploaded to Apple". The command line
  still fails with "Failed to Use Accounts": an App Store Connect API key at the repo root makes
  `xcodebuild -exportArchive` non-interactive (`docs/RUNBOOK.md`, TestFlight), and that request
  stands. Next build number: 19, after Roch has looked at the Moi screens on the simulator.
- **Build 19** (`ios.buildNumber` 19) carries the whole design pass (A7, G1, Mon compte, B1, H1,
  G3, C1, D1, B3, B4, B5) and was uploaded on 2026-09-16 at 07:09 **from the command line**:
  `xcodebuild -exportArchive -allowProvisioningUpdates` saw the account again, a day after Roch
  signed into Xcode 27.0. "Upload succeeded", no Organizer click. The API key request stands, as
  the account has already vanished from the build tools' view once. Next build number: 20.

## The Moi tab closed the app, and why no test saw it (2026-09-16)

Roch updated to build 19 from TestFlight, opened Moi, and the app vanished. The rebuilt tab
prints "Dernière prise il y a…" through `ilYA`, which built an `Intl.RelativeTimeFormat`. Hermes
on iOS implements `NumberFormat`, `DateTimeFormat` and `Collator` and nothing else, so the
constructor threw while the screen rendered, and with no boundary above the tree the process
closed. The same call sat on Progrès, the act map, the rewards history and Rebecca's
announcements, waiting for the same person.

Nothing caught it because Jest runs on Node, where `Intl` is complete, and the simulator walk was
done on an account with no analysed take, which is the only state that reaches the line.

- `ilYA` writes the sentence from `fr.ts` (`temps.*`), same output as before, more cases covered.
- `apps/mobile/src/app/_layout.tsx` exports an expo-router `ErrorBoundary`: a render error now
  shows "Ça n'a pas marché. L'erreur vient de chez nous." with Réessayer, in plain primitives and
  static colours so it cannot depend on whatever failed, instead of closing the app.
- Rule for every screen from now on: no `Intl` API other than `NumberFormat`, `DateTimeFormat`
  and `Collator`, and a screen is walked with an account that has data before a build.

**Build 20 is uploaded** (2026-09-16, 18:37, the Organizer shows 0.1.0 (20) "Uploaded to
Apple"). It was re-archived at 18:21 from main at `1146a0e`, so it carries the Moi crash fix and
everything committed after the first archive of the day: the Aujourd'hui card that no longer
explains the plan, the Rebecca card that no longer cuts its sentence, the account steps said once,
the feedback card naming the grid once. The command line answered "Failed to Use Accounts" three
times that afternoon; EAS accepted the build and stopped on the free quota (reset 1 October); the
upload went through the Organizer, driven by `cliclick` once Roch had unlocked the Mac. The App
Store Connect API key request still stands, because every build so far has hung on whether the
account happened to be visible. **Build 21 is uploaded** the same evening (19:10, Organizer,
"Uploaded to Apple") with the animated launch; it is the first build whose native launch screen
is background-only. The command line refused the account again for it. **Build 22 is uploaded** (20:05, Organizer, "Upload completed with warnings": the usual three dSYM warnings for React, ReactNativeDependencies and hermesvm). It carries the retimed launch, which Roch found precipitated on build 21, and the microphone prompt rewritten alongside it; the generated `Info.plist` was checked for both the number and the new wording. All three upload paths were shut for two hours that evening: the command line ("Failed to Use Accounts" again), EAS (no free build until 1 October), and the Organizer behind the Mac's screen lock. A watch on `IOConsoleLocked` caught the unlock and the upload went out two minutes later, which is the pattern to reuse rather than asking Roch to announce himself. Next build number: 23.
