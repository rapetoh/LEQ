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

/**
 * The end of an Arena week (C8). A "social event" of chapter 12, so it only reaches the
 * people who keep `notif_social` on, and only those who spoke that week.
 */
export const MESSAGE_RESULTAT_ARENE = {
  titre: "La semaine de l'Arène est finie",
  corps: 'Les votes sont comptés. Tu peux voir ton classement.',
} as const

/**
 * What the Arena says to a person about their own take (chapter 11, publish on send). These
 * answer the person's own gesture, so they are always on, like the feedback message. The titles
 * are the sentences the Arena tab shows, so the notification and the screen say the same thing.
 */
export const MESSAGE_PRISE_SIGNALEE = {
  titre: 'Ton passage attend une relecture',
  corps: 'Rebecca le relit. Tu seras prévenu·e de sa décision.',
} as const

export const MESSAGE_PRISE_PUBLIEE = {
  titre: 'Ton passage est en ligne',
  corps: "Rebecca l'a publié. Les autres peuvent l'écouter et voter.",
} as const

export const MESSAGE_PRISE_RETIREE = {
  titre: 'Ton passage a été retiré',
  corps: "Il ne figure plus dans l'Arène. Rebecca peut t'en dire la raison par e-mail.",
} as const

/** To every admin with the app, the moment the screening holds a take. */
export const MESSAGE_SIGNALEMENT_ADMIN = {
  titre: 'Une prise est signalée',
  corps: 'Elle attend ta décision dans la modération.',
} as const
