/**
 * Can a published take ever be heard?
 *
 * The Arena asks people to compare two voices and the duel verdict lets you hear the other
 * take. Both read `prises_publiques.chemin_audio`. This walks the real pipeline order and says
 * whether that column can hold anything by the time `publier_prise` runs.
 */
import pg from 'pg'
const c = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
await c.query('begin')

// A take that went all the way through the pipeline, exactly as the worker leaves it.
const uid = '11111111-1111-4111-8111-111111111111'
await c.query(
  `insert into auth.users (id, email, is_anonymous, raw_app_meta_data, raw_user_meta_data)
               values ($1, 'x@test.leq', false, '{}', '{}')`,
  [uid],
)
const {
  rows: [t],
} = await c.query(
  `insert into public.tentatives (id, utilisateur_id, type, enregistre_le, fuseau_horaire,
                                  decalage_minutes, statut, chemin_audio)
   values (gen_random_uuid(), $1, 'arene', now(), 'Europe/Paris', 120, 'envoyee', $2)
   returning id, chemin_audio`,
  [uid, `${uid}/aaaa.m4a`],
)
console.log('1. à l envoi      chemin_audio =', t.chemin_audio)

// The worker deletes the object, nulls the column, then marks the feedback ready.
await c.query(
  `update public.tentatives set statut = 'audio_supprime', chemin_audio = null where id = $1`,
  [t.id],
)
await c.query(`update public.tentatives set statut = 'retour_disponible' where id = $1`, [t.id])
const {
  rows: [apres],
} = await c.query('select statut, chemin_audio from public.tentatives where id = $1', [t.id])
console.log('2. analyse finie  statut =', apres.statut, '| chemin_audio =', apres.chemin_audio)

console.log(
  apres.chemin_audio === null
    ? '\n=> publier_prise copierait NULL : une prise publiée serait muette.'
    : '\n=> le chemin survit.',
)
await c.query('rollback')
await c.end()
