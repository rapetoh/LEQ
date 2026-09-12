# LEQ

LEQ is a French mobile application that trains public speaking. The person speaks, the app listens, analyses the recording, returns structured feedback, and moves them along a path built for them. The coach Rebecca is the pedagogical authority: her grid defines what a good take is, and the application applies it constantly. Every string in the app is plain French, tutoiement. Voice recordings are analysed then deleted; only measures and text are kept.

Three things bring people back: the daily challenge (the next step of the path), the Arena and private duels (the eyes of others, built and shipped switched off), and the face-à-face, a live debate against an AI opponent named Rétor, reserved to the paid offer.

## Repository layout

| Path                | What it is                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`       | The Expo application (iOS and Android), `@leq/mobile`                                                                                                   |
| `apps/admin`        | Rebecca's administration space, a Vite plus React SPA, `@leq/admin`                                                                                     |
| `apps/web`          | Public web surface: duel invitation, privacy and terms pages (Phase 7), `@leq/web`                                                                      |
| `apps/serveur`      | The Node service on Fly.io: `worker` (analysis pipeline, jobs) and `temps-reel` (debate), `@leq/serveur`; includes the Praat prosody CLI in `prosodie/` |
| `packages/domaine`  | Zod schemas, types and constants: the code form of the data contract, `@leq/domaine`                                                                    |
| `packages/moteur`   | The measurement engine over PCM plus transcript, no I/O, `@leq/moteur`                                                                                  |
| `supabase/`         | Migrations, RLS, seed, database tests, edge functions, `config.toml`                                                                                    |
| `docs/`             | Tracking documents and decision records (start here)                                                                                                    |
| `Brainstorming/`    | The product documents: cahier des charges, diagrams, validated mockup, handoff note. Kept untouched                                                     |
| `.github/workflows` | CI: typecheck, lint, tests, formatting, Praat CLI tests                                                                                                 |

## Where to start

1. [docs/STATUS.md](docs/STATUS.md): where the build stands, phase by phase, what is verified, what is blocked, what comes next.
2. [docs/RUNBOOK.md](docs/RUNBOOK.md): prerequisites, how to install, run, migrate, deploy and build.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): the system, the data flow of an attempt, the jobs queue, and the reasoning behind each big choice.
4. [docs/DATA-MODEL.md](docs/DATA-MODEL.md): the contract every workspace implements, name for name.
5. [docs/SCREENS.md](docs/SCREENS.md): the 50 mockup screens mapped to routes, phases and status.
6. [docs/EXTERNAL-SERVICES.md](docs/EXTERNAL-SERVICES.md): every third party, its status, region, data protection and cost.
7. [docs/OPEN-INPUTS.md](docs/OPEN-INPUTS.md): what is needed from Roch, from Rebecca and from legal, and the product defaults awaiting objection.
8. [docs/STRINGS.md](docs/STRINGS.md): the writing rules for every user-facing string.
9. [docs/decisions/](docs/decisions/README.md): the architecture decision records.

## Product documents

`Brainstorming/` holds the cahier des charges (what the app does and why), the Mermaid diagrams (domain model, lifecycle of an attempt, main sequences), the validated mockup (`App LEQ (1).html`, third version, reviewed by Rebecca) and the handoff note. These are decisions, not suggestions. Where the mockup and the cahier disagree, the cahier wins.

## Working rules

- npm workspaces, Node 22 (`.nvmrc`). `npm install` once at the root, then `npm run check` (typecheck, lint, test across workspaces). See the runbook before running anything.
- `docs/DATA-MODEL.md` is the contract. A name changes there first, then in every workspace, in the same commit.
- Tracking documents are updated in the same commit as the code they describe. The test: a human or an AI picking this up cold understands where things stand without asking.
- Domain vocabulary in French (as in the cahier and the diagrams), technical plumbing in English, engineering docs in English, every user-facing string in French.
- Every user-facing string is written to [docs/STRINGS.md](docs/STRINGS.md), including its section "How the text must not sound": no sentence that states a fact and then negates its opposite, no aphorism, no loading state written as the application narrating itself. `npm run strings` enforces the mechanical part and runs inside `npm run check`.
- No em dashes anywhere, in any file. Commas, periods, colons.
- Secrets never enter git. `.env` files are ignored; only `.env.example` files are committed.
- Four inputs do not exist yet and are never invented: Rebecca's grid, the path generator rules, the speech-to-text provider, the measured cost of a debate. Where code needs them, a clearly named stub stands in and the README of the workspace says so.
