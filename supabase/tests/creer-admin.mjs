/**
 * Creates (or repairs) an administrator of the space: the auth user, a confirmed e-mail, a
 * password, the `admin` role on the profile and, optionally, a first name. A trigger refuses
 * that role change from any signed-in client, so it is done here with a direct connection.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
 *   node supabase/tests/creer-admin.mjs <email> <mot-de-passe> [prenom] [--nouvel-email=<adresse>]
 *
 * `--nouvel-email` corrects the address of an existing account, which is what a typo in an
 * e-mail needs: the account keeps its id, its role and its history.
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const arguments_ = process.argv.slice(2)
const nouvelEmail = arguments_.find((a) => a.startsWith('--nouvel-email='))?.split('=')[1] ?? null
const [email, motDePasse, prenom] = arguments_.filter((a) => !a.startsWith('--'))
if (!email || !motDePasse) {
  throw new Error('usage : creer-admin.mjs <email> <mot-de-passe> [prenom] [--nouvel-email=...]')
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: liste, error: erreurListe } = await supabase.auth.admin.listUsers({ perPage: 200 })
if (erreurListe) throw erreurListe
const existant = liste.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

let id
if (existant) {
  const { data, error } = await supabase.auth.admin.updateUserById(existant.id, {
    password: motDePasse,
    email_confirm: true,
    ...(nouvelEmail ? { email: nouvelEmail } : {}),
  })
  if (error) throw error
  id = data.user.id
  console.log('compte existant mis à jour :', nouvelEmail ?? email)
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  })
  if (error) throw error
  id = data.user.id
  console.log('compte créé :', email)
}

const client = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query('begin')
  await client.query("update public.profils set role = 'admin' where id = $1", [id])
  if (prenom) {
    await client.query('update public.profils set prenom = $2 where id = $1', [id, prenom])
  }
  const { rows } = await client.query('select role, prenom from public.profils where id = $1', [id])
  await client.query('commit')
  console.log('profil :', JSON.stringify(rows[0]), '| id :', id)
} catch (erreur) {
  await client.query('rollback').catch(() => {})
  throw erreur
} finally {
  await client.end()
}
console.log('Le rôle arrive dans le jeton à la prochaine connexion.')
