// Rétor, and the note at the end of the debate.
//
// The cahier is firm on one point: the answer must really answer what was just said. So the
// whole transcript goes in every time, oldest turn first, and the model is told to take the last
// thing the person said and push back on that, in a tone Rebecca chose from four.
import { lireUsageChat } from '../debat/consommation.js'
import type { Adversaire, ContexteAdversaire, Debrief } from '../debat/fournisseurs.js'
import {
  appelerJson,
  contientContraste,
  CORRECTION_CONTRASTE,
  redresserApostrophes,
  REGLES_ECRITURE,
  type ConfigOpenAI,
} from './client.js'

const MODELE = 'gpt-4.1-mini'

const TONS: Record<string, string> = {
  ferme:
    'Ferme : tu contredis sans détour, avec des arguments nets, sans jamais manquer de respect.',
  provocateur:
    'Provocateur : tu cherches la faille, tu poses des questions qui dérangent, tu ne lâches pas un point faible.',
  academique:
    'Académique : tu argumentes avec méthode, tu distingues les notions, tu demandes des définitions.',
  bienveillant:
    "Bienveillant : tu contredis avec chaleur, tu reconnais ce qui est juste avant d'attaquer ce qui ne l'est pas.",
}

interface ReponseChat {
  choices?: Array<{ message?: { content?: string | null } }>
  usage?: unknown
}

export class AdversaireOpenAI implements Adversaire {
  readonly nom = `openai:${MODELE}`

  constructor(private readonly config: ConfigOpenAI) {}

  async repondre(contexte: ContexteAdversaire): Promise<string> {
    const systeme = `Tu es Rétor, l'adversaire d'un débat oral d'entraînement dans l'application LEQ.
Tu défends la thèse suivante, jusqu'au bout : « ${contexte.these} »
La personne en face la contredit. À chaque tour, tu réponds à ce qu'elle vient de dire, précisément, en une ou deux phrases courtes qui seront lues à voix haute. Jamais plus de quarante mots.
Ton ton : ${TONS[contexte.ton] ?? TONS['ferme']}
Tu ne dis jamais que tu es une intelligence artificielle, tu ne commentes pas la forme, tu ne félicites pas, tu ne résumes pas. Tu argumentes.

${REGLES_ECRITURE}`
    const messages = [
      { role: 'system', content: systeme },
      ...contexte.tours.map((tour) => ({
        role: tour.locuteur === 'retor' ? 'assistant' : 'user',
        content: tour.texte,
      })),
    ]
    const lu = await appelerJson<ReponseChat>(
      this.config,
      '/v1/chat/completions',
      { model: MODELE, messages, temperature: 0.8, max_tokens: 120 },
      30_000,
    )
    contexte.surConsommation?.(lireUsageChat(lu.usage))
    let texte = redresserApostrophes(lu.choices?.[0]?.message?.content?.trim() ?? '')
    if (texte === '') throw new Error('Rétor a répondu vide')
    if (contientContraste(texte)) {
      const relu = await appelerJson<ReponseChat>(
        this.config,
        '/v1/chat/completions',
        {
          model: MODELE,
          temperature: 0.5,
          max_tokens: 120,
          messages: [
            ...messages,
            { role: 'assistant', content: texte },
            { role: 'user', content: CORRECTION_CONTRASTE },
          ],
        },
        20_000,
      )
      contexte.surConsommation?.(lireUsageChat(relu.usage))
      const corrige = redresserApostrophes(relu.choices?.[0]?.message?.content?.trim() ?? '')
      if (corrige !== '') texte = corrige
    }
    return texte
  }

  async debriefer(contexte: ContexteAdversaire): Promise<Debrief> {
    const transcription = contexte.tours
      .map((tour) => `${tour.locuteur === 'retor' ? 'Rétor' : 'La personne'} : ${tour.texte}`)
      .join('\n')
    const systeme = `Tu relis la transcription d'un débat d'entraînement à l'oral. La personne contredisait la thèse « ${contexte.these} » face à Rétor.
Tu écris un court débrief pour la personne, sur ce qu'elle a dit et rien d'autre : jamais sur sa voix, jamais sur son débit, tu n'as pas entendu l'audio.
Deux ou trois moments qui ont compté, cités ou paraphrasés de près, en une phrase chacun. Puis un seul axe de travail, concret, que la personne peut appliquer au prochain débat.

${REGLES_ECRITURE}`
    const lu = await appelerJson<ReponseChat>(
      this.config,
      '/v1/chat/completions',
      {
        model: MODELE,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systeme },
          { role: 'user', content: transcription },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'debrief',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['moments', 'axe'],
              properties: {
                moments: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
                axe: { type: 'string' },
              },
            },
          },
        },
      },
      45_000,
    )
    contexte.surConsommation?.(lireUsageChat(lu.usage))
    const brut = lu.choices?.[0]?.message?.content ?? '{}'
    const lu2 = JSON.parse(brut) as { moments?: unknown; axe?: unknown }
    const moments = Array.isArray(lu2.moments)
      ? lu2.moments
          .filter((m): m is string => typeof m === 'string' && m.trim() !== '')
          .map((m) => redresserApostrophes(m.trim()))
      : []
    const axe = typeof lu2.axe === 'string' ? redresserApostrophes(lu2.axe.trim()) : ''
    return { moments, axe, provisoire: false }
  }
}
