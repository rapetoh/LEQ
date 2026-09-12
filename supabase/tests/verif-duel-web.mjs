/**
 * Un duel répondu depuis le navigateur, par quelqu'un qui n'a pas l'application.
 *
 * This is the only path where someone with no account writes audio into the project, and it is
 * the one the invitation link opens (chapter 11, `apps/web`). Everything about it is a rule
 * somebody could get wrong: the token, the slot claimed before the recording is sent, an
 * anonymous principal allowed to upload but not to enter the Arena, the verdict, and the two
 * takes deleted when the duel closes.
 *
 *   URL=<supabase url> CLE=<publishable key> EMAIL=<compte> MDP=<mot de passe> \
 *     SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp base> \
 *     node supabase/tests/verif-duel-web.mjs
 *
 * EMAIL is the person who sends the invitation, from the application. The one who answers is
 * created here, anonymous, exactly as the browser creates them. Everything is removed at the end.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const SUJET = "Faut-il répondre à une invitation qu'on n'a pas demandée ?"
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

function parler(dossier, nom, phrase) {
  const aiff = join(dossier, `${nom}.aiff`)
  const m4a = join(dossier, `${nom}.m4a`)
  execFileSync('say', ['-v', nom === 'a' ? 'Thomas' : 'Amelie', '-o', aiff, phrase], {
    stdio: 'pipe',
  })
  execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', aiff, '-ac', '1', '-ar', '22050', '-b:a', '32k', m4a],
    { stdio: 'pipe' },
  )
  return readFileSync(m4a)
}

const dossier = mkdtempSync(join(tmpdir(), 'leq-duel-'))
const voixA = parler(dossier, 'a', "J'ai invité quelqu'un à me contredire, et j'attends.")
const voixB = parler(dossier, 'b', "On m'a envoyé un lien, alors je réponds sans rien installer.")

const base = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdpBase)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await base.connect()

/** Waits for the worker to finish one take. */
async function attendreAnalyse(id) {
  const debut = Date.now()
  while (Date.now() - debut < ATTENTE_MAX_MS) {
    const { rows } = await base.query(
      'select statut, chemin_audio_public from public.tentatives where id = $1',
      [id],
    )
    if (rows[0]?.statut === 'retour_disponible') return rows[0]
    await new Promise((r) => setTimeout(r, 3_000))
  }
  return null
}

let duelId = null
let anonId = null
const tentatives = []

