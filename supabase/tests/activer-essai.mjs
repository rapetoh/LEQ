/**
 * Switches the Arena, duels and face-à-face on for a testing build, activates the first Arena
 * subject, lets the free plan have one debate, and lets a step validate while no grid can score
 * it, so the path can be walked through.
 *
 * Everything it does is a value Rebecca owns and can change back in the admin in one click.
 * Run it with `node supabase/tests/activer-essai.mjs`, and `--eteindre` to put it all back.
 */
import pg from 'pg'

const eteindre = process.argv.includes('--eteindre')
const ref = process.env.SUPABASE_PROJECT_REF
const mdp = process.env.SUPABASE_DB_PASSWORD
const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdp)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query('begin')
  await client.query(
    "update public.drapeaux set actif = $1 where cle in ('arene', 'duels', 'face_a_face')",
    [!eteindre],
  )
  await client.query(
    "update public.configuration set valeur = to_jsonb($1::int) where cle = 'quota_face_a_face_gratuit'",
    [eteindre ? 0 : 1],
  )
  // Without a published grid nothing can score a take, so a step is never validated and the path
  // stops at its first challenge. This is the stand-in, and it goes back off with everything else
  // the day Rebecca's grid exists.
  await client.query(
    "update public.configuration set valeur = to_jsonb($1::boolean) where cle = 'validation_sans_grille'",
    [!eteindre],
  )
  if (!eteindre) {
    // The rotation job activates the first subject on its next pass; do it now so the Arena is
    // not an empty room while the build is being tested.
    await client.query('select public.roter_sujet_arene()')
  }
  const drapeaux = await client.query('select cle, actif from public.drapeaux order by cle')
  const sujet = await client.query('select texte from public.sujet_arene_actif()')
  const quota = await client.query(
    "select valeur from public.configuration where cle = 'quota_face_a_face_gratuit'",
  )
  const sansGrille = await client.query(
    "select valeur from public.configuration where cle = 'validation_sans_grille'",
  )
  await client.query('commit')
  console.log('drapeaux :', drapeaux.rows.map((r) => `${r.cle}=${r.actif}`).join(' '))
  console.log('sujet actif :', sujet.rows[0]?.texte ?? 'aucun')
  console.log('face-à-face gratuit :', quota.rows[0]?.valeur)
  console.log('validation sans grille :', sansGrille.rows[0]?.valeur)
} catch (erreur) {
  await client.query('rollback').catch(() => {})
  throw erreur
} finally {
  await client.end()
}
