/**
 * Exercises the image pipeline the way the admin does it: sign in as an administrator, upload,
 * read the file back through its public URL, then delete it.
 *
 * It exists because the picker shipped once without anyone ever running an upload through it,
 * and the policy refused every single one. A feature that writes to storage is not finished
 * until something has actually written to storage.
 *
 *   URL=... CLE=... EMAIL=... MDP=... node supabase/tests/verif-medias.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.URL, process.env.CLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const echecs = []
const verifier = (nom, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'NON '} ${nom}${detail ? ' :: ' + detail : ''}`)
  if (!ok) echecs.push(nom)
}

const { data: session, error: erreurAuth } = await supabase.auth.signInWithPassword({
  email: process.env.EMAIL,
  password: process.env.MDP,
})
if (erreurAuth) throw erreurAuth
verifier('un administrateur peut se connecter', Boolean(session.session))

const { data: estAdmin } = await supabase.rpc('est_admin')
verifier('est_admin() répond vrai', estAdmin === true)

// A one-pixel PNG, the smallest thing the bucket accepts.
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

for (const usage of ['annonces', 'ateliers', 'recompenses']) {
  const chemin = `${usage}/verif-${crypto.randomUUID()}.png`
  const { error: erreurEnvoi } = await supabase.storage
    .from('medias')
    .upload(chemin, png, { contentType: 'image/png' })
  verifier(`envoi dans ${usage}`, !erreurEnvoi, erreurEnvoi?.message ?? '')
  if (erreurEnvoi) continue

  const url = `${process.env.URL}/storage/v1/object/public/medias/${chemin}`
  const reponse = await fetch(url)
  verifier(`l'image se lit publiquement (${usage})`, reponse.ok, `HTTP ${reponse.status}`)

  const { error: erreurSuppression } = await supabase.storage.from('medias').remove([chemin])
  verifier(`suppression dans ${usage}`, !erreurSuppression, erreurSuppression?.message ?? '')
}

// What the bucket must refuse, so a wrong file never reaches the phone.
const { error: erreurType } = await supabase.storage
  .from('medias')
  .upload(`annonces/verif-${crypto.randomUUID()}.svg`, new Uint8Array([60, 115]), {
    contentType: 'image/svg+xml',
  })
verifier('un format non accepté est refusé', Boolean(erreurType))

console.log(
  echecs.length === 0 ? '\nmédias : tout passe.' : `\nmédias : ${echecs.length} échec(s).`,
)
process.exit(echecs.length === 0 ? 0 : 1)
