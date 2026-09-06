/**
 * Table `reponses_accueil`: the three onboarding answers (cahier chapter 3),
 * answered by touch. Codes are fixed here; labels are content the app shows.
 */
import { z } from 'zod'
import { IsoTimestampSchema, UuidSchema } from './primitives.js'

export const CONTEXTES_ACCUEIL = ['travail', 'etudes', 'public', 'quotidien'] as const
export const ContexteAccueilSchema = z.enum(CONTEXTES_ACCUEIL)
export type ContexteAccueil = z.infer<typeof ContexteAccueilSchema>

export const BLOCAGES_ACCUEIL = ['trac', 'mots', 'regard', 'notes'] as const
export const BlocageAccueilSchema = z.enum(BLOCAGES_ACCUEIL)
export type BlocageAccueil = z.infer<typeof BlocageAccueilSchema>

export const OBJECTIFS_ACCUEIL = ['stress', 'clarte', 'rythme', 'presence'] as const
export const ObjectifAccueilSchema = z.enum(OBJECTIFS_ACCUEIL)
export type ObjectifAccueil = z.infer<typeof ObjectifAccueilSchema>

/** French labels, plain and short, in the order the options are shown. */
export const LIBELLES_CONTEXTE: Readonly<Record<ContexteAccueil, string>> = {
  travail: 'Au travail, en réunion ou en présentation',
  etudes: "Dans mes études, à l'oral",
  public: 'Devant un public, sur scène ou en vidéo',
  quotidien: 'Dans la vie de tous les jours',
}

export const LIBELLES_BLOCAGE: Readonly<Record<BlocageAccueil, string>> = {
  trac: 'Le trac juste avant de commencer',
  mots: 'Les mots qui se dérobent en route',
  regard: 'Le regard des autres sur moi',
  notes: 'Tenir sans mes notes',
}

export const LIBELLES_OBJECTIF: Readonly<Record<ObjectifAccueil, string>> = {
  stress: 'Parler sans stress',
  clarte: 'Être plus clair, plus structuré',
  rythme: 'Mon rythme et mes silences',
  presence: 'Ma présence, ma voix',
}

/** The three questions, in the order of the mockup (A3: blocage is question 2 of 3). */
export const QUESTIONS_ACCUEIL = [
  {
    cle: 'contexte',
    question: 'Où prends-tu la parole, le plus souvent ?',
    options: CONTEXTES_ACCUEIL,
    libelles: LIBELLES_CONTEXTE,
  },
  {
    cle: 'blocage',
    question: "Qu'est-ce qui te bloque le plus, quand il faut parler ?",
    options: BLOCAGES_ACCUEIL,
    libelles: LIBELLES_BLOCAGE,
  },
  {
    cle: 'objectif',
    question: "Qu'est-ce que tu veux améliorer en premier ?",
    options: OBJECTIFS_ACCUEIL,
    libelles: LIBELLES_OBJECTIF,
  },
] as const
export type CleQuestionAccueil = (typeof QUESTIONS_ACCUEIL)[number]['cle']

/** A row of `reponses_accueil` as read back from the database. */
export const ReponsesAccueilSchema = z.object({
  utilisateur_id: UuidSchema,
  contexte: ContexteAccueilSchema,
  blocage: BlocageAccueilSchema,
  objectif: ObjectifAccueilSchema,
  cree_le: IsoTimestampSchema,
  modifie_le: IsoTimestampSchema,
})
export type ReponsesAccueil = z.output<typeof ReponsesAccueilSchema>

/** What the phone upserts once the three questions are answered. */
export const NouvellesReponsesAccueilSchema = z.object({
  utilisateur_id: UuidSchema,
  contexte: ContexteAccueilSchema,
  blocage: BlocageAccueilSchema,
  objectif: ObjectifAccueilSchema,
})
export type NouvellesReponsesAccueil = z.infer<typeof NouvellesReponsesAccueilSchema>
