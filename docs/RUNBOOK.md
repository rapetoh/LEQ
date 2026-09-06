# Runbook

How to install, run, migrate, deploy and build LEQ. Written so that someone else can repeat all of it on a fresh Mac. Commands are run from the repository root unless stated otherwise. Script names beyond `typecheck`, `lint` and `test` follow the conventions below; each workspace README is the final word for its own scripts.

## Prerequisites

| Tool                               | Why                                                                                                                                                                                  | Install                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 22 or 24                      | `.nvmrc` pins 22 and CI runs 22. The Mac has Node 25 installed directly: everything runs on it, Vitest only prints an unsupported-engine warning. Use nvm to match CI when in doubt. | `brew install nvm`, follow the shell setup it prints, then `nvm install` in the repo (reads `.nvmrc`) and `nvm use`                                                                                                             |
| Xcode 26.x with iOS simulators     | Simulator builds of the mobile app                                                                                                                                                   | App Store, then `sudo xcode-select -s /Applications/Xcode.app`, `sudo xcodebuild -license accept`, install an iOS runtime in Xcode > Settings > Components                                                                      |
| CocoaPods                          | Native iOS dependencies during `expo run:ios`                                                                                                                                        | `brew install cocoapods`                                                                                                                                                                                                        |
| Homebrew                           | Everything below                                                                                                                                                                     | https://brew.sh                                                                                                                                                                                                                 |
| ffmpeg                             | Decoding m4a to 16 kHz mono PCM in the worker and in engine tests                                                                                                                    | `brew install ffmpeg`                                                                                                                                                                                                           |
| Python 3 with parselmouth          | The Praat prosody CLI (`apps/serveur/prosodie`)                                                                                                                                      | `python3 -m venv apps/serveur/prosodie/.venv && apps/serveur/prosodie/.venv/bin/pip install -r apps/serveur/prosodie/requirements.txt` (the venv is git-ignored; the package is `praat-parselmouth`, imported as `parselmouth`) |
| Supabase CLI via npx               | Migrations, local stack, types                                                                                                                                                       | Nothing to install: `npx supabase --version`                                                                                                                                                                                    |
| Fly CLI                            | Deploying `apps/serveur`                                                                                                                                                             | `brew install flyctl`, then `fly auth login` once                                                                                                                                                                               |
| EAS CLI via npx                    | Cloud builds and store submission                                                                                                                                                    | Nothing to install: `npx eas-cli --version`; Expo account `rxpetoh` is already logged in on this Mac                                                                                                                            |
| Docker (optional)                  | `npx supabase start` (local Postgres for database tests) and building the server image locally                                                                                       | OrbStack or Docker Desktop. Fly builds remotely, so deploys do not need it                                                                                                                                                      |
| Java and Android Studio (optional) | Local Android builds and Maestro flows                                                                                                                                               | Not installed on this Mac. Until then, Android is verified through EAS cloud builds only                                                                                                                                        |

## Install

```bash
nvm use
npm install
npm run check
```

Rules:

- `npm install` runs at the root only. Never inside a workspace (it creates a nested `node_modules` and breaks Metro).
- To add a dependency to a workspace: `npm install <package> --workspace @leq/serveur`. For Expo packages, run `npx expo install <package>` inside `apps/mobile` so the SDK 57 compatible version is chosen; `npx expo install --fix` realigns them.
- `npm run check` runs `typecheck`, `lint` and `test` in every workspace that declares them. `npm run format` rewrites with Prettier, `npm run format:check` is what CI runs.
- Pinned versions: Expo packages ~57.0.x, React 19.2.x, TypeScript ~6.0.3, Zod 4, Vitest 5, Hono 4.13, supabase-js 2.115, TanStack Query 5, Vite 8.

## Run each workspace

