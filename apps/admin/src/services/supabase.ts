import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clePubliable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !clePubliable) {
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont requises. Copie .env.example vers .env.local.',
  )
}

// The client is used without a generated Database type on purpose: every row that enters the
// app goes through a Zod schema in src/modele, which is the contract of docs/DATA-MODEL.md.
export const supabase = createClient(url, clePubliable, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // No OAuth redirect in the admin: email and password only.
    detectSessionInUrl: false,
  },
})
