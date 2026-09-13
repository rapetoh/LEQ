// The four OpenAI adapters, each called once against the real API, before the switch is thrown
// in production. Reads OPENAI_API_KEY from the repository's .env.
//
//   node apps/serveur/scripts/verif-openai.mjs
//
// It speaks a French sentence with the Mac's own voice for the transcribers, asks Rétor one
// turn, judges one transcript against two invented axes, and listens to Rétor's voice for the
// first chunk. Every call has to answer in French and in the shape the code expects.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const racine = new URL('../../../', import.meta.url).pathname
const env = Object.fromEntries(
  readFileSync(join(racine, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const cle = env['OPENAI_API_KEY']
if (!cle) {
  console.error('OPENAI_API_KEY absente de .env')
  process.exit(1)
}
const config = { cle }

const dist = join(racine, 'apps/serveur/dist')
const { TranscripteurOpenAI } = await import(join(dist, 'openai/transcripteur.js'))
const { TranscripteurFluxOpenAI } = await import(join(dist, 'openai/flux.js'))
const { AdversaireOpenAI } = await import(join(dist, 'openai/adversaire.js'))
const { VoixOpenAI } = await import(join(dist, 'openai/voix.js'))
const { JugeOpenAI } = await import(join(dist, 'openai/juge.js'))

let echecs = 0
function verifier(condition, texte, detail = '') {
  console.log(`${condition ? 'ok  ' : 'ÉCHEC'} ${texte}${detail ? ` :: ${detail}` : ''}`)
  if (!condition) echecs += 1
}

const PHRASE =
  "Je pense que dire la vérité à tout prix, c'est parfois une façon de se faire plaisir " +
  "à soi-même, euh, plutôt que de rendre service à l'autre."

const dossier = mkdtempSync(join(tmpdir(), 'leq-openai-'))
const aiff = join(dossier, 'p.aiff')
const m4a = join(dossier, 'p.m4a')
const pcm = join(dossier, 'p.pcm')
execFileSync('say', ['-v', 'Thomas', '-o', aiff, PHRASE], { stdio: 'pipe' })
execFileSync('ffmpeg', ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '22050', '-b:a', '32k', m4a], { stdio: 'pipe' })
execFileSync('ffmpeg', ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '16000', '-f', 's16le', pcm], { stdio: 'pipe' })

try {
  // 1. Whisper, on a recorded take: the words with their times.
  const t0 = Date.now()
  const transcription = await new TranscripteurOpenAI(config).transcrire({
    octets: readFileSync(m4a),
    typeMime: 'audio/mp4',
    langue: 'fr',
  })
  verifier(transcription.texte.length > 20, 'Whisper transcrit la prise', `${Date.now() - t0} ms · « ${transcription.texte.slice(0, 70)} »`)
  verifier(transcription.mots.length > 10, 'avec un temps pour chaque mot', `${transcription.mots.length} mots`)
  verifier(/vérité/i.test(transcription.texte), 'et le texte est bien celui qui a été dit')
  verifier(transcription.mots.every((m) => m.fin_s >= m.debut_s), 'et les temps se tiennent')

  // 2. The realtime session, fed the same speech as 16 kHz PCM, the way the phone sends it.
  const flux = new TranscripteurFluxOpenAI(config)
  const octets = readFileSync(pcm)
  const t1 = Date.now()
  const fin = await new Promise((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error('rien en 40 s')), 40_000)
    let partiels = 0
    const session = flux.ouvrir({
      langue: 'fr',
      surSegment: (s) => {
        if (!s.definitif) partiels += 1
      },
      surFinDeTour: (texte) => {
        clearTimeout(minuteur)
        resoudre({ texte, partiels })
      },
    })
    // 100 ms chunks, as the phone does.
    const pas = 3200
    let i = 0
    const envoyer = () => {
      if (i >= octets.length) {
        void session.terminer()
        return
      }
      session.ecrire(octets.subarray(i, i + pas))
      i += pas
      setTimeout(envoyer, 100)
    }
    envoyer()
  })
  verifier(fin.texte.length > 20, 'la session temps réel rend le tour', `${Date.now() - t1} ms · « ${fin.texte.slice(0, 70)} »`)
  verifier(/vérité/i.test(fin.texte), 'et c\'est bien ce qui a été dit')

  // 3. Rétor answers what was just said, in French, briefly.
  const adversaire = new AdversaireOpenAI(config)
  const t2 = Date.now()
  const reponse = await adversaire.repondre({
    these: 'Il faut dire la vérité à tout prix.',
    ton: 'ferme',
    tours: [{ locuteur: 'utilisateur', texte: transcription.texte }],
  })
  verifier(reponse.length > 10 && reponse.split(/\s+/).length <= 60, 'Rétor répond court', `${Date.now() - t2} ms · « ${reponse} »`)
  verifier(!/[—–]/.test(reponse), 'sans tiret cadratin')

  const debrief = await adversaire.debriefer({
    these: 'Il faut dire la vérité à tout prix.',
    ton: 'ferme',
    tours: [
      { locuteur: 'utilisateur', texte: transcription.texte },
      { locuteur: 'retor', texte: reponse },
      { locuteur: 'utilisateur', texte: "Rendre service, c'est justement dire ce que l'autre ne veut pas entendre." },
    ],
  })
  verifier(debrief.moments.length >= 1 && debrief.axe.length > 10, 'et écrit un débrief', `${debrief.moments.length} moment(s) · axe : « ${debrief.axe.slice(0, 80)} »`)
  verifier(debrief.provisoire === false, 'qui est un vrai débrief')

  // 4. The judge, against two invented axes with their two anchors.
  const juge = new JugeOpenAI(config)
  const critere = (cle, nom) => ({
    id: cle, grille_id: 'g', cle, nom, definition: '', ordre: 0, source: 'jugement',
    exemple_cinq: 'Une idée annoncée, un exemple, une conclusion qui reprend l\'idée.',
    exemple_deux: 'Plusieurs idées commencées, aucune finie.',
    regle: { version: 1, score_max: 5, elements: [] },
  })
  const t3 = Date.now()
  const jugement = await juge.juger({
    transcription,
    mesures: {},
    criteres: [critere('structure', 'La structure du propos'), critere('conviction', 'La conviction')],
    criteresCouverts: ['Le débit', 'Les mots béquilles', 'La structure du propos', 'La conviction'],
  })
  verifier(
    typeof jugement.sous_notes.structure?.score === 'number' && typeof jugement.sous_notes.conviction?.score === 'number',
    'le juge note les deux axes',
    `${Date.now() - t3} ms · structure ${jugement.sous_notes.structure?.score}/5 · conviction ${jugement.sous_notes.conviction?.score}/5`,
  )
  verifier(Array.isArray(jugement.hors_grille), 'et dit ce qui tombe hors grille', jugement.hors_grille.map((o) => `${o.sujet} : ${o.remarque}`).join(' | ') || 'rien')

  // 5. The voice: the first chunk has to come fast, and it has to be even-length PCM.
  const voix = new VoixOpenAI(config)
  const t4 = Date.now()
  let premier = null
  let total = 0
  for await (const morceau of voix.dire(reponse)) {
    if (premier === null) premier = Date.now() - t4
    total += morceau.length
    verifier(morceau.length % 2 === 0, 'chaque morceau de voix est un nombre entier d\'échantillons')
    if (total > 200_000) break
  }
  verifier(premier !== null && premier < 4000, 'la voix commence vite', `${premier} ms jusqu\'au premier morceau`)
  verifier(total > 20_000, 'et elle a du contenu', `${total} octets de PCM 24 kHz`)
} catch (erreur) {
  verifier(false, 'les quatre adaptateurs répondent', erreur.message)
} finally {
  rmSync(dossier, { recursive: true, force: true })
}
console.log(echecs === 0 ? '\nopenai : tout passe.' : `\nopenai : ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
