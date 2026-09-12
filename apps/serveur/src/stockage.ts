// Supabase service-role client: Storage (download, delete) and Auth admin (delete user).
// The secret key never leaves the server.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const BUCKET_AUDIO_TENTATIVES = 'audio-tentatives'
export const BUCKET_AUDIO_PUBLIC = 'audio-public'
export const BUCKETS = [BUCKET_AUDIO_TENTATIVES, BUCKET_AUDIO_PUBLIC] as const

export class ErreurStockage extends Error {
  override name = 'ErreurStockage'
}

export interface Stockage {
  /** Downloads one object as bytes. Throws ErreurStockage when missing. */
  telecharger(bucket: string, chemin: string): Promise<Buffer>
  /** Deletes objects. Missing objects are not an error (idempotent). */
  supprimer(bucket: string, chemins: readonly string[]): Promise<void>
  /** Writes bytes to a bucket. Overwrites, so a retry after a cut is safe. */
  televerser(bucket: string, chemin: string, octets: Buffer, typeMime: string): Promise<void>
}

export interface Comptes {
  /** Deletes an auth user; the database cascades to profils and below. 'inconnu' when already gone. */
  supprimerUtilisateur(id: string): Promise<'supprime' | 'inconnu'>
}

export function creerClientSupabase(url: string, cleSecrete: string): SupabaseClient {
  return createClient(url, cleSecrete, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const TAILLE_LOT_SUPPRESSION = 100

export function creerStockage(client: SupabaseClient): Stockage {
  return {
    async telecharger(bucket, chemin) {
      const { data, error } = await client.storage.from(bucket).download(chemin)
      if (error || !data) {
        throw new ErreurStockage(
          `Download failed for ${bucket}/${chemin}: ${error?.message ?? 'no data'}`,
        )
      }
      return Buffer.from(await data.arrayBuffer())
    },
    async televerser(bucket, chemin, octets, typeMime) {
      const { error } = await client.storage
        .from(bucket)
        .upload(chemin, octets, { contentType: typeMime, upsert: true })
      if (error) {
        throw new ErreurStockage(`Upload failed for ${bucket}/${chemin}: ${error.message}`)
      }
    },
    async supprimer(bucket, chemins) {
      for (let i = 0; i < chemins.length; i += TAILLE_LOT_SUPPRESSION) {
        const lot = chemins.slice(i, i + TAILLE_LOT_SUPPRESSION)
        const { error } = await client.storage.from(bucket).remove(lot)
        if (error) {
          throw new ErreurStockage(
            `Delete failed in ${bucket} (${lot.length} objects): ${error.message}`,
          )
        }
      }
    },
  }
}

export function creerComptes(client: SupabaseClient): Comptes {
  return {
    async supprimerUtilisateur(id) {
      const { error } = await client.auth.admin.deleteUser(id)
      if (!error) return 'supprime'
      if (error.status === 404 || /not found/i.test(error.message)) return 'inconnu'
      throw new ErreurStockage(`Auth user deletion failed for ${id}: ${error.message}`)
    },
  }
}
