# Status

Last updated: 2026-09-06, end of the Phase 0 build session. Update this file in the same commit as any change of state.

How to read it: one line per phase, then the checklist of the phase in progress, then what has actually been verified on a machine versus what has only been written, then what is blocked and by whom, then the next actions in order.

## State by phase

| Phase | Name                                                        | State                                                                                                     |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 0     | Foundations                                                 | Built, green locally, schema live on the hosted project and verified; Fly deploy and device checks remain |
| 1     | Socle: flow A end to end with a stub transcriber            | Not started                                                                                               |
| 2     | STT bench, then debate cost spike                           | Harness written, corpus empty, keys awaited                                                               |
| 3     | Measurement engine, grid engine, feedback, calibration tool | Engine and grid rules exist and are tested; wording and calibration tool not started                      |
| 4     | Path machinery, three formats, entitlements, RevenueCat     | Not started                                                                                               |
| 5     | Streak, points, shop, bridge to Rebecca                     | Not started                                                                                               |
| 6     | Admin space, complete                                       | Configuration and flags pages exist; the rest not started                                                 |
| 7     | Arena and duels, shipped off, public web                    | Not started                                                                                               |
| 8     | Face-à-face                                                 | Not started                                                                                               |
| 9     | Release                                                     | Not started                                                                                               |

A phase ends when its acceptance list is green and this file says so.

## What exists today

| Workspace          | Content                                                                                                                                                                                                                                                                                  | Checks                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/domaine` | Zod schemas and types for every Phase 0 table, the configuration seed definitions, the grid rule engine (`evaluerRegle`, `evaluerCriteres`), job charges                                                                                                                                 | typecheck, 27 tests                                                         |
| `packages/moteur`  | The measurement engine over PCM plus transcript (nine measure families of chapter 5), WAV codec, French WER, deterministic transcriber and prosody stubs, synthetic fixtures; the STT bench harness (`bench/`) with the four provider adapters declared and refusing to run without keys | typecheck, 33 tests                                                         |
| `apps/serveur`     | Hono service with `/sante`, the worker loop, the analysis pipeline in the order of the state diagram, the sweep, the anonymous purge and account deletion jobs, ffmpeg decoding, the Praat prosody CLI (Python) with its pytest, Dockerfile, Fly configuration with two process groups   | typecheck, 10 tests, 4 Python tests                                         |
| `supabase/`        | The socle migration (tables, helpers, triggers, queue functions, RLS, access token hook, buckets, pg_cron), idempotent seed, 133 pgTAP assertions, CLI config, a remote test runner                                                                                                      | pushed to the hosted project on 2026-09-06; 133 assertions green against it |
| `apps/mobile`      | Expo SDK 57 shell: tokens and Manrope, themes, Bulle placeholder, UI primitives, tab bar honouring the `arene` flag, A1 and A2 implemented, the four tabs as real shells with placeholder cards, X1, anonymous sign-in, configuration and flags cached for offline start                 | typecheck, lint, 6 tests                                                    |
| `apps/admin`       | Vite + React space: login, role gate, layout, home, configuration editor (typed fields, contract validation, optimistic save), flags with confirmation                                                                                                                                   | typecheck, lint, 10 tests                                                   |
| `apps/web`         | Placeholder README (Phase 7)                                                                                                                                                                                                                                                             | none                                                                        |
| `docs/`            | This folder, eight ADRs                                                                                                                                                                                                                                                                  | prettier                                                                    |
| CI                 | `.github/workflows/check.yml`: typecheck, lint, tests, prettier, Python tests                                                                                                                                                                                                            | not yet run on GitHub                                                       |

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
   - [ ] Deployed once (blocked on `fly auth login`)
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

- Fly.io: CLI installed, not logged in. `fly auth login` once, then the first deploy and the job-claim verification.
- Device checks of ADR-007: run on Roch's iPhone and the simulator first (his testing setup); the Android half waits for an EAS development build on a borrowed or later device, before release.

## Phase 1 checklist (socle)

Written before the work started, as the rule says. Slices are built in this order; each ends with its checks green, `npm run check` green, docs updated, a commit pushed. Boxes are ticked when verified on a machine.

1. Contract and database (migration `0002_socle_phase1`)
   - [ ] `reponses_accueil` (the three onboarding answers, fixed option codes), `jetons_push` (Expo push tokens per device), `profils.prenom` set at A7, `demander_suppression_compte()` RPC that queues the `supprimer_compte` job for the caller, `tentatives` added to the Realtime publication
   - [ ] `@leq/domaine` schemas and option lists; pgTAP additions green against the hosted project
2. Recording stack on the phone (ADR-007)
   - [ ] `react-native-audio-api` installed with its config plugin; a development build runs on the simulator; recording to `.m4a` 16 kHz mono in the cache directory; level meter; interruption ends the take
   - [ ] Fallback documented and exercised only if the build fails (ADR-007, expo-audio recorder plus a session module)
3. Local queue and upload
   - [ ] Queue with the phone-only states (enregistrement, en attente réseau, envoi, envoyée, annulée, expirée), index persisted on the phone, files in the cache directory, Android backup disabled, 7-day expiry, retry with backoff on foreground and on network return, upload idempotent by attempt id (an object already there counts as sent), insert of the `tentatives` row idempotent
   - [ ] Unit tests of the queue state machine
4. Screens of flow A and the X states
   - [ ] A3 three questions (touch, never type), A4 diagnostic take (60 to 90 s, Refaire, Terminer), A5 analysis in progress, X2 sending with Bulle, X3 failure (challenge and streak untouched, retry, keep on phone), X4 offline banner while recording
   - [ ] A6 profile from measures only (rate, fillers, silences, no grid text, no archetype title), A7 account (email code, Apple and Google buttons wired to `linkIdentity` behind credentials, "Plus tard" keeps the local profile)
   - [ ] The feedback screen updates by itself when the row reaches `retour_disponible` (Realtime, polling fallback)
5. Server side of the loop
   - [ ] `duree_s` written from the decoded audio; push "Ton retour est prêt" through Expo's push API to the person's registered tokens; failures logged, never retried into a loop
   - [ ] Account deletion end to end: RPC queues the job, the worker removes storage objects then the auth user, the phone signs out and wipes its queue and caches
6. Settings G3, minimal
   - [ ] The voice statement (chapter 2 wording, marked for lawyer review), "Supprimer mon compte" with confirmation, "Recevoir une copie de mes données" as a request row (Phase 6 inbox), the four notification toggles stored on the profile (used from Phase 5)
7. End to end on the simulator, then on Roch's iPhone
   - [ ] A1 to A6 with the worker running on this Mac: the take uploads, the job runs, the audio object is gone, the measures show on A6
   - [ ] Offline: airplane mode during A4, the take waits, sends when the network returns, the streak day is the recording day (checked in the row)
   - [ ] Failure injection in the worker: X3 shows, no `resultat`, nothing consumed
   - [ ] Deletion leaves no row and no object for the test user
   - [ ] ADR-007 checklist items 1 to 9 on Roch's iPhone (needs him)

Phase 1 acceptance: every box above, plus the privacy text sent for lawyer review (docs/OPEN-INPUTS.md).

## Next

1. Build slice 1 (contract, migration, schemas), then slices 2 to 7 in order.
2. Roch, any time: `fly auth login` (server on Fly instead of this Mac), Apple and Google sign-in credentials (slice 4, A7), a session on his iPhone for slice 7.
3. In parallel, assemble the bench corpus and run the bench as soon as one key arrives.

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
