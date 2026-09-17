// The profile picture: chosen in the phone's library, cropped square by the picker, brought down
// to 512 points and compressed on the phone, then put in the public `avatars` bucket under the
// person's own folder. A new object per change, so a cached picture never outlives a change; the
// previous object goes right after. The column holds the path, never a URL.
import { BUCKET_AVATARS } from '@leq/domaine'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

import { supabase } from './supabase'

const COTE = 512
const QUALITE = 0.82

export type ResultatPhoto = 'enregistree' | 'annulee' | 'refusee'

/** The public URL of a picture, or null without one. */
export function urlAvatar(chemin: string | null | undefined): string | null {
  if (!chemin) return null
  return supabase.storage.from(BUCKET_AVATARS).getPublicUrl(chemin).data.publicUrl
}

/**
 * Lets the person pick and crop a picture, then stores it. Answers what happened rather than
 * throwing for the two outcomes that are the person's own (refusing the library, closing the
 * picker); a failure to upload or to write the row does throw.
 */
export async function choisirEtEnregistrerPhoto(
  utilisateurId: string,
  cheminActuel: string | null,
): Promise<ResultatPhoto> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'refusee'

  const choix = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  })
  const image = choix.assets?.[0]
  if (choix.canceled || !image) return 'annulee'

  const contexte = ImageManipulator.manipulate(image.uri)
  contexte.resize({ width: COTE, height: COTE })
  const rendu = await contexte.renderAsync()
  const fichier = await rendu.saveAsync({ format: SaveFormat.JPEG, compress: QUALITE })

  const octets = await (await fetch(fichier.uri)).arrayBuffer()
  const chemin = `${utilisateurId}/${Date.now()}.jpg`
  const televersement = await supabase.storage
    .from(BUCKET_AVATARS)
    .upload(chemin, octets, { contentType: 'image/jpeg', upsert: false })
  if (televersement.error) throw new Error(televersement.error.message)

  const ligne = await supabase
    .from('profils')
    .update({ avatar_chemin: chemin })
    .eq('id', utilisateurId)
  if (ligne.error) {
    // The row did not take the new path: the object must not stay orphaned in the bucket.
    await supabase.storage
      .from(BUCKET_AVATARS)
      .remove([chemin])
      .catch(() => undefined)
    throw new Error(ligne.error.message)
  }
  if (cheminActuel) {
    await supabase.storage
      .from(BUCKET_AVATARS)
      .remove([cheminActuel])
      .catch(() => undefined)
  }
  return 'enregistree'
}

/** Removes the picture: the row first, then the object. */
export async function retirerPhoto(utilisateurId: string, chemin: string): Promise<void> {
  const ligne = await supabase
    .from('profils')
    .update({ avatar_chemin: null })
    .eq('id', utilisateurId)
  if (ligne.error) throw new Error(ligne.error.message)
  await supabase.storage
    .from(BUCKET_AVATARS)
    .remove([chemin])
    .catch(() => undefined)
}
