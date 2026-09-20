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
  verifier(pret.version === 2, 'le serveur annonce le protocole', `version ${pret.version}`)
  verifier(
    typeof pret.silence_fin_tour_ms === 'number' && pret.silence_fin_tour_ms >= 1000,
    'et dit combien de silence donne la parole',
    `${pret.silence_fin_tour_ms} ms`,
  )
  verifier(pret.these === THESE, 'et la thèse que la personne a écrite')
  verifier(
    typeof pret.provisoire === 'boolean',
    'et dit si Rétor tourne sur des bouchons',
    pret.provisoire ? 'bouchons' : 'vrais fournisseurs',
  )

  // What this checks is the floor, because that is what was broken: a pause inside a turn used
  // to end it at 700 ms, Rétor answered half an argument, and the rest went into a turn that no
  // longer existed. Real speech, real silences, the real providers.
  const dossier = mkdtempSync(join(tmpdir(), 'leq-debat-'))
  /** Sends PCM the way the phone does: 100 ms of audio every 100 ms. */
  const dire = async (octets) => {
    for (let i = 0; i < octets.length; i += 3200) {
      socket.send(
        JSON.stringify({ type: 'audio', donnees: octets.subarray(i, i + 3200).toString('base64') }),
      )
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  /** A real silence, sent as silence: zeros, at the same rate. */
  const seTaire = async (ms) => {
    const vide = Buffer.alloc(3200)
    for (let i = 0; i < Math.round(ms / 100); i += 1) {
      socket.send(JSON.stringify({ type: 'audio', donnees: vide.toString('base64') }))
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  const depuis = (index, type) => recus.slice(index).filter((m) => m.type === type)

  try {
    // Tour 1 : une pause de 1,5 s au milieu de l'argument.
    const avantUn = recus.length
    await dire(parlerPcm(dossier, 't1a', "Je ne suis pas d'accord du tout avec cette idée."))
    // A second of silence, and the phrases themselves carry their own padding: what the server
    // measures is the whole quiet stretch, which is the honest thing to measure.
    await seTaire(1000)
    verifier(
      depuis(avantUn, 'a_retor').length === 0,
      'une pause pour réfléchir ne donne pas la parole à Rétor',
      '1 s de silence au milieu du tour',
    )
    await dire(parlerPcm(dossier, 't1b', 'Une relecture attentive attrape la plupart des erreurs.'))
    const finParole = Date.now()
    socket.send(JSON.stringify({ type: 'fin_tour', raison: 'bouton' }))
    const passage = await attendre('a_retor', avantUn)
    verifier(passage.raison === 'bouton', 'et le bouton la donne quand la personne le décide')
    const reponse = await attendre('reponse_texte', avantUn)
    verifier(
      typeof reponse.texte === 'string' && reponse.texte.length > 0,
      'Rétor répond au premier tour',
      `${Date.now() - finParole} ms après la fin de parole · « ${reponse.texte.slice(0, 70)} »`,
    )
    verifier(!/[—–’]/.test(reponse.texte), 'sans tiret cadratin ni apostrophe courbe')
    const monTour = depuis(avantUn, 'mon_tour').at(-1)
    verifier(
      monTour !== undefined && /relecture/i.test(monTour.texte) && /accord/i.test(monTour.texte),
      "le tour écrit garde les deux moitiés, celle d'avant la pause et celle d'après",
      monTour?.texte.slice(0, 110) ?? 'aucun tour',
    )
    // The clock the person watches has to move while they are speaking, not only between turns.
    const horloge = depuis(avantUn, 'temps')
    verifier(
      horloge.length >= 2 && horloge[0].secondes_restantes > horloge.at(-1).secondes_restantes,
      'le temps de parole descend pendant que la personne parle',
      `${horloge.length} points, de ${horloge[0]?.secondes_restantes} à ${horloge.at(-1)?.secondes_restantes} s`,
    )
    await attendre('a_toi', avantUn)

    // Tour 2 : par défaut, se taire ne donne rien du tout. C'est le cœur de la correction du
    // 19 septembre au soir : personne ne se fait couper la parole sans l'avoir demandé.
    const avantDefaut = recus.length
    await dire(parlerPcm(dossier, 't2a', 'Une relecture apprend quelque chose aux deux.'))
    await seTaire(4000)
    verifier(
      depuis(avantDefaut, 'a_retor').length === 0,
      'sans les mains libres, aucun silence ne donne la parole',
      '4 s de silence, et la parole reste à la personne',
    )

    // Mains libres : là, le silence la donne, et le serveur dit que c'est lui.
    const avantDeux = recus.length
    socket.send(JSON.stringify({ type: 'mains_libres', actif: true }))
    await dire(parlerPcm(dossier, 't2b', "Et puis c'est un échange, pas une vérification."))
    const debutSilence = Date.now()
    await seTaire(4000)
    const seul = depuis(avantDeux, 'a_retor')
    verifier(seul.length === 1, 'un silence qui dure donne la parole, une seule fois')
    verifier(
      seul[0]?.raison === 'silence',
      'et le serveur dit que c’est le silence',
      `${Date.now() - debutSilence} ms après le dernier mot`,
    )
    const audio = await attendre('reponse_audio', avantDeux)
    verifier(audio.fin === true || audio.donnees.length > 0, 'la voix de Rétor arrive')

    // On lui coupe la parole pendant qu'il parle.
    const avantReprise = recus.length
    socket.send(JSON.stringify({ type: 'reprendre_parole' }))
    await attendre('a_toi', avantReprise)
    const apresReprise = recus.length
    await new Promise((r) => setTimeout(r, 1200))
    // The end-of-voice marker still closes the turn; what must stop is the voice itself.
    verifier(
      depuis(apresReprise, 'reponse_audio').every((m) => m.donnees === ''),
      'lui couper la parole arrête sa voix et rend la main',
    )
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
  verifier(
    tours.length === 4,
    'quatre tours sont écrits, dans l’ordre où ils ont été dits',
    tours.map((t) => t.locuteur).join(', '),
  )
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
