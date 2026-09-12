/**
 * Applies supabase/seed.sql to the hosted project, in one transaction.
 *
 * `supabase db push --include-seed` records the seed's hash without running it once the project
 * has been seeded before, so a line added to the file never reaches the database. The seed is
 * idempotent by design (values are never overwritten, only descriptions and types refreshed),
 * so applying it again is safe and is the only way to get a new default in.
 */
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const fichier = process.argv[2] ?? 'supabase/seed.sql'
const client = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
const texte = await readFile(fichier, 'utf8')
await client.connect()
try {
  await client.query('begin')
  await client.query(texte)
  const compte = async (table) =>
    Number((await client.query(`select count(*) as n from public.${table}`)).rows[0].n)
  const resume = {
    configuration: await compte('configuration'),
    sujets_arene: await compte('sujets_arene'),
    theses: await compte('theses'),
    recompenses: await compte('recompenses'),
  }
  await client.query('commit')
  console.log('seed appliqué :', JSON.stringify(resume))
} catch (erreur) {
  await client.query('rollback').catch(() => {})
  throw erreur
} finally {
  await client.end()
}