| Workspace               | Command                                                                                    | Notes                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domaine`      | `npm run test --workspace @leq/domaine`, `npm run typecheck --workspace @leq/domaine`      | Pure schemas, no runtime                                                                                                                                                                                                                      |
| `packages/moteur`       | `npm run test --workspace @leq/moteur`                                                     | Fixtures are synthesised in code (`src/fixtures/synthese.ts`); no audio file, no ffmpeg                                                                                                                                                       |
| `apps/mobile`           | `cd apps/mobile && npx expo run:ios`                                                       | First run does `prebuild` (generates `ios/`, git-ignored) and `pod install`, several minutes. Then `npx expo start` reuses the installed development build. `--device "iPhone 17"` picks a simulator, `--device` alone lists physical devices |
| `apps/admin`            | `npm run dev --workspace @leq/admin`                                                       | Vite dev server, http://localhost:5174. `npm run build --workspace @leq/admin` produces `dist/`                                                                                                                                               |
| `apps/serveur`          | `npm run dev --workspace @leq/serveur`                                                     | Worker loop in watch mode with `PROCESS=worker` from `apps/serveur/.env`. `npm run build` then `npm start` for the compiled service. `/sante` answers on `PORT` (8080)                                                                        |
| `apps/serveur/prosodie` | `apps/serveur/prosodie/.venv/bin/pytest apps/serveur/prosodie`                             | Also `apps/serveur/prosodie/.venv/bin/python apps/serveur/prosodie/extraire.py <fichier.wav>` prints the JSON tracks                                                                                                                          |
| `supabase/` (local)     | `npx supabase start`, `npx supabase db reset`, `npx supabase test db`, `npx supabase stop` | Needs Docker. Studio at http://127.0.0.1:54323, API at 54321, Postgres at 54322                                                                                                                                                               |
| `apps/web`              | Phase 7                                                                                    | Placeholder README only                                                                                                                                                                                                                       |

Expo Go cannot run this app once native audio modules are in (Phase 0 spike onwards); always use a development build (`expo run:ios` or an EAS `development` build).

## Environment files and secrets

Every workspace reads a `.env` next to its `package.json`, copied from its `.env.example`. `.env` files are git-ignored; only `.env.example` is committed, with placeholders and comments, never values.

| File                | Read by                                                                                | Variables                                                                                                                                                                                                                                                                                                                                                                                            | Where the value comes from                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/.env`  | Expo at bundle time (`EXPO_PUBLIC_*` are embedded in the app and are public by nature) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`EXPO_PUBLIC_SERVEUR_URL` arrives with the debate)                                                                                                                                                                                                                                                                               | Supabase dashboard > Project Settings > API (publishable key `sb_publishable_...`), Fly app URL. Never put a secret in an `EXPO_PUBLIC_` variable |
| `apps/admin/.env`   | Vite at build time (`VITE_*`, public)                                                  | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                                                                                                                                                                                                                                                                                                                                                 | Same as above                                                                                                                                     |
| `apps/serveur/.env` | `src/config.ts` at startup                                                             | `DATABASE_URL` (direct connection, not the pooler), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (`sb_secret_...`, bypasses RLS), `PROCESS`, `WORKER_ID`, `LOG_LEVEL`, `PORT`, `TRANSCRIPTEUR` (`stub` until the bench), `FFMPEG_PATH`, `PYTHON_PATH`, `PROSODIE_SCRIPT`, `INTERVALLE_INACTIF_MS`. Later phases add `ANTHROPIC_API_KEY`, STT and TTS keys, `EXPO_ACCESS_TOKEN`, `REVENUECAT_WEBHOOK_SECRET` | Supabase dashboard > Connect (direct connection string) and > API (secret key); provider consoles                                                 |
| `supabase/.env`     | The Supabase CLI, substituting `env(...)` references in `config.toml`                  | OAuth client ids and secrets for Apple and Google (Phase 1)                                                                                                                                                                                                                                                                                                                                          | Apple developer portal, Google Cloud console                                                                                                      |

Where secrets live:

- Production server secrets: Fly, `fly secrets set NAME=value -a leq-serveur`. They never appear in `fly.toml`.
- Supabase: the database password and the secret key are shown once in the dashboard; store them in a password manager (1Password or the macOS keychain), not in a file in the repo.
- Store signing: EAS manages iOS certificates and the Android keystore in the Expo account; `eas credentials` to inspect. Local copies (`*.p8`, `*.p12`, `*.jks`, `*.mobileprovision`) are git-ignored.
- GitHub Actions: the check workflow needs no secret. If a workflow ever needs one, it goes in the repository's Actions secrets.
- The phone never holds a provider key (Anthropic, STT, TTS, RevenueCat webhook). Those exist only in Fly secrets. The RevenueCat public SDK key is the one exception and is public by design.

