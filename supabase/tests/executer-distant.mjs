// Runs a pgTAP file against a remote database and prints the TAP output.
// The test files wrap themselves in begin ... rollback, so nothing persists.
//   node supabase/tests/executer-distant.mjs supabase/tests/socle.sql
// Needs DATABASE_URL, or SUPABASE_DB_PASSWORD plus SUPABASE_PROJECT_REF (tries the direct host,
// then the session poolers of the project's region).
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const fichier = process.argv[2]
if (!fichier) {
  console.error('Usage: node supabase/tests/executer-distant.mjs <fichier.sql>')
  process.exit(2)
}

function candidats() {
  if (process.env.DATABASE_URL) return [process.env.DATABASE_URL]
  const ref = process.env.SUPABASE_PROJECT_REF
  const mdp = process.env.SUPABASE_DB_PASSWORD
  const region = process.env.SUPABASE_REGION ?? 'eu-west-1'
  if (!ref || !mdp)
    throw new Error('DATABASE_URL, or SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD, are required')
  const p = encodeURIComponent(mdp)
  return [
    `postgresql://postgres:${p}@db.${ref}.supabase.co:5432/postgres`,
    `postgresql://postgres.${ref}:${p}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${p}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
  ]
}

async function connecter() {
  let derniere
  for (const url of candidats()) {
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false },
    })
    try {
      await client.connect()
      console.error(`connecté via ${url.replace(/:[^:@/]+@/, ':***@')}`)
      return client
    } catch (erreur) {
      derniere = erreur
      console.error(`échec ${url.replace(/:[^:@/]+@/, ':***@')} : ${erreur.message}`)
    }
  }
  throw derniere
}

const sql = await readFile(fichier, 'utf8')
const client = await connecter()
try {
  const resultats = await client.query(sql)
  const liste = Array.isArray(resultats) ? resultats : [resultats]
  let ok = 0
  let ko = 0
  for (const r of liste) {
    for (const ligne of r.rows ?? []) {
      const texte = Object.values(ligne)[0]
      if (typeof texte !== 'string') continue
      console.log(texte)
      if (/^ok \d/.test(texte)) ok += 1
      if (/^not ok \d/.test(texte)) ko += 1
    }
  }
  console.error(`\n${ok} ok, ${ko} not ok`)
  process.exit(ko === 0 ? 0 : 1)
} finally {
  await client.end()
}
