// Simulates what the phone does with one take against the hosted project, then verifies
// what the worker left behind. Usage, from the repo root with .env loaded:
//   node apps/serveur/scripts/simuler-prise.mjs preparer <fichier.m4a>   (prints {uid,id})
//   node apps/serveur/scripts/simuler-prise.mjs verifier "<json {uid,id}>"
// Needs PUB (publishable key), SUPABASE_DB_PASSWORD, and SUPABASE_SECRET_KEY for the cleanup.
import { readFile } from 'node:fs/promises'
import pg from 'pg'
const URL = 'https://gnabuebxleogsuhvdgpk.supabase.co',
  pub = process.env.PUB,
  etape = process.argv[2]
const p = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)
const db = new pg.Client({
  connectionString: `postgresql://postgres.gnabuebxleogsuhvdgpk:${p}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await db.connect()
if (etape === 'preparer') {
  const r = await fetch(URL + '/auth/v1/signup', {
    method: 'POST',
    headers: { apikey: pub, 'Content-Type': 'application/json' },
    body: '{}',
  })
  const anon = await r.json()
  if (!anon.access_token) {
    console.log('anon KO', anon)
    process.exit(1)
  }
  const uid = anon.user.id,
    id = crypto.randomUUID(),
    chemin = `${uid}/${id}.m4a`
  const octets = await readFile(process.argv[3])
  const up = await fetch(`${URL}/storage/v1/object/audio-tentatives/${chemin}`, {
    method: 'POST',
    headers: {
      apikey: pub,
      Authorization: 'Bearer ' + anon.access_token,
      'Content-Type': 'audio/mp4',
      'x-upsert': 'false',
    },
    body: octets,
  })
  console.log('upload:', up.status, up.status !== 200 ? await up.text() : '')
  const ligne = {
    id,
    utilisateur_id: uid,
    type: 'diagnostic',
    enregistre_le: new Date().toISOString(),
    fuseau_horaire: 'Europe/Paris',
    decalage_minutes: 120,
    duree_s: 66,
    chemin_audio: chemin,
    statut: 'envoyee',
  }
  const ins = await fetch(URL + '/rest/v1/tentatives', {
    method: 'POST',
    headers: {
      apikey: pub,
      Authorization: 'Bearer ' + anon.access_token,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(ligne),
  })
  console.log('insert:', ins.status, ins.status >= 300 ? await ins.text() : '')
  console.log(JSON.stringify({ uid, id }))
} else {
  const { uid, id } = JSON.parse(process.argv[3])
  const t = (
    await db.query(
      'select statut, duree_s, chemin_audio, audio_supprime_le, essais_techniques, derniere_erreur from public.tentatives where id=$1',
      [id],
    )
  ).rows[0]
  console.log('tentative:', JSON.stringify(t))
  const a = (
    await db.query(
      'select fournisseur_transcription, mesures from public.analyses where tentative_id=$1',
      [id],
    )
  ).rows[0]
  if (a) {
    const m = a.mesures
    console.log(
      'analyse:',
      a.fournisseur_transcription,
      '| duree_totale',
      m.duree_totale_s,
      '| debit',
      m.debit.mots_par_minute,
      '| bequilles',
      m.mots_bequilles.total,
      '| silences',
      m.silences.total,
      '/ tenus',
      m.silences.tenus,
      '| f0 median',
      m.hauteur.f0_median_hz,
      '| volume moyen',
      m.volume.moyen_db,
    )
  } else console.log('analyse: absente')
  const e = (
    await db.query(
      'select grille_id, note_totale, sous_notes from public.evaluations where tentative_id=$1',
      [id],
    )
  ).rows[0]
  console.log('evaluation:', JSON.stringify(e))
  const o = (
    await db.query(
      "select count(*)::int as n from storage.objects where bucket_id='audio-tentatives' and name like $1",
      [uid + '/%'],
    )
  ).rows[0]
  console.log('objets audio restants:', o.n)
  const j = (
    await db.query('select statut, essais, erreur from public.jobs where cle_idempotence=$1', [
      'analyser:' + id,
    ])
  ).rows[0]
  console.log('job:', JSON.stringify(j))
  const secret = process.env.SUPABASE_SECRET_KEY
  const del = await fetch(URL + '/auth/v1/admin/users/' + uid, {
    method: 'DELETE',
    headers: { apikey: secret, Authorization: 'Bearer ' + secret },
  })
  console.log('nettoyage utilisateur test:', del.status)
}
await db.end()
