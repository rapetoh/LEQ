// Reproduces exactly what the browser does: sign in with the publishable key, then upload.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.URL, process.env.CLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: session, error: erreurAuth } = await supabase.auth.signInWithPassword({
  email: process.env.EMAIL,
  password: process.env.MDP,
})
if (erreurAuth) throw erreurAuth

const jeton = session.session.access_token
const charge = JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString())
console.log('app_metadata du jeton :', JSON.stringify(charge.app_metadata))
console.log('user_role éventuel    :', charge.user_role ?? '(absent)')

const { data: estAdmin, error: erreurAdmin } = await supabase.rpc('est_admin')
console.log('est_admin() côté base :', estAdmin, erreurAdmin?.message ?? '')

const octets = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
for (const upsert of [false, true]) {
  const { error } = await supabase.storage
    .from('medias')
    .upload(`annonces/${crypto.randomUUID()}.png`, octets, {
      contentType: 'image/png',
      upsert,
    })
  console.log(`upload upsert=${upsert} :`, error ? `ÉCHEC → ${error.message}` : 'OK')
}
