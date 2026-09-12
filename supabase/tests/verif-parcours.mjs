/**
 * La boucle quotidienne, contre la production.
 *
 * This is the product: a challenge for the day, a take, a verdict on it, a step validated, the
 * next one opened, points credited and the streak's day counted. Every rule in it is covered by
 * pgTAP, and the whole chain had never once been run against the hosted project and the worker
 * on Fly. When it was, nothing advanced: no grid is published, so nothing could score a take,
 * and the path stopped at its first challenge in silence.
 *
 *   URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
 *     SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
 *     node supabase/tests/verif-parcours.mjs
 *
 * The take it records is deleted at the end and the step is put back where it was found.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const PHRASE =
  'Le défi du jour me demande de parler une minute sans préparer. Je commence par ce que je ' +
  'sais, et je fais confiance au reste.'
const ATTENTE_MAX_MS = 180_000

const { URL: url, CLE: cle, EMAIL: email, MDP: mdp } = process.env
const ref = process.env.SUPABASE_PROJECT_REF
const mdpBase = process.env.SUPABASE_DB_PASSWORD
if (!url || !cle || !email || !mdp || !ref || !mdpBase) {
  console.error('URL, CLE, EMAIL, MDP, SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD sont requis')
  process.exit(1)
}

let echecs = 0
function verifier(condition, texte, detail = '') {
  console.log(`${condition ? 'ok  ' : 'ÉCHEC'} ${texte}${detail ? ` :: ${detail}` : ''}`)
  if (!condition) echecs += 1
}

const dossier = mkdtempSync(join(tmpdir(), 'leq-parcours-'))
const aiff = join(dossier, 'p.aiff')
const m4a = join(dossier, 'p.m4a')
execFileSync('say', ['-v', 'Thomas', '-o', aiff, PHRASE], { stdio: 'pipe' })
execFileSync(
  'ffmpeg',
  ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '22050', '-b:a', '32k', m4a],
  { stdio: 'pipe' },
)
const octets = readFileSync(m4a)

const supabase = createClient(url, cle, { auth: { persistSession: false } })
const { data: connexion, error: erreurConnexion } = await supabase.auth.signInWithPassword({
  email,
  password: mdp,
})
if (erreurConnexion) {
  console.error(`connexion refusée : ${erreurConnexion.message}`)
  process.exit(1)
}
const uid = connexion.user.id

const base = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdpBase)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await base.connect()

const id = crypto.randomUUID()
const chemin = `${uid}/${id}.m4a`
let etapeId = null
let suivanteId = null

try {
  // The screen of the day asks for this and nothing else.
  const { data: jour, error: erreurJour } = await supabase.rpc('etape_du_jour')
  verifier(!erreurJour, 'le défi du jour est servi', erreurJour?.message ?? '')
  if (erreurJour) throw erreurJour
  etapeId = jour?.etape?.id ?? null
  verifier(etapeId !== null, 'et il porte une étape', jour?.etape?.defi?.titre ?? '')
  verifier(jour?.rythme?.autorise !== false, 'que le rythme du jour autorise')

  const { rows: avant } = await base.query(
    `select e.ordre_global, e.statut,
            (select id from public.etapes s
              where s.parcours_id = e.parcours_id and s.ordre_global = e.ordre_global + 1) as suivante
       from public.etapes e where e.id = $1`,
    [etapeId],
  )
  suivanteId = avant[0]?.suivante ?? null
  verifier(avant[0]?.statut === 'disponible', "l'étape est ouverte", `n° ${avant[0]?.ordre_global}`)

  const { rows: pointsAvant } = await base.query(
    'select coalesce(sum(montant), 0)::int as solde from public.mouvements_points where utilisateur_id = $1',
    [uid],
  )

  const envoi = await supabase.storage
    .from('audio-tentatives')
    .upload(chemin, octets, { contentType: 'audio/mp4', upsert: false })
  verifier(!envoi.error, 'la prise du défi part', envoi.error?.message ?? '')

  const insertion = await supabase.from('tentatives').insert({
    id,
    utilisateur_id: uid,
    type: 'etape',
    etape_id: etapeId,
    duel_id: null,
    enregistre_le: new Date().toISOString(),
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    duree_s: 12,
    chemin_audio: chemin,
    statut: 'envoyee',
  })
  verifier(!insertion.error, 'et elle est enregistrée', insertion.error?.message ?? '')

  const debut = Date.now()
  let ligne = null
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    const { rows } = await base.query(
      'select statut, resultat from public.tentatives where id = $1',
      [id],
    )
    ligne = rows[0] ?? null
    if (ligne?.statut === 'retour_disponible') break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  verifier(ligne?.statut === 'retour_disponible', 'le retour arrive')

  // The one thing that had never happened on this project: a step that moves.
  verifier(
    ligne?.resultat !== null,
    'et le défi reçoit une réponse, au lieu de rien',
    ligne?.resultat ?? 'null',
  )

  const { rows: apres } = await base.query('select statut from public.etapes where id = $1', [
    etapeId,
  ])
  if (ligne?.resultat === 'etape_validee') {
    verifier(apres[0]?.statut === 'validee', "l'étape est validée")
    if (suivanteId) {
      const { rows: s } = await base.query('select statut from public.etapes where id = $1', [
        suivanteId,
      ])
      verifier(s[0]?.statut === 'disponible', "et la suivante s'ouvre")
    }
    const { rows: pointsApres } = await base.query(
      'select coalesce(sum(montant), 0)::int as solde from public.mouvements_points where utilisateur_id = $1',
      [uid],
    )
    verifier(
      pointsApres[0].solde >= pointsAvant[0].solde,
      'les points du défi sont crédités',
      `${pointsAvant[0].solde} puis ${pointsApres[0].solde}`,
    )
  } else {
    verifier(
      ligne?.resultat === 'non_evaluee',
      "l'étape attend la grille, et le dit",
      ligne?.resultat ?? '',
    )
  }

  // Chapter 6: what validates a day is recording, whatever the grid says afterwards.
  const { data: serie, error: erreurSerie } = await supabase.rpc('ma_serie')
  verifier(
    !erreurSerie && serie?.validee_aujourdhui === true,
    'la journée est validée par la prise',
  )
} catch (erreur) {
  verifier(false, 'la boucle quotidienne va jusqu’au bout', erreur.message)
} finally {
  // The step is put back where it was found, with its take and everything the take moved.
  await base.query('delete from public.mouvements_points where reference = $1', [id])
  if (etapeId) {
    await base.query(
      `update public.etapes set statut = 'disponible', validee_le = null,
              tentative_validante_id = null, nombre_echecs = 0, rattrapage_propose = false
        where id = $1`,
      [etapeId],
    )
  }
  if (suivanteId) {
    await base.query(
      "update public.etapes set statut = 'verrouillee' where id = $1 and statut = 'disponible'",
      [suivanteId],
    )
  }
  await base.query('delete from public.tentatives where id = $1', [id])
  await base.query("delete from public.jobs where cle_idempotence = 'analyser:' || $1", [id])
  await base.end()
  rmSync(dossier, { recursive: true, force: true })
}

console.log(echecs === 0 ? '\nparcours : la boucle tourne.' : `\nparcours : ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
