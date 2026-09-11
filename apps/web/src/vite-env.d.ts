/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined
  /** Store link shown at the end of a duel. Absent means no button, never a dead link. */
  readonly VITE_LIEN_APPLICATION: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
