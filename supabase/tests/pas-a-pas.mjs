// Debugging aid: runs a SQL file statement by statement inside one transaction (always rolled
// back) and prints the first statement that fails, which the whole-file runner cannot show.
//   set -a; . ./.env; set +a; SUPABASE_PROJECT_REF=<ref> node supabase/tests/pas-a-pas.mjs <fichier.sql>
import { readFile } from 'node:fs/promises'
import pg from 'pg'
const fichier = process.argv[2]
const ref = process.env.SUPABASE_PROJECT_REF,
  mdp = process.env.SUPABASE_DB_PASSWORD
const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdp)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
const texte = await readFile(fichier, 'utf8')
const enonces = []
let courant = '',
  dollars = 0,
  bloc = false
for (const ligne of texte.split('\n')) {
  dollars += (ligne.match(/\$\$/g) ?? []).length
  // A block comment may hold semicolons and $$: never split inside one.
  const ouvertures = (ligne.match(/\/\*/g) ?? []).length
  const fermetures = (ligne.match(/\*\//g) ?? []).length
  if (ouvertures > fermetures) bloc = true
  else if (fermetures > 0) bloc = false
  courant += ligne + '\n'
  if (!bloc && dollars % 2 === 0 && /;\s*$/.test(ligne)) {
    enonces.push(courant)
    courant = ''
  }
}
if (courant.trim()) enonces.push(courant)
await client.connect()
// Everything runs inside one transaction that is always rolled back; the file's own begin/
// rollback lines are skipped so they cannot commit anything.
await client.query('begin')
let ok = 0
try {
  for (const e of enonces) {
    const propre = e.trim()
    if (!propre || (propre.startsWith('--') && !propre.includes('\n'))) {
      if (!propre.replace(/^--.*$/gm, '').trim()) continue
    }
    if (/^\s*(begin|rollback|commit|end)\s*;/i.test(propre)) continue
    try {
      const r = await client.query(propre)
      const lignes = Array.isArray(r) ? r.flatMap((x) => x.rows) : r.rows
      for (const l of lignes) {
        const v = Object.values(l)[0]
        if (typeof v === 'string' && /^(ok|not ok) /.test(v)) {
          ok++
          if (v.startsWith('not ok')) console.log(v)
        }
      }
    } catch (err) {
      console.log('FAILED at statement:\n' + propre.slice(0, 600) + '\n--> ' + err.message)
      break
    }
  }
  console.log('assertions seen:', ok)
} finally {
  await client.query('rollback').catch(() => {})
  await client.end()
}
