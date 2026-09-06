# supabase/

The database of record: migrations, seed, database tests and the CLI configuration. Everything implements `docs/DATA-MODEL.md` name for name.

## Layout

- `migrations/20260906000000_socle.sql`: Phase 0 schema, helpers, triggers, the job queue functions, Row Level Security on every table, the access token hook, the two storage buckets and their policies, the pg_cron schedules (guarded when pg_cron is absent).
- `seed.sql`: configuration defaults (idempotent: description and type are refreshed, values never overwritten) and the three flags off.
- `tests/socle.sql`, `tests/socle_phase1.sql`, `tests/demandes_export.sql`, `tests/parcours.sql`: pgTAP, 205 assertions covering RLS as user, anonymous user, admin and service role, the queue functions, the hook and the storage policy. Runs with `supabase test db` on a local stack.
- `config.toml`: local stack settings, anonymous sign-in on, manual identity linking on, the hook registered for local runs.

## Status

The project exists since 2026-09-06 (ref `gnabuebxleogsuhvdgpk`, eu-west-1, dedicated account join.leq@gmail.com). The socle migration and the seed are applied, the auth settings are pushed from `config.toml`, and the 133 assertions of `tests/socle.sql` pass against the hosted database. The SQL was reviewed by reading only; the first `db push` is the first real test, and `supabase test db` needs Docker (OrbStack or Docker Desktop) for the local stack.

## Apply to the hosted project

```bash
npx supabase login                                       # once, opens the browser
npx supabase link --project-ref <ref>
npx supabase db push --include-seed                      # migrations in order, then seed.sql (idempotent)
```

Then push the auth settings from `config.toml` (anonymous sign-ins, manual linking, the access token hook, redirect URLs, email confirmations):

```bash
npx supabase config push --yes
```

Without a terminal attached, `config push` applies immediately and does not ask; run it only after reading the diff it prints in an interactive shell. It also pushes the `[api]` section, so keep `schemas` to `public` and `graphql_public`. Finally check Database > Extensions shows `pg_cron` on and Integrations > Cron lists the three `leq_*` schedules.

## Give Rebecca the admin role

As `postgres` in the SQL editor, after her user exists:

```sql
update public.profils set role = 'admin' where id = '<her auth user id>';
```

A trigger refuses that change from any signed-in client; only a direct connection or the service role can make it. She signs out and back in to get a token with the role.

## Seed

`npx supabase db push --include-seed` is supposed to apply `seed.sql`; on 2026-09-06 it reported the seed applied without inserting the new rows. `node supabase/scripts/appliquer-seed.mjs` (with `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` in the environment) applies it directly and prints the row counts. The seed is idempotent.

## Tests

Against the hosted project, inside one transaction that is rolled back (nothing persists, including the `pgtap` extension it creates):

```bash
set -a; . ./.env; set +a      # SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF=gnabuebxleogsuhvdgpk node supabase/tests/executer-distant.mjs supabase/tests/socle.sql
```

The runner tries the direct host, then the session poolers of the region; on this Mac the direct host does not resolve (IPv6 only) and `aws-1-eu-west-1.pooler.supabase.com` works. Hosted projects refuse direct deletes on `storage.objects`, which is why the suite checks policies instead of attempting a delete.

Local stack (needs Docker):

```bash
npx supabase start
npx supabase db reset       # migrations then seed
npx supabase test db        # the same pgTAP file
```