## Migrations and seed

The schema is the contract in docs/DATA-MODEL.md. Migrations live in `supabase/migrations`, named with the CLI's timestamp convention (`20260906000000_socle.sql` first). Configuration defaults and the three flags live in `supabase/seed.sql`, idempotent (values are never overwritten, only descriptions and types refreshed), applied locally by `db reset` and on the hosted project by `db push --include-seed`. No dev grid is ever seeded; the dev grid exists only in tests.

Hosted project, first time:

```bash
npx supabase login
npx supabase link --project-ref <ref>        # asks for the database password
npx supabase db push --dry-run               # lists what will be applied
npx supabase db push
```

Then the auth settings, which migrations cannot set, are pushed from `supabase/config.toml` with `npx supabase config push --yes` (anonymous sign-ins, manual linking, the access token hook on `public.hook_jeton_acces`, redirect URLs). Read the diff in an interactive shell first: without a terminal the command applies without asking. Check in the dashboard that `pg_cron` is enabled and the three `leq_*` schedules exist.

Phase 1 adds the Apple and Google providers and the redirect URL `leq://auth` under Authentication > URL Configuration.

Database tests against the hosted project: `node supabase/tests/executer-distant.mjs <fichier.sql>` runs a pgTAP file as one transaction that the file itself rolls back. When a file fails, the whole-file runner cannot say where: `node supabase/tests/pas-a-pas.mjs <fichier.sql>` runs it statement by statement inside a transaction that is always rolled back and prints the first failing statement. To try a new migration with its tests before pushing, concatenate `begin;`, the migration, the test body and `rollback;` into a scratch file and run that. Rule learned the hard way on 2026-09-06: never send statements to the hosted database outside a transaction (a first version of the step runner did, and committed test users, attempts and a changed reward cap that had to be removed by hand).

Later migrations: `npx supabase migration new <nom>` creates the timestamped file; write SQL; `npx supabase db reset` locally (needs Docker) to replay everything; `npx supabase db push` to the linked project. `npx supabase migration list` compares local and remote history.

Seeding the hosted project: `npx supabase db push --include-seed` (safe to repeat: the seed never overwrites a value Rebecca changed).

Types: `npx supabase gen types --lang typescript --linked > packages/domaine/src/database.types.ts` (check the path in the domaine README). Commit the generated file with the migration that changed it.

Making the first admin: as `postgres` in the SQL editor, `update public.profils set role = 'admin' where id = '<uid>'`. A trigger refuses that change from any signed-in client. The role reaches the token at the next sign-in.

The admin's pages today: Configuration, Drapeaux, Défis (the bank act by act; a défi's title and consigne change for everyone at once, its order and threshold only for paths created afterwards; "Marquer comme validé" turns `provisoire` off so the phone stops saying the consigne awaits Rebecca), Exercices (the remediation bank, matched to défis by `competence`).

## Deploy the server

`apps/serveur` is one Docker image with two process groups (`worker`, `temps-reel`) declared in `apps/serveur/fly.toml`, region `cdg`. The build context is the repository root because the image needs `packages/domaine` and `packages/moteur`.

First time:

```bash
fly auth login
fly apps create leq-serveur                     # name as in fly.toml
fly secrets set -a leq-serveur \
  DATABASE_URL='postgresql://...' \
  SUPABASE_URL='https://<ref>.supabase.co' \
  SUPABASE_SECRET_KEY='sb_secret_...' \
  TRANSCRIPTEUR=stub
```

Every deploy:

```bash
fly deploy --config apps/serveur/fly.toml --dockerfile apps/serveur/Dockerfile --remote-only
fly status -a leq-serveur
fly logs -a leq-serveur
```

`--remote-only` builds on Fly's builders, so Docker is not needed locally. Add `--ha=false`: without it Fly creates two `temps-reel` machines and a standby `worker`, and `fly scale count worker=1` may keep the standby (which stays stopped) instead of the running one; that happened on the first deploy and was fixed with `fly machine destroy <standby> --force` then `fly scale count worker=1`. First deploy done on 2026-09-06 (Roch's Fly account, org personal). `fly scale count worker=1 temps-reel=1 -a leq-serveur` sets one machine per group; `min_machines_running = 1` in `fly.toml` keeps them up. `fly ssh console -a leq-serveur` opens a shell in a machine (useful to run `ffmpeg -version` and `python3 -c "import parselmouth"`).

