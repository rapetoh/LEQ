/**
 * Switches the Arena, duels and face-à-face on for a testing build, activates the first Arena
 * subject, and lets a step validate while no grid can score it, so the path can be walked
 * through.
 *
 * **It also takes the daily and monthly limits off** (2026-09-19, Roch: « stop blocking me now,
 * I'm testing »). A person testing the application hits the free plan's one challenge a day and
 * its one debate a month in the first ten minutes, and then cannot look at anything. Every value
 * below is Rebecca's, and `--eteindre` puts each one back to what it ships as, which is the
 * command to run before the application goes to the store.
 *
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
  // The limits that actually run are the rows of `formules` since 2026-09-12; the configuration
  // keys of the same name only seeded them. Both are moved, so nothing depends on which one a
  // future reader believes.
  const formules = [
    { cle: 'gratuit', essai: { etapes: 0, debats: 50 }, livre: { etapes: 1, debats: 0 } },
    { cle: 'complet', essai: { etapes: 0, debats: 50 }, livre: { etapes: 0, debats: 8 } },
  ]
  for (const formule of formules) {
    const valeurs = eteindre ? formule.livre : formule.essai
    await client.query(
      'update public.formules set etapes_par_jour = $1, debats_par_mois = $2 where cle = $3',
      [valeurs.etapes, valeurs.debats, formule.cle],
    )
  }

  // What a limit is worth while testing, and what it ships as. A zero on a « par jour » key is
  // « no limit » (the Complet plan already uses it that way).
  const limites = [
    { cle: 'quota_face_a_face_gratuit', essai: 50, livre: 0 },
    { cle: 'quota_face_a_face_complet', essai: 50, livre: 8 },
    { cle: 'etapes_par_jour_gratuit', essai: 0, livre: 1 },
    { cle: 'essais_max_etape_par_jour', essai: 50, livre: 3 },
    { cle: 'prises_ecoutees_par_jour', essai: 50, livre: 6 },
  ]
  for (const limite of limites) {
    await client.query(
      'update public.configuration set valeur = to_jsonb($1::int) where cle = $2',
      [eteindre ? limite.livre : limite.essai, limite.cle],
    )
  }
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
    'select cle, valeur from public.configuration where cle = any($1::text[]) order by cle',
    [limites.map((limite) => limite.cle)],
  )
  const droits = await client.query(
    'select cle, etapes_par_jour, debats_par_mois from public.formules order by ordre',
  )
  const sansGrille = await client.query(
    "select valeur from public.configuration where cle = 'validation_sans_grille'",
  )
  await client.query('commit')
  console.log('drapeaux :', drapeaux.rows.map((r) => `${r.cle}=${r.actif}`).join(' '))
  console.log('sujet actif :', sujet.rows[0]?.texte ?? 'aucun')
  for (const ligne of quota.rows) console.log(`${ligne.cle} :`, ligne.valeur)
  for (const ligne of droits.rows) {
    console.log(
      `formule ${ligne.cle} : ${ligne.etapes_par_jour} étape(s)/jour, ${ligne.debats_par_mois} débat(s)/mois`,
    )
  }
  console.log('validation sans grille :', sansGrille.rows[0]?.valeur)
} catch (erreur) {
  await client.query('rollback').catch(() => {})
  throw erreur
} finally {
  await client.end()
}
