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

/**
 * What a duel tells its two sides (chapter 11, 2026-09-18). Social events of chapter 12: they
 * reach the people who keep `notif_social` on. Each names the other person, or says « ton
 * adversaire » when the profile carries no first name. The verdict is told without the outcome:
 * who won is read on the screen, with the two takes beside it.
 */
export function messageDuelRejoint(prenom: string | null) {
  return {
    titre: prenom ? `${prenom} a rejoint ton duel` : 'Ton adversaire a rejoint le duel',
    corps: 'À vous deux de parler.',
  } as const
}

export function messageDuelRepondu(prenom: string | null) {
  return {
    titre: prenom ? `${prenom} a répondu` : 'Ton adversaire a répondu',
    corps: 'À toi de parler. Tu entendras sa réponse après la tienne.',
  } as const
}

export function messageDuelVerdict(prenom: string | null) {
  return {
    titre: 'Le duel est terminé',
    corps: prenom
      ? `${prenom} et toi avez parlé. Le verdict t'attend dans LEQ.`
      : "Vous avez parlé tou·te·s les deux. Le verdict t'attend dans LEQ.",
  } as const
}

export function messageDuelExpire(prenom: string | null, jaiParle: boolean) {
  return {
    titre: 'Le duel a expiré',
    corps: jaiParle
      ? prenom
        ? `${prenom} n'a pas répondu à temps.`
        : "Ton adversaire n'a pas répondu à temps."
      : "Tu n'as pas répondu à temps.",
  } as const
}

/** How a closed duel ended, read from one side. */
export const ISSUES_DUEL_POUR_MOI = [
  'gagne',
  'perdu',
  'egalite',
  'sans_verdict',
  'expire_sans_reponse',
  'expire_sans_ma_reponse',
] as const
export type IssueDuelPourMoi = (typeof ISSUES_DUEL_POUR_MOI)[number]

/**
 * The e-mail to an invitee who answered by the link and has no app: the page asked for their
 * address « pour te dire qui a gagné », and this is that promise kept. The link opens the duel
 * in the same browser, where both takes can be heard.
 */
export function courrielDuelTermine(duel: {
  prenom: string | null
  autre: string | null
  sujet: string
  issue: IssueDuelPourMoi
  lien: string
}): { sujet: string; texte: string } {
  const autre = duel.autre ?? 'ton adversaire'
  const salut = duel.prenom ? `Bonjour ${duel.prenom},` : 'Bonjour,'
  const issue =
    duel.issue === 'gagne'
      ? 'Tu gagnes.'
      : duel.issue === 'perdu'
        ? `${autre} gagne.`
        : duel.issue === 'egalite'
          ? 'Égalité.'
          : duel.issue === 'sans_verdict'
            ? "La grille de Rebecca n'est pas encore en place : ce duel reste sans verdict."
            : duel.issue === 'expire_sans_reponse'
              ? `${autre} n'a pas répondu à temps.`
              : "Tu n'as pas répondu à temps."
  const suite =
    duel.issue === 'gagne' ||
    duel.issue === 'perdu' ||
    duel.issue === 'egalite' ||
    duel.issue === 'sans_verdict'
      ? `Vous pouvez réécouter vos deux réponses en ouvrant le lien sur le même appareil : ${duel.lien}`
      : null
  return {
    sujet: `Ton duel avec ${autre} est terminé`,
    texte: [
      salut,
      '',
      `Le duel « ${duel.sujet} » est terminé. ${issue}`,
      ...(suite ? ['', suite] : []),
      '',
      "Le verdict est rendu par l'analyse, sur les critères de Rebecca.",
      '',
      'LEQ',
    ].join('\n'),
  }
}
