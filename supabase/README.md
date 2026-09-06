# supabase/

The database of record: migrations, seed, database tests and the CLI configuration. Everything implements `docs/DATA-MODEL.md` name for name.

## Layout

- `migrations/20260906000000_socle.sql`: Phase 0 schema, helpers, triggers, the job queue functions, Row Level Security on every table, the access token hook, the two storage buckets and their policies, the pg_cron schedules (guarded when pg_cron is absent).
- `seed.sql`: configuration defaults (idempotent: description and type are refreshed, values never overwritten) and the three flags off.
- `tests/socle.sql`: pgTAP, 96 assertions covering RLS as user, anonymous user, admin and service role, the queue functions, the hook and the storage policy. Runs with `supabase test db` on a local stack.
- `config.toml`: local stack settings, anonymous sign-in on, manual identity linking on, the hook registered for local runs.

## Status

No project exists yet: the organisation is at the free-plan limit of two active projects (see `docs/OPEN-INPUTS.md`). Nothing in this folder has run against a database. The SQL was reviewed by reading only; the first `db push` is the first real test, and `supabase test db` needs Docker (OrbStack or Docker Desktop) for the local stack.

## Apply to the hosted project

```bash
npx supabase login                                       # once, opens the browser
npx supabase link --project-ref <ref>
npx supabase db push --include-seed                      # migrations in order, then seed.sql (idempotent)
```

Then in the dashboard:

1. Authentication > Sign In / Providers: enable anonymous sign-ins; enable manual linking.
2. Authentication > Hooks: Customize Access Token (JWT) Claims, Postgres function `public.hook_jeton_acces`. The migration already grants `supabase_auth_admin` what it needs.
3. Database > Extensions: confirm `pg_cron` is on (the migration enables it when available); check Integrations > Cron shows the three `leq_*` schedules.

## Give Rebecca the admin role

As `postgres` in the SQL editor, after her user exists:

```sql
update public.profils set role = 'admin' where id = '<her auth user id>';
```

A trigger refuses that change from any signed-in client; only a direct connection or the service role can make it. She signs out and back in to get a token with the role.

## Local stack and tests

```bash
npx supabase start          # needs Docker
npx supabase db reset       # migrations then seed
npx supabase test db        # pgTAP
```