Verify a deploy: `curl https://leq-serveur.fly.dev/sante` answers, then insert a job in the dashboard SQL editor (`insert into public.jobs (type, charge, cle_idempotence) values ('balayer_audio', '{}', 'test:' || now())`) and watch `fly logs` show it claimed and finished.

Database connection from Fly: use the direct connection string (port 5432, not the pooler on 6543). Supabase direct connections are IPv6; Fly machines have IPv6 egress. If a connection error mentions the address family, either add the IPv4 add-on on the Supabase project or use the pooler in session mode, then note it in docs/STATUS.md.

## Build the mobile app

Simulator (local, free):

```bash
cd apps/mobile
npx expo run:ios --device "iPhone 17" --port 8082   # first time: prebuild + pod install, then the app opens against the bundler
npx expo prebuild --clean --platform ios             # regenerate ios/ from app.json when native config changed
```

Port 8082 because the Money App's bundler often holds 8081 on this Mac; Expo refuses to reuse a port held by another project. If a prebuild fails halfway, run `prebuild --clean` before the next build, otherwise the half-generated project (template bundle identifier `org.name.LEQ`) is reused. To open a screen by deep link on the simulator, use the app itself: a `leq://` link sent with `simctl openurl` raises an iOS confirmation that cannot be answered from the command line.

`ios/` and `android/` are generated (Continuous Native Generation) and git-ignored. Native configuration lives in `app.json` and Expo config plugins, never by hand in the generated folders.

Physical iPhone: `npx expo run:ios --device` with the phone plugged in; needs a free Apple ID for development signing, and the Apple Developer Program for TestFlight.

Store builds run on EAS cloud, not on this Mac:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform ios
```

Why the cloud: this Mac runs macOS 27.0, a beta seed. Xcode on a beta OS links against a seed SDK, and App Store Connect rejects binaries built with seed SDKs. EAS builders run released macOS and Xcode versions, hold the signing credentials, and also build Android, for which this Mac has neither Java nor the SDK. The free EAS plan includes 15 iOS and 15 Android builds a month (pricing page read on 2026-09-06); builds are started by hand, never from CI, because they cost quota. Profiles (`development`, `preview`, `production`) live in `apps/mobile/eas.json`.

Development builds for a device without Xcode on the tester's side: `npx eas-cli build --platform ios --profile development`, install through the link EAS prints.

## Continuous integration

`.github/workflows/check.yml` runs on every push to `main` and on pull requests: Node from `.nvmrc`, `npm ci`, build of `@leq/domaine` and `@leq/moteur` if they declare a build script, `npm run check`, `npm run format:check`, and a separate job on Python 3.12 running `pytest apps/serveur/prosodie`. Nothing deploys from CI; deploys and EAS builds are manual.

## Everyday checks

```bash
npm run check
npm run format
grep -rn --include='*.ts' --include='*.tsx' --include='*.md' --include='*.sql' --include='*.py' -e '—' -e '–' . | grep -v node_modules   # must print nothing
```

## Troubleshooting

- Metro cannot resolve a package installed at the root: the mobile workspace's `metro.config.js` must list the root `node_modules` in `watchFolders` and `nodeModulesPaths`. Run `npx expo-doctor` in `apps/mobile`.
- `pod install` fails after an SDK change: `cd apps/mobile && npx expo prebuild --clean`.
- `npx supabase link` refuses the password: reset it in Project Settings > Database; it is not the account password.
- `db push` says a migration is already applied but the tables are missing: `npx supabase migration list`, then `npx supabase migration repair` as the CLI suggests.
- `fly deploy` cannot find `packages/`: the build context is wrong; run the command from the repository root with the `--config` and `--dockerfile` flags above.
- The worker claims nothing: check `PROCESS=worker`, check `DATABASE_URL` is the direct connection, check that `reclamer_job` exists and is executable by the service role (`select proname from pg_proc where proname = 'reclamer_job'`).
