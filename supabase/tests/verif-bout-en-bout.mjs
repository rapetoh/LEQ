/**
 * Le chemin complet d'une prise, contre le projet hébergé.
 *
 * Everything else checks a piece: pgTAP checks the rules, the server tests check the handlers,
 * `verif-medias` checks Storage. This one records, sends and waits, exactly as the phone does,
 * and then asks the only question that matters: is the feedback there and is the audio gone?
 *
 *   URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
 *     SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
 *     node supabase/tests/verif-bout-en-bout.mjs [chemin audio]
 *
 * Without an audio file it speaks one, in French, with the voice of the Mac it runs on. The take
 * it creates is deleted at the end, whatever happened.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const PHRASE =
  "Je me souviens de la première fois où j'ai dû parler devant une salle entière. " +
  "J'avais préparé mes notes, et au moment de commencer, je me suis rendu compte que " +
  'personne ne regardait mes notes. Ils me regardaient, moi. Alors je les ai posées.'
const ATTENTE_MAX_MS = 180_000
const PAS_MS = 3_000

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

/** An m4a the phone would have produced: 22.05 kHz mono AAC, a real French sentence. */
function parlerUnePrise(dossier) {
  const aiff = join(dossier, 'prise.aiff')
  const m4a = join(dossier, 'prise.m4a')
  execFileSync('say', ['-v', 'Thomas', '-o', aiff, PHRASE], { stdio: 'pipe' })
  execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '22050', '-b:a', '32k', m4a],
    { stdio: 'pipe' },
  )
  return m4a
}

const dossier = mkdtempSync(join(tmpdir(), 'leq-bout-en-bout-'))
const fichier = process.argv[2] ?? parlerUnePrise(dossier)
const octets = readFileSync(fichier)
verifier(octets.length > 1000, "la prise existe et n'est pas vide", `${octets.length} octets`)

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
const id = crypto.randomUUID()
const chemin = `${uid}/${id}.m4a`
console.log(`compte ${email} · prise ${id}`)

const base = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdpBase)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await base.connect()

try {
  // 1. The upload, exactly as `televerserPrise` does it: no upsert, the bucket grants insert only.
  const envoi = await supabase.storage
    .from('audio-tentatives')
    .upload(chemin, octets, { contentType: 'audio/mp4', upsert: false })
  verifier(!envoi.error, "l'audio est accepté par le bucket privé", envoi.error?.message ?? '')

  // 2. The row. The trigger behind it is what queues the analysis.
  const maintenant = new Date().toISOString()
  const insertion = await supabase.from('tentatives').insert({
    id,
    utilisateur_id: uid,
    type: 'diagnostic',
    etape_id: null,
    duel_id: null,
    enregistre_le: maintenant,
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    duree_s: 18,
    chemin_audio: chemin,
    statut: 'envoyee',
  })
  verifier(!insertion.error, 'la prise est enregistrée', insertion.error?.message ?? '')

  const { rows: jobs } = await base.query(
    "select statut from public.jobs where cle_idempotence = 'analyser:' || $1",
    [id],
  )
  verifier(jobs.length === 1, "l'analyse est mise en file", jobs[0]?.statut ?? 'aucun job')

  // 3. The wait. The worker runs on Fly; nothing here does its work for it.
  const debut = Date.now()
  let ligne = null
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    const { rows } = await base.query(
      `select statut, resultat, chemin_audio, audio_supprime_le, derniere_erreur,
              essais_techniques
         from public.tentatives where id = $1`,
      [id],
    )
    ligne = rows[0] ?? null
    if (!ligne) break
    if (['retour_disponible', 'echec_technique', 'abandon_technique'].includes(ligne.statut)) break
    process.stdout.write(`\r    ${Math.round((Date.now() - debut) / 1000)} s · ${ligne.statut}   `)
    await new Promise((r) => setTimeout(r, PAS_MS))
  }
  process.stdout.write('\r')
  verifier(
    ligne?.statut === 'retour_disponible',
    "l'analyse aboutit",
    `${ligne?.statut ?? 'disparue'}${ligne?.derniere_erreur ? ` (${ligne.derniere_erreur})` : ''}`,
  )

  // 4. What the pipeline promised: the measures are there, and the voice is not.
  const { rows: analyses } = await base.query(
    `select a.version_schema, a.fournisseur_transcription,
            a.mesures -> 'debit' ->> 'mots_par_minute' as mots_par_minute,
            jsonb_array_length(coalesce(a.mesures -> 'silences' -> 'liste', '[]'::jsonb)) as silences,
            length(a.transcription ->> 'texte') as longueur_transcription
       from public.analyses a where a.tentative_id = $1`,
    [id],
  )
  const analyse = analyses[0]
  verifier(analyse !== undefined, 'les mesures sont écrites', analyse?.fournisseur_transcription)
  verifier(
    Number(analyse?.mots_par_minute) > 0,
    'le débit est mesuré',
    `${analyse?.mots_par_minute} mots/min`,
  )

  const { rows: evaluations } = await base.query(
    'select version_grille, note_totale from public.evaluations where tentative_id = $1',
    [id],
  )
  verifier(
    evaluations.length === 1,
    "l'évaluation est écrite",
    `grille ${evaluations[0]?.version_grille ?? 'aucune'}`,
  )

  verifier(ligne?.chemin_audio === null, "le chemin de l'audio est effacé de la ligne")
  verifier(ligne?.audio_supprime_le !== null, "la suppression de l'audio est datée")

  const { data: restes } = await supabase.storage.from('audio-tentatives').list(uid)
  const encoreLa = (restes ?? []).some((o) => o.name === `${id}.m4a`)
  verifier(!encoreLa, "l'objet audio n'est plus dans le bucket")
} finally {
  await base.query('delete from public.tentatives where id = $1', [id])
  await base.query("delete from public.jobs where cle_idempotence = 'analyser:' || $1", [id])
  await supabase.storage.from('audio-tentatives').remove([chemin])
  await base.end()
  rmSync(dossier, { recursive: true, force: true })
}

console.log(echecs === 0 ? '\nbout en bout : tout passe.' : `\nbout en bout : ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
