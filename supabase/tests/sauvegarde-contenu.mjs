/**
 * La sauvegarde du seul contenu qui ne se retrouve nulle part ailleurs.
 *
 * The schema is the migrations, and they are in git: an empty project becomes this one with
 * `supabase db push`. People's takes and results are what the hosting provider's own backups are
 * for. What sits between the two is Rebecca's work, written in the admin and living only in the
 * database: the grid and its criteria, the challenges, the exercises, the rewards, the Arena
 * subjects, the theses, the workshops, the configuration and the flags. Losing that means asking
 * her to write it all again.
 *
 *   SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp> \
 *     node supabase/tests/sauvegarde-contenu.mjs [fichier.sql]
 *
 * It writes a plain SQL file of inserts, in the order the foreign keys need, then replays it
 * against the database inside a transaction it rolls back, so what it hands over is a file that
 * has been proved to apply and not a file that looks like it would.
 */
import { writeFileSync } from 'node:fs'
import pg from 'pg'

/** In dependency order: a table is listed after everything it points at. */
const TABLES = [
  'configuration',
  'drapeaux',
  'modeles_actes',
  'actes',
  'defis',
  'exercices',
  'recompenses',
  'sujets_arene',
  'theses',
  'ateliers',
  'annonces',
  'grilles',
  'criteres_grille',
]

const ref = process.env.SUPABASE_PROJECT_REF
const mdp = process.env.SUPABASE_DB_PASSWORD
if (!ref || !mdp) {
  console.error('SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD sont nécessaires')
  process.exit(1)
}
const fichier = process.argv[2] ?? `leq-contenu-${new Date().toISOString().slice(0, 10)}.sql`

const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdp)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

/** One value, as SQL. Postgres reads back what it wrote, so the types travel with the literal. */
function litteral(valeur, type) {
  if (valeur === null) return 'null'
  if (type === 'boolean') return valeur ? 'true' : 'false'
  if (['integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'].includes(type)) {
    return String(valeur)
  }
  if (['jsonb', 'json'].includes(type)) return `${quote(JSON.stringify(valeur))}::${type}`
  if (Array.isArray(valeur))
    return `${quote(`{${valeur.map((v) => `"${v}"`).join(',')}}`)}::${type}`
  if (valeur instanceof Date) return `${quote(valeur.toISOString())}::timestamptz`
  return `${quote(String(valeur))}${type === 'uuid' ? '::uuid' : ''}`
}

function quote(texte) {
  return `'${texte.replaceAll("'", "''")}'`
}

const morceaux = [
  '-- Le contenu de LEQ : ce que Rebecca a écrit, et les réglages.',
  `-- Sauvegardé le ${new Date().toISOString()} depuis le projet ${ref}.`,
  '-- Rejouable sur un projet dont les migrations sont déjà appliquées.',
  '',
  'begin;',
  '',
]
const comptes = []

for (const table of TABLES) {
  const { rows: colonnes } = await client.query(
    `select column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table],
  )
  const { rows } = await client.query(`select * from public.${table}`)
  comptes.push([table, rows.length])
  if (rows.length === 0) {
    morceaux.push(`-- public.${table} : vide`, '')
    continue
  }
  const noms = colonnes.map((c) => c.column_name)
  const types = Object.fromEntries(colonnes.map((c) => [c.column_name, c.data_type]))
  morceaux.push(`-- public.${table} : ${rows.length} ligne(s)`)
  for (const ligne of rows) {
    const valeurs = noms.map((n) => litteral(ligne[n], types[n])).join(', ')
    morceaux.push(
      `insert into public.${table} (${noms.join(', ')}) values (${valeurs}) on conflict do nothing;`,
    )
  }
  morceaux.push('')
}

morceaux.push('commit;', '')
const sql = morceaux.join('\n')
writeFileSync(fichier, sql, 'utf8')

// A backup nobody has replayed is a file, not a backup. This one is replayed into empty tables
// shaped exactly like the real ones, inside a transaction that is rolled back: the literals have
// to parse and every column has to accept them, and nothing in production is so much as read
// with a lock.
let erreurRejeu = null
try {
  await client.query('begin')
  await client.query(`set local statement_timeout = '120s'`)
  await client.query('create schema rejeu_sauvegarde')
  for (const table of TABLES) {
    await client.query(
      `create table rejeu_sauvegarde.${table}
         (like public.${table} including defaults including generated)`,
    )
  }
  await client.query(
    sql
      .replaceAll('public.', 'rejeu_sauvegarde.')
      .replace(/^begin;$/m, '')
      .replace(/^commit;$/m, ''),
  )
  for (const [table, attendu] of comptes) {
    const { rows } = await client.query(`select count(*)::int as n from rejeu_sauvegarde.${table}`)
    if (rows[0].n !== attendu) {
      erreurRejeu = `${table} : ${rows[0].n} ligne(s) rejouée(s) pour ${attendu} attendue(s)`
      break
    }
  }
} catch (erreur) {
  erreurRejeu = erreur.message
} finally {
  await client.query('rollback')
}

for (const [table, n] of comptes) console.log(`${table.padEnd(18)} ${n}`)
console.log(`\nfichier : ${fichier}`)
if (erreurRejeu) {
  console.error(`rejeu en échec : ${erreurRejeu}`)
  await client.end()
  process.exit(1)
}
console.log('rejeu vérifié : le fichier se réapplique et rend les mêmes lignes.')
await client.end()
