/**
 * Deletes an auth user by address, after showing what is attached to it.
 *
 * It prints the counts and refuses unless `--confirmer` is passed, because deleting a person's
 * account cascades to their takes, their evaluations and their history: there is no undo, and
 * the one time this is needed is the one time a mistake is expensive.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
 *   node supabase/tests/supprimer-compte.mjs <email> [--confirmer]
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const email = process.argv[2]
const confirme = process.argv.includes('--confirmer')
if (!email) throw new Error('usage : supprimer-compte.mjs <email> [--confirmer]')

const client = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
const { rows } = await client.query(
  `select u.id, u.email, u.created_at, p.role,
          (select count(*) from public.tentatives t where t.utilisateur_id = u.id) as prises,
          (select count(*) from public.debats d where d.utilisateur_id = u.id) as debats,
          (select count(*) from public.prises_publiques pp where pp.utilisateur_id = u.id) as publiques,
          (select count(*) from public.mouvements_points m where m.utilisateur_id = u.id) as points
     from auth.users u left join public.profils p on p.id = u.id
    where lower(u.email) = lower($1)`,
  [email],
)
await client.end()

if (rows.length === 0) {
  console.log('aucun compte à cette adresse.')
  process.exit(0)
}
const compte = rows[0]
console.log('compte :', JSON.stringify(compte, null, 1))

const attache =
  Number(compte.prises) + Number(compte.debats) + Number(compte.publiques) + Number(compte.points)
if (!confirme) {
  console.log(`\nRien n'est supprimé. Relance avec --confirmer si c'est bien ce compte.`)
  console.log(
    attache > 0 ? `Attention : ${attache} lignes y sont attachées.` : 'Rien ne lui est attaché.',
  )
  process.exit(0)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { error } = await supabase.auth.admin.deleteUser(compte.id)
if (error) throw error
console.log('compte supprimé :', compte.email)
