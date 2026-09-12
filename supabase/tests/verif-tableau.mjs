import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.URL, process.env.CLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { error: e } = await supabase.auth.signInWithPassword({
  email: process.env.EMAIL,
  password: process.env.MDP,
})
if (e) throw e
const { data, error } = await supabase.rpc('tableau_de_bord')
if (error) throw new Error(error.message)
console.log(JSON.stringify(data, null, 2))
