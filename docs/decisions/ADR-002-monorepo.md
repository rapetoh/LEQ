# ADR-002: Monorepo with npm workspaces

Status: Accepted
Date: 2026-09-05

## Context

LEQ has four deployable applications (mobile, admin, public web, server) and a database, and they share a domain: the same attempt statuses, the same measures shape, the same grid rule definitions, the same configuration keys. Keeping them in separate repositories would mean copying types by hand and discovering mismatches in production. The developer is one person; tooling must stay light, and `npm` is already the package manager in use (npm 11 on the machine, Expo and Supabase tooling both assume it).

## Decision

One repository, `rapetoh/LEQ`, using npm workspaces. Layout:

| Path               | Package        | Role                                                                         |
| ------------------ | -------------- | ---------------------------------------------------------------------------- |
| `apps/mobile`      | `@leq/mobile`  | Expo application                                                             |
| `apps/admin`       | `@leq/admin`   | Rebecca's administration SPA                                                 |
| `apps/web`         | `@leq/web`     | Public web surface (Phase 7)                                                 |
| `apps/serveur`     | `@leq/serveur` | Node service: worker and temps-reel                                          |
| `packages/domaine` | `@leq/domaine` | Zod schemas, types, constants: the code form of docs/DATA-MODEL.md           |
| `packages/moteur`  | `@leq/moteur`  | Measurement engine over PCM plus transcript, no I/O, tested on fixture audio |
| `supabase/`        | not a package  | migrations, RLS, seed, tests, edge functions                                 |
| `docs/`            | not a package  | tracking documents and ADRs                                                  |
| `Brainstorming/`   | not a package  | product documents, kept untouched                                            |

Shared tooling at the root: `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Prettier, `.editorconfig`, `.nvmrc` pinned to Node 22, and the scripts `typecheck`, `lint`, `test`, `check` that fan out to every workspace with `--workspaces --if-present`. Every workspace exposes `typecheck` and, where applicable, `lint` and `test`. Vitest for packages and server, React Native Testing Library for critical mobile components, pytest for the Praat CLI. GitHub Actions runs `npm run check` and `format:check` on every push and pull request.

docs/DATA-MODEL.md is the contract; `packages/domaine`, `supabase/migrations`, `apps/serveur` and `apps/admin` implement exactly its names. A name changes there first, then everywhere, in the same commit.

## Consequences

- One `npm install` at the root installs everything; one `npm run check` tells whether the whole system is consistent.
- Domain types are imported, never copied: the mobile app, the admin and the server all validate against `@leq/domaine`.
- Expo inside a workspace needs Metro to resolve hoisted modules from the root `node_modules`; the mobile workspace carries the Metro configuration for that. Native build folders (`apps/mobile/ios`, `apps/mobile/android`) are generated and git-ignored (Continuous Native Generation).
- Version pinning is per workspace (Expo packages at SDK 57, React 19.2, TypeScript ~6.0.3, Zod 4, Vitest 5, Hono 4.13, supabase-js 2.115, TanStack Query 5, Vite 8); the root only pins TypeScript and Prettier.
- Python code for prosody lives inside `apps/serveur/prosodie` with its own `requirements.txt`; it is not an npm package and CI installs it separately.
- Rejected: pnpm or Turborepo (more tooling than the project needs today; can be adopted later without moving files); one repository per application (type drift, four CI pipelines, four places to update docs).
