/**
 * « Supprimer mon compte » tient-il sa promesse ?
 *
 * G3 says it plainly: « Ton profil, tes résultats et tes prises en attente sont supprimés. Les
 * prises déjà envoyées dans l'Arène sont retirées. Cette action est définitive. » That is a legal
 * obligation as much as a product one, and the only way to know it holds is to make an account,
 * give it something to lose, delete it from inside the application, and then look everywhere.
 *
 *   URL=<supabase url> CLE=<publishable key> \
 *     SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
 *     node supabase/tests/verif-suppression-compte.mjs
 *
 * It creates a throwaway account, records a take, publishes it in the Arena, asks for deletion
 * the way G3 does, and waits for the worker. Whatever happens, it removes what it made.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const PHRASE = "Je parle une fois, puis je demande que tout soit effacé. C'est mon droit."
const MOT_DE_PASSE = `essai-${crypto.randomUUID()}`
const ATTENTE_MAX_MS = 180_000

const { URL: url, CLE: cle } = process.env
const ref = process.env.SUPABASE_PROJECT_REF
const mdpBase = process.env.SUPABASE_DB_PASSWORD
if (!url || !cle || !ref || !mdpBase) {
  console.error('URL, CLE, SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD sont requis')
  process.exit(1)
}

let echecs = 0
function verifier(condition, texte, detail = '') {
  console.log(`${condition ? 'ok  ' : 'ÉCHEC'} ${texte}${detail ? ` :: ${detail}` : ''}`)
  if (!condition) echecs += 1
}

const dossier = mkdtempSync(join(tmpdir(), 'leq-suppression-'))
const aiff = join(dossier, 'p.aiff')
const m4a = join(dossier, 'p.m4a')
execFileSync('say', ['-v', 'Thomas', '-o', aiff, PHRASE], { stdio: 'pipe' })
execFileSync(
  'ffmpeg',
  ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '22050', '-b:a', '32k', m4a],
  { stdio: 'pipe' },
)
const octets = readFileSync(m4a)

const base = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdpBase)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await base.connect()

const adresse = `essai-suppression-${Date.now()}@leq.invalid`
let uid = null
let chemins = { prive: null, public: null }

try {
  // An account exactly like one created from A7, password sign-in so the script can be it.
  // The empty token columns are not decoration: the auth service reads them as plain strings and
  // refuses the whole schema when they are null.
  const { rows } = await base.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                             email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                             created_at, updated_at, confirmation_token, recovery_token,
                             email_change_token_new, email_change, email_change_token_current,
                             phone_change, phone_change_token, reauthentication_token)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
             'authenticated', $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
             '', '', '', '', '', '', '', '')
     returning id`,
    [adresse, MOT_DE_PASSE],
  )
  uid = rows[0].id
  await base.query(
    `insert into auth.identities (provider_id, user_id, identity_data, provider,
                                  last_sign_in_at, created_at, updated_at)
     values ($1::text, $2::uuid,
             jsonb_build_object('sub', $3::text, 'email', $4::text, 'email_verified', true),
             'email', now(), now(), now())`,
    [uid, uid, uid, adresse],
  )
  verifier(uid !== undefined, 'un compte jetable est créé', adresse)

  const supabase = createClient(url, cle, { auth: { persistSession: false } })
  const { error: erreurConnexion } = await supabase.auth.signInWithPassword({
    email: adresse,
    password: MOT_DE_PASSE,
  })
  verifier(!erreurConnexion, 'il se connecte comme n’importe qui', erreurConnexion?.message ?? '')
  if (erreurConnexion) throw erreurConnexion

  const { rows: profils } = await base.query('select id from public.profils where id = $1', [uid])
  verifier(profils.length === 1, 'son profil existe')

  // Something to lose: a take, analysed, then published in the Arena.
  const id = crypto.randomUUID()
  chemins.prive = `${uid}/${id}.m4a`
  const envoi = await supabase.storage
    .from('audio-tentatives')
    .upload(chemins.prive, octets, { contentType: 'audio/mp4', upsert: false })
  verifier(!envoi.error, 'il enregistre une prise', envoi.error?.message ?? '')

  const insertion = await supabase.from('tentatives').insert({
    id,
    utilisateur_id: uid,
    type: 'arene',
    etape_id: null,
    duel_id: null,
    enregistre_le: new Date().toISOString(),
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    duree_s: 9,
    chemin_audio: chemins.prive,
    statut: 'envoyee',
  })
  verifier(!insertion.error, 'et elle part à l’analyse', insertion.error?.message ?? '')

  const debut = Date.now()
  let ligne = null
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    const { rows: t } = await base.query(
      'select statut, chemin_audio_public from public.tentatives where id = $1',
      [id],
    )
    ligne = t[0] ?? null
    if (ligne?.statut === 'retour_disponible') break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  chemins.public = ligne?.chemin_audio_public ?? null
  verifier(ligne?.statut === 'retour_disponible', 'son retour arrive')

  const { error: erreurPublication } = await supabase.rpc('publier_prise', { p_tentative_id: id })
  verifier(!erreurPublication, "il la publie dans l'Arène", erreurPublication?.message ?? '')

  const { data: objetsAvant } = await supabase.storage.from('audio-public').list(uid)
  verifier((objetsAvant ?? []).length === 1, 'sa voix est dans le concours')

  // G3. Nothing here is privileged: this is the button.
  const { error: erreurDemande } = await supabase.rpc('demander_suppression_compte')
  verifier(!erreurDemande, 'il demande la suppression', erreurDemande?.message ?? '')

  const attente = Date.now()
  let reste = 1
  while (Date.now() - attente < ATTENTE_MAX_MS) {
    const { rows: u } = await base.query(
      'select count(*)::int as n from auth.users where id = $1',
      [uid],
    )
    reste = u[0].n
    if (reste === 0) break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  verifier(reste === 0, 'le compte disparaît', `${Math.round((Date.now() - attente) / 1000)} s`)

  // Everywhere, now.
  const { rows: restes } = await base.query(
    `select
       (select count(*) from public.profils where id = $1) as profil,
       (select count(*) from public.tentatives where utilisateur_id = $1) as prises,
       (select count(*) from public.analyses a
          join public.tentatives t on t.id = a.tentative_id where t.utilisateur_id = $1) as analyses,
       (select count(*) from public.prises_publiques where utilisateur_id = $1) as publiques,
       (select count(*) from public.mouvements_points where utilisateur_id = $1) as points,
       (select count(*) from public.parcours where utilisateur_id = $1) as parcours,
       (select count(*) from storage.objects
          where bucket_id = 'audio-tentatives' and name like $2) as objets_prives,
       (select count(*) from storage.objects
          where bucket_id = 'audio-public' and name like $2) as objets_publics`,
    [uid, `${uid}/%`],
  )
  const r = restes[0]
  for (const [quoi, n] of Object.entries(r)) {
    verifier(Number(n) === 0, `il ne reste rien : ${quoi}`, String(n))
  }
} catch (erreur) {
  verifier(false, 'la suppression va jusqu’au bout', erreur.message)
} finally {
  if (uid) {
    await base.query('delete from public.jobs where charge ->> $1 = $2', ['utilisateur_id', uid])
    await base.query('delete from auth.users where id = $1', [uid])
  }
  await base.end()
  rmSync(dossier, { recursive: true, force: true })
}

console.log(echecs === 0 ? '\nsuppression : rien ne reste.' : `\nsuppression : ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
