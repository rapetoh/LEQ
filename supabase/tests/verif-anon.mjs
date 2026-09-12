// Can someone holding only the publishable key, with no account, call these?
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.URL, process.env.CLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const cible = '7f1a6ed7-bf3f-44cf-879b-ba4b8dd6718d'
for (const [nom, args] of [
  ['formule_de', { p_uid: cible }],
  ['sujet_arene_actif', {}],
  ['annonces_du_mois', {}],
  ['a_parle_sur', { p_sujet: '00000000-0000-4000-8000-000000000001' }],
  ['est_suspendu', {}],
  ['tableau_de_bord', {}],
]) {
  const { data, error } = await supabase.rpc(nom, args)
  console.log(
    `${nom.padEnd(20)} ${error ? 'refusé (' + error.code + ')' : 'RÉPOND → ' + JSON.stringify(data).slice(0, 90)}`,
  )
}
