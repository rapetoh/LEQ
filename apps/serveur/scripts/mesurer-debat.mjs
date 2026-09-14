// One whole face-à-face against the deployed server, measured: what each turn waited for, and
// what the providers consumed. Reads the repository's .env files, opens a session as the
// account they name, speaks until the session's cap, then reads the count the server wrote
// on the row and prices it at the rates read on OpenAI's pricing page (date below).
//
//   node apps/serveur/scripts/mesurer-debat.mjs
//   MESURE_EMAIL=... MESURE_MDP=... node apps/serveur/scripts/mesurer-debat.mjs   # another account
//
// The session is deleted at the end, whatever happened, so the month it charged is given back.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import WebSocket from 'ws'

const racine = new URL('../../../', import.meta.url).pathname
function lireEnv(chemin) {
  try {
    return Object.fromEntries(
      readFileSync(chemin, 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  } catch {
    return {}
  }
}
const env = { ...lireEnv(join(racine, '.env')), ...lireEnv(join(racine, 'apps/mobile/.env')) }
const url = env['EXPO_PUBLIC_SUPABASE_URL']
const cle = env['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
const email = process.env['MESURE_EMAIL'] ?? env['LEQ_ADMIN_EMAIL']
const mdp = process.env['MESURE_MDP'] ?? env['LEQ_ADMIN_PASSWORD']
const mdpBase = env['SUPABASE_DB_PASSWORD']
const ref = process.env['SUPABASE_PROJECT_REF'] ?? 'gnabuebxleogsuhvdgpk'
const serveur = process.env['SERVEUR'] ?? 'wss://leq-serveur.fly.dev'
if (!url || !cle || !email || !mdp || !mdpBase) {
  console.error(
    'il manque EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, LEQ_ADMIN_EMAIL, LEQ_ADMIN_PASSWORD ou SUPABASE_DB_PASSWORD',
  )
  process.exit(1)
}

/**
 * OpenAI's published rates, read on the pricing page on 2026-09-13, in dollars.
 * Per million tokens unless the unit says otherwise.
 */
const TARIFS = {
  date: '2026-09-13',
  transcription: { audio_par_M: 1.25, texte_par_M: 5.0, estimation_par_min: 0.003 },
  texte: { entree_par_M: 0.4, cache_par_M: 0.1, sortie_par_M: 1.6 },
  voix: { texte_par_M: 0.6, audio_par_M: 12.0 },
}
/**
 * The speech endpoint answers with no usage, and the pricing page gives no seconds-to-tokens
 * ratio for its voice. Two bounds, both from OpenAI's own figures: the estimate it once
 * published for gpt-4o-mini-tts ($0.015 a minute, 1 250 audio tokens a minute at $12 a
 * million) and the ratio implied by its transcription estimate ($0.003 a minute at $1.25 a
 * million: 2 400 tokens a minute). The higher bound is the one to price on.
 */
const VOIX_JETONS_PAR_MIN = { bas: 1250, haut: 2400 }

const THESE = "Le télétravail a tué la vie de bureau, et c'est une perte."
/** What the person says, one turn each, about a hundred words: thirty-odd seconds spoken. */
const TOURS = [
  "Je ne suis pas d'accord. La vie de bureau que tu regrettes, c'est surtout des réunions où personne n'écoute et des trajets d'une heure le matin. Depuis que je travaille de chez moi trois jours par semaine, je vois mes collègues moins souvent, mais quand je les vois, on se parle vraiment. On a des déjeuners qui durent, on règle en une heure ce qui traînait pendant des semaines. Le bureau n'est pas mort, il a changé de rôle. Il sert à se retrouver, plus à se surveiller.",
  "Tu parles de perte, mais perte pour qui ? Pour les gens qui habitent loin, le télétravail a rendu possible un emploi qu'ils n'auraient jamais pu prendre. Pour les parents, il a rendu possible d'aller chercher les enfants à l'école. Ce que le bureau offrait, c'était une présence, pas forcément une collaboration. Beaucoup de gens travaillaient à côté les uns des autres sans jamais travailler ensemble. Aujourd'hui, la collaboration se décide, elle ne se subit plus, et c'est un progrès.",
  "Sur la formation des jeunes, je te rejoins à moitié. Oui, un débutant apprend en regardant les autres faire. Mais rien n'oblige à choisir entre tout à distance et tout au bureau. Les équipes qui fonctionnent ont des jours fixes en commun, et ces jours-là sont consacrés à ce qui demande d'être ensemble. Le reste du temps, le débutant lit, essaie, se trompe tranquillement. Ce n'est pas le télétravail qui abandonne les jeunes, c'est l'absence d'organisation, et elle existait déjà avant.",
  "Tu dis que la culture d'entreprise se transmet dans les couloirs. Je pense que c'est une belle histoire qu'on se raconte. La culture, c'est ce que l'entreprise décide de récompenser et de tolérer. Ça se voit dans les décisions, pas dans les conversations à la machine à café. Une équipe à distance qui se dit les choses clairement a plus de culture qu'un open space où tout le monde évite les sujets qui fâchent parce qu'on va se croiser toute la journée.",
  "Et puis regardons le coût. Une entreprise qui garde des bureaux pour tout le monde paie des mètres carrés vides quatre jours sur cinq. Cet argent, elle pourrait le mettre dans des salaires, dans des séminaires, dans des locaux plus petits mais mieux faits. Le télétravail n'a pas tué le bureau, il a révélé que le bureau tel qu'il était coûtait cher pour ce qu'il apportait. Ce constat est désagréable, mais il est juste, et c'est lui que tu refuses de regarder.",
  "Je veux bien admettre une chose : le télétravail mal fait est pire que le bureau mal fait. Quelqu'un qui reste seul chez lui, sans rituel, sans contact, s'épuise. Mais le remède n'est pas de faire revenir tout le monde de force. Le remède, c'est d'apprendre à travailler à distance, avec des règles, des moments de présence choisis, et des managers qui font confiance. Ça demande un effort, et c'est cet effort que les nostalgiques du bureau ne veulent pas fournir.",
  "Tu opposes le lien humain et l'écran. Mais le lien humain ne dépend pas du lieu, il dépend de l'attention. J'ai eu des collègues de bureau que je n'ai jamais vraiment connus, et des collègues à distance avec qui je parle chaque semaine de ce qui compte. La vie de bureau que tu défends, c'est celle des gens qui aiment le bureau. Elle n'a jamais été celle de tout le monde, et le télétravail a simplement donné le choix à ceux qui ne l'aimaient pas.",
  "Enfin, la question n'est même plus de savoir si c'est une perte. Le télétravail est là, les gens le demandent, les entreprises qui le refusent perdent des candidats. Ce qui reste à décider, c'est ce qu'on fait du bureau maintenant qu'il n'est plus obligatoire. Et là je suis optimiste : un lieu où on vient parce qu'on l'a choisi vaut mieux qu'un lieu où on vient parce qu'on y est contraint. Ce n'est pas une perte, c'est une libération qui demande à être organisée.",
  "Pour finir, je dirais que le vrai deuil à faire n'est pas celui du bureau, mais celui du contrôle. Voir les gens à leur poste rassurait certains chefs, et le télétravail leur a retiré cette béquille. Ce qu'on regrette sous le nom de vie de bureau, c'est souvent ça. Une fois qu'on l'a admis, on peut construire autre chose : des équipes jugées sur leur travail, des bureaux pensés pour se rencontrer, et des gens qui ont enfin du temps.",
]

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

const ms = (t) => `${Math.round(t)} ms`
const usd = (x) => `$${x.toFixed(4)}`
let debatId = null
let code = 0
try {
  const { data: quota, error: erreurQuota } = await supabase.rpc('quota_debats')
  if (erreurQuota) throw new Error(`quota_debats : ${erreurQuota.message}`)
  console.log(
    `compte ${email} · formule ${quota.formule} · ${quota.restants} session(s) restante(s)`,
  )
  if (quota.restants === 0) throw new Error('aucune session disponible ce mois-ci')

  const { data: debat, error: erreurOuverture } = await supabase.rpc('ouvrir_debat', {
    p_these_texte: THESE,
    p_ton: 'ferme',
  })
  if (erreurOuverture) throw new Error(`ouvrir_debat : ${erreurOuverture.message}`)
  debatId = debat.id
  console.log(`session ${debatId} · plafond ${debat.duree_max_s} s de parole`)

  const recus = []
  const socket = new WebSocket(`${serveur}/debat`)
  let fermeture
  const fini = new Promise((resoudre, rejeter) => {
    fermeture = resoudre
    socket.on('error', rejeter)
    socket.on('close', resoudre)
    socket.on('message', (brut) => {
      const message = JSON.parse(String(brut))
      message.recu_a = Date.now()
      recus.push(message)
      if (message.type === 'erreur') rejeter(new Error(`${message.code} : ${message.message}`))
    })
  })
  await new Promise((r) => socket.on('open', r))
  socket.send(JSON.stringify({ type: 'bonjour', jeton, debat_id: debatId }))

  const attendre = (critere, depuis, delaiMs = 60_000) =>
    new Promise((resoudre, rejeter) => {
      const minuteur = setTimeout(() => rejeter(new Error('le serveur ne répond plus')), delaiMs)
      const voir = () => {
        const trouve = recus.slice(depuis).find(critere)
        if (trouve) {
          clearTimeout(minuteur)
          socket.off('message', voir)
          resoudre(trouve)
        }
      }
      socket.on('message', voir)
      voir()
    })

  const pret = await attendre((m) => m.type === 'pret', 0)
  if (pret.provisoire) throw new Error('le serveur tourne sur des bouchons : rien à mesurer')

  const dossier = mkdtempSync(join(tmpdir(), 'leq-mesure-'))
  const lignes = []
  let termine = null
  try {
    for (let i = 0; i < TOURS.length && !termine; i += 1) {
      const depuis = recus.length
      const octets = parlerPcm(dossier, `t${i + 1}`, TOURS[i])
      const dureeParole = octets.length / 32_000
      for (let o = 0; o < octets.length; o += 3200) {
        socket.send(
          JSON.stringify({
            type: 'audio',
            donnees: octets.subarray(o, o + 3200).toString('base64'),
          }),
        )
        await new Promise((r) => setTimeout(r, 100))
      }
      const finParole = Date.now()
      socket.send(JSON.stringify({ type: 'fin_tour' }))
      const transcrit = await attendre((m) => m.type === 'transcription' && !m.partiel, depuis)
      termine = recus.slice(depuis).find((m) => m.type === 'termine') ?? null
      if (termine) {
        lignes.push({
          tour: i + 1,
          parole_s: dureeParole,
          transcription_ms: transcrit.recu_a - finParole,
          plafond: true,
        })
        break
      }
      const texte = await attendre((m) => m.type === 'reponse_texte', depuis)
      const premierAudio = await attendre(
        (m) => m.type === 'reponse_audio' && m.donnees.length > 0,
        depuis,
      )
      const finAudio = await attendre(
        (m) => m.type === 'reponse_audio' && m.fin === true,
        depuis,
        90_000,
      )
      const octetsVoix = recus
        .slice(depuis)
        .filter((m) => m.type === 'reponse_audio')
        .reduce((n, m) => n + Buffer.from(m.donnees, 'base64').length, 0)
      lignes.push({
        tour: i + 1,
        parole_s: dureeParole,
        transcription_ms: transcrit.recu_a - finParole,
        texte_ms: texte.recu_a - finParole,
        voix_ms: premierAudio.recu_a - finParole,
        fin_voix_ms: finAudio.recu_a - finParole,
        voix_s: octetsVoix / 48_000,
        mots_retor: texte.texte.split(/\s+/).length,
      })
      console.log(
        `tour ${i + 1} · parlé ${dureeParole.toFixed(1)} s · transcrit ${ms(transcrit.recu_a - finParole)} · texte ${ms(texte.recu_a - finParole)} · voix ${ms(premierAudio.recu_a - finParole)} · fin voix ${ms(finAudio.recu_a - finParole)} · Rétor ${texte.texte.split(/\s+/).length} mots`,
      )
      termine = recus.slice(depuis).find((m) => m.type === 'termine') ?? null
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
  if (!termine) {
    socket.send(JSON.stringify({ type: 'terminer' }))
    termine = await attendre((m) => m.type === 'termine', 0)
  }
  console.log(`session terminée : ${termine.raison}`)
  await fini
  void fermeture

  // The row: what the server counted, then the debrief's share once the worker has written it.
  let ligne = null
  const debut = Date.now()
  while (Date.now() - debut < 120_000) {
    const { rows } = await base.query(
      'select secondes_parlees, duree_max_s, issue, consommation from public.debats where id = $1',
      [debatId],
    )
    ligne = rows[0] ?? null
    if (ligne?.consommation?.debrief) break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  if (!ligne?.consommation)
    throw new Error('le serveur n’a rien compté : la version déployée n’a pas le compteur')
  const c = ligne.consommation
  const parle = Number(ligne.secondes_parlees)

  const t = c.transcription
  const coutTranscription =
    typeof t.jetons_audio === 'number'
      ? (t.jetons_audio * TARIFS.transcription.audio_par_M +
          (t.jetons_texte ?? 0) * TARIFS.transcription.texte_par_M) /
        1e6
      : (t.audio_entree_s / 60) * TARIFS.transcription.estimation_par_min
  const coutTexte = (u) =>
    ((u.jetons_entree - u.jetons_caches) * TARIFS.texte.entree_par_M +
      u.jetons_caches * TARIFS.texte.cache_par_M +
      u.jetons_sortie * TARIFS.texte.sortie_par_M) /
    1e6
  const coutRetor = coutTexte(c.retor)
  const coutDebrief = c.debrief ? coutTexte(c.debrief) : 0
  // The voice bills text tokens in and audio tokens out; the API answers with neither. Text is
  // estimated at four characters a token; audio between the two bounds above.
  const jetonsTexteVoix = c.voix.caracteres / 4
  const coutVoixTexte = (jetonsTexteVoix * TARIFS.voix.texte_par_M) / 1e6
  const coutVoixBas =
    coutVoixTexte +
    ((c.voix.audio_s / 60) * VOIX_JETONS_PAR_MIN.bas * TARIFS.voix.audio_par_M) / 1e6
  const coutVoix =
    coutVoixTexte +
    ((c.voix.audio_s / 60) * VOIX_JETONS_PAR_MIN.haut * TARIFS.voix.audio_par_M) / 1e6
  const total = coutTranscription + coutRetor + coutVoix + coutDebrief

  const med = (xs) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length ? s[Math.floor((s.length - 1) / 2)] : 0
  }
  const repondus = lignes.filter((l) => !l.plafond)
  console.log('\n=== Ce que la session a attendu (depuis la fin de parole) ===')
  console.log(
    `tours répondus : ${repondus.length} · parole totale ${parle.toFixed(1)} s sur ${ligne.duree_max_s} s`,
  )
  console.log(
    `transcription définitive : médiane ${ms(med(repondus.map((l) => l.transcription_ms)))} · max ${ms(Math.max(...repondus.map((l) => l.transcription_ms)))}`,
  )
  console.log(
    `texte de Rétor : médiane ${ms(med(repondus.map((l) => l.texte_ms)))} · max ${ms(Math.max(...repondus.map((l) => l.texte_ms)))}`,
  )
  console.log(
    `premier son de Rétor : médiane ${ms(med(repondus.map((l) => l.voix_ms)))} · max ${ms(Math.max(...repondus.map((l) => l.voix_ms)))}`,
  )
  console.log(`voix de Rétor par tour : médiane ${med(repondus.map((l) => l.voix_s)).toFixed(1)} s`)

  console.log('\n=== Ce que la session a consommé (compté par le serveur) ===')
  console.log(JSON.stringify(c))
  console.log(`\n=== Ce que ça coûte, aux tarifs OpenAI du ${TARIFS.date} ===`)
  console.log(
    `transcription : ${usd(coutTranscription)} (${t.audio_entree_s} s d'audio${typeof t.jetons_audio === 'number' ? `, ${t.jetons_audio} jetons audio` : ', estimation à la minute'})`,
  )
  console.log(
    `Rétor : ${usd(coutRetor)} (${c.retor.appels} appels, ${c.retor.jetons_entree} jetons entrés dont ${c.retor.jetons_caches} en cache, ${c.retor.jetons_sortie} sortis)`,
  )
  console.log(
    `voix : entre ${usd(coutVoixBas)} et ${usd(coutVoix)} (${c.voix.caracteres} caractères, ${c.voix.audio_s} s de voix, borne haute retenue)`,
  )
  console.log(
    `débrief : ${usd(coutDebrief)}${c.debrief ? ` (${c.debrief.jetons_entree} entrés, ${c.debrief.jetons_sortie} sortis)` : ' (pas encore écrit)'}`,
  )
  console.log(
    `total : ${usd(total)} pour ${parle.toFixed(0)} s de parole, soit ${usd((total / parle) * 60)} par minute parlée, ${usd((total / parle) * 300)} pour cinq minutes`,
  )
  console.log(
    '\n' +
      JSON.stringify({
        tarifs: TARIFS,
        tours: lignes,
        consommation: c,
        secondes_parlees: parle,
        plafond_s: ligne.duree_max_s,
        cout_usd: {
          transcription: coutTranscription,
          retor: coutRetor,
          voix_bas: coutVoixBas,
          voix: coutVoix,
          debrief: coutDebrief,
          total,
        },
      }),
  )
} catch (erreur) {
  console.error(`ÉCHEC : ${erreur.message}`)
  code = 1
} finally {
  if (debatId) {
    await base.query('delete from public.debats where id = $1', [debatId])
    await base.query("delete from public.jobs where cle_idempotence = 'debrief:' || $1", [debatId])
  }
  await base.end()
}
process.exit(code)
