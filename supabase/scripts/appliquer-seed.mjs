// Applies supabase/seed.sql to the hosted project through the session pooler.
// `npx supabase db push --include-seed` reported the seed as applied on 2026-09-06 while
// nothing landed; this runs the file directly. The seed is idempotent, so running it twice
// is harmless and never overwrites a value Rebecca changed.
//   set -a; . ./.env; set +a; SUPABASE_PROJECT_REF=<ref> node supabase/scripts/appliquer-seed.mjs
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const ref = process.env.SUPABASE_PROJECT_REF
const mdp = process.env.SUPABASE_DB_PASSWORD
const region = process.env.SUPABASE_REGION ?? 'eu-west-1'
if (!ref || !mdp) throw new Error('SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD are required')
const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdp)}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(await readFile(new URL('../seed.sql', import.meta.url), 'utf8'))
  const { rows } = await client.query(
    'select (select count(*) from public.configuration) as configuration, (select count(*) from public.drapeaux) as drapeaux, (select count(*) from public.modeles_actes) as actes, (select count(*) from public.defis) as defis, (select count(*) from public.exercices) as exercices',
  )
  console.log('seed applied:', JSON.stringify(rows[0]))
} finally {
  await client.end()
}
