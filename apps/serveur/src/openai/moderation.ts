// The screening of chapter 11, run on the transcript of an Arena or duel take at analysis time:
// sexual content, harassment or threats, hate, violence, self-harm and what is illegal are
// flagged for Rebecca; politics, religion and ethics have no category here and pass. The verdict
// is written next to the transcript, and `publier_prise()` reads it when the person publishes.
//
// OpenAI's moderation endpoint is free and answers in a few hundred milliseconds. Its
// categories are mapped onto the six of the cahier; a category the cahier does not name is
// ignored, so the filter cannot grow stricter than the policy by itself.
import {
  CATEGORIES_MODERATION,
  type CategorieModeration,
  type ModerationTranscription,
} from '@leq/domaine'
import { appelerJson, type ConfigOpenAI } from './client.js'

export interface Moderateur {
  readonly nom: string
  moderer(texte: string): Promise<ModerationTranscription>
}

const MODELE = 'omni-moderation-latest'
const DELAI_MS = 30_000

/** OpenAI's categories, onto the six of chapter 11. Anything absent from this map passes. */
const CORRESPONDANCE: Readonly<Record<string, CategorieModeration>> = {
  sexual: 'sexuel',
  'sexual/minors': 'sexuel',
  harassment: 'harcelement',
  'harassment/threatening': 'harcelement',
  hate: 'haine',
  'hate/threatening': 'haine',
  violence: 'violence',
  'violence/graphic': 'violence',
  'self-harm': 'automutilation',
  'self-harm/intent': 'automutilation',
  'self-harm/instructions': 'automutilation',
  illicit: 'illicite',
  'illicit/violent': 'illicite',
}

interface ReponseModeration {
  results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>
}

/** The verdict from the provider's category map: flagged when any mapped category is true. */
export function verdictDepuisCategories(
  categories: Readonly<Record<string, boolean>>,
  fournisseur: string,
  maintenant: Date = new Date(),
): ModerationTranscription {
  const retenues = new Set<CategorieModeration>()
  for (const [cle, active] of Object.entries(categories)) {
    const categorie = CORRESPONDANCE[cle]
    if (active && categorie) retenues.add(categorie)
  }
  const liste = CATEGORIES_MODERATION.filter((c) => retenues.has(c))
  return {
    version: 1,
    signalee: liste.length > 0,
    categories: liste,
    fournisseur,
    evalue_le: maintenant.toISOString(),
  }
}

export class ModerateurOpenAI implements Moderateur {
  readonly nom = `openai:${MODELE}`

  constructor(private readonly config: ConfigOpenAI) {}

  async moderer(texte: string): Promise<ModerationTranscription> {
    // A silent take has nothing to flag, and nothing worth a request.
    if (texte.trim() === '') return verdictDepuisCategories({}, this.nom)
    const reponse = await appelerJson<ReponseModeration>(
      this.config,
      '/v1/moderations',
      { model: MODELE, input: texte },
      DELAI_MS,
    )
    return verdictDepuisCategories(reponse.results?.[0]?.categories ?? {}, this.nom)
  }
}
