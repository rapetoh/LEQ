/**
 * Un face-à-face entier, contre le serveur déployé.
 *
 * Phase 8 is the only part of the product that lives on a socket, and a socket is exactly what
 * unit tests cannot reach: the conductor is tested against an array, not against Fly. This opens
 * a session the way the app does, speaks two turns, ends it, and then checks what the database
 * kept: the turns in order, the outcome, the quota moved by one, the debriefing queued and
 * written.
 *
 *   URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
 *     SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
 *     SERVEUR=wss://leq-serveur.fly.dev node supabase/tests/verif-face-a-face.mjs
 *
 * The session it opens is deleted at the end, whatever happened, so the month it charges is
 * given back.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import WebSocket from 'ws'

/** A French sentence as 16 kHz mono PCM16, the way the phone sends it. */
function parlerPcm(dossier, nom, phrase) {
  const aiff = join(dossier, `${nom}.aiff`)
  const pcm = join(dossier, `${nom}.pcm`)
  execFileSync('say', ['-v', 'Thomas', '-o', aiff, phrase], { stdio: 'pipe' })
  execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '16000', '-f', 's16le', pcm],
    { stdio: 'pipe' },
  )
  return readFileSync(pcm)
}

const THESE = "Une vérification de bout en bout vaut mieux qu'une relecture."
const ATTENTE_MS = 45_000

const { URL: url, CLE: cle, EMAIL: email, MDP: mdp } = process.env
const serveur = process.env.SERVEUR ?? 'wss://leq-serveur.fly.dev'
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

const supabase = createClient(url, cle, { auth: { persistSession: false } })
const { data: connexion, error: erreurConnexion } = await supabase.auth.signInWithPassword({
  email,
  password: mdp,
})
if (erreurConnexion) {
  console.error(`connexion refusée : ${erreurConnexion.message}`)
  process.exit(1)
}
const jeton = connexion.session.access_token

const base = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdpBase)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await base.connect()

/** The quota as the person sees it, before and after. */
async function quota() {
  const { data, error } = await supabase.rpc('quota_debats')
  if (error) throw new Error(`quota_debats : ${error.message}`)
  return data
}

