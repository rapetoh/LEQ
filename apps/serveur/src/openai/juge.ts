// The two judged axes of the note, and what fell outside the grid.
//
// The model scores against Rebecca's reference and nothing else: each judged axis comes with
// her two worked examples, one that is worth five and one that is worth two, and the model is
// told to place the take between them. That is what keeps the same take scoring the same twice.
//
// It also reads the whole transcript and says what it noticed that no axis covers. That never
// enters the note, it reaches the person, and it is kept so the grid can grow from what the
// application actually hears.
import type { Mesures } from '../contrat.js'
import type { CritereGrille } from '../db.js'
import type { Juge, Jugement } from '../jobs/analyserTentative.js'
import {
  appelerJson,
  contientFormuleInterdite,
  redresserApostrophes,
  REGLES_ECRITURE,
  type ConfigOpenAI,
} from './client.js'

const MODELE = 'gpt-4.1-mini'

interface ReponseChat {
  choices?: Array<{ message?: { content?: string | null } }>
}

export class JugeOpenAI implements Juge {
  readonly nom = `openai:${MODELE}`

  constructor(private readonly config: ConfigOpenAI) {}

  async juger(contexte: {
    transcription: { texte: string }
    mesures: Mesures
    criteres: readonly CritereGrille[]
    criteresCouverts: readonly string[]
  }): Promise<Jugement> {
    if (contexte.transcription.texte.trim() === '') {
      return { sous_notes: {}, hors_grille: [] }
    }
    const axes = contexte.criteres
      .map(
        (c) => `Axe « ${c.cle} » (${c.nom}), noté de 0 à ${scoreMax(c)} :
${c.definition}
Ce qui vaut ${scoreMax(c)} : ${c.exemple_cinq ?? '(aucun exemple)'}
Ce qui vaut ${Math.round(scoreMax(c) * 0.4)} : ${c.exemple_deux ?? '(aucun exemple)'}`,
      )
      .join('\n\n')

    const systeme = `Tu notes une prise de parole d'entraînement à l'oral, à partir de sa transcription écrite uniquement. Tu n'as pas entendu la voix : tout ce qui concerne le débit, les silences, les mots béquilles, l'énergie de la voix est mesuré ailleurs et n'est pas ton travail.

Tu notes ces axes, chacun contre les deux exemples de référence donnés, en plaçant la prise entre eux. Tu ne notes pas contre ta propre idée d'un bon orateur.

${axes}

Ensuite tu relèves, en une phrase chacune et au plus trois, les choses que tu as remarquées dans le texte et qu'aucun de ces axes ne couvre : ${contexte.criteresCouverts.join(', ')}. Chaque remarque est adressée à la personne, en tutoiement, et dit un fait précis tiré du texte. Si tu n'as rien remarqué, la liste est vide.

${REGLES_ECRITURE}`

    const proprietes: Record<string, unknown> = {}
    for (const c of contexte.criteres) {
      proprietes[c.cle] = { type: 'number', minimum: 0, maximum: scoreMax(c) }
    }

    const lu = await appelerJson<ReponseChat>(
      this.config,
      '/v1/chat/completions',
      {
        model: MODELE,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systeme },
          { role: 'user', content: contexte.transcription.texte },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'jugement',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['notes', 'hors_grille'],
              properties: {
                notes: {
                  type: 'object',
                  additionalProperties: false,
                  required: Object.keys(proprietes),
                  properties: proprietes,
                },
                hors_grille: {
                  type: 'array',
                  maxItems: 3,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['sujet', 'remarque'],
                    properties: {
                      sujet: { type: 'string' },
                      remarque: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      60_000,
    )
    const brut = lu.choices?.[0]?.message?.content ?? '{}'
    const reponse = JSON.parse(brut) as {
      notes?: Record<string, unknown>
      hors_grille?: Array<{ sujet?: unknown; remarque?: unknown }>
    }
    const sous_notes: Jugement['sous_notes'] = {}
    for (const c of contexte.criteres) {
      const valeur = reponse.notes?.[c.cle]
      if (typeof valeur !== 'number' || !Number.isFinite(valeur)) continue
      sous_notes[c.cle] = {
        score: Math.min(scoreMax(c), Math.max(0, Math.round(valeur * 2) / 2)),
        max: scoreMax(c),
      }
    }
    const hors_grille = (reponse.hors_grille ?? [])
      .filter(
        (o): o is { sujet: string; remarque: string } =>
          typeof o.sujet === 'string' && typeof o.remarque === 'string' && o.remarque.trim() !== '',
      )
      .map((o) => ({
        sujet: normaliserSujet(o.sujet),
        remarque: redresserApostrophes(o.remarque.trim()),
      }))
      // These sentences reach the feedback screen in Bulle's own card. One that carries a shape
      // docs/STRINGS.md bans is dropped rather than shown: the list is optional, at most three.
      .filter((o) => !contientFormuleInterdite(o.remarque))
    return { sous_notes, hors_grille }
  }
}

function scoreMax(c: CritereGrille): number {
  return c.regle.score_max > 0 ? c.regle.score_max : 5
}

/** The same remark under the same handle across takes, so the gaps in the grid can be counted. */
function normaliserSujet(sujet: string): string {
  return sujet
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}
