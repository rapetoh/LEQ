/**
 * Une prise publiée s'entend-elle vraiment ?
 *
 * The Arena asks people to compare two voices, and the duel verdict lets you hear the other one.
 * Both play `prises_publiques.chemin_audio`, which is the copy the worker keeps in the public
 * bucket while the contest runs. Every rule around it is checked in pgTAP, but pgTAP cannot open
 * a file: it can only say that a column is not null. This one downloads the take and looks at
 * the bytes.
 *
 *   URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
 *     SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
 *     node supabase/tests/verif-arene-audible.mjs
 *
 * It records a take, publishes it, plays it, and removes everything it created.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const PHRASE =
  'On me demande si je préfère avoir raison ou être écouté. Je réponds que la question ' +
  "est mal posée : on n'a jamais raison tout seul."
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

const dossier = mkdtempSync(join(tmpdir(), 'leq-arene-'))
const aiff = join(dossier, 'prise.aiff')
const m4a = join(dossier, 'prise.m4a')
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
const id = crypto.randomUUID()
const chemin = `${uid}/${id}.m4a`

const base = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdpBase)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await base.connect()

let cheminPublic = null
try {
  const { data: sujet } = await supabase.rpc('sujet_arene_actif')
  const sujetActif = Array.isArray(sujet) ? sujet[0] : sujet
  verifier(sujetActif?.id !== undefined, "la semaine d'Arène est ouverte", sujetActif?.texte ?? '')
  if (!sujetActif?.id) throw new Error("aucun sujet d'Arène actif")

  const envoi = await supabase.storage
    .from('audio-tentatives')
    .upload(chemin, octets, { contentType: 'audio/mp4', upsert: false })
  verifier(!envoi.error, "la prise d'Arène est envoyée", envoi.error?.message ?? '')

  const insertion = await supabase.from('tentatives').insert({
    id,
    utilisateur_id: uid,
    type: 'arene',
    etape_id: null,
    duel_id: null,
    enregistre_le: new Date().toISOString(),
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    duree_s: 14,
    chemin_audio: chemin,
    statut: 'envoyee',
  })
  verifier(!insertion.error, 'et enregistrée', insertion.error?.message ?? '')

  const debut = Date.now()
  let ligne = null
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    const { rows } = await base.query(
      'select statut, chemin_audio, chemin_audio_public from public.tentatives where id = $1',
      [id],
    )
    ligne = rows[0] ?? null
    if (ligne?.statut === 'retour_disponible') break
    if (ligne && ['echec_technique', 'abandon_technique'].includes(ligne.statut)) break
    await new Promise((r) => setTimeout(r, 3_000))
  }
  verifier(ligne?.statut === 'retour_disponible', "l'analyse aboutit", ligne?.statut ?? 'disparue')

  // The exception of chapter 2: the private object goes, a copy stays for the contest.
  cheminPublic = ligne?.chemin_audio_public ?? null
  verifier(ligne?.chemin_audio === null, "l'enregistrement privé est effacé")
  verifier(cheminPublic !== null, 'une copie est gardée pour le concours', cheminPublic ?? '')

  const { data: publiee, error: erreurPublication } = await supabase.rpc('publier_prise', {
    p_tentative_id: id,
  })
  verifier(!erreurPublication, 'la prise est publiée', erreurPublication?.message ?? '')

  const { rows: prises } = await base.query(
    'select id, contexte, statut, chemin_audio from public.prises_publiques where tentative_id = $1',
    [id],
  )
  verifier(prises.length === 1, "elle apparaît dans l'Arène", prises[0]?.statut ?? '')
  verifier(prises[0]?.chemin_audio === cheminPublic, 'et porte le chemin de la copie')

  // The only question pgTAP cannot answer: does the file open?
  const { data: signee, error: erreurSignature } = await supabase.storage
    .from('audio-public')
    .createSignedUrl(prises[0]?.chemin_audio ?? '', 60)
  verifier(!erreurSignature && Boolean(signee?.signedUrl), 'une URL de lecture est délivrée')

  const reponse = await fetch(signee?.signedUrl ?? '')
  const recu = Buffer.from(await reponse.arrayBuffer())
  verifier(reponse.ok, 'le fichier se télécharge', `HTTP ${reponse.status}`)
  verifier(recu.length > 1000, 'et il a du contenu', `${recu.length} octets`)
  // An MPEG-4 file names its brand in the first box: 'ftyp' at offset 4.
  verifier(recu.subarray(4, 8).toString('latin1') === 'ftyp', "et c'est bien de l'audio")
  verifier(recu.equals(octets), "c'est la prise qui a été enregistrée, octet pour octet")

  void publiee
} catch (erreur) {
  verifier(false, "la prise d'Arène va jusqu'à la lecture", erreur.message)
} finally {
  // The public bucket is the worker's to empty, not a signed-in person's, so the copy is given
  // back the way a closed week gives it back: marked for deletion, then swept. Removing it from
  // here would answer nothing and leave the object behind, which is exactly what it did once.
  if (cheminPublic) {
    await base.query(
      'update public.prises_publiques set date_suppression = now() where tentative_id = $1',
      [id],
    )
    await base.query(
      `insert into public.jobs (type, charge, cle_idempotence)
       values ('supprimer_audio_public', '{}'::jsonb, 'menage:' || $1)
       on conflict (cle_idempotence) do nothing`,
      [id],
    )
    const limite = Date.now() + 60_000
    while (Date.now() < limite) {
      const { rows } = await base.query(
        "select count(*)::int as n from storage.objects where bucket_id = 'audio-public' and name = $1",
        [cheminPublic],
      )
      if (rows[0].n === 0) break
      await new Promise((r) => setTimeout(r, 3_000))
    }
    const { rows: restant } = await base.query(
      "select count(*)::int as n from storage.objects where bucket_id = 'audio-public' and name = $1",
      [cheminPublic],
    )
    verifier(restant[0].n === 0, 'et le balayage reprend la copie quand le concours est fini')
  }
  await base.query('delete from public.prises_publiques where tentative_id = $1', [id])
  await base.query('delete from public.tentatives where id = $1', [id])
  await base.query(
    "delete from public.jobs where cle_idempotence in ('analyser:' || $1, 'menage:' || $1)",
    [id],
  )
  await supabase.storage.from('audio-tentatives').remove([chemin])
  await base.end()
  rmSync(dossier, { recursive: true, force: true })
}

console.log(echecs === 0 ? "\nArène : la prise s'entend." : `\nArène : ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