let debatId = null
try {
  const avant = await quota()
  console.log(
    `compte ${email} · formule ${avant.formule} · ${avant.restants} session(s) restante(s)`,
  )
  if (avant.restants === 0) {
    console.error('aucune session disponible ce mois-ci : rien à vérifier')
    process.exit(1)
  }

  // The app opens the session over RPC, then connects the socket to it.
  const { data: debat, error: erreurOuverture } = await supabase.rpc('ouvrir_debat', {
    p_these_texte: THESE,
    p_ton: 'ferme',
  })
  if (erreurOuverture) throw new Error(`ouvrir_debat : ${erreurOuverture.message}`)
  debatId = debat.id
  verifier(debat.statut === 'ouverte', 'la session est ouverte', `${debat.duree_max_s} s de parole`)

  const recus = []
  const socket = new WebSocket(`${serveur}/debat`)
  const fini = new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error('le serveur ne répond pas')), ATTENTE_MS)
    socket.on('error', rejeter)
    socket.on('close', () => {
      clearTimeout(minuteur)
      resoudre()
    })
    socket.on('message', (brut) => {
      const message = JSON.parse(String(brut))
      recus.push(message)
      if (message.type === 'erreur') {
        clearTimeout(minuteur)
        rejeter(new Error(`${message.code} : ${message.message}`))
      }
    })
  })

  await new Promise((r) => socket.on('open', r))
  socket.send(JSON.stringify({ type: 'bonjour', jeton, debat_id: debatId }))

  /** Waits for the next message of a type, so the script follows the exchange instead of sleeping. */
  const attendre = (type, depuis = 0) =>
    new Promise((resoudre, rejeter) => {
      const minuteur = setTimeout(() => rejeter(new Error(`rien de type ${type}`)), ATTENTE_MS)
      const voir = () => {
        const trouve = recus.slice(depuis).find((m) => m.type === type)
        if (trouve) {
          clearTimeout(minuteur)
          socket.off('message', voir)
          resoudre(trouve)
        }
      }
      socket.on('message', voir)
      voir()
    })

  const pret = await attendre('pret')
  verifier(pret.version === 1, 'le serveur annonce le protocole', `version ${pret.version}`)
  verifier(pret.these === THESE, 'et la thèse que la personne a écrite')
  verifier(
    typeof pret.provisoire === 'boolean',
    'et dit si Rétor tourne sur des bouchons',
    pret.provisoire ? 'bouchons' : 'vrais fournisseurs',
  )

  // Two turns of real speech, 100 ms chunks as the phone sends them. With the real providers
  // this is the whole loop: transcription while speaking, Rétor's answer, Rétor's voice.
  const dossier = mkdtempSync(join(tmpdir(), 'leq-debat-'))
  const phrases = [
    "Je ne suis pas d'accord. Une vérification de bout en bout coûte du temps, et une relecture attentive attrape la plupart des erreurs pour bien moins cher.",
    "Et puis une relecture se fait à deux, ce qui apprend quelque chose aux deux personnes. Une vérification automatique n'apprend rien à personne.",
  ]
  try {
    for (let tour = 1; tour <= 2; tour += 1) {
      const avantTour = recus.length
      const octets = parlerPcm(dossier, `t${tour}`, phrases[tour - 1])
      const debutTour = Date.now()
      for (let i = 0; i < octets.length; i += 3200) {
        socket.send(
          JSON.stringify({
            type: 'audio',
            donnees: octets.subarray(i, i + 3200).toString('base64'),
          }),
        )
        await new Promise((r) => setTimeout(r, 100))
      }
      const finParole = Date.now()
      socket.send(JSON.stringify({ type: 'fin_tour' }))
      const reponse = await attendre('reponse_texte', avantTour)
      const latence = Date.now() - finParole
      verifier(
        typeof reponse.texte === 'string' && reponse.texte.length > 0,
        `Rétor répond au tour ${tour}`,
        `${latence} ms après la fin de parole · « ${reponse.texte.slice(0, 90)} »`,
      )
      verifier(!/[—–’]/.test(reponse.texte), 'sans tiret cadratin ni apostrophe courbe')
      const transcrit = recus
        .slice(avantTour)
        .filter((m) => m.type === 'transcription' && !m.partiel)
        .at(-1)
      verifier(
        transcrit !== undefined && /relecture/i.test(transcrit.texte),
        `et a entendu ce qui a été dit au tour ${tour}`,
        transcrit?.texte.slice(0, 80) ?? 'aucune transcription définitive',
      )
      const audio = await attendre('reponse_audio', avantTour)
      verifier(audio.fin === true || audio.donnees.length > 0, 'et sa voix arrive')
      void debutTour
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }

  socket.send(JSON.stringify({ type: 'terminer' }))
  const termine = await attendre('termine')
  verifier(termine.raison === 'utilisateur', 'la session se termine sur la demande de la personne')
  await fini

  // What the database kept, which is the only thing that survives the socket.
  const { rows: tours } = await base.query(
    'select numero, locuteur, texte from public.tours_debat where debat_id = $1 order by numero',
    [debatId],
  )
  verifier(tours.length === 4, 'quatre tours sont écrits', tours.map((t) => t.locuteur).join(', '))
  verifier(
    tours.every((t, i) => t.numero === i + 1),
    'numérotés dans l’ordre',
  )

  const { rows: lignes } = await base.query(
    'select statut, issue, secondes_parlees, session_id from public.debats where id = $1',
    [debatId],
  )
  verifier(
    lignes[0]?.issue === 'terminee',
    'la session est close comme terminée',
    lignes[0]?.statut,
  )
  verifier(lignes[0]?.session_id === null, 'et ne tient plus aucune connexion')

  const apres = await quota()
  verifier(
    apres.utilises === avant.utilises + 1,
    'le mois compte une session de plus',
    `${avant.utilises} puis ${apres.utilises}`,
  )

  const { rows: jobs } = await base.query(
    "select statut from public.jobs where cle_idempotence = 'debrief:' || $1",
    [debatId],
  )
  verifier(jobs.length === 1, 'le débriefing est mis en file', jobs[0]?.statut ?? 'aucun job')

  // The worker writes it from the transcript; nothing here does its work for it.
  const debut = Date.now()
  let debrief = null
  while (Date.now() - debut < 60_000) {
    const { rows } = await base.query('select debrief from public.debats where id = $1', [debatId])
    debrief = rows[0]?.debrief ?? null
    if (debrief) break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  verifier(debrief !== null, 'et écrit', debrief?.provisoire ? 'provisoire' : 'réel')
} catch (erreur) {
  verifier(false, 'le face-à-face va jusqu’au bout', erreur.message)
} finally {
  if (debatId) {
    await base.query('delete from public.debats where id = $1', [debatId])
    await base.query("delete from public.jobs where cle_idempotence = 'debrief:' || $1", [debatId])
  }
  await base.end()
}

console.log(echecs === 0 ? '\nface-à-face : tout passe.' : `\nface-à-face : ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
