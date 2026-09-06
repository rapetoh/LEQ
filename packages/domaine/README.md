# @leq/domaine

The code form of `docs/DATA-MODEL.md`: Zod 4 schemas, inferred types and constants shared by the mobile app, the admin and the server. When a name changes in the contract, it changes here in the same commit.

## Contents

| File               | What it holds                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `primitives.ts`    | timestamps, numerics and bigints as PostgREST and node-postgres each encode them, IANA timezone, JSON                             |
| `profil.ts`        | `profils` row, roles, the fixed region list for the announcement geo filter                                                       |
| `configuration.ts` | the configuration keys, their types, defaults and French descriptions (the seed), `lireConfiguration` and `analyserConfiguration` |
| `drapeaux.ts`      | the three feature flags, off by default, `lireDrapeaux`                                                                           |
| `tentative.ts`     | server-side statuses of a recording, the phone's insert payload, the audio path rule, date plausibility                           |
| `transcription.ts` | the timed transcript kept from the voice                                                                                          |
| `mesures.ts`       | `MesuresV1`, the filler-word list v1, the dotted measure paths a grid rule can point at                                           |
| `analyse.ts`       | `analyses` row                                                                                                                    |
| `grille.ts`        | versioned grid, declarative rule v1, `evaluerRegle` and `evaluerCriteres` (pure, total, never throw)                              |
| `evaluation.ts`    | `evaluations` row, sub-scores, feedback fields, `resultatEtape`                                                                   |
| `jobs.ts`          | job types, typed charges, idempotence keys, backoff                                                                               |

Everything is exported from `src/index.ts`. Built to `dist/` as ESM with declarations; other workspaces import the built package.

## Run

```bash
npm run build --workspace @leq/domaine   # required before the server or the engine typecheck
npm test --workspace @leq/domaine        # 27 unit tests, including the contract's JSON example
```

## Rules

- Schemas accept both wire encodings (JSON numbers and Postgres numeric strings, ISO strings and Date objects) and always output one shape.
- `evaluerRegle` treats a missing measure as a zero for its element and flags it; a measure that cannot be computed lowers the score instead of inflating it.
- No I/O, no React, no Supabase here.
