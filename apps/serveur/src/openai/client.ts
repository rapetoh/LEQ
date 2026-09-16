// One key, four jobs: OpenAI turns speech into text, answers as Rétor, judges what cannot be
// measured, and gives Rétor a voice. Everything goes through `fetch`: no SDK, so nothing here
// changes shape when the SDK does, and the wire is readable in one file.
//
// Every call has a deadline, because a provider that never answers is a person watching a silent
// screen (the conductor cuts the session as our own fault after its own timeout, but a request
// that hangs under it wastes the slot for the whole wait).

export interface ConfigOpenAI {
  cle: string
  /** Defaults to api.openai.com. Overridable for a proxy or a regional endpoint. */
  base?: string
}

export class ErreurOpenAI extends Error {
  override name = 'ErreurOpenAI'
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message)
  }
}

const DELAI_MS = 60_000

export function baseDe(config: ConfigOpenAI): string {
  return (config.base ?? 'https://api.openai.com').replace(/\/$/, '')
}

/** A request with the key, a deadline, and an error that says what the provider said. */
export async function appeler(
  config: ConfigOpenAI,
  chemin: string,
  init: RequestInit & { delaiMs?: number },
): Promise<Response> {
  const controleur = new AbortController()
  const minuteur = setTimeout(() => controleur.abort(), init.delaiMs ?? DELAI_MS)
  try {
    const reponse = await fetch(`${baseDe(config)}${chemin}`, {
      ...init,
      headers: { Authorization: `Bearer ${config.cle}`, ...(init.headers ?? {}) },
      signal: controleur.signal,
    })
    if (!reponse.ok) {
      const corps = await reponse.text().catch(() => '')
      throw new ErreurOpenAI(
        `OpenAI ${chemin} : HTTP ${reponse.status} ${corps.slice(0, 300)}`,
        reponse.status,
      )
    }
    return reponse
  } finally {
    clearTimeout(minuteur)
  }
}

/** JSON in, JSON out. */
export async function appelerJson<T>(
  config: ConfigOpenAI,
  chemin: string,
  corps: unknown,
  delaiMs?: number,
): Promise<T> {
  const reponse = await appeler(config, chemin, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
    ...(delaiMs ? { delaiMs } : {}),
  })
  return (await reponse.json()) as T
}

/**
 * The writing rules, as the model's own instructions. Rétor and the debrief are the only French
 * a person reads that this codebase does not write itself, and `npm run strings` cannot see
 * runtime text: this is the only place docs/STRINGS.md is enforced on it.
 */
export const REGLES_ECRITURE = `Tu écris en français, en tutoiement, dans une langue simple et directe, comme on parle à quelqu'un en face.
Interdits, sans exception :
- les tirets cadratins et demi-cadratins (— et –) ; utilise des virgules, des points, des deux-points ;
- les phrases qui affirment une chose puis nient son contraire (« ce n'est pas X, c'est Y », « X, pas Y ») ;
- les aphorismes, slogans et formules qui sonnent bien sans rien dire ;
- les phrases qui décrivent ce que tu es en train de faire (« je vais maintenant », « j'analyse ») ;
- les phrases qui annoncent ou présentent au lieu de dire (« Voici ce que j'ai remarqué », « Voici deux points ») ;
- les titres ou débuts de phrase faits de noms juxtaposés sans verbe (« Un argument, une preuve », « Ta thèse, en trois points ») ;
- les entrées en conversation (« Et toi, », « Alors, », « Bon, ») ;
- les points d'exclamation ;
- les mots anglais, le jargon, les émojis, les listes à puces dans une réponse orale.
Chaque phrase dit un fait précis, tiré du texte, adressé à la personne. Si une phrase ne fait que sonner juste, supprime-la.
Typographie française : espace insécable avant « : », espace fine insécable avant « ? », « ! » et « ; », guillemets « » avec espace fine.
Une phrase plate et vraie vaut mieux qu'une phrase brillante.`

/**
 * What the model must not have written, checked after the fact. The prompt bans these and the
 * model produces them anyway about one turn in three: the contrastive pair (« ce n'est pas X,
 * c'est Y ») and the curly apostrophe. Apostrophes are simply straightened; a contrastive pair
 * is sent back once for rewriting, and if it comes back again the sentence ships as it is rather
 * than costing a third call and the two-second budget.
 */
export const CONTRASTE = /n['’]est (?:pas|jamais|plus)\b[^.!?]{0,90}?[:,;]\s*(?:c['’]est|mais)\b/iu

export function redresserApostrophes(texte: string): string {
  return texte.replace(/[’‘]/g, "'")
}

export function contientContraste(texte: string): boolean {
  return CONTRASTE.test(texte)
}

export const CORRECTION_CONTRASTE =
  "Ta réponse contient une phrase du type « ce n'est pas X, c'est Y ». Réécris-la sans cette construction : dis ce qui est, sans nier son contraire. Même longueur, même ton, même idée."

/**
 * The other shapes docs/STRINGS.md bans and a model still produces: the short contrastive pair
 * ("X, pas Y"), the sentence that announces instead of saying ("Voici…"), the conversational
 * opener, the dash, the exclamation mark. Same treatment as the contrastive pair: Rétor and the
 * debrief's axe get one rewrite; a remark or a moment that still carries one is dropped, since
 * those lists are optional and a missing sentence costs nothing.
 */
const FORMULES_INTERDITES: readonly RegExp[] = [
  CONTRASTE,
  /,\s(?:pas|jamais|non pas)\s/u,
  /(?:^|[.!?]\s+)Voici\b/u,
  /(?:^|[.!?]\s+)(?:Et toi|Alors|Bon),/u,
  /[–—]/u,
  /!/u,
]

export function contientFormuleInterdite(texte: string): boolean {
  return FORMULES_INTERDITES.some((motif) => motif.test(texte))
}

export const CORRECTION_FORMULE =
  "Ta réponse contient une construction interdite : une phrase qui nie le contraire de ce qu'elle affirme (« X, pas Y », « ce n'est pas X, c'est Y »), un « Voici », une entrée en conversation, un tiret ou un point d'exclamation. Réécris-la sans cela : dis ce qui est, en phrases plates. Même longueur, même ton, même idée."
