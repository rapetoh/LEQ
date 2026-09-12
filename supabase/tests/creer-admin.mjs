/**
 * Creates (or repairs) an administrator of the space: the auth user, a confirmed e-mail, a
 * password, and the `admin` role on the profile. A trigger refuses that role change from any
 * signed-in client, so it is done here with a direct connection.
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... SUPABASE_PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
 *   node supabase/tests/creer-admin.mjs <email> <mot-de-passe>
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const [email, motDePasse] = process.argv.slice(2)
if (!email || !motDePasse) throw new Error('usage : creer-admin.mjs <email> <mot-de-passe>')

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
  })
  if (error) throw error
  id = data.user.id
  console.log('compte existant mis à jour :', email)
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
