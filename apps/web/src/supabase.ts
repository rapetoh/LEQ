import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clePubliable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !clePubliable) {
  throw new Error(
    'VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont requises. Copie .env.example vers .env.local.',
  )
}

// The invitee of a duel is identified by an anonymous sign-in: the link works without the app.
export const supabase = createClient(url, clePubliable, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export async function connecterAnonymement(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.id) return data.session.user.id
  const { data: nouvelle, error } = await supabase.auth.signInAnonymously()
  if (error || !nouvelle.session?.user.id) {
    throw new Error(error?.message ?? 'Session impossible')
  }
  return nouvelle.session.user.id
}
