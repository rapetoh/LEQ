/**
 * La copie des données d'une personne (chapitre 2, écran G3).
 *
 * G3 says out loud « Tu recevras une copie de tes données par e-mail ». The request lands in
 * `demandes_export` and the admin space shows it; this is what actually produces the copy, so
 * that the promise is not an empty one. It is deliberately a script and not a button: while the
 * volume is low, a copy leaves only when a person has read the request and sends it.
 *
 *   SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<mdp> \
 *     node supabase/tests/exporter-donnees.mjs <adresse e-mail ou uuid> [dossier]
 *
 * It writes one JSON file and prints where. Read only: it changes nothing, and in particular it
 * does not mark the request handled, because that happens when the copy has actually been sent.
 *
 * What is not in it, and why: no audio, because there is none to give back (every take is
 * deleted once it is measured); nothing belonging to someone else, so a duel carries the two
 * takes and not the other person's account; and the votes someone cast are given without saying
 * which voice they preferred, because anonymity in the Arena holds for the people they compared.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const cible = process.argv[2]
const dossier = process.argv[3] ?? process.cwd()
if (!cible) {
  console.error('usage: node supabase/tests/exporter-donnees.mjs <e-mail ou uuid> [dossier]')
  process.exit(1)
}

const ref = process.env.SUPABASE_PROJECT_REF
const mdp = process.env.SUPABASE_DB_PASSWORD
if (!ref || !mdp) {
  console.error('SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD sont nécessaires')
  process.exit(1)
}

/** Every section of the copy: a name, and the query that fills it for one person. */
const SECTIONS = [
  ['profil', 'select * from public.profils where id = $1'],
  ['reponses_accueil', 'select * from public.reponses_accueil where utilisateur_id = $1'],
  [
    'prises',
    `select t.*, a.mesures, a.transcription, a.fournisseur_transcription,
            e.sous_notes, e.note_totale, e.seuil_reussite, e.points_forts, e.axes_travail,
            e.exercice_court, e.redaction
       from public.tentatives t
       left join public.analyses a on a.tentative_id = t.id
       left join public.evaluations e on e.tentative_id = t.id
      where t.utilisateur_id = $1
      order by t.cree_le`,
  ],
  [
    'parcours',
    `select p.*, (select jsonb_agg(to_jsonb(e) order by e.ordre_global)
                    from public.etapes e where e.parcours_id = p.id) as etapes
       from public.parcours p where p.utilisateur_id = $1`,
  ],
  ['points', 'select * from public.mouvements_points where utilisateur_id = $1 order by cree_le'],
  [
    'recuperations_serie',
    'select * from public.recuperations_serie where utilisateur_id = $1 order by cree_le',
  ],
  [
    'echanges_recompenses',
    'select * from public.echanges_recompenses where utilisateur_id = $1 order by cree_le',
  ],
  [
    'prises_publiques',
    'select * from public.prises_publiques where utilisateur_id = $1 order by cree_le',
  ],
  // The takes they compared belong to other people: the vote is given, the preference is not.
  [
    'votes_emis',
    'select id, sujet_id, paire, cree_le from public.votes where votant_id = $1 order by cree_le',
  ],
  // The duel, without the other person's identifier and without the invitation token: the first
  // belongs to them, and the second would let whoever holds the file answer an open duel.
  [
    'duels',
    `select d.id, d.sujet, d.duree_max_s, d.statut, d.verdict, d.echeance, d.clos_le,
            d.cree_le, d.modifie_le,
            d.inviteur_id = $1 as je_suis_l_inviteur,
            (select jsonb_agg(jsonb_build_object(
               'cree_le', pp.cree_le, 'est_la_mienne', pp.utilisateur_id = $1))
               from public.prises_publiques pp where pp.duel_id = d.id) as passages
       from public.duels d
      where d.inviteur_id = $1 or d.invite_id = $1
      order by d.cree_le`,
  ],
  [
    'debats',
    `select d.*, (select jsonb_agg(to_jsonb(t) order by t.numero)
                    from public.tours_debat t where t.debat_id = d.id) as tours
       from public.debats d where d.utilisateur_id = $1 order by d.commence_le`,
  ],
  ['abonnements', 'select * from public.abonnements where utilisateur_id = $1'],
  [
    'appareils_notifies',
    `select id, plateforme, desactive_le, cree_le from public.jetons_push
      where utilisateur_id = $1`,
  ],
  [
    'demandes_de_copie',
    'select * from public.demandes_export where utilisateur_id = $1 order by cree_le',
  ],
  ['suspensions', 'select * from public.suspensions where utilisateur_id = $1 order by cree_le'],
]

const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(mdp)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const estUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cible)
const { rows: comptes } = await client.query(
  `select id, email, created_at, last_sign_in_at, is_anonymous
     from auth.users where ${estUuid ? 'id = $1::uuid' : 'lower(email) = lower($1)'}`,
  [cible],
)
if (comptes.length === 0) {
  console.error(`aucun compte pour ${cible}`)
  await client.end()
  process.exit(1)
}
const compte = comptes[0]
const uid = compte.id

// One connection runs one query at a time, so the sections are read in order.
const sections = {}
for (const [nom, requete] of SECTIONS) {
  const { rows } = await client.query(requete, [uid])
  sections[nom] = rows
}

const copie = {
  a_propos_de_cette_copie: {
    genere_le: new Date().toISOString(),
    personne: {
      id: uid,
      email: compte.email,
      compte_cree_le: compte.created_at,
      derniere_connexion_le: compte.last_sign_in_at,
      compte_anonyme: compte.is_anonymous,
    },
    audio:
      "Aucun enregistrement n'est joint. Chaque prise est effacée dès qu'elle est mesurée, " +
      'seuls les résultats sont conservés.',
    autres_personnes:
      "Rien qui appartienne à quelqu'un d'autre n'est joint. Un duel donne les deux passages " +
      "sans le compte de l'autre, et les votes émis sont donnés sans dire pour quelle voix.",
  },
  ...sections,
}

const nomFichier = `leq-copie-donnees-${uid}-${new Date().toISOString().slice(0, 10)}.json`
const chemin = join(dossier, nomFichier)
writeFileSync(chemin, JSON.stringify(copie, null, 2), 'utf8')

for (const [nom, lignes] of Object.entries(sections)) {
  console.log(`${nom.padEnd(24)} ${lignes.length}`)
}
console.log(`\ncopie écrite : ${chemin}`)
await client.end()
