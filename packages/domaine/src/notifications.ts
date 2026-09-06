/**
 * Table `jetons_push` and the notification fields of `profils`.
 */
import { z } from 'zod'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'

export const PLATEFORMES_PUSH = ['ios', 'android'] as const
export const PlateformePushSchema = z.enum(PLATEFORMES_PUSH)
export type PlateformePush = z.infer<typeof PlateformePushSchema>

/** An Expo push token: `ExponentPushToken[...]` or `ExpoPushToken[...]`. */
export const JetonExpoSchema = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, 'Jeton Expo push attendu')

export const JetonPushSchema = z.object({
  id: UuidSchema,
  utilisateur_id: UuidSchema,
  jeton: JetonExpoSchema,
  plateforme: PlateformePushSchema,
  derniere_erreur: z.string().nullable(),
  desactive_le: IsoTimestampSchema.nullable(),
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type JetonPush = z.output<typeof JetonPushSchema>

/** What the phone upserts on `jeton` after registering with Expo. */
export const NouveauJetonPushSchema = z.object({
  utilisateur_id: UuidSchema,
  jeton: JetonExpoSchema,
  plateforme: PlateformePushSchema,
  /** A re-registration reactivates a token the worker had switched off. */
  desactive_le: z.null().default(null),
})
export type NouveauJetonPush = z.output<typeof NouveauJetonPushSchema>

/** The four independent switches of cahier chapter 12, stored on `profils`. */
export const CLES_NOTIFICATIONS = [
  'notif_rappel',
  'notif_serie',
  'notif_social',
  'notif_annonces',
] as const
export type CleNotification = (typeof CLES_NOTIFICATIONS)[number]

export const HeureRappelSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Heure HH:MM attendue')

/** The transactional message sent when an analysis is ready. Always on. */
export const MESSAGE_RETOUR_PRET = {
  titre: 'Ton retour est prêt',
  corps: 'Ta prise a été analysée. Ouvre LEQ pour lire ce que Bulle a entendu.',
} as const