try {
  // The inviter, from the application.
  const app = createClient(url, cle, { auth: { persistSession: false } })
  const { error: erreurConnexion } = await app.auth.signInWithPassword({ email, password: mdp })
  if (erreurConnexion) throw erreurConnexion
  const { data: session } = await app.auth.getUser()
  const inviteurId = session.user.id

  const { data: duel, error: erreurDuel } = await app.rpc('creer_duel', { p_sujet: SUJET })
  verifier(!erreurDuel && Boolean(duel?.jeton), "l'invitation est créée", erreurDuel?.message ?? '')
  if (erreurDuel) throw erreurDuel
  duelId = duel.id

  // The invitee, in a browser, with nothing installed.
  const web = createClient(url, cle, { auth: { persistSession: false } })
  const { data: anonyme, error: erreurAnon } = await web.auth.signInAnonymously()
  verifier(!erreurAnon, 'le navigateur ouvre une session sans compte', erreurAnon?.message ?? '')
  if (erreurAnon) throw erreurAnon
  anonId = anonyme.user.id

  const { data: vu, error: erreurLecture } = await web.rpc('lire_duel_par_jeton', {
    p_jeton: duel.jeton,
  })
  verifier(!erreurLecture && vu?.sujet === SUJET, 'le lien montre le sujet', vu?.sujet ?? '')

  // Answering without saying who you are is refused: the person who invited has to know who came.
  const { error: sansNom } = await web.rpc('rejoindre_duel', { p_jeton: duel.jeton })
  verifier(Boolean(sansNom), 'répondre sans se nommer est refusé', sansNom?.message ?? 'accepté')

  // The order matters: the slot is claimed before anything is recorded, so two people opening
  // the same link do not both spend a take on it.
  const { error: erreurRejoint } = await web.rpc('rejoindre_duel', {
    p_jeton: duel.jeton,
    p_prenom: 'Camille',
    p_email: 'camille@essai.leq',
  })
  verifier(!erreurRejoint, 'la place est prise', erreurRejoint?.message ?? '')

  const { rows: apresRejoint } = await base.query(
    'select invite_id, statut from public.duels where id = $1',
    [duelId],
  )
  verifier(apresRejoint[0]?.invite_id === anonId, 'et le duel connaît son invité')

  // An anonymous principal may answer a duel. It may not enter the Arena: that needs an account.
  const { error: erreurArene } = await web.rpc('publier_prise', {
    p_tentative_id: '00000000-0000-4000-8000-000000000000',
  })
  verifier(Boolean(erreurArene), "et il n'obtient rien sur une prise qui n'est pas la sienne")

  // Both takes, sent the way each side sends them.
  for (const [client, uid, octets, quoi] of [
    [app, inviteurId, voixA, "l'invitant"],
    [web, anonId, voixB, "l'invité"],
  ]) {
    const id = crypto.randomUUID()
    tentatives.push({ id, uid })
    const chemin = `${uid}/${id}.m4a`
    const envoi = await client.storage
      .from('audio-tentatives')
      .upload(chemin, octets, { contentType: 'audio/mp4', upsert: false })
    verifier(!envoi.error, `${quoi} envoie sa prise`, envoi.error?.message ?? '')
    const insertion = await client.from('tentatives').insert({
      id,
      utilisateur_id: uid,
      type: 'duel',
      etape_id: null,
      duel_id: duelId,
      enregistre_le: new Date().toISOString(),
      fuseau_horaire: 'Europe/Paris',
      decalage_minutes: 120,
      duree_s: 8,
      chemin_audio: chemin,
      statut: 'envoyee',
    })
    verifier(
      !insertion.error,
      `et elle est enregistrée pour ${quoi}`,
      insertion.error?.message ?? '',
    )
  }

  for (const [i, t] of tentatives.entries()) {
    const ligne = await attendreAnalyse(t.id)
    t.cheminPublic = ligne?.chemin_audio_public ?? null
    verifier(ligne !== null, `la prise ${i + 1} est analysée`)
    verifier(t.cheminPublic !== null, `et sa copie est gardée pour le duel`)
  }

  for (const [client, t, quoi] of [
    [app, tentatives[0], "l'invitant"],
    [web, tentatives[1], "l'invité"],
  ]) {
    const { error } = await client.rpc('publier_prise', { p_tentative_id: t.id })
    verifier(!error, `${quoi} répond`, error?.message ?? '')
  }

  const { rows: passages } = await base.query(
    'select utilisateur_id, chemin_audio from public.prises_publiques where duel_id = $1',
    [duelId],
  )
  verifier(passages.length === 2, 'les deux passages sont là')
  verifier(
    passages.every((p) => p.chemin_audio !== null),
    'et tous les deux ont du son',
  )

  // The verdict, which the app says out loud is automatic and read on Rebecca's grid.
  const { rows: verdict } = await base.query('select public.cloturer_duel($1) as gagnant', [duelId])
  verifier(
    ['inviteur', 'invite', 'egalite', 'sans_verdict'].includes(verdict[0]?.gagnant),
    'le duel se clôt sur un verdict',
    verdict[0]?.gagnant,
  )
  // Until Rebecca publishes her grid there is nothing to compare, and the honest outcome is to
  // say so. What must never happen is `expire`: both of these people spoke.
  verifier(verdict[0]?.gagnant !== 'expire', "et jamais sur « personne n'a répondu »")

  const { rows: apres } = await base.query(
    `select statut, verdict,
            (select count(*)::int from public.prises_publiques
              where duel_id = $1 and date_suppression is null) as sans_date
       from public.duels where id = $1`,
    [duelId],
  )
  verifier(apres[0]?.statut === 'clos', 'le duel est fermé')
  verifier(apres[0]?.sans_date === 0, 'et les deux voix sont datées pour effacement')
} catch (erreur) {
  verifier(false, 'le duel par le navigateur va jusqu’au bout', erreur.message)
} finally {
  // The public copies belong to the worker: Storage refuses a direct delete, and it is right to.
  // A closed duel already dates them, so the sweeper is asked to pass and then waited on.
  const copies = tentatives.map((t) => t.cheminPublic).filter(Boolean)
  if (copies.length > 0) {
    await base.query(
      `update public.prises_publiques set date_suppression = now()
        where duel_id = $1 and date_suppression is null`,
      [duelId],
    )
    await base.query(
      `insert into public.jobs (type, charge, cle_idempotence)
       values ('supprimer_audio_public', '{}'::jsonb, 'menage-duel:' || $1)
       on conflict (cle_idempotence) do nothing`,
      [duelId],
    )
    const limite = Date.now() + 60_000
    while (Date.now() < limite) {
      const { rows } = await base.query(
        `select count(*)::int as n from storage.objects
          where bucket_id = 'audio-public' and name = any($1::text[])`,
        [copies],
      )
      if (rows[0].n === 0) break
      await new Promise((r) => setTimeout(r, 3_000))
    }
    const { rows: reste } = await base.query(
      `select count(*)::int as n from storage.objects
        where bucket_id = 'audio-public' and name = any($1::text[])`,
      [copies],
    )
    verifier(reste[0].n === 0, 'et le balayage les reprend une fois le duel fini')
  }
  for (const t of tentatives) {
    await base.query('delete from public.prises_publiques where tentative_id = $1', [t.id])
    await base.query('delete from public.tentatives where id = $1', [t.id])
    await base.query("delete from public.jobs where cle_idempotence = 'analyser:' || $1", [t.id])
  }
  if (duelId) {
    await base.query('delete from public.duels where id = $1', [duelId])
    await base.query("delete from public.jobs where cle_idempotence = 'menage-duel:' || $1", [
      duelId,
    ])
  }
  if (anonId) await base.query('delete from auth.users where id = $1', [anonId])
  await base.end()
  rmSync(dossier, { recursive: true, force: true })
}

console.log(
  echecs === 0 ? '\nduel par le web : tout passe.' : `\nduel par le web : ${echecs} échec(s).`,
)
process.exit(echecs === 0 ? 0 : 1)
