# @leq/admin

Rebecca's administration space: a Vite + React single-page app talking to Supabase directly. Row Level Security and the `admin` role carried by the JWT decide what she can change; the interface is a convenience, the database is the guard.

## What exists (Phase 0)

- Login with email and password, session persistence, sign-out.
- A role gate: only a session whose token carries `app_metadata.role = 'admin'` sees the pages.
- Configuration: every row of the `configuration` table, grouped by theme, edited inline with a field of the right type, validated against the contract (`@leq/domaine`), saved row by row with an optimistic update and a French toast.
- Drapeaux: the three feature flags (Arène, duels, face-à-face) with a confirmation before turning one on.
- Home: what is available now and the three spaces that come next (grid, challenges, banks), with no fake data.

## Run

```bash
cp apps/admin/.env.example apps/admin/.env.local   # then fill both values
npm run dev --workspace @leq/admin                  # http://localhost:5174
npm run check --workspace @leq/admin                # typecheck, lint, tests
npm run build --workspace @leq/admin                # static bundle in dist/
```

Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Dashboard > Project Settings). Both are public by design.

## Give Rebecca the admin role

1. Create her user in Supabase Auth (Dashboard > Authentication > Users > Add user, email and password).
2. Run, as `postgres` in the SQL editor:

   ```sql
   update public.profils set role = 'admin' where id = '<her user id>';
   ```

3. She signs out and back in: the access token hook copies the role into her token. See `supabase/README.md` for the hook registration.

## Deploy

The production bundle is one 600 KB chunk (React, supabase-js, TanStack Query, the pages); Vite warns above 500 KB. Acceptable for an admin used by one person; split the pages with dynamic imports when the space grows in Phase 6.

Static hosting is enough: `vercel.json` and `public/_redirects` route every path to `index.html` for Vercel and Cloudflare Pages respectively. Set the two environment variables in the hosting dashboard. Target chosen at Phase 6 when the space is complete; nothing is deployed today.

## Stubs and limits

Nothing is stubbed. The pages for the grid, the challenges and the subject banks arrive in Phases 3, 4 and 6; the home lists them as "Bientôt".
